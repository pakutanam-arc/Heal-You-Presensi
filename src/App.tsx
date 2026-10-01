import React, { useState, useRef, useEffect, useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { AppProvider, useAppContext } from './store';
import { Participant } from './types';
import { Dashboard } from './components/Dashboard';
import { Scanner, ScannerPurpose } from './components/Scanner';
import {
  CertificateVerificationPanel,
  resolveCertificateVerification,
  VerificationLookupResult,
} from './components/CertificateVerificationPanel';
import { Registration } from './components/Registration';
import { WelcomeDisplay } from './components/WelcomeDisplay';
import { DigitalTicketView } from './components/DigitalTicketView';
import { ParticipantPortalView } from './components/ParticipantPortalView';
import { LoginView } from './components/LoginView';
import { HealYouLogo } from './components/HealYouLogo';
import {
  parseDigitalTicketFromUrl,
  parseParticipantPortalFromUrl,
} from './lib/whatsapp';
import {
  buildCertificateVerificationUrl,
  getCanonicalParticipantSeqIndex,
} from './lib/certificateRenderer';
import { buildSignedParticipantQrValue } from './lib/qrSecurity';
import {
  LayoutDashboard,
  Calendar,
  MapPin,
  RotateCcw,
  UserPlus,
  Pencil,
  Check,
  X,
  Cloud,
  LogOut,
  CheckCircle2,
  Clock,
  QrCode,
  UserCheck,
  Activity,
  FolderKanban,
  Plus,
  Trash2,
  ChevronDown,
  Tv,
  ShieldCheck,
  Share2,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from './lib/utils';
import { playScanBeep } from './lib/sound';

function formatSafeDate(dateStr: string, pattern: string) {
  try {
    const parsed = dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T00:00:00`);
    if (isNaN(parsed.getTime())) return dateStr;
    return format(parsed, pattern);
  } catch {
    return dateStr;
  }
}

function AppContent() {
  const {
    participants,
    config,
    certificateSettings,
    eventsList,
    activeWorkshopId,
    switchWorkshop,
    createNewWorkshop,
    deleteWorkshop,
    updateConfig,
    setSelectedParticipantId,
    checkIn,
    resetAttendance,
    resetData,
    cloudUser,
    authSession,
    isAuthenticated,
    isAdmin,
    isPanitia,
    canManageParticipants,
    isCloudSyncing,
    logoutApp,
    connectCloud,
    disconnectCloud,
  } = useAppContext();
  const [isPublicRegistrationOpen, setIsPublicRegistrationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'scanner' | 'welcome' | 'registration'
  >(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('verify_cert=')) {
      return 'scanner';
    }
    return 'dashboard';
  });
  const [scannerPurpose, setScannerPurpose] = useState<ScannerPurpose>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('verify_cert=')) {
      return 'verify_cert';
    }
    return 'checkin';
  });
  const [certVerificationTarget, setCertVerificationTarget] =
    useState<VerificationLookupResult | null>(null);
  const [digitalTicketData, setDigitalTicketData] = useState(() => parseDigitalTicketFromUrl());
  const [participantPortalUrlData] = useState(() => parseParticipantPortalFromUrl());
  const [adminPortalPreview, setAdminPortalPreview] = useState<'register' | 'certificate' | null>(
    null
  );

  // Switch to the target workshop event if opened via ?portal=peserta&evt=...
  useEffect(() => {
    if (
      participantPortalUrlData?.workshopId &&
      participantPortalUrlData.workshopId !== activeWorkshopId
    ) {
      switchWorkshop(participantPortalUrlData.workshopId);
    }
  }, [participantPortalUrlData]);

  const handleTriggerCertificateVerification = (rawCodeOrId: string) => {
    const result = resolveCertificateVerification(
      rawCodeOrId,
      participants,
      certificateSettings.numberSuffix,
      activeWorkshopId
    );
    setCertVerificationTarget(result);
    setScannerPurpose('verify_cert');
    setActiveTab('scanner');
  };

  // Automatically verify certificate if opened via ?verify_cert=... QR link
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const verifyCertParam = params.get('verify_cert');
    if (verifyCertParam) {
      const evtParam = params.get('evt');
      if (evtParam && evtParam !== activeWorkshopId) {
        switchWorkshop(evtParam);
      }
      const result = resolveCertificateVerification(
        window.location.href,
        participants,
        certificateSettings.numberSuffix,
        evtParam || activeWorkshopId
      );
      setCertVerificationTarget(result);
      setScannerPurpose('verify_cert');
      setActiveTab('scanner');
    }
  }, [participants.length, certificateSettings.numberSuffix, activeWorkshopId]);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [isEventsMenuOpen, setIsEventsMenuOpen] = useState(false);
  const [isCreatingNewEvent, setIsCreatingNewEvent] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [focusField, setFocusField] = useState<'date' | 'location'>('date');

  // New Event Form State
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [newEventTime, setNewEventTime] = useState('08:00');
  const [newEventLocation, setNewEventLocation] = useState('Auditorium Psikologi, Gedung B Lt. 3');
  const [copyExistingParticipants, setCopyExistingParticipants] = useState(false);

  // If connected to Cloud with a non-admin email, restrict away from 'registration' (Buat QR)
  useEffect(() => {
    if (!canManageParticipants && activeTab === 'registration') {
      setActiveTab('dashboard');
    }
    if (!canManageParticipants && isEditingEvent) {
      setIsEditingEvent(false);
    }
  }, [canManageParticipants, activeTab, isEditingEvent]);

  const [draftName, setDraftName] = useState(config.name);
  const [draftDate, setDraftDate] = useState(config.date);
  const [draftLocation, setDraftLocation] = useState(config.location);
  const [draftTime, setDraftTime] = useState(() => {
    try {
      return format(new Date(config.startTime), 'HH:mm');
    } catch {
      return '08:00';
    }
  });

  const dateInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const openEditor = (field: 'date' | 'location') => {
    setIsEventsMenuOpen(false);
    setDraftName(config.name);
    setDraftDate(config.date);
    setDraftLocation(config.location);
    try {
      setDraftTime(format(new Date(config.startTime), 'HH:mm'));
    } catch {
      setDraftTime('08:00');
    }
    setFocusField(field);
    setIsEditingEvent(true);
  };

  useEffect(() => {
    if (isEditingEvent) {
      setTimeout(() => {
        if (focusField === 'date') {
          dateInputRef.current?.focus();
        } else {
          locationInputRef.current?.focus();
          locationInputRef.current?.select();
        }
      }, 20);
    }
  }, [isEditingEvent, focusField]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsEditingEvent(false);
        setIsEventsMenuOpen(false);
        setIsCreatingNewEvent(false);
      }
    };
    if (isEditingEvent || isEventsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditingEvent, isEventsMenuOpen]);

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = draftName.trim() || config.name;
    const cleanLocation = draftLocation.trim() || config.location;
    const cleanDate = draftDate || config.date;

    let newStartTime = config.startTime;
    if (cleanDate && draftTime) {
      const combined = new Date(`${cleanDate}T${draftTime}:00`);
      if (!isNaN(combined.getTime())) {
        newStartTime = combined.toISOString();
      }
    }

    updateConfig({
      name: cleanName,
      date: cleanDate,
      location: cleanLocation,
      startTime: newStartTime,
    });
    setIsEditingEvent(false);
  };

  const handleCreateNewEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;

    const cleanDate = newEventDate || format(new Date(), 'yyyy-MM-dd');
    const cleanTime = newEventTime || '08:00';
    const combined = new Date(`${cleanDate}T${cleanTime}:00`);
    const isoStart = !isNaN(combined.getTime())
      ? combined.toISOString()
      : new Date().toISOString();

    await createNewWorkshop({
      name: newEventName.trim(),
      date: cleanDate,
      startTime: isoStart,
      location: newEventLocation.trim() || config.location,
      copyParticipants: copyExistingParticipants,
    });

    setNewEventName('');
    setCopyExistingParticipants(false);
    setIsCreatingNewEvent(false);
    setIsEventsMenuOpen(false);
  };

  // Live check-in feed & stats for the Kiosk Scanner View
  const kioskData = useMemo(() => {
    const total = participants.length;
    const checkedIn = participants
      .filter((p) => p.status !== 'PENDING')
      .sort((a, b) => {
        const tA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
        const tB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
        return tB - tA;
      });
    const pending = participants.filter((p) => p.status === 'PENDING');
    const presentCount = participants.filter((p) => p.status === 'PRESENT').length;
    const lateCount = participants.filter((p) => p.status === 'LATE').length;
    const rate = total > 0 ? Math.round((checkedIn.length / total) * 100) : 0;
    return { total, checkedIn, pending, presentCount, lateCount, rate };
  }, [participants]);

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9fe]">
      {/* Hidden QR Code Canvas Registry so any participant's PNG ID Card & E-Certificate can be generated anywhere */}
      <div className="sr-only pointer-events-none" aria-hidden="true">
        {participants.map((p) => (
          <React.Fragment key={p.id}>
            <QRCodeCanvas
              id={`global-qr-${p.id}`}
              value={buildSignedParticipantQrValue(p.id, activeWorkshopId)}
              size={320}
              level="H"
              minVersion={4}
              marginSize={2}
              fgColor="#261742"
              bgColor="#ffffff"
            />
            <QRCodeCanvas
              id={`global-cert-qr-${p.id}`}
              value={buildCertificateVerificationUrl(
                p,
                getCanonicalParticipantSeqIndex(p.id, participants),
                activeWorkshopId
              )}
              size={320}
              level="M"
              marginSize={2}
              fgColor="#261742"
              bgColor="#ffffff"
            />
          </React.Fragment>
        ))}
      </div>

      {participantPortalUrlData ? (
        <ParticipantPortalView
          initialTab={participantPortalUrlData.initialTab}
          configFallback={participantPortalUrlData.configFallback}
          isAdminPreview={false}
        />
      ) : isPublicRegistrationOpen && !isAuthenticated ? (
        <div className="relative min-h-screen flex flex-col">
          <ParticipantPortalView initialTab="register" isAdminPreview={false} />
          <div className="fixed bottom-4 right-4 z-50">
            <button
              type="button"
              onClick={() => setIsPublicRegistrationOpen(false)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#2b1b47]/95 hover:bg-[#2b1b47] text-white shadow-lg border border-purple-300/30 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>Login Admin / Panitia</span>
            </button>
          </div>
        </div>
      ) : !isAuthenticated ? (
        <LoginView onOpenPublicRegistration={() => setIsPublicRegistrationOpen(true)} />
      ) : adminPortalPreview && canManageParticipants ? (
        <ParticipantPortalView
          initialTab={adminPortalPreview}
          isAdminPreview={true}
          onExitAdminPreview={() => setAdminPortalPreview(null)}
        />
      ) : digitalTicketData ? (
        <DigitalTicketView
          participant={
            participants.find((p) => p.id === digitalTicketData.participant.id) ||
            digitalTicketData.participant
          }
          config={digitalTicketData.config}
          onExitTicketMode={() => {
            setDigitalTicketData(null);
            if (typeof window !== 'undefined' && window.location.search.includes('ticket=')) {
              window.history.replaceState({}, '', window.location.pathname);
            }
          }}
        />
      ) : (
        <>
          {/* Header */}
          <header className="bg-white border-b border-purple-100 sticky top-0 z-30">
            <div className="w-full max-w-[1680px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
              {/* Left: Brand + Desktop Navigation */}
              <div className="flex items-center gap-3 xl:gap-5 min-w-0">
                <div className="flex items-center gap-2.5 shrink-0">
                  <HealYouLogo
                    customLogoUrl={config.customLogoUrl}
                    size={36}
                    className="rounded-lg shadow-2xs shrink-0"
                  />
                  <div className="min-w-0">
                    <h1
                      className="text-lg sm:text-xl font-bold text-slate-900 leading-none truncate"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      Heal You
                    </h1>
                    <p className="text-[10px] sm:text-[11px] text-[#5e438f] font-medium mt-0.5 truncate">
                      Workshop Presensi
                    </p>
                  </div>
                </div>

                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center gap-1 p-1 bg-purple-50/70 border border-purple-100 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs xl:text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap',
                      activeTab === 'dashboard'
                        ? 'bg-white text-[#2b1b47] shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <LayoutDashboard className="w-4 h-4 text-[#5e438f] shrink-0" />
                    <span>Dashboard</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('scanner')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs xl:text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap',
                      activeTab === 'scanner'
                        ? 'bg-white text-[#2b1b47] shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <CameraIcon />
                    <span>Scanner QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('welcome')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs xl:text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap',
                      activeTab === 'welcome'
                        ? 'bg-white text-[#2b1b47] shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                    title="Mode Layar Sambutan Penuh untuk TV / Proyektor"
                  >
                    <Tv className="w-4 h-4 text-[#5e438f] shrink-0" />
                    <span>Layar TV</span>
                  </button>
                  {canManageParticipants && (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveTab('registration')}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 text-xs xl:text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap',
                          activeTab === 'registration'
                            ? 'bg-white text-[#2b1b47] shadow-2xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        )}
                      >
                        <UserPlus className="w-4 h-4 text-[#5e438f] shrink-0" />
                        <span>Pendaftaran &amp; Kartu</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminPortalPreview('register')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs xl:text-sm font-semibold rounded-lg text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-colors cursor-pointer whitespace-nowrap"
                        title="Buka Halaman Pendaftaran Mandiri & Klaim Sertifikat Khusus Peserta"
                      >
                        <Share2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>Portal Peserta</span>
                      </button>
                    </>
                  )}
                </nav>
              </div>

              {/* Right: Unified Event Selector Capsule + Account Pill */}
              <div
                ref={popoverRef}
                className="relative flex items-center justify-end gap-2 text-sm text-slate-600 shrink-0"
              >
                {/* Unified Event & Schedule Capsule */}
                <div className="flex items-center bg-purple-50/70 border border-purple-200/80 rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingEvent(false);
                      setIsCreatingNewEvent(false);
                      setIsEventsMenuOpen((prev) => !prev);
                    }}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                      isEventsMenuOpen
                        ? 'bg-[#5e438f] text-white'
                        : 'text-[#4c3575] hover:bg-purple-100/70'
                    )}
                    title={`${config.name} · ${formatSafeDate(config.date, 'dd MMM yyyy')} · ${config.location}`}
                  >
                    <FolderKanban className="w-3.5 h-3.5 shrink-0" />
                    <span className="max-w-[110px] sm:max-w-[160px] xl:max-w-[210px] truncate">
                      {config.name}
                    </span>
                    <span className="hidden md:inline text-[11px] font-normal opacity-80 whitespace-nowrap">
                      · {formatSafeDate(config.date, 'dd MMM')}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-75 shrink-0" />
                  </button>

                  {canManageParticipants && (
                    <button
                      type="button"
                      onClick={() => openEditor('date')}
                      title="Ubah jadwal, tanggal & lokasi acara aktif"
                      className={cn(
                        'hidden sm:inline-flex items-center justify-center p-1.5 rounded-lg transition-colors cursor-pointer',
                        isEditingEvent
                          ? 'bg-[#5e438f] text-white'
                          : 'text-[#5e438f] hover:bg-purple-100/80'
                      )}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Cloud Sync Button / Status (Compact) */}
                {(isAdmin || isPanitia) &&
                  (cloudUser ? (
                    <span
                      className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/90 px-2.5 py-1.5 rounded-xl shrink-0"
                      title={`Terhubung ke Firebase Cloud (${cloudUser.email})`}
                    >
                      <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden xl:inline">Cloud Aktif</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        setCloudError(null);
                        try {
                          await connectCloud();
                        } catch (err) {
                          setCloudError(
                            err instanceof Error && err.message
                              ? err.message
                              : 'Login Google dibatalkan atau gagal.'
                          );
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5e438f] bg-purple-50 hover:bg-purple-100 border border-purple-200/80 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
                      title="Sinkronkan dengan Google Cloud (Firebase)"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">
                        {isCloudSyncing ? 'Sync...' : 'Cloud Sync'}
                      </span>
                    </button>
                  ))}

                {/* User Role & Logout Pill */}
                <div
                  className={cn(
                    'flex items-center gap-1.5 border pl-2.5 pr-1.5 py-1 rounded-xl text-xs font-medium shrink-0',
                    isAdmin
                      ? 'bg-emerald-50/90 border-emerald-200/90 text-emerald-900'
                      : 'bg-purple-50 border-purple-200/90 text-[#4c3575]'
                  )}
                  title={
                    isAdmin
                      ? `Admin (${authSession?.identifier}) - Akses Penuh`
                      : `${authSession?.displayName || 'Panitia'} - Akses Dashboard Kehadiran, Scanner & Layar TV`
                  }
                >
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      isAdmin ? 'bg-emerald-500' : 'bg-[#5e438f]'
                    )}
                  />
                  <span className="font-semibold">
                    {isAdmin ? 'Admin' : authSession?.displayName || 'Panitia'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPublicRegistrationOpen(false);
                      void logoutApp();
                    }}
                    title="Keluar (Logout) dari akun saat ini"
                    className="ml-0.5 inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200/80 hover:border-rose-200 rounded-lg transition-colors cursor-pointer text-[11px] font-semibold"
                  >
                    <LogOut className="w-3 h-3" />
                    <span className="hidden sm:inline">Keluar</span>
                  </button>
                </div>

                {/* Popover 1: Multi-Event Manager & History Switcher */}
                {isEventsMenuOpen && (
                  <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-96 bg-white rounded-2xl shadow-xl border border-purple-100 p-4 z-50 text-slate-900">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Daftar &amp; Pengaturan Acara ({eventsList.length})
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Pilih sesi workshop atau kelola jadwal acara aktif
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEventsMenuOpen(false);
                          setIsCreatingNewEvent(false);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {!isCreatingNewEvent ? (
                      <>
                        <div className="mt-3 max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                          {eventsList.map((ev) => {
                            const isCurrent = ev.workshopId === activeWorkshopId;
                            return (
                              <div
                                key={ev.workshopId}
                                className={cn(
                                  'p-3 flex items-center justify-between gap-2 transition-colors',
                                  isCurrent ? 'bg-purple-50/70' : 'hover:bg-slate-50'
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    switchWorkshop(ev.workshopId);
                                    setIsEventsMenuOpen(false);
                                  }}
                                  className="flex-1 min-w-0 text-left cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <p
                                      className={cn(
                                        'text-xs font-semibold truncate',
                                        isCurrent ? 'text-[#2b1b47]' : 'text-slate-800'
                                      )}
                                    >
                                      {ev.config.name}
                                    </p>
                                    {isCurrent && (
                                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#5e438f] text-white rounded shrink-0">
                                        Aktif
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                    {formatSafeDate(ev.config.date, 'dd MMM yyyy')} ·{' '}
                                    {ev.config.location}
                                  </p>
                                </button>

                                {canManageParticipants && eventsList.length > 1 && !isCurrent && (
                                  <button
                                    type="button"
                                    onClick={() => void deleteWorkshop(ev.workshopId)}
                                    title="Hapus acara ini dari riwayat"
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {canManageParticipants && (
                          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => openEditor('date')}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5 text-[#5e438f]" />
                                Ubah Jadwal &amp; Lokasi
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsCreatingNewEvent(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#5e438f] hover:bg-[#4c3575] text-white rounded-xl transition-colors cursor-pointer shadow-2xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Buat Acara Baru
                              </button>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[11px] text-slate-400">
                                Atur ulang peserta acara ini ke awal:
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEventsMenuOpen(false);
                                  setIsConfirmingReset(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Reset Data Default
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                  <form onSubmit={handleCreateNewEventSubmit} className="mt-3 space-y-3">
                    <div>
                      <label
                        htmlFor="new-event-name"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Nama Acara Workshop Baru
                      </label>
                      <input
                        id="new-event-name"
                        type="text"
                        required
                        value={newEventName}
                        onChange={(e) => setNewEventName(e.target.value)}
                        placeholder="Contoh: Batch 2: Mindfulness & Regulasi Emosi"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="new-event-date"
                          className="block text-xs font-medium text-slate-700 mb-1"
                        >
                          Tanggal
                        </label>
                        <input
                          id="new-event-date"
                          type="date"
                          required
                          value={newEventDate}
                          onChange={(e) => setNewEventDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="new-event-time"
                          className="block text-xs font-medium text-slate-700 mb-1"
                        >
                          Jam Mulai
                        </label>
                        <input
                          id="new-event-time"
                          type="time"
                          required
                          value={newEventTime}
                          onChange={(e) => setNewEventTime(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="new-event-loc"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Tempat / Lokasi
                      </label>
                      <input
                        id="new-event-loc"
                        type="text"
                        required
                        value={newEventLocation}
                        onChange={(e) => setNewEventLocation(e.target.value)}
                        placeholder="Contoh: Auditorium Psikologi Lt. 3"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>

                    <label className="flex items-start gap-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={copyExistingParticipants}
                        onChange={(e) => setCopyExistingParticipants(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-[#5e438f] focus:ring-purple-400"
                      />
                      <span className="text-xs text-slate-600 leading-snug">
                        Salin daftar peserta dari acara saat ini (status kehadiran di-reset ke{' '}
                        <strong>Belum Hadir</strong>)
                      </span>
                    </label>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingNewEvent(false)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        Kembali
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#5e438f] hover:bg-[#4c3575] text-white rounded-lg transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Simpan &amp; Buka Acara
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Popover 2: Editor for Active Event Date & Location */}
            {isEditingEvent && (
              <form
                onSubmit={handleSaveEvent}
                className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-96 bg-white rounded-2xl shadow-lg border border-purple-100 p-4 z-50 text-slate-900"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Ubah Jadwal &amp; Lokasi Workshop
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEditingEvent(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <label
                      htmlFor="edit-name"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Nama Acara Workshop
                    </label>
                    <input
                      id="edit-name"
                      type="text"
                      required
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder="Masukkan nama acara workshop..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="edit-date"
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        Tanggal
                      </label>
                      <input
                        ref={dateInputRef}
                        id="edit-date"
                        type="date"
                        required
                        value={draftDate}
                        onChange={(e) => setDraftDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="edit-time"
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        Jam Mulai
                      </label>
                      <input
                        id="edit-time"
                        type="time"
                        required
                        value={draftTime}
                        onChange={(e) => setDraftTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="edit-location"
                      className="block text-xs font-medium text-slate-600 mb-1"
                    >
                      Tempat / Lokasi
                    </label>
                    <input
                      ref={locationInputRef}
                      id="edit-location"
                      type="text"
                      required
                      value={draftLocation}
                      onChange={(e) => setDraftLocation(e.target.value)}
                      placeholder="Masukkan nama tempat atau ruangan..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingEvent(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#5e438f] hover:bg-[#4c3575] text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </header>

      {cloudError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex flex-wrap items-center justify-center gap-2.5">
          <span className="font-medium text-center">{cloudError}</span>
          {cloudError.includes('Authorized Domains') && typeof window !== 'undefined' && (
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(window.location.hostname);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-semibold cursor-pointer transition-colors"
              >
                Salin Domain ({window.location.hostname})
              </button>
              <a
                href="https://console.firebase.google.com/project/gen-lang-client-0421236941/authentication/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg bg-[#5e438f] hover:bg-[#4c3575] text-white font-semibold transition-colors"
              >
                Buka Firebase Console
              </a>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCloudError(null)}
            className="underline font-semibold cursor-pointer ml-1"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1680px] mx-auto p-4 sm:p-6 lg:p-8 flex gap-6 flex-col">
        {/* Mobile/Tablet Tabs Navigation */}
        <div
          className={cn(
            'grid lg:hidden gap-1.5 bg-white p-1.5 rounded-xl shadow-xs border border-purple-100 w-full max-w-2xl mx-auto',
            canManageParticipants ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-3'
          )}
        >
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer truncate',
              activeTab === 'dashboard'
                ? 'bg-purple-50 text-[#4c3575] font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            <LayoutDashboard className="w-4 h-4 text-[#5e438f] shrink-0" />
            <span className="truncate">Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scanner')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer truncate',
              activeTab === 'scanner'
                ? 'bg-purple-50 text-[#4c3575] font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            <CameraIcon />
            <span className="truncate">Scanner</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('welcome')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer truncate',
              activeTab === 'welcome'
                ? 'bg-purple-50 text-[#4c3575] font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            <Tv className="w-4 h-4 text-[#5e438f] shrink-0" />
            <span className="truncate">Layar TV</span>
          </button>
          {canManageParticipants && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('registration')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer truncate',
                  activeTab === 'registration'
                    ? 'bg-purple-50 text-[#4c3575] font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <UserPlus className="w-4 h-4 text-[#5e438f] shrink-0" />
                <span className="truncate">Pendaftaran</span>
              </button>
              <button
                type="button"
                onClick={() => setAdminPortalPreview('register')}
                className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-semibold rounded-lg text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-colors cursor-pointer truncate"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="truncate">Portal Peserta</span>
              </button>
            </>
          )}
        </div>

        {/* VIEW 0: WELCOME DISPLAY MODE FOR TV / PROJECTOR */}
        {activeTab === 'welcome' && (
          <div className="flex-1 min-w-0">
            <WelcomeDisplay onClose={() => setActiveTab('dashboard')} />
          </div>
        )}

        {/* VIEW 1: REGISTRATION & COUTURE ID CARD STUDIO */}
        {activeTab === 'registration' && canManageParticipants && (
          <div className="flex-1 min-w-0">
            <Registration
              onPreviewDigitalTicket={(p: Participant) =>
                setDigitalTicketData({ participant: p, config })
              }
              onOpenParticipantPortal={(tab) => setAdminPortalPreview(tab || 'register')}
            />
          </div>
        )}

        {/* VIEW 2: DASHBOARD + SIDEBAR SCANNER */}
        {activeTab === 'dashboard' && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 min-w-0 w-full">
              <Dashboard
                onEditParticipant={
                  canManageParticipants
                    ? (id) => {
                        setSelectedParticipantId(id);
                        setActiveTab('registration');
                      }
                    : undefined
                }
                onOpenParticipantPortal={(tab) => setAdminPortalPreview(tab || 'register')}
              />
            </div>

            <div className="hidden lg:block lg:w-[350px] xl:w-[380px] shrink-0 lg:sticky lg:top-20">
              <Scanner
                scannerPurpose={scannerPurpose}
                onScannerPurposeChange={setScannerPurpose}
                onVerifyCertificate={handleTriggerCertificateVerification}
              />
            </div>
          </div>
        )}

        {/* VIEW 3: FULL CHECK-IN KIOSK & CERTIFICATE VERIFICATION VIEW */}
        {activeTab === 'scanner' && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 items-start">
            {/* Left Column: Dedicated QR Scanner */}
            <div className="w-full max-w-md mx-auto lg:max-w-none lg:w-[380px] xl:w-[410px] shrink-0 lg:sticky lg:top-20">
              <Scanner
                scannerPurpose={scannerPurpose}
                onScannerPurposeChange={setScannerPurpose}
                onVerifyCertificate={handleTriggerCertificateVerification}
              />
            </div>

            {/* Right Column: Switchable between Live Check-in Monitor & Certificate Verification Page */}
            <div className="flex-1 min-w-0 w-full space-y-4">
              {/* Top Mode Switcher Bar inside Menu Scanner */}
              <div className="bg-white p-2 rounded-2xl shadow-xs border border-purple-100 flex flex-wrap items-center justify-between gap-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 flex-1 p-1 bg-slate-100/90 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setScannerPurpose('checkin')}
                    className={cn(
                      'flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer',
                      scannerPurpose === 'checkin'
                        ? 'bg-white text-[#2b1b47] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <Activity className="w-4 h-4 text-[#5e438f] shrink-0" />
                    <span>Monitor Kehadiran &amp; Riwayat Check-in</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScannerPurpose('verify_cert')}
                    className={cn(
                      'flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer',
                      scannerPurpose === 'verify_cert'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <ShieldCheck
                      className={cn(
                        'w-4 h-4 shrink-0',
                        scannerPurpose === 'verify_cert' ? 'text-white' : 'text-amber-600'
                      )}
                    />
                    <span>Halaman Verifikasi Keaslian E-Sertifikat</span>
                  </button>
                </div>
              </div>

              {scannerPurpose === 'verify_cert' ? (
                <CertificateVerificationPanel
                  verificationTarget={certVerificationTarget}
                  onSelectVerificationTarget={handleTriggerCertificateVerification}
                  onClearVerification={() => {
                    setCertVerificationTarget(null);
                    if (
                      typeof window !== 'undefined' &&
                      window.location.search.includes('verify_cert=')
                    ) {
                      window.history.replaceState({}, '', window.location.pathname);
                    }
                  }}
                />
              ) : (
                <div className="bg-white rounded-2xl shadow-xs border border-purple-100 overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#5e438f] flex items-center justify-center shrink-0">
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">
                            Monitor Kehadiran &amp; Riwayat Check-in
                          </h2>
                          <p className="text-xs text-slate-500">
                            Pembaruan langsung saat peserta memindai Kartu Tanda Pengenal di meja
                            registrasi
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {canManageParticipants && kioskData.checkedIn.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setIsConfirmingReset(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-semibold text-rose-700 transition-colors cursor-pointer"
                            title="Reset status kehadiran seluruh peserta"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset Kehadiran</span>
                          </button>
                        )}
                        <span className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-100 text-xs font-semibold text-[#4c3575]">
                          {kioskData.checkedIn.length} / {kioskData.total} Hadir ({kioskData.rate}
                          %)
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        <div
                          className="bg-emerald-500 transition-all duration-300"
                          style={{
                            width: `${kioskData.total > 0 ? (kioskData.presentCount / kioskData.total) * 100 : 0}%`,
                          }}
                          title={`Hadir Tepat Waktu: ${kioskData.presentCount}`}
                        />
                        <div
                          className="bg-amber-400 transition-all duration-300"
                          style={{
                            width: `${kioskData.total > 0 ? (kioskData.lateCount / kioskData.total) * 100 : 0}%`,
                          }}
                          title={`Hadir Terlambat: ${kioskData.lateCount}`}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <div className="flex items-center gap-4">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Tepat Waktu:{' '}
                            <strong className="text-slate-700">{kioskData.presentCount}</strong>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            Terlambat:{' '}
                            <strong className="text-slate-700">{kioskData.lateCount}</strong>
                          </span>
                        </div>
                        <span>
                          Belum Hadir:{' '}
                          <strong className="text-slate-700">{kioskData.pending.length}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Check-ins List */}
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {kioskData.checkedIn.length > 0 ? (
                      kioskData.checkedIn.map((p) => (
                        <div
                          key={p.id}
                          className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-purple-50/30 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={cn(
                                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                                p.status === 'PRESENT'
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-amber-50 text-amber-600'
                              )}
                            >
                              {p.status === 'PRESENT' ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <Clock className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {p.name}
                                </p>
                                <span className="font-mono text-xs font-semibold text-[#5e438f] shrink-0">
                                  {p.id}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 truncate mt-0.5">
                                {p.role || 'Peserta Workshop'} · {p.institution}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span
                                className={cn(
                                  'inline-block px-2 py-0.5 rounded text-[11px] font-medium',
                                  p.status === 'PRESENT'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                )}
                              >
                                {p.status === 'PRESENT' ? 'Tepat Waktu' : 'Terlambat'}
                              </span>
                              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                                {p.checkInTime
                                  ? `${format(new Date(p.checkInTime), 'HH:mm:ss')} WIB`
                                  : '-'}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleTriggerCertificateVerification(p.id)}
                              title="Verifikasi Keaslian E-Sertifikat Peserta Ini"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                              <span className="hidden sm:inline">Cek Sertifikat</span>
                            </button>

                            {canManageParticipants && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedParticipantId(p.id);
                                  setActiveTab('registration');
                                }}
                                title="Lihat Kartu Pengenal"
                                className="p-2 text-[#5e438f] bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <QrCode className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-10 text-center text-slate-500 text-sm">
                        Belum ada peserta yang melakukan check-in. Pindai QR Code pada kartu
                        peserta di panel kiri untuk memulai.
                      </div>
                    )}
                  </div>

                  {/* Quick Pending Footer */}
                  {kioskData.pending.length > 0 && (
                    <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-slate-600">
                        Menunggu kehadiran: <strong>{kioskData.pending.length} peserta</strong>
                      </span>
                      <div className="flex items-center gap-2 overflow-x-auto max-w-md">
                        {kioskData.pending.slice(0, 3).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              const res = checkIn(p.id);
                              if (res.success) playScanBeep('success');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0"
                            title={`Check-in cepat ${p.name}`}
                          >
                            <UserCheck className="w-3 h-3 text-emerald-600" />
                            <span className="font-mono text-[11px] text-[#5e438f]">{p.id}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal Konfirmasi Reset Data */}
      {isConfirmingReset && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Reset Data Acara Ini ke Awal?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tindakan ini hanya mereset acara yang sedang aktif ({config.name})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmingReset(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-4 text-sm text-slate-600 leading-relaxed">
              Pilih jenis reset untuk acara <strong>{config.name}</strong>: Anda dapat mereset{' '}
              <strong>hanya status kehadiran peserta</strong> (nama peserta &amp; pengaturan acara
              tetap aman), atau mengembalikan seluruh data ke sampel awal.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsConfirmingReset(false)}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  resetAttendance();
                  setIsConfirmingReset(false);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#5e438f] hover:bg-[#4c3575] rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Kehadiran Saja
              </button>
              {canManageParticipants && (
                <button
                  type="button"
                  onClick={() => {
                    resetData();
                    setIsConfirmingReset(false);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Semua ke Awal
                </button>
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[#5e438f]"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
