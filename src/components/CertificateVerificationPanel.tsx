import React, { useState, useEffect, useMemo, useRef, useId } from 'react';
import { useAppContext } from '../store';
import { Participant } from '../types';
import {
  renderBotanicalCertificateCanvas,
  parseCertificateQrOrInput,
  computeParticipantQrSignature,
  buildSignedParticipantQrValue,
  getCanonicalParticipantSeqIndex,
  formatOfficialCertificateNumber,
} from '../lib/certificateRenderer';
import { decodeQrFromUploadedCardOrImage } from '../lib/qrSecurity';
import { formatSafeDateStr } from '../lib/whatsapp';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Award,
  CheckCircle2,
  Clock,
  Search,
  Download,
  Maximize2,
  Minimize2,
  UserCheck,
  Calendar,
  MapPin,
  FileCheck2,
  RotateCcw,
  Sparkles,
  QrCode,
  PenTool,
  Upload,
  Link2,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { playScanBeep } from '../lib/sound';

export interface VerificationLookupResult {
  query: string;
  participant: Participant | null;
  seqIndex: number;
  certNumber: string;
  verifiedAt: string;
  qrSignature?: string;
  linkedIdCardQr?: string;
  isSignatureValid?: boolean;
  isForgedSignature?: boolean;
  sourceType?: 'CERT_QR' | 'ID_CARD_QR' | 'MANUAL_LOOKUP';
}

interface CertificateVerificationPanelProps {
  verificationTarget: VerificationLookupResult | null;
  onSelectVerificationTarget: (rawCodeOrId: string) => void;
  onClearVerification: () => void;
}

export const CertificateVerificationPanel: React.FC<CertificateVerificationPanelProps> = ({
  verificationTarget,
  onSelectVerificationTarget,
  onClearVerification,
}) => {
  const {
    participants,
    config,
    certificateSettings,
    checkIn,
    activeWorkshopId,
  } = useAppContext();

  const [searchInput, setSearchInput] = useState('');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploadingVerifyFile, setIsUploadingVerifyFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const verifyFileScannerId = `cert-verify-file-scanner-${useId().replace(/:/g, '')}`;

  const attendedParticipants = useMemo(
    () => participants.filter((p) => p.status === 'PRESENT' || p.status === 'LATE'),
    [participants]
  );

  // Keep participant data live if status changes (e.g. if admin clicks Check-in & Sahkan)
  const liveParticipant = useMemo(() => {
    if (!verificationTarget?.participant) return null;
    return (
      participants.find(
        (p) => p.id.toUpperCase() === verificationTarget.participant!.id.toUpperCase()
      ) || verificationTarget.participant
    );
  }, [verificationTarget, participants]);

  // Render live official comparison E-Certificate canvas whenever a valid participant is verified
  useEffect(() => {
    if (!liveParticipant || !verificationTarget) {
      setPreviewDataUrl(null);
      return;
    }
    let cancelled = false;
    void renderBotanicalCertificateCanvas(
      liveParticipant,
      verificationTarget.seqIndex,
      config,
      certificateSettings
    ).then((canvas) => {
      if (!cancelled) {
        setPreviewDataUrl(canvas.toDataURL('image/png'));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [liveParticipant, verificationTarget, config, certificateSettings]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    onSelectVerificationTarget(searchInput.trim());
  };

  const handleUploadCardOrCertFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingVerifyFile(true);
    try {
      const { decodedText } = await decodeQrFromUploadedCardOrImage(file, verifyFileScannerId);
      if (decodedText) {
        onSelectVerificationTarget(decodedText);
      } else {
        playScanBeep('error');
        onSelectVerificationTarget(`UNREADABLE_QR:${file.name}`);
      }
    } catch {
      playScanBeep('error');
    } finally {
      setIsUploadingVerifyFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadOfficialCopy = async () => {
    if (!liveParticipant || !verificationTarget) return;
    setIsDownloading(true);
    try {
      const canvas = await renderBotanicalCertificateCanvas(
        liveParticipant,
        verificationTarget.seqIndex,
        config,
        certificateSettings
      );
      const link = document.createElement('a');
      link.download = `ESertifikat_Terverifikasi_${liveParticipant.id}_${liveParticipant.name.replace(/[^a-z0-9]/gi, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setIsDownloading(false);
    }
  };

  const organizer =
    (certificateSettings.organizerHeader && certificateSettings.organizerHeader.trim()) ||
    config.organizer ||
    'Muslimah Healing Journey';
  const formattedEventDate = formatSafeDateStr(config.date, 'dd MMMM yyyy');

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-purple-100 overflow-hidden flex flex-col">
      <div id={verifyFileScannerId} className="hidden" aria-hidden="true" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadCardOrCertFile}
        className="hidden"
      />
      {/* Fullscreen Zoom Modal for Official Certificate Comparison */}
      {isZoomed && previewDataUrl && liveParticipant && (
        <div
          onClick={() => setIsZoomed(false)}
          className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="max-w-5xl w-full flex items-center justify-between text-white mb-3">
            <span className="text-sm font-bold">
              Salinan Asli Sistem · {verificationTarget?.certNumber} ({liveParticipant.name})
            </span>
            <button
              type="button"
              onClick={() => setIsZoomed(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-semibold cursor-pointer"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Tutup Layar Penuh</span>
            </button>
          </div>
          <img
            src={previewDataUrl}
            alt={`E-Sertifikat Asli ${liveParticipant.name}`}
            className="max-w-5xl w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20"
          />
        </div>
      )}

      {/* Top Header */}
      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-purple-50/70 via-white to-amber-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5e438f] text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Halaman Verifikasi Keaslian E-Sertifikat
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                  <Award className="w-3 h-3 text-amber-600" />
                  Otentikasi Resmi Heal You
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pindai QR pada E-Sertifikat di panel kiri, unggah file sertifikat PNG, atau masukkan Nomor Sertifikat / ID Peserta di bawah ini
              </p>
            </div>
          </div>

          {verificationTarget && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                onClearVerification();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset / Cek Sertifikat Lain</span>
            </button>
          )}
        </div>

        {/* Direct Certificate Number / ID Verification Search Bar + Upload Kartu/Sertifikat Button */}
        <form onSubmit={handleSearchSubmit} className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Masukkan Nomor Sertifikat (No. 001/HY-001...), Token Barcode (#HY01|SIG:...), atau Nama Peserta..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-purple-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          <button
            type="button"
            disabled={isUploadingVerifyFile}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-[#4c3575] border border-purple-200 text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Upload className="w-4 h-4 text-[#5e438f]" />
            <span>
              {isUploadingVerifyFile ? 'Memindai...' : 'Unggah Kartu / Sertifikat'}
            </span>
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#5e438f] hover:bg-[#4c3575] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verifikasi Keaslian</span>
          </button>
        </form>
      </div>

      {/* Main Verification Result Body */}
      <div className="p-5 space-y-5">
        {verificationTarget ? (
          liveParticipant ? (
            <div className="space-y-5">
              {/* 1. Primary Authenticity Status Banner */}
              {liveParticipant.status === 'PRESENT' || liveParticipant.status === 'LATE' ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50 border-2 border-emerald-300/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-700 text-white">
                          TERVERIFIKASI ASLI &amp; SAH
                        </span>
                        <span className="text-xs font-mono font-semibold text-emerald-900">
                          {verificationTarget.certNumber}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-emerald-950 mt-1">
                        E-Sertifikat Resmi Terdaftar atas Nama {liveParticipant.name}
                      </h3>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Dokumen ini valid, diterbitkan secara resmi oleh{' '}
                        <strong>Heal You · {organizer}</strong>, dan peserta tercatat telah hadir
                        mengikuti kegiatan.
                      </p>
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-emerald-200/70">
                    <span className="text-[11px] font-medium text-emerald-700 block">
                      Waktu Verifikasi Sistem
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-950">
                      {verificationTarget.verifiedAt}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-50 border-2 border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-700 text-white">
                          TERDAFTAR — BELUM CHECK-IN KEHADIRAN
                        </span>
                        <span className="text-xs font-mono font-semibold text-amber-900">
                          {verificationTarget.certNumber}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-amber-950 mt-1">
                        {liveParticipant.name} Terdaftar, Namun Status Presensi Masih &ldquo;Belum Hadir&rdquo;
                      </h3>
                      <p className="text-xs text-amber-800 mt-0.5">
                        ID Peserta ditemukan di database acara <strong>{config.name}</strong>,
                        tetapi peserta belum tercatat melakukan scan kehadiran di meja registrasi.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const res = checkIn(liveParticipant.id);
                      if (res.success) {
                        playScanBeep('success');
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Catat Hadir &amp; Sahkan Sekarang</span>
                  </button>
                </div>
              )}

              {/* 2. Split Grid: Certificate Authenticity Details & Live Official Visual Comparison */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* Left Details Column (7 cols) */}
                <div className="xl:col-span-7 space-y-4">
                  {/* Holder & Attendance Card */}
                  <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#4c3575] flex items-center gap-1.5">
                        <FileCheck2 className="w-4 h-4 text-[#5e438f]" />
                        Data Pemegang &amp; Nomor Seri Sertifikat
                      </span>
                      <span className="font-mono text-xs font-bold text-[#5e438f] bg-purple-100/80 px-2.5 py-0.5 rounded-lg">
                        ID: {liveParticipant.id}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200/70">
                        <span className="text-[11px] text-slate-500 block">
                          Nama Lengkap Pemegang Sertifikat
                        </span>
                        <p className="text-sm font-bold text-slate-900 mt-0.5">
                          {liveParticipant.name}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white border border-slate-200/70">
                        <span className="text-[11px] text-slate-500 block">
                          Nomor Seri E-Sertifikat Resmi
                        </span>
                        <p className="text-xs sm:text-sm font-mono font-bold text-[#4c3575] mt-0.5 break-all">
                          {verificationTarget.certNumber}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white border border-slate-200/70">
                        <span className="text-[11px] text-slate-500 block">
                          Pekerjaan / Kegiatan &amp; Tempat Tinggal / Domisili
                        </span>
                        <p className="text-xs font-semibold text-slate-800 mt-0.5">
                          {liveParticipant.role || 'Peserta Workshop'} · 📍{' '}
                          {liveParticipant.institution}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white border border-slate-200/70">
                        <span className="text-[11px] text-slate-500 block">
                          Rekam Jejak Kehadiran (Check-in)
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {liveParticipant.status === 'PRESENT' ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="font-bold text-emerald-800">
                                Hadir Tepat Waktu
                              </span>
                            </>
                          ) : liveParticipant.status === 'LATE' ? (
                            <>
                              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-bold text-amber-800">
                                Hadir Terlambat
                              </span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-4 h-4 text-rose-500 shrink-0" />
                              <span className="font-bold text-rose-700">Belum Check-in</span>
                            </>
                          )}
                          {liveParticipant.checkInTime && (
                            <span className="text-[11px] font-mono text-slate-500">
                              ({format(new Date(liveParticipant.checkInTime), 'HH:mm:ss')} WIB)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bidirectional Barcode Pengenal <-> E-Sertifikat Synchronization Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50/80 via-white to-emerald-50/60 border border-purple-200/80 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#4c3575] flex items-center gap-1.5">
                        <Link2 className="w-4 h-4 text-emerald-600" />
                        Sinkronisasi Barcode Kartu Pengenal &amp; E-Sertifikat
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {verificationTarget.sourceType === 'ID_CARD_QR'
                          ? 'Terhubung dari Scan Barcode Kartu Pengenal'
                          : verificationTarget.sourceType === 'CERT_QR'
                            ? 'Terhubung dari Scan QR E-Sertifikat'
                            : 'Tersinkronisasi 2 Arah'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-white border border-purple-100">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                          Token Barcode Pengenal
                        </span>
                        <span className="font-mono font-bold text-[#4c3575] text-[11px] break-all">
                          {buildSignedParticipantQrValue(liveParticipant.id, activeWorkshopId)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-purple-100">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                          Kunci Kriptografi Terhubung
                        </span>
                        <span className="font-mono font-bold text-emerald-700 text-xs">
                          SIG-{computeParticipantQrSignature(liveParticipant.id)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-purple-100">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                          Nomor E-Sertifikat Terhubung
                        </span>
                        <span className="font-mono font-bold text-slate-900 text-[11px] break-all">
                          {verificationTarget.certNumber}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Event & Authorized Signers Card */}
                  <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#4c3575] flex items-center gap-1.5">
                        <PenTool className="w-4 h-4 text-[#5e438f]" />
                        Detail Acara &amp; Pejabat Penandatangan Sah
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">
                        Heal You · {organizer}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-slate-200/70 space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-700">
                        {config.eventLabel || 'Agenda Workshop Psikologi'}
                      </span>
                      <p className="text-sm font-bold text-slate-900">{config.name}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#5e438f]" />
                          {certificateSettings.city}, {formattedEventDate}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#5e438f]" />
                          {config.location}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white border border-slate-200/70">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Penandatangan 1 · Penyelenggara
                        </span>
                        <p className="text-xs font-bold text-slate-900 mt-1">
                          {certificateSettings.signer1Name}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {certificateSettings.signer1Title}
                        </p>
                      </div>

                      {certificateSettings.enableSigner2 && (
                        <div className="p-3 rounded-xl bg-white border border-slate-200/70">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Penandatangan 2 · Narasumber
                          </span>
                          <p className="text-xs font-bold text-slate-900 mt-1">
                            {certificateSettings.signer2Name}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {certificateSettings.signer2Title}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Official Visual Certificate Comparison (5 cols) */}
                <div className="xl:col-span-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#4c3575] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      Salinan Asli E-Sertifikat di Sistem
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsZoomed(true)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#4c3575] border border-purple-200 text-[11px] font-semibold cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Perbesar</span>
                    </button>
                  </div>

                  <div
                    onClick={() => setIsZoomed(true)}
                    title="Klik untuk memperbesar salinan asli E-Sertifikat"
                    className="w-full aspect-[1400/990] rounded-2xl overflow-hidden border-2 border-purple-200 shadow-md bg-[#fbf9f4] cursor-zoom-in"
                  >
                    {previewDataUrl ? (
                      <img
                        src={previewDataUrl}
                        alt={`Salinan Resmi E-Sertifikat ${liveParticipant.name}`}
                        className="w-full h-full object-contain block"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                        Memuat pratinjau sertifikat asli...
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={() => void handleDownloadOfficialCopy()}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#5e438f] hover:bg-[#4c3575] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Salinan Resmi (PNG)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* NOT FOUND / INVALID CERTIFICATE ALERT */
            <div className="p-6 rounded-2xl bg-rose-50/90 border-2 border-rose-300 text-rose-950 space-y-3">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <ShieldX className="w-6 h-6" />
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-700 text-white">
                    TIDAK TERDAFTAR / TIDAK VALID
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-rose-950 mt-1">
                    E-Sertifikat dengan Kode &ldquo;{verificationTarget.query}&rdquo; Tidak Ditemukan
                  </h3>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                    Kode QR atau Nomor Sertifikat tersebut tidak terdaftar dalam database peserta
                    acara <strong>{config.name}</strong>. Pastikan Anda memilih sesi acara yang
                    sesuai di bagian atas aplikasi, atau periksa kembali keaslian dokumen.
                  </p>
                </div>
              </div>
            </div>
          )
        ) : (
          /* Empty State: Quick List of Issued Certificates to Verify */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white text-[#5e438f] border border-purple-200 flex items-center justify-center shrink-0">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#2b1b47]">
                    Siap Memindai QR Code E-Sertifikat
                  </p>
                  <p className="text-xs text-slate-600">
                    Gunakan <strong>Kamera</strong> atau unggah file{' '}
                    <strong>PNG E-Sertifikat</strong> pada panel Scanner di sebelah kiri, atau pilih
                    salah satu sertifikat peserta di bawah ini untuk melihat halaman verifikasinya:
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Daftar E-Sertifikat Terdaftar pada Acara Ini ({participants.length} Peserta ·{' '}
                  {attendedParticipants.length} Sudah Hadir)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
                {participants.map((p) => {
                  const certNo = formatOfficialCertificateNumber(
                    p.id,
                    participants,
                    certificateSettings.numberSuffix
                  );
                  const isAttended = p.status === 'PRESENT' || p.status === 'LATE';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelectVerificationTarget(p.id)}
                      className="p-3 rounded-xl bg-slate-50/80 hover:bg-purple-50/80 border border-slate-200/80 hover:border-purple-300 text-left flex items-center justify-between gap-3 transition-all cursor-pointer group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate group-hover:text-[#4c3575]">
                            {p.name}
                          </span>
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0',
                              isAttended
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            )}
                          >
                            {isAttended ? 'Sah / Hadir' : 'Belum Check-in'}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-[#5e438f] truncate mt-0.5">
                          {certNo}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {p.institution}
                        </p>
                      </div>

                      <div className="px-2.5 py-1.5 rounded-lg bg-white group-hover:bg-[#5e438f] text-[#5e438f] group-hover:text-white border border-purple-200 text-xs font-semibold transition-colors shrink-0">
                        Cek Sertifikat
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export function resolveCertificateVerification(
  rawInput: string,
  participants: Participant[],
  numberSuffix: string
): VerificationLookupResult {
  const parsed = parseCertificateQrOrInput(rawInput);
  const queryText = parsed.participantId || rawInput.trim();
  const nowStr = `${format(new Date(), 'dd MMM yyyy, HH:mm:ss')} WIB`;

  // 1. Try exact ID match
  let foundIdx = participants.findIndex(
    (p) => p.id.toUpperCase() === queryText.toUpperCase()
  );

  // 2. Try matching by full certificate number or name substring if not found by ID
  if (foundIdx === -1) {
    const lowerRaw = rawInput.trim().toLowerCase();
    foundIdx = participants.findIndex((p) => {
      const candidateCertNo = formatOfficialCertificateNumber(
        p.id,
        participants,
        numberSuffix
      ).toLowerCase();
      return (
        candidateCertNo === lowerRaw ||
        p.name.toLowerCase() === lowerRaw ||
        p.name.toLowerCase().includes(lowerRaw)
      );
    });
  }

  if (foundIdx >= 0) {
    const p = participants[foundIdx];
    const expectedSig = computeParticipantQrSignature(p.id);
    if (parsed.qrSig && parsed.qrSig.toUpperCase() !== expectedSig) {
      return {
        query: `${p.id} (Signature Tidak Cocok)`,
        participant: null,
        seqIndex: 0,
        certNumber: '-',
        verifiedAt: nowStr,
        isForgedSignature: true,
      };
    }

    const canonicalIdx = getCanonicalParticipantSeqIndex(p.id, participants);
    const certNumber = formatOfficialCertificateNumber(p.id, participants, numberSuffix);
    const sourceType: 'CERT_QR' | 'ID_CARD_QR' | 'MANUAL_LOOKUP' = parsed.isExplicitCert
      ? 'CERT_QR'
      : parsed.isSignedParticipantCard
        ? 'ID_CARD_QR'
        : 'MANUAL_LOOKUP';

    return {
      query: rawInput.trim(),
      participant: p,
      seqIndex: canonicalIdx,
      certNumber,
      verifiedAt: nowStr,
      qrSignature: expectedSig,
      isSignatureValid: Boolean(parsed.qrSig),
      sourceType,
    };
  }

  return {
    query: rawInput.trim(),
    participant: null,
    seqIndex: 0,
    certNumber: '-',
    verifiedAt: nowStr,
  };
}
