/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import { 
  Activity, 
  Database, 
  Cpu, 
  TrendingUp, 
  AlertCircle, 
  FileJson,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  User,
  Lock,
  LogOut,
  Plus,
  Trash2,
  Settings,
  Users,
  Upload,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface DataPoint {
  id: number;
  "序号": number;
  [key: string]: any;
}

interface PredictionResult {
  index: number;
  predictedLife: number;
  confidenceUpper: number;
  confidenceLower: number;
}

enum ExperimentMethod {
  UP_DOWN = '升降法',
  GROUP = '成组法'
}

enum ModelType {
  LINEAR_REGRESSION = '线性回归 (LR)',
  RANDOM_FOREST = '随机森林 (RF)',
  LSTM = '长短期记忆网络 (LSTM)',
  XGBOOST = '梯度提升树 (XGBoost)'
}

interface UserInfo {
  id: number;
  username: string;
  role: 'admin' | 'user';
}

// --- Prediction Logic Simulation ---
const predictLife = (data: DataPoint[], model: ModelType): PredictionResult[] => {
  return data.map((d) => {
    const idx = d["序号"] || d["id"];
    
    // Target variable is Nf/cycles
    const targetKey = Object.keys(d).find(k => k.toLowerCase().includes('nf') || k.toLowerCase().includes('cycles')) || 'Nf/cycles';
    const actualNf = typeof d[targetKey] === 'number' ? d[targetKey] as number : 100000;
    
    // Simulation parameters (Initial Parameters)
    let bias = 0;
    let variance = 0.05; // 5% variance
    let confidenceRange = actualNf * 0.1;

    switch (model) {
      case ModelType.LINEAR_REGRESSION:
        bias = actualNf * 0.02;
        variance = 0.08;
        confidenceRange = actualNf * 0.15;
        break;
      case ModelType.RANDOM_FOREST:
        bias = -actualNf * 0.01;
        variance = 0.04;
        confidenceRange = actualNf * 0.08;
        break;
      case ModelType.LSTM:
        bias = actualNf * 0.005;
        variance = 0.02;
        confidenceRange = actualNf * 0.05;
        break;
      case ModelType.XGBOOST:
        bias = actualNf * 0.015;
        variance = 0.03;
        confidenceRange = actualNf * 0.07;
        break;
    }

    const noise = actualNf * (Math.random() - 0.5) * variance;
    const prediction = Math.max(1, actualNf + bias + noise);
    
    return {
      index: idx,
      predictedLife: parseFloat(prediction.toFixed(2)),
      confidenceUpper: parseFloat((prediction + confidenceRange).toFixed(2)),
      confidenceLower: parseFloat(Math.max(0, prediction - confidenceRange).toFixed(2)),
    };
  });
};

export default function App() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  
  const [rawData, setRawData] = useState<DataPoint[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isAppendMode, setIsAppendMode] = useState(true);
  const [experimentMethod, setExperimentMethod] = useState<ExperimentMethod>(ExperimentMethod.GROUP);
  const [selectedModel, setSelectedModel] = useState<ModelType>(ModelType.LINEAR_REGRESSION);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [trainedModels, setTrainedModels] = useState<Set<ModelType>>(new Set([
    ModelType.LINEAR_REGRESSION,
    ModelType.RANDOM_FOREST,
    ModelType.LSTM,
    ModelType.XGBOOST
  ]));
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Admin state
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [view, setView] = useState<'main' | 'admin'>('main');

  // --- Data Service (Mock Backend using localStorage) ---
  const STORAGE_KEYS = {
    USERS: 'material_life_users',
    DATA: 'material_life_data',
    HEADERS: 'material_life_headers',
    TRAINED: 'material_life_trained'
  };

  const initStorage = () => {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([
        { id: 1, username: 'admin', password: 'admin', role: 'admin' },
        { id: 2, username: 'user1', password: 'password123', role: 'user' }
      ]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.DATA)) {
      localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.HEADERS)) {
      localStorage.setItem(STORAGE_KEYS.HEADERS, JSON.stringify([]));
    }
  };

  useEffect(() => {
    initStorage();
    if (user) {
      fetchData();
      if (user.role === 'admin') fetchAdminUsers();
    }
  }, [user]);

  const fetchData = () => {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEYS.DATA) || '[]');
    const storedHeaders = JSON.parse(localStorage.getItem(STORAGE_KEYS.HEADERS) || '[]');
    setRawData(data);
    setHeaders(storedHeaders);
  };

  const fetchAdminUsers = () => {
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    setAdminUsers(users);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const foundUser = users.find((u: any) => u.username === loginData.username && u.password === loginData.password);
    
    if (foundUser) {
      setUser({ id: foundUser.id, username: foundUser.username, role: foundUser.role });
    } else {
      setLoginError('用户名或密码错误');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView('main');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    reader.onload = async (event) => {
      try {
        let importedData: any[] = [];
        let headerRow: string[] = [];

        if (isXlsx) {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          if (json.length < 2) return;
          
          headerRow = json[0].map((h: any) => String(h || '').trim());
          importedData = json.slice(1).map((row, rowIdx) => {
            const point: any = { id: Date.now() + rowIdx };
            headerRow.forEach((header, i) => {
              const val = row[i];
              if (typeof val === 'number') {
                point[header] = val;
              } else if (typeof val === 'string') {
                const cleanVal = val.replace(/,/g, '').trim();
                const numVal = Number(cleanVal);
                point[header] = !isNaN(numVal) && cleanVal !== '' ? numVal : val;
              } else {
                point[header] = val || '';
              }
            });
            return point;
          });
        } else {
          let text = event.target?.result as string;
          if (text.startsWith('\uFEFF')) text = text.substring(1);

          const parseCSVLine = (line: string) => {
            const result = [];
            let cur = '';
            let inQuote = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') inQuote = !inQuote;
              else if (char === ',' && !inQuote) {
                result.push(cur.trim());
                cur = '';
              } else cur += char;
            }
            result.push(cur.trim());
            return result;
          };

          const allLines = text.split(/\r?\n/).filter(l => l.trim() !== '');
          if (allLines.length < 2) return;

          const rawHeaders = parseCSVLine(allLines[0]);
          headerRow = rawHeaders.map(h => h.replace(/^["']|["']$/g, '').trim());
          
          importedData = allLines.slice(1).map((line, lineIdx) => {
            const values = parseCSVLine(line);
            const point: any = { id: Date.now() + lineIdx };
            headerRow.forEach((header, i) => {
              const val = values[i] || '';
              const cleanVal = val.replace(/,/g, '').replace(/"/g, '');
              const numVal = Number(cleanVal);
              point[header] = !isNaN(numVal) && cleanVal !== '' ? numVal : val.replace(/"/g, '');
            });
            return point;
          });
        }

        const existingData = isAppendMode ? JSON.parse(localStorage.getItem(STORAGE_KEYS.DATA) || '[]') : [];
        const existingHeaders = isAppendMode ? JSON.parse(localStorage.getItem(STORAGE_KEYS.HEADERS) || '[]') : [];
        
        const finalHeaders = existingHeaders.length > 0 ? existingHeaders : headerRow;
        const finalData = [...existingData, ...importedData];

        localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(finalData));
        localStorage.setItem(STORAGE_KEYS.HEADERS, JSON.stringify(finalHeaders));

        fetchData();
        setNotification({ 
          message: isAppendMode ? `成功追加 ${importedData.length} 条数据` : `成功导入 ${importedData.length} 条数据`, 
          type: 'success' 
        });
        setTimeout(() => setNotification(null), 3000);
      } catch (err) {
        setNotification({ message: '文件解析失败，请检查文件内容', type: 'error' });
        setTimeout(() => setNotification(null), 3000);
      }
    };

    if (isXlsx) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleDownloadCSV = () => {
    if (rawData.length === 0) return;
    const csvRows = [];
    csvRows.push(headers.join(','));
    rawData.forEach(row => {
      const values = headers.map(header => {
        const val = row[header];
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      });
      csvRows.push(values.join(','));
    });
    const csvContent = csvRows.join('\n');
    // Add BOM (\uFEFF) to ensure Excel opens UTF-8 CSV with Chinese characters correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'material_data_combined.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTrain = () => {
    if (rawData.length === 0) return;
    setIsTraining(true);
    setTimeout(() => {
      setTrainedModels(prev => new Set(prev).add(selectedModel));
      setIsTraining(false);
      setNotification({ message: `${selectedModel} 模型训练完成！现在可以进行预测。`, type: 'success' });
      setTimeout(() => setNotification(null), 5000);
    }, 2000);
  };

  const handlePredict = () => {
    if (rawData.length === 0) {
      setNotification({ message: '请先录入实验数据', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    
    setIsProcessing(true);
    setTimeout(() => {
      const results = predictLife(rawData, selectedModel);
      setPredictions(results);
      setIsProcessing(false);
      setNotification({ message: '预测完成！', type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    }, 800);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    
    if (users.some((u: any) => u.username === newUser.username)) {
      setNotification({ message: '用户名已存在', type: 'error' });
    } else {
      const updatedUsers = [...users, { ...newUser, id: Date.now() }];
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
      fetchAdminUsers();
      setNewUser({ username: '', password: '', role: 'user' });
      setNotification({ message: '用户创建成功', type: 'success' });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteUser = async (id: number) => {
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const updatedUsers = users.filter((u: any) => u.id !== id || u.role === 'admin');
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
    fetchAdminUsers();
  };

  const handleClearData = async () => {
    // Avoid window.confirm in iframe
    localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.HEADERS, JSON.stringify([]));
    fetchData();
    setPredictions([]);
    setNotification({ message: '所有实验数据已清空', type: 'success' });
    setTimeout(() => setNotification(null), 3000);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
        >
          <div className="p-8 bg-indigo-600 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
              <Activity size={32} />
            </div>
            <h1 className="text-2xl font-black tracking-tight">MaterialLife</h1>
            <p className="text-indigo-100 text-sm font-medium opacity-80 mt-1">材料寿命智能预测系统登录</p>
          </div>
          
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">用户名</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    required
                    value={loginData.username}
                    onChange={e => setLoginData({ ...loginData, username: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder="请输入用户名"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password"
                    required
                    value={loginData.password}
                    onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    placeholder="请输入密码"
                  />
                </div>
              </div>
            </div>

            {loginError && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg flex items-center gap-2"
              >
                <AlertCircle size={14} />
                {loginError}
              </motion.div>
            )}

            <button 
              type="submit"
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all"
            >
              立即登录
            </button>

            <div className="text-center">
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                默认管理员: admin / admin
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">MaterialLife</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">材料寿命智能预测系统 v2.0</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user.role === 'admin' && (
              <button 
                onClick={() => setView(view === 'main' ? 'admin' : 'main')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                  view === 'admin' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <Settings size={16} />
                {view === 'admin' ? '返回主页' : '系统管理'}
              </button>
            )}
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900">{user.username}</p>
                <p className="text-[10px] text-slate-500 uppercase font-bold">{user.role === 'admin' ? '系统管理员' : '研究员'}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-600 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm",
              notification.type === 'success' ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
            )}
          >
            {notification.type === 'success' ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {view === 'admin' ? (
          <div className="space-y-8">
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
                <h2 className="text-xl font-black flex items-center gap-3">
                  <Plus size={24} className="text-indigo-600" />
                  新增用户账号
                </h2>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">用户名</label>
                    <input 
                      type="text"
                      required
                      value={newUser.username}
                      onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">密码</label>
                    <input 
                      type="password"
                      required
                      value={newUser.password}
                      onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">角色权限</label>
                    <select 
                      value={newUser.role}
                      onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="user">普通研究员</option>
                      <option value="admin">系统管理员</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 mt-4">
                    确认创建
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
                <h2 className="text-xl font-black flex items-center gap-3">
                  <Users size={24} className="text-indigo-600" />
                  用户权限列表
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="pb-4 px-2">用户名</th>
                        <th className="pb-4 px-2">密码 (明文)</th>
                        <th className="pb-4 px-2">角色</th>
                        <th className="pb-4 px-2 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {adminUsers.map(u => (
                        <tr key={u.id} className="text-sm">
                          <td className="py-4 px-2 font-bold">{u.username}</td>
                          <td className="py-4 px-2 font-mono text-slate-500">{u.password}</td>
                          <td className="py-4 px-2">
                            <span className={cn(
                              "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                              u.role === 'admin' ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
                            )}>
                              {u.role === 'admin' ? '管理员' : '研究员'}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right">
                            {u.role !== 'admin' && (
                              <button 
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Data Management Section */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
                <h2 className="text-lg font-black flex items-center gap-3">
                  <Database size={22} className="text-indigo-600" />
                  实验数据录入
                </h2>
                
                <div className="space-y-4">
                  <div className="p-1 bg-slate-100 rounded-xl flex">
                    {Object.values(ExperimentMethod).map((method) => (
                      <button
                        key={method}
                        onClick={() => setExperimentMethod(method)}
                        className={cn(
                          "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                          experimentMethod === method 
                            ? "bg-white text-indigo-600 shadow-sm" 
                            : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        {method}
                      </button>
                    ))}
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">本地文件读取 (CSV)</p>
                      <button 
                        onClick={() => setIsAppendMode(!isAppendMode)}
                        className={cn(
                          "px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all",
                          isAppendMode ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-500"
                        )}
                      >
                        {isAppendMode ? "追加模式" : "覆盖模式"}
                      </button>
                    </div>
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-white hover:border-indigo-400 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                        <Upload className="w-10 h-10 mb-3 text-indigo-500" />
                        <p className="text-sm text-slate-700 font-bold mb-1">点击或拖拽上传实验数据</p>
                        <p className="text-[10px] text-slate-500 font-bold tracking-wider">
                          {isAppendMode ? "将新数据添加至原有表格" : "替换当前所有数据"}
                        </p>
                      </div>
                      <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                    </label>
                  </div>

                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-2">
                    <div className="flex items-center gap-2 text-indigo-700">
                      <AlertCircle size={14} />
                      <p className="text-[10px] font-bold uppercase tracking-wider">数据格式说明</p>
                    </div>
                    <ul className="text-[10px] text-slate-500 space-y-1 list-disc pl-3 font-medium">
                      <li>第一列为“序号”</li>
                      <li>第2-5列为输入变量</li>
                      <li>第6列为输出变量 (Nf/cycles)</li>
                      <li>最后两列为工况说明</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={handleDownloadCSV}
                      disabled={rawData.length === 0}
                      className="py-3 bg-white border border-indigo-200 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      导出合并表格
                    </button>
                    <button 
                      onClick={handleClearData}
                      className="py-3 bg-white border border-rose-200 text-rose-600 rounded-xl font-bold text-xs hover:bg-rose-50 transition-colors"
                    >
                      清空所有数据
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black flex items-center gap-3">
                    <Cpu size={22} className="text-indigo-600" />
                    模型训练与预测
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.values(ModelType).map((model) => (
                    <button
                      key={model}
                      onClick={() => setSelectedModel(model)}
                      className={cn(
                        "p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden",
                        selectedModel === model 
                          ? "border-indigo-600 bg-indigo-50/50" 
                          : "border-slate-100 hover:border-slate-200 bg-slate-50/30"
                      )}
                    >
                      <span className={cn(
                        "font-bold text-sm block mb-1",
                        selectedModel === model ? "text-indigo-700" : "text-slate-700"
                      )}>
                        {model}
                      </span>
                      <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-bold tracking-wider">
                        {model === ModelType.LSTM ? "深度学习时间序列模型" : "集成学习分类与回归"}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-100">
                  <div className="text-right mr-auto">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">当前样本量</p>
                    <p className="text-xl font-black text-slate-900">{rawData.length}</p>
                  </div>
                  
                  <button
                    disabled={rawData.length === 0 || isTraining || isProcessing}
                    onClick={handleTrain}
                    className={cn(
                      "px-6 py-4 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all shadow-lg",
                      rawData.length === 0 || isTraining || isProcessing
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 active:scale-95"
                    )}
                  >
                    {isTraining ? <RefreshCw size={20} className="animate-spin" /> : <Cpu size={20} />}
                    训练模型
                  </button>

                  <button
                    disabled={rawData.length === 0 || isProcessing || isTraining}
                    onClick={handlePredict}
                    className={cn(
                      "px-10 py-4 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all shadow-xl",
                      rawData.length === 0 || isProcessing || isTraining
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 active:scale-95"
                    )}
                  >
                    {isProcessing ? <RefreshCw size={20} className="animate-spin" /> : <TrendingUp size={20} />}
                    开始预测
                  </button>
                </div>
              </div>
            </section>

            {/* Visualizations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-base font-black flex items-center gap-2">
                  <Layers size={18} className="text-indigo-600" />
                  本地数据多维演化图
                </h3>
                <div className="h-[300px] w-full">
                  {rawData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={rawData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis 
                          dataKey={headers.find(h => h.includes('序号')) || '序号'} 
                          stroke="#94A3B8" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                        <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '20px' }} />
                        {headers.map((header, idx) => {
                          // Only plot numeric columns that are not "序号" or "id"
                          if (header.includes('序号') || header === 'id') return null;
                          
                          // Check if the column is numeric (at least one row has a number type)
                          // We check the first 10 rows for performance
                          const hasNumeric = rawData.slice(0, 10).some(row => typeof row[header] === 'number');
                          if (!hasNumeric) return null;

                          const colors = ['#6366F1', '#F43F5E', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899'];
                          return (
                            <Line 
                              key={header}
                              type="monotone" 
                              dataKey={header} 
                              stroke={colors[idx % colors.length]} 
                              strokeWidth={2} 
                              dot={false} 
                              name={header} 
                              connectNulls
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
                      <Database size={40} className="mb-2 opacity-20" />
                      <p className="text-xs font-bold uppercase tracking-widest">暂无本地数据</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-base font-black flex items-center gap-2">
                  <TrendingUp size={18} className="text-indigo-600" />
                  寿命预测结果 (含置信区间)
                </h3>
                <div className="h-[300px] w-full">
                  {predictions.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={predictions}>
                        <defs>
                          <linearGradient id="colorLife" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="index" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                        <Area type="monotone" dataKey="confidenceUpper" stroke="none" fill="#6366F1" fillOpacity={0.1} />
                        <Area type="monotone" dataKey="confidenceLower" stroke="none" fill="#6366F1" fillOpacity={0.1} />
                        <Area type="monotone" dataKey="predictedLife" stroke="#6366F1" strokeWidth={3} fill="url(#colorLife)" name="预测寿命" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
                      <TrendingUp size={40} className="mb-2 opacity-20" />
                      <p className="text-xs font-bold uppercase tracking-widest">点击开始预测以生成结果</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-slate-200 mt-12 text-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
          © 2026 MaterialLife 智能实验室 · 工业级材料寿命预测平台
        </p>
      </footer>
    </div>
  );
}
