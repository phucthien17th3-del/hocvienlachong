import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithCustomToken 
} from 'firebase/auth';
import {
  getFirestore, doc, setDoc, collection, onSnapshot,
  query, orderBy, getDoc, limit, deleteDoc, addDoc, updateDoc, writeBatch, serverTimestamp
} from 'firebase/firestore';
import {
  MessageSquare, Send, LogOut, Settings,
  X, FileDown, DoorClosed, DoorOpen, PlayCircle, Trash2, 
  Megaphone, TrendingUp, FileSpreadsheet, Users, ShieldCheck, Globe, Layout, Volume2, Shield, MousePointer2, Ban,
  Plus, Bot, MessageCircle, Smartphone, Monitor, Info, Activity, UserMinus,
  Languages, Globe2, Clock, ChevronDown, Check
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { 
  ROLES, SENSITIVE_WORDS, BOT_CATEGORIES, TRAILER_SLIDES, TRANSLATIONS 
} from './constants';

// ===========================================================================
// CONFIGURATION & UTILS
// ===========================================================================
const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    return new GoogleGenAI({ apiKey });
  } catch (e) {
    console.error("Failed to initialize GoogleGenAI:", e);
    return null;
  }
};

const ai = getAI();

const firebaseConfig = (typeof (window as any).__firebase_config !== 'undefined')
  ? JSON.parse((window as any).__firebase_config) 
  : {
      apiKey: "AIzaSyDvkFaS0I9jHy1Oa-I0Kh6L6JDxI7ijKHY",
      authDomain: "livefish-prod.firebaseapp.com",
      projectId: "livefish-prod",
      storageBucket: "livefish-prod.firebasestorage.app",
      messagingSenderId: "1021892050926",
      appId: "1:1021892050926:web:cbb79ea77138760975731b"
    };

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = (typeof (window as any).__app_id !== 'undefined') ? (window as any).__app_id : 'lac-hong-v4'; 

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [lang, setLang] = useState(() => localStorage.getItem('lac_hong_lang') || 'vi');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState('trailer');
  const [trailerSlide, setTrailerSlide] = useState(0);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [messages, setMessages] = useState<any[]>([]);
  const [botMessages, setBotMessages] = useState<any[]>([]);
  const [newBotMsg, setNewBotMsg] = useState({ text: '', category: 'opening' });
  const [botConfig, setBotConfig] = useState<any>({
    opening: true, core: true, closing: true, isRunning: false
  });
  const [usedBotMessages, setUsedBotMessages] = useState<Set<string>>(new Set());
  
  const [accounts, setAccounts] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [viewersCount, setViewersCount] = useState(0);
  const [loginForm, setLoginForm] = useState({ id: '', pass: '' });
  const [chatInput, setChatInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [newUser, setNewUser] = useState({ id: '', pass: '', name: '', role: 'student' });
  const [showUnmute, setShowUnmute] = useState(true);
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const [onlineTime, setOnlineTime] = useState(0);

  const [config, setConfig] = useState<any>({
    liveUrl: 'https://player.kick.com/lac-hong-2026',
    isLiveOpen: true,
    disableVideoInteraction: false,
    fakeViewersBase: 12500,
    fakeViewersEnabled: true,
    marqueeMessage: "Chào mừng các bạn đến với Học viện Lạc Hồng. Chúc các bạn có những giờ học bổ ích!",
    maxViewersRecord: 0,
    totalComments: 0,
    serverStatus: 'stable',
    logoUrl: 'https://images.unsplash.com/photo-1611974717482-98252c00d662?auto=format&fit=crop&q=80&w=400',
    backgroundUrl: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&q=80&w=1920'
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const deviceId = useMemo(() => Math.random().toString(36).substring(2, 15), []);
  const t = useMemo(() => TRANSLATIONS[lang] || TRANSLATIONS.vi, [lang]);

  useEffect(() => { localStorage.setItem('lac_hong_lang', lang); }, [lang]);
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (step === 'trailer') {
      const slideInterval = setInterval(() => {
        setTrailerSlide(prev => (prev + 1) % TRAILER_SLIDES.length);
      }, 6000);
      const endTimer = setTimeout(() => { setStep('intro'); clearInterval(slideInterval); }, 30000);
      return () => { clearTimeout(endTimer); clearInterval(slideInterval); };
    }
  }, [step]);

  useEffect(() => {
    let interval: any;
    if (step === 'live' && currentUserData && config.isLiveOpen) {
      interval = setInterval(() => {
        setOnlineTime(prev => prev + 1);
        if (onlineTime > 0 && onlineTime % 60 === 0) {
          const logRef = doc(db, 'artifacts', appId, 'public', 'data', 'attendance', `${currentUserData.id}_${new Date().toLocaleDateString().replace(/\//g, '-')}`);
          setDoc(logRef, {
            userId: currentUserData.id, userName: currentUserData.displayName,
            date: new Date().toLocaleDateString(), duration: onlineTime, lastSeen: Date.now()
          }, { merge: true });
        }
      }, 1000);
    } else if (!config.isLiveOpen && step === 'live' && currentUserData?.role === ROLES.STUDENT) {
      alert(t.live_closed_auto); setStep('trailer'); setCurrentUserData(null);
    }
    return () => clearInterval(interval);
  }, [step, currentUserData, config.isLiveOpen, onlineTime]);

  useEffect(() => {
    if (!botConfig.isRunning || !user || currentUserData?.role !== ROLES.ADMIN) return;
    const interval = setInterval(() => {
      const availableMessages = botMessages.filter(m => botConfig[m.category] && !usedBotMessages.has(m.id));
      if (availableMessages.length === 0) {
        setBotConfig((prev: any) => ({ ...prev, isRunning: false })); return;
      }
      const randomMsg = availableMessages[Math.floor(Math.random() * availableMessages.length)];
      handleSendMessage(randomMsg.text);
      setUsedBotMessages(prev => new Set(prev).add(randomMsg.id));
    }, 15000);
    return () => clearInterval(interval);
  }, [botConfig, botMessages, usedBotMessages, user]);

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('kick.com')) {
      const channel = url.split('/').filter(Boolean).pop();
      return `https://player.kick.com/${channel}?muted=${showUnmute}&autoplay=true&chat=false`;
    }
    if (url.includes('youtube.com/watch?v=')) {
      const id = new URL(url).searchParams.get('v');
      return `https://www.youtube.com/embed/${id}?autoplay=1&mute=${showUnmute ? 1 : 0}`;
    }
    if (url.includes('youtu.be/')) {
      const id = url.split('/').pop();
      return `https://www.youtube.com/embed/${id}?autoplay=1&mute=${showUnmute ? 1 : 0}`;
    }
    if (url.includes('twitch.tv/')) {
      const channel = url.split('/').pop();
      return `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&muted=${showUnmute}`;
    }
    return url;
  };

  useEffect(() => {
    const initAuth = async () => {
      if (typeof (window as any).__initial_auth_token !== 'undefined' && (window as any).__initial_auth_token) {
        await signInWithCustomToken(auth, (window as any).__initial_auth_token).catch(() => signInAnonymously(auth));
      } else { await signInAnonymously(auth); }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (currentUserData && currentUserData.role !== ROLES.ADMIN && step === 'live') {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', currentUserData.id);
      setDoc(sessionRef, { activeId: deviceId, lastSeen: Date.now() }, { merge: true });
      const unsubSession = onSnapshot(sessionRef, (snap) => {
        if (snap.exists() && snap.data().activeId !== deviceId) {
          alert(t.session_conflict); setStep('login'); setCurrentUserData(null);
        }
      });
      return () => unsubSession();
    }
  }, [currentUserData, step, deviceId]);

  useEffect(() => {
    if (!user) return;
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global'), (d) => {
      if (d.exists()) setConfig((prev: any) => ({ ...prev, ...d.data() }));
    });
    const unsubMsg = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), orderBy('timestamp', 'asc'), limit(60)), s => {
      setMessages(s.docs.map(d => ({ id: d.id, ...d.data() })));
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    const unsubBot = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'bot_messages'), s => {
      setBotMessages(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), s => {
      setAccounts(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubAttendance = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'attendance'), s => {
      setAttendanceLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubConfig(); unsubMsg(); unsubBot(); unsubUsers(); unsubAttendance(); };
  }, [user]);

  const filterText = (text: string) => {
    let clean = text;
    SENSITIVE_WORDS.forEach(word => { clean = clean.replace(new RegExp(word, 'gi'), '***'); });
    return clean;
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !user || currentUserData?.role === ROLES.GUEST) return;
    const now = Date.now();
    if (currentUserData.role !== ROLES.ADMIN && now - lastMessageTime < 3000) return alert(t.rate_limit);
    
    setChatInput(''); // Clear immediately
    
    const msgData = {
      text: filterText(text), senderId: currentUserData.id,
      senderName: currentUserData.displayName || currentUserData.id,
      role: currentUserData.role, timestamp: Date.now()
    };
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), msgData);
      setLastMessageTime(now);
      updateConfig({ totalComments: (config.totalComments || 0) + 1 });
    } catch (e) { console.error(e); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); if (isLoggingIn) return; setIsLoggingIn(true);
    const inputId = loginForm.id.toLowerCase();
    const inputPass = loginForm.pass.toLowerCase();
    if (inputId === 'admin' && inputPass === 'hvlh2026') {
      setCurrentUserData({ id: 'admin', role: ROLES.ADMIN, displayName: t.admin_display_name });
      setStep('live'); setIsLoggingIn(false); return;
    }
    try {
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', inputId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists() && userDoc.data().pass.toLowerCase() === inputPass) {
        if (!config.isLiveOpen && userDoc.data().role !== ROLES.ADMIN) {
          alert(t.live_closed); setStep('trailer'); setIsLoggingIn(false); return;
        }
        setCurrentUserData({ id: userDoc.id, ...userDoc.data(), role: ROLES.STUDENT });
        setStep('live');
      } else { alert(t.login_error); }
    } catch (err) { alert(t.server_error); } finally { setIsLoggingIn(false); }
  };

  const updateConfig = async (fields: any) => {
    if (!user) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global'), fields, { merge: true });
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(obj => Object.values(obj).join(",")).join("\n");
    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url); link.setAttribute("download", `${filename}.csv`); link.click();
  };

  useEffect(() => {
    if (config.fakeViewersEnabled) {
      const interval = setInterval(() => {
        const base = parseInt(config.fakeViewersBase) || 12000;
        const current = base + Math.floor(Math.random() * 400 - 200);
        setViewersCount(current);
        if (current > (config.maxViewersRecord || 0)) updateConfig({ maxViewersRecord: current });
      }, 4000);
      return () => clearInterval(interval);
    } else setViewersCount(1);
  }, [config.fakeViewersEnabled, config.fakeViewersBase]);

  const handleTranslate = async (msgId: string, text: string) => {
    if (isTranslating[msgId]) return;
    if (translatedMessages[msgId]) {
      setTranslatedMessages(prev => { const next = { ...prev }; delete next[msgId]; return next; }); return;
    }
    setIsTranslating(prev => ({ ...prev, [msgId]: true }));
    try {
      if (!ai) {
        throw new Error("AI service not initialized");
      }
      const targetLang = lang === 'zh' ? 'Chinese' : lang === 'en' ? 'English' : 'Vietnamese';
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Translate to ${targetLang}. Only return text: "${text}"`,
      });
      setTranslatedMessages(prev => ({ ...prev, [msgId]: result.text || text }));
    } catch (e) { 
      console.error(e);
      alert("Dịch vụ dịch thuật hiện không khả dụng.");
    } finally { 
      setIsTranslating(prev => ({ ...prev, [msgId]: false })); 
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden font-sans select-none touch-manipulation">
      {['intro', 'login', 'trailer'].includes(step) && (
        <>
          <div className="absolute inset-0 z-0">
            <img src={config.backgroundUrl} className="w-full h-full object-cover opacity-40" alt="BG" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
          </div>
        </>
      )}

      {step === 'trailer' && (
        <div className="absolute inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
          {t.trailer_slides?.map((slide: any, idx: number) => (
            <div key={idx} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${trailerSlide === idx ? 'opacity-100' : 'opacity-0'}`}>
              <img src={TRAILER_SLIDES[idx]?.image || config.backgroundUrl} className={`w-full h-full object-cover scale-110 ${trailerSlide === idx ? 'animate-[kenBurns_6s_linear_infinite]' : ''}`} alt="Trailer" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px]" />
            </div>
          ))}
          <div className="relative z-10 w-full max-w-6xl px-6 text-center">
            {t.trailer_slides?.map((slide: any, idx: number) => (
              <div key={idx} className={`transition-all duration-1000 absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 ${trailerSlide === idx ? 'opacity-100' : 'opacity-0'}`}>
                <div className="inline-block px-4 py-1 border border-cyan-500/30 rounded-full bg-cyan-500/10 mb-8">
                  <span className="text-cyan-400 text-[8px] md:text-[10px] font-black tracking-[8px] uppercase">{t.vision}</span>
                </div>
                <h2 className="text-2xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight mb-6 italic text-white drop-shadow-2xl">"{slide.quote}"</h2>
                <div className="flex items-center justify-center gap-4">
                  <div className="h-px w-8 bg-cyan-500" />
                  <p className="text-xs md:text-sm font-black text-cyan-400 uppercase tracking-[4px]">{slide.author}</p>
                  <div className="h-px w-8 bg-cyan-500" />
                </div>
              </div>
            ))}
          </div>
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3 z-20">
            {t.trailer_slides?.map((_: any, idx: number) => (
              <div key={idx} className={`h-1 transition-all duration-500 rounded-full ${trailerSlide === idx ? 'w-12 bg-cyan-500 shadow-[0_0_10px_cyan]' : 'w-3 bg-white/20'}`} />
            ))}
          </div>
        </div>
      )}

      {step === 'intro' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 p-4">
          <div className="text-center cursor-pointer group" onClick={()=>setStep('login')}>
            <h1 className="text-4xl md:text-8xl font-black tracking-[10px] md:tracking-[20px] uppercase mb-10 text-cyan-400 drop-shadow-[0_0_25px_cyan] animate-pulse leading-tight">{t.title}</h1>
            <div className="inline-flex items-center gap-5 px-8 py-4 md:px-10 md:py-5 border-2 border-cyan-500/40 rounded-full group-hover:bg-cyan-500/20 transition-all bg-black/60 backdrop-blur-xl shadow-2xl">
              <PlayCircle size={24} className="text-cyan-400" />
              <span className="text-[10px] md:text-xs tracking-[4px] md:tracking-[6px] font-black text-cyan-400 uppercase">{t.intro_btn}</span>
            </div>
          </div>
        </div>
      )}

      {step === 'login' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 md:p-10 border border-white/10 rounded-[2.5rem] bg-black/80 backdrop-blur-3xl shadow-2xl">
            <div className="flex justify-center mb-6"><ShieldCheck size={40} className="text-cyan-400" /></div>
            <h2 className="text-[10px] md:text-[12px] font-black tracking-[6px] text-center mb-8 text-cyan-400 uppercase">{t.auth_title}</h2>
            <form onSubmit={handleLogin} className="space-y-4">
               <div className="relative">
                 <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/50" size={16} />
                 <input value={loginForm.id} onChange={e=>setLoginForm(p=>({...p, id:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-sm outline-none focus:border-cyan-500 font-bold uppercase transition-all" placeholder={t.login_placeholder} />
               </div>
               <div className="relative">
                 <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/50" size={16} />
                 <input type="password" value={loginForm.pass} onChange={e=>setLoginForm(p=>({...p, pass:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-sm outline-none focus:border-cyan-500 font-bold transition-all" placeholder={t.pass_placeholder} />
               </div>
               <button type="submit" className="w-full bg-cyan-600 py-4 rounded-2xl font-black text-[10px] tracking-[4px] uppercase hover:bg-cyan-500 transition-all shadow-lg active:scale-95 disabled:opacity-50" disabled={isLoggingIn}>{isLoggingIn ? t.authenticating : t.login_btn}</button>
            </form>
            <div className="mt-8 pt-8 border-t border-white/5 space-y-3">
               <button type="button" onClick={()=>{ setCurrentUserData({id:`GUEST_${Math.floor(Math.random()*9999)}`, role: ROLES.GUEST, displayName: t.guest}); setStep('live'); }} className="w-full bg-white/5 border border-white/10 py-4 rounded-2xl font-black text-[10px] tracking-[4px] uppercase hover:bg-white/10 transition-all shadow-lg active:scale-95 text-cyan-400">{t.guest_btn}</button>
            </div>
          </div>
        </div>
      )}

      {step === 'live' && currentUserData && (
        <div className="flex flex-col h-full bg-[#050505]">
            <header className="h-14 md:h-16 border-b border-white/10 flex items-center justify-between px-4 md:px-6 z-50 bg-[#080808]">
              <div className="flex items-center gap-3 overflow-hidden">
                  <h1 className="font-black tracking-[2px] md:tracking-[4px] text-[10px] md:text-[12px] uppercase text-cyan-400 truncate">{t.title}</h1>
                  <div className="hidden lg:flex items-center gap-2 text-[9px] font-black text-slate-400 bg-white/5 px-2.5 py-1.5 rounded-full border border-white/5 shrink-0">
                     <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_green]" />
                     {viewersCount.toLocaleString()}
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-[9px] font-black text-cyan-400/80 bg-cyan-500/5 px-3 py-1.5 rounded-full border border-cyan-500/10 shrink-0">
                     <Clock size={12} /> {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                  <div className="relative group">
                    <button className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase text-slate-300 hover:bg-white/10 transition-all">
                      <Languages size={14} className="text-cyan-400" />
                      <span className="hidden sm:inline">{t.available_langs[lang]}</span>
                      <ChevronDown size={12} />
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-40 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60] p-2">
                      {Object.entries(t.available_langs || {}).map(([code, name]: [any, any]) => (
                        <button key={code} onClick={() => setLang(code)} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase transition-all ${lang === code ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                          {name} {lang === code && <Check size={12} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  {currentUserData.role === ROLES.ADMIN && <button onClick={()=>setAdminOpen(true)} className="p-2 bg-cyan-600/10 text-cyan-400 rounded-xl border border-cyan-500/20 active:bg-cyan-600/30 transition-all"><Settings size={16}/></button>}
                  <button onClick={() => { setStep('login'); setCurrentUserData(null); }} className="p-2 bg-red-600/10 text-red-500 rounded-xl border border-red-500/20 active:bg-red-600/30 transition-all"><LogOut size={16}/></button>
              </div>
            </header>

            <div className="h-8 md:h-9 bg-cyan-950/20 border-b border-white/5 flex items-center overflow-hidden relative z-40">
              <div className="absolute left-0 top-0 bottom-0 bg-[#080808] px-3 flex items-center z-10 border-r border-white/10 shadow-xl"><Megaphone size={14} className="text-cyan-400" /></div>
              <div className="whitespace-nowrap flex animate-marquee pl-[100%] py-1 text-[10px] font-bold text-cyan-300/80 uppercase tracking-[2px]">{config.marqueeMessage}</div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
              <main className="w-full md:flex-1 aspect-video md:aspect-auto bg-black relative flex flex-col overflow-hidden">
                  <iframe src={getEmbedUrl(config.liveUrl)} className="w-full h-full border-none pointer-events-auto" allowFullScreen />
                  {config.disableVideoInteraction && currentUserData.role !== ROLES.ADMIN && (
                    <div className="absolute inset-0 z-10 pointer-events-auto cursor-not-allowed">
                        <div className="absolute top-4 right-4 bg-black/80 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 text-[10px] font-bold text-cyan-400 backdrop-blur-md">
                           <Ban size={12} /> TƯƠNG TÁC BỊ CHẶN
                        </div>
                    </div>
                  )}
                  {showUnmute && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto p-4 text-center">
                      <button onClick={()=>setShowUnmute(false)} className="flex flex-col items-center gap-4 bg-cyan-600 hover:bg-cyan-500 px-10 py-8 rounded-[2.5rem] shadow-2xl animate-bounce max-w-[300px] border border-cyan-400/20">
                        <Volume2 size={40} className="text-white" />
                        <span className="font-black text-[10px] md:text-xs uppercase tracking-[4px]">{t.unmute}</span>
                      </button>
                    </div>
                  )}
              </main>

              <aside className="w-full md:w-[360px] flex-1 md:flex-none border-t md:border-t-0 md:border-l border-white/10 bg-[#080808] flex flex-col overflow-hidden">
                  <div className="h-10 md:h-12 border-b border-white/10 flex items-center justify-between px-5">
                    <div className="text-[9px] md:text-[10px] font-black uppercase text-cyan-400 flex items-center"><MessageSquare size={14} className="mr-2"/> {t.interaction}</div>
                    <div className="text-[8px] font-bold text-slate-500 flex items-center gap-1"><Activity size={10} className="text-green-500"/> {t.realtime}</div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/20">
                    {messages.map((m) => (
                       <div key={m.id} className={`group flex flex-col gap-1 ${m.senderId === currentUserData.id ? 'items-end' : ''}`}>
                          <div className="flex items-center gap-2">
                             {currentUserData.role === ROLES.ADMIN && <button onClick={async()=>await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', m.id))} className="text-red-500 hover:scale-110 transition-transform p-1 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>}
                             <span className={`text-[8px] md:text-[9px] font-black uppercase ${m.role === ROLES.ADMIN ? 'text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20' : 'text-cyan-400'}`}>{m.senderName}</span>
                          </div>
                          <div className={`relative p-3 rounded-2xl text-[12px] border transition-all ${m.senderId === currentUserData.id ? 'bg-cyan-600/10 border-cyan-500/30 text-cyan-50 rounded-tr-none' : 'bg-white/5 border-white/10 text-slate-200 rounded-tl-none'}`}>
                            {translatedMessages[m.id] || m.text}
                            <button onClick={() => handleTranslate(m.id, m.text)} className={`mt-2 flex items-center gap-1 text-[8px] font-black uppercase transition-all ${isTranslating[m.id] ? 'animate-pulse text-cyan-400' : 'text-slate-500 hover:text-cyan-400'}`}>
                              <Globe2 size={10} /> {isTranslating[m.id] ? '...' : translatedMessages[m.id] ? t.original : t.translate}
                            </button>
                          </div>
                       </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-3 md:p-4 border-t border-white/10 bg-[#050505]">
                    {currentUserData.role === ROLES.GUEST ? (
                        <div className="w-full py-3 bg-white/5 border border-white/5 rounded-2xl text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.chat_guest_denied}</div>
                    ) : (
                        <form onSubmit={e=>{ e.preventDefault(); handleSendMessage(chatInput); }} className="flex gap-2">
                           <input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder={t.chat_placeholder} className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-xs outline-none focus:border-cyan-500 placeholder:opacity-30 transition-all" />
                           <button type="submit" className="px-5 bg-cyan-600 rounded-2xl hover:bg-cyan-500 active:scale-90 transition-all shadow-lg flex items-center justify-center"><Send size={18}/></button>
                        </form>
                    )}
                  </div>
              </aside>
            </div>
        </div>
      )}

      {adminOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-2 md:p-4 overflow-hidden">
           <div className="w-full max-w-6xl bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] md:rounded-[3.5rem] h-[95vh] flex flex-col overflow-hidden shadow-2xl relative">
              <header className="p-4 md:p-6 border-b border-white/10 flex flex-col md:flex-row items-center justify-between bg-white/5 gap-4">
                 <div className="flex items-center gap-4 shrink-0">
                    <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/30"><Shield className="text-cyan-400" size={20} /></div>
                    <div><h2 className="font-black text-[10px] md:text-xs tracking-[2px] uppercase">{t.admin_panel}</h2><p className="text-[8px] font-bold text-slate-500 uppercase">{t.admin_system}</p></div>
                 </div>
                 <div className="flex flex-wrap justify-center gap-1 md:gap-2">
                    {[ {id: 'general', label: t.config, icon: Layout}, {id: 'bot', label: t.bot_chat, icon: Bot}, {id: 'users', label: t.members_tab, icon: Users}, {id: 'analytics', label: t.data_tab, icon: TrendingUp} ].map(tab => (
                      <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`px-3 md:px-5 py-2.5 rounded-2xl text-[8px] md:text-[10px] font-black uppercase transition-all flex items-center gap-1 md:gap-2 ${activeTab===tab.id ? 'bg-cyan-600 text-white shadow-[0_0_20px_rgba(8,145,178,0.4)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                         <tab.icon size={12}/> {tab.label}
                      </button>
                    ))}
                    <button onClick={()=>setAdminOpen(false)} className="p-2.5 hover:bg-red-500/20 text-slate-400 rounded-xl transition-all"><X size={22}/></button>
                 </div>
              </header>
              <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-black/40">
                  {activeTab === 'general' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 max-w-5xl mx-auto">
                       <div className="bg-white/5 p-6 md:p-8 rounded-[2rem] border border-white/10 space-y-6">
                         <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2"><Globe size={14}/> {t.stream_settings}</h3>
                         <div className="space-y-2">
                            <label className="text-[9px] text-slate-500 font-bold uppercase">{t.stream_url}</label>
                            <input value={config.liveUrl} onChange={e=>updateConfig({liveUrl: e.target.value})} className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs focus:border-cyan-500 outline-none font-medium" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] text-slate-500 font-bold uppercase">{t.logo_url}</label>
                            <input value={config.logoUrl} onChange={e=>updateConfig({logoUrl: e.target.value})} className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs focus:border-cyan-500 outline-none font-medium" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] text-slate-500 font-bold uppercase">{t.bg_url}</label>
                            <input value={config.backgroundUrl} onChange={e=>updateConfig({backgroundUrl: e.target.value})} className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs focus:border-cyan-500 outline-none font-medium" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] text-slate-500 font-bold uppercase">{t.marquee_content}</label>
                            <textarea value={config.marqueeMessage} onChange={e=>updateConfig({marqueeMessage: e.target.value})} className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs focus:border-cyan-500 outline-none min-h-[100px] resize-none" />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <button onClick={()=>updateConfig({isLiveOpen: !config.isLiveOpen})} className={`p-4 rounded-[1.5rem] border transition-all flex flex-col items-center gap-2 ${config.isLiveOpen ? 'border-green-500/30 text-green-500 bg-green-500/5' : 'border-red-500/30 text-red-500 bg-red-500/10'}`}>{config.isLiveOpen ? <DoorOpen/> : <DoorClosed/>}<span className="text-[9px] font-black uppercase">{t.status}: {config.isLiveOpen ? t.open : t.closed}</span></button>
                            <button onClick={()=>updateConfig({disableVideoInteraction: !config.disableVideoInteraction})} className={`p-4 rounded-[1.5rem] border transition-all flex flex-col items-center gap-2 ${config.disableVideoInteraction ? 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10' : 'border-cyan-500/30 text-cyan-500 bg-cyan-500/5'}`}>{config.disableVideoInteraction ? <Ban/> : <MousePointer2/>}<span className="text-[9px] font-black uppercase">{config.disableVideoInteraction ? t.mouse_block : t.mouse_allow}</span></button>
                         </div>
                       </div>
                       <div className="bg-white/5 p-6 md:p-8 rounded-[2rem] border border-white/10 space-y-6">
                         <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2"><TrendingUp size={14}/> {t.viewer_settings}</h3>
                         <div className="flex justify-between items-center bg-black/40 p-5 rounded-[1.5rem] border border-white/5">
                            <div><p className="text-[9px] text-slate-500 font-bold uppercase">{t.fake_viewer_mode}</p><h4 className="text-2xl font-black text-white">{viewersCount.toLocaleString()}</h4></div>
                            <button onClick={()=>updateConfig({fakeViewersEnabled: !config.fakeViewersEnabled})} className={`w-14 h-7 rounded-full relative transition-all ${config.fakeViewersEnabled ? 'bg-cyan-600' : 'bg-slate-700'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${config.fakeViewersEnabled ? 'left-8' : 'left-1'}`} /></button>
                         </div>
                         <div className="space-y-4">
                            <div className="flex justify-between text-[9px] font-black uppercase"><span className="text-slate-500">{t.min_viewers}</span><span className="text-cyan-400 font-black">{config.fakeViewersBase?.toLocaleString()}</span></div>
                            <input type="range" min="1000" max="100000" step="500" value={config.fakeViewersBase || 10000} onChange={e=>updateConfig({fakeViewersBase: parseInt(e.target.value)})} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                         </div>
                       </div>
                    </div>
                  )}
                  {activeTab === 'analytics' && (
                    <div className="space-y-6 max-w-5xl mx-auto">
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-gradient-to-br from-white/5 to-transparent p-8 rounded-[2rem] border border-white/10 text-center relative overflow-hidden group">
                             <p className="text-[10px] font-black uppercase text-slate-500 mb-2">{t.total_comments}</p>
                             <h4 className="text-4xl font-black text-white tabular-nums">{config.totalComments || 0}</h4>
                          </div>
                          <div className="bg-gradient-to-br from-white/5 to-transparent p-8 rounded-[2rem] border border-white/10 text-center relative overflow-hidden group">
                             <p className="text-[10px] font-black uppercase text-slate-500 mb-2">{t.max_viewers}</p>
                             <h4 className="text-4xl font-black text-white tabular-nums">{config.maxViewersRecord?.toLocaleString() || 0}</h4>
                          </div>
                          <div className="bg-gradient-to-br from-white/5 to-transparent p-8 rounded-[2rem] border border-white/10 text-center relative overflow-hidden group">
                             <p className="text-[10px] font-black uppercase text-slate-500 mb-2">{t.members}</p>
                             <h4 className="text-4xl font-black text-white tabular-nums">{accounts.length}</h4>
                          </div>
                       </div>
                       <div className="bg-white/5 p-6 md:p-8 rounded-[2rem] border border-white/10">
                          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                             <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2"><FileSpreadsheet size={16}/> {t.attendance_report}</h3>
                             <button onClick={()=>exportToCSV(attendanceLogs, 'bao-cao-hoc-tap')} className="px-4 py-2 bg-green-600/20 text-green-400 border border-green-500/20 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-green-600 hover:text-white transition-all"><FileDown size={14}/> {t.export_csv}</button>
                          </div>
                          <div className="overflow-x-auto rounded-xl border border-white/5">
                             <table className="w-full text-left text-[11px] min-w-[600px]"><thead className="bg-white/5 uppercase text-slate-500"><tr className="border-b border-white/10"><th className="p-4">{t.student_name}</th><th className="p-4">{t.login_id}</th><th className="p-4">{t.join_date}</th><th className="p-4">{t.total_duration}</th></tr></thead>
                             <tbody>{attendanceLogs.sort((a,b)=>b.lastSeen - a.lastSeen).map(log => (
                               <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                 <td className="p-4 font-bold text-cyan-400 uppercase">{log.userName}</td><td className="p-4 font-mono opacity-50">{log.userId}</td><td className="p-4">{log.date}</td><td className="p-4 font-black text-white">{Math.round(log.duration / 60)} {t.minutes}</td>
                               </tr>
                             ))}</tbody></table>
                          </div>
                       </div>
                    </div>
                  )}
                  {activeTab === 'bot' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                       <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 space-y-6">
                          <div className="flex items-center justify-between">
                            <div><h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2"><Bot size={16}/> {t.bot_manager}</h3></div>
                            <button onClick={() => { setBotConfig((prev: any) => ({ ...prev, isRunning: !prev.isRunning })); if (!botConfig.isRunning) setUsedBotMessages(new Set()); }} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${botConfig.isRunning ? 'bg-red-600' : 'bg-green-600'}`}>
                              {botConfig.isRunning ? t.stop_bot : t.start_bot}
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            {BOT_CATEGORIES.map(cat => (
                              <button key={cat.id} onClick={() => setBotConfig((prev: any) => ({ ...prev, [cat.id]: !prev[cat.id] }))} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${botConfig[cat.id] ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400' : 'border-white/5 bg-white/5 text-slate-500'}`}>
                                <span className="text-[9px] font-black uppercase">{cat.label}</span>
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                             <select value={newBotMsg.category} onChange={e=>setNewBotMsg(p=>({...p, category: e.target.value}))} className="bg-black/60 border border-white/10 rounded-2xl px-4 text-[10px] font-black uppercase text-cyan-400 outline-none">
                               {BOT_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                             </select>
                             <input value={newBotMsg.text} onChange={e=>setNewBotMsg(p=>({...p, text:e.target.value}))} placeholder={t.new_bot_msg} className="flex-1 bg-black/60 border border-white/10 rounded-2xl px-5 py-4 text-xs outline-none focus:border-cyan-500 font-medium" />
                             <button onClick={async() => { if(!newBotMsg.text) return; await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bot_messages'), newBotMsg); setNewBotMsg(p=>({...p, text: ''})); }} className="px-6 bg-cyan-600 rounded-2xl hover:bg-cyan-500 transition-all shadow-lg active:scale-95"><Plus size={24}/></button>
                          </div>
                          <div className="grid grid-cols-3 gap-4 h-[400px]">
                            {BOT_CATEGORIES.map(cat => (
                              <div key={cat.id} className="bg-black/40 rounded-2xl border border-white/5 flex flex-col overflow-hidden">
                                <div className="p-3 border-b border-white/10 bg-white/5 text-center"><span className="text-[8px] font-black uppercase text-slate-500">{cat.label}</span></div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                                  {botMessages.filter(m => m.category === cat.id).map(bm => (
                                    <div key={bm.id} className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col gap-2 group">
                                      <span className="text-[10px] text-slate-300 font-medium leading-tight">{bm.text}</span>
                                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={()=>handleSendMessage(bm.text)} className="p-1.5 bg-cyan-600/20 text-cyan-400 rounded-lg"><Send size={10}/></button>
                                        <button onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bot_messages', bm.id))} className="p-1.5 bg-red-500/20 text-red-500 rounded-lg"><Trash2 size={10}/></button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                       </div>
                    </div>
                  )}
                  {activeTab === 'users' && (
                    <div className="space-y-6 max-w-5xl mx-auto">
                       <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10">
                          <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-4">{t.add_member}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                             <input value={newUser.id} onChange={e=>setNewUser(p=>({...p, id:e.target.value}))} placeholder="USERNAME" className="bg-black/60 border border-white/10 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-cyan-500 uppercase" />
                             <input value={newUser.pass} onChange={e=>setNewUser(p=>({...p, pass:e.target.value}))} placeholder="PASSWORD" className="bg-black/60 border border-white/10 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-cyan-500" />
                             <input value={newUser.name} onChange={e=>setNewUser(p=>({...p, name:e.target.value}))} placeholder="HỌ TÊN" className="bg-black/60 border border-white/10 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-cyan-500" />
                             <button onClick={async()=>{
                               if(!newUser.id || !newUser.pass) return alert("Vui lòng điền đủ Username/Pass");
                               const normalizedId = newUser.id.toLowerCase();
                               await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', normalizedId), { 
                                 ...newUser, id: normalizedId, displayName: newUser.name || newUser.id, createdAt: Date.now() 
                               });
                               setNewUser({id:'',pass:'',name:'',role:'student'});
                             }} className="bg-cyan-600 rounded-2xl text-[10px] font-black uppercase hover:bg-cyan-500 py-3 shadow-lg transition-all">{t.create_btn}</button>
                          </div>
                       </div>
                       <div className="bg-white/5 rounded-[2rem] border border-white/10 overflow-hidden">
                          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                             <span className="text-[10px] font-black text-slate-500 uppercase">{t.member_list} ({accounts.length})</span>
                          </div>
                          <div className="overflow-x-auto">
                             <table className="w-full text-left text-[11px] min-w-[500px]"><thead className="bg-black/40 uppercase text-slate-500"><tr className="border-b border-white/10"><th className="p-4">{t.account}</th><th className="p-4">{t.password_label}</th><th className="p-4">{t.display_name}</th><th className="p-4">{t.action}</th></tr></thead>
                             <tbody>{accounts.map(acc => (
                               <tr key={acc.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                 <td className="p-4 font-bold uppercase text-white">{acc.id}</td><td className="p-4 font-mono opacity-50">{acc.pass || acc.password}</td><td className="p-4 text-cyan-400 font-bold">{acc.displayName}</td>
                                 <td className="p-4 flex gap-2">
                                    <button onClick={async() => {
                                        const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', acc.id);
                                        await setDoc(sessionRef, { activeId: 'KICKED_BY_ADMIN' }, { merge: true });
                                        alert(t.kick_confirm + acc.id);
                                    }} className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg hover:bg-yellow-500 hover:text-white transition-all"><UserMinus size={14}/></button>
                                    <button onClick={async()=> { if(confirm(t.delete_confirm)) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', acc.id)); }} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14}/></button>
                                 </td>
                               </tr>
                             ))}</tbody></table>
                          </div>
                       </div>
                    </div>
                  )}
              </div>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
        .animate-marquee { animation: marquee 40s linear infinite; }
        @keyframes kenBurns { 0% { transform: scale(1); } 100% { transform: scale(1.2) translate(10px, 10px); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(34, 211, 238, 0.2); border-radius: 10px; }
        * { -webkit-tap-highlight-color: transparent; outline: none; }
      `}} />
    </div>
  );
}
