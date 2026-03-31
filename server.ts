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
    projectId: admin.app().options.projectId || firebaseConfig.projectId,
    databaseId: dbId, // Use the current dbId
    timestamp: new Date().toISOString()
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // Use explicit application default credentials with the project ID
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId,
    });
    console.log('Firebase Admin initialized with Project ID:', firebaseConfig.projectId);
  } catch (e) {
    console.error('Firebase Admin initialization failed, trying without explicit credentials:', e);
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
}

// Use the specific database instance from the configuration
let dbId = firebaseConfig.firestoreDatabaseId;
let db = getFirestore(admin.app(), dbId);
console.log('Using Firestore database instance:', dbId);

// Test connection on startup
async function testFirestoreConnection() {
  try {
    await db.collection('_health_check').doc('ping').set({ 
      lastPing: admin.firestore.FieldValue.serverTimestamp() 
    });
    console.log(`Firestore connection test successful on ${dbId} database.`);
  } catch (error) {
    console.error(`Firestore connection test failed on ${dbId} database:`, error);
    // If named database fails, try (default)
    if (dbId !== '(default)') {
      console.log('Attempting to fallback to (default) database...');
      try {
        const defaultDb = getFirestore(admin.app(), '(default)');
        await defaultDb.collection('_health_check').doc('ping').set({ 
          lastPing: admin.firestore.FieldValue.serverTimestamp() 
        });
        db = defaultDb;
        dbId = '(default)';
        console.log('Successfully fell back to (default) database.');
      } catch (fallbackError) {
        console.error('Fallback to (default) database also failed:', fallbackError);
      }
    }
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
    appsCount: admin.apps.length,
    env: process.env.NODE_ENV
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
      console.log(`OAuth success for UID: ${uid}. Sending tokens to frontend.`);
    }
    
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                uid: '${uid}',
                tokens: ${JSON.stringify(tokens)}
              }, '*');
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
  // We'll handle status on the frontend now to avoid Firestore permission issues
  res.json({ connected: true }); 
});

app.post("/api/auth/disconnect", async (req, res) => {
  const { uid } = req.body;
  console.log(`Disconnecting Drive for UID: ${uid}`);
  // We handle deletion on the frontend now to avoid server-side permission issues
  res.json({ success: true });
});

app.post("/api/drive/files", async (req, res) => {
  const { folderId, uid, tokens } = req.body;
  console.log(`Fetching Drive files for UID: ${uid}`);
  
  if (!tokens) {
    return res.status(401).json({ error: 'Tokens are required' });
  }

  try {
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
  } catch (error: any) {
    console.error('Drive API error:', error);
    const message = error.message || 'Failed to fetch files from Drive';
    const status = error.code || 500;
    
    // Check if it's an API not enabled error
    if (message.includes('Google Drive API has not been used') || message.includes('disabled')) {
      return res.status(403).json({ 
        error: 'Google Drive API가 활성화되지 않았습니다.',
        details: message,
        helpUrl: `https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${firebaseConfig.projectId}`
      });
    }

    res.status(status).json({ 
      error: message,
      details: error.errors || []
    });
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
