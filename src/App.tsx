/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, Settings, User, Clock, Shield, BarChart3, 
  AlertTriangle, Sparkles, TrendingUp, Activity, 
  ChevronRight, Calendar, Smartphone, Download,
  Youtube, MessageCircle, Gamepad2, BookOpen,
  CheckCircle2, Zap, RefreshCw, Monitor, Bell
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, 
  Cell, PieChart, Pie
} from 'recharts';
import { generateUsageReport } from './services/geminiService';

// Types
type ViewState = 'setup' | 'parent' | 'child' | 'locked';

const HOURLY_USAGE_DATA = [
  { time: '00:00', minutes: 5, type: 'night' },
  { time: '02:00', minutes: 0, type: 'night' },
  { time: '08:00', minutes: 5, type: 'day' },
  { time: '10:00', minutes: 15, type: 'day' },
  { time: '12:00', minutes: 45, type: 'day' },
  { time: '14:00', minutes: 60, type: 'day' },
  { time: '16:00', minutes: 40, type: 'day' },
  { time: '18:00', minutes: 20, type: 'day' },
  { time: '20:00', minutes: 10, type: 'day' },
  { time: '22:00', minutes: 15, type: 'night' },
];

const WEEKLY_TREND_DATA = [
  { day: 'Mon', usage: 120, opens: 12 },
  { day: 'Tue', usage: 180, opens: 15 },
  { day: 'Wed', usage: 150, opens: 11 },
  { day: 'Thu', usage: 240, opens: 18 },
  { day: 'Fri', usage: 210, opens: 20 },
  { day: 'Sat', usage: 300, opens: 32 },
  { day: 'Sun', usage: 280, opens: 28 },
];

const CATEGORY_DATA = [
  { name: 'Entertainment', value: 45, color: '#F43F5E', apps: ['YouTube'] },
  { name: 'Gaming', value: 30, color: '#3B82F6', apps: ['Roblox'] },
  { name: 'Social', value: 15, color: '#10B981', apps: ['WhatsApp'] },
  { name: 'Education', value: 10, color: '#F59E0B', apps: ['Khan Academy'] },
];

const APP_USAGE = [
  { name: "YouTube", time: 90, opens: 15, category: "Entertainment", icon: <Youtube />, color: "bg-red-500", trend: "+12%" },
  { name: "Roblox", time: 60, opens: 4, category: "Gaming", icon: <Gamepad2 />, color: "bg-blue-500", trend: "-5%" },
  { name: "WhatsApp", time: 30, opens: 42, category: "Social", icon: <MessageCircle />, color: "bg-emerald-500", trend: "+80%" },
  { name: "Khan Academy", time: 20, opens: 2, category: "Education", icon: <BookOpen />, color: "bg-amber-500", trend: "+50%" },
];

const PERMISSIONS_LIST = [
  { 
    id: 'usage', 
    name: 'Usage Access', 
    desc: 'Required to track real daily tablet usage time across the entire device.',
    icon: <Activity className="h-5 w-5" />,
    api: 'PACKAGE_USAGE_STATS'
  },
  { 
    id: 'notifications', 
    name: 'Notification Permission', 
    desc: 'Allows the system to show remaining daily time in the device notification bar.',
    icon: <Bell className="h-5 w-5" />,
    api: 'POST_NOTIFICATIONS'
  },
  { 
    id: 'foreground', 
    name: 'Foreground Service', 
    desc: 'Keeps the tracking system running continuously in the background without being killed.',
    icon: <Sparkles className="h-5 w-5" />,
    api: 'FOREGROUND_SERVICE'
  },
  { 
    id: 'accessibility', 
    name: 'Accessibility Service', 
    desc: 'Monitors device usage and helps enforce the lock screen when the daily limit ends.',
    icon: <Activity className="h-5 w-5" />,
    api: 'AccessibilityService'
  },
  { 
    id: 'overlay', 
    name: 'Overlay Permission', 
    desc: 'Allows the lock screen to display over all other apps and system settings.',
    icon: <Monitor className="h-5 w-5" />,
    api: 'SYSTEM_ALERT_WINDOW'
  },
  { 
    id: 'battery', 
    name: 'Ignore Battery Optimization', 
    desc: 'Prevents the operating system from stopping the tracking system to save battery.',
    icon: <Zap className="h-5 w-5" />,
    api: 'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'
  },
  { 
    id: 'boot', 
    name: 'Boot Completed', 
    desc: 'Restarts the tracking system automatically after the device reboots.',
    icon: <RefreshCw className="h-5 w-5" />,
    api: 'RECEIVE_BOOT_COMPLETED'
  },
  { 
    id: 'admin', 
    name: 'Device Admin', 
    desc: 'Protects the app from unauthorized uninstall and improves device lock control.',
    icon: <Lock className="h-5 w-5" />,
    api: 'DevicePolicyManager'
  }
];

export default function App() {
  const [view, setView] = useState<ViewState>('setup');
  const [grantedPermissions, setGrantedPermissions] = useState<string[]>(() => {
    const saved = localStorage.getItem('grantedPermissions');
    return saved ? JSON.parse(saved) : [];
  });
  const [hasUsageAccess, setHasUsageAccess] = useState(() => localStorage.getItem('hasUsageAccess') === 'true');
  const [pin, setPin] = useState('');
  const [parentPin, setParentPin] = useState(() => localStorage.getItem('parentPin') || '11999911');
  const [dailyLimit, setDailyLimit] = useState(() => Number(localStorage.getItem('dailyLimit')) || 240);
  const [timeRemaining, setTimeRemaining] = useState(() => Number(localStorage.getItem('timeRemaining')) || 240 * 60);
  const [isAlertsEnabled, setIsAlertsEnabled] = useState(() => localStorage.getItem('isAlertsEnabled') !== 'false');
  const [isTimerRunning, setIsTimerRunning] = useState(false); 
  const [notification, setNotification] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [isTestingLock, setIsTestingLock] = useState(false);

  // High-precision tracking refs
  const lastActiveTimestamp = useRef<number>(Date.now());
  const [isDeviceActive, setIsDeviceActive] = useState(true);

  // Persist State
  useEffect(() => {
    localStorage.setItem('hasUsageAccess', hasUsageAccess.toString());
    localStorage.setItem('grantedPermissions', JSON.stringify(grantedPermissions));
    localStorage.setItem('parentPin', parentPin);
    localStorage.setItem('dailyLimit', dailyLimit.toString());
    localStorage.setItem('timeRemaining', timeRemaining.toString());
    localStorage.setItem('isAlertsEnabled', isAlertsEnabled.toString());
  }, [hasUsageAccess, grantedPermissions, parentPin, dailyLimit, timeRemaining, isAlertsEnabled]);

  // Request Notification Permission
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  const sendSystemNotification = (title: string, body: string, priority: 'high' | 'normal' = 'normal') => {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      const options: NotificationOptions = {
        body,
        icon: "/vite.svg", 
        tag: priority === 'high' ? `alert-${Date.now()}` : "guardian-persistent-timer",
        silent: priority === 'normal',
        requireInteraction: priority === 'high',
      };

      // Vibrate for high priority alerts
      if (priority === 'high' && "vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
      }

      try {
        new Notification(title, options);
      } catch (e) {
        console.error("System notification failed", e);
      }
    }
  };

  // Visibility Tracking & System Idle Simulation
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isActive = document.visibilityState === 'visible';
      setIsDeviceActive(isActive);
      
      if (isActive) {
        lastActiveTimestamp.current = Date.now();
        if (view === 'child' && timeRemaining > 0) {
          setIsTimerRunning(true);
        }
      } else {
        setIsTimerRunning(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [view, timeRemaining]);

  // High-Precision Tracking Engine (Delta-Based)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTimerRunning && view !== 'locked' && view !== 'setup') {
      lastActiveTimestamp.current = Date.now();
      
      interval = setInterval(() => {
        const now = Date.now();
        const deltaMs = now - lastActiveTimestamp.current;
        const deltaSec = Math.floor(deltaMs / 1000);
        
        if (deltaSec >= 1) {
          lastActiveTimestamp.current = now;
          
          setTimeRemaining(prev => {
            const next = Math.max(0, prev - deltaSec);
            
            // Persist immediately on each tick to prevent data loss or time cheating
            localStorage.setItem('timeRemaining', next.toString());

            if (next <= 0) {
              setView('locked');
              setNotification(null);
              sendSystemNotification("🛑 Device Locked!", "Daily usage limit reached. Enter Parent PIN to unlock.", 'high');
              return 0;
            }

            // Real-time Warning Logic
            if (isAlertsEnabled) {
              if (next === 600) { // 10 mins
                 sendSystemNotification("⚠️ 10 Minutes Left", "The device will lock completely in 10 minutes.", 'high');
              }
              if (next === 300) { // 5 mins
                sendSystemNotification("⚠️ 5 Minutes Left", "The device will lock completely in 5 minutes.", 'high');
              }
              if (next === 60) { // 1 min
                sendSystemNotification("🚨 Final Warning", "Device locking in 60 seconds. Save your apps.", 'high');
              }
            }

            // Active Status Notification (Persistent in System Bar)
            if (next % 10 === 0 || next < 10) {
              const h = Math.floor(next / 3600);
              const m = Math.floor((next % 3600) / 60);
              const s = next % 60;
              const timeStr = `${h}h ${m}m ${s}s`;
              sendSystemNotification("Active Screen Time Tracker", `Remaining Today: ${timeStr} • Usage Active`, 'normal');
            }

            return next;
          });
        }
      }, 500); // Check twice per second for smoothness
    }
    
    return () => clearInterval(interval);
  }, [isTimerRunning, view]);

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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 flex min-h-screen flex-col items-center py-12 px-6 text-center"
          >
            <div className="mb-8 relative">
              <div className="rounded-[40px] bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 p-8 shadow-2xl shadow-indigo-500/30 ring-1 ring-white/20">
                <Shield className="h-20 w-20 text-white" />
              </div>
            </div>
            
            <h1 className="mb-2 text-5xl font-black tracking-tighter text-white italic lowercase">SmartParent</h1>
            <p className="mb-12 max-w-sm text-lg font-medium text-slate-400">
              Complete digital wellness & monitoring for your family device.
            </p>

        {grantedPermissions.length < PERMISSIONS_LIST.length ? (
          <div className="w-full max-w-xl rounded-[32px] glass-panel p-8 border-2 border-indigo-500/10 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
               <Settings className="h-32 w-32 rotate-12" />
            </div>

            <div className="flex items-center justify-between mb-8 relative">
               <div className="text-left">
                  <h3 className="text-2xl font-black text-white tracking-tight">System Permissions</h3>
                  <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Setup Phase {grantedPermissions.length + 1} of {PERMISSIONS_LIST.length}</p>
                  <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Status: {Math.round((grantedPermissions.length / PERMISSIONS_LIST.length) * 100)}% Complete</p>
               </div>
               <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                  <Shield className="h-6 w-6 text-indigo-400" />
               </div>
            </div>

            <div className="space-y-4 mb-10 relative">
               {PERMISSIONS_LIST.map((perm) => {
                  const isGranted = grantedPermissions.includes(perm.id);
                  return (
                     <div key={perm.id} className={`flex items-center gap-5 p-5 rounded-3xl border transition-all ${isGranted ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${isGranted ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-400'}`}>
                           {isGranted ? <CheckCircle2 className="h-6 w-6" /> : perm.icon}
                        </div>
                        <div className="flex-1 text-left">
                           <div className="flex items-center gap-2">
                              <span className="font-black text-white text-base">{perm.name}</span>
                              <span className="text-[9px] font-black text-slate-500 px-1.5 py-0.5 rounded-md bg-white/5 uppercase tracking-widest">{perm.api}</span>
                           </div>
                           <p className="text-slate-400 text-xs font-bold leading-relaxed">{perm.desc}</p>
                        </div>
                        {!isGranted && (
                           <button 
                             onClick={() => {
                               const newPerms = [...grantedPermissions, perm.id];
                               setGrantedPermissions(newPerms);
                               if (perm.id === 'usage') setHasUsageAccess(true);
                             }}
                             className="rounded-2xl bg-indigo-600 px-6 py-3 text-xs font-black text-white hover:bg-indigo-500 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                           >
                              GRANT
                           </button>
                        )}
                     </div>
                  );
               })}
            </div>
            
            <div className="flex items-center justify-between pt-8 border-t border-white/5 opacity-50">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Android Enterprise Security LayerV4</p>
               <div className="flex gap-1">
                  {PERMISSIONS_LIST.map((_, i) => (
                     <div key={i} className={`h-1.5 rounded-full transition-all ${i < grantedPermissions.length ? 'bg-emerald-500 w-4' : 'bg-white/10 w-1.5'}`} />
                  ))}
               </div>
            </div>
          </div>
        ) : (
          <div className="grid w-full max-w-sm gap-4">
            <button
               onClick={() => setIsTestingLock(true)}
               className="mb-4 flex w-full items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-indigo-500/50 p-6 text-sm font-black text-indigo-400 transition-all hover:bg-indigo-500/5 active:scale-95"
            >
               <Lock className="h-5 w-5" />
               TEST LOCK SYSTEM
            </button>

            <button
              onClick={() => setView('parent')}
              className="group flex w-full items-center justify-center gap-4 rounded-[24px] bg-white p-6 text-xl font-black text-slate-950 transition-all hover:bg-slate-200 active:scale-[0.98] shadow-2xl shadow-indigo-500/10"
            >
              <Settings className="h-6 w-6 text-indigo-600" />
              Parent Admin
            </button>
            <button
              onClick={() => {
                setView('child');
                setIsTimerRunning(true);
              }}
              className="glass-panel group flex w-full items-center justify-center gap-4 rounded-[24px] p-6 text-xl font-black text-white transition-all hover:bg-white/10 active:scale-[0.98] border-white/10 shadow-xl"
            >
              <User className="h-6 w-6 text-emerald-400" />
              Enter Child Mode
            </button>
          </div>
        )}
          </motion.div>
        )}

        {view === 'child' && (
          <ChildView 
            timeRemaining={timeRemaining} 
            dailyLimit={dailyLimit} 
            onParentMode={() => setView('locked')}
            notification={notification}
            setNotification={setNotification}
            isDeviceActive={isDeviceActive}
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
            }}
            parentPin={parentPin}
            setParentPin={setParentPin}
            isAlertsEnabled={isAlertsEnabled}
            setIsAlertsEnabled={setIsAlertsEnabled}
            onResetUsage={() => {
              setTimeRemaining(dailyLimit * 60);
              setNotification("Daily usage reset by parent.");
            }}
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

      {/* Test Lock Overlay (Triggered from Setup) */}
      <AnimatePresence>
        {isTestingLock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-slate-950/90 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center"
          >
             <div className="h-24 w-24 rounded-[32px] bg-indigo-600 flex items-center justify-center mb-8 shadow-2xl shadow-indigo-600/30">
                <Lock className="h-10 w-10 text-white" />
             </div>
             <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Lock System Active</h2>
             <p className="text-slate-400 max-w-sm mb-12 text-lg font-medium leading-relaxed">
                This overlay will appear automatically when the daily limit is consumed or if a parent forces a lock. It covers all apps and system settings.
             </p>
             <button 
               onClick={() => setIsTestingLock(false)}
               className="rounded-3xl bg-white px-12 py-6 text-xl font-black text-slate-950 shadow-2xl hover:bg-slate-100 active:scale-95 transition-all"
             >
                Success: Exit Test
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Android-Style Persistent Notification UI (Matching User Image) */}
      <AnimatePresence>
        {isTimerRunning && view !== 'locked' && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-6 z-[9999]"
          >
            <div className={`glass-panel-heavy border rounded-[32px] p-6 shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 transition-colors ${!isDeviceActive ? 'bg-slate-900/60 border-white/5' : 'bg-slate-900/90 border-white/20'}`}>
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${!isDeviceActive ? 'bg-slate-700' : (timeRemaining < 600 ? 'bg-rose-500 shadow-lg shadow-rose-500/20' : 'bg-indigo-600')}`}>
                  {!isDeviceActive ? <Clock className="h-6 w-6 text-slate-400" /> : (timeRemaining < 600 ? <AlertTriangle className="h-6 w-6 text-white animate-pulse" /> : <Clock className="h-6 w-6 text-white" />)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Daily Device Usage</span>
                    <span className={`text-[10px] font-black tracking-widest ${isDeviceActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {isDeviceActive ? '● ACTIVE' : '○ PAUSED'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-black tabular-nums tracking-tighter ${isDeviceActive ? 'text-white' : 'text-slate-400'}`}>
                      {Math.floor(timeRemaining / 3600)}h {Math.floor((timeRemaining % 3600) / 60)}m {timeRemaining % 60}s
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${(timeRemaining / (dailyLimit * 60)) * 100}%` }}
                   className={`h-full rounded-full transition-all duration-1000 ${!isDeviceActive ? 'bg-slate-600' : (timeRemaining < 600 ? 'bg-rose-500' : 'bg-indigo-500')}`} 
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChildView({ timeRemaining, dailyLimit, onParentMode, notification, setNotification, isDeviceActive }: { 
  timeRemaining: number, 
  dailyLimit: number, 
  onParentMode: () => void,
  notification: string | null,
  setNotification: (v: string | null) => void,
  isDeviceActive: boolean
}) {
  const hours = Math.floor(timeRemaining / 3600);
  const minutes = Math.floor((timeRemaining % 3600) / 60);
  const seconds = timeRemaining % 60;
  const percentage = (timeRemaining / (dailyLimit * 60)) * 100;

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
          <div className="relative mx-auto mb-2 h-8 w-8">
            <Clock className={`h-8 w-8 ${isDeviceActive ? 'text-emerald-400' : 'text-slate-500'}`} />
            {isDeviceActive && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <div className="text-xs font-bold uppercase text-slate-500">Status</div>
          <div className={`text-xl font-bold ${isDeviceActive ? 'text-white' : 'text-slate-500'}`}>
            {isDeviceActive ? 'Active Tracking' : 'Paused (Idle)'}
          </div>
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0A0B1E] text-white select-none"
    >
      <div className="mesh-gradient-1 opacity-30 z-0" />
      <div className="mesh-gradient-2 opacity-30 z-0" />

      <motion.div 
        animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
        className="relative z-10 mb-12 text-center"
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

      <div className="relative z-10 grid grid-cols-3 gap-6">
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

function ParentDashboard({ 
  dailyLimit, setDailyLimit, parentPin, setParentPin, onExit, onStartChildMode, onForceLock, notification, setNotification,
  isAlertsEnabled, setIsAlertsEnabled, onResetUsage
}: {
  dailyLimit: number,
  setDailyLimit: (val: number) => void,
  parentPin: string,
  setParentPin: (val: string) => void,
  onExit: () => void,
  onStartChildMode: () => void,
  onForceLock: () => void,
  notification: string | null,
  setNotification: (v: string | null) => void,
  isAlertsEnabled: boolean,
  setIsAlertsEnabled: (v: boolean) => void,
  onResetUsage: () => void
}) {
  const [report, setReport] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'security'>('dashboard');
  
  const [newPin, setNewPin] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  const resetDailyUsage = () => {
    if (confirm("Reset today's usage to zero? This will restore the full time limit.")) {
      setDailyLimit(dailyLimit); // Effectively triggers the setter logic in App
      // Since ParentDashboard needs to update the sibling's state, the parent should handle it.
      // We'll pass it down as a prop.
    }
  };

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
      // Strip icons as they are React components and not serializable to JSON
      apps: APP_USAGE.map(({ icon, ...rest }) => rest),
      hourlyUsage: HOURLY_USAGE_DATA,
      nightUsage: HOURLY_USAGE_DATA.filter(h => h.type === 'night' && h.minutes > 0),
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
      <nav className="hidden w-72 flex-col gap-2 rounded-[40px] glass-panel p-6 lg:flex">
        <div className="mb-8 flex items-center gap-4 px-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <div>
            <span className="block text-2xl font-black tracking-tight text-white uppercase tracking-widest leading-tight">SmartParent</span>
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-[0.2em]">Premium Control</span>
          </div>
        </div>
        
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`group flex items-center gap-4 rounded-[20px] px-4 py-4 font-bold transition-all ${activeTab === 'dashboard' ? 'bg-indigo-500 text-white shadow-xl shadow-indigo-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
        >
          <Smartphone className={`h-5 w-5 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('analytics')}
          className={`group flex items-center gap-4 rounded-[20px] px-4 py-4 font-bold transition-all ${activeTab === 'analytics' ? 'bg-indigo-500 text-white shadow-xl shadow-indigo-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
        >
          <BarChart3 className={`h-5 w-5 ${activeTab === 'analytics' ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
          AI Analytics
        </button>
        <button 
          onClick={() => setActiveTab('security')}
          className={`group flex items-center gap-4 rounded-[20px] px-4 py-4 font-bold transition-all ${activeTab === 'security' ? 'bg-indigo-500 text-white shadow-xl shadow-indigo-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
        >
          <Settings className={`h-5 w-5 ${activeTab === 'security' ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
          System Settings
        </button>
        
        <div className="mt-8 space-y-2">
          <p className="px-4 text-[11px] font-black uppercase tracking-widest text-slate-500">Quick Actions</p>
          <button className="flex w-full items-center gap-4 rounded-[20px] px-4 py-4 font-bold text-slate-400 transition-all hover:bg-white/5 hover:text-white" onClick={handleGenerateReport}>
            <Sparkles className="h-5 w-5 text-amber-400" />
            AI Insight
          </button>
        </div>

        <div className="mt-auto rounded-[32px] bg-gradient-to-br from-indigo-500/10 to-purple-600/10 border border-indigo-500/20 p-6">
          <p className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-indigo-300">System Safe</p>
          <p className="text-[13px] leading-relaxed text-slate-400 font-mono">Lock: {parentPin}</p>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col gap-6 overflow-hidden">
        <header className="flex items-center justify-between rounded-[40px] glass-panel p-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="rounded-[24px] border-2 border-emerald-500 p-1.5 ring-4 ring-emerald-500/10">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-slate-800 text-xl font-black text-white italic">M</div>
              </div>
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-[#0A0B1E] bg-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white">Mariam's Tablet</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-widest">
                   Live Tracking On
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex flex-col items-end mr-4">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Last Sync</span>
                <span className="text-sm font-bold text-slate-300">Just Now</span>
             </div>
             <button onClick={onForceLock} className="rounded-2xl bg-rose-500 px-8 py-3.5 font-black text-white shadow-lg shadow-rose-500/25 transition-all hover:bg-rose-400 active:scale-95">
              Lock Device
            </button>
            <button onClick={onExit} className="rounded-2xl glass-panel px-6 py-3.5 font-bold text-white transition-all hover:bg-white/10">
              Close
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="tab-dashboard"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="grid grid-cols-12 gap-6"
              >
                {/* Time Control Card */}
                <section className="col-span-12 lg:col-span-5 rounded-[48px] glass-panel p-10 flex flex-col items-center relative overflow-hidden bg-gradient-to-b from-white/5 to-transparent">
                  <div className="absolute top-8 right-8">
                     <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 text-slate-500">
                        <Clock className="h-5 w-5" />
                     </div>
                  </div>

                  <div className="relative h-64 w-64 mb-4">
                    <svg className="h-full w-full -rotate-90">
                      <circle cx="128" cy="128" r="115" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-white/5" />
                      <circle cx="128" cy="128" r="115" stroke="currentColor" strokeWidth="16" fill="transparent" strokeDasharray="722" strokeDashoffset={722 - (722 * Math.min(dailyLimit, 600) / 600)} strokeLinecap="round" className="text-indigo-500 drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-black text-white tracking-tighter">{Math.floor(dailyLimit / 60)}h {dailyLimit % 60}m</span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Daily Limit Set</span>
                    </div>
                  </div>

                  <div className="w-full mt-4">
                    <div className="flex justify-between mb-4 px-2">
                       <span className="text-sm font-bold text-slate-400">15m</span>
                       <span className="text-sm font-bold text-indigo-400">10h</span>
                    </div>
                    <input 
                      type="range" min="15" max="600" step="15" 
                      value={dailyLimit}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setDailyLimit(val);
                      }}
                      className="h-3 w-full cursor-pointer appearance-none rounded-full bg-white/5 accent-indigo-500"
                    />
                    
                    <button 
                      onClick={onStartChildMode}
                      className="mt-10 w-full rounded-3xl bg-indigo-600 py-6 text-xl font-black text-white shadow-2xl shadow-indigo-600/30 transition-all hover:bg-indigo-500 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Start Child Mode
                    </button>
                    
                    <div className="mt-8 flex items-center justify-center gap-3 py-4 rounded-2xl bg-white/5 border border-white/5">
                        <Shield className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Anti-Bypass Protection Active</span>
                    </div>
                  </div>
                </section>

                {/* Dashboard Stats */}
                <section className="col-span-12 lg:col-span-7 space-y-6">
                   <div className="grid grid-cols-2 gap-6">
                      <div className="group rounded-[40px] glass-panel p-8 relative overflow-hidden transition-all hover:bg-white/10">
                         <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-rose-500/10 blur-3xl group-hover:bg-rose-500/20 transition-all" />
                         <div className="relative">
                            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-rose-500/20">
                               <Activity className="h-7 w-7" />
                            </div>
                            <h4 className="text-slate-400 font-bold text-sm uppercase tracking-[0.1em] mb-1">Productivity Score</h4>
                            <div className="text-5xl font-black text-white tracking-tighter">84<span className="text-xl text-emerald-400 ml-1">/100</span></div>
                            <div className="mt-4 flex items-center gap-2">
                               <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                               <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Excellent Progress</span>
                            </div>
                         </div>
                      </div>
                      <div className="group rounded-[40px] glass-panel p-8 relative overflow-hidden transition-all hover:bg-white/10">
                         <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-indigo-500/10 blur-3xl group-hover:bg-indigo-500/20 transition-all" />
                         <div className="relative">
                            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20">
                               <TrendingUp className="h-7 w-7" />
                            </div>
                            <h4 className="text-slate-400 font-bold text-sm uppercase tracking-[0.1em] mb-1">Focus Mode</h4>
                            <div className="text-5xl font-black text-white tracking-tighter">72<span className="text-xl text-indigo-400 ml-1">%</span></div>
                            <div className="mt-4 flex items-center gap-2">
                               <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                               <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Studying Today</span>
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="rounded-[40px] glass-panel p-10 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-30" />
                      <div className="mb-10">
                         <h3 className="text-2xl font-black text-white tracking-tight">Today's Usage</h3>
                         <p className="text-slate-500 text-sm font-bold">Mariam's top 4 applications</p>
                      </div>
                      <div className="space-y-8">
                        {APP_USAGE.map(app => (
                          <div key={app.name} className="group flex items-center gap-6">
                            <div className={`h-16 w-16 rounded-[24px] ${app.color}/10 border border-white/5 flex items-center justify-center text-white scale-100 transition-all group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-indigo-500/10`}>
                               {app.icon}
                            </div>
                            <div className="flex-1">
                               <div className="flex justify-between items-end mb-3">
                                  <div className="flex flex-col">
                                     <div className="flex items-center gap-2">
                                        <span className="font-black text-white text-xl tracking-tight">{app.name}</span>
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md bg-white/5 ${app.trend.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
                                           {app.trend}
                                        </span>
                                     </div>
                                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{app.category} • {app.opens} Opens</span>
                                  </div>
                                  <div className="text-right">
                                     <span className="font-black text-white text-lg">{Math.floor(app.time / 60)}h {app.time % 60}m</span>
                                  </div>
                               </div>
                               <div className="h-4 w-full rounded-2xl bg-white/5 overflow-hidden ring-1 ring-white/5">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(app.time / 120) * 100}%` }}
                                    className={`h-full rounded-full ${app.color} shadow-[0_0_15px_rgba(255,255,255,0.1)] relative`}
                                  >
                                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                                  </motion.div>
                               </div>
                            </div>
                          </div>
                        ))}
                      </div>
                   </div>
                </section>
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div 
                key="tab-analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="space-y-6 pb-12"
              >
                 <div className="grid grid-cols-12 gap-6">
                    {/* Quick Control Card */}
                    <div className="col-span-12 lg:col-span-4 rounded-[48px] bg-indigo-600 p-8 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden group">
                       <div className="absolute -right-4 -top-4 h-32 w-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all" />
                       <div className="relative">
                          <div className="flex items-center gap-3 mb-6">
                             <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center">
                                <Clock className="h-5 w-5" />
                             </div>
                             <span className="font-black tracking-tight uppercase text-sm">Quick Control</span>
                          </div>
                          <h3 className="text-3xl font-black mb-2">{dailyLimit} Min</h3>
                          <p className="text-indigo-100 text-sm font-bold mb-8">Current daily limit for Mariam</p>
                          
                          <input 
                            type="range" 
                            min="15" 
                            max="480" 
                            step="15"
                            value={dailyLimit}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setDailyLimit(val);
                            }}
                            className="w-full h-2 bg-indigo-400 rounded-lg appearance-none cursor-pointer accent-white mb-4"
                          />
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-indigo-200">
                             <span>15m</span>
                             <span>8h</span>
                          </div>
                       </div>
                    </div>

                    {/* App Addiction Chart */}
                    <div className="col-span-12 lg:col-span-8 rounded-[48px] glass-panel p-8">
                       <h3 className="text-xl font-black text-white mb-2">App Addiction</h3>
                       <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-8">Daily Launch Counts</p>
                       <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={APP_USAGE} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#fff', fontWeight: 700, fontSize: 12}} width={80} />
                                <Tooltip 
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                    contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '16px'}}
                                />
                                <Bar dataKey="opens" radius={[0, 10, 10, 0]}>
                                   {APP_USAGE.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={index === 2 ? '#F43F5E' : '#4F46E5'} />
                                   ))}
                                </Bar>
                             </BarChart>
                          </ResponsiveContainer>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-12 gap-6">
                    {/* Night Usage Analytics */}
                    <div className="col-span-12 lg:col-span-7 rounded-[48px] glass-panel p-10 relative overflow-hidden">
                       <div className="flex items-center justify-between mb-10">
                          <div>
                            <h3 className="text-2xl font-black text-white">Smart Habits</h3>
                            <p className="text-slate-500 font-bold text-sm">Night vs Day usage distribution</p>
                          </div>
                          <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                             <Clock className="h-7 w-7 text-indigo-400" />
                          </div>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-8 mb-10">
                          <div className="p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10">
                             <span className="block text-[10px] font-black text-indigo-400 mb-1 uppercase tracking-widest">Day Usage</span>
                             <span className="text-3xl font-black text-white">4h 12m</span>
                             <div className="mt-4 h-1.5 w-full bg-indigo-500/20 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 w-[85%]" />
                             </div>
                          </div>
                          <div className="p-6 rounded-3xl bg-rose-500/5 border border-rose-500/10">
                             <span className="block text-[10px] font-black text-rose-400 mb-1 uppercase tracking-widest font-mono">Night Usage (22:00+)</span>
                             <span className="text-3xl font-black text-white">0h 20m</span>
                             <div className="mt-4 h-1.5 w-full bg-rose-500/20 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-500 w-[15%]" />
                             </div>
                          </div>
                       </div>

                       <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-center gap-4">
                          <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
                          <p className="text-sm font-bold text-amber-200 leading-snug">Mariam used WhatsApp for 15 minutes past 10:00 PM. AI suggests setting a hard bedtime lock.</p>
                       </div>
                    </div>

                    {/* AI Insights Card Enhanced */}
                    <div className="col-span-12 lg:col-span-5 rounded-[48px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-10 shadow-2xl shadow-indigo-600/30 relative overflow-hidden group">
                       <div className="absolute -right-10 -bottom-10 h-64 w-64 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-1000" />
                       <div className="relative">
                          <div className="flex items-center gap-4 mb-8">
                             <div className="h-14 w-14 flex items-center justify-center rounded-[20px] bg-white ring-8 ring-white/10">
                                <Sparkles className="h-7 w-7 text-indigo-600" />
                             </div>
                             <div>
                                <h3 className="text-2xl font-black text-white tracking-tight">AI Health Scan</h3>
                                <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Powered by Gemini Pro</p>
                             </div>
                          </div>
                          
                          <div className="space-y-6">
                             <div className="glass-panel-heavy bg-white/10 backdrop-blur-xl rounded-[32px] p-6 border border-white/20">
                                <p className="text-base font-bold text-white leading-relaxed">
                                   {report ? report : "Mariam's Focus Mode is high! She launched Khan Academy twice today, but we detected a rising trend in Social media launches (42 times). Consider monitoring WhatsApp frequency."}
                                </p>
                             </div>
                             
                             <button 
                               onClick={handleGenerateReport}
                               disabled={loadingReport}
                               className="relative w-full group overflow-hidden rounded-[24px] bg-white py-6 font-black text-indigo-700 transition-all hover:bg-slate-50 active:scale-95 shadow-xl shadow-black/20"
                             >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                <div className="relative flex items-center justify-center gap-3">
                                   {loadingReport ? (
                                      <>
                                         <div className="h-5 w-5 border-4 border-indigo-700/30 border-t-indigo-700 rounded-full animate-spin" />
                                         <span>Analyzing Habits...</span>
                                      </>
                                   ) : (
                                      <>
                                         <Activity className="h-5 w-5" />
                                         <span>Generate AI Insight Report</span>
                                      </>
                                   )}
                                </div>
                             </button>
                             
                             <div className="flex items-center justify-center gap-3">
                                <div className="h-1 w-1 rounded-full bg-white/40" />
                                <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">UsageStats Data Integrated</span>
                                <div className="h-1 w-1 rounded-full bg-white/40" />
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}

            {activeTab === 'security' && (
              <motion.div 
                key="tab-security"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid grid-cols-12 gap-6"
              >
                <div className="col-span-12 lg:col-span-6 space-y-6">
                  <div className="rounded-[48px] glass-panel p-10">
                    <h3 className="text-2xl font-black text-white mb-8">System Settings</h3>
                    <div className="space-y-8">
                       {/* Daily Limit Control */}
                       <div className="flex items-start gap-5 p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10">
                          <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                             <Clock className="h-6 w-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <h4 className="font-black text-white">Daily Usage Limit</h4>
                             <p className="text-slate-500 text-xs font-bold leading-relaxed mb-6">Total tablet time allowed before lockdown.</p>
                             
                             <div className="flex items-center gap-4 mb-4">
                                <span className="text-3xl font-black text-white tracking-tighter">{Math.floor(dailyLimit / 60)}h {dailyLimit % 60}m</span>
                             </div>

                             <input 
                                type="range" min="15" max="600" step="15" 
                                value={dailyLimit}
                                onChange={(e) => setDailyLimit(parseInt(e.target.value))}
                                className="h-3 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-indigo-500"
                             />
                             <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                                <span>15m</span>
                                <span>10h</span>
                             </div>
                          </div>
                       </div>

                       <div className="flex items-start gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                             <Lock className="h-7 w-7" />
                          </div>
                          <div>
                             <h4 className="text-lg font-black text-white mb-1">Administrative Lock</h4>
                             <p className="text-slate-400 text-sm leading-relaxed mb-6">Secures the entire OS by deploying a 100% overlay that blocks apps and settings access until PIN is entered.</p>
                             
                             {isChangingPin ? (
                                <div className="space-y-4 max-w-sm">
                                   <input 
                                     type="password" maxLength={8} placeholder="Enter 8-digit custom PIN"
                                     value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                                     className="w-full rounded-2xl bg-slate-900 border-2 border-indigo-500/50 p-4 text-white font-black text-2xl tracking-widest focus:outline-none focus:border-indigo-400"
                                   />
                                   <div className="flex gap-4">
                                      <button onClick={handleUpdatePin} className=" flex-1 rounded-2xl bg-indigo-600 py-4 font-black text-white hover:bg-indigo-500 transition-all">Save</button>
                                      <button onClick={() => setIsChangingPin(false)} className="flex-1 rounded-2xl bg-white/5 py-4 font-bold text-white hover:bg-white/10">Back</button>
                                   </div>
                                </div>
                             ) : (
                                <button onClick={() => setIsChangingPin(true)} className="rounded-2xl bg-white/5 border border-white/10 px-8 py-4 font-black text-white transition-all hover:bg-white/10">
                                   Change Override PIN
                                </button>
                             )}
                          </div>
                       </div>

                       <div className="flex items-start gap-5 p-6 rounded-3xl bg-white/5 border border-white/5">
                           <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                              <Bell className="h-6 w-6" />
                           </div>
                           <div className="flex-1">
                              <div className="flex items-center justify-between">
                                 <div>
                                    <h4 className="font-black text-white">System Alerts</h4>
                                    <p className="text-slate-500 text-xs font-bold leading-relaxed">Notifications at 10m and 1m remaining.</p>
                                 </div>
                                 <button 
                                   onClick={() => setIsAlertsEnabled(!isAlertsEnabled)}
                                   className={`h-8 w-14 rounded-full p-1 transition-all ${isAlertsEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
                                 >
                                    <div className={`h-6 w-6 rounded-full bg-white transition-all ${isAlertsEnabled ? 'ml-6' : 'ml-0'}`} />
                                 </button>
                              </div>
                           </div>
                        </div>

                        <div className="flex items-start gap-5 p-6 rounded-3xl bg-rose-500/5 border border-rose-500/20">
                           <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                              <RefreshCw className="h-6 w-6" />
                           </div>
                           <div className="flex-1">
                              <h4 className="font-black text-white">Reset Daily Data</h4>
                              <p className="text-slate-500 text-xs font-bold leading-relaxed mb-4">Wipe today's usage logs and restore time.</p>
                              <button 
                                onClick={onResetUsage}
                                className="rounded-xl px-4 py-2 border border-rose-500/30 text-rose-400 text-xs font-black uppercase hover:bg-rose-500/10 transition-all"
                              >
                                 Clear Logs
                              </button>
                           </div>
                        </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-6 space-y-6">
                   <div className="rounded-[48px] glass-panel p-10 bg-rose-500/5 border-rose-500/20 ring-1 ring-rose-500/10">
                      <div className="h-14 w-14 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center mb-6">
                         <AlertTriangle className="h-8 w-8" />
                      </div>
                      <h3 className="text-2xl font-black text-white mb-4">Anti-Tamper Active</h3>
                      <div className="space-y-4">
                         <div className="flex items-center gap-4 text-slate-300">
                            <ChevronRight className="h-4 w-4 text-rose-500" />
                            <span className="font-bold">Uninstall Protection: </span> Enabled
                         </div>
                         <div className="flex items-center gap-4 text-slate-300">
                            <ChevronRight className="h-4 w-4 text-rose-500" />
                            <span className="font-bold">Force-Stop Prevention: </span> Active
                         </div>
                         <div className="flex items-center gap-4 text-slate-300">
                            <ChevronRight className="h-4 w-4 text-rose-500" />
                            <span className="font-bold">System Reboot Recovery: </span> Ready
                         </div>
                      </div>
                      <div className="mt-10 p-6 rounded-[32px] bg-rose-500/10 border border-rose-500/20">
                         <p className="text-xs font-black uppercase tracking-widest text-rose-300 mb-2">Android 10+ Compliance</p>
                         <p className="text-sm text-slate-400 leading-relaxed font-medium">The foreground service ensures that background processes remain active even if the user minimizes the dashboard or closes the notification drawer.</p>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>
    </motion.div>
  );
}
