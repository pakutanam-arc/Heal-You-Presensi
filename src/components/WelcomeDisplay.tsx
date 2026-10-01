import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAppContext } from '../store';
import { Participant } from '../types';
import { HealYouLogo } from './HealYouLogo';
import {
  Maximize2, Minimize2, Volume2, VolumeX, Calendar, MapPin, Clock,
  CheckCircle2, X, Wind, Eye, Camera, CameraOff, SwitchCamera, QrCode,
  AlertCircle, Heart, Leaf, Flower2, RotateCcw, Sparkles, Gift, Shuffle,
  MessageSquareHeart, Award,
} from 'lucide-react';

/* ==============================================================================
   1. KONSTANTA & PENGATURAN
   ============================================================================== */
const RETREAT_BG_IMAGE = '/src/assets/images/healing_retreat_meadow_1790765180863.jpg';

const HEALING_AFFIRMATIONS = [
  'Anda tidak perlu terburu-buru. Di ruangan ini, setiap perasaan dan perjalanan Anda dihargai.',
  'Terima kasih telah meluangkan waktu untuk hadir dan merawat ruang batin Anda hari ini.',
  'Setiap langkah kecil untuk memahami diri sendiri adalah awal dari ketenangan yang sesungguhnya.',
  'Izinkan diri Anda beristirahat sejenak dari hiruk-pikuk, tarik napas perlahan, dan hadir sepenuhnya.',
];

const MINDFUL_SHARING_PROMPTS = [
  'Satu hal kecil apa yang paling ingin Anda syukuri dari perjalanan diri Anda minggu ini?',
  'Beban pikiran atau ekspektasi apa yang paling ingin Anda lepaskan agar hati terasa lebih lega?',
  'Apa satu kalimat penguatan yang ingin Anda sampaikan kepada diri Anda sendiri saat ini?',
  'Momen sederhana apa yang akhir-akhir ini berhasil menghadirkan senyum dan ketenangan di hati Anda?',
  'Hal baik apa yang Anda pelajari tentang kekuatan diri Anda setelah melewati masa sulit?',
];

function formatSafeDate(dateStr: string) {
  try {
    const parsed = dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T00:00:00`);
    if (isNaN(parsed.getTime())) return dateStr;
    return format(parsed, 'dd MMMM yyyy');
  } catch {
    return dateStr;
  }
}

/* ==============================================================================
   2. SINGLETON AUDIO SERVICE (Mencegah Memory Leak & Limitasi Browser)
   ============================================================================== */
const audioService = {
  ctx: null as AudioContext | null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  playTick(step = 0) {
    const ctx = this.init();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const freq = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99][step % 6];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.03, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) { /* Abaikan error */ }
  },
  playReveal() {
    const ctx = this.init();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [392.0, 493.88, 587.33, 783.99, 987.77];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.0001, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.055, now + idx * 0.09 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 2.0);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 2.1);
      });
    } catch (e) { /* Abaikan error */ }
  },
  playChime(type: 'welcome' | 'notice' = 'welcome') {
    const ctx = this.init();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      if (type === 'welcome') {
        const freqs = [349.23, 440.0, 523.25, 659.25];
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + idx * 0.11);
          gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
          gain.gain.exponentialRampToValueAtTime(0.045, now + idx * 0.11 + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 2.1);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.11);
          osc.stop(now + idx * 0.11 + 2.2);
        });
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(329.63, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.035, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.55);
      }
    } catch (e) { /* Abaikan error */ }
  }
};

/* ==============================================================================
   3. CUSTOM HOOKS (Pemisahan Logika Bisnis & Timer)
   ============================================================================== */
function useLiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return time;
}

function useHealingAffirmations(intervalMs = 12000) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIdx((p) => (p + 1) % HEALING_AFFIRMATIONS.length), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return HEALING_AFFIRMATIONS[idx];
}

function useBreathingCycle() {
  const [phase, setPhase] = useState<'INHALE' | 'HOLD' | 'EXHALE'>('EXHALE');
  useEffect(() => {
    let t1: number, t2: number;
    const runCycle = () => {
      setPhase('INHALE');
      t1 = window.setTimeout(() => setPhase('HOLD'), 4000);
      t2 = window.setTimeout(() => setPhase('EXHALE'), 8000);
    };
    runCycle();
    const interval = setInterval(runCycle, 14000);
    return () => { clearInterval(interval); clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return phase;
}

/* ==============================================================================
   4. KOMPONEN PRESENTASIONAL (SVGs & Cards)
   ============================================================================== */
const LotusIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 4C9.5 7.5 9 11.5 12 16C15 11.5 14.5 7.5 12 4Z" />
    <path d="M12 16C8.5 14.5 5.5 11.5 5 7.5C8 8.5 10.2 10.5 12 16Z" />
    <path d="M12 16C15.5 14.5 18.5 11.5 19 7.5C16 8.5 13.8 10.5 12 16Z" />
    <path d="M12 16C7.5 16.5 4 15 2.5 12C5.5 12 8.5 13.5 12 16Z" />
    <path d="M12 16C16.5 16.5 20 15 21.5 12C18.5 12 15.5 13.5 12 16Z" />
    <path d="M7 19H17" />
  </svg>
);

const TopLeftBotanicalSprig = () => (
  <svg viewBox="0 0 220 220" fill="none" className="pointer-events-none absolute top-3 left-3 w-32 h-32 sm:w-44 sm:h-44 opacity-85">
    <path d="M12 185 C35 135, 78 85, 145 32" stroke="#7D8C6E" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M42 135 C75 128, 108 112, 138 92" stroke="#8B9A7B" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M55 110 C52 78, 65 52, 85 26" stroke="#8B9A7B" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M35 145 C22 132, 26 114, 42 122 C44 132, 40 140, 35 145 Z" fill="#9CAF88" opacity="0.75" />
    <path d="M72 102 C86 108, 102 98, 92 86 C82 88, 76 95, 72 102 Z" fill="#8FA67E" opacity="0.7" />
    <path d="M98 68 C86 56, 92 40, 106 48 C108 56, 103 63, 98 68 Z" fill="#9CAF88" opacity="0.75" />
    <g transform="translate(132, 22)">
      <ellipse cx="0" cy="-10" rx="7" ry="12" fill="#E8A4C4" opacity="0.8" transform="rotate(-15)" />
      <ellipse cx="10" cy="-3" rx="7" ry="12" fill="#D59BE0" opacity="0.75" transform="rotate(35)" />
      <ellipse cx="-9" cy="-2" rx="6" ry="11" fill="#F2B8D2" opacity="0.8" transform="rotate(-55)" />
      <circle cx="0" cy="0" r="3.5" fill="#F7D794" />
    </g>
    <g transform="translate(82, 28)">
      <ellipse cx="0" cy="-8" rx="6" ry="10" fill="#D8A1E8" opacity="0.75" transform="rotate(-10)" />
      <ellipse cx="8" cy="-2" rx="6" ry="10" fill="#EAA8C8" opacity="0.8" transform="rotate(40)" />
      <ellipse cx="-7" cy="-2" rx="5" ry="9" fill="#E3B5F2" opacity="0.75" transform="rotate(-45)" />
      <circle cx="0" cy="0" r="2.8" fill="#F5CD79" />
    </g>
    <g transform="translate(132, 90)">
      <ellipse cx="0" cy="-8" rx="6" ry="10" fill="#E6A2C5" opacity="0.8" transform="rotate(15)" />
      <ellipse cx="8" cy="0" rx="6" ry="10" fill="#C996E3" opacity="0.75" transform="rotate(65)" />
      <ellipse cx="-6" cy="-4" rx="5" ry="9" fill="#F0BAD5" opacity="0.75" transform="rotate(-30)" />
      <circle cx="0" cy="0" r="2.8" fill="#F7D794" />
    </g>
  </svg>
);

const BottomRightBotanicalSprig = () => (
  <svg viewBox="0 0 220 220" fill="none" className="pointer-events-none absolute bottom-2 right-2 w-36 h-36 sm:w-48 sm:h-48 opacity-90">
    <path d="M195 205 C175 155, 155 105, 138 45" stroke="#7D8C6E" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M185 208 C150 175, 115 150, 72 135" stroke="#8B9A7B" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M198 195 C188 145, 185 95, 178 55" stroke="#7D8C6E" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M155 165 C140 152, 145 136, 160 144 C162 152, 158 160, 155 165 Z" fill="#8FA67E" opacity="0.75" />
    <path d="M125 160 C115 172, 98 166, 108 152 C115 152, 121 156, 125 160 Z" fill="#9CAF88" opacity="0.75" />
    {[55, 72, 90, 108].map((y, i) => (
      <g key={i} transform={`translate(${138 + i * 7}, ${y})`}>
        <ellipse cx="-5" cy="0" rx="4.5" ry="7" fill="#B88BE8" opacity="0.85" transform="rotate(-30)" />
        <ellipse cx="5" cy="2" rx="4.5" ry="7" fill="#9D71D6" opacity="0.85" transform="rotate(30)" />
        <ellipse cx="0" cy="-4" rx="4" ry="6.5" fill="#D2A6F7" opacity="0.85" />
      </g>
    ))}
    {[65, 84, 104, 124].map((y, i) => (
      <g key={i} transform={`translate(${178 + i * 3}, ${y})`}>
        <ellipse cx="-4" cy="0" rx="4" ry="6.5" fill="#C994EE" opacity="0.85" transform="rotate(-25)" />
        <ellipse cx="4" cy="2" rx="4" ry="6.5" fill="#A97CE0" opacity="0.85" transform="rotate(25)" />
      </g>
    ))}
    <g transform="translate(86, 140)">
      <ellipse cx="0" cy="-9" rx="6" ry="10" fill="#E6A2C5" opacity="0.85" transform="rotate(-15)" />
      <ellipse cx="8" cy="-2" rx="6" ry="10" fill="#C58EE6" opacity="0.85" transform="rotate(35)" />
      <ellipse cx="-8" cy="-1" rx="6" ry="10" fill="#F0B6D2" opacity="0.85" transform="rotate(-55)" />
      <circle cx="0" cy="0" r="3" fill="#F7D794" />
    </g>
    <g transform="translate(122, 175)">
      <ellipse cx="0" cy="-8" rx="5.5" ry="9" fill="#D295E8" opacity="0.85" transform="rotate(10)" />
      <ellipse cx="7" cy="-1" rx="5.5" ry="9" fill="#E8A2C6" opacity="0.85" transform="rotate(55)" />
      <ellipse cx="-6" cy="-2" rx="5.5" ry="9" fill="#C084E0" opacity="0.85" transform="rotate(-40)" />
      <circle cx="0" cy="0" r="2.5" fill="#F7D794" />
    </g>
  </svg>
);

const BreathingGuideCard = () => {
  const breathPhase = useBreathingCycle();
  return (
    <div className="bg-white/90 backdrop-blur-md rounded-[26px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center justify-center text-center flex-1 border border-white/60">
      <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.14em] uppercase text-[#583B92]">JEDA RELAKSASI SEJENAK</span>
      <h3 className="text-xl sm:text-2xl font-bold text-[#22153B] mt-0.5" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
        Napas Kesadaran Penuh
      </h3>
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 my-3.5 flex items-center justify-center">
        <motion.div
          animate={{ scale: breathPhase === 'INHALE' ? 1.08 : breathPhase === 'HOLD' ? 1.08 : 0.94 }}
          transition={{ duration: breathPhase === 'INHALE' ? 4 : breathPhase === 'HOLD' ? 0.6 : 6, ease: 'easeInOut' }}
          className="w-26 h-26 sm:w-28 sm:h-28 rounded-full bg-white border-[7px] border-[#DFC7FA] shadow-[0_4px_20px_rgba(138,100,214,0.12)] flex flex-col items-center justify-center px-2"
        >
          <Wind className="w-4 h-4 text-[#3B2863] mb-0.5" />
          <span className="text-xs font-bold text-[#22153B] leading-tight">
            {breathPhase === 'INHALE' ? 'Tarik Napas...' : breathPhase === 'HOLD' ? 'Tahan Lembut...' : 'Hembuskan...'}
          </span>
          <span className="text-[10px] font-medium text-slate-500 mt-0.5">
            {breathPhase === 'EXHALE' ? '6 detik' : '4 detik'}
          </span>
        </motion.div>
      </div>
      <p className="text-xs text-slate-600 max-w-[230px] leading-relaxed">
        Biarkan bahu Anda rileks dan hadir dengan hati yang tenang.
      </p>
    </div>
  );
};

/* ==============================================================================
   5. KOMPONEN UTAMA (WelcomeDisplay)
   ============================================================================== */
export const WelcomeDisplay: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { participants, config, checkIn } = useAppContext();
  const containerRef = useRef<HTMLDivElement>(null);

  // Global UI States
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showScannerPanel, setShowScannerPanel] = useState(true);
  const [showBreathingGuide, setShowBreathingGuide] = useState(true);
  const [isPickerModeOpen, setIsPickerModeOpen] = useState(false);

  // Spotlight & Scan Status
  const [spotlightParticipant, setSpotlightParticipant] = useState<Participant | null>(null);
  const [scanStatusBanner, setScanStatusBanner] = useState<{ type: 'SUCCESS' | 'INFO' | 'ERROR'; message: string } | null>(null);

  // Picker States
  const [pickerCategory, setPickerCategory] = useState<'SHARING' | 'DOORPRIZE'>('SHARING');
  const [pickerPoolType, setPickerPoolType] = useState<'ATTENDED' | 'ALL'>('ATTENDED');
  const [isRollingPicker, setIsRollingPicker] = useState(false);
  const [rollingCandidate, setRollingCandidate] = useState<Participant | null>(null);
  const [pickedWinner, setPickedWinner] = useState<Participant | null>(null);
  const [pickedHistory, setPickedHistory] = useState<Participant[]>([]);
  const [sharingPromptIdx, setSharingPromptIdx] = useState(0);
  const [customSharingPrompt, setCustomSharingPrompt] = useState('');
  const [doorprizeLabel, setDoorprizeLabel] = useState('Bingkisan Apresiasi Spesial Heal You');
  const rollTimeoutRef = useRef<number | null>(null);

  // Camera States
  const [isScanning, setIsScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualIdInput, setManualIdInput] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef({ code: '', time: 0 });

  // Custom Hooks Data
  const currentTime = useLiveClock();
  const currentQuote = useHealingAffirmations();

  // Derived Data
  const recentCheckIns = useMemo(() => {
    return participants
      .filter((p) => p.status !== 'PENDING' && p.checkInTime)
      .sort((a, b) => new Date(b.checkInTime!).getTime() - new Date(a.checkInTime!).getTime());
  }, [participants]);

  const pickerPool = useMemo(() => {
    const baseList = pickerPoolType === 'ATTENDED' ? (recentCheckIns.length > 0 ? recentCheckIns : participants) : participants;
    const pickedSet = new Set(pickedHistory.map((p) => p.id));
    const remaining = baseList.filter((p) => !pickedSet.has(p.id));
    return remaining.length > 0 ? remaining : baseList;
  }, [pickerPoolType, recentCheckIns, participants, pickedHistory]);

  // Sync / Auto-detect remote check-ins
  const prevCheckInMapRef = useRef<Record<string, string | undefined>>({});
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (isInitialMountRef.current) {
      const map: Record<string, string | undefined> = {};
      participants.forEach(p => { map[p.id] = p.checkInTime; });
      prevCheckInMapRef.current = map;
      isInitialMountRef.current = false;
      return;
    }
    let newestArrival: Participant | null = null;
    for (const p of participants) {
      const prevTime = prevCheckInMapRef.current[p.id];
      if (p.status !== 'PENDING' && p.checkInTime && p.checkInTime !== prevTime) newestArrival = p;
      prevCheckInMapRef.current[p.id] = p.checkInTime;
    }
    if (newestArrival) {
      setSpotlightParticipant(newestArrival);
      setScanStatusBanner({ type: 'SUCCESS', message: `PRESENSI BERHASIL TERCATAT` });
      if (soundEnabled) audioService.playChime('welcome');
    }
  }, [participants, soundEnabled]);

  // Fullscreen Listener
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await containerRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* Abaikan error */ }
  };

  // Logic: QR Scanning
  const handleIdentifyAndCheckIn = useCallback((rawCode: string) => {
    const cleanCode = rawCode.trim();
    if (!cleanCode) return;
    const result = checkIn(cleanCode);
    
    if (result.success && result.participant) {
      setSpotlightParticipant(result.participant);
      setScanStatusBanner({ type: 'SUCCESS', message: `PRESENSI BERHASIL TERCATAT` });
      if (soundEnabled) audioService.playChime('welcome');
      return;
    }
    const matched = participants.find((p) => p.id.toUpperCase() === cleanCode.toUpperCase());
    if (matched) {
      setSpotlightParticipant(matched);
      setScanStatusBanner({ type: 'INFO', message: `PESERTA TERIDENTIFIKASI · HADIR PUKUL ${matched.checkInTime ? format(new Date(matched.checkInTime), 'HH:mm') : '-'} WIB` });
      if (soundEnabled) audioService.playChime('welcome');
    } else {
      setScanStatusBanner({ type: 'ERROR', message: `KODE QR (${cleanCode}) TIDAK DITEMUKAN` });
      if (soundEnabled) audioService.playChime('notice');
    }
  }, [checkIn, participants, soundEnabled]);

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try { if (scannerRef.current.isScanning) await scannerRef.current.stop(); scannerRef.current.clear(); } catch { }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startCamera = useCallback(async (mode: 'user' | 'environment' = facingMode) => {
    setCameraError(null);
    await stopCamera();
    try {
      const html5QrCode = new Html5Qrcode('tv-welcome-qr-reader');
      scannerRef.current = html5QrCode;
      setIsScanning(true);
      await html5QrCode.start(
        { facingMode: mode },
        { fps: 12, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => {
          const now = Date.now();
          if (decodedText === lastScannedRef.current.code && now - lastScannedRef.current.time < 3200) return;
          lastScannedRef.current = { code: decodedText, time: now };
          handleIdentifyAndCheckIn(decodedText);
        },
        () => {}
      );
    } catch {
      setIsScanning(false);
      setCameraError('Akses kamera diblokir. Izinkan kamera atau gunakan input manual.');
    }
  }, [facingMode, stopCamera, handleIdentifyAndCheckIn]);

  useEffect(() => {
    return () => { void stopCamera(); if (rollTimeoutRef.current) window.clearTimeout(rollTimeoutRef.current); };
  }, [stopCamera]);

  // Logic: Picker Wheel
  const startRandomPickerSpin = () => {
    if (isRollingPicker || pickerPool.length === 0) return;
    setIsRollingPicker(true);
    setPickedWinner(null);

    const finalWinner = pickerPool[Math.floor(Math.random() * pickerPool.length)];
    const totalSteps = 24;
    let currentStep = 0;

    const runStep = () => {
      currentStep++;
      if (currentStep < totalSteps) {
        setRollingCandidate(participants[Math.floor(Math.random() * participants.length)] || finalWinner);
        if (soundEnabled) audioService.playTick(currentStep);
        const progress = currentStep / totalSteps;
        const nextDelay = Math.round(55 + Math.pow(progress, 2.2) * 195);
        rollTimeoutRef.current = window.setTimeout(runStep, nextDelay);
      } else {
        setRollingCandidate(finalWinner);
        setPickedWinner(finalWinner);
        setIsRollingPicker(false);
        setPickedHistory((prev) => prev.some((item) => item.id === finalWinner.id) ? prev : [finalWinner, ...prev]);
        if (soundEnabled) audioService.playReveal();
      }
    };
    runStep();
  };

  const triggerPreviewDemo = () => {
    if (spotlightParticipant) { setSpotlightParticipant(null); setScanStatusBanner(null); return; }
    const pool = recentCheckIns.length > 0 ? recentCheckIns : participants;
    if (pool.length === 0) return;
    setSpotlightParticipant({ ...pool[Math.floor(Math.random() * pool.length)], checkInTime: new Date().toISOString() });
    setScanStatusBanner({ type: 'SUCCESS', message: 'SIMULASI SAMBUTAN AKTIF' });
    if (soundEnabled) audioService.playChime('welcome');
  };

  return (
    <div ref={containerRef} className="relative w-full min-h-[calc(100vh-6.5rem)] rounded-[28px] overflow-hidden flex flex-col justify-between select-none bg-[#F5F0FA]">
      
      {/* BACKGROUND LAYER */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img src={RETREAT_BG_IMAGE} alt="Background" className="w-full h-full object-cover object-center scale-[1.01]" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(250,248,255,0.82) 0%, rgba(246,242,255,0.22) 24%, rgba(246,242,255,0.18) 72%, rgba(245,238,255,0.55) 100%)' }} />
      </div>

      {/* 1. HEADER BAR */}
      <div className="relative z-10 px-5 sm:px-8 lg:px-10 pt-4 sm:pt-5 pb-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <HealYouLogo customLogoUrl={config.customLogoUrl} size={48} className="rounded-2xl shadow-sm shrink-0" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-[10px] sm:text-xs font-bold tracking-[0.18em] uppercase text-[#4B337E]">{config.organizer || 'MUSLIMAH HEALING JOURNEY'}</span>
              <span className="text-[#9E7CF0] font-bold">•</span>
              <span className="text-xs sm:text-sm font-semibold text-[#9D75EA]">{config.tagline || "Let's Heal"}</span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-[30px] font-bold text-[#22153B] tracking-wide uppercase leading-tight break-words mt-0.5" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
              {config.name}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-white shadow-[0_4px_15px_rgb(0,0,0,0.03)] flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#5B3E96]" />
            <span className="font-mono text-xs sm:text-sm font-bold text-[#251840] tabular-nums">{format(currentTime, 'HH:mm:ss')} WIB</span>
          </div>
          <button onClick={() => setShowScannerPanel(v => !v)} className={cn('inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all', showScannerPanel ? 'bg-[#68428B] text-white' : 'bg-white/90 text-[#4A327A]')}>
            <QrCode className="w-3.5 h-3.5" /> <span>Scanner TV</span>
          </button>
          <button onClick={() => setShowBreathingGuide(v => !v)} className={cn('inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all', showBreathingGuide ? 'bg-[#EFE5FD] text-[#4C3282]' : 'bg-white/90 text-slate-600')}>
            <Wind className="w-3.5 h-3.5 text-[#6A4FA3]" /> <span>Panduan Napas</span>
          </button>
          <button onClick={() => setSoundEnabled(v => !v)} className={cn('inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all', soundEnabled ? 'bg-[#D8F7E2] text-[#1D683A]' : 'bg-white/90 text-slate-500')}>
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{soundEnabled ? 'Nada Lembut' : 'Bisu'}</span>
          </button>
          <button onClick={triggerPreviewDemo} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-white/95 text-[#3A2760] shadow-sm">
            <Eye className="w-3.5 h-3.5 text-[#6A4FA3]" />
            <span>{spotlightParticipant ? 'Layar Utama' : 'Tes Sambutan'}</span>
          </button>
          <button onClick={() => setIsPickerModeOpen(v => !v)} className={cn('inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all', isPickerModeOpen ? 'bg-gradient-to-r from-[#7c52b8] to-[#b68d40] text-white' : 'bg-[#FFF8EB]/95 text-[#6B4E16]')}>
            <Sparkles className="w-3.5 h-3.5" /> <span>{isPickerModeOpen ? 'Tutup Undian' : 'Acak Peserta'}</span>
          </button>
          <button onClick={toggleFullscreen} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-[#463766] text-white shadow-sm">
            {isFullscreen ? <><Minimize2 className="w-3.5 h-3.5" /><span>Keluar</span></> : <><Maximize2 className="w-3.5 h-3.5" /><span>Penuh</span></>}
          </button>
          {onClose && !isFullscreen && (
            <button onClick={onClose} className="p-1.5 rounded-full bg-white/90 text-slate-500 hover:text-rose-600 shadow-sm"><X className="w-4 h-4" /></button>
          )}
        </div>
      </div>

      {/* 2. MAIN STAGE */}
      <div className="relative z-10 flex-1 px-5 sm:px-8 lg:px-10 py-3 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        
        {/* LEFT SANCTUARY */}
        <div className={cn('flex flex-col', (showScannerPanel || showBreathingGuide) ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12 max-w-5xl mx-auto w-full')}>
          <div className="flex-1 bg-white/82 backdrop-blur-md rounded-[28px] px-6 sm:px-12 py-8 border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center justify-between text-center relative overflow-hidden">
            <TopLeftBotanicalSprig />
            <BottomRightBotanicalSprig />

            {isPickerModeOpen ? (
              /* --- PICKER MODE UI --- */
              <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-between py-1">
                <div className="w-full flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-purple-200/50">
                  <div className="flex items-center gap-1.5 p-1 bg-purple-100/80 rounded-full border border-purple-200/70">
                    <button onClick={() => setPickerCategory('SHARING')} className={cn('inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all', pickerCategory === 'SHARING' ? 'bg-[#5B3E96] text-white' : 'text-[#4A327A] hover:bg-white/60')}>
                      <MessageSquareHeart className="w-3.5 h-3.5" /> <span>Mindful Sharing</span>
                    </button>
                    <button onClick={() => setPickerCategory('DOORPRIZE')} className={cn('inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all', pickerCategory === 'DOORPRIZE' ? 'bg-[#9C6B21] text-white' : 'text-[#5C4318] hover:bg-white/60')}>
                      <Gift className="w-3.5 h-3.5" /> <span>Doorprize</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 p-1 bg-white/85 rounded-full border border-purple-200/70 text-[11px] font-semibold">
                      <button onClick={() => setPickerPoolType('ATTENDED')} className={cn('px-2.5 py-1 rounded-full', pickerPoolType === 'ATTENDED' ? 'bg-emerald-600 text-white' : 'text-slate-600')}>Hadir ({recentCheckIns.length})</button>
                      <button onClick={() => setPickerPoolType('ALL')} className={cn('px-2.5 py-1 rounded-full', pickerPoolType === 'ALL' ? 'bg-[#5B3E96] text-white' : 'text-slate-600')}>Semua ({participants.length})</button>
                    </div>
                    <button onClick={() => setIsPickerModeOpen(false)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/90 text-slate-600 border border-slate-200"><X className="w-3.5 h-3.5" /> <span>Tutup</span></button>
                  </div>
                </div>

                <div className="my-auto py-4 w-full max-w-2xl mx-auto flex flex-col items-center">
                  <span className={cn('inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-[11px] font-bold tracking-[0.15em] uppercase', pickerCategory === 'SHARING' ? 'bg-purple-100 text-[#4C2F85]' : 'bg-amber-100/90 text-[#7A5112]')}>
                    {pickerCategory === 'SHARING' ? <><Sparkles className="w-3.5 h-3.5" /> SESI REFLEKSI</> : <><Award className="w-3.5 h-3.5" /> UNDIAN SPESIAL</>}
                  </span>

                  <div className={cn('mt-4 w-full rounded-[26px] px-6 py-7 transition-all duration-300 border relative overflow-hidden', pickedWinner && !isRollingPicker ? (pickerCategory === 'DOORPRIZE' ? 'bg-gradient-to-br from-[#FFFDF7] to-[#F6EEFF] border-amber-300 shadow-[0_14px_40px_rgba(182,141,64,0.16)]' : 'bg-gradient-to-br from-white to-[#F1E8FF] border-[#C9B3F9] shadow-[0_14px_40px_rgba(91,62,150,0.14)]') : 'bg-white/90 border-purple-200/80')}>
                    {isRollingPicker || rollingCandidate || pickedWinner ? (
                      <AnimatePresence mode="wait">
                        <motion.div key={(pickedWinner?.id || rollingCandidate?.id || 'spin') + (isRollingPicker ? '-rolling' : '-final')} initial={{ opacity: 0.4, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0.3, y: -12 }} className="flex flex-col items-center text-center">
                          <span className="font-mono text-xs font-bold tracking-[0.18em] uppercase px-3.5 py-1 rounded-full bg-purple-100/90 text-[#4C2F85] border border-purple-200">NO. { (pickedWinner || rollingCandidate)?.id }</span>
                          <h2 className={cn('mt-3 text-3xl sm:text-5xl font-bold leading-tight', isRollingPicker ? 'text-[#5B3E96]/80' : 'text-[#211339]')} style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                            {(pickedWinner || rollingCandidate)?.name}
                          </h2>
                          <p className="mt-2 text-xs font-semibold text-[#543D82]">{(pickedWinner || rollingCandidate)?.role || 'Peserta'} • {(pickedWinner || rollingCandidate)?.institution}</p>
                          
                          {pickedWinner && !isRollingPicker && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 pt-4 border-t border-purple-200/60 w-full max-w-xl">
                              {pickerCategory === 'SHARING' ? (
                                <div className="bg-white/90 rounded-2xl px-4 py-3 border border-purple-200/70">
                                  <p className="text-[11px] font-bold uppercase text-[#68428B]">Pertanyaan Refleksi:</p>
                                  <p className="mt-1 text-base sm:text-xl italic font-semibold text-[#281845]" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                                    &ldquo;{customSharingPrompt.trim() || MINDFUL_SHARING_PROMPTS[sharingPromptIdx]}&rdquo;
                                  </p>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-amber-100/90 border border-amber-300 text-amber-950 text-sm font-bold">
                                  <Gift className="w-4 h-4 text-amber-700" /> <span>Penerima {doorprizeLabel}</span>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    ) : (
                      <div className="py-5 flex flex-col items-center text-center">
                        <div className="w-14 h-14 rounded-full bg-purple-100/80 text-[#5B3E96] flex items-center justify-center mb-3"><Shuffle className="w-6 h-6" /></div>
                        <h3 className="text-2xl sm:text-4xl font-bold text-[#24163E]" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>Siap Memilih</h3>
                        <p className="mt-1.5 text-xs text-slate-600">Tersedia {pickerPool.length} peserta dalam antrean.</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 w-full max-w-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
                    {pickerCategory === 'SHARING' ? (
                      <div className="flex-1 flex gap-1.5">
                        <input type="text" value={customSharingPrompt} onChange={(e) => setCustomSharingPrompt(e.target.value)} placeholder={MINDFUL_SHARING_PROMPTS[sharingPromptIdx]} className="flex-1 px-3.5 py-2.5 rounded-full bg-white/95 border border-purple-200 text-xs focus:ring-2 focus:ring-purple-400" />
                        <button onClick={() => { setCustomSharingPrompt(''); setSharingPromptIdx((p) => (p + 1) % MINDFUL_SHARING_PROMPTS.length); }} className="px-3 py-2.5 rounded-full bg-purple-100 text-[#4C2F85] text-xs font-bold">Ganti Topik</button>
                      </div>
                    ) : (
                      <input type="text" value={doorprizeLabel} onChange={(e) => setDoorprizeLabel(e.target.value)} placeholder="Nama Hadiah..." className="flex-1 px-4 py-2.5 rounded-full bg-white/95 border border-amber-200 text-xs font-semibold focus:ring-2 focus:ring-amber-400" />
                    )}
                    <button disabled={isRollingPicker || pickerPool.length === 0} onClick={startRandomPickerSpin} className={cn('inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold text-white shadow-md', pickerCategory === 'DOORPRIZE' ? 'bg-gradient-to-r from-[#9C6B21] to-[#B8862D]' : 'bg-gradient-to-r from-[#5B3E96] to-[#7C52B8]')}>
                      <Shuffle className={cn('w-4 h-4', isRollingPicker && 'animate-spin')} />
                      <span>{isRollingPicker ? 'Mengacak...' : 'Putar & Pilih'}</span>
                    </button>
                  </div>
                </div>
                
                <div className="w-full pt-3 border-t border-purple-200/50 flex items-center justify-between text-xs">
                  <div className="flex gap-1.5 overflow-x-auto"><span className="font-bold text-[#4C2F85]">Terpilih:</span>
                    {pickedHistory.map((p, idx) => (
                       <span key={p.id} className="px-2.5 py-1 rounded-full bg-white/90 border border-purple-200 text-[11px] font-semibold text-[#3B2863]">#{idx + 1} {p.name}</span>
                    ))}
                  </div>
                  {pickedHistory.length > 0 && <button onClick={() => { setPickedHistory([]); setPickedWinner(null); setRollingCandidate(null); }} className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200">Reset</button>}
                </div>
              </div>
            ) : (
              /* --- GREETING MODE UI --- */
              <>
                {(scanStatusBanner || spotlightParticipant) && (
                  <div className="relative z-10 flex flex-wrap items-center justify-center gap-2">
                    {scanStatusBanner && (
                      <div className={cn('inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold tracking-[0.12em] uppercase', scanStatusBanner.type === 'ERROR' ? 'bg-rose-100/90 text-rose-800 border border-rose-200' : 'bg-[#EDE3FC] text-[#4C2F85] border border-[#DFCFFB]')}>
                        {scanStatusBanner.type === 'ERROR' ? <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> : <Leaf className="w-3.5 h-3.5 text-[#34A853]" />}
                        <span>{scanStatusBanner.message}</span>
                      </div>
                    )}
                    {spotlightParticipant && (
                      <button onClick={() => { setSpotlightParticipant(null); setScanStatusBanner(null); }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/90 text-slate-600 border border-purple-200/70">
                        <RotateCcw className="w-3 h-3" /> <span>Reset Tampilan</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="relative z-10 my-auto py-4 max-w-2xl mx-auto">
                  <AnimatePresence mode="wait">
                    {spotlightParticipant ? (
                      <motion.div key={spotlightParticipant.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <p className="text-lg italic font-semibold text-[#694BA3]" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>Ahlan wa Sahlan · Selamat Datang,</p>
                        <h2 className="mt-1 text-3xl sm:text-5xl font-bold text-[#24163E] leading-tight" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                          {spotlightParticipant.name}
                        </h2>
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-[#4A3575]">
                          <span className="px-3 py-1 rounded-full bg-purple-100/80 border border-purple-200/70">{spotlightParticipant.role || 'Peserta'}</span>
                          <span>•</span><span>{spotlightParticipant.institution}</span><span>•</span>
                          <span className="font-mono text-[#5B3E96] bg-white/90 px-3 py-1 rounded-full border border-purple-200/70">ID: {spotlightParticipant.id}</span>
                        </div>
                        <p className="mt-4 text-base sm:text-lg font-medium text-[#3F2E66] leading-relaxed">&ldquo;{currentQuote}&rdquo;</p>
                      </motion.div>
                    ) : (
                      <motion.div key="default" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                        <h2 className="text-3xl sm:text-5xl font-bold text-[#24163E] leading-tight" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                          Selamat Datang Peserta Workshop
                        </h2>
                        <p className="mt-3.5 text-base sm:text-xl font-medium text-[#3B2B60] leading-relaxed max-w-xl mx-auto">&ldquo;{currentQuote}&rdquo;</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <div className="my-5 flex items-center justify-center gap-4 max-w-md mx-auto">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#C6B4E8] to-[#B59EE0]" />
                    <LotusIcon className="w-5 h-5 text-[#6D4CA8]" />
                    <div className="flex-1 h-px bg-gradient-to-l from-transparent via-[#C6B4E8] to-[#B59EE0]" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-[#4D3F6B] max-w-lg mx-auto leading-relaxed">
                    Arahkan Kartu Tanda Pengenal QR Anda ke kamera di sebelah kanan untuk check-in.
                  </p>
                </div>

                <div className="relative z-10 w-full max-w-2xl mx-auto pt-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[{i: LotusIcon, t: 'Tenang', d: 'Ambil napas'}, {i: Heart, t: 'Hadiri', d: 'Nikmati prosesnya', c: 'bg-[#FCE8EF] text-[#C84B7C] border-[#F7D1DF]'}, {i: Leaf, t: 'Pulih', d: 'Temukan dirimu', c: 'bg-[#DEF7E5] text-[#238B4D] border-[#C5EED1]'}, {i: Flower2, t: 'Bertumbuh', d: 'Bersama komunitas'}].map((item, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <div className={cn("w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-[0_4px_15px_rgb(0,0,0,0.03)] border", item.c || "bg-[#EFE7FC] text-[#6A45A8] border-[#E1D2FA]")}>
                        <item.i className="w-6 h-6" />
                      </div>
                      <p className="mt-2.5 text-xs font-bold text-[#251840]">{item.t}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.d}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT PANELS (Scanner & Breathing Guide) */}
        {(showScannerPanel || showBreathingGuide) && (
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4 justify-between">
            {showScannerPanel && (
              <div className="bg-white/90 backdrop-blur-md rounded-[26px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#F3ECFC] text-[#5B3E96] flex items-center justify-center shrink-0"><QrCode className="w-4 h-4" /></div>
                    <div>
                      <h3 className="text-xs font-bold text-[#22153B]">Pindai Kartu QR</h3>
                      <p className="text-[11px] text-slate-500">Identifikasi peserta otomatis</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isScanning && <button onClick={() => { const m = facingMode === 'user' ? 'environment' : 'user'; setFacingMode(m); startCamera(m); }} className="p-1.5 rounded-full bg-purple-50 text-[#5B3E96]"><SwitchCamera className="w-3.5 h-3.5" /></button>}
                    {isScanning ? (
                      <button onClick={stopCamera} className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-rose-600 text-white flex items-center gap-1"><CameraOff className="w-3.5 h-3.5" /> Matikan</button>
                    ) : (
                      <button onClick={() => startCamera(facingMode)} className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-[#68428B] text-white flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> Aktifkan</button>
                    )}
                  </div>
                </div>

                <div className="relative w-full max-w-[340px] aspect-square mx-auto rounded-2xl overflow-hidden bg-[#352852] flex items-center justify-center shadow-inner [&_video]:w-full [&_video]:h-full [&_video]:object-cover">
                  <div id="tv-welcome-qr-reader" className="w-full h-full" />
                  {!isScanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
                      <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center mb-3.5"><Camera className="w-6 h-6 text-purple-100" /></div>
                      <p className="text-sm font-bold text-white">Kamera Kiosk Siap</p>
                      <button onClick={() => startCamera(facingMode)} className="mt-4 px-5 py-2 rounded-full text-xs font-bold bg-white text-[#2B1B47]">Mulai Pindai QR</button>
                    </div>
                  )}
                </div>
                {cameraError && <p className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">{cameraError}</p>}
                
                <form onSubmit={(e) => { e.preventDefault(); handleIdentifyAndCheckIn(manualIdInput); setManualIdInput(''); }} className="mt-3 flex gap-2">
                  <input type="text" value={manualIdInput} onChange={(e) => setManualIdInput(e.target.value)} placeholder="Ketik No. Presensi..." className="flex-1 px-3.5 py-2 bg-[#FAF8FF] border border-[#E5DCF5] rounded-xl text-xs focus:ring-2 focus:ring-[#8E72CC]/40" />
                  <button type="submit" className="px-4 py-2 rounded-xl bg-[#EBE1FC] text-[#563B8C] text-xs font-bold">Cek ID</button>
                </form>
              </div>
            )}
            {showBreathingGuide && <BreathingGuideCard />}
          </div>
        )}
      </div>

      {/* 3. FOOTER BAR */}
      <div className="relative z-10 bg-white/85 backdrop-blur-md border-t border-white px-5 sm:px-8 lg:px-10 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 shadow-[0_-4px_20px_rgb(0,0,0,0.02)]">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-[#4C2F85] shrink-0">
            <Leaf className="w-3.5 h-3.5 text-[#34A853]" /> <span>BARU TIBA ({recentCheckIns.length}/{participants.length}):</span>
          </span>
          {recentCheckIns.length > 0 ? recentCheckIns.slice(0, 5).map((p) => {
            const isSelected = spotlightParticipant?.id === p.id;
            return (
              <button key={p.id} onClick={() => { setSpotlightParticipant(p); setScanStatusBanner({ type: 'INFO', message: `PESERTA TERIDENTIFIKASI` }); }} className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all shrink-0', isSelected ? 'bg-[#68428B] text-white border-[#68428B]' : 'bg-purple-50/90 text-[#3B2863] border-purple-200/80')}>
                <CheckCircle2 className={cn('w-3.5 h-3.5', isSelected ? 'text-emerald-300' : 'text-emerald-600')} />
                <span className="truncate max-w-[150px]">{p.name}</span>
              </button>
            );
          }) : <span className="text-xs font-medium text-slate-600">Menunggu peserta pertama...</span>}
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold text-[#2E204B] shrink-0">
          <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-[#5B3E96]" /> <span>{formatSafeDate(config.date)}</span></span>
          <span className="text-[#9E7CF0]">•</span>
          <span className="inline-flex items-center gap-1.5 uppercase tracking-wide"><MapPin className="w-3.5 h-3.5 text-[#5B3E96]" /> <span>{config.location}</span></span>
        </div>
      </div>
    </div>
  );
};