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
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  X,
  Wind,
  Eye,
  Camera,
  CameraOff,
  SwitchCamera,
  QrCode,
  AlertCircle,
  Heart,
  Leaf,
  Flower2,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const RETREAT_BG_IMAGE = '/src/assets/images/healing_retreat_meadow_1790765180863.jpg';

const HEALING_AFFIRMATIONS = [
  'Anda tidak perlu terburu-buru. Di ruangan ini, setiap perasaan dan perjalanan Anda dihargai.',
  'Terima kasih telah meluangkan waktu untuk hadir dan merawat ruang batin Anda hari ini.',
  'Setiap langkah kecil untuk memahami diri sendiri adalah awal dari ketenangan yang sesungguhnya.',
  'Izinkan diri Anda beristirahat sejenak dari hiruk-pikuk, tarik napas perlahan, dan hadir sepenuhnya di sini.',
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

function LotusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 4C9.5 7.5 9 11.5 12 16C15 11.5 14.5 7.5 12 4Z" />
      <path d="M12 16C8.5 14.5 5.5 11.5 5 7.5C8 8.5 10.2 10.5 12 16Z" />
      <path d="M12 16C15.5 14.5 18.5 11.5 19 7.5C16 8.5 13.8 10.5 12 16Z" />
      <path d="M12 16C7.5 16.5 4 15 2.5 12C5.5 12 8.5 13.5 12 16Z" />
      <path d="M12 16C16.5 16.5 20 15 21.5 12C18.5 12 15.5 13.5 12 16Z" />
      <path d="M7 19H17" />
    </svg>
  );
}

function TopLeftBotanicalSprig() {
  return (
    <svg
      viewBox="0 0 220 220"
      fill="none"
      className="pointer-events-none absolute top-3 left-3 w-32 h-32 sm:w-44 sm:h-44 opacity-85"
    >
      {/* Curved Stems */}
      <path
        d="M12 185 C35 135, 78 85, 145 32"
        stroke="#7D8C6E"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M42 135 C75 128, 108 112, 138 92"
        stroke="#8B9A7B"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M55 110 C52 78, 65 52, 85 26"
        stroke="#8B9A7B"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* Sage Leaves */}
      <path d="M35 145 C22 132, 26 114, 42 122 C44 132, 40 140, 35 145 Z" fill="#9CAF88" opacity="0.75" />
      <path d="M72 102 C86 108, 102 98, 92 86 C82 88, 76 95, 72 102 Z" fill="#8FA67E" opacity="0.7" />
      <path d="M98 68 C86 56, 92 40, 106 48 C108 56, 103 63, 98 68 Z" fill="#9CAF88" opacity="0.75" />
      {/* Soft Pink & Lavender Blossoms */}
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
      <g transform="translate(55, 132)">
        <circle cx="0" cy="0" r="6" fill="#D99SE2" opacity="0.6" />
        <ellipse cx="4" cy="-5" rx="5" ry="8" fill="#C892E0" opacity="0.75" transform="rotate(25)" />
        <ellipse cx="-4" cy="-4" rx="5" ry="8" fill="#E8A5C8" opacity="0.75" transform="rotate(-25)" />
      </g>
    </svg>
  );
}

function BottomRightBotanicalSprig() {
  return (
    <svg
      viewBox="0 0 220 220"
      fill="none"
      className="pointer-events-none absolute bottom-2 right-2 w-36 h-36 sm:w-48 sm:h-48 opacity-90"
    >
      {/* Lavender & Wildflower Stems */}
      <path
        d="M195 205 C175 155, 155 105, 138 45"
        stroke="#7D8C6E"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M185 208 C150 175, 115 150, 72 135"
        stroke="#8B9A7B"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M198 195 C188 145, 185 95, 178 55"
        stroke="#7D8C6E"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Leaves */}
      <path d="M155 165 C140 152, 145 136, 160 144 C162 152, 158 160, 155 165 Z" fill="#8FA67E" opacity="0.75" />
      <path d="M125 160 C115 172, 98 166, 108 152 C115 152, 121 156, 125 160 Z" fill="#9CAF88" opacity="0.75" />
      {/* Lavender Spikelets along stems */}
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
      {/* Lower Lavender-Pink Flowers */}
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
  const [affirmationIdx, setAffirmationIdx] = useState(0);
  const [breathPhase, setBreathPhase] = useState<'INHALE' | 'HOLD' | 'EXHALE'>('EXHALE');
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Spotlight & Scan Feedback State (starts null so the general welcome screen is shown first)
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

  // Rotate soothing affirmations every 12 seconds
  useEffect(() => {
    const timer = window.setInterval(() => {
      setAffirmationIdx((prev) => (prev + 1) % HEALING_AFFIRMATIONS.length);
    }, 12000);
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
        message: `PRESENSI BERHASIL TERCATAT · ${
          result.participant.status === 'LATE' ? 'HADIR TERLAMBAT' : 'HADIR TEPAT WAKTU'
        }`,
      });
      if (soundEnabledRef.current) {
        playCalmWelcomeChime('welcome');
      }
      return;
    }

    const matched = participantsRef.current.find(
      (p) => p.id.toUpperCase() === cleanCode.toUpperCase()
    );
    if (matched) {
      setSpotlightParticipant(matched);
      setScanStatusBanner({
        type: 'ALREADY_CHECKED_IN',
        message: `PESERTA TERIDENTIFIKASI · HADIR PUKUL ${
          matched.checkInTime ? format(new Date(matched.checkInTime), 'HH:mm') : '-'
        } WIB`,
      });
      if (soundEnabledRef.current) {
        playCalmWelcomeChime('welcome');
      }
    } else {
      setScanStatusBanner({
        type: 'NOT_FOUND',
        message: `KODE QR (${cleanCode}) TIDAK DITEMUKAN DALAM DAFTAR PESERTA`,
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
          'Akses kamera belum diizinkan oleh browser. Izinkan kamera atau gunakan input No. Presensi di bawah.'
        );
      }
    },
    [facingMode, stopCamera, handleIdentifyAndCheckIn]
  );

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  // Detect new remote check-ins from other devices via Cloud Sync
  useEffect(() => {
    if (isInitialMountRef.current) {
      const map: Record<string, string | undefined> = {};
      participants.forEach((p) => {
        map[p.id] = p.checkInTime;
      });
      prevCheckInMapRef.current = map;
      isInitialMountRef.current = false;
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
        message: `PRESENSI BERHASIL TERCATAT · ${
          newestArrival.status === 'LATE' ? 'HADIR TERLAMBAT' : 'HADIR TEPAT WAKTU'
        }`,
      });
      if (soundEnabled) {
        playCalmWelcomeChime('welcome');
      }
    }
  }, [participants, soundEnabled]);

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
    if (spotlightParticipant) {
      // Toggle back to general welcome screen if already showing a participant
      setSpotlightParticipant(null);
      setScanStatusBanner(null);
      return;
    }
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
      message: 'SIMULASI SAMBUTAN PESERTA · LAYAR SAMBUTAN SIAP DIGUNAKAN',
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
  const currentQuote = HEALING_AFFIRMATIONS[affirmationIdx];

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-[calc(100vh-6.5rem)] rounded-[28px] overflow-hidden flex flex-col justify-between select-none border border-white/80 shadow-[0_16px_48px_rgba(43,27,71,0.08)] bg-[#F5F0FA]"
    >
      {/* FULL-SCREEN 16:9 FLOWER MEADOW, PERGOLA & DISTANT BLUE MOUNTAINS/SEA BACKGROUND */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img
          src={RETREAT_BG_IMAGE}
          alt="Muslimah Healing Journey Flower Meadow"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center scale-[1.01]"
        />
        {/* Soft Airy Top Sky Gradient & Translucent Veil */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(250,248,255,0.82) 0%, rgba(246,242,255,0.22) 24%, rgba(246,242,255,0.18) 72%, rgba(245,238,255,0.55) 100%)',
          }}
        />
      </div>

      {/* 1. TOP HEADER BAR */}
      <div className="relative z-10 px-5 sm:px-8 lg:px-10 pt-4 sm:pt-5 pb-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Left: Heal You Brand & Event Title */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <HealYouLogo
            customLogoUrl={config.customLogoUrl}
            size={48}
            className="rounded-2xl shadow-sm shrink-0"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-[10px] sm:text-xs font-bold tracking-[0.18em] uppercase text-[#4B337E]">
                {config.organizer || 'MUSLIMAH HEALING JOURNEY'}
              </span>
              <span className="text-[#9E7CF0] font-bold">•</span>
              <span className="text-xs sm:text-sm font-semibold text-[#9D75EA]">
                {config.tagline || "Let's Heal"}
              </span>
            </div>
            <h1
              className="text-xl sm:text-2xl lg:text-[30px] font-bold text-[#22153B] tracking-wide uppercase leading-tight break-words mt-0.5"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              {config.name}
            </h1>
          </div>
        </div>

        {/* Right: Pill Controls matching the Reference Design */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Clock Pill */}
          <div className="px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-white shadow-2xs flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#5B3E96]" />
            <span className="font-mono text-xs sm:text-sm font-bold text-[#251840] tabular-nums">
              {format(currentTime, 'HH:mm:ss')} WIB
            </span>
          </div>

          {/* Scanner TV Pill */}
          <button
            type="button"
            onClick={() => {
              if (showScannerPanel && isScanning) {
                void stopCamera();
              }
              setShowScannerPanel((v) => !v);
            }}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs',
              showScannerPanel
                ? 'bg-[#68428B] text-white'
                : 'bg-white/90 text-[#4A327A] hover:bg-white'
            )}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Scanner TV</span>
          </button>

          {/* Panduan Napas Pill */}
          <button
            type="button"
            onClick={() => setShowBreathingGuide((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs',
              showBreathingGuide
                ? 'bg-[#EFE5FD] text-[#4C3282] border border-[#E2D2FC]'
                : 'bg-white/90 text-slate-600 hover:bg-white'
            )}
          >
            <Wind className="w-3.5 h-3.5 text-[#6A4FA3]" />
            <span>Panduan Napas</span>
          </button>

          {/* Nada Lembut Pill */}
          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs',
              soundEnabled
                ? 'bg-[#D8F7E2] text-[#1D683A] border border-[#BFEVCC]'
                : 'bg-white/90 text-slate-500 hover:bg-white'
            )}
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-[#228B4E]" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            <span>{soundEnabled ? 'Nada Lembut' : 'Nada Bisu'}</span>
          </button>

          {/* Tes Sambutan Pill */}
          <button
            type="button"
            onClick={triggerPreviewDemo}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-white/95 hover:bg-white text-[#3A2760] border border-white shadow-2xs transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-[#6A4FA3]" />
            <span>{spotlightParticipant ? 'Layar Utama' : 'Tes Sambutan'}</span>
          </button>

          {/* Fullscreen Pill */}
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-[#463766] hover:bg-[#372A52] text-white shadow-xs transition-all cursor-pointer"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Keluar Penuh</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Layar Penuh</span>
              </>
            )}
          </button>

          {onClose && !isFullscreen && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/90 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-white shadow-2xs transition-colors cursor-pointer"
              title="Kembali ke Dashboard"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. MAIN 16:9 SANCTUARY STAGE */}
      <div className="relative z-10 flex-1 px-5 sm:px-8 lg:px-10 py-3 sm:py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {/* Left Main Sanctuary Card with Botanical Corner Sprigs */}
        <div
          className={cn(
            'flex flex-col',
            showScannerPanel || showBreathingGuide
              ? 'lg:col-span-8'
              : 'lg:col-span-12 max-w-5xl mx-auto w-full'
          )}
        >
          <div className="flex-1 bg-white/82 backdrop-blur-md rounded-[28px] px-6 sm:px-12 py-8 sm:py-10 border border-white/90 shadow-[0_12px_40px_rgba(43,27,71,0.07)] flex flex-col items-center justify-between text-center relative overflow-hidden">
            {/* Botanical Watercolor Sprigs in Top-Left & Bottom-Right Corners */}
            <TopLeftBotanicalSprig />
            <BottomRightBotanicalSprig />

            {/* Top Pill Badge */}
            <div className="relative z-10 flex flex-wrap items-center justify-center gap-2">
              <div
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-bold tracking-[0.12em] uppercase',
                  scanStatusBanner?.type === 'NOT_FOUND'
                    ? 'bg-rose-100/90 text-rose-800 border border-rose-200'
                    : 'bg-[#EDE3FC] text-[#4C2F85] border border-[#DFCFFB]'
                )}
              >
                {scanStatusBanner?.type === 'NOT_FOUND' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                ) : (
                  <Leaf className="w-3.5 h-3.5 text-[#34A853] shrink-0" />
                )}
                <span>
                  {scanStatusBanner
                    ? scanStatusBanner.message
                    : 'KIOSK PRESENSI & SAMBUTAN MANDIRI'}
                </span>
              </div>

              {spotlightParticipant && (
                <button
                  type="button"
                  onClick={() => {
                    setSpotlightParticipant(null);
                    setScanStatusBanner(null);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/90 hover:bg-white text-slate-600 border border-purple-200/70 transition-colors cursor-pointer"
                  title="Kembali ke tampilan sambutan utama"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Tampilan</span>
                </button>
              )}
            </div>

            {/* Center Welcome Heading, Quote, & Lotus Divider */}
            <div className="relative z-10 my-auto py-4 max-w-2xl mx-auto">
              <AnimatePresence mode="wait">
                {spotlightParticipant ? (
                  <motion.div
                    key={spotlightParticipant.id + (spotlightParticipant.checkInTime || '')}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.45 }}
                  >
                    <p
                      className="text-lg sm:text-xl italic font-semibold text-[#694BA3]"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      Ahlan wa Sahlan · Selamat Datang,
                    </p>
                    <h2
                      className="mt-1 text-3xl sm:text-5xl lg:text-[50px] font-bold text-[#24163E] leading-tight tracking-tight break-words"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      {spotlightParticipant.name}
                    </h2>

                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-[#4A3575]">
                      <span className="px-3 py-1 rounded-full bg-purple-100/80 border border-purple-200/70">
                        {spotlightParticipant.role || 'Peserta Workshop'}
                      </span>
                      <span>•</span>
                      <span>{spotlightParticipant.institution}</span>
                      <span>•</span>
                      <span className="font-mono text-[#5B3E96] bg-white/90 px-3 py-1 rounded-full border border-purple-200/70">
                        No. Presensi: {spotlightParticipant.id}
                      </span>
                    </div>

                    <p className="mt-4 text-base sm:text-lg font-medium text-[#3F2E66] leading-relaxed">
                      &ldquo;{currentQuote}&rdquo;
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="default-welcome"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.45 }}
                  >
                    <h2
                      className="text-3xl sm:text-5xl lg:text-[50px] font-bold text-[#24163E] leading-tight tracking-tight"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      Selamat Datang Peserta Workshop
                    </h2>

                    <AnimatePresence mode="wait">
                      <motion.p
                        key={affirmationIdx}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="mt-3.5 text-base sm:text-xl font-medium text-[#3B2B60] leading-relaxed max-w-xl mx-auto"
                      >
                        &ldquo;{currentQuote}&rdquo;
                      </motion.p>
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Lotus Ornamental Divider */}
              <div className="my-5 flex items-center justify-center gap-4 max-w-md mx-auto">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#C6B4E8] to-[#B59EE0]" />
                <LotusIcon className="w-5 h-5 text-[#6D4CA8] shrink-0" />
                <div className="flex-1 h-px bg-gradient-to-l from-transparent via-[#C6B4E8] to-[#B59EE0]" />
              </div>

              <p className="text-xs sm:text-sm font-medium text-[#4D3F6B] max-w-lg mx-auto leading-relaxed">
                Arahkan Kartu Tanda Pengenal QR Anda ke kamera di sebelah kanan untuk check-in
                dan identifikasi kehadiran secara langsung.
              </p>
            </div>

            {/* Bottom 4 Circular Wellness Pillars */}
            <div className="relative z-10 w-full max-w-2xl mx-auto pt-2 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              {/* 1. Tenang */}
              <div className="flex flex-col items-center">
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#EFE7FC] border border-[#E1D2FA] flex items-center justify-center text-[#6A45A8] shadow-2xs">
                  <LotusIcon className="w-6 h-6" />
                </div>
                <p className="mt-2.5 text-xs sm:text-sm font-bold text-[#251840]">Tenang</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Ambil napas dalam</p>
              </div>

              {/* 2. Hadiri */}
              <div className="flex flex-col items-center">
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#FCE8EF] border border-[#F7D1DF] flex items-center justify-center text-[#C84B7C] shadow-2xs">
                  <Heart className="w-6 h-6" />
                </div>
                <p className="mt-2.5 text-xs sm:text-sm font-bold text-[#251840]">Hadiri</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Nikmati prosesnya</p>
              </div>

              {/* 3. Pulih */}
              <div className="flex flex-col items-center">
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#DEF7E5] border border-[#C5EED1] flex items-center justify-center text-[#238B4D] shadow-2xs">
                  <Leaf className="w-6 h-6" />
                </div>
                <p className="mt-2.5 text-xs sm:text-sm font-bold text-[#251840]">Pulih</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Temukan versi terbaikmu</p>
              </div>

              {/* 4. Bertumbuh */}
              <div className="flex flex-col items-center">
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#EFE7FC] border border-[#E1D2FA] flex items-center justify-center text-[#6A45A8] shadow-2xs">
                  <Flower2 className="w-6 h-6" />
                </div>
                <p className="mt-2.5 text-xs sm:text-sm font-bold text-[#251840]">Bertumbuh</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Bersama komunitas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: QR Scanner Card & Mindful Breathing Card */}
        {(showScannerPanel || showBreathingGuide) && (
          <div className="lg:col-span-4 flex flex-col gap-4 justify-between">
            {/* Top-Right Card: Pindai Kartu QR di Sini */}
            {showScannerPanel && (
              <div className="bg-white/90 backdrop-blur-md rounded-[26px] p-5 border border-white shadow-[0_10px_32px_rgba(43,27,71,0.07)] flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#F3ECFC] text-[#5B3E96] flex items-center justify-center shrink-0">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-[#22153B] truncate">
                        Pindai Kartu QR di Sini
                      </h3>
                      <p className="text-[11px] text-slate-500 truncate">
                        Identifikasi peserta otomatis di layar TV
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
                        className="p-1.5 rounded-full bg-purple-50 hover:bg-purple-100 text-[#5B3E96] border border-purple-200 transition-colors cursor-pointer"
                        title="Ganti Kamera (Depan / Belakang)"
                      >
                        <SwitchCamera className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isScanning ? (
                      <button
                        type="button"
                        onClick={() => void stopCamera()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
                      >
                        <CameraOff className="w-3.5 h-3.5" />
                        <span>Matikan</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void startCamera(facingMode)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#68428B] hover:bg-[#563475] text-white shadow-2xs transition-colors cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Aktifkan Kamera</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Deep Indigo-Plum Camera Viewport Box matching Reference */}
                <div className="relative w-full h-[185px] sm:h-[195px] rounded-2xl overflow-hidden bg-[#352852] flex items-center justify-center">
                  <div id="tv-welcome-qr-reader" className="w-full h-full" />

                  {!isScanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-[#352852] text-white">
                      <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center mb-2.5">
                        <Camera className="w-5 h-5 text-purple-100" />
                      </div>
                      <p className="text-xs sm:text-[13px] font-bold text-white">
                        Kamera Kiosk Layar TV Siap Diaktifkan
                      </p>
                      <p className="text-[11px] text-purple-100/80 mt-1 max-w-[260px] leading-snug">
                        Klik tombol Aktifkan Kamera agar peserta dapat memindai kartu QR mereka
                        sendiri di depan layar ini.
                      </p>
                      <button
                        type="button"
                        onClick={() => void startCamera(facingMode)}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-white text-[#2B1B47] hover:bg-purple-50 shadow-sm transition-all cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#68428B]" />
                        <span>Mulai Pindai QR</span>
                      </button>
                    </div>
                  )}
                </div>

                {cameraError && (
                  <p className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                    {cameraError}
                  </p>
                )}

                {/* Quick ID Input Row */}
                <form onSubmit={handleManualSubmit} className="mt-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={manualIdInput}
                    onChange={(e) => setManualIdInput(e.target.value)}
                    placeholder="Ketik/ Scan No. Presensi (mis. HY-001)..."
                    className="flex-1 px-3.5 py-2 bg-[#FAF8FF] border border-[#E5DCF5] rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8E72CC]/40"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#EBE1FC] hover:bg-[#DFCFFA] text-[#563B8C] text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Cek ID
                  </button>
                </form>
              </div>
            )}

            {/* Bottom-Right Card: JEDA RELAKSASI SEJENAK · Napas Kesadaran Penuh */}
            {showBreathingGuide && (
              <div className="bg-white/90 backdrop-blur-md rounded-[26px] p-5 border border-white shadow-[0_10px_32px_rgba(43,27,71,0.07)] flex flex-col items-center justify-center text-center flex-1">
                <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.14em] uppercase text-[#583B92]">
                  JEDA RELAKSASI SEJENAK
                </span>
                <h3
                  className="text-xl sm:text-2xl font-bold text-[#22153B] mt-0.5"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  Napas Kesadaran Penuh
                </h3>

                {/* Centered Lavender Ring Breathing Indicator */}
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 my-3.5 flex items-center justify-center">
                  <motion.div
                    animate={{
                      scale:
                        breathPhase === 'INHALE' ? 1.08 : breathPhase === 'HOLD' ? 1.08 : 0.94,
                    }}
                    transition={{
                      duration:
                        breathPhase === 'INHALE' ? 4 : breathPhase === 'HOLD' ? 0.6 : 6,
                      ease: 'easeInOut',
                    }}
                    className="w-26 h-26 sm:w-28 sm:h-28 rounded-full bg-white border-[7px] border-[#DFC7FA] shadow-[0_4px_20px_rgba(138,100,214,0.12)] flex flex-col items-center justify-center px-2"
                  >
                    <Wind className="w-4 h-4 text-[#3B2863] mb-0.5" />
                    <span className="text-xs font-bold text-[#22153B] leading-tight">
                      {breathPhase === 'INHALE'
                        ? 'Tarik Napas...'
                        : breathPhase === 'HOLD'
                          ? 'Tahan Lembut...'
                          : 'Hembuskan...'}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 mt-0.5">
                      {breathPhase === 'INHALE'
                        ? '4 detik'
                        : breathPhase === 'HOLD'
                          ? '4 detik'
                          : '6 detik'}
                    </span>
                  </motion.div>
                </div>

                <p className="text-xs text-slate-600 max-w-[230px] leading-relaxed">
                  Biarkan bahu Anda rileks dan hadir dengan hati yang tenang.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. FULL-WIDTH BOTTOM FROSTED FOOTER BAR */}
      <div className="relative z-10 bg-white/85 backdrop-blur-md border-t border-white px-5 sm:px-8 lg:px-10 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        {/* Left: BARU TIBA Status & Recent Guest Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#4C2F85] shrink-0">
            <Leaf className="w-3.5 h-3.5 text-[#34A853]" />
            <span>
              BARU TIBA ({attendedCount}/{totalCount}):
            </span>
          </span>

          {recentCheckIns.length > 0 ? (
            recentCheckIns.slice(0, 5).map((p) => {
              const isSelected = spotlightParticipant?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSpotlightParticipant(p);
                    setScanStatusBanner({
                      type: 'ALREADY_CHECKED_IN',
                      message: `PESERTA TERIDENTIFIKASI · HADIR PUKUL ${
                        p.checkInTime ? format(new Date(p.checkInTime), 'HH:mm') : '-'
                      } WIB`,
                    });
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shrink-0',
                    isSelected
                      ? 'bg-[#68428B] text-white border-[#68428B]'
                      : 'bg-purple-50/90 hover:bg-purple-100 text-[#3B2863] border-purple-200/80'
                  )}
                >
                  <CheckCircle2
                    className={cn(
                      'w-3.5 h-3.5 shrink-0',
                      isSelected ? 'text-emerald-300' : 'text-emerald-600'
                    )}
                  />
                  <span className="truncate max-w-[150px]">{p.name}</span>
                  <span className="font-mono text-[11px] opacity-80">{p.id}</span>
                </button>
              );
            })
          ) : (
            <span className="text-xs font-medium text-slate-600">
              Menunggu peserta pertama melakukan pemindaian QR...
            </span>
          )}
        </div>

        {/* Right: Date & Uppercase Location */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[#2E204B] shrink-0">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#5B3E96]" />
            <span>{formatSafeDate(config.date)}</span>
          </span>
          <span className="text-[#9E7CF0]">•</span>
          <span className="inline-flex items-center gap-1.5 uppercase tracking-wide">
            <MapPin className="w-3.5 h-3.5 text-[#5B3E96]" />
            <span>{config.location}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
