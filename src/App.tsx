import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppProvider, useAppContext } from './store';
import { Dashboard } from './components/Dashboard';
import { Scanner } from './components/Scanner';
import { Registration } from './components/Registration';
import { HealYouLogo } from './components/HealYouLogo';
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
    updateConfig,
    setSelectedParticipantId,
    checkIn,
    resetData,
    cloudUser,
    isCloudSyncing,
    connectCloud,
    disconnectCloud,
  } = useAppContext();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scanner' | 'registration'>('dashboard');
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [focusField, setFocusField] = useState<'date' | 'location'>('date');

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
      }
    };
    if (isEditingEvent) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditingEvent]);

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
      {/* Header */}
      <header className="bg-white border-b border-purple-100 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Left: Brand + Desktop Navigation */}
          <div className="flex items-center gap-4 xl:gap-6 min-w-0">
            <div className="flex items-center gap-2.5 shrink-0">
              <HealYouLogo
                customLogoUrl={config.customLogoUrl}
                size={38}
                className="rounded-lg shadow-2xs"
              />
              <div>
                <h1
                  className="text-xl font-bold text-slate-900 leading-none"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  Heal You
                </h1>
                <p className="text-[11px] text-[#5e438f] font-medium mt-0.5">
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
            </nav>
          </div>

          {/* Right: Unified Schedule Capsule, Cloud Sync, Reset Data */}
          <div
            ref={popoverRef}
            className="relative flex items-center gap-2 text-sm text-slate-600 shrink-0"
          >
            {/* Unified Interactive Event Info Capsule */}
            <div className="flex items-center bg-slate-50 hover:bg-purple-50/60 border border-slate-200/80 hover:border-purple-200 rounded-xl p-0.5 transition-colors">
              <button
                type="button"
                onClick={() => openEditor('date')}
                className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-left cursor-pointer"
                title="Klik untuk mengubah tanggal & jam mulai workshop"
              >
                <Calendar className="w-3.5 h-3.5 text-[#5e438f] shrink-0" />
                <span className="font-medium text-slate-700 group-hover:text-[#2b1b47] text-xs whitespace-nowrap">
                  {formatSafeDate(config.date, 'dd MMM yyyy')}
                </span>
              </button>

              <span className="hidden xl:inline text-slate-300 select-none">|</span>

              <button
                type="button"
                onClick={() => openEditor('location')}
                className="group hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-left cursor-pointer max-w-[190px]"
                title="Klik untuk mengubah tempat workshop"
              >
                <MapPin className="w-3.5 h-3.5 text-[#5e438f] shrink-0" />
                <span className="font-medium text-slate-700 group-hover:text-[#2b1b47] text-xs truncate">
                  {config.location}
                </span>
                <Pencil className="w-3 h-3 text-slate-400 group-hover:text-[#5e438f] shrink-0 ml-0.5" />
              </button>
            </div>

            {/* Cloud Real-Time Sync Control */}
            {cloudUser ? (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/90 text-emerald-800 px-2.5 py-1.5 rounded-xl text-xs font-medium shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span
                  className="hidden 2xl:inline max-w-[130px] truncate"
                  title={cloudUser.email || ''}
                >
                  {cloudUser.email || 'Cloud Aktif'}
                </span>
                <span className="2xl:hidden">Cloud Aktif</span>
                <button
                  type="button"
                  onClick={() => void disconnectCloud()}
                  title="Putuskan sinkronisasi Cloud (Keluar)"
                  className="ml-0.5 p-0.5 text-emerald-700 hover:text-rose-600 rounded transition-colors cursor-pointer"
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

            {/* Reset Data Button */}
            <button
              type="button"
              onClick={() => setIsConfirmingReset(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-700 transition-colors bg-slate-100 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl cursor-pointer shrink-0"
              title="Kembalikan data peserta & acara ke kondisi awal"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Reset</span>
            </button>

            {/* Popover Editor for Date & Location */}
            {isEditingEvent && (
              <form
                onSubmit={handleSaveEvent}
                className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-lg border border-purple-100 p-4 z-50 text-slate-900"
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
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex gap-6 flex-col">
        {/* Mobile/Tablet Tabs Navigation */}
        <div className="flex lg:hidden bg-white p-1 rounded-xl shadow-xs border border-purple-100 w-full max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer',
              activeTab === 'dashboard'
                ? 'bg-purple-50 text-[#4c3575] font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            <LayoutDashboard className="w-4 h-4 text-[#5e438f]" />
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scanner')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer',
              activeTab === 'scanner'
                ? 'bg-purple-50 text-[#4c3575] font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            <CameraIcon />
            Scanner QR
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('registration')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer',
              activeTab === 'registration'
                ? 'bg-purple-50 text-[#4c3575] font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            <UserPlus className="w-4 h-4 text-[#5e438f]" />
            Buat QR
          </button>
        </div>

        {/* VIEW 1: REGISTRATION & COUTURE ID CARD STUDIO */}
        {activeTab === 'registration' && (
          <div className="flex-1 min-w-0">
            <Registration />
          </div>
        )}

        {/* VIEW 2: DASHBOARD + SIDEBAR SCANNER */}
        {activeTab === 'dashboard' && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 items-stretch">
            <div className="flex-1 min-w-0">
              <Dashboard
                onEditParticipant={(id) => {
                  setSelectedParticipantId(id);
                  setActiveTab('registration');
                }}
              />
            </div>

            <div className="hidden lg:block lg:w-[360px] xl:w-[380px] shrink-0">
              <Scanner />
            </div>
          </div>
        )}

        {/* VIEW 3: FULL CHECK-IN KIOSK VIEW (SCANNER + LIVE CHECK-IN MONITOR) */}
        {activeTab === 'scanner' && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 items-stretch">
            {/* Left Column: Dedicated QR Scanner */}
            <div className="w-full max-w-md mx-auto lg:max-w-none lg:w-[400px] xl:w-[420px] shrink-0 min-h-[540px]">
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
                    Reset Seluruh Data ke Awal?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tindakan ini tidak dapat dibatalkan
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
              Seluruh perubahan daftar peserta, status kehadiran <em>check-in</em>, serta pengaturan
              acara workshop akan dikembalikan ke data bawaan awal.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
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
                  resetData();
                  setIsConfirmingReset(false);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Ya, Reset Data
              </button>
            </div>
          </div>
        </div>
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
