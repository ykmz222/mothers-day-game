import { useState, useEffect, useRef } from "react";
import * as Tone from "tone";
import {
  Heart, Star, ArrowRight, Camera, Save, Play, Settings,
  Sparkles, Trophy, Home, Upload, X, Check, Eye,
  ChevronLeft, ChevronRight, AlertCircle, HelpCircle,
  RefreshCw, Plus, Image as ImageIcon, GripVertical,
  ArrowLeft as ArrLeft, ArrowRight as ArrRight, Trash2,
  Volume2, VolumeX, MapPin, Download, FileUp
} from "lucide-react";

// ============================================
// DEFAULT CONFIG
// ============================================
const DEFAULT_CONFIG = {
  title: "母の日・7つのもじさがしミッション",
  subtitle: "おかあさんへのプレゼントをみつけよう",
  goal: "たくはいぽすと",
  finalMessage: "プレゼントは「たくはいポスト」にあるよ！",
  questions: [
    { letter: "た", name: "ピアノ",       answers: ["ぴあの","piano","けんばん"], hints: [] },
    { letter: "く", name: "雲梯",         answers: ["うんてい","てつぼう"], hints: [] },
    { letter: "は", name: "もも",         answers: ["もも","ぬいぐるみ"], hints: [] },
    { letter: "い", name: "冷蔵庫",       answers: ["れいぞうこ","やさいしつ","れいとう"], hints: [] },
    { letter: "ぽ", name: "ランドセル",   answers: ["ランドセル","かばん"], hints: [] },
    { letter: "す", name: "本棚",         answers: ["ほんだな","ほん","しょっか"], hints: [] },
    { letter: "と", name: "レゴブロック", answers: ["レゴ","ブロック","レゴブロック"], hints: [] },
  ]
};

// ============================================
// HELPERS
// ============================================
function normalizeJp(str) {
  if (!str) return "";
  let n = String(str).replace(/[\s、。！？・,\.\?!ー\-]/g, "").toLowerCase();
  n = n.replace(/[\u30a1-\u30f6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
  return n;
}

function isCorrect(input, acceptable) {
  const ni = normalizeJp(input);
  if (ni.length < 1) return false;
  return acceptable.some(a => {
    const na = normalizeJp(a);
    if (na.length === 0) return false;
    return ni.includes(na) || na.includes(ni);
  });
}

function compressImage(file, maxW = 720) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function calcScore(hintsUsed) {
  // 1→100, 2→80, 3→60, 4→40, 5→20  (max 100/question, total max 700)
  return Math.max(20, 120 - hintsUsed * 20);
}

// ============================================
// AUDIO (Tone.js)
// ============================================
const audio = {
  initialized: false,
  bgmSynth: null,
  sfxSynth: null,
  bgmLoop: null,
  muted: true,
  bgmVol: -16,
  sfxVol: -6,
};

async function initAudio() {
  if (audio.initialized) return;
  try {
    await Tone.start();
    audio.bgmSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.15, sustain: 0.15, release: 0.4 }
    }).toDestination();
    audio.bgmSynth.volume.value = -100;

    audio.sfxSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.1, release: 0.3 }
    }).toDestination();
    audio.sfxSynth.volume.value = -100;

    // Cheerful 16-step melody loop in C major
    const melody = [
      "C5", "E5", "G5", "E5",
      "C5", "F5", "A5", "F5",
      "D5", "G5", "B5", "G5",
      "C5", "E5", "G5", "C6",
    ];
    let i = 0;
    audio.bgmLoop = new Tone.Loop((time) => {
      audio.bgmSynth.triggerAttackRelease(melody[i % melody.length], "8n", time);
      i++;
    }, "8n").start(0);

    Tone.Transport.bpm.value = 112;
    Tone.Transport.start();

    audio.initialized = true;
  } catch (e) { console.error("Audio init failed", e); }
}

function applyMute(muted) {
  audio.muted = muted;
  if (audio.bgmSynth) audio.bgmSynth.volume.value = muted ? -100 : audio.bgmVol;
  if (audio.sfxSynth) audio.sfxSynth.volume.value = muted ? -100 : audio.sfxVol;
}

function sfxCorrect() {
  if (!audio.sfxSynth || audio.muted) return;
  const t = Tone.now();
  audio.sfxSynth.triggerAttackRelease("C5", "16n", t);
  audio.sfxSynth.triggerAttackRelease("E5", "16n", t + 0.08);
  audio.sfxSynth.triggerAttackRelease("G5", "16n", t + 0.16);
  audio.sfxSynth.triggerAttackRelease("C6", "8n",  t + 0.26);
}
function sfxCard() {
  if (!audio.sfxSynth || audio.muted) return;
  audio.sfxSynth.triggerAttackRelease(["C5","E5","G5","C6"], "4n", Tone.now());
}
function sfxWrong() {
  if (!audio.sfxSynth || audio.muted) return;
  const t = Tone.now();
  audio.sfxSynth.triggerAttackRelease("E4", "16n", t);
  audio.sfxSynth.triggerAttackRelease("D4", "16n", t + 0.13);
}
function sfxComplete() {
  if (!audio.sfxSynth || audio.muted) return;
  const t = Tone.now();
  ["C5","E5","G5","C6"].forEach((n, i) =>
    audio.sfxSynth.triggerAttackRelease(n, "8n", t + i * 0.13)
  );
  audio.sfxSynth.triggerAttackRelease(["C5","E5","G5","C6"], "2n", t + 0.7);
}

// ============================================
// STORAGE ADAPTER (window.storage in Claude / localStorage on GitHub)
// ============================================
const hasWindowStorage = typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function';

const storage = {
  async get(key) {
    if (hasWindowStorage) {
      try { return await window.storage.get(key); } catch (e) {}
    }
    try {
      const v = localStorage.getItem(key);
      return v !== null ? { key, value: v } : null;
    } catch (e) { return null; }
  },
  async set(key, value) {
    if (hasWindowStorage) {
      try { return await window.storage.set(key, value); } catch (e) {}
    }
    try {
      localStorage.setItem(key, value);
      return { key, value };
    } catch (e) {
      console.error('Storage set failed:', e);
      return null;
    }
  }
};

const KEY_META = 'mdth:meta:v4';
const KEY_Q = (i) => `mdth:q:v4:${i}`;

async function saveAll(cfg) {
  await storage.set(KEY_META, JSON.stringify({
    title: cfg.title, subtitle: cfg.subtitle, goal: cfg.goal,
    finalMessage: cfg.finalMessage, count: cfg.questions.length,
  }));
  for (let i = 0; i < cfg.questions.length; i++) {
    await storage.set(KEY_Q(i), JSON.stringify(cfg.questions[i]));
  }
}

async function loadAll() {
  const meta = await storage.get(KEY_META);
  if (!meta?.value) return null;
  const m = JSON.parse(meta.value);
  const questions = [];
  for (let i = 0; i < (m.count || 7); i++) {
    const q = await storage.get(KEY_Q(i));
    if (q?.value) questions.push(JSON.parse(q.value));
  }
  if (questions.length !== (m.count || 7)) return null;
  return { ...m, questions };
}

// Try to fetch ./config.json (used when deployed; user can include their config in repo)
async function tryFetchConfigFile() {
  try {
    const res = await fetch('./config.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.questions)) return data;
    }
  } catch (e) {}
  return null;
}

// ============================================
// MAIN APP
// ============================================
export default function App() {
  const [mode, setMode] = useState('welcome');
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [savingState, setSavingState] = useState('idle');
  const [muted, setMuted] = useState(true);

  const [qIdx, setQIdx] = useState(0);
  const [hintIdx, setHintIdx] = useState(0);
  const [scores, setScores] = useState([]);
  const [hintsUsedPerQ, setHintsUsedPerQ] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [showCard, setShowCard] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [completeCelebrated, setCompleteCelebrated] = useState(false);

  // Inject Google Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&family=Zen+Maru+Gothic:wght@400;500;700;900&display=swap';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch (e) {} };
  }, []);

  // Load config: storage → config.json → DEFAULT
  useEffect(() => {
    (async () => {
      try {
        const stored = await loadAll();
        if (stored) { setConfig(stored); setLoaded(true); return; }
        const fileCfg = await tryFetchConfigFile();
        if (fileCfg) { setConfig(fileCfg); setLoaded(true); return; }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  // Play complete fanfare once
  useEffect(() => {
    if (mode === 'complete' && !completeCelebrated) {
      sfxComplete();
      setCompleteCelebrated(true);
    }
    if (mode !== 'complete') setCompleteCelebrated(false);
  }, [mode, completeCelebrated]);

  const toggleMute = async () => {
    if (!audio.initialized) await initAudio();
    const newMuted = !muted;
    setMuted(newMuted);
    applyMute(newMuted);
  };

  const handleSave = async () => {
    setSavingState('saving');
    try {
      await saveAll(config);
      setSavingState('saved');
      setTimeout(() => setSavingState('idle'), 1500);
    } catch (e) {
      console.error(e);
      setSavingState('error');
      setTimeout(() => setSavingState('idle'), 2000);
    }
  };

  const startGame = () => {
    setQIdx(0); setHintIdx(0); setScores([]); setHintsUsedPerQ([]);
    setUserInput(''); setFeedback(null); setShowCard(false); setRevealed(false);
    setMode('play');
  };

  const handleAnswer = () => {
    if (!userInput.trim()) return;
    // GUARD: prevent double-counting on rapid taps / Enter spam
    if (showCard || revealed || feedback === 'correct') return;
    const q = config.questions[qIdx];
    const list = [q.name, ...(q.answers || [])].filter(Boolean);
    if (isCorrect(userInput, list)) {
      const earned = calcScore(hintIdx + 1);
      setScores(prev => [...prev, earned]);
      setHintsUsedPerQ(prev => [...prev, hintIdx + 1]);
      setFeedback('correct');
      sfxCorrect();
      setTimeout(() => { setShowCard(true); sfxCard(); }, 700);
    } else {
      setFeedback('wrong');
      sfxWrong();
      setTimeout(() => setFeedback(null), 1400);
    }
  };

  const handleNextHint = () => {
    const total = config.questions[qIdx].hints?.length || 0;
    if (hintIdx < total - 1) setHintIdx(hintIdx + 1);
  };

  const handleGiveUp = () => {
    if (showCard || revealed) return;
    setRevealed(true);
    setScores(prev => [...prev, 0]);
    setHintsUsedPerQ(prev => [...prev, (config.questions[qIdx].hints?.length || 5)]);
  };

  const handleNextQuestion = () => {
    setShowCard(false); setRevealed(false); setUserInput(''); setFeedback(null);
    if (qIdx < config.questions.length - 1) {
      setQIdx(qIdx + 1); setHintIdx(0);
    } else {
      setMode('complete');
    }
  };

  const bgStyle = {
    background: 'linear-gradient(135deg, #ffe9ec 0%, #fff4d6 50%, #ffe1f0 100%)',
    fontFamily: '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif',
    minHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
  };

  if (!loaded) {
    return (
      <div style={bgStyle} className="flex items-center justify-center">
        <div className="text-pink-400 text-lg">よみこみちゅう...</div>
      </div>
    );
  }

  return (
    <div style={bgStyle}>
      <DecorativeBg />
      <MuteButton muted={muted} onToggle={toggleMute} />

      {mode === 'welcome' && (
        <Welcome
          config={config}
          onPlay={startGame}
          onSetup={() => setMode('setup')}
          ready={config.questions.every(q => (q.hints?.length || 0) > 0)}
        />
      )}
      {mode === 'setup' && (
        <Setup
          config={config} setConfig={setConfig}
          onBack={() => setMode('welcome')}
          onSave={handleSave} savingState={savingState}
          onPreview={startGame}
        />
      )}
      {mode === 'play' && (
        <Playing
          config={config} qIdx={qIdx} hintIdx={hintIdx} scores={scores}
          userInput={userInput} setUserInput={setUserInput}
          feedback={feedback} showCard={showCard} revealed={revealed}
          onAnswer={handleAnswer} onNextHint={handleNextHint}
          onGiveUp={handleGiveUp} onNextQuestion={handleNextQuestion}
          onExit={() => setMode('welcome')}
        />
      )}
      {mode === 'complete' && (
        <Complete
          config={config} scores={scores} hintsUsedPerQ={hintsUsedPerQ}
          onHome={() => setMode('welcome')} onReplay={startGame}
        />
      )}
    </div>
  );
}

// ============================================
// MUTE BUTTON (fixed top right)
// ============================================
function MuteButton({ muted, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="fixed top-3 right-3 z-50 bg-white/90 backdrop-blur shadow-md hover:bg-white rounded-full w-11 h-11 flex items-center justify-center text-rose-600 border-2 border-rose-200 transition"
      title={muted ? "音をだす" : "音をけす"}
    >
      {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
    </button>
  );
}

// ============================================
// DECORATIVE BG
// ============================================
function DecorativeBg() {
  const items = [
    { top: '5%', left: '8%', size: 24, rot: -15, color: '#f9a8d4' },
    { top: '12%', right: '10%', size: 18, rot: 20, color: '#fcd34d' },
    { top: '40%', left: '4%', size: 16, rot: 35, color: '#fbcfe8' },
    { top: '70%', right: '6%', size: 22, rot: -25, color: '#fda4af' },
    { bottom: '8%', left: '12%', size: 20, rot: 15, color: '#fde68a' },
    { bottom: '20%', right: '15%', size: 28, rot: -10, color: '#f9a8d4' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {items.map((it, i) => (
        <Heart key={i} size={it.size} fill={it.color} stroke="none"
          style={{ position: 'absolute', ...it, transform: `rotate(${it.rot}deg)`, opacity: 0.55 }}
        />
      ))}
    </div>
  );
}

// ============================================
// WELCOME
// ============================================
function Welcome({ config, onPlay, onSetup, ready }) {
  return (
    <div className="relative z-10 max-w-2xl mx-auto px-6 py-12 flex flex-col items-center min-h-screen justify-center">
      <div className="text-center mb-2">
        <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur px-4 py-1.5 rounded-full text-sm text-rose-500" style={{ fontFamily: '"Klee One", serif' }}>
          <Heart size={14} fill="#f43f5e" stroke="none" />
          <span>5月の母の日に</span>
          <Heart size={14} fill="#f43f5e" stroke="none" />
        </div>
      </div>

      <h1 className="text-center font-black mt-6 mb-3 leading-tight"
        style={{
          fontSize: 'clamp(2rem, 7vw, 3.5rem)',
          color: '#9d174d',
          fontFamily: '"Klee One", "Zen Maru Gothic", serif',
          textShadow: '3px 3px 0 #fef3c7',
        }}>
        {config.title}
      </h1>
      <p className="text-center text-rose-700/70 mb-12 text-lg">{config.subtitle}</p>

      <div className="flex flex-wrap justify-center gap-3 mb-12">
        {config.questions.map((q, i) => (
          <div key={i}
            className="relative bg-white rounded-2xl shadow-md w-14 h-16 flex items-center justify-center"
            style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (3 + (i % 3))}deg)`, border: '2px solid #fbcfe8' }}>
            <span className="text-3xl font-bold text-rose-500" style={{ fontFamily: '"Klee One", serif' }}>?</span>
          </div>
        ))}
      </div>

      <div className="w-full flex flex-col gap-4 max-w-sm">
        <button onClick={onPlay} disabled={!ready}
          className="relative group disabled:opacity-50 disabled:cursor-not-allowed">
          <div className="absolute inset-0 bg-rose-300 rounded-3xl translate-x-1.5 translate-y-1.5"></div>
          <div className="relative bg-gradient-to-br from-rose-400 to-pink-500 text-white py-5 px-8 rounded-3xl text-2xl font-bold flex items-center justify-center gap-3 group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-transform">
            <Play size={28} fill="white" stroke="none" />
            <span>ゲームをはじめる</span>
          </div>
        </button>

        {!ready && (
          <p className="text-sm text-rose-500 text-center -mt-2">
            <AlertCircle size={14} className="inline mb-0.5 mr-1" />
            まず「せってい」で写真をいれてね
          </p>
        )}

        <button onClick={onSetup}
          className="bg-white/80 backdrop-blur hover:bg-white text-rose-700 py-3 px-6 rounded-2xl text-base font-medium flex items-center justify-center gap-2 border-2 border-rose-200 transition">
          <Settings size={18} />
          <span>せってい（おとなのひと）</span>
        </button>
      </div>

      <div className="mt-10 text-xs text-rose-400/70 text-center" style={{ fontFamily: '"Klee One", serif' }}>
        ヒント1まいで100てん・5まいで20てん（最大700てん）
      </div>
    </div>
  );
}

// ============================================
// SETUP
// ============================================
function Setup({ config, setConfig, onBack, onSave, savingState, onPreview }) {
  const fileInputRef = useRef(null);

  const updateQuestion = (idx, patch) => {
    setConfig(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === idx ? { ...q, ...patch } : q)
    }));
  };

  const totalPhotos = config.questions.reduce((s, q) => s + (q.hints?.length || 0), 0);
  const allReady = config.questions.every(q => (q.hints?.length || 0) > 0);

  const handleExport = () => {
    const data = JSON.stringify(config, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data && Array.isArray(data.questions)) {
          setConfig(data);
          alert('読み込みました！');
        } else {
          alert('JSONの形式が違うようです');
        }
      } catch (err) {
        alert('読み込みに失敗しました: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 pb-32">
      <div className="flex items-center justify-between mb-6 mr-12">
        <button onClick={onBack} className="flex items-center gap-1.5 text-rose-700 hover:text-rose-500 font-medium">
          <ChevronLeft size={20} />
          <span>もどる</span>
        </button>
        <h2 className="text-xl font-bold text-rose-900" style={{ fontFamily: '"Klee One", serif' }}>せってい</h2>
        <div className="text-sm text-rose-500 font-medium">{totalPhotos}/35まい</div>
      </div>

      {/* Basic settings */}
      <div className="bg-white/90 backdrop-blur rounded-3xl p-5 mb-4 shadow-sm border-2 border-rose-100">
        <h3 className="font-bold text-rose-900 mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" />
          ゲームの基本せってい
        </h3>
        <div className="space-y-3">
          <Field label="タイトル">
            <input value={config.title}
              onChange={e => setConfig({ ...config, title: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-rose-200 focus:outline-none focus:border-rose-400 bg-white" />
          </Field>
          <Field label="サブタイトル">
            <input value={config.subtitle}
              onChange={e => setConfig({ ...config, subtitle: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-rose-200 focus:outline-none focus:border-rose-400 bg-white" />
          </Field>
          <Field label="ゴールの言葉(7文字)">
            <input value={config.goal}
              onChange={e => setConfig({ ...config, goal: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-rose-200 focus:outline-none focus:border-rose-400 bg-white" />
          </Field>
          <Field label="さいごのメッセージ">
            <input value={config.finalMessage}
              onChange={e => setConfig({ ...config, finalMessage: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-rose-200 focus:outline-none focus:border-rose-400 bg-white" />
          </Field>
        </div>
      </div>

      {/* Export / Import */}
      <div className="bg-white/90 backdrop-blur rounded-3xl p-4 mb-6 shadow-sm border-2 border-rose-100">
        <h3 className="font-bold text-rose-900 mb-2 flex items-center gap-2 text-sm">
          <FileUp size={14} />
          設定ファイル（GitHubデプロイ用）
        </h3>
        <p className="text-xs text-rose-500 mb-3 leading-relaxed">
          設定を <code className="bg-rose-50 px-1 rounded">config.json</code> としてダウンロード →
          GitHubリポジトリの <code className="bg-rose-50 px-1 rounded">public/</code> 等に置けば、
          全員が同じ初期画像で遊べます。
        </p>
        <div className="flex gap-2">
          <button onClick={handleExport}
            className="flex-1 bg-rose-100 hover:bg-rose-200 text-rose-700 py-2 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 border border-rose-200">
            <Download size={14} />
            <span>JSONダウンロード</span>
          </button>
          <button onClick={handleImportClick}
            className="flex-1 bg-rose-100 hover:bg-rose-200 text-rose-700 py-2 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 border border-rose-200">
            <Upload size={14} />
            <span>JSONからよみこみ</span>
          </button>
          <input ref={fileInputRef} type="file" accept="application/json,.json"
            onChange={handleImportFile} className="hidden" />
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {config.questions.map((q, i) => (
          <QuestionEditor key={i} idx={i} question={q}
            onUpdate={(patch) => updateQuestion(i, patch)} />
        ))}
      </div>

      {/* Sticky save */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t-2 border-rose-100 px-4 py-3 z-20">
        <div className="max-w-3xl mx-auto flex gap-3">
          <button onClick={onSave} disabled={savingState === 'saving'}
            className="flex-1 bg-gradient-to-br from-rose-400 to-pink-500 text-white py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md disabled:opacity-60">
            {savingState === 'saving' && <RefreshCw size={18} className="animate-spin" />}
            {savingState === 'saved' && <Check size={18} />}
            {savingState === 'idle' && <Save size={18} />}
            {savingState === 'error' && <AlertCircle size={18} />}
            <span>
              {savingState === 'saving' && 'ほぞん中...'}
              {savingState === 'saved' && 'ほぞんしました!'}
              {savingState === 'idle' && 'ほぞんする'}
              {savingState === 'error' && 'エラー'}
            </span>
          </button>
          <button onClick={onPreview} disabled={!allReady}
            className="bg-amber-300 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-amber-900 py-3 px-4 rounded-2xl font-bold flex items-center gap-2 border-2 border-amber-400">
            <Eye size={18} />
            <span>ためす</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-rose-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

// ============================================
// QUESTION EDITOR
// ============================================
function QuestionEditor({ idx, question, onUpdate }) {
  const [open, setOpen] = useState(false);

  const updateAnswer = (i, value) => {
    const newAnswers = [...(question.answers || [])];
    newAnswers[i] = value;
    onUpdate({ answers: newAnswers });
  };
  const addAnswer = () => onUpdate({ answers: [...(question.answers || []), ''] });
  const removeAnswer = (i) => onUpdate({ answers: (question.answers || []).filter((_, j) => j !== i) });

  const photoCount = question.hints?.length || 0;
  const ready = photoCount > 0;

  return (
    <div className="bg-white/90 backdrop-blur rounded-3xl shadow-sm border-2 border-rose-100 overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 hover:bg-rose-50/50 transition">
        <div className="bg-gradient-to-br from-rose-300 to-pink-400 text-white w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl flex-shrink-0 shadow-sm" style={{ fontFamily: '"Klee One", serif' }}>
          {question.letter || '?'}
        </div>
        <div className="flex-1 text-left">
          <div className="text-xs text-rose-500 font-medium">第{idx + 1}もん</div>
          <div className="font-bold text-rose-900">{question.name || '(未設定)'}</div>
        </div>
        <div className={`text-xs px-2 py-1 rounded-full font-medium ${ready ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {ready ? `しゃしん${photoCount}/5まい` : 'しゃしん未'}
        </div>
        <ChevronRight size={20} className={`text-rose-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="p-5 pt-0 space-y-4 border-t-2 border-rose-50">
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Field label="文字カード">
              <input value={question.letter}
                onChange={e => onUpdate({ letter: e.target.value })}
                maxLength={2}
                className="w-full px-3 py-2 rounded-xl border border-rose-200 focus:outline-none focus:border-rose-400 bg-white text-center text-2xl font-bold"
                style={{ fontFamily: '"Klee One", serif' }} />
            </Field>
            <Field label="ばしょの名前">
              <input value={question.name}
                onChange={e => onUpdate({ name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-rose-200 focus:outline-none focus:border-rose-400 bg-white" />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-rose-700">○にするこたえ（だいたい合えばOK）</span>
              <button onClick={addAnswer} className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1">
                <Plus size={12} /> ふやす
              </button>
            </div>
            <div className="space-y-1.5">
              {(question.answers || []).map((a, i) => (
                <div key={i} className="flex gap-2">
                  <input value={a} onChange={e => updateAnswer(i, e.target.value)}
                    placeholder="例: ぴあの"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-rose-200 focus:outline-none focus:border-rose-400 bg-white text-sm" />
                  <button onClick={() => removeAnswer(i)} className="text-rose-300 hover:text-rose-500 px-1">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <PhotoSection
            hints={question.hints || []}
            onUpdate={(hints) => onUpdate({ hints })}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// PHOTO SECTION (bulk upload + reorder)
// ============================================
function PhotoSection({ hints, onUpdate }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleBulkUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    const compressed = [];
    for (const f of files) {
      try { compressed.push(await compressImage(f)); }
      catch (err) { console.error('Compress failed', err); }
    }
    const newHints = [...hints, ...compressed].slice(0, 5);
    onUpdate(newHints);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const moveLeft = (i) => {
    if (i <= 0) return;
    const newHints = [...hints];
    [newHints[i - 1], newHints[i]] = [newHints[i], newHints[i - 1]];
    onUpdate(newHints);
  };
  const moveRight = (i) => {
    if (i >= hints.length - 1) return;
    const newHints = [...hints];
    [newHints[i + 1], newHints[i]] = [newHints[i], newHints[i + 1]];
    onUpdate(newHints);
  };
  const removePhoto = (i) => onUpdate(hints.filter((_, j) => j !== i));

  const handleDragStart = (i) => setDragIdx(i);
  const handleDragOver = (e, i) => { e.preventDefault(); if (i !== dragOverIdx) setDragOverIdx(i); };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };
  const handleDrop = (e, target) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === target) { handleDragEnd(); return; }
    const newHints = [...hints];
    const [moved] = newHints.splice(dragIdx, 1);
    newHints.splice(target, 0, moved);
    onUpdate(newHints);
    handleDragEnd();
  };

  const slotsRemaining = 5 - hints.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-rose-700">
          ヒント写真（1まいめ→だんだんわかりやすく）
        </span>
        <span className="text-[10px] text-rose-400">{hints.length}/5</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
        {Array.from({ length: 5 }).map((_, slot) => {
          const photo = hints[slot];
          if (photo) {
            const isDragging = dragIdx === slot;
            const isDragOver = dragOverIdx === slot && dragIdx !== slot;
            return (
              <div key={slot} className={`flex flex-col gap-1 ${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'scale-105' : ''} transition-all`}>
                <div
                  draggable
                  onDragStart={() => handleDragStart(slot)}
                  onDragOver={(e) => handleDragOver(e, slot)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, slot)}
                  className="relative aspect-square rounded-xl overflow-hidden border-2 border-rose-200 shadow-sm bg-white cursor-move"
                >
                  <img src={photo} alt={`ヒント${slot + 1}`} className="w-full h-full object-cover pointer-events-none" />
                  <div className="absolute top-1 left-1 bg-white/95 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-rose-600 shadow">
                    {slot + 1}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => moveLeft(slot)} disabled={slot === 0}
                    className="flex-1 h-9 bg-rose-50 active:bg-rose-200 disabled:opacity-30 rounded-lg text-rose-700 flex items-center justify-center border border-rose-200">
                    <ArrLeft size={16} />
                  </button>
                  <button onClick={() => removePhoto(slot)}
                    className="flex-1 h-9 bg-rose-50 active:bg-rose-200 rounded-lg text-rose-700 flex items-center justify-center border border-rose-200">
                    <Trash2 size={14} />
                  </button>
                  <button onClick={() => moveRight(slot)} disabled={slot === hints.length - 1}
                    className="flex-1 h-9 bg-rose-50 active:bg-rose-200 disabled:opacity-30 rounded-lg text-rose-700 flex items-center justify-center border border-rose-200">
                    <ArrRight size={16} />
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div key={slot} className="flex flex-col gap-1">
              <div
                onDragOver={(e) => handleDragOver(e, slot)}
                onDrop={(e) => handleDrop(e, slot)}
                className={`aspect-square rounded-xl border-2 border-dashed border-rose-200 bg-rose-50/40 flex flex-col items-center justify-center text-rose-300 ${dragOverIdx === slot ? 'border-rose-400 bg-rose-100/60' : ''}`}>
                <ImageIcon size={20} />
                <span className="text-[10px] mt-1">{slot + 1}まいめ</span>
              </div>
              <div className="h-9"></div>
            </div>
          );
        })}
      </div>

      {slotsRemaining > 0 ? (
        <label className="block">
          <input ref={fileRef} type="file" accept="image/*" multiple
            onChange={handleBulkUpload} className="hidden" disabled={uploading} />
          <div className={`w-full py-3 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 cursor-pointer transition ${
            uploading ? 'bg-rose-100 border-rose-300 text-rose-400'
                     : 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-700'
          }`}>
            {uploading ? <RefreshCw size={18} className="animate-spin" /> : <Upload size={18} />}
            <span className="text-sm font-bold">
              {uploading ? '読みこみ中...' : `写真をまとめてアップロード（あと${slotsRemaining}まい）`}
            </span>
          </div>
        </label>
      ) : (
        <div className="w-full py-2.5 rounded-2xl bg-green-50 border-2 border-green-200 flex items-center justify-center gap-2 text-green-700">
          <Check size={16} />
          <span className="text-sm font-bold">5まい全部そろいました</span>
        </div>
      )}

      <p className="text-[10px] text-rose-400 mt-2">
        💡 サムネをドラッグ、または⬅➡ボタンで順番をかえられます
      </p>
    </div>
  );
}

// ============================================
// PLAYING
// ============================================
function Playing({
  config, qIdx, hintIdx, scores, userInput, setUserInput,
  feedback, showCard, revealed, onAnswer, onNextHint,
  onGiveUp, onNextQuestion, onExit
}) {
  const q = config.questions[qIdx];
  const totalHints = q.hints?.length || 0;
  const currentPhoto = q.hints?.[hintIdx];
  const totalScore = scores.reduce((a, b) => a + b, 0);
  const moreHints = hintIdx < totalHints - 1;

  return (
    <div className="relative z-10 max-w-2xl mx-auto px-4 py-4 min-h-screen flex flex-col">
      <div className="flex items-center gap-3 mb-3 mr-12">
        <button onClick={onExit} className="text-rose-400 hover:text-rose-600 p-1">
          <X size={20} />
        </button>
        <div className="flex-1 flex justify-center gap-1.5">
          {config.questions.map((_, i) => {
            const got = i < scores.length;
            return (
              <div key={i}
                className={`flex-1 h-2 rounded-full ${
                  got ? 'bg-gradient-to-r from-rose-400 to-pink-500' : i === qIdx ? 'bg-rose-200' : 'bg-rose-100/60'
                }`} />
            );
          })}
        </div>
        <div className="text-sm font-bold text-rose-600 bg-white/80 backdrop-blur px-2.5 py-1 rounded-full">
          {totalScore}<span className="text-xs ml-0.5">てん</span>
        </div>
      </div>

      <div className="flex justify-center gap-1.5 mb-4">
        {config.questions.map((qq, i) => (
          <div key={i}
            className={`w-9 h-10 rounded-xl flex items-center justify-center text-lg font-bold border-2 ${
              i < scores.length
                ? 'bg-gradient-to-br from-amber-200 to-yellow-300 text-amber-900 border-amber-400 shadow-sm'
                : 'bg-white/40 text-rose-200 border-rose-100 border-dashed'
            }`}
            style={{
              fontFamily: '"Klee One", serif',
              transform: i < scores.length ? `rotate(${(i % 2 === 0 ? -1 : 1) * 4}deg)` : 'none',
            }}>
            {i < scores.length ? '✓' : '?'}
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col">
        <div className="text-center mb-3">
          <div className="inline-flex items-center gap-2 bg-rose-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow">
            <Sparkles size={14} />
            <span>第{qIdx + 1}もん</span>
            <span className="opacity-75">/ {config.questions.length}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-lg p-4 border-2 border-rose-100 mb-4 relative overflow-hidden">
          {currentPhoto ? (
            <div className="rounded-2xl overflow-hidden bg-rose-50 mb-3 aspect-[4/3] flex items-center justify-center">
              <img src={currentPhoto} alt="ヒント" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="rounded-2xl bg-rose-50 mb-3 aspect-[4/3] flex flex-col items-center justify-center text-rose-300">
              <ImageIcon size={48} />
              <span className="text-sm mt-2">写真がまだないよ</span>
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 mb-3">
            <span className="text-xs text-rose-500 font-bold mr-1">ヒント</span>
            {Array.from({ length: totalHints || 5 }).map((_, i) => (
              <div key={i}
                className={`w-2.5 h-2.5 rounded-full ${i <= hintIdx ? 'bg-rose-500' : 'bg-rose-100'}`} />
            ))}
            <span className="text-xs text-rose-500 font-bold ml-1">{hintIdx + 1}/{totalHints}</span>
          </div>

          {/* Reveal (give up) */}
          {revealed && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-center mb-3 animate-bounce-in">
              <div className="text-xs text-amber-700 mb-1">こたえ</div>
              <div className="text-2xl font-bold text-amber-900 mb-3" style={{ fontFamily: '"Klee One", serif' }}>
                {q.name}
              </div>
              <div className="bg-white/70 rounded-xl p-3 flex items-center gap-2 justify-center">
                <MapPin size={18} className="text-rose-500" />
                <div className="text-sm text-rose-700 font-bold leading-tight">
                  {q.name}にいって<br/>
                  ぼくたちがかくしたカードをみつけてきてね！
                </div>
              </div>
            </div>
          )}

          {/* Input area */}
          {!showCard && !revealed && (
            <div className={`transition-all ${feedback === 'wrong' ? 'animate-shake' : ''}`}>
              <div className="flex gap-2 mb-2">
                <input value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && onAnswer()}
                  placeholder="ばしょの名前をいれてね"
                  className="flex-1 px-4 py-3 rounded-2xl border-2 border-rose-200 focus:outline-none focus:border-rose-400 bg-rose-50/50 text-lg" />
                <button onClick={onAnswer} disabled={!userInput.trim()}
                  className="bg-gradient-to-br from-rose-400 to-pink-500 disabled:opacity-50 text-white px-5 rounded-2xl font-bold shadow flex items-center gap-1">
                  <Check size={18} />
                </button>
              </div>
              {feedback === 'wrong' && (
                <div className="text-center text-rose-600 text-sm font-bold animate-pulse">
                  おしい！もういちど かんがえてみよう
                </div>
              )}
            </div>
          )}

          {/* SUCCESS: show physical card location prompt */}
          {showCard && (
            <div className="text-center py-2 animate-bounce-in">
              <div className="text-2xl font-black text-rose-600 mb-3">せいかい！🎉</div>

              {/* Location prompt - the main "go find it" message */}
              <div className="bg-gradient-to-br from-amber-100 to-yellow-100 rounded-2xl p-4 mb-3 border-2 border-amber-300 shadow">
                <div className="flex items-center justify-center gap-1.5 text-amber-700 text-xs font-bold mb-1">
                  <MapPin size={14} />
                  <span>ばしょは…</span>
                </div>
                <div className="text-3xl font-black text-amber-900 mb-3" style={{ fontFamily: '"Klee One", serif' }}>
                  {q.name}
                </div>
                <div className="bg-white/70 rounded-xl px-3 py-2.5">
                  <div className="text-sm text-rose-700 font-bold leading-relaxed">
                    {q.name}にいって<br/>
                    ぼくたちがかくしたカードを<br/>
                    みつけてきてね！🎴
                  </div>
                </div>
              </div>

              <div className="text-rose-600 font-bold text-sm">+{calcScore(hintIdx + 1)}てん</div>
            </div>
          )}
        </div>

        {!showCard && !revealed && (
          <div className="space-y-2">
            <button onClick={onNextHint} disabled={!moreHints}
              className="w-full bg-white hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed text-rose-700 py-3 rounded-2xl font-bold border-2 border-rose-200 flex items-center justify-center gap-2">
              <HelpCircle size={18} />
              <span>つぎのヒントをみる（{Math.max(0, totalHints - hintIdx - 1)}まいのこり）</span>
            </button>
            <button onClick={onGiveUp} className="w-full text-rose-400 hover:text-rose-600 text-sm py-1">
              わからない…こたえをみる
            </button>
          </div>
        )}

        {(showCard || revealed) && (
          <button onClick={onNextQuestion}
            className="w-full bg-gradient-to-br from-rose-400 to-pink-500 text-white py-4 rounded-2xl font-bold text-lg shadow-md flex items-center justify-center gap-2">
            <span>
              {showCard
                ? (qIdx < config.questions.length - 1 ? 'カードを見つけた！つぎへ' : 'カードを見つけた！けっかへ')
                : (qIdx < config.questions.length - 1 ? 'つぎへ' : 'けっかへ')}
            </span>
            <ArrowRight size={22} />
          </button>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        @keyframes bounce-in {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in { animation: bounce-in 0.6s ease-out; }
      `}</style>
    </div>
  );
}

// ============================================
// COMPLETE
// ============================================
function Complete({ config, scores, hintsUsedPerQ, onHome, onReplay }) {
  const total = scores.reduce((a, b) => a + b, 0);
  const max = config.questions.length * 100;  // 7 * 100 = 700
  const perfect = scores.length === config.questions.length && scores.every(s => s === 100);
  const star = total >= max * 0.9 ? 3 : total >= max * 0.6 ? 2 : 1;

  return (
    <div className="relative z-10 max-w-2xl mx-auto px-6 py-10 min-h-screen flex flex-col items-center justify-center text-center">
      <div className="mb-2">
        <Trophy size={48} className="mx-auto text-amber-500" fill="#fcd34d" />
      </div>
      <h1 className="text-5xl font-black mb-2"
        style={{ color: '#9d174d', fontFamily: '"Klee One", serif', textShadow: '3px 3px 0 #fef3c7' }}>
        ぜんぶゲット！
      </h1>
      <p className="text-rose-700 mb-6">7つの文字カードがそろったよ</p>

      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <Star key={s} size={36}
            fill={s <= star ? '#fbbf24' : '#fde68a'}
            stroke={s <= star ? '#d97706' : '#fcd34d'} strokeWidth={2} />
        ))}
      </div>

      <div className="bg-white/90 backdrop-blur rounded-3xl shadow-lg p-5 mb-6 border-2 border-rose-100 w-full max-w-md">
        <div className="text-xs text-rose-500 font-bold mb-3">あつめた7まいのカード</div>
        <div className="flex justify-center gap-1.5 flex-wrap">
          {config.questions.map((q, i) => (
            <div key={i}
              className="bg-gradient-to-br from-amber-200 to-yellow-300 rounded-2xl shadow border-3 border-amber-400 w-12 h-14 flex items-center justify-center"
              style={{
                transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (3 + (i % 3))}deg)`,
                fontFamily: '"Klee One", serif',
              }}>
              <span className="text-3xl">🎴</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-rose-400 to-pink-500 text-white rounded-3xl shadow-lg p-5 mb-6 w-full max-w-md">
        <Sparkles size={24} className="mx-auto mb-2 text-yellow-200" />
        <div className="font-bold text-lg leading-relaxed">
          あつめた7まいのカードを<br/>
          ならべてみよう！<br/>
          <span className="text-yellow-100 text-base">プレゼントの ばしょが わかるよ 🎁</span>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur rounded-2xl p-4 mb-6 w-full max-w-md">
        <div className="flex justify-between items-baseline">
          <span className="text-rose-700 font-medium">スコア</span>
          <span>
            <span className="text-3xl font-black text-rose-600">{total}</span>
            <span className="text-rose-400 ml-1">/ {max}てん</span>
          </span>
        </div>
        {perfect && (
          <div className="text-xs text-amber-600 font-bold mt-2 flex items-center gap-1 justify-center">
            <Sparkles size={12} />
            パーフェクト！1まいのヒントだけで全問せいかい！
          </div>
        )}
      </div>

      <div className="flex gap-3 w-full max-w-md">
        <button onClick={onReplay}
          className="flex-1 bg-amber-300 hover:bg-amber-400 text-amber-900 py-3 rounded-2xl font-bold border-2 border-amber-400 flex items-center justify-center gap-2">
          <RefreshCw size={18} />
          <span>もういちど</span>
        </button>
        <button onClick={onHome}
          className="flex-1 bg-white hover:bg-rose-50 text-rose-700 py-3 rounded-2xl font-bold border-2 border-rose-200 flex items-center justify-center gap-2">
          <Home size={18} />
          <span>ホーム</span>
        </button>
      </div>
    </div>
  );
}
