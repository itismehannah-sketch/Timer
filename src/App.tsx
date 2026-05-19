/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Settings, User, Clock, Shield, BarChart3, AlertTriangle, Sparkles } from 'lucide-react';
import { generateUsageReport } from './services/geminiService';

// Types
type ViewState = 'setup' | 'parent' | 'child' | 'locked';

export default function App() {
  const [view, setView] = useState<ViewState>('setup');
  const [pin, setPin] = useState('');
  const [parentPin, setParentPin] = useState(() => localStorage.getItem('parentPin') || '11999911');
  const [dailyLimit, setDailyLimit] = useState(() => Number(localStorage.getItem('dailyLimit')) || 240);
  const [timeRemaining, setTimeRemaining] = useState(() => Number(localStorage.getItem('timeRemaining')) || 240 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(() => localStorage.getItem('isTimerRunning') === 'true');
  const [notification, setNotification] = useState<string | null>(null);
  const [targetTime, setTargetTime] = useState<number | null>(() => {
    const saved = localStorage.getItem('targetTime');
    return saved ? Number(saved) : null;
  });

  // Persist State
  useEffect(() => {
    localStorage.setItem('parentPin', parentPin);
    localStorage.setItem('dailyLimit', dailyLimit.toString());
    localStorage.setItem('timeRemaining', timeRemaining.toString());
    localStorage.setItem('isTimerRunning', isTimerRunning.toString());
    if (targetTime) localStorage.setItem('targetTime', targetTime.toString());
    else localStorage.removeItem('targetTime');
  }, [parentPin, dailyLimit, timeRemaining, isTimerRunning, targetTime]);

  // Request Notification Permission
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  const sendSystemNotification = (title: string, body: string, isUpdate: boolean = false) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/vite.svg", 
        tag: "child-mode-status", 
        silent: isUpdate,
        requireInteraction: !isUpdate, // Keep important alerts visible
      });
    }
  };

  // Sync targetTime when timer starts
  useEffect(() => {
    if (isTimerRunning && !targetTime) {
      const newTarget = Date.now() + timeRemaining * 1000;
      setTargetTime(newTarget);
    } else if (!isTimerRunning) {
      setTargetTime(null);
    }
  }, [isTimerRunning]);

  // Handle page visibility for better background consistency
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isTimerRunning && targetTime) {
        // Force immediate sync when coming back to foreground
        const now = Date.now();
        const diff = Math.max(0, Math.round((targetTime - now) / 1000));
        setTimeRemaining(diff);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isTimerRunning, targetTime]);

  // Timer logic - stable background counting using Date.now()
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && targetTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, Math.round((targetTime - now) / 1000));
        
        if (diff <= 0) {
          setIsTimerRunning(false);
          setTargetTime(null);
          setTimeRemaining(0);
          setView('locked');
          setNotification(null);
          sendSystemNotification("انتهى الوقت!", "تم قفل جهاز مريم الآن.");
          return;
        }

        setTimeRemaining(diff);
        
        // Trigger specific warnings
        if (diff === 15 * 60) {
          const msg = "باقي 15 دقيقة على القفل.";
          setNotification(msg);
          sendSystemNotification("تنبيه الوقت", msg);
        }
        if (diff === 10 * 60) {
          const msg = "تحذير: باقي 10 دقائق فقط!";
          setNotification(msg);
          sendSystemNotification("تنبيه هام", msg);
        }
        if (diff === 5 * 60) {
          const msg = "باقي 5 دقائق. احفظي تقدمك يا مريم!";
          setNotification(msg);
          sendSystemNotification("تحذير قريب", msg);
        }
        if (diff === 60) {
          const msg = "دقيقة واحدة متبقية! سيتم الإغلاق فوراً.";
          setNotification(msg);
          sendSystemNotification("دقيقة أخيرة!", msg);
        }

        // Periodic background notification update (every minute)
        if (diff % 60 === 0 && view === 'child') {
          const h = Math.floor(diff / 3600);
          const m = Math.floor((diff % 3600) / 60);
          const timeText = h > 0 ? `${h} ساعة و ${m} دقيقة` : `${m} دقيقة`;
          sendSystemNotification("الوضع الآمن مفعل", `الوقت المتبقي: ${timeText}`, true);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, targetTime, view]);

  const handleUnlock = (enteredPin: string) => {
    if (enteredPin === parentPin) { 
      setView('parent');
      return true;
    }
    return false;
  };

  return (
    <div className="relative min-h-screen overflow-hidden font-sans">
      <div className="mesh-gradient-1" />
      <div className="mesh-gradient-2" />
      
      <AnimatePresence mode="wait">
        {view === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6 text-center"
          >
            <div className="mb-8 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 p-6 shadow-2xl shadow-indigo-500/20">
              <Shield className="h-16 w-16 text-white" />
            </div>
            <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-white italic">SmartParent</h1>
            <p className="mb-12 max-w-sm text-lg text-slate-400">
              The complete screen time management solution for your family.
            </p>
            <div className="grid w-full max-w-sm gap-4">
              <button
                onClick={() => setView('parent')}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 text-lg font-bold text-slate-950 transition-all hover:bg-slate-200 active:scale-[0.98]"
              >
                <Settings className="h-5 w-5" />
                Parent Dashboard
              </button>
              <button
                onClick={() => {
                  setView('child');
                  setIsTimerRunning(true);
                }}
                className="glass-panel flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-lg font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98]"
              >
                <User className="h-5 w-5" />
                Child Mode
              </button>
            </div>
          </motion.div>
        )}

        {view === 'child' && (
          <ChildView 
            timeRemaining={timeRemaining} 
            dailyLimit={dailyLimit} 
            targetTime={targetTime}
            onParentMode={() => setView('locked')}
            notification={notification}
            setNotification={setNotification}
          />
        )}

        {view === 'locked' && (
          <LockScreen 
            onUnlock={handleUnlock} 
            onCancel={() => timeRemaining > 0 ? setView('child') : null}
          />
        )}

        {view === 'parent' && (
          <ParentDashboard 
            dailyLimit={dailyLimit} 
            setDailyLimit={(val) => {
              setDailyLimit(val);
              const newSeconds = val * 60;
              setTimeRemaining(newSeconds);
              setNotification(null);
              if (isTimerRunning) {
                setTargetTime(Date.now() + newSeconds * 1000);
              }
            }}
            parentPin={parentPin}
            setParentPin={setParentPin}
            onExit={() => {
              setView('setup');
              setIsTimerRunning(false);
            }}
            onStartChildMode={() => {
              setView('child');
              setIsTimerRunning(true);
            }}
            onForceLock={() => {
              setView('locked');
            }}
            notification={notification}
            setNotification={setNotification}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ChildView({ timeRemaining, dailyLimit, targetTime, onParentMode, notification, setNotification }: { 
  timeRemaining: number, 
  dailyLimit: number, 
  targetTime: number | null,
  onParentMode: () => void,
  notification: string | null,
  setNotification: (v: string | null) => void
}) {
  const hours = Math.floor(timeRemaining / 3600);
  const minutes = Math.floor((timeRemaining % 3600) / 60);
  const seconds = timeRemaining % 60;
  const percentage = (timeRemaining / (dailyLimit * 60)) * 100;

  const endTime = targetTime ? new Date(targetTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

  return (
    <motion.div
      key="child"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative z-10 flex min-h-screen flex-col items-center p-8 text-white"
    >
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-6 left-6 right-6 z-50 flex items-center justify-between rounded-2xl bg-indigo-600 p-4 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-indigo-200" />
              <span className="text-sm font-bold text-white">{notification}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-xs font-black uppercase tracking-widest text-indigo-300">OK</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-slate-300">
          <Clock className="h-5 w-5" />
          Time Remaining
        </div>
        <button 
          onClick={onParentMode}
          className="glass-panel rounded-full p-3 transition-colors hover:bg-white/10"
        >
          <Settings className="h-6 w-6" />
        </button>
      </div>

      <div className="mt-24 flex flex-col items-center">
        <div className="relative flex h-72 w-72 items-center justify-center">
          <svg className="absolute inset-0 h-full w-full -rotate-90 transform">
            <circle
              cx="144" cy="144" r="132"
              stroke="currentColor" strokeWidth="12" fill="transparent"
              className="text-white/5"
            />
            <motion.circle
              cx="144" cy="144" r="132"
              stroke="currentColor" strokeWidth="12" fill="transparent"
              strokeDasharray={829}
              animate={{ strokeDashoffset: 829 - (829 * percentage) / 100 }}
              transition={{ duration: 1, ease: "linear" }}
              className="text-indigo-500 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]"
            />
          </svg>
          <div className="text-center">
            <div className="flex items-baseline justify-center font-black text-white">
              {hours > 0 && <span className="text-7xl">{hours}:</span>}
              <span className="text-7xl">{minutes.toString().padStart(hours > 0 ? 2 : 1, '0')}</span>
              <span className="text-5xl text-slate-500 ml-2">:{seconds.toString().padStart(2, '0')}</span>
            </div>
            <div className="text-lg font-bold uppercase tracking-widest text-slate-500 mt-2">
              {hours > 0 ? 'Hours & Mins' : 'Minutes & Secs'}
            </div>
          </div>
        </div>
        
        <h2 className="mt-16 text-3xl font-bold text-white">Keep growing, Mariam!</h2>
        <p className="mt-2 text-center text-slate-400 italic max-w-xs">
          Your tablet will lock when time is up. You can open any other games now, the timer will keep running in the background.
        </p>
      </div>

      <div className="mt-auto grid w-full max-w-sm grid-cols-2 gap-4 pb-8">
        <div className="glass-panel rounded-3xl p-6 text-center transition-all hover:scale-105">
          <BarChart3 className="mx-auto mb-2 h-8 w-8 text-indigo-400" />
          <div className="text-xs font-bold uppercase text-slate-500">Used Today</div>
          <div className="text-xl font-bold text-white">{Math.max(0, Math.round((dailyLimit * 60 - timeRemaining) / 60))}m</div>
        </div>
        <div className="glass-panel rounded-3xl p-6 text-center transition-all hover:scale-105">
          <Clock className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
          <div className="text-xs font-bold uppercase text-slate-500">End Time</div>
          <div className="text-xl font-bold text-white">{endTime}</div>
        </div>
      </div>
    </motion.div>
  );
}

function LockScreen({ onUnlock, onCancel }: { 
  onUnlock: (pin: string) => boolean,
  onCancel: () => void
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleKey = (digit: string) => {
    if (error || pin.length >= 8) return;
    
    setPin(prev => {
      const newPin = prev + digit;
      if (newPin.length === 8) {
        // Delay slightly to show the last dot then transition
        setTimeout(() => {
          if (!onUnlock(newPin)) {
            setError(true);
            setTimeout(() => {
              setPin('');
              setError(false);
            }, 600);
          }
        }, 100);
      }
      return newPin;
    });
  };

  return (
    <motion.div
      key="locked"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0A0B1E] text-white selection:bg-transparent"
    >
      <div className="mesh-gradient-1 opacity-30 z-0" />
      <div className="mesh-gradient-2 opacity-30 z-0" />

      <motion.div 
        animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
        className="relative z-10 mb-12 text-center select-none"
      >
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[32px] bg-rose-500/20 border border-rose-500/30 text-rose-500 shadow-2xl shadow-rose-500/20">
          <Lock className="h-10 w-10" />
        </div>
        <h1 className="text-4xl font-black tracking-tight text-white mb-2">Tablet Locked</h1>
        <p className="text-slate-400 font-medium">Enter Parent PIN to unlock</p>
      </motion.div>

      <div className="relative z-10 mb-16 flex gap-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div 
            key={i}
            className={`h-4 w-4 rounded-full border-2 transition-all duration-300 ${
              pin.length > i 
                ? 'bg-indigo-500 border-indigo-500 scale-125 shadow-[0_0_20px_rgba(99,102,241,0.8)]' 
                : 'border-slate-700'
            }`}
          />
        ))}
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-6 select-none">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'del', 0, 'back'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (key === 'del') setPin(prev => prev.slice(0, -1));
              else if (key === 'back') onCancel();
              else handleKey(key.toString());
            }}
            className={`flex h-24 w-24 cursor-pointer items-center justify-center rounded-3xl text-3xl font-bold transition-all active:scale-95 touch-manipulation ${
              typeof key === 'number'
                ? 'glass-panel text-white hover:bg-white/10 active:bg-white/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {key === 'del' ? '←' : key === 'back' ? '✕' : key}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function ParentDashboard({ dailyLimit, setDailyLimit, parentPin, setParentPin, onExit, onStartChildMode, onForceLock, notification, setNotification }: {
  dailyLimit: number,
  setDailyLimit: (val: number) => void,
  parentPin: string,
  setParentPin: (val: string) => void,
  onExit: () => void,
  onStartChildMode: () => void,
  onForceLock: () => void,
  notification: string | null,
  setNotification: (v: string | null) => void
}) {
  const [report, setReport] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'security'>('dashboard');
  const [newPin, setNewPin] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  const handleUpdatePin = () => {
    if (newPin.length === 8) {
      setParentPin(newPin);
      setNewPin('');
      setIsChangingPin(false);
      alert('PIN updated successfully!');
    } else {
      alert('PIN must be 8 digits.');
    }
  };

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    const mockUsage = {
      totalTime: dailyLimit,
      apps: [
        { name: "YouTube", time: 90, category: "Entertainment" },
        { name: "WhatsApp", time: 30, category: "Communication" },
        { name: "Roblox", time: 60, category: "Gaming" },
        { name: "Minecraft", time: 45, category: "Gaming" },
        { name: "Khan Academy", time: 15, category: "Education" }
      ],
      date: new Date().toLocaleDateString(),
      childName: "Mariam"
    };
    const result = await generateUsageReport(mockUsage);
    setReport(result.report || "Could not generate report at this time.");
    setLoadingReport(false);
  };

  return (
    <motion.div
      key="parent"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative z-10 flex min-h-screen gap-6 p-6"
    >
      {/* Sidebar */}
      <nav className="hidden w-64 flex-col gap-2 rounded-3xl glass-panel p-4 lg:flex">
        <div className="mb-4 flex items-center gap-3 px-4 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">SmartParent</span>
        </div>
        
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition-all ${activeTab === 'dashboard' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
        >
          <BarChart3 className="h-5 w-5 opacity-80" />
          Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition-all ${activeTab === 'security' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
        >
          <Shield className="h-5 w-5 opacity-80" />
          Security
        </button>
        <button className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-400 transition-all hover:bg-white/5 hover:text-white" onClick={handleGenerateReport}>
          <Sparkles className="h-5 w-5" />
          AI Reports
        </button>
        <button className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-400 transition-all hover:bg-white/5 hover:text-white">
          <User className="h-5 w-5" />
          Profiles
        </button>

        <div className="mt-auto border border-indigo-500/20 bg-indigo-500/10 p-4 rounded-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-300">Security Status</p>
          <p className="text-sm leading-relaxed text-slate-300">Lock screen active. PIN required for changes. (Current PIN: {parentPin})</p>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col gap-6">
        <header className="flex items-center justify-between rounded-3xl glass-panel p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full border-2 border-emerald-500 p-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 font-bold text-white">M</div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Mariam's Tablet</h2>
              <p className="flex items-center gap-1.5 text-sm text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span> Online • Active
              </p>
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={onForceLock} className="rounded-xl bg-rose-500/20 border border-rose-500/30 px-6 py-2.5 font-bold text-rose-300 hover:bg-rose-500/30 transition-all">
              Lock Now
            </button>
            <button onClick={onExit} className="rounded-xl glass-panel px-6 py-2.5 font-bold text-white hover:bg-white/10 transition-all">
              Exit Admin
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' ? (
          <div className="grid flex-1 grid-cols-12 gap-6 min-h-0">
            {/* Time Usage Card */}
            <section className="col-span-12 lg:col-span-5 rounded-[40px] glass-panel p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8">
                <Settings className="h-6 w-6 text-slate-500" />
              </div>
              
              <div className="relative h-48 w-48">
                <svg className="h-full w-full -rotate-90">
                  <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/5" />
                  <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray="552" strokeDashoffset={552 - (552 * Math.max(0, dailyLimit - 100) / 600)} className="text-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-white">{Math.floor(dailyLimit / 60)}:{(dailyLimit % 60).toString().padStart(2, '0')}</span>
                  <span className="text-sm font-medium text-slate-400">Daily Limit</span>
                </div>
              </div>

              <div className="mt-8 w-full">
                <h3 className="text-xl font-bold text-white mb-4">Adjust Limit</h3>
                <input 
                  type="range"
                  min="15"
                  max="600"
                  step="15"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(parseInt(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/5 accent-indigo-500"
                />
                <p className="mt-4 text-slate-400 text-sm mb-6">Child can use device for {Math.floor(dailyLimit / 60)} hours today</p>
                
                <button 
                  onClick={onStartChildMode}
                  className="w-full rounded-2xl bg-indigo-600 py-4 text-lg font-bold text-white shadow-xl shadow-indigo-600/20 transition-all hover:bg-indigo-500 active:scale-[0.98]"
                >
                  Start Child Session
                </button>
              </div>
            </section>

            {/* Activity Insights */}
            <section className="col-span-12 lg:col-span-7 rounded-[40px] glass-panel p-8 flex flex-col">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-400" />
                  AI Activity Insights
                </h3>
                <button 
                  onClick={handleGenerateReport}
                  disabled={loadingReport}
                  className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-400 transition-all hover:bg-white/10 hover:text-white"
                >
                  {loadingReport ? 'Analyzing...' : 'Refresh'}
                </button>
              </div>
              
              <div className="flex-1 overflow-auto">
                <div className="mb-6 space-y-6">
                  {[
                    { name: "YouTube", time: "1h 30m", color: "bg-red-500", percent: 60, icon: "Y" },
                    { name: "WhatsApp", time: "30m", color: "bg-emerald-500", percent: 20, icon: "W" },
                    { name: "Roblox", time: "1h 00m", color: "bg-blue-500", percent: 40, icon: "R" },
                    { name: "Minecraft", time: "45m", color: "bg-green-600", percent: 30, icon: "M" }
                  ].map(app => (
                    <div key={app.name} className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${app.color}/20 text-white font-bold`}>{app.icon}</div>
                      <div className="flex-1">
                        <div className="mb-1 flex justify-between">
                          <span className="font-bold text-white">{app.name}</span>
                          <span className="font-mono text-sm text-slate-300">{app.time}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-white/5">
                          <div className={`h-full rounded-full ${app.color}`} style={{ width: `${app.percent}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="min-h-[100px] rounded-2xl bg-indigo-500/5 border border-indigo-500/10 p-4 text-sm leading-relaxed text-slate-300">
                  {report ? report : "Mariam has used YouTube and games session today. Click refresh to get an AI analysis of her digital balance."}
                </div>
              </div>

              <div className="mt-6 flex gap-4 pt-6 mt-auto">
                <div className="flex-1 border border-white/5 bg-white/5 p-4 rounded-2xl">
                  <p className="text-xs font-bold uppercase tracking-tighter text-slate-400">App Requests</p>
                  <p className="text-xl font-bold text-white">2 Pending</p>
                </div>
                <div className="flex-1 border border-white/5 bg-white/5 p-4 rounded-2xl">
                  <p className="text-xs font-bold uppercase tracking-tighter text-slate-400">Weekly Avg</p>
                  <p className="text-xl font-bold text-white">3h 15m</p>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <section className="flex-1 rounded-[40px] glass-panel p-8">
            <h3 className="text-2xl font-bold text-white mb-8">Security Settings</h3>
            <div className="max-w-md space-y-6">
              <div className="rounded-2xl bg-white/5 p-6 border border-white/10">
                <h4 className="font-bold text-white mb-2">Change Parent PIN</h4>
                <p className="text-sm text-slate-400 mb-6">This PIN is required to unlock the device and access parent settings.</p>
                
                {isChangingPin ? (
                  <div className="space-y-4">
                    <input 
                      type="password"
                      maxLength={8}
                      placeholder="Enter new 8-digit PIN"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full rounded-xl bg-slate-900 border border-white/20 p-3 text-white focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex gap-3">
                      <button 
                        onClick={handleUpdatePin}
                        className="flex-1 rounded-xl bg-indigo-600 py-2.5 font-bold text-white hover:bg-indigo-500 transition-all"
                      >
                        Save PIN
                      </button>
                      <button 
                        onClick={() => setIsChangingPin(false)}
                        className="flex-1 rounded-xl bg-white/5 py-2.5 font-bold text-white hover:bg-white/10 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsChangingPin(true)}
                    className="w-full rounded-xl bg-white/10 py-3 font-bold text-white hover:bg-white/20 transition-all"
                  >
                    Set New PIN
                  </button>
                )}
              </div>

              <div className="rounded-2xl bg-rose-500/5 p-6 border border-rose-500/20">
                <h4 className="font-bold text-rose-300 mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Anti-Uninstall Protection
                </h4>
                <p className="text-sm text-slate-400 mb-4">
                  When Child Mode is active, system dialogs and uninstallation are restricted via the administrative lock overlay.
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></div>
                  <span className="text-xs font-bold uppercase tracking-widest text-rose-400">Foreground Protection Active</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Banner */}
        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="flex items-center justify-between rounded-2xl bg-indigo-600/20 border border-indigo-400/30 p-4"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-indigo-300" />
                <span className="text-sm font-medium text-slate-100">{notification}</span>
              </div>
              <button 
                onClick={() => setNotification(null)}
                className="text-xs font-bold uppercase tracking-widest text-indigo-300 hover:text-white"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
  );
}
