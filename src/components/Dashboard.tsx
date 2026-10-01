import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAppContext } from '../store';
import { AttendanceStatus, Participant, ParticipantFeedback } from '../types';
import { ExportButton } from './ExportButton';
import { WhatsAppBroadcastModal } from './WhatsAppBroadcastModal';
import { CertificateModal } from './CertificateModal';
import {
  Users,
  CheckCircle2,
  Clock,
  UserX,
  Search,
  QrCode,
  UserCheck,
  RotateCcw,
  ArrowUpDown,
  TrendingUp,
  Zap,
  Timer,
  MessageCircle,
  Check,
  Share2,
  Award,
  Star,
  Copy,
  ExternalLink,
  MessageSquareHeart,
  Download,
  X,
  Pencil,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { playScanBeep } from '../lib/sound';
import {
  buildWhatsAppUrl,
  buildParticipantPortalUrl,
  copyPortalLinkWithTitle,
  copyParticipantCardToClipboard,
  shareParticipantCardFile,
} from '../lib/whatsapp';
import {
  RegistrationFormTemplate,
  loadRegistrationTemplate,
  saveRegistrationTemplate,
  computeApprovalSignature,
  normalizePhoneForPaymentCode,
} from '../lib/registrationTemplate';
import { RegistrationFormEditorModal } from './RegistrationFormEditorModal';
import { format, differenceInMinutes } from 'date-fns';
import { motion } from 'motion/react';

type StatusFilter = 'ALL' | AttendanceStatus | 'UNVERIFIED_PAYMENT';
type SortOption = 'id' | 'recent' | 'name';

export const Dashboard: React.FC<{
  onEditParticipant?: (id: string) => void;
  onOpenParticipantPortal?: (tab?: 'register' | 'certificate') => void;
}> = ({ onEditParticipant, onOpenParticipantPortal }) => {
  const {
    participants,
    config,
    feedbacks,
    activeWorkshopId,
    canManageParticipants,
    canVerifyPayment,
    checkIn,
    updateParticipant,
    verifyParticipantPayment,
    updateConfig,
    resetAttendance,
  } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('id');
  const [isWaBroadcastOpen, setIsWaBroadcastOpen] = useState(false);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isConfirmingResetAttendance, setIsConfirmingResetAttendance] = useState(false);
  const [certTargetId, setCertTargetId] = useState<string | null>(null);
  const [waCardNotice, setWaCardNotice] = useState<string | null>(null);
  const [previewProofParticipant, setPreviewProofParticipant] = useState<Participant | null>(null);
  const [copiedPortalType, setCopiedPortalType] = useState<'register' | 'certificate' | null>(
    null
  );
  const [isFormEditorOpen, setIsFormEditorOpen] = useState(false);
  const [formTemplate, setFormTemplate] = useState<RegistrationFormTemplate>(() =>
    loadRegistrationTemplate(activeWorkshopId)
  );
  const [isEditingQuota, setIsEditingQuota] = useState(false);
  const [quotaDraft, setQuotaDraft] = useState('30');

  const currentQuota = Math.max(1, formTemplate.participantQuota || config.quota || 30);

  const handleSaveDashboardQuota = (targetQuota?: number) => {
    const parsed =
      typeof targetQuota === 'number' ? targetQuota : parseInt(quotaDraft.trim(), 10);
    const safeQuota =
      Number.isFinite(parsed) && parsed >= 1 ? Math.min(5000, Math.round(parsed)) : 30;
    const updated = saveRegistrationTemplate(activeWorkshopId, {
      ...formTemplate,
      participantQuota: safeQuota,
    });
    setFormTemplate(updated);
    updateConfig({ quota: safeQuota });
    setQuotaDraft(String(safeQuota));
    setIsEditingQuota(false);
  };

  const feedbackList = useMemo(() => {
    const list = Object.values(feedbacks || {}) as ParticipantFeedback[];
    return list.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [feedbacks]);

  const feedbackStats = useMemo(() => {
    const count = feedbackList.length;
    if (count === 0) {
      return {
        count: 0,
        avgOverall: '0.0',
        avgSpeaker: '0.0',
        avgFacility: '0.0',
      };
    }
    const sumOverall = feedbackList.reduce((acc, f) => acc + f.overallRating, 0);
    const sumSpeaker = feedbackList.reduce((acc, f) => acc + f.speakerRating, 0);
    const sumFacility = feedbackList.reduce((acc, f) => acc + f.facilityRating, 0);
    return {
      count,
      avgOverall: (sumOverall / count).toFixed(1),
      avgSpeaker: (sumSpeaker / count).toFixed(1),
      avgFacility: (sumFacility / count).toFixed(1),
    };
  }, [feedbackList]);

  const handleCopyPortalLink = async (tab: 'register' | 'certificate') => {
    const url = buildParticipantPortalUrl(activeWorkshopId, config, tab);
    const currentTpl = loadRegistrationTemplate(activeWorkshopId);
    const slug = currentTpl.shareLinkSlug || 'HealYou-Pendaftaran';
    try {
      await copyPortalLinkWithTitle(
        url,
        tab === 'register' ? slug : `${slug}-Sertifikat`
      );
      setCopiedPortalType(tab);
      setWaCardNotice(
        tab === 'register'
          ? `Link "${slug}" (${url}) berhasil disalin! Bagikan ke calon peserta.`
          : 'Link Klaim E-Sertifikat & Evaluasi Mandiri berhasil disalin!'
      );
      window.setTimeout(() => setCopiedPortalType(null), 2500);
    } catch {
      // Ignore
    }
  };

  const handleExportFeedbackExcel = () => {
    if (feedbackList.length === 0) return;
    const rows = feedbackList.map((f, idx) => ({
      No: idx + 1,
      'ID Peserta': f.participantId,
      'Nama Peserta': f.participantName,
      Instansi: f.institution,
      'Rating Acara (1-5)': f.overallRating,
      'Rating Materi & Narasumber (1-5)': f.speakerRating,
      'Rating Panitia & Fasilitas (1-5)': f.facilityRating,
      'Kesan, Pesan & Manfaat': f.takeaway,
      'Usulan Topik Selanjutnya': f.suggestedTopic || '-',
      Rekomendasi: f.recommendation,
      'Status Klaim Sertifikat': f.certificateClaimed ? 'Sudah Klaim' : 'Belum',
      'Waktu Evaluasi': f.submittedAt,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Evaluasi Workshop');
    XLSX.writeFile(
      wb,
      `Rekap_Evaluasi_${config.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.xlsx`
    );
  };

  const handleWaSendWithCardCopy = (p: Participant) => {
    void copyParticipantCardToClipboard(p, config).then((copied) => {
      const msg = copied
        ? `Gambar Kartu PNG "${p.name}" (${p.id}) otomatis disalin ke Clipboard! Tekan Ctrl+V (Paste) saat ruang chat WhatsApp terbuka.`
        : `Pesan WhatsApp & Link Tiket Digital untuk "${p.name}" (${p.id}) telah disiapkan.`;
      setWaCardNotice(msg);
      window.setTimeout(() => {
        setWaCardNotice((prev) => (prev === msg ? null : prev));
      }, 6000);
    });
  };

  const buildApprovedPortalWhatsAppUrl = (p: Participant) => {
    const digits = normalizePhoneForPaymentCode(p.phone || '');
    const waTarget = digits.startsWith('0')
      ? `62${digits.slice(1)}`
      : digits.startsWith('8')
        ? `62${digits}`
        : digits;
    const basePortal = buildParticipantPortalUrl(activeWorkshopId, config, 'register');
    const sig = computeApprovalSignature(activeWorkshopId, p.id);
    const separator = basePortal.includes('?') ? '&' : '?';
    const approvedLink = `${basePortal}${separator}pid=${encodeURIComponent(p.id)}&acc=${encodeURIComponent(sig)}`;

    const text = [
      `Halo Kak *${p.name}*! 🌸`,
      `Pembayaran pendaftaran *${config.name}* Anda telah *TERVERIFIKASI (ACC)* oleh Panitia.`,
      ``,
      `📌 *ID Peserta:* ${p.id}`,
      `🎫 *Buka & Unduh Kartu Peserta (QR Code Aktif):*`,
      approvedLink,
      ``,
      `Silakan klik link di atas untuk langsung menampilkan & mengunduh Kartu Peserta Anda. Sampai jumpa di acara!`,
    ].join('\n');

    return waTarget
      ? `https://wa.me/${waTarget}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const stats = useMemo(() => {
    const total = participants.length;
    const present = participants.filter((p) => p.status === 'PRESENT').length;
    const late = participants.filter((p) => p.status === 'LATE').length;
    const pending = participants.filter((p) => p.status === 'PENDING').length;
    const attended = present + late;
    const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 0;
    const unverifiedPayment = participants.filter((p) => p.paymentVerified === false).length;
    const verifiedPayment = total - unverifiedPayment;

    return {
      total,
      present,
      late,
      pending,
      attendanceRate,
      attended,
      unverifiedPayment,
      verifiedPayment,
    };
  }, [participants]);

  // Arrival velocity & check-in timing insights
  const velocityStats = useMemo(() => {
    const startTime = new Date(config.startTime);
    const checkedInList = participants
      .filter((p) => p.status !== 'PENDING' && p.checkInTime)
      .map((p) => ({
        ...p,
        time: new Date(p.checkInTime!),
      }))
      .filter((p) => !isNaN(p.time.getTime()))
      .sort((a, b) => a.time.getTime() - b.time.getTime());

    const totalCheckedIn = checkedInList.length;
    if (totalCheckedIn === 0) {
      return {
        totalCheckedIn: 0,
        first30MinFromOpenCount: 0,
        first30MinFromOpenPct: 0,
        earlyArrivalCount: 0, // > 15 mins before start
        justInTimeCount: 0, // -15 mins to 0 mins (on time)
        within30MinAfterStartCount: 0, // 1 to 30 mins after start
        after30MinStartCount: 0, // > 30 mins after start
        avgOffsetMinutes: 0,
        firstCheckInTime: null as Date | null,
        latestCheckInTime: null as Date | null,
        peakRatePer10Min: 0,
      };
    }

    const firstTime = checkedInList[0].time;
    const latestTime = checkedInList[checkedInList.length - 1].time;

    // Count how many checked in within the first 30 minutes from the first check-in
    const first30MinFromOpenCount = checkedInList.filter(
      (p) => differenceInMinutes(p.time, firstTime) <= 30
    ).length;
    const first30MinFromOpenPct = Math.round((first30MinFromOpenCount / totalCheckedIn) * 100);

    let earlyArrivalCount = 0;
    let justInTimeCount = 0;
    let within30MinAfterStartCount = 0;
    let after30MinStartCount = 0;
    let totalOffsetMinutes = 0;

    for (const p of checkedInList) {
      const diffFromStart = differenceInMinutes(p.time, startTime); // negative = before start
      totalOffsetMinutes += diffFromStart;

      if (diffFromStart < -15) {
        earlyArrivalCount++;
      } else if (diffFromStart <= 0) {
        justInTimeCount++;
      } else if (diffFromStart <= 30) {
        within30MinAfterStartCount++;
      } else {
        after30MinStartCount++;
      }
    }

    // Calculate peak check-ins in any 10-minute sliding window
    let peakRatePer10Min = 0;
    for (let i = 0; i < checkedInList.length; i++) {
      let windowCount = 0;
      for (let j = i; j < checkedInList.length; j++) {
        if (differenceInMinutes(checkedInList[j].time, checkedInList[i].time) <= 10) {
          windowCount++;
        } else {
          break;
        }
      }
      if (windowCount > peakRatePer10Min) {
        peakRatePer10Min = windowCount;
      }
    }

    const avgOffsetMinutes = Math.round(totalOffsetMinutes / totalCheckedIn);

    return {
      totalCheckedIn,
      first30MinFromOpenCount,
      first30MinFromOpenPct,
      earlyArrivalCount,
      justInTimeCount,
      within30MinAfterStartCount,
      after30MinStartCount,
      avgOffsetMinutes,
      firstCheckInTime: firstTime,
      latestCheckInTime: latestTime,
      peakRatePer10Min,
    };
  }, [participants, config.startTime]);

  const filteredParticipants = useMemo(() => {
    const lowerQuery = searchQuery.trim().toLowerCase();

    const filtered = participants.filter((p) => {
      if (statusFilter === 'UNVERIFIED_PAYMENT') {
        if (p.paymentVerified !== false) return false;
      } else if (statusFilter !== 'ALL' && p.status !== statusFilter) {
        return false;
      }
      if (!lowerQuery) return true;
      return (
        p.name.toLowerCase().includes(lowerQuery) ||
        p.id.toLowerCase().includes(lowerQuery) ||
        p.institution.toLowerCase().includes(lowerQuery) ||
        p.email.toLowerCase().includes(lowerQuery)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'recent') {
        const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
        const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'id');
      }
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
  }, [participants, searchQuery, statusFilter, sortBy]);

  const handleQuickUndoCheckIn = (id: string) => {
    updateParticipant(id, {
      status: 'PENDING',
      checkInTime: undefined,
    });
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Peserta"
          value={stats.total}
          subtitle={`${stats.attendanceRate}% telah hadir`}
          icon={<Users className="w-5 h-5 text-purple-700" />}
          bgColor="bg-purple-50"
          active={statusFilter === 'ALL'}
          onClick={() => setStatusFilter('ALL')}
        />
        <StatCard
          title="Hadir Tepat Waktu"
          value={stats.present}
          subtitle="Sesuai jadwal"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          bgColor="bg-emerald-50"
          active={statusFilter === 'PRESENT'}
          onClick={() => setStatusFilter(statusFilter === 'PRESENT' ? 'ALL' : 'PRESENT')}
        />
        <StatCard
          title="Hadir Terlambat"
          value={stats.late}
          subtitle="Lewat jam mulai"
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          bgColor="bg-amber-50"
          active={statusFilter === 'LATE'}
          onClick={() => setStatusFilter(statusFilter === 'LATE' ? 'ALL' : 'LATE')}
        />
        <StatCard
          title="Belum Hadir"
          value={stats.pending}
          subtitle="Menunggu check-in"
          icon={<UserX className="w-5 h-5 text-slate-500" />}
          bgColor="bg-slate-100"
          active={statusFilter === 'PENDING'}
          onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
        />
      </div>

      {/* Arrival Velocity & Check-in Timing Insight Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-purple-100 p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left Header & Primary Velocity Metric */}
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-[#5e438f] flex items-center justify-center shrink-0 mt-0.5">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Tren Kecepatan &amp; Waktu Kedatangan Peserta
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-[#5e438f] border border-purple-100">
                  <Zap className="w-3 h-3" />
                  {velocityStats.first30MinFromOpenCount} peserta (
                  {velocityStats.first30MinFromOpenPct}%) di 30 menit pertama
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {velocityStats.totalCheckedIn > 0 ? (
                  <>
                    Check-in pertama pukul{' '}
                    <strong className="text-slate-700 font-mono">
                      {velocityStats.firstCheckInTime
                        ? format(velocityStats.firstCheckInTime, 'HH:mm')
                        : '-'}
                    </strong>{' '}
                    · Rata-rata kedatangan{' '}
                    <strong className="text-[#4c3575]">
                      {velocityStats.avgOffsetMinutes <= 0
                        ? `${Math.abs(velocityStats.avgOffsetMinutes)} menit sebelum jam mulai`
                        : `${velocityStats.avgOffsetMinutes} menit setelah jam mulai`}
                    </strong>{' '}
                    · Puncak arus:{' '}
                    <strong className="text-slate-700">
                      {velocityStats.peakRatePer10Min} peserta / 10 mnt
                    </strong>
                  </>
                ) : (
                  'Menunggu data check-in pertama untuk menampilkan analisis kecepatan kedatangan.'
                )}
              </p>
            </div>
          </div>

          {/* Right Mini Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                <Timer className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>&gt;15 Mnt Awal</span>
              </div>
              <p className="text-base font-bold text-emerald-900 mt-0.5">
                {velocityStats.earlyArrivalCount}{' '}
                <span className="text-[11px] font-normal text-emerald-700">org</span>
              </p>
            </div>

            <div className="px-3 py-2 rounded-xl bg-teal-50/70 border border-teal-100">
              <div className="flex items-center gap-1 text-[11px] font-medium text-teal-800">
                <CheckCircle2 className="w-3 h-3 text-teal-600 shrink-0" />
                <span>0–15 Mnt Awal</span>
              </div>
              <p className="text-base font-bold text-teal-900 mt-0.5">
                {velocityStats.justInTimeCount}{' '}
                <span className="text-[11px] font-normal text-teal-700">org</span>
              </p>
            </div>

            <div className="px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-100">
              <div className="flex items-center gap-1 text-[11px] font-medium text-amber-800">
                <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                <span>+1 s/d 30 Mnt</span>
              </div>
              <p className="text-base font-bold text-amber-900 mt-0.5">
                {velocityStats.within30MinAfterStartCount}{' '}
                <span className="text-[11px] font-normal text-amber-700">org</span>
              </p>
            </div>

            <div className="px-3 py-2 rounded-xl bg-rose-50/70 border border-rose-100">
              <div className="flex items-center gap-1 text-[11px] font-medium text-rose-800">
                <Clock className="w-3 h-3 text-rose-600 shrink-0" />
                <span>&gt;30 Mnt Lewat</span>
              </div>
              <p className="text-base font-bold text-rose-900 mt-0.5">
                {velocityStats.after30MinStartCount}{' '}
                <span className="text-[11px] font-normal text-rose-700">org</span>
              </p>
            </div>
          </div>
        </div>

        {/* Segmented Timeline Distribution Bar */}
        {velocityStats.totalCheckedIn > 0 && (
          <div className="mt-3.5 pt-3 border-t border-slate-100">
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 transition-all duration-300"
                style={{
                  width: `${(velocityStats.earlyArrivalCount / velocityStats.totalCheckedIn) * 100}%`,
                }}
                title={`Datang >15 menit sebelum mulai: ${velocityStats.earlyArrivalCount} peserta`}
              />
              <div
                className="bg-teal-500 transition-all duration-300"
                style={{
                  width: `${(velocityStats.justInTimeCount / velocityStats.totalCheckedIn) * 100}%`,
                }}
                title={`Datang 0-15 menit sebelum mulai: ${velocityStats.justInTimeCount} peserta`}
              />
              <div
                className="bg-amber-400 transition-all duration-300"
                style={{
                  width: `${(velocityStats.within30MinAfterStartCount / velocityStats.totalCheckedIn) * 100}%`,
                }}
                title={`Terlambat 1-30 menit: ${velocityStats.within30MinAfterStartCount} peserta`}
              />
              <div
                className="bg-rose-400 transition-all duration-300"
                style={{
                  width: `${(velocityStats.after30MinStartCount / velocityStats.totalCheckedIn) * 100}%`,
                }}
                title={`Terlambat >30 menit: ${velocityStats.after30MinStartCount} peserta`}
              />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>
                Distribusi waktu kedatangan terhadap jadwal mulai (Pukul{' '}
                {format(new Date(config.startTime), 'HH:mm')} WIB)
              </span>
              {velocityStats.latestCheckInTime && (
                <span>
                  Check-in terakhir:{' '}
                  <strong className="font-mono text-slate-700">
                    {format(velocityStats.latestCheckInTime, 'HH:mm:ss')} WIB
                  </strong>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Real-Time Participant Quota (ACC) & Payment Verification Control Card (Admin & Panitia) */}
      {canVerifyPayment && (
        <div className="bg-white rounded-2xl shadow-xs border border-emerald-200/80 p-4 sm:p-5 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-900 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Kapasitas Kuota Peserta &amp; Verifikasi Pembayaran (ACC)
                  </h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-900">
                    {stats.verifiedPayment}/{currentQuota} Kuota Terisi (Sisa{' '}
                    {Math.max(0, currentQuota - stats.verifiedPayment)} Kursi)
                  </span>
                  {stats.unverifiedPayment > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                      ⏳ {stats.unverifiedPayment} Menunggu ACC
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Kapasitas kuota di Portal Pendaftaran Peserta akan terupdate secara real-time saat
                  Anda menekan tombol <strong>ACC Bayar</strong> pada peserta di tabel bawah.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setQuotaDraft(String(currentQuota));
                  setIsEditingQuota((prev) => !prev);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-950 border border-purple-200 transition-all cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-purple-700" />
                Ubah Kuota ({currentQuota} Kursi)
              </button>

              <button
                type="button"
                onClick={() =>
                  setStatusFilter(
                    statusFilter === 'UNVERIFIED_PAYMENT' ? 'ALL' : 'UNVERIFIED_PAYMENT'
                  )
                }
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border',
                  statusFilter === 'UNVERIFIED_PAYMENT'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-200'
                )}
              >
                <Clock className="w-3.5 h-3.5" />
                {statusFilter === 'UNVERIFIED_PAYMENT'
                  ? 'Tampilkan Semua Peserta'
                  : `Filter Menunggu ACC (${stats.unverifiedPayment})`}
              </button>
            </div>
          </div>

          {isEditingQuota && (
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700 mr-1">Pilih Cepat Kuota:</span>
                {[5, 10, 15, 20, 25, 30, 40, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSaveDashboardQuota(preset)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer border',
                      currentQuota === preset
                        ? 'bg-purple-900 text-white border-purple-900'
                        : 'bg-slate-50 hover:bg-purple-50 text-slate-700 border-slate-200'
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={quotaDraft}
                  onChange={(e) => setQuotaDraft(e.target.value)}
                  className="w-24 px-3 py-1.5 rounded-xl border border-purple-300 text-xs font-mono font-bold text-slate-900 text-center focus:outline-none focus:border-purple-800"
                />
                <button
                  type="button"
                  onClick={() => handleSaveDashboardQuota()}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                >
                  Simpan Kuota
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingQuota(false)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Self-Registration Link & Post-Workshop Evaluation Quick Banner (Admin Only) */}
      {canManageParticipants && (
      <div
        className="bg-white rounded-2xl shadow-xs border border-purple-100 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        style={{
          background:
            'linear-gradient(115deg, rgba(240,189,251,0.14) 0%, rgba(201,179,252,0.12) 50%, rgba(137,180,255,0.14) 100%)',
        }}
      >
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-900 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Link Pendaftaran Mandiri (&ldquo;{formTemplate.shareLinkSlug || 'HealYou-Pendaftaran'}&rdquo;)
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                Khusus Peserta (Tanpa Login)
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Bagikan link <strong>{formTemplate.shareLinkSlug || 'HealYou-Pendaftaran'}</strong> kepada peserta, atau klik{' '}
              <strong>Edit Formulir &amp; Undangan</strong> untuk mengubah teks undangan, Save the Date, Benefit, dan pertanyaan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setFormTemplate(loadRegistrationTemplate(activeWorkshopId));
              setIsFormEditorOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white shadow-2xs transition-all cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Formulir &amp; Undangan
          </button>

          <button
            type="button"
            onClick={() => void handleCopyPortalLink('register')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-900 hover:bg-purple-950 text-white shadow-2xs transition-all cursor-pointer"
          >
            {copiedPortalType === 'register' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                Tersalin: {formTemplate.shareLinkSlug || 'HealYou-Pendaftaran'}!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Salin Link &ldquo;{formTemplate.shareLinkSlug || 'HealYou-Pendaftaran'}&rdquo;
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => void handleCopyPortalLink('certificate')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs transition-all cursor-pointer"
          >
            {copiedPortalType === 'certificate' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-200" />
                Link Klaim Disalin!
              </>
            ) : (
              <>
                <Award className="w-3.5 h-3.5" />
                Salin Link Klaim Sertifikat
              </>
            )}
          </button>

          {onOpenParticipantPortal && (
            <button
              type="button"
              onClick={() => onOpenParticipantPortal('register')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-purple-50 text-purple-950 border border-purple-200 shadow-2xs transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-purple-700" />
              Buka Halaman Peserta
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFeedbackModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 transition-all cursor-pointer"
          >
            <MessageSquareHeart className="w-3.5 h-3.5 text-amber-600" />
            Evaluasi ({feedbackStats.count})
            {feedbackStats.count > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-950 text-[10px] font-bold">
                {feedbackStats.avgOverall}★
              </span>
            )}
          </button>
        </div>
      </div>
      )}

      {/* Main Attendance Table Card */}
      <div className="flex-1 bg-white rounded-2xl shadow-xs border border-purple-100 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Daftar Kehadiran Peserta</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Jam mulai workshop:{' '}
                <span className="font-medium text-slate-700">
                  Pukul {format(new Date(config.startTime), 'HH:mm')} WIB
                </span>{' '}
                &nbsp;·&nbsp; Kehadiran:{' '}
                <span className="font-semibold text-[#5e438f]">
                  {stats.attended} dari {stats.total} peserta ({stats.attendanceRate}%)
                </span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama, ID (HY-...), domisili..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 w-full sm:w-64"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canManageParticipants && stats.attended > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingResetAttendance(true)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0"
                    title="Kembalikan status seluruh peserta menjadi Belum Hadir tanpa menghapus data peserta"
                  >
                    <RotateCcw className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Reset Kehadiran</span>
                  </button>
                )}
                {canManageParticipants && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setCertTargetId(null);
                        setIsCertificateModalOpen(true);
                      }}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0"
                      title="Cetak & unduh E-Sertifikat otomatis bagi peserta yang hadir (PDF A4 / PNG)"
                    >
                      <Award className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>E-Sertifikat ({stats.attended})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsWaBroadcastOpen(true)}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0"
                      title="Kirim pesan tiket & pengingat ke seluruh nomor WhatsApp peserta secara beruntun"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Broadcast WA</span>
                    </button>
                  </>
                )}
                <ExportButton />
              </div>
            </div>
          </div>

          {/* Filter Tabs & Sort Bar */}
          {waCardNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs font-medium text-emerald-900">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{waCardNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setWaCardNotice(null)}
                className="text-emerald-700 hover:underline font-semibold shrink-0 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'Semua', count: stats.total },
                  { id: 'PRESENT', label: 'Hadir Tepat Waktu', count: stats.present },
                  { id: 'LATE', label: 'Terlambat', count: stats.late },
                  { id: 'PENDING', label: 'Belum Hadir', count: stats.pending },
                  ...(canVerifyPayment
                    ? [
                        {
                          id: 'UNVERIFIED_PAYMENT' as const,
                          label: 'Menunggu ACC Pembayaran',
                          count: stats.unverifiedPayment,
                        },
                      ]
                    : []),
                ]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                    statusFilter === tab.id
                      ? tab.id === 'UNVERIFIED_PAYMENT'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-[#5e438f] text-white shadow-2xs'
                      : tab.id === 'UNVERIFIED_PAYMENT' && tab.count > 0
                        ? 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded-md text-[10px] font-semibold',
                      statusFilter === tab.id
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-slate-600'
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label htmlFor="dashboard-sort" className="text-xs text-slate-500">
                Urutkan:
              </label>
              <select
                id="dashboard-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
              >
                <option value="id">No. Presensi (HY-001...)</option>
                <option value="recent">Waktu Check-in Terbaru</option>
                <option value="name">Nama Peserta (A - Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                <th className="px-4 py-3.5 whitespace-nowrap">ID Presensi</th>
                <th className="px-4 py-3.5">Peserta &amp; Tempat Tinggal / Domisili</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Waktu Check-in</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap">Aksi Cepat &amp; Kartu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredParticipants.map((p) => (
                <motion.tr
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key={p.id}
                  className="hover:bg-purple-50/35 transition-colors"
                >
                  <td className="px-4 py-3.5 font-mono text-xs font-semibold text-[#4c3575] whitespace-nowrap">
                    {p.id}
                  </td>
                  <td className="px-4 py-3.5 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      {p.role && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-50 text-[#5e438f] border border-purple-100 rounded">
                          {p.role}
                        </span>
                      )}
                      {p.paymentVerified === false ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded">
                          <Clock className="w-2.5 h-2.5 text-amber-700" />
                          Menunggu ACC Pembayaran
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                          Pembayaran ACC
                        </span>
                      )}
                      {canManageParticipants && feedbacks[p.id.toUpperCase()] && (
                        <button
                          type="button"
                          onClick={() => setIsFeedbackModalOpen(true)}
                          title="Peserta telah mengisi evaluasi pasca-workshop & mengklaim E-Sertifikat"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded cursor-pointer hover:bg-amber-100"
                        >
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                          Evaluasi ({feedbacks[p.id.toUpperCase()].overallRating}★) &amp; Klaim
                        </button>
                      )}
                    </div>
                    <p className="text-slate-600 text-xs mt-0.5 font-medium">
                      📍 {p.institution}
                    </p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      {p.email}
                      {p.phone ? ` · ${p.phone}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium',
                        p.status === 'PRESENT' && 'bg-emerald-100 text-emerald-800',
                        p.status === 'LATE' && 'bg-amber-100 text-amber-800',
                        p.status === 'PENDING' && 'bg-slate-100 text-slate-600'
                      )}
                    >
                      {p.status === 'PRESENT' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {p.status === 'LATE' && <Clock className="w-3.5 h-3.5" />}
                      {p.status === 'PENDING' && <UserX className="w-3.5 h-3.5" />}
                      {p.status === 'PRESENT'
                        ? 'Hadir'
                        : p.status === 'LATE'
                          ? 'Terlambat'
                          : 'Belum Hadir'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 text-xs font-mono whitespace-nowrap">
                    {p.checkInTime ? `${format(new Date(p.checkInTime), 'HH:mm:ss')} WIB` : '-'}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      {canVerifyPayment && p.paymentProofUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewProofParticipant(p)}
                          title="Lihat foto bukti transfer peserta"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Bukti
                        </button>
                      )}

                      {canVerifyPayment && p.paymentVerified === false && (
                        <button
                          type="button"
                          onClick={() => {
                            verifyParticipantPayment(p.id, true);
                            playScanBeep('success');
                            setWaCardNotice(
                              `Pembayaran "${p.name}" (${p.id}) berhasil di-ACC! Kartu QR peserta kini aktif.`
                            );
                          }}
                          title="Terima / ACC Pembayaran peserta ini agar Kartu QR aktif"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          ACC Bayar
                        </button>
                      )}

                      {p.status === 'PENDING' ? (
                        <button
                          type="button"
                          onClick={() => {
                            const res = checkIn(p.id);
                            if (res.success) {
                              playScanBeep('success');
                            } else {
                              playScanBeep('error');
                              setWaCardNotice(res.message);
                            }
                          }}
                          title={
                            p.paymentVerified === false
                              ? 'Peserta belum di-ACC pembayarannya'
                              : 'Tandai hadir sekarang'
                          }
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer border',
                            p.paymentVerified === false
                              ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200/60'
                          )}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Check-in
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuickUndoCheckIn(p.id)}
                          title="Batalkan status check-in (kembalikan ke Belum Hadir)"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Batal
                        </button>
                      )}

                      {canVerifyPayment && p.paymentVerified !== false && (
                        <a
                          href={buildApprovedPortalWhatsAppUrl(p)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleWaSendWithCardCopy(p)}
                          title="Kirim notifikasi WA bahwa pembayaran telah di-ACC beserta link pembuka Kartu QR otomatis"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/70 rounded-lg transition-colors cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WA + Kartu
                        </a>
                      )}

                      {canManageParticipants && (
                        <>
                          {typeof navigator !== 'undefined' && 'share' in navigator && (
                            <button
                              type="button"
                              onClick={() => void shareParticipantCardFile(p, config)}
                              title="Bagikan file gambar Kartu PNG langsung ke WhatsApp (HP)"
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-[#5e438f] bg-purple-50 hover:bg-purple-100 border border-purple-200/60 rounded-lg transition-colors cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {p.status !== 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => {
                                setCertTargetId(p.id);
                                setIsCertificateModalOpen(true);
                              }}
                              title={`Buka & unduh E-Sertifikat untuk ${p.name}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors cursor-pointer"
                            >
                              <Award className="w-3.5 h-3.5 text-amber-600" />
                              Sertifikat
                            </button>
                          )}
                        </>
                      )}

                      {onEditParticipant && (
                        <button
                          type="button"
                          onClick={() => onEditParticipant(p.id)}
                          title="Lihat Kartu Pengenal & Edit Data"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#5e438f] bg-purple-50 hover:bg-purple-100 border border-purple-200/60 rounded-lg transition-colors cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          Kartu / Edit
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filteredParticipants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm">
                    Tidak ada data peserta yang sesuai dengan filter atau pencarian Anda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <WhatsAppBroadcastModal
        isOpen={isWaBroadcastOpen}
        onClose={() => setIsWaBroadcastOpen(false)}
        participants={participants}
        config={config}
      />

      <CertificateModal
        isOpen={isCertificateModalOpen}
        onClose={() => setIsCertificateModalOpen(false)}
        participants={participants}
        config={config}
        initialParticipantId={certTargetId}
      />

      {/* Modal Rekap Umpan Balik / Evaluasi Pasca-Workshop */}
      {isFeedbackModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsFeedbackModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl border border-purple-100 shadow-2xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-4 bg-purple-50/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <MessageSquareHeart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Rekap Evaluasi Pasca-Workshop &amp; Klaim E-Sertifikat Mandiri
                  </h3>
                  <p className="text-xs text-slate-500">
                    {config.name} · {feedbackStats.count} dari {stats.attended} peserta hadir telah
                    mengisi evaluasi
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {feedbackList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportFeedbackExcel}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Unduh Excel (.xlsx)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFeedbackModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Summary Rating Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 block">
                    Total Klaim &amp; Evaluasi
                  </span>
                  <span className="text-2xl font-bold text-purple-950 mt-1 block">
                    {feedbackStats.count}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      / {stats.attended} hadir
                    </span>
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                    Kepuasan Acara
                  </span>
                  <span className="text-2xl font-bold text-amber-950 mt-1 flex items-center gap-1">
                    {feedbackStats.avgOverall}
                    <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Materi &amp; Narasumber
                  </span>
                  <span className="text-2xl font-bold text-emerald-950 mt-1 flex items-center gap-1">
                    {feedbackStats.avgSpeaker}
                    <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 block">
                    Panitia &amp; Fasilitas
                  </span>
                  <span className="text-2xl font-bold text-blue-950 mt-1 flex items-center gap-1">
                    {feedbackStats.avgFacility}
                    <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
                  </span>
                </div>
              </div>

              {feedbackList.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <MessageSquareHeart className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">
                    Belum Ada Evaluasi Pasca-Workshop yang Masuk
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Bagikan <strong>Link Klaim Sertifikat</strong> kepada peserta yang telah hadir.
                    Saat peserta memindai QR Kartu Peserta di halaman pendaftaran mandiri dan
                    mengisi evaluasi, ulasan mereka akan muncul secara otomatis di sini.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedbackList.map((item) => (
                    <div
                      key={item.participantId}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-purple-100 text-purple-900">
                            {item.participantId}
                          </span>
                          <span className="text-sm font-bold text-slate-900">
                            {item.participantName}
                          </span>
                          <span className="text-xs text-slate-500">· {item.institution}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900">
                            Acara: {item.overallRating}★ · Materi: {item.speakerRating}★ · Panitia:{' '}
                            {item.facilityRating}★
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800">
                            {item.recommendation}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200/70 leading-relaxed">
                        &ldquo;{item.takeaway}&rdquo;
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>
                          <strong>Usulan Topik Selanjutnya:</strong>{' '}
                          {item.suggestedTopic || 'Tidak ada usulan khusus'}
                        </span>
                        <span>
                          Diklaim:{' '}
                          {(() => {
                            try {
                              return format(new Date(item.submittedAt), 'dd MMM yyyy HH:mm');
                            } catch {
                              return item.submittedAt;
                            }
                          })()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Reset Kehadiran Peserta */}
      {isConfirmingResetAttendance && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Reset Status Kehadiran Peserta?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Data nama &amp; ID peserta tetap tersimpan dengan aman
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-600 leading-relaxed">
              Status kehadiran dari <strong>{stats.attended} peserta yang sudah check-in</strong>{' '}
              akan dikembalikan menjadi <strong>Belum Hadir (0%)</strong> dan jam check-in akan
              dikosongkan. Daftar peserta dan pengaturan acara tidak akan terhapus.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsConfirmingResetAttendance(false)}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  resetAttendance();
                  setIsConfirmingResetAttendance(false);
                  setWaCardNotice(
                    'Seluruh status kehadiran peserta berhasil direset menjadi Belum Hadir.'
                  );
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Ya, Reset Kehadiran
              </button>
            </div>
          </div>
        </div>
      )}

      {isFormEditorOpen && canManageParticipants && (
        <RegistrationFormEditorModal
          workshopId={activeWorkshopId}
          initialTemplate={formTemplate}
          portalShareUrl={buildParticipantPortalUrl(activeWorkshopId, config, 'register')}
          onClose={() => setIsFormEditorOpen(false)}
          onSaved={(updated) => setFormTemplate(updated)}
          onCopyPortalLink={() => void handleCopyPortalLink('register')}
        />
      )}

      {/* Modal Preview Bukti Transfer Peserta (Admin & Panitia) */}
      {previewProofParticipant && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewProofParticipant(null)}
        >
          <div
            className="bg-white rounded-3xl border border-purple-100 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-purple-50/40">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Bukti Transfer · {previewProofParticipant.name} ({previewProofParticipant.id})
                </h3>
                <p className="text-xs text-slate-500">
                  {previewProofParticipant.paymentFileName || 'Bukti Pembayaran'} ·{' '}
                  {previewProofParticipant.phone || previewProofParticipant.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProofParticipant(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-slate-50">
              {previewProofParticipant.paymentProofUrl ? (
                <img
                  src={previewProofParticipant.paymentProofUrl}
                  alt={`Bukti Transfer ${previewProofParticipant.name}`}
                  className="max-h-[60vh] w-auto rounded-xl border border-slate-200 shadow-xs object-contain"
                />
              ) : (
                <p className="text-xs text-slate-500 py-10">
                  Tidak ada gambar bukti transfer yang tersimpan.
                </p>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-white">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold',
                  previewProofParticipant.paymentVerified === false
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-emerald-100 text-emerald-900'
                )}
              >
                {previewProofParticipant.paymentVerified === false
                  ? 'Menunggu Verifikasi / ACC'
                  : 'Pembayaran Terverifikasi (ACC)'}
              </span>

              <div className="flex items-center gap-2">
                {previewProofParticipant.paymentVerified === false ? (
                  <button
                    type="button"
                    onClick={() => {
                      verifyParticipantPayment(previewProofParticipant.id, true);
                      playScanBeep('success');
                      setPreviewProofParticipant((prev) =>
                        prev ? { ...prev, paymentVerified: true } : null
                      );
                      setWaCardNotice(
                        `Pembayaran "${previewProofParticipant.name}" (${previewProofParticipant.id}) berhasil di-ACC!`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Terima / ACC Pembayaran
                  </button>
                ) : (
                  <a
                    href={buildApprovedPortalWhatsAppUrl(previewProofParticipant)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-2xs cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Kirim Link Kartu Aktif via WA
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function StatCard({
  title,
  value,
  subtitle,
  icon,
  bgColor,
  active,
  onClick,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  bgColor: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'bg-white p-4 sm:p-5 rounded-2xl shadow-xs border text-left flex items-center gap-3.5 transition-all cursor-pointer',
        active
          ? 'border-[#7c52b8] ring-2 ring-purple-200/70'
          : 'border-slate-200/90 hover:border-purple-200'
      )}
    >
      <div
        className={cn(
          'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
          bgColor
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 truncate">{title}</p>
        <p className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">{value}</p>
        {subtitle && <p className="text-[11px] text-slate-400 truncate mt-0.5">{subtitle}</p>}
      </div>
    </button>
  );
}
