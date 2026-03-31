import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json";
import dotenv from "dotenv";

dotenv.config();

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | undefined;
    emailVerified: boolean | undefined;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    projectId: firebaseConfig.projectId,
    databaseId: dbId, // Log the actual dbId being used
    timestamp: new Date().toISOString()
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log('Firebase Admin initialized with Project ID:', firebaseConfig.projectId);
  } catch (e) {
    console.error('Firebase Admin initialization failed:', e);
  }
}

// Use the specific database instance from the configuration
const dbId = firebaseConfig.firestoreDatabaseId;
const db = getFirestore(admin.app(), dbId);
console.log('Using Firestore database instance from config:', dbId);

// Test connection on startup
async function testFirestoreConnection() {
  try {
    await db.collection('_health_check').doc('ping').set({ 
      lastPing: admin.firestore.FieldValue.serverTimestamp() 
    });
    console.log(`Firestore connection test successful on ${dbId} database.`);
  } catch (error) {
    console.error(`Firestore connection test failed on ${dbId} database:`, error);
  }
}
testFirestoreConnection();

const app = express();
const PORT = 3000;

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/debug/firebase", (req, res) => {
  res.json({
    configProjectId: firebaseConfig.projectId,
    envProjectId: process.env.GOOGLE_CLOUD_PROJECT || 'not set',
    databaseId: dbId,
    appsCount: admin.apps.length
  });
});

// Trust proxy for secure cookies behind nginx
app.set('trust proxy', 1);

app.use(express.json());

const getRedirectUri = (req: express.Request) => {
  let uri = "";
  if (process.env.GOOGLE_REDIRECT_URI) {
    uri = process.env.GOOGLE_REDIRECT_URI;
  } else if (process.env.APP_URL) {
    const baseUrl = process.env.APP_URL.replace(/\/$/, '');
    uri = `${baseUrl}/auth/google/callback`;
  } else {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['host'];
    uri = `${protocol}://${host}/auth/google/callback`;
  }
  console.log('Using Redirect URI:', uri);
  return uri;
};

const getOAuth2Client = (req: express.Request) => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri(req)
  );
};

// --- API Routes ---

app.get("/api/auth/google/url", (req, res) => {
  const uid = req.query.uid as string;
  const oauth2Client = getOAuth2Client(req);
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ],
    prompt: 'consent',
    state: uid // Pass UID through state parameter
  });
  res.json({ url });
});

app.get("/auth/google/callback", async (req, res) => {
  const { code, state: uid } = req.query;
  try {
    const oauth2Client = getOAuth2Client(req);
    console.log('Exchanging code for tokens...');
    const { tokens } = await oauth2Client.getToken(code as string);
    console.log('Tokens received successfully.');
    
    if (uid) {
      // Store tokens in Firestore instead of session
      try {
        await db.collection('user_tokens').doc(uid as string).set({
          tokens,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Tokens stored in Firestore for UID: ${uid}. Access token length:`, tokens.access_token?.length);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `user_tokens/${uid}`);
      }
    } else {
      console.warn('OAuth callback missing UID in state. Tokens not stored in Firestore.');
    }
    
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', uid: '${uid}' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>인증 성공! 이 창은 자동으로 닫힙니다.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth error details:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).send(`Authentication failed: ${errorMessage}`);
  }
});

app.get("/api/auth/status", async (req, res) => {
  const uid = req.query.uid as string;
  if (!uid) return res.json({ connected: false });

  try {
    const docRef = db.collection('user_tokens').doc(uid);
    const doc = await docRef.get();
    const isConnected = doc.exists;
    console.log(`Auth status check for UID ${uid}:`, isConnected ? 'Connected' : 'Disconnected');
    res.json({ connected: isConnected });
  } catch (error) {
    console.error('Failed to check auth status from Firestore:', error);
    // If it's a permission error, we'll see it in the logs from handleFirestoreError if we wrap it
    if (error instanceof Error && error.message.includes('PERMISSION_DENIED')) {
      res.status(403).json({ error: 'Permission denied', details: error.message });
    } else {
      res.status(500).json({ error: 'Database error' });
    }
  }
});

app.post("/api/auth/disconnect", async (req, res) => {
  const { uid } = req.body;
  console.log(`Disconnecting Drive for UID: ${uid}`);
  if (uid) {
    try {
      await db.collection('user_tokens').doc(uid).delete().catch(e => handleFirestoreError(e, OperationType.DELETE, `user_tokens/${uid}`));
    } catch (error) {
      console.error('Failed to delete tokens from Firestore:', error);
    }
  }
  res.json({ success: true });
});

app.post("/api/drive/files", async (req, res) => {
  const { folderId, uid } = req.body;
  console.log(`Fetching Drive files for UID: ${uid}`);
  
  if (!uid) {
    return res.status(401).json({ error: 'UID is required' });
  }

  try {
    const docRef = db.collection('user_tokens').doc(uid);
    const doc = await docRef.get();
    if (!doc.exists) {
      console.warn(`No tokens found in Firestore for UID: ${uid}`);
      return res.status(401).json({ 
        error: 'Not connected to Google Drive. Please reconnect.',
        reason: 'TOKENS_MISSING'
      });
    }

    const data = doc.data();
    if (!data || !data.tokens) {
      throw new Error('Invalid token data in Firestore');
    }
    const { tokens } = data;
    const oauth2Client = getOAuth2Client(req);
    oauth2Client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // List images and PDFs in the folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType contains 'image/' or mimeType = 'application/pdf')`,
      fields: 'files(id, name, mimeType)',
      pageSize: 10
    });

    const files = response.data.files || [];
    const driveFiles = await Promise.all(files.map(async (file) => {
      const fileRes = await drive.files.get(
        { fileId: file.id!, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      const base64 = Buffer.from(fileRes.data as ArrayBuffer).toString('base64');
      return {
        name: file.name,
        mimeType: file.mimeType,
        data: base64
      };
    }));

    res.json({ files: driveFiles });
  } catch (error) {
    console.error('Drive API error:', error);
    res.status(500).json({ error: 'Failed to fetch files from Drive' });
  }
});

// --- Vite Middleware ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
