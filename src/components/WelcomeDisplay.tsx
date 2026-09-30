import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAppContext } from '../store';
import { Participant } from '../types';
import { HealYouLogo } from './HealYouLogo';
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Sparkles,
  Calendar,
  MapPin,
  Clock,
  HeartHandshake,
  CheckCircle2,
  X,
  Wind,
  Eye,
  Camera,
  CameraOff,
  SwitchCamera,
  QrCode,
  AlertCircle,
  UserCheck,
  Building2,
  Award,
  Hash,
  Sun,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const RETREAT_BG_IMAGE = '/src/assets/images/healing_retreat_meadow_1790765180863.jpg';

const HEALING_AFFIRMATIONS = [
  {
    quote:
      'Terima kasih telah meluangkan waktu untuk hadir dan merawat ruang batin Anda hari ini.',
    sub: 'Ruang Aman · Pemulihan Diri · Kesadaran Penuh',
  },
  {
    quote:
      'Setiap langkah kecil untuk memahami diri sendiri adalah awal dari ketenangan yang sesungguhnya.',
    sub: 'Self-Compassion · Inner Peace · Mindful Presence',
  },
  {
    quote:
      'Izinkan diri Anda beristirahat sejenak dari hiruk-pikuk, tarik napas perlahan, dan hadir sepenuhnya di sini.',
    sub: 'Hadir Utuh · Tanpa Penghakiman · Bertumbuh Bersama',
  },
  {
    quote:
      'Anda tidak perlu terburu-buru. Di ruangan ini, setiap perasaan dan perjalanan Anda dihargai.',
    sub: "Heal You · Muslimah Healing Journey · Let's Heal",
  },
];

function playCalmWelcomeChime(type: 'welcome' | 'notice' = 'welcome') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === 'welcome') {
      // Soft harmonic chord (Fmaj7 warm healing chime: F4, A4, C5, E5)
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
  } catch {
    // Ignore audio context restriction
  }
}

function formatSafeDate(dateStr: string) {
  try {
    const parsed = dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T00:00:00`);
    if (isNaN(parsed.getTime())) return dateStr;
    return format(parsed, 'dd MMMM yyyy');
  } catch {
    return dateStr;
  }
}

function formatSafeStartTime(startTimeStr: string) {
  try {
    const parsed = new Date(startTimeStr);
    if (isNaN(parsed.getTime())) return '08:00';
    return format(parsed, 'HH:mm');
  } catch {
    return '08:00';
  }
}

interface WelcomeDisplayProps {
  onClose?: () => void;
}

export const WelcomeDisplay: React.FC<WelcomeDisplayProps> = ({ onClose }) => {
  const { participants, config, checkIn } = useAppContext();
  const containerRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showScannerPanel, setShowScannerPanel] = useState(true);
  const [showBreathingGuide, setShowBreathingGuide] = useState(true);
  const [scenicClearMode, setScenicClearMode] = useState(false);
  const [affirmationIdx, setAffirmationIdx] = useState(0);
  const [breathPhase, setBreathPhase] = useState<'INHALE' | 'HOLD' | 'EXHALE'>('INHALE');
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Spotlight & Scan Feedback State
  const [spotlightParticipant, setSpotlightParticipant] = useState<Participant | null>(null);
  const [scanStatusBanner, setScanStatusBanner] = useState<{
    type: 'NEW_CHECKIN' | 'ALREADY_CHECKED_IN' | 'NOT_FOUND';
    message: string;
  } | null>(null);

  // Built-in TV Camera QR Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualIdInput, setManualIdInput] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const prevCheckInMapRef = useRef<Record<string, string | undefined>>({});
  const isInitialMountRef = useRef(true);

  const participantsRef = useRef(participants);
  const checkInRef = useRef(checkIn);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    checkInRef.current = checkIn;
  }, [checkIn]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Live clock
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Rotate soothing affirmations every 11 seconds
  useEffect(() => {
    const timer = window.setInterval(() => {
      setAffirmationIdx((prev) => (prev + 1) % HEALING_AFFIRMATIONS.length);
    }, 11000);
    return () => window.clearInterval(timer);
  }, []);

  // Mindful 4-4-6 breathing rhythm
  useEffect(() => {
    let timeout1: number;
    let timeout2: number;
    const runCycle = () => {
      setBreathPhase('INHALE');
      timeout1 = window.setTimeout(() => {
        setBreathPhase('HOLD');
      }, 4000);
      timeout2 = window.setTimeout(() => {
        setBreathPhase('EXHALE');
      }, 8000);
    };
    runCycle();
    const interval = window.setInterval(runCycle, 14000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout1);
      window.clearTimeout(timeout2);
    };
  }, []);

  // Sorted list of checked-in participants (newest first)
  const recentCheckIns = useMemo(() => {
    return participants
      .filter((p) => p.status !== 'PENDING' && p.checkInTime)
      .sort((a, b) => {
        const tA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
        const tB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
        return tB - tA;
      });
  }, [participants]);

  // Process a scanned or typed QR code directly on the TV screen
  const handleIdentifyAndCheckIn = useCallback((rawCode: string) => {
    const cleanCode = rawCode.trim();
    if (!cleanCode) return;

    const result = checkInRef.current(cleanCode);
    if (result.success && result.participant) {
      setSpotlightParticipant(result.participant);
      setScanStatusBanner({
        type: 'NEW_CHECKIN',
        message: `Presensi Berhasil Tercatat · ${
          result.participant.status === 'LATE' ? 'Hadir Terlambat' : 'Hadir Tepat Waktu'
        }`,
      });
      if (soundEnabledRef.current) {
        playCalmWelcomeChime('welcome');
      }
      return;
    }

    // Check if the participant is already checked in
    const matched = participantsRef.current.find(
      (p) => p.id.toUpperCase() === cleanCode.toUpperCase()
    );
    if (matched) {
      setSpotlightParticipant(matched);
      setScanStatusBanner({
        type: 'ALREADY_CHECKED_IN',
        message: `Peserta Teridentifikasi · Sudah Check-in Pukul ${
          matched.checkInTime ? format(new Date(matched.checkInTime), 'HH:mm') : '-'
        } WIB`,
      });
      if (soundEnabledRef.current) {
        playCalmWelcomeChime('welcome');
      }
    } else {
      setScanStatusBanner({
        type: 'NOT_FOUND',
        message: `Kode QR (${cleanCode}) tidak ditemukan dalam daftar peserta.`,
      });
      if (soundEnabledRef.current) {
        playCalmWelcomeChime('notice');
      }
    }
  }, []);

  // Start / Stop built-in TV QR Camera
  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startCamera = useCallback(
    async (mode: 'user' | 'environment' = facingMode) => {
      setCameraError(null);
      await stopCamera();

      try {
        const html5QrCode = new Html5Qrcode('tv-welcome-qr-reader');
        scannerRef.current = html5QrCode;
        setIsScanning(true);

        await html5QrCode.start(
          { facingMode: mode },
          {
            fps: 12,
            qrbox: { width: 185, height: 185 },
            aspectRatio: 1.333,
          },
          (decodedText) => {
            const now = Date.now();
            if (
              decodedText === lastScannedRef.current.code &&
              now - lastScannedRef.current.time < 3200
            ) {
              return;
            }
            lastScannedRef.current = { code: decodedText, time: now };
            handleIdentifyAndCheckIn(decodedText);
          },
          () => {
            // Frame scan error ignored
          }
        );
      } catch {
        setIsScanning(false);
        setCameraError(
          'Akses kamera belum diizinkan oleh browser. Izinkan kamera atau gunakan verifikasi ID di bawah.'
        );
      }
    },
    [facingMode, stopCamera, handleIdentifyAndCheckIn]
  );

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  // Detect remote check-ins from other devices via Cloud Sync
  useEffect(() => {
    if (isInitialMountRef.current) {
      const map: Record<string, string | undefined> = {};
      participants.forEach((p) => {
        map[p.id] = p.checkInTime;
      });
      prevCheckInMapRef.current = map;
      isInitialMountRef.current = false;
      if (recentCheckIns[0]) {
        setSpotlightParticipant(recentCheckIns[0]);
      }
      return;
    }

    let newestArrival: Participant | null = null;
    for (const p of participants) {
      const prevTime = prevCheckInMapRef.current[p.id];
      if (p.status !== 'PENDING' && p.checkInTime && p.checkInTime !== prevTime) {
        newestArrival = p;
      }
      prevCheckInMapRef.current[p.id] = p.checkInTime;
    }

    if (newestArrival) {
      setSpotlightParticipant(newestArrival);
      setScanStatusBanner({
        type: 'NEW_CHECKIN',
        message: `Presensi Berhasil Tercatat · ${
          newestArrival.status === 'LATE' ? 'Hadir Terlambat' : 'Hadir Tepat Waktu'
        }`,
      });
      if (soundEnabled) {
        playCalmWelcomeChime('welcome');
      }
    }
  }, [participants, recentCheckIns, soundEnabled]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen error in restricted iframe
    }
  };

  const triggerPreviewDemo = () => {
    const pool = recentCheckIns.length > 0 ? recentCheckIns : participants;
    if (pool.length === 0) return;
    const randomIdx = Math.floor(Math.random() * pool.length);
    const chosen = pool[randomIdx];
    setSpotlightParticipant({
      ...chosen,
      checkInTime: chosen.checkInTime || new Date().toISOString(),
    });
    setScanStatusBanner({
      type: 'NEW_CHECKIN',
      message: 'Simulasi Sambutan Peserta · Layar Sambutan Siap Digunakan',
    });
    if (soundEnabled) {
      playCalmWelcomeChime('welcome');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIdInput.trim()) return;
    handleIdentifyAndCheckIn(manualIdInput.trim());
    setManualIdInput('');
  };

  const attendedCount = recentCheckIns.length;
  const totalCount = participants.length;
  const attendancePercentage =
    totalCount > 0 ? Math.round((attendedCount / totalCount) * 100) : 0;
  const currentAffirmation = HEALING_AFFIRMATIONS[affirmationIdx];

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-[calc(100vh-6.5rem)] rounded-[28px] overflow-hidden flex flex-col justify-between p-4 sm:p-6 lg:p-8 select-none border border-white/80 shadow-[0_16px_48px_rgba(43,27,71,0.07)] bg-[#F5F2FA]"
    >
      {/* FULL-SCREEN 16:9 HEALING RETREAT FLOWER MEADOW & SKY/SEA BACKGROUND */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img
          src={RETREAT_BG_IMAGE}
          alt="Muslimah Healing Day Flower Meadow Sanctuary"
          referrerPolicy="no-referrer"
          className={cn(
            'w-full h-full object-cover object-center transition-all duration-700',
            scenicClearMode ? 'scale-100 blur-none' : 'scale-[1.02] blur-[1.5px]'
          )}
        />

        {/* Soft White-Lavender & Sky-Blue Translucent Atmospheric Veil */}
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            background: scenicClearMode
              ? 'linear-gradient(180deg, rgba(252,250,255,0.42) 0%, rgba(244,239,253,0.32) 48%, rgba(250,247,255,0.52) 100%)'
              : 'linear-gradient(165deg, rgba(253,251,255,0.72) 0%, rgba(243,238,253,0.58) 45%, rgba(235,242,254,0.62) 75%, rgba(250,246,255,0.76) 100%)',
          }}
        />

        {/* Subtle Top & Bottom Vignette for Crisp Header/Footer Contrast */}
        <div
          className="absolute inset-x-0 top-0 h-28"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-28"
          style={{
            background:
              'linear-gradient(0deg, rgba(252,249,255,0.75) 0%, rgba(252,249,255,0) 100%)',
          }}
        />
      </div>

      {/* 1. TOP HOSPITALITY HEADER BAR */}
      <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-white/70">
        {/* Left: Sanctuary Brand Identity & Event Title */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="p-1 bg-white/90 backdrop-blur-md rounded-2xl border border-white shadow-[0_4px_14px_rgba(94,67,143,0.08)] shrink-0">
            <HealYouLogo
              customLogoUrl={config.customLogoUrl}
              size={46}
              className="rounded-xl"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] uppercase text-[#5A3E94] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
                {config.organizer || 'Muslimah Healing Journey'}
              </span>
              <span className="text-[#9E88CC] hidden sm:inline">•</span>
              <span
                className="text-xs sm:text-sm italic font-semibold text-[#6A4CA3]"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                {config.tagline || "Let's Heal"}
              </span>
            </div>
            <h1
              className="text-xl sm:text-2xl lg:text-[29px] font-bold text-[#1D1333] tracking-tight leading-snug break-words drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              {config.name}
            </h1>
          </div>
        </div>

        {/* Right: Unified Glassmorphic Control Bar */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Live Clock Pill */}
          <div className="px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/90 shadow-[0_2px_10px_rgba(43,27,71,0.04)] flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#6A4FA3]" />
            <span className="font-mono text-xs sm:text-sm font-semibold text-[#221638] tabular-nums">
              {format(currentTime, 'HH:mm:ss')} WIB
            </span>
          </div>

          {/* Segmented Module Toggles */}
          <div className="flex items-center bg-white/80 backdrop-blur-md p-0.5 rounded-xl border border-white/90 shadow-[0_2px_10px_rgba(43,27,71,0.04)]">
            <button
              type="button"
              onClick={() => {
                if (showScannerPanel && isScanning) {
                  void stopCamera();
                }
                setShowScannerPanel((v) => !v);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                showScannerPanel
                  ? 'bg-[#EFE9FC] text-[#452D75] font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              title="Tampilkan atau sembunyikan panel Scanner QR"
            >
              <QrCode className="w-3.5 h-3.5 text-[#6A4FA3]" />
              <span>Scanner TV</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBreathingGuide((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                showBreathingGuide
                  ? 'bg-[#EFE9FC] text-[#452D75] font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              title="Tampilkan atau sembunyikan panduan relaksasi napas"
            >
              <Wind className="w-3.5 h-3.5 text-[#6A4FA3]" />
              <span className="hidden md:inline">Napas Tenang</span>
            </button>

            <button
              type="button"
              onClick={() => setScenicClearMode((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                scenicClearMode
                  ? 'bg-[#EFE9FC] text-[#452D75] font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              title="Perjelas pemandangan taman bunga di latar belakang"
            >
              <Sun className="w-3.5 h-3.5 text-[#6A4FA3]" />
              <span className="hidden md:inline">Panorama</span>
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                soundEnabled
                  ? 'bg-emerald-50/90 text-emerald-800 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              title={
                soundEnabled
                  ? 'Nada sambutan lembut aktif (Klik untuk bisukan)'
                  : 'Nada sambutan dibisukan'
              }
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline">{soundEnabled ? 'Nada Aktif' : 'Bisu'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={triggerPreviewDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/80 hover:bg-white backdrop-blur-md text-[#452D75] border border-white/90 shadow-[0_2px_10px_rgba(43,27,71,0.04)] transition-colors cursor-pointer"
            title="Simulasikan tampilan sambutan peserta di layar proyektor"
          >
            <Eye className="w-3.5 h-3.5 text-[#6A4FA3]" />
            <span className="hidden sm:inline">Tes Sambutan</span>
          </button>

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#4E3580] hover:bg-[#3E2968] text-white shadow-[0_4px_14px_rgba(78,53,128,0.22)] transition-all cursor-pointer"
            title="Tampilkan Layar Penuh untuk TV / Proyektor"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Keluar Penuh</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Layar Penuh TV</span>
              </>
            )}
          </button>

          {onClose && !isFullscreen && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/80 hover:bg-rose-50 backdrop-blur-md text-slate-500 hover:text-rose-600 border border-white/90 transition-colors cursor-pointer"
              title="Kembali ke Dashboard"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. MAIN 16:9 SANCTUARY STAGE */}
      <div className="relative z-10 flex-1 my-4 sm:my-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Main Stage: Frosted Glass Hospitality Guest Welcome & Affirmation Sanctuary */}
        <div
          className={cn(
            'flex flex-col',
            showScannerPanel || showBreathingGuide
              ? 'lg:col-span-7 xl:col-span-8'
              : 'lg:col-span-12 max-w-5xl mx-auto w-full'
          )}
        >
          <div className="flex-1 bg-white/78 backdrop-blur-md rounded-[26px] p-5 sm:p-7 lg:p-8 border border-white/90 shadow-[0_12px_36px_rgba(36,22,59,0.06)] flex flex-col justify-between relative overflow-hidden">
            {/* Subtle Top Lavender-Sky Hairline */}
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{
                background:
                  'linear-gradient(90deg, #D8B4E2 0%, #9B7EDE 50%, #90B8F8 100%)',
              }}
            />

            {/* Zone A: Status Strip & Live Attendance Progress */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EAE2F8]/80">
              <div
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide border backdrop-blur-xs',
                  scanStatusBanner?.type === 'NOT_FOUND'
                    ? 'bg-rose-50/90 border-rose-200 text-rose-800'
                    : 'bg-emerald-50/90 border-emerald-200/80 text-emerald-800'
                )}
              >
                {scanStatusBanner?.type === 'NOT_FOUND' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                )}
                <span>
                  {scanStatusBanner
                    ? scanStatusBanner.message
                    : 'Selamat Datang di Ruang Aman'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <UserCheck className="w-3.5 h-3.5 text-[#6A4FA3]" />
                  <span>
                    Kehadiran:{' '}
                    <strong className="text-[#1F1435] font-semibold">
                      {attendedCount}/{totalCount}
                    </strong>{' '}
                    peserta
                  </span>
                </div>
                <div className="w-20 h-1.5 bg-white/80 border border-[#E6DFF3] rounded-full overflow-hidden hidden sm:block">
                  <div
                    className="h-full bg-[#6A4FA3] rounded-full transition-all duration-500"
                    style={{ width: `${attendancePercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Zone B: Guest Spotlight or Hospitality Welcome Stage */}
            <div className="my-auto py-5 sm:py-6">
              <AnimatePresence mode="wait">
                {spotlightParticipant ? (
                  <motion.div
                    key={spotlightParticipant.id + (spotlightParticipant.checkInTime || '')}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                  >
                    <p
                      className="text-base sm:text-lg italic font-medium text-[#684CA1]"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      Ahlan wa Sahlan · Selamat Datang,
                    </p>

                    <h2
                      className="mt-1 text-3xl sm:text-4xl lg:text-[46px] font-semibold text-[#1D1233] leading-[1.12] tracking-tight break-words"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      {spotlightParticipant.name}
                    </h2>

                    {/* Structured 3-Column Glassmorphic Guest Credential Bar */}
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                      <div className="px-3.5 py-2.5 rounded-xl bg-white/85 border border-white shadow-[0_2px_10px_rgba(94,67,143,0.04)] flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#F3EEFC] text-[#5E438F] flex items-center justify-center shrink-0">
                          <Award className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Peran Sesi
                          </p>
                          <p className="text-xs sm:text-sm font-semibold text-[#261842] truncate">
                            {spotlightParticipant.role || 'Peserta Workshop'}
                          </p>
                        </div>
                      </div>

                      <div className="px-3.5 py-2.5 rounded-xl bg-white/85 border border-white shadow-[0_2px_10px_rgba(94,67,143,0.04)] flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#F3EEFC] text-[#5E438F] flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Institusi / Afiliasi
                          </p>
                          <p className="text-xs sm:text-sm font-semibold text-[#261842] truncate">
                            {spotlightParticipant.institution}
                          </p>
                        </div>
                      </div>

                      <div className="px-3.5 py-2.5 rounded-xl bg-white/85 border border-white shadow-[0_2px_10px_rgba(94,67,143,0.04)] flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#F3EEFC] text-[#5E438F] flex items-center justify-center shrink-0">
                          <Hash className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            No. Presensi &amp; Waktu
                          </p>
                          <p className="text-xs sm:text-sm font-semibold text-[#261842] truncate">
                            <span className="font-mono text-[#5E438F]">
                              {spotlightParticipant.id}
                            </span>
                            {spotlightParticipant.checkInTime && (
                              <span className="text-slate-500 font-normal">
                                {' '}
                                · {format(new Date(spotlightParticipant.checkInTime), 'HH:mm')} WIB
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="waiting-state"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <p
                      className="text-base sm:text-lg italic font-medium text-[#684CA1]"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      Ahlan wa Sahlan · Ruang Sambutan &amp; Presensi Mandiri
                    </p>
                    <h2
                      className="mt-1 text-3xl sm:text-4xl lg:text-[44px] font-semibold text-[#1D1233] leading-tight"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      Selamat Datang Peserta Workshop
                    </h2>
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                      Silakan tunjukkan Kartu Tanda Pengenal QR Anda ke kamera pemindai di sisi
                      kanan layar untuk mencatat kehadiran dan melihat sambutan personal Anda.
                    </p>

                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="p-3 rounded-xl bg-white/85 border border-white shadow-[0_2px_10px_rgba(94,67,143,0.04)] flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-[#EFE9FA] text-[#5E438F] text-xs font-bold flex items-center justify-center shrink-0">
                          1
                        </span>
                        <span className="text-xs font-medium text-slate-700">
                          Siapkan Kartu Pengenal QR
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white/85 border border-white shadow-[0_2px_10px_rgba(94,67,143,0.04)] flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-[#EFE9FA] text-[#5E438F] text-xs font-bold flex items-center justify-center shrink-0">
                          2
                        </span>
                        <span className="text-xs font-medium text-slate-700">
                          Arahkan ke Kamera Kiosk
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white/85 border border-white shadow-[0_2px_10px_rgba(94,67,143,0.04)] flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-[#EFE9FA] text-[#5E438F] text-xs font-bold flex items-center justify-center shrink-0">
                          3
                        </span>
                        <span className="text-xs font-medium text-slate-700">
                          Masuk Ruangan dengan Tenang
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Zone C: Mindful Affirmation Sanctuary Box */}
            <div className="rounded-2xl bg-white/80 border border-white shadow-[0_4px_16px_rgba(94,67,143,0.04)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#F4EFFC] border border-[#E6DFF3] text-[#6A4FA3] flex items-center justify-center shrink-0 mt-0.5">
                  <HeartHandshake className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={affirmationIdx}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.4 }}
                      className="text-base sm:text-[19px] font-medium text-[#261842] leading-snug"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      &ldquo;{currentAffirmation.quote}&rdquo;
                    </motion.p>
                  </AnimatePresence>
                  <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#755CA6] mt-1">
                    {currentAffirmation.sub}
                  </p>
                </div>
              </div>

              {/* Subtle Affirmation Pagination Dots */}
              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                {HEALING_AFFIRMATIONS.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAffirmationIdx(idx)}
                    aria-label={`Kutipan ${idx + 1}`}
                    className={cn(
                      'h-1.5 rounded-full transition-all cursor-pointer',
                      affirmationIdx === idx
                        ? 'w-5 bg-[#6A4FA3]'
                        : 'w-1.5 bg-[#D8CEEE] hover:bg-[#B9A7E0]'
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Interactive Column: Frosted Glass Kiosk QR Scanner & Mindful Breathing Module */}
        {(showScannerPanel || showBreathingGuide) && (
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4 justify-between">
            {/* Module 1: Refined Glassmorphic Kiosk QR Scanner Card */}
            {showScannerPanel && (
              <div className="bg-white/78 backdrop-blur-md rounded-[26px] p-4 sm:p-5 border border-white/90 shadow-[0_12px_36px_rgba(36,22,59,0.06)] flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#F3EEFC] text-[#5E438F] flex items-center justify-center shrink-0">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-semibold text-[#1D1233] truncate">
                        Pindai Kartu QR di Sini
                      </h3>
                      <p className="text-[11px] text-slate-500 truncate">
                        Identifikasi kehadiran otomatis di layar TV
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isScanning && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextMode = facingMode === 'user' ? 'environment' : 'user';
                          setFacingMode(nextMode);
                          void startCamera(nextMode);
                        }}
                        className="p-1.5 rounded-lg bg-white/90 hover:bg-[#EAE2F8] text-[#5E438F] border border-[#E6DFF3] transition-colors cursor-pointer"
                        title="Ganti Kamera (Depan / Belakang)"
                      >
                        <SwitchCamera className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isScanning ? (
                      <button
                        type="button"
                        onClick={() => void stopCamera()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                      >
                        <CameraOff className="w-3.5 h-3.5" />
                        <span>Matikan</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void startCamera(facingMode)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#4E3580] hover:bg-[#3F2A69] text-white shadow-2xs transition-colors cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Aktifkan Kamera</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Luxury Soft-Framed Camera Viewport */}
                <div className="relative w-full h-[180px] sm:h-[195px] rounded-2xl overflow-hidden bg-white/85 border border-white shadow-inner flex items-center justify-center">
                  <div id="tv-welcome-qr-reader" className="w-full h-full" />

                  {!isScanning && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center"
                      style={{
                        background:
                          'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.95) 0%, rgba(244,239,253,0.9) 100%)',
                      }}
                    >
                      {/* Corner Viewfinder Accents */}
                      <div className="pointer-events-none absolute inset-3">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#B7A2E0] rounded-tl-md" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#B7A2E0] rounded-tr-md" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#B7A2E0] rounded-bl-md" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#B7A2E0] rounded-br-md" />
                      </div>

                      <div className="w-10 h-10 rounded-2xl bg-white border border-[#E6DFF3] shadow-2xs flex items-center justify-center mb-2 text-[#5E438F]">
                        <Camera className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold text-[#221638]">
                        Kamera Kiosk Siap Diaktifkan
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 max-w-[230px] leading-snug">
                        Aktifkan kamera agar peserta dapat memindai Kartu QR secara mandiri.
                      </p>
                      <button
                        type="button"
                        onClick={() => void startCamera(facingMode)}
                        className="mt-2.5 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#4E3580] hover:bg-[#3F2A69] text-white shadow-[0_4px_12px_rgba(78,53,128,0.18)] transition-all cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Mulai Pindai QR
                      </button>
                    </div>
                  )}
                </div>

                {cameraError && (
                  <p className="mt-2 text-[11px] text-amber-800 bg-amber-50/95 border border-amber-200/80 rounded-xl px-3 py-1.5">
                    {cameraError}
                  </p>
                )}

                {/* Quick ID Input / USB Barcode Scanner Input */}
                <form onSubmit={handleManualSubmit} className="mt-2.5 flex items-center gap-2">
                  <input
                    type="text"
                    value={manualIdInput}
                    onChange={(e) => setManualIdInput(e.target.value)}
                    placeholder="Ketik / Scan No. Presensi (mis. HY-001)..."
                    className="flex-1 px-3 py-1.5 bg-white/90 border border-[#E4DCF5] rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8E72CC]/40"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-xl bg-[#F3EEFC] hover:bg-[#E7DDF9] text-[#4A327A] text-xs font-semibold border border-[#E2D6F7] transition-colors cursor-pointer shrink-0"
                  >
                    Cek ID
                  </button>
                </form>
              </div>
            )}

            {/* Module 2: Guided Mindful Breathing Sanctuary Card */}
            {showBreathingGuide && (
              <div className="bg-white/78 backdrop-blur-md rounded-[26px] p-4 sm:p-5 border border-white/90 shadow-[0_12px_36px_rgba(36,22,59,0.06)] flex items-center gap-4 flex-1">
                {/* Animated Breathing Orb */}
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center shrink-0">
                  <motion.div
                    animate={{
                      scale:
                        breathPhase === 'INHALE' ? 1.22 : breathPhase === 'HOLD' ? 1.22 : 0.86,
                      opacity:
                        breathPhase === 'INHALE' ? 0.55 : breathPhase === 'HOLD' ? 0.65 : 0.25,
                    }}
                    transition={{
                      duration:
                        breathPhase === 'INHALE' ? 4 : breathPhase === 'HOLD' ? 0.6 : 6,
                      ease: 'easeInOut',
                    }}
                    className="absolute inset-1 rounded-full"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(142,114,204,0.42) 0%, rgba(144,184,248,0.22) 70%, transparent 100%)',
                    }}
                  />
                  <motion.div
                    animate={{
                      scale:
                        breathPhase === 'INHALE' ? 1.08 : breathPhase === 'HOLD' ? 1.08 : 0.92,
                    }}
                    transition={{
                      duration:
                        breathPhase === 'INHALE' ? 4 : breathPhase === 'HOLD' ? 0.6 : 6,
                      ease: 'easeInOut',
                    }}
                    className="relative w-20 h-20 rounded-full bg-white/95 shadow-[0_4px_16px_rgba(94,67,143,0.1)] border border-white flex flex-col items-center justify-center px-1 text-center"
                  >
                    <Wind className="w-3.5 h-3.5 text-[#6A4FA3] mb-0.5" />
                    <span className="text-[10px] font-bold text-[#221638] leading-tight">
                      {breathPhase === 'INHALE'
                        ? 'Tarik Napas'
                        : breathPhase === 'HOLD'
                          ? 'Tahan Lembut'
                          : 'Hembuskan'}
                    </span>
                    <span className="text-[9px] font-medium text-[#755CA6] mt-0.5">
                      {breathPhase === 'INHALE'
                        ? '4 detik'
                        : breathPhase === 'HOLD'
                          ? '4 detik'
                          : '6 detik'}
                    </span>
                  </motion.div>
                </div>

                {/* Breathing Text Guidance */}
                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase text-[#6A4FA3]">
                    <Sparkles className="w-3 h-3" />
                    <span>Jeda Relaksasi Sejenak</span>
                  </div>
                  <h3
                    className="text-lg sm:text-xl font-semibold text-[#1D1233] mt-0.5"
                    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                  >
                    Napas Kesadaran Penuh (4-4-6)
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    {breathPhase === 'INHALE'
                      ? 'Tarik napas perlahan melalui hidung, rasakan udara segar dan ketenangan...'
                      : breathPhase === 'HOLD'
                        ? 'Tahan napas dengan lembut tanpa ketegangan, sadari kehadiran Anda...'
                        : 'Hembuskan perlahan, lepaskan penat dan biarkan tubuh lebih rileks...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. BOTTOM HOSPITALITY FOOTER: RECENT ARRIVALS & VENUE METADATA */}
      <div className="relative z-10 pt-3.5 border-t border-white/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Recent Welcomed Guests Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#4E3580] shrink-0 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
            Baru Tiba ({attendedCount}/{totalCount}):
          </span>
          {recentCheckIns.slice(0, 5).map((p) => {
            const isSelected = spotlightParticipant?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSpotlightParticipant(p);
                  setScanStatusBanner({
                    type: 'ALREADY_CHECKED_IN',
                    message: `Peserta Teridentifikasi · Hadir Pukul ${
                      p.checkInTime ? format(new Date(p.checkInTime), 'HH:mm') : '-'
                    } WIB`,
                  });
                }}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer shrink-0 backdrop-blur-md',
                  isSelected
                    ? 'bg-[#4E3580] text-white border-[#4E3580] shadow-2xs'
                    : 'bg-white/80 hover:bg-white text-slate-700 border-white/90'
                )}
              >
                <CheckCircle2
                  className={cn(
                    'w-3.5 h-3.5 shrink-0',
                    isSelected ? 'text-emerald-300' : 'text-emerald-500'
                  )}
                />
                <span className="font-semibold truncate max-w-[150px]">{p.name}</span>
                <span
                  className={cn(
                    'font-mono text-[11px]',
                    isSelected ? 'text-purple-200' : 'text-[#6A4FA3]'
                  )}
                >
                  {p.id}
                </span>
              </button>
            );
          })}
          {recentCheckIns.length === 0 && (
            <span className="text-xs text-slate-600 italic font-medium">
              Menunggu peserta pertama melakukan pemindaian QR...
            </span>
          )}
        </div>

        {/* Venue & Schedule Metadata */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[#3B2A5E] shrink-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/75 backdrop-blur-xs border border-white/80">
            <Calendar className="w-3.5 h-3.5 text-[#6A4FA3]" />
            <span>
              {formatSafeDate(config.date)} · Pukul {formatSafeStartTime(config.startTime)} WIB
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/75 backdrop-blur-xs border border-white/80">
            <MapPin className="w-3.5 h-3.5 text-[#6A4FA3]" />
            <span>{config.location}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
