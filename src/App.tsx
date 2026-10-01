import React, { useState, useRef, useEffect, useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { AppProvider, useAppContext } from './store';
import { Participant } from './types';
import { Dashboard } from './components/Dashboard';
import { Scanner } from './components/Scanner';
import { Registration } from './components/Registration';
import { WelcomeDisplay } from './components/WelcomeDisplay';
import { DigitalTicketView } from './components/DigitalTicketView';
import { HealYouLogo } from './components/HealYouLogo';
import { parseDigitalTicketFromUrl } from './lib/whatsapp';
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
    isAdmin,
    canManageParticipants,
    isCloudSyncing,
    connectCloud,
    disconnectCloud,
  } = useAppContext();
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'scanner' | 'welcome' | 'registration'
  >('dashboard');
  const [digitalTicketData, setDigitalTicketData] = useState(() => parseDigitalTicketFromUrl());
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
      {/* Hidden QR Code Canvas Registry so any participant's PNG ID Card can be generated & copied to Clipboard anywhere */}
      <div className="sr-only pointer-events-none" aria-hidden="true">
        {participants.map((p) => (
          <QRCodeCanvas
            key={p.id}
            id={`global-qr-${p.id}`}
            value={p.id}
            size={320}
            level="H"
            minVersion={4}
            marginSize={2}
            fgColor="#261742"
            bgColor="#ffffff"
          />
        ))}
      </div>

      {digitalTicketData ? (
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
        <div className="w-full max-w-[1680px] mx-auto px-3 sm:px-6 lg:px-8 min-h-16 py-2 flex flex-wrap xl:flex-nowrap items-center justify-between gap-2 sm:gap-3">
          {/* Left: Brand + Desktop Navigation */}
          <div className="flex items-center gap-3 xl:gap-6 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
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
                  'flex items-center gap-2 px-3 py-1.5 text-xs xl:text-sm font-medium rounded-lg transition-colors cursor-pointer',
                  activeTab === 'dashboard'
                    ? 'bg-white text-[#2b1b47] shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <LayoutDashboard className="w-4 h-4 text-[#5e438f]" />
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('scanner')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-xs xl:text-sm font-medium rounded-lg transition-colors cursor-pointer',
                  activeTab === 'scanner'
                    ? 'bg-white text-[#2b1b47] shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <CameraIcon />
                Scanner QR
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('welcome')}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-xs xl:text-sm font-medium rounded-lg transition-colors cursor-pointer',
                  activeTab === 'welcome'
                    ? 'bg-white text-[#2b1b47] shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                )}
                title="Mode Layar Sambutan Penuh untuk TV / Proyektor"
              >
                <Tv className="w-4 h-4 text-[#5e438f]" />
                Layar TV
              </button>
              {canManageParticipants && (
                <button
                  type="button"
                  onClick={() => setActiveTab('registration')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-xs xl:text-sm font-medium rounded-lg transition-colors cursor-pointer',
                    activeTab === 'registration'
                      ? 'bg-white text-[#2b1b47] shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <UserPlus className="w-4 h-4 text-[#5e438f]" />
                  Kartu Pengenal &amp; Buat QR
                </button>
              )}
            </nav>
          </div>

          {/* Right: Multi-Event Switcher, Schedule Capsule, Cloud Sync, Reset Data */}
          <div
            ref={popoverRef}
            className="relative flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 text-sm text-slate-600"
          >
            {/* Multi-Event Switcher Button */}
            <button
              type="button"
              onClick={() => {
                setIsEditingEvent(false);
                setIsCreatingNewEvent(false);
                setIsEventsMenuOpen((prev) => !prev);
              }}
              className={cn(
                'flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer shrink-0',
                isEventsMenuOpen
                  ? 'bg-[#5e438f] text-white border-[#5e438f]'
                  : 'bg-purple-50/80 hover:bg-purple-100/80 text-[#4c3575] border-purple-200/80'
              )}
              title="Pilih atau buat acara workshop baru (Riwayat Multi-Acara)"
            >
              <FolderKanban className="w-3.5 h-3.5 shrink-0" />
              <span className="max-w-[90px] sm:max-w-[150px] truncate">{config.name}</span>
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded text-[10px] font-bold',
                  isEventsMenuOpen ? 'bg-white/20 text-white' : 'bg-white text-[#5e438f]'
                )}
              >
                {eventsList.length}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-75 shrink-0" />
            </button>

            {/* Unified Interactive Event Info Capsule */}
            <div
              className={cn(
                'hidden sm:flex items-center bg-slate-50 border border-slate-200/80 rounded-xl p-0.5 transition-colors',
                canManageParticipants && 'hover:bg-purple-50/60 hover:border-purple-200'
              )}
            >
              <button
                type="button"
                disabled={!canManageParticipants}
                onClick={() => canManageParticipants && openEditor('date')}
                className={cn(
                  'group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-left',
                  canManageParticipants ? 'cursor-pointer' : 'cursor-default'
                )}
                title={
                  canManageParticipants
                    ? 'Klik untuk mengubah tanggal & jam mulai workshop'
                    : 'Jadwal Workshop'
                }
              >
                <Calendar className="w-3.5 h-3.5 text-[#5e438f] shrink-0" />
                <span className="font-medium text-slate-700 text-xs whitespace-nowrap">
                  {formatSafeDate(config.date, 'dd MMM yyyy')}
                </span>
              </button>

              <span className="hidden xl:inline text-slate-300 select-none">|</span>

              <button
                type="button"
                disabled={!canManageParticipants}
                onClick={() => canManageParticipants && openEditor('location')}
                className={cn(
                  'group hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-left max-w-[175px]',
                  canManageParticipants ? 'cursor-pointer' : 'cursor-default'
                )}
                title={
                  canManageParticipants ? 'Klik untuk mengubah tempat workshop' : config.location
                }
              >
                <MapPin className="w-3.5 h-3.5 text-[#5e438f] shrink-0" />
                <span className="font-medium text-slate-700 text-xs truncate">
                  {config.location}
                </span>
                {canManageParticipants && (
                  <Pencil className="w-3 h-3 text-slate-400 group-hover:text-[#5e438f] shrink-0 ml-0.5" />
                )}
              </button>
            </div>

            {/* Cloud Real-Time Sync Control */}
            {cloudUser ? (
              <div
                className={cn(
                  'flex items-center gap-1.5 border px-2.5 py-1.5 rounded-xl text-xs font-medium shrink-0',
                  isAdmin
                    ? 'bg-emerald-50 border-emerald-200/90 text-emerald-800'
                    : 'bg-purple-50 border-purple-200/90 text-[#4c3575]'
                )}
                title={
                  isAdmin
                    ? `Admin (${cloudUser.email}) - Akses Penuh`
                    : `Panitia (${cloudUser.email}) - Akses Dashboard & Scanner QR`
                }
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full animate-pulse',
                    isAdmin ? 'bg-emerald-500' : 'bg-[#5e438f]'
                  )}
                />
                <span className="font-semibold">{isAdmin ? 'Admin' : 'Panitia'}</span>
                <span className="hidden 2xl:inline max-w-[120px] truncate opacity-85">
                  · {cloudUser.email}
                </span>
                <button
                  type="button"
                  onClick={() => void disconnectCloud()}
                  title="Putuskan sinkronisasi Cloud (Keluar)"
                  className="ml-0.5 p-0.5 hover:text-rose-600 rounded transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  setCloudError(null);
                  try {
                    await connectCloud();
                  } catch {
                    setCloudError('Login Google dibatalkan atau gagal.');
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#5e438f] bg-purple-50 hover:bg-purple-100 border border-purple-200/80 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Login Google untuk sinkronisasi real-time antar HP & Laptop"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {isCloudSyncing ? 'Menghubungkan...' : 'Sinkronisasi Cloud'}
                </span>
              </button>
            )}

            {/* Reset Data Button (Only visible when canManageParticipants is true) */}
            {canManageParticipants && (
              <button
                type="button"
                onClick={() => setIsConfirmingReset(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-700 transition-colors bg-slate-100 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl cursor-pointer shrink-0"
                title="Kembalikan data peserta & acara saat ini ke kondisi awal"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Reset</span>
              </button>
            )}

            {/* Popover 1: Multi-Event Manager & History Switcher */}
            {isEventsMenuOpen && (
              <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-96 bg-white rounded-2xl shadow-xl border border-purple-100 p-4 z-50 text-slate-900">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Daftar &amp; Riwayat Acara Workshop
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Pilih acara untuk memuat peserta &amp; presensi masing-masing sesi
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
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openEditor('date')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#5e438f]" />
                          Edit Acara Aktif
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
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-800 flex items-center justify-center gap-2">
          <span>{cloudError}</span>
          <button
            type="button"
            onClick={() => setCloudError(null)}
            className="underline font-medium cursor-pointer"
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
            'grid lg:hidden gap-1.5 bg-white p-1.5 rounded-xl shadow-xs border border-purple-100 w-full max-w-lg mx-auto',
            canManageParticipants ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
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
              <span className="truncate">Buat QR</span>
            </button>
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
              />
            </div>

            <div className="hidden lg:block lg:w-[350px] xl:w-[380px] shrink-0 lg:sticky lg:top-20">
              <Scanner />
            </div>
          </div>
        )}

        {/* VIEW 3: FULL CHECK-IN KIOSK VIEW (SCANNER + LIVE CHECK-IN MONITOR) */}
        {activeTab === 'scanner' && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 items-start">
            {/* Left Column: Dedicated QR Scanner */}
            <div className="w-full max-w-md mx-auto lg:max-w-none lg:w-[380px] xl:w-[410px] shrink-0 lg:sticky lg:top-20">
              <Scanner />
            </div>

            {/* Right Column: Live Check-in Activity Feed & Kiosk Monitor */}
            <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-xs border border-purple-100 overflow-hidden flex flex-col">
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
                        Pembaruan langsung saat peserta memindai Kartu Tanda Pengenal di meja registrasi
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {kioskData.checkedIn.length > 0 && (
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
                      {kioskData.checkedIn.length} / {kioskData.total} Hadir ({kioskData.rate}%)
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
                        Tepat Waktu: <strong className="text-slate-700">{kioskData.presentCount}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        Terlambat: <strong className="text-slate-700">{kioskData.lateCount}</strong>
                      </span>
                    </div>
                    <span>
                      Belum Hadir: <strong className="text-slate-700">{kioskData.pending.length}</strong>
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

                      <div className="flex items-center gap-2.5 shrink-0">
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
                    Belum ada peserta yang melakukan check-in. Pindai QR Code pada kartu peserta di panel kiri untuk memulai.
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
