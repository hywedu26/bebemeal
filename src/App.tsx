/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  Link, 
  useLocation
} from 'react-router-dom';
import { 
  onAuthStateChanged, 
  User, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  orderBy
} from 'firebase/firestore';
import { 
  Baby, 
  ChefHat, 
  History, 
  Home, 
  Plus, 
  Settings, 
  ShoppingCart, 
  LogOut, 
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Utensils,
  Loader2,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Folder,
  Link2,
  ExternalLink,
  Info,
  UtensilsCrossed,
  FileText,
  Image,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInMonths, differenceInDays, addDays, parseISO } from 'date-fns';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, db, googleProvider } from './firebase';
import { getDocFromServer } from 'firebase/firestore';

// --- Utilities ---
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface UserProfile {
  uid: string;
  email: string;
  babyName: string;
  babyBirthday: string;
  mealsPerDay: number;
  sideDishesPerMeal: number;
  driveFolderId?: string;
}

interface InventoryItem {
  id: string;
  uid: string;
  name: string;
  category: 'carbohydrate' | 'protein' | 'vegetable' | 'fruit' | 'raw';
  quantity: number;
  unit: string;
  addedAt: string;
}

interface MealRecord {
  id: string;
  uid: string;
  date: string;
  mealIndex: number;
  recipeName: string;
  ingredients: string[];
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger', size?: 'sm' | 'md' | 'lg' }>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm',
      secondary: 'bg-amber-100 text-amber-900 hover:bg-amber-200',
      outline: 'border border-gray-200 bg-white hover:bg-gray-50 text-gray-700',
      ghost: 'hover:bg-gray-100 text-gray-600',
      danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-xs rounded-lg',
      md: 'px-4 py-2.5 text-sm rounded-xl',
      lg: 'px-6 py-3.5 text-base rounded-2xl',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div 
    className={cn('bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden', className)}
    onClick={onClick}
  >
    {children}
  </div>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);

// --- Pages ---

const Login = () => {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="space-y-4">
          <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-orange-200">
            <Baby className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">BebéMeal</h1>
          <p className="text-gray-600 text-lg">
            똑똑한 아기 이유식 & 유아식 매니저.<br />
            재고 관리부터 레시피 추천까지 한 번에.
          </p>
        </div>
        <Button onClick={handleLogin} className="w-full h-14 text-lg gap-3">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
          Google로 시작하기
        </Button>
      </motion.div>
    </div>
  );
};

const Dashboard = ({ user, profile, inventory }: { user: User; profile: UserProfile | null; inventory: InventoryItem[] }) => {
  const ageInfo = useMemo(() => {
    if (!profile?.babyBirthday) return null;
    const birthday = parseISO(profile.babyBirthday);
    const now = new Date();
    const months = differenceInMonths(now, birthday);
    const days = differenceInDays(now, addDays(birthday, months * 30.44)); // Approximate
    return { months, days: Math.max(0, days) };
  }, [profile]);

  const stockStatus = useMemo(() => {
    if (!profile) return null;
    const totalMealsNeededPerDay = profile.mealsPerDay;
    const totalSideDishesNeededPerDay = profile.mealsPerDay * profile.sideDishesPerMeal;
    
    // Simple logic: 1 carb item = 1 meal, 1 protein/veg = 1 side dish
    const carbs = inventory.filter(i => i.category === 'carbohydrate').reduce((acc, i) => acc + i.quantity, 0);
    const sides = inventory.filter(i => i.category === 'protein' || i.category === 'vegetable').reduce((acc, i) => acc + i.quantity, 0);

    const carbDays = carbs / totalMealsNeededPerDay;
    const sideDays = sides / totalSideDishesNeededPerDay;

    return {
      carbDays: Math.floor(carbDays),
      sideDays: Math.floor(sideDays),
      isLow: carbDays < 2 || sideDays < 2
    };
  }, [profile, inventory]);

  const diversityStatus = useMemo(() => {
    const categories = new Set(inventory.map(i => i.category));
    const missing = (['carbohydrate', 'protein', 'vegetable'] as const).filter(c => !categories.has(c));
    return missing;
  }, [inventory]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">안녕하세요, {user.displayName?.split(' ')[0]}님!</h2>
          {profile && ageInfo && (
            <p className="text-gray-500 font-medium">
              {profile.babyName}는 오늘 <span className="text-orange-600">{ageInfo.months}개월 {ageInfo.days}일</span>째예요.
            </p>
          )}
        </div>
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-100">
          <img src={user.photoURL || ''} alt="Profile" />
        </div>
      </header>

      {/* Alerts */}
      <AnimatePresence>
        {(stockStatus?.isLow || diversityStatus.length > 0) && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            {stockStatus?.isLow && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-red-900 text-sm">재고 부족 알림</h4>
                  <p className="text-red-700 text-xs mt-1">
                    현재 재고로는 {Math.min(stockStatus.carbDays, stockStatus.sideDays)}일 뒤면 식사가 부족할 수 있어요. 재고를 추가해주세요!
                  </p>
                </div>
              </div>
            )}
            {diversityStatus.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3 items-start">
                <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-900 text-sm">영양 다양성 알림</h4>
                  <p className="text-amber-700 text-xs mt-1">
                    현재 {diversityStatus.map(c => c === 'carbohydrate' ? '탄수화물' : c === 'protein' ? '단백질' : '채소류').join(', ')} 재료가 부족해요. 골고루 챙겨주세요!
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 bg-orange-50 border-orange-100">
          <div className="flex items-center gap-2 text-orange-600 mb-1">
            <Utensils className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">오늘의 식사</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{profile?.mealsPerDay || 0}회</div>
          <p className="text-[10px] text-gray-500 mt-1">반찬 {profile?.sideDishesPerMeal || 0}개씩</p>
        </Card>
        <Card className="p-4 bg-blue-50 border-blue-100">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <ShoppingCart className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">보유 재료</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{inventory.length}종</div>
          <p className="text-[10px] text-gray-500 mt-1">총 {inventory.reduce((acc, i) => acc + i.quantity, 0)}개</p>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider px-1">빠른 실행</h3>
        <div className="grid grid-cols-1 gap-3">
          <Link to="/recipes">
            <Card className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">AI 레시피 추천</h4>
                  <p className="text-xs text-gray-500">보유 재료로 최적의 메뉴 찾기</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-orange-500 transition-colors" />
            </Card>
          </Link>
          <Link to="/inventory">
            <Card className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">재고 추가하기</h4>
                  <p className="text-xs text-gray-500">새로운 식재료나 반찬 등록</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
};

const Inventory = ({ inventory, userId }: { inventory: InventoryItem[]; userId: string }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'carbohydrate', quantity: 1, unit: '개' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name) return;
    await addDoc(collection(db, 'inventory'), {
      ...newItem,
      uid: userId,
      addedAt: new Date().toISOString()
    });
    setNewItem({ name: '', category: 'carbohydrate', quantity: 1, unit: '개' });
    setIsAdding(false);
  };

  const handleUpdateQuantity = async (id: string, delta: number) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const newQty = Math.max(0, item.quantity + delta);
    if (newQty === 0) {
      await deleteDoc(doc(db, 'inventory', id));
    } else {
      await updateDoc(doc(db, 'inventory', id), { quantity: newQty });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">재고 관리</h2>
        <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? 'ghost' : 'primary'} className="gap-2">
          {isAdding ? '취소' : <><Plus className="w-4 h-4" /> 추가</>}
        </Button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="p-4 border-orange-200 bg-orange-50/30">
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">재료명</label>
                    <Input 
                      placeholder="예: 소고기 미역죽, 당근" 
                      value={newItem.name} 
                      onChange={e => setNewItem({...newItem, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">카테고리</label>
                    <Select 
                      value={newItem.category} 
                      onChange={e => setNewItem({...newItem, category: e.target.value as any})}
                    >
                      <option value="carbohydrate">탄수화물 (밥/죽)</option>
                      <option value="protein">단백질 (고기/생선)</option>
                      <option value="vegetable">채소류</option>
                      <option value="fruit">과일</option>
                      <option value="raw">원재료</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">수량</label>
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        className="w-20" 
                        value={newItem.quantity} 
                        onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})}
                      />
                      <Input 
                        placeholder="단위" 
                        className="flex-1" 
                        value={newItem.unit} 
                        onChange={e => setNewItem({...newItem, unit: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full">등록하기</Button>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {inventory.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>등록된 재료가 없어요.</p>
          </div>
        ) : (
          inventory.map(item => (
            <Card key={item.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-2 h-10 rounded-full",
                  item.category === 'carbohydrate' ? 'bg-amber-400' :
                  item.category === 'protein' ? 'bg-red-400' :
                  item.category === 'vegetable' ? 'bg-green-400' :
                  item.category === 'fruit' ? 'bg-pink-400' : 'bg-gray-400'
                )} />
                <div>
                  <h4 className="font-bold text-gray-900">{item.name}</h4>
                  <p className="text-xs text-gray-500">
                    {item.category === 'carbohydrate' ? '탄수화물' :
                     item.category === 'protein' ? '단백질' :
                     item.category === 'vegetable' ? '채소류' :
                     item.category === 'fruit' ? '과일' : '원재료'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button 
                    onClick={() => handleUpdateQuantity(item.id, -1)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-md transition-colors"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-bold text-sm">{item.quantity}{item.unit}</span>
                  <button 
                    onClick={() => handleUpdateQuantity(item.id, 1)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-md transition-colors"
                  >
                    +
                  </button>
                </div>
                <button 
                  onClick={() => deleteDoc(doc(db, 'inventory', item.id))}
                  className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

const Recipes = ({ inventory, profile, userId }: { inventory: InventoryItem[]; profile: UserProfile | null; userId: string }) => {
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<RecipeRecommendation[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeRecommendation | null>(null);
  const [customIngredients, setCustomIngredients] = useState('');
  const [driveConnected, setDriveConnected] = useState(false);
  const [folderId, setFolderId] = useState(profile?.driveFolderId || '');
  const [driveFilesList, setDriveFilesList] = useState<{ name: string; mimeType: string }[]>([]);
  const [fetchingFiles, setFetchingFiles] = useState(false);
  const [showLearnedList, setShowLearnedList] = useState(false);
  const [groundingSources, setGroundingSources] = useState<{ title: string; uri: string }[]>([]);

  interface RecipeRecommendation {
    title: string;
    ingredients: string[];
    instructions: string[];
    nutritionPoint: string;
    source: string;
    sourceUrl?: string;
    isTopPick: boolean;
  }

  useEffect(() => {
    if (profile?.driveFolderId) {
      setFolderId(profile.driveFolderId);
    }
  }, [profile]);

  useEffect(() => {
    checkDriveStatus();
    const handleMessage = (event: MessageEvent) => {
      // Check if the message is from our OAuth popup
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        console.log('OAuth success message received from popup');
        setDriveConnected(true);
        // Also check status from server to confirm session is valid
        setTimeout(() => {
          checkDriveStatus();
        }, 2000);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkDriveStatus = async () => {
    if (!userId) return;
    console.log('Checking Google Drive connection status for UID:', userId);
    try {
      const res = await fetch(`/api/auth/status?uid=${userId}`, { credentials: 'include' });
      const data = await res.json();
      console.log('Drive status response:', data);
      setDriveConnected(data.connected);
    } catch (error) {
      console.error('Failed to check Drive status:', error);
    }
  };

  const handleConnectDrive = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/auth/google/url?uid=${userId}`, { credentials: 'include' });
      const { url } = await res.json();
      window.open(url, 'google_auth', 'width=600,height=700');
    } catch (error) {
      console.error('Failed to get Auth URL:', error);
    }
  };

  const handleDisconnectDrive = async () => {
    if (!userId) return;
    try {
      await fetch('/api/auth/disconnect', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId }),
        credentials: 'include'
      });
      setDriveConnected(false);
      setDriveFilesList([]);
      setRecipes([]);
      setSelectedRecipe(null);
    } catch (error) {
      console.error('Failed to disconnect Drive:', error);
    }
  };

  const getDriveFiles = async (retryCount = 0): Promise<any[]> => {
    if (!driveConnected || !folderId || !userId) return [];
    try {
      const res = await fetch('/api/drive/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, uid: userId }),
        credentials: 'include'
      });
      
      if (res.status === 401) {
        if (retryCount < 2) {
          console.log(`Fetch failed with 401, retrying... (attempt ${retryCount + 1})`);
          await new Promise(r => setTimeout(r, 1000));
          return getDriveFiles(retryCount + 1);
        }
        setDriveConnected(false);
        setDriveFilesList([]);
        return [];
      }
      if (res.ok) {
        const data = await res.json();
        return data.files;
      }
      return [];
    } catch (error) {
      console.error('Failed to get Drive files:', error);
      return [];
    }
  };

  const fetchDriveFiles = async () => {
    if (!driveConnected || !folderId) return;
    setFetchingFiles(true);
    setShowLearnedList(true);
    
    try {
      // Save folderId to profile if changed
      if (folderId !== profile?.driveFolderId) {
        await updateDoc(doc(db, 'users', userId), { driveFolderId: folderId });
      }

      const files = await getDriveFiles();
      setDriveFilesList(files.map((f: any) => ({ name: f.name, mimeType: f.mimeType })));
    } catch (error) {
      console.error('Failed to fetch Drive files:', error);
    } finally {
      setFetchingFiles(false);
    }
  };

  useEffect(() => {
    if (driveConnected && folderId) {
      console.log('Triggering fetchDriveFiles due to connection/folder change');
      fetchDriveFiles();
    }
  }, [driveConnected, folderId]);

  const generateRecipe = async () => {
    setLoading(true);
    setRecipes([]);
    setSelectedRecipe(null);
    setGroundingSources([]);
    
    try {
      let driveFiles: any[] = await getDriveFiles();
      if (driveFiles.length > 0) {
        setDriveFilesList(driveFiles.map(f => ({ name: f.name, mimeType: f.mimeType })));
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      const parts: any[] = [
        {
          text: `
            당신은 30년 경력의 이유식 및 유아식 전문 요리사입니다. 아기들의 건강과 영양을 최우선으로 생각하며, 부모님들에게 정확하고 구체적인 레시피를 제공하는 것이 당신의 사명입니다.

            아기 이유식/유아식 레시피를 총 10가지 추천해줘. 그 중 당신이 가장 추천하는 메뉴 3가지는 'isTopPick'을 true로 설정해줘.
            
            [레시피 추천 우선순위]
            1순위: 구글 드라이브 속 레시피 (첨부된 사진 및 PDF 파일)
            2순위: 유튜브, 인스타그램, 블로그 등 외부 검증된 레시피
            3순위: AI 자체 제작 레시피 (위의 소스가 부족할 경우에만)

            아기 정보: ${profile?.babyName}, ${profile?.babyBirthday} 생일 (현재 약 ${differenceInMonths(new Date(), parseISO(profile?.babyBirthday || ''))}개월)
            보유 재료: ${inventory.map(i => `${i.name}(${i.quantity}${i.unit})`).join(', ')}
            ${customIngredients ? `사용자 추가 요청 재료 (우선 반영): ${customIngredients}` : ''}
            
            ${driveFiles.length > 0 ? `첨부된 파일들은 사용자가 구글 드라이브에 저장한 레시피 사진 및 PDF들이야. 파일명은 다음과 같아: ${driveFiles.map(f => f.name).join(', ')}. 이 파일 속 레시피들을 최우선적으로 학습해서 "그대로" 출력해줘. 파일에 적힌 재료의 양과 조리 시간을 절대 임의로 수정하지 마. 출처(source)는 해당 파일명으로 적어줘.` : ''}
            
            만약 드라이브 사진 속 레시피 외에 추가 추천이 필요하다면, 유튜브, 인스타그램, 블로그 등에서 해당 개월 수 아기가 먹기 좋고 반응이 좋은(인기 있는) 레시피를 검색해서 추천해줘. 
            출처(source) 작성 시 반드시 다음 형식을 지켜줘:
            - 유튜브: 유튜브(채널명) (예: 유튜브(윤미네 이유식))
            - 블로그: 블로그(블로그명/닉네임)
            - 인스타그램: 인스타그램(계정명)
            - AI 자체 제작: AI 추천 레시피
            
            또한, 외부 소스(유튜브, 블로그, 인스타그램)의 경우 해당 레시피 페이지로 바로 이동할 수 있는 정확한 URL을 'sourceUrl' 필드에 포함해줘.
            
            [레시피 작성 규칙]
            1. 재료와 양: 모든 재료는 정확한 양과 비율을 포함해야 함. (예: 가지 1/2개(60g), 연두부 1개(150g), 쌀가루 30g 등) 대충 '약간', '적당히' 같은 표현은 절대 사용하지 마.
            2. 조리 시간: 굽기, 찌기, 끓이기 등 모든 조리 단계에서 구체적인 시간(분 단위)을 명시해. (예: 약불에서 5분간 저어가며 끓이기, 찜기에서 15분간 찌기 등)
            3. 조리 방법: 단계별로 상세하게 작성해.
            4. 영양 포인트: 해당 레시피가 아기에게 왜 좋은지 전문적인 시각에서 설명해줘.
            5. 출처: 각 레시피의 출처를 정확히 명시해 (구글 드라이브 파일명, 블로그, 인스타그램, 유튜브 등).
            6. 페르소나: 30년 경력의 전문가답게 친절하면서도 신뢰감 있는 말투를 사용해.

            각 레시피는 제목, 필요한 재료(리스트), 상세 조리법(단계별 리스트), 영양 포인트, 출처, 추천 여부(isTopPick)를 포함해야 해.
            한국어로 작성해줘.
          `
        }
      ];

      // Add Drive files to parts
      console.log(`Sending ${driveFiles.length} files from Drive to Gemini:`, driveFiles.map(f => f.name));
      driveFiles.forEach(file => {
        parts.push({
          inlineData: {
            mimeType: file.mimeType,
            data: file.data
          }
        });
      });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
                nutritionPoint: { type: Type.STRING },
                source: { type: Type.STRING },
                sourceUrl: { type: Type.STRING, description: "외부 레시피의 경우 해당 페이지 URL" },
                isTopPick: { type: Type.BOOLEAN }
              },
              required: ["title", "ingredients", "instructions", "nutritionPoint", "source", "isTopPick"]
            }
          }
        },
      });

      const result = JSON.parse(response.text || '[]');
      setRecipes(result);
      
      // Extract grounding sources
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        const sources = chunks
          .filter((c: any) => c.web)
          .map((c: any) => ({ title: c.web.title, uri: c.web.uri }));
        setGroundingSources(sources);
      }
    } catch (error) {
      console.error('Recipe generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">AI 레시피 추천</h2>
      
      <div className="grid gap-4">
        {/* Google Drive Connection Card */}
        <Card className="p-4 border-blue-100 bg-blue-50/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-sm">구글 드라이브 연동</h4>
                <p className="text-[10px] text-gray-500">레시피 사진 및 PDF를 분석합니다</p>
              </div>
            </div>
            {!driveConnected ? (
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <Button onClick={checkDriveStatus} variant="ghost" size="sm" className="h-9 px-2 text-gray-400">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  <Button onClick={handleConnectDrive} variant="outline" className="h-9 text-xs gap-2">
                    <Link2 className="w-3.5 h-3.5" /> 연동하기
                  </Button>
                </div>
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="text-[9px] text-blue-600 underline hover:text-blue-800 font-medium"
                >
                  연동이 안 되나요? (새 탭에서 열기)
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-green-600 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" /> 연동됨
                </div>
                <Button 
                  onClick={() => setShowLearnedList(!showLearnedList)} 
                  variant="secondary" 
                  size="sm" 
                  className="h-7 text-[10px] px-2 bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  {showLearnedList ? '목록 닫기' : '학습한 목록'}
                </Button>
                <Button onClick={handleDisconnectDrive} variant="ghost" size="sm" className="h-7 text-[10px] text-gray-400 hover:text-red-500">
                  연동 해제
                </Button>
              </div>
            )}
          </div>

          {driveConnected && (
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">폴더 ID</label>
                  <div className="group relative">
                    <Info className="w-3 h-3 text-gray-300 cursor-help" />
                    <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
                      구글 드라이브 폴더를 열었을 때 URL의 마지막 부분(예: 1abc...xyz)이 폴더 ID입니다.
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input 
                    placeholder="구글 드라이브 폴더 ID를 입력하세요" 
                    value={folderId}
                    onChange={e => setFolderId(e.target.value)}
                    className="h-10 text-xs bg-white flex-1"
                  />
                  <Button 
                    onClick={fetchDriveFiles} 
                    variant="outline" 
                    size="sm" 
                    className="h-10 px-3"
                    disabled={fetchingFiles}
                  >
                    {fetchingFiles ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              {(fetchingFiles || (showLearnedList && driveFilesList.length > 0)) && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 bg-white/50 rounded-xl border border-blue-100/30 overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                      학습된 파일 {driveFilesList.length > 0 && `(${driveFilesList.length}개)`}
                    </span>
                    {fetchingFiles && <Loader2 className="w-3 h-3 animate-spin text-blue-600" />}
                  </div>
                  
                  {fetchingFiles && driveFilesList.length === 0 ? (
                    <p className="text-[10px] text-gray-400 py-2">파일을 불러오는 중입니다...</p>
                  ) : driveFilesList.length > 0 ? (
                    <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                      {driveFilesList.map((file, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between p-2 bg-white border border-blue-50 rounded-lg text-[10px] text-gray-700 hover:border-blue-200 transition-colors cursor-default group"
                        >
                          <div className="flex items-center gap-2 truncate">
                            {file.mimeType.includes('pdf') ? (
                              <div className="w-6 h-6 bg-red-50 text-red-500 rounded flex items-center justify-center shrink-0">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 bg-blue-50 text-blue-500 rounded flex items-center justify-center shrink-0">
                                <Image className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <span className="truncate font-medium">{file.name}</span>
                          </div>
                          <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            학습 완료
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 py-2">폴더에 이미지나 PDF 파일이 없습니다.</p>
                  )}
                </motion.div>
              )}

              <div className="pt-2 border-t border-blue-100/50">
                <p className="text-[10px] text-gray-600 leading-relaxed">
                  <span className="font-bold text-blue-600">🔒 개인정보 보호:</span><br />
                  AI는 오직 <b>입력하신 폴더 내의 파일만</b> 읽어오며, 다른 데이터는 절대 접근하지 않습니다. 
                  연동 해제 시 즉시 모든 권한이 삭제됩니다.
                </p>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none shadow-orange-200 shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">맞춤형 레시피 생성</h3>
              <p className="text-orange-100 text-sm">보유 재료, 추가 재료, 드라이브 사진 학습</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs font-bold text-orange-100 mb-1 block">우선 반영할 재료 (선택사항)</label>
            <input 
              type="text"
              placeholder="예: 전복, 브로콜리 (입력 시 우선 반영)"
              className="w-full h-10 bg-white/10 border border-white/20 rounded-xl px-4 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/50"
              value={customIngredients}
              onChange={e => setCustomIngredients(e.target.value)}
            />
          </div>

          <Button 
            onClick={generateRecipe} 
            disabled={loading || (inventory.length === 0 && !customIngredients && !folderId)}
            className="w-full bg-white text-orange-600 hover:bg-orange-50 h-12 font-bold"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> 분석 및 검색 중...</> : '레시피 추천받기'}
          </Button>
        </Card>
      </div>

      {/* Recipe Results Section */}
      {loading && (
        <Card className="p-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
          <div className="space-y-1">
            <p className="font-bold text-gray-900">AI가 최고의 레시피를 찾고 있어요</p>
            <p className="text-sm text-gray-500">구글 드라이브 파일(사진, PDF)과 최신 트렌드를 분석 중입니다...</p>
          </div>
        </Card>
      )}

      {!loading && recipes.length > 0 && !selectedRecipe && (
        <div className="space-y-8">
          {/* Top Picks Section */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-orange-500" />
              전문가 추천 TOP 3
            </h3>
            <div className="grid gap-4">
              {recipes.filter(r => r.isTopPick).map((r, idx) => (
                <Card 
                  key={idx} 
                  className="p-6 border-2 border-orange-200 bg-orange-50/20 hover:border-orange-400 cursor-pointer transition-all hover:shadow-lg group relative overflow-hidden"
                  onClick={() => setSelectedRecipe(r)}
                >
                  <div className="absolute top-0 right-0 p-2">
                    <div className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
                      TOP PICK
                    </div>
                  </div>
                  <div className="flex justify-between items-start">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <h4 className="text-xl font-bold text-gray-900 group-hover:text-orange-600 transition-colors">{r.title}</h4>
                        <div className="text-[10px] text-orange-600 font-medium flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> 출처: {r.sourceUrl ? (
                            <a 
                              href={r.sourceUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="underline hover:text-orange-800"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.source}
                            </a>
                          ) : r.source}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {r.ingredients.slice(0, 8).map((ing, i) => (
                          <span key={i} className="px-2.5 py-1 bg-white text-orange-700 text-[11px] rounded-full border border-orange-100 shadow-sm">
                            {ing}
                          </span>
                        ))}
                        {r.ingredients.length > 8 && (
                          <span className="text-[11px] text-gray-400 self-center">외 {r.ingredients.length - 8}개</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-orange-300 group-hover:text-orange-500 mt-2" />
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Other Recommendations Section */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Utensils className="w-5 h-5 text-gray-400" />
              그 외 추천 레시피
            </h3>
            <div className="grid gap-3">
              {recipes.filter(r => !r.isTopPick).map((r, idx) => (
                <Card 
                  key={idx} 
                  className="p-4 hover:border-gray-300 cursor-pointer transition-all hover:shadow-md group"
                  onClick={() => setSelectedRecipe(r)}
                >
                  <div className="flex justify-between items-center">
                    <div className="space-y-1.5">
                      <h4 className="text-base font-bold text-gray-900 group-hover:text-orange-600 transition-colors">{r.title}</h4>
                      <div className="flex items-center gap-3">
                        <div className="text-[9px] text-gray-400 flex items-center gap-1">
                          <Link2 className="w-2.5 h-2.5" /> {r.sourceUrl ? (
                            <a 
                              href={r.sourceUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="underline hover:text-gray-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.source}
                            </a>
                          ) : r.source}
                        </div>
                        <div className="flex gap-1">
                          {r.ingredients.slice(0, 3).map((ing, i) => (
                            <span key={i} className="text-[9px] text-gray-500">• {ing}</span>
                          ))}
                          {r.ingredients.length > 3 && (
                            <span className="text-[9px] text-gray-400">외 {r.ingredients.length - 3}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-400" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && selectedRecipe && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-none shadow-2xl">
            <div className="bg-orange-600 p-6 text-white flex justify-between items-center">
              <div className="space-y-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white hover:bg-orange-700 -ml-2 mb-2 h-7 text-xs"
                  onClick={() => setSelectedRecipe(null)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> 목록으로 돌아가기
                </Button>
                <h3 className="text-2xl font-bold">{selectedRecipe.title}</h3>
                <div className="text-orange-100 text-xs flex items-center gap-1">
                  <Link2 className="w-3 h-3" /> 출처: {selectedRecipe.sourceUrl ? (
                    <a 
                      href={selectedRecipe.sourceUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="underline hover:text-white"
                    >
                      {selectedRecipe.source}
                    </a>
                  ) : selectedRecipe.source}
                </div>
              </div>
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
            </div>
            
            <div className="p-8 space-y-8 bg-white">
              <section className="space-y-3">
                <h4 className="font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-orange-500 rounded-full" />
                  필요한 재료
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedRecipe.ingredients.map((ing, i) => (
                    <div key={i} className="p-2 bg-orange-50 text-orange-700 text-xs rounded-lg border border-orange-100">
                      • {ing}
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-orange-500 rounded-full" />
                  조리 방법
                </h4>
                <div className="space-y-4">
                  {selectedRecipe.instructions.map((step, i) => (
                    <div key={i} className="flex gap-4 group">
                      <div className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="p-5 bg-blue-50 rounded-2xl border border-blue-100 space-y-2">
                <h4 className="font-bold text-blue-900 text-sm flex items-center gap-2">
                  <Info className="w-4 h-4" /> 영양 포인트
                </h4>
                <p className="text-xs text-blue-700 leading-relaxed">{selectedRecipe.nutritionPoint}</p>
              </section>

              {groundingSources.length > 0 && (
                <section className="pt-6 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">참고한 출처</h4>
                  <div className="flex flex-wrap gap-2">
                    {groundingSources.map((source, idx) => (
                      <a 
                        key={idx} 
                        href={source.uri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 text-[10px] rounded-lg transition-colors border border-gray-200"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {source.title}
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {!loading && recipes.length === 0 && inventory.length === 0 && !customIngredients && !folderId && (
        <div className="text-center py-12 text-gray-400">
          <p>재고를 등록하거나 구글 드라이브를 연동해보세요!</p>
        </div>
      )}
    </div>
  );
};

const HistoryPage = ({ meals }: { meals: MealRecord[] }) => {
  const groupedMeals = useMemo(() => {
    const groups: { [key: string]: MealRecord[] } = {};
    meals.forEach(meal => {
      if (!groups[meal.date]) groups[meal.date] = [];
      groups[meal.date].push(meal);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [meals]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">식사 기록</h2>
      
      <div className="space-y-8">
        {groupedMeals.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>아직 기록된 식사가 없어요.</p>
          </div>
        ) : (
          groupedMeals.map(([date, dayMeals]) => (
            <div key={date} className="space-y-3">
              <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {format(parseISO(date), 'yyyy년 MM월 dd일')}
              </h3>
              <div className="grid gap-3">
                {dayMeals.sort((a, b) => a.mealIndex - b.mealIndex).map(meal => (
                  <Card key={meal.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold text-xs">
                        {meal.mealIndex}회차
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{meal.recipeName}</h4>
                        <p className="text-xs text-gray-500">{meal.ingredients.join(', ')}</p>
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const Profile = ({ user, profile, userId }: { user: User; profile: UserProfile | null; userId: string }) => {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<UserProfile>({
    uid: userId,
    email: user.email || '',
    babyName: '',
    babyBirthday: format(new Date(), 'yyyy-MM-dd'),
    mealsPerDay: 3,
    sideDishesPerMeal: 2
  });

  useEffect(() => {
    if (profile) setFormData(profile);
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await setDoc(doc(db, 'users', userId), formData);
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">프로필 & 설정</h2>
        {!editing && (
          <Button onClick={() => setEditing(true)} variant="outline" className="gap-2">
            <Edit2 className="w-4 h-4" /> 수정
          </Button>
        )}
      </div>

      <Card className="p-6 text-center">
        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-orange-100 mx-auto mb-4">
          <img src={user.photoURL || ''} alt="Profile" className="w-full h-full object-cover" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">{user.displayName}</h3>
        <p className="text-gray-500 text-sm">{user.email}</p>
        <Button onClick={() => signOut(auth)} variant="ghost" className="mt-4 text-red-500 hover:text-red-600 hover:bg-red-50 gap-2">
          <LogOut className="w-4 h-4" /> 로그아웃
        </Button>
      </Card>

      {editing ? (
        <Card className="p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">아기 이름</label>
              <Input 
                value={formData.babyName} 
                onChange={e => setFormData({...formData, babyName: e.target.value})}
                placeholder="아기 이름을 입력해주세요"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">아기 생일</label>
              <Input 
                type="date"
                value={formData.babyBirthday} 
                onChange={e => setFormData({...formData, babyBirthday: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">하루 식사 횟수</label>
                <Input 
                  type="number"
                  value={formData.mealsPerDay} 
                  onChange={e => setFormData({...formData, mealsPerDay: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">한 끼 반찬 갯수</label>
                <Input 
                  type="number"
                  value={formData.sideDishesPerMeal} 
                  onChange={e => setFormData({...formData, sideDishesPerMeal: Number(e.target.value)})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">구글 드라이브 폴더 ID</label>
              <Input 
                value={formData.driveFolderId || ''} 
                onChange={e => setFormData({...formData, driveFolderId: e.target.value})}
                placeholder="레시피 사진 폴더 ID"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(false)}>취소</Button>
              <Button type="submit" className="flex-1">저장하기</Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                <Baby className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">아기 정보</p>
                <h4 className="font-bold text-gray-900">{profile?.babyName || '미설정'} ({profile?.babyBirthday || '-'})</h4>
              </div>
            </div>
          </Card>
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">식사 설정</p>
                <h4 className="font-bold text-gray-900">하루 {profile?.mealsPerDay || 0}회 / 반찬 {profile?.sideDishesPerMeal || 0}개</h4>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// --- Layout ---

const Navigation = () => {
  const location = useLocation();
  const navItems = [
    { path: '/', icon: Home, label: '홈' },
    { path: '/inventory', icon: ShoppingCart, label: '재고' },
    { path: '/recipes', icon: ChefHat, label: '레시피' },
    { path: '/history', icon: History, label: '기록' },
    { path: '/profile', icon: Settings, label: '설정' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50 pb-safe">
      {navItems.map(item => {
        const isActive = location.pathname === item.path;
        return (
          <Link 
            key={item.path} 
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-orange-500" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <item.icon className={cn("w-6 h-6", isActive && "fill-orange-500/10")} />
            <span className="text-[10px] font-bold">{item.label}</span>
            {isActive && (
              <motion.div 
                layoutId="nav-indicator"
                className="w-1 h-1 bg-orange-500 rounded-full mt-0.5"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
};

const AppContent = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [meals, setMeals] = useState<MealRecord[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen to profile
    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) setProfile(doc.data() as UserProfile);
    });

    // Listen to inventory
    const unsubInv = onSnapshot(
      query(collection(db, 'inventory'), where('uid', '==', user.uid)),
      (snapshot) => {
        setInventory(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
      }
    );

    // Listen to meals
    const unsubMeals = onSnapshot(
      query(collection(db, 'meals'), where('uid', '==', user.uid), orderBy('date', 'desc')),
      (snapshot) => {
        setMeals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MealRecord)));
      }
    );

    return () => {
      unsubProfile();
      unsubInv();
      unsubMeals();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-md mx-auto p-6">
        <Routes>
          <Route path="/" element={<Dashboard user={user} profile={profile} inventory={inventory} />} />
          <Route path="/inventory" element={<Inventory inventory={inventory} userId={user.uid} />} />
          <Route path="/recipes" element={<Recipes inventory={inventory} profile={profile} userId={user.uid} />} />
          <Route path="/history" element={<HistoryPage meals={meals} />} />
          <Route path="/profile" element={<Profile user={user} profile={profile} userId={user.uid} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <Navigation />
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
