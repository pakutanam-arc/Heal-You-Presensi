import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Participant, WorkshopConfig } from '../types';
import {
  normalizeWhatsAppPhone,
  formatSafeDateStr,
} from '../lib/whatsapp';
import {
  renderBotanicalCertificateCanvas,
  CertificateSettings,
  SignatureMode,
  getShortSignatureName,
} from '../lib/certificateRenderer';
import {
  Award,
  Download,
  Printer,
  X,
  Copy,
  MessageCircle,
  Upload,
  RotateCcw,
  Users,
  CheckCircle2,
  SlidersHorizontal,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Share2,
  PenTool,
  Type,
  Eraser,
  Ban,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  config: WorkshopConfig;
  initialParticipantId?: string | null;
}

const DEFAULT_CERT_SETTINGS: CertificateSettings = {
  organizerHeader: '',
  certTitle: 'SERTIFIKAT PENGHARGAAN',
  certSubtitle: 'Diberikan dengan penuh apresiasi kepada:',
  numberSuffix: '/SERT-HY/MHJ/2026',
  city: 'Jakarta',
  bodyIntro:
    'Atas partisipasi aktif dan kehadirannya dalam kegiatan pemulihan batin & kesehatan mental:',
  signer1Label: 'Mengetahui, Penyelenggara:',
  signer1Name: 'Hj. Siti Sarah, M.Psi., Psikolog',
  signer1Title: 'Ketua Penyelenggara · Muslimah Healing Journey',
  signer1SigMode: 'TEXT',
  signer1SignatureText: 'Siti Sarah',
  enableSigner2: true,
  signer2Name: 'Dr. Aisyah Putri, M.Psi., Psikolog',
  signer2Title: 'Narasumber & Psikolog Utama',
  signer2SigMode: 'TEXT',
  signer2SignatureText: 'Aisyah Putri',
};

const SAMPLE_PREVIEW_PARTICIPANT: Participant = {
  id: 'HY-001',
  name: 'Peserta Workshop Heal You',
  email: 'peserta@healyou.id',
  phone: '081234567890',
  institution: 'Muslimah Healing Journey',
  role: 'Peserta Workshop',
  status: 'PRESENT',
};

export const CertificateModal: React.FC<CertificateModalProps> = ({
  isOpen,
  onClose,
  participants,
  config,
  initialParticipantId,
}) => {
  const [filterMode, setFilterMode] = useState<'ATTENDED' | 'ALL'>('ATTENDED');
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
  const [showAdvancedTextSettings, setShowAdvancedTextSettings] = useState(false);
  const [isZoomedPreview, setIsZoomedPreview] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Interactive Signature Drawing Pad State
  const [drawingSigner, setDrawingSigner] = useState<1 | 2 | null>(null);
  const [inkColor, setInkColor] = useState<string>('#2b194d');
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const signerEditorRef = useRef<HTMLDivElement | null>(null);

  const [settings, setSettings] = useState<CertificateSettings>(() => {
    try {
      const saved = localStorage.getItem('heal_you_certificate_settings_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CERT_SETTINGS,
          ...parsed,
          signer1SigMode:
            parsed.signer1SigMode ||
            (parsed.signer1SignatureDataUrl ? 'IMAGE' : 'TEXT'),
          signer2SigMode:
            parsed.signer2SigMode ||
            (parsed.signer2SignatureDataUrl ? 'IMAGE' : 'TEXT'),
          signer1SignatureText:
            parsed.signer1SignatureText ??
            getShortSignatureName(parsed.signer1Name || DEFAULT_CERT_SETTINGS.signer1Name),
          signer2SignatureText:
            parsed.signer2SignatureText ??
            getShortSignatureName(parsed.signer2Name || DEFAULT_CERT_SETTINGS.signer2Name),
        };
      }
    } catch {
      // Ignore
    }
    return DEFAULT_CERT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('heal_you_certificate_settings_v1', JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  }, [settings]);

  // Initialize signature drawing canvas when opened
  useEffect(() => {
    if (!drawingSigner || !sigCanvasRef.current) return;
    const canvas = sigCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [drawingSigner]);

  const attendedParticipants = useMemo(
    () => participants.filter((p) => p.status === 'PRESENT' || p.status === 'LATE'),
    [participants]
  );

  const targetList = useMemo(() => {
    if (filterMode === 'ATTENDED') {
      return attendedParticipants;
    }
    return participants;
  }, [filterMode, attendedParticipants, participants]);

  // Auto-switch to ALL if no one has checked in yet so preview is never blank
  useEffect(() => {
    if (isOpen) {
      if (initialParticipantId) {
        const targetP = participants.find((p) => p.id === initialParticipantId);
        if (targetP) {
          if (targetP.status === 'PENDING') {
            setFilterMode('ALL');
          }
          setSelectedParticipantId(targetP.id);
          return;
        }
      }
      if (attendedParticipants.length === 0 && participants.length > 0) {
        setFilterMode('ALL');
        setSelectedParticipantId(participants[0].id);
      } else if (attendedParticipants.length > 0) {
        setFilterMode('ATTENDED');
        setSelectedParticipantId(attendedParticipants[0].id);
      }
    }
  }, [isOpen, initialParticipantId]);

  // Always guarantee an active participant for preview (even if 0 checked-in or 0 total)
  const activeParticipant = useMemo(() => {
    return (
      targetList.find((p) => p.id === selectedParticipantId) ||
      targetList[0] ||
      participants.find((p) => p.id === selectedParticipantId) ||
      participants[0] ||
      SAMPLE_PREVIEW_PARTICIPANT
    );
  }, [targetList, selectedParticipantId, participants]);

  const activeIndex = useMemo(() => {
    const idx = targetList.findIndex((p) => p.id === activeParticipant.id);
    return idx >= 0 ? idx : 0;
  }, [targetList, activeParticipant]);

  const showNotice = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 5000);
  };

  /**
   * Renders a high-resolution A4 Landscape Botanical & Gold Filigree Parchment Certificate.
   */
  const renderCertificateCanvas = async (
    participant: Participant,
    seqIndex: number
  ): Promise<HTMLCanvasElement> => {
    return renderBotanicalCertificateCanvas(participant, seqIndex, config, settings);
  };

  // Update Live Preview whenever activeParticipant, config, or settings change
  useEffect(() => {
    if (!isOpen || !activeParticipant) return;
    let cancelled = false;
    void renderCertificateCanvas(activeParticipant, activeIndex).then((canvas) => {
      if (!cancelled) {
        setPreviewDataUrl(canvas.toDataURL('image/png'));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeParticipant, activeIndex, config, settings]);

  if (!isOpen) return null;

  const handleSignatureUpload = (
    signer: 1 | 2,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const dataUrl = reader.result;
        setSettings((prev) =>
          signer === 1
            ? {
                ...prev,
                signer1SigMode: 'IMAGE',
                signer1SignatureDataUrl: dataUrl,
              }
            : {
                ...prev,
                signer2SigMode: 'IMAGE',
                signer2SignatureDataUrl: dataUrl,
              }
        );
        showNotice(
          `Gambar tanda tangan ${signer === 1 ? 'Penyelenggara' : 'Narasumber'} berhasil dipasang!`
        );
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Interactive Signature Drawing Pad Handlers
  const getCanvasCoordinates = (
    e: React.PointerEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pt = getCanvasCoordinates(e, canvas);
    lastPointRef.current = pt;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = inkColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !lastPointRef.current) return;

    const pt = getCanvasCoordinates(e, canvas);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();

    lastPointRef.current = pt;
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearSignaturePad = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveDrawnSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas || !drawingSigner) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSettings((prev) =>
      drawingSigner === 1
        ? {
            ...prev,
            signer1SigMode: 'IMAGE',
            signer1SignatureDataUrl: dataUrl,
          }
        : {
            ...prev,
            signer2SigMode: 'IMAGE',
            signer2SignatureDataUrl: dataUrl,
          }
    );
    showNotice(
      `Tanda tangan goresan ${drawingSigner === 1 ? 'Penyelenggara' : 'Narasumber'} berhasil disimpan ke Pratinjau E-Sertifikat!`
    );
    setDrawingSigner(null);
  };

  const handleDownloadSinglePng = async (p: Participant, idx: number) => {
    setIsBusy(true);
    try {
      const canvas = await renderCertificateCanvas(p, idx);
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `ESertifikat_HealYou_${p.id}_${p.name.replace(/[^a-z0-9]/gi, '_')}.png`;
      link.href = dataUrl;
      link.click();
      showNotice(`E-Sertifikat PNG "${p.name}" berhasil diunduh!`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopyCertificateToClipboard = async (p: Participant, idx: number): Promise<boolean> => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard || !window.ClipboardItem) {
        return false;
      }
      const canvas = await renderCertificateCanvas(p, idx);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No blob'))), 'image/png');
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return true;
    } catch {
      return false;
    }
  };

  const buildCertificateWaMessage = (p: Participant) => {
    const organizer =
      (settings.organizerHeader && settings.organizerHeader.trim()) ||
      config.organizer ||
      'Muslimah Healing Journey';
    const formattedDate = formatSafeDateStr(config.date, 'dd MMMM yyyy');
    return [
      `Assalamu'alaikum / Halo *${p.name}*,`,
      ``,
      `Terima kasih atas kehadiran dan partisipasi hangat Anda dalam kegiatan:`,
      `*${config.name}*`,
      `Penyelenggara: *Heal You · ${organizer}* (${formattedDate})`,
      ``,
      `Bersama pesan ini kami lampirkan *E-Sertifikat Penghargaan* resmi Anda (ID Presensi: *${p.id}*).`,
      `Semoga ilmu dan ketenangan dari sesi kita membawa keberkahan serta pemulihan batin yang berkelanjutan.`,
      ``,
      `Salam hangat,`,
      `*Tim Heal You · ${organizer}*`,
    ].join('\n');
  };

  const handleSendCertificateWa = (p: Participant, idx: number) => {
    void handleCopyCertificateToClipboard(p, idx).then((copied) => {
      if (copied) {
        showNotice(
          `Gambar E-Sertifikat "${p.name}" telah disalin ke Clipboard! Tekan Ctrl+V (Paste) di ruang chat WhatsApp.`
        );
      } else {
        showNotice(`Membuka WhatsApp untuk pengiriman E-Sertifikat "${p.name}".`);
      }
    });
  };

  const handleShareCertificateMobile = async (p: Participant, idx: number) => {
    try {
      if (typeof navigator === 'undefined' || !navigator.share) return;
      const canvas = await renderCertificateCanvas(p, idx);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No blob'))), 'image/png');
      });
      const file = new File(
        [blob],
        `ESertifikat_HealYou_${p.id}_${p.name.replace(/[^a-z0-9]/gi, '_')}.png`,
        { type: 'image/png' }
      );
      const shareData: ShareData = {
        title: `E-Sertifikat ${p.name} - ${config.name}`,
        text: buildCertificateWaMessage(p),
        files: [file],
      };
      if (navigator.canShare && !navigator.canShare(shareData)) return;
      await navigator.share(shareData);
    } catch {
      // Ignore
    }
  };

  const handleBatchPrintAllPdf = async () => {
    const printTargets = targetList.length > 0 ? targetList : [activeParticipant];
    setIsBusy(true);
    showNotice(`Menyiapkan ${printTargets.length} halaman E-Sertifikat A4 Landscape...`);

    try {
      const dataUrls: string[] = [];
      for (let i = 0; i < printTargets.length; i++) {
        const canvas = await renderCertificateCanvas(printTargets[i], i);
        dataUrls.push(canvas.toDataURL('image/png'));
      }

      const existingFrame = document.getElementById('healyou-cert-print-frame');
      if (existingFrame) existingFrame.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'healyou-cert-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        setIsBusy(false);
        return;
      }

      const pagesHtml = dataUrls
        .map(
          (url) => `
          <div class="cert-page">
            <img src="${url}" alt="E-Sertifikat Heal You" />
          </div>
        `
        )
        .join('');

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>E-Sertifikat Heal You - ${config.name}</title>
            <style>
              @page {
                size: A4 landscape;
                margin: 0;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              html, body {
                width: 297mm;
                background: #ffffff;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .cert-page {
                width: 297mm;
                height: 210mm;
                page-break-after: always;
                break-after: page;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
              }
              .cert-page:last-child {
                page-break-after: auto;
                break-after: auto;
              }
              .cert-page img {
                width: 100%;
                height: 100%;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
            ${pagesHtml}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.focus();
                  window.print();
                }, 350);
              };
            </script>
          </body>
        </html>
      `);
      doc.close();
      showNotice(
        `Dialog Cetak / Simpan PDF (${printTargets.length} E-Sertifikat A4 Landscape) siap!`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleBatchDownloadAllPng = async () => {
    const downloadTargets = targetList.length > 0 ? targetList : [activeParticipant];
    setIsBusy(true);
    try {
      for (let i = 0; i < downloadTargets.length; i++) {
        const p = downloadTargets[i];
        const canvas = await renderCertificateCanvas(p, i);
        const link = document.createElement('a');
        link.download = `ESertifikat_HealYou_${p.id}_${p.name.replace(/[^a-z0-9]/gi, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        await new Promise((r) => setTimeout(r, 220));
      }
      showNotice(`Berhasil mengunduh ${downloadTargets.length} file PNG E-Sertifikat!`);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      {/* Fullscreen Zoom Modal for Certificate Preview */}
      {isZoomedPreview && previewDataUrl && (
        <div
          onClick={() => setIsZoomedPreview(false)}
          className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="max-w-5xl w-full flex items-center justify-between text-white mb-3">
            <span className="text-sm font-bold">
              Pratinjau Penuh E-Sertifikat · {activeParticipant.name}
            </span>
            <button
              type="button"
              onClick={() => setIsZoomedPreview(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-semibold cursor-pointer"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Tutup Layar Penuh</span>
            </button>
          </div>
          <img
            src={previewDataUrl}
            alt={`E-Sertifikat ${activeParticipant.name}`}
            className="max-w-5xl w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20"
          />
        </div>
      )}

      <div className="bg-white rounded-3xl border border-purple-100 shadow-2xl max-w-6xl w-full max-h-[95vh] flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="shrink-0 px-4 sm:px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-purple-50/70 via-white to-amber-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5e438f] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Studio &amp; Pratinjau E-Sertifikat · Heal You
              </h2>
              <p className="text-xs text-slate-600">
                Pratinjau langsung A4 Landscape · Nama &amp; tanda tangan Penyelenggara dan Narasumber dapat diedit
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label
              title="Unggah gambar referensi sertifikat (otomatis menghapus teks lama & menggantinya dengan data peserta, QR, dan tanda tangan dinamis)"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-purple-50 text-[#4c3575] border border-purple-200 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#5e438f]" />
              <span>
                {settings.customTemplateDataUrl
                  ? 'Ganti Gambar Referensi'
                  : 'Pakai Gambar Referensi'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === 'string') {
                      setSettings((prev) => ({
                        ...prev,
                        customTemplateDataUrl: reader.result as string,
                      }));
                      showNotice(
                        'Gambar referensi sertifikat diterapkan dengan tata letak presisi!'
                      );
                    }
                  };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
                className="sr-only"
              />
            </label>

            {settings.customTemplateDataUrl && (
              <button
                type="button"
                onClick={() => {
                  setSettings((prev) => ({ ...prev, customTemplateDataUrl: undefined }));
                  showNotice('Kembali menggunakan latar botanical bawaan.');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Latar</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                signerEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors cursor-pointer"
            >
              <PenTool className="w-3.5 h-3.5 text-amber-700" />
              <span>Edit TTD &amp; Nama</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAdvancedTextSettings(!showAdvancedTextSettings)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer',
                showAdvancedTextSettings
                  ? 'bg-[#5e438f] text-white border-[#5e438f]'
                  : 'bg-white text-[#4c3575] border-purple-200 hover:bg-purple-50'
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showAdvancedTextSettings ? 'Tutup Judul & Nomor' : 'Edit Judul & Nomor'}</span>
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleBatchDownloadAllPng()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#4c3575] bg-purple-50 hover:bg-purple-100 border border-purple-200/80 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Semua PNG ({targetList.length || 1})</span>
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleBatchPrintAllPdf()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-[#5e438f] hover:bg-[#4c3575] disabled:opacity-50 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF Sekaligus ({targetList.length || 1})</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast Notification Banner */}
        {toastMsg && (
          <div className="shrink-0 px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between gap-3 text-xs font-medium text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toastMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              className="text-emerald-700 hover:underline font-semibold cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Optional Header / Certificate Number / Intro Text Settings */}
        {showAdvancedTextSettings && (
          <div className="shrink-0 px-5 py-3.5 bg-purple-50/50 border-b border-purple-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#4c3575]">
                Pengaturan Judul, Nomor, Kota &amp; Kalimat Sertifikat
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSettings(DEFAULT_CERT_SETTINGS);
                  showNotice('Pengaturan sertifikat dikembalikan ke bawaan awal.');
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-rose-600 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Semua ke Bawaan
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nama Instansi Header
                </label>
                <input
                  type="text"
                  placeholder={config.organizer || 'Muslimah Healing Journey'}
                  value={settings.organizerHeader || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, organizerHeader: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Judul Sertifikat
                </label>
                <input
                  type="text"
                  value={settings.certTitle}
                  onChange={(e) => setSettings({ ...settings, certTitle: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Akhiran Nomor Sertifikat
                </label>
                <input
                  type="text"
                  value={settings.numberSuffix}
                  onChange={(e) => setSettings({ ...settings, numberSuffix: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Kota Penerbitan
                </label>
                <input
                  type="text"
                  value={settings.city}
                  onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Kalimat Pengantar Apresiasi
                </label>
                <input
                  type="text"
                  value={settings.bodyIntro}
                  onChange={(e) => setSettings({ ...settings, bodyIntro: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* Main Body: Scrollable on mobile/tablet, Split-pane on desktop */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto lg:overflow-hidden">
          {/* Right/Main Column First on Mobile so Certificate Preview is IMMEDIATELY visible at the top */}
          <div className="order-1 lg:order-2 lg:col-span-8 p-4 sm:p-5 bg-[#f8f6fc] lg:overflow-y-auto space-y-4">
            {/* Navigation & Quick Status Header */}
            <div className="w-full max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 text-[#4c3575] text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  PRATINJAU E-SERTIFIKAT
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  #{activeIndex + 1} dari {Math.max(targetList.length, 1)}:{' '}
                  <strong className="text-slate-900">{activeParticipant.name}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsZoomedPreview(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-xs font-semibold text-[#4c3575] cursor-pointer"
                  title="Perbesar pratinjau sertifikat ke layar penuh"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Perbesar</span>
                </button>
                <button
                  type="button"
                  disabled={activeIndex <= 0}
                  onClick={() => {
                    const prev = targetList[activeIndex - 1];
                    if (prev) setSelectedParticipantId(prev.id);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={activeIndex >= targetList.length - 1}
                  onClick={() => {
                    const next = targetList[activeIndex + 1];
                    if (next) setSelectedParticipantId(next.id);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  Berikutnya
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Certificate Image Container — Guaranteed Aspect Ratio & Never Shrinks */}
            <div
              onClick={() => setIsZoomedPreview(true)}
              title="Klik untuk memperbesar pratinjau E-Sertifikat"
              className="shrink-0 w-full max-w-3xl mx-auto aspect-[1400/990] rounded-2xl overflow-hidden shadow-xl border-2 border-purple-200/90 bg-white relative cursor-zoom-in"
            >
              {previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt={`E-Sertifikat ${activeParticipant.name}`}
                  className="w-full h-full object-contain block"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">
                  Menyiapkan pratinjau E-Sertifikat...
                </div>
              )}
            </div>

            {/* Action Bar for Currently Selected Certificate */}
            <div className="shrink-0 w-full max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleDownloadSinglePng(activeParticipant, activeIndex)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
                  style={{
                    background:
                      'linear-gradient(115deg, #68428B 0%, #5B3E96 50%, #4E54B5 100%)',
                  }}
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Sertifikat Ini (PNG)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void handleCopyCertificateToClipboard(activeParticipant, activeIndex).then(
                      (ok) => {
                        if (ok) {
                          showNotice(
                            `Gambar E-Sertifikat "${activeParticipant.name}" disalin ke Clipboard! Tinggal tekan Ctrl+V di WhatsApp.`
                          );
                        }
                      }
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#4c3575] bg-white hover:bg-purple-50 border border-purple-200 transition-colors cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-[#5e438f]" />
                  <span>Salin Gambar (Ctrl+V)</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleShareCertificateMobile(activeParticipant, activeIndex)
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#4c3575] bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share File PNG</span>
                  </button>
                )}

                <a
                  href={
                    normalizeWhatsAppPhone(activeParticipant.phone)
                      ? `https://wa.me/${normalizeWhatsAppPhone(activeParticipant.phone)}?text=${encodeURIComponent(buildCertificateWaMessage(activeParticipant))}`
                      : `https://wa.me/?text=${encodeURIComponent(buildCertificateWaMessage(activeParticipant))}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleSendCertificateWa(activeParticipant, activeIndex)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Kirim WA + Salin Sertifikat</span>
                </a>
              </div>
            </div>

            {/* ALWAYS-VISIBLE EDITOR FOR PENYELENGGARA & NARASUMBER NAME + SIGNATURE */}
            <div
              ref={signerEditorRef}
              className="shrink-0 w-full max-w-3xl mx-auto bg-white rounded-2xl border border-purple-200/80 shadow-xs p-4 space-y-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-[#5e438f]" />
                  <h3 className="text-xs sm:text-sm font-bold text-[#2b1b47]">
                    Edit Nama &amp; Tanda Tangan Penyelenggara dan Narasumber
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500">
                  Hasil edit langsung tampil pada Pratinjau E-Sertifikat di atas
                </span>
              </div>

              {/* Interactive Signature Drawing Pad Drawer (When Active) */}
              {drawingSigner !== null && (
                <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[#2b1b47]">
                        Goreskan Tanda Tangan{' '}
                        {drawingSigner === 1 ? 'Penyelenggara (Kiri)' : 'Narasumber (Kanan)'}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Gunakan mouse, touchpad, atau jari di layar sentuh untuk menulis tanda tangan:
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-slate-600 mr-1">
                        Warna Tinta:
                      </span>
                      {[
                        { color: '#2b194d', label: 'Ungu Tua' },
                        { color: '#0f172a', label: 'Hitam' },
                        { color: '#1e3a8a', label: 'Biru Tinta' },
                      ].map((ink) => (
                        <button
                          key={ink.color}
                          type="button"
                          onClick={() => setInkColor(ink.color)}
                          title={ink.label}
                          className={cn(
                            'w-5 h-5 rounded-full border-2 transition-transform cursor-pointer',
                            inkColor === ink.color
                              ? 'scale-110 border-amber-500 shadow-xs'
                              : 'border-white'
                          )}
                          style={{ backgroundColor: ink.color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border-2 border-dashed border-purple-300 overflow-hidden">
                    <canvas
                      ref={sigCanvasRef}
                      width={520}
                      height={180}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      className="w-full h-36 touch-none cursor-crosshair block"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={clearSignaturePad}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      <span>Bersihkan Kanvas</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDrawingSigner(null)}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={saveDrawnSignature}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#5e438f] hover:bg-[#4c3575] text-white text-xs font-semibold shadow-xs cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Simpan Tanda Tangan</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* PENYELENGGARA (SIGNER 1 - LEFT) */}
                <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#4c3575] uppercase tracking-wider">
                      1. Penyelenggara (Kiri)
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">
                      Posisi Kiri Bawah
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Nama Lengkap &amp; Gelar Penyelenggara
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Hj. Siti Sarah, M.Psi., Psikolog"
                        value={settings.signer1Name}
                        onChange={(e) => {
                          const newName = e.target.value;
                          setSettings((prev) => ({
                            ...prev,
                            signer1Name: newName,
                            signer1SignatureText:
                              prev.signer1SignatureText ===
                              getShortSignatureName(prev.signer1Name)
                                ? getShortSignatureName(newName)
                                : prev.signer1SignatureText,
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#5e438f]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Jabatan / Peran Penyelenggara
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Ketua Penyelenggara · Muslimah Healing Journey"
                        value={settings.signer1Title}
                        onChange={(e) =>
                          setSettings({ ...settings, signer1Title: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#5e438f]"
                      />
                    </div>

                    {/* Signature Mode & Controls for Penyelenggara */}
                    <div className="pt-1 space-y-2">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Tanda Tangan Penyelenggara:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setSettings({ ...settings, signer1SigMode: 'TEXT' })
                          }
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer',
                            settings.signer1SigMode === 'TEXT'
                              ? 'bg-[#5e438f] text-white border-[#5e438f]'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50'
                          )}
                        >
                          <Type className="w-3 h-3" />
                          <span>Kaligrafi Teks</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDrawingSigner(1)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer',
                            drawingSigner === 1 ||
                              (settings.signer1SigMode === 'IMAGE' &&
                                settings.signer1SignatureDataUrl)
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                          )}
                        >
                          <PenTool className="w-3 h-3" />
                          <span>Tulis / Gambar TTD</span>
                        </button>

                        <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-purple-50 text-[#5e438f] border border-purple-200 text-[11px] font-semibold cursor-pointer">
                          <Upload className="w-3 h-3" />
                          <span>Upload PNG</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSignatureUpload(1, e)}
                            className="sr-only"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() =>
                            setSettings({ ...settings, signer1SigMode: 'NONE' })
                          }
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer',
                            settings.signer1SigMode === 'NONE'
                              ? 'bg-slate-700 text-white border-slate-700'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          )}
                          title="Kosongkan area tanda tangan untuk tanda tangan basah manual"
                        >
                          <Ban className="w-3 h-3" />
                          <span>Kosong</span>
                        </button>
                      </div>

                      {settings.signer1SigMode === 'TEXT' && (
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                            Teks Goresan Tanda Tangan Kaligrafi:
                          </label>
                          <input
                            type="text"
                            placeholder="Ketik teks tanda tangan..."
                            value={settings.signer1SignatureText}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                signer1SignatureText: e.target.value,
                              })
                            }
                            className="w-full px-2.5 py-1 bg-white border border-purple-200 rounded-lg text-xs italic font-serif text-[#3b2763]"
                          />
                        </div>
                      )}

                      {settings.signer1SigMode === 'IMAGE' &&
                        settings.signer1SignatureDataUrl && (
                          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-white rounded-lg border border-purple-200">
                            <div className="flex items-center gap-2">
                              <img
                                src={settings.signer1SignatureDataUrl}
                                alt="TTD Penyelenggara"
                                className="h-8 w-auto object-contain"
                              />
                              <span className="text-[11px] text-emerald-700 font-medium">
                                TTD Gambar Aktif
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setSettings({
                                  ...settings,
                                  signer1SignatureDataUrl: undefined,
                                  signer1SigMode: 'TEXT',
                                })
                              }
                              className="text-[11px] text-rose-600 hover:underline font-medium cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                {/* NARASUMBER (SIGNER 2 - RIGHT) */}
                <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.enableSigner2}
                        onChange={(e) =>
                          setSettings({ ...settings, enableSigner2: e.target.checked })
                        }
                        className="rounded text-[#5e438f]"
                      />
                      <span className="text-xs font-bold text-[#4c3575] uppercase tracking-wider">
                        2. Narasumber (Kanan)
                      </span>
                    </label>
                    <span className="text-[10px] font-medium text-slate-500">
                      {settings.enableSigner2 ? 'Posisi Kanan Bawah' : 'Nonaktif'}
                    </span>
                  </div>

                  {settings.enableSigner2 ? (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                          Nama Lengkap &amp; Gelar Narasumber
                        </label>
                        <input
                          type="text"
                          placeholder="Contoh: Dr. Aisyah Putri, M.Psi., Psikolog"
                          value={settings.signer2Name}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setSettings((prev) => ({
                              ...prev,
                              signer2Name: newName,
                              signer2SignatureText:
                                prev.signer2SignatureText ===
                                getShortSignatureName(prev.signer2Name)
                                  ? getShortSignatureName(newName)
                                  : prev.signer2SignatureText,
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#5e438f]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                          Jabatan / Peran Narasumber
                        </label>
                        <input
                          type="text"
                          placeholder="Contoh: Narasumber & Psikolog Utama"
                          value={settings.signer2Title}
                          onChange={(e) =>
                            setSettings({ ...settings, signer2Title: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#5e438f]"
                        />
                      </div>

                      {/* Signature Mode & Controls for Narasumber */}
                      <div className="pt-1 space-y-2">
                        <label className="block text-[11px] font-semibold text-slate-700">
                          Tanda Tangan Narasumber:
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setSettings({ ...settings, signer2SigMode: 'TEXT' })
                            }
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer',
                              settings.signer2SigMode === 'TEXT'
                                ? 'bg-[#5e438f] text-white border-[#5e438f]'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50'
                            )}
                          >
                            <Type className="w-3 h-3" />
                            <span>Kaligrafi Teks</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDrawingSigner(2)}
                            className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer',
                              drawingSigner === 2 ||
                                (settings.signer2SigMode === 'IMAGE' &&
                                  settings.signer2SignatureDataUrl)
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                            )}
                          >
                            <PenTool className="w-3 h-3" />
                            <span>Tulis / Gambar TTD</span>
                          </button>

                          <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-purple-50 text-[#5e438f] border border-purple-200 text-[11px] font-semibold cursor-pointer">
                            <Upload className="w-3 h-3" />
                            <span>Upload PNG</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleSignatureUpload(2, e)}
                              className="sr-only"
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() =>
                              setSettings({ ...settings, signer2SigMode: 'NONE' })
                            }
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer',
                              settings.signer2SigMode === 'NONE'
                                ? 'bg-slate-700 text-white border-slate-700'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            )}
                            title="Kosongkan area tanda tangan untuk tanda tangan basah manual"
                          >
                            <Ban className="w-3 h-3" />
                            <span>Kosong</span>
                          </button>
                        </div>

                        {settings.signer2SigMode === 'TEXT' && (
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                              Teks Goresan Tanda Tangan Kaligrafi:
                            </label>
                            <input
                              type="text"
                              placeholder="Ketik teks tanda tangan..."
                              value={settings.signer2SignatureText}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  signer2SignatureText: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1 bg-white border border-purple-200 rounded-lg text-xs italic font-serif text-[#3b2763]"
                            />
                          </div>
                        )}

                        {settings.signer2SigMode === 'IMAGE' &&
                          settings.signer2SignatureDataUrl && (
                            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-white rounded-lg border border-purple-200">
                              <div className="flex items-center gap-2">
                                <img
                                  src={settings.signer2SignatureDataUrl}
                                  alt="TTD Narasumber"
                                  className="h-8 w-auto object-contain"
                                />
                                <span className="text-[11px] text-emerald-700 font-medium">
                                  TTD Gambar Aktif
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setSettings({
                                    ...settings,
                                    signer2SignatureDataUrl: undefined,
                                    signer2SigMode: 'TEXT',
                                  })
                                }
                                className="text-[11px] text-rose-600 hover:underline font-medium cursor-pointer"
                              >
                                Hapus
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 py-6 text-center">
                      Centang kotak di atas jika ingin menampilkan nama &amp; tanda tangan
                      Narasumber pada E-Sertifikat.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Left Column: Recipient Filter & Queue */}
          <div className="order-2 lg:order-1 lg:col-span-4 border-t lg:border-t-0 lg:border-r border-slate-100 flex flex-col lg:min-h-0 bg-slate-50/50">
            <div className="p-4 border-b border-slate-100 space-y-2.5">
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('ATTENDED');
                    if (attendedParticipants[0]) {
                      setSelectedParticipantId(attendedParticipants[0].id);
                    }
                  }}
                  className={cn(
                    'py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                    filterMode === 'ATTENDED'
                      ? 'bg-white text-[#4c3575] shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  Sudah Hadir ({attendedParticipants.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('ALL');
                    if (participants[0]) {
                      setSelectedParticipantId(participants[0].id);
                    }
                  }}
                  className={cn(
                    'py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                    filterMode === 'ALL'
                      ? 'bg-white text-[#4c3575] shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  Semua Peserta ({participants.length})
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                Pilih peserta untuk pratinjau, unduh satuan, atau kirim E-Sertifikat via WhatsApp:
              </p>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-64 lg:max-h-none">
              {targetList.length > 0 ? (
                targetList.map((p, idx) => {
                  const isSelected = activeParticipant.id === p.id;
                  const cleanPhone = normalizeWhatsAppPhone(p.phone);
                  const waHref = cleanPhone
                    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(buildCertificateWaMessage(p))}`
                    : `https://wa.me/?text=${encodeURIComponent(buildCertificateWaMessage(p))}`;

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedParticipantId(p.id)}
                      className={cn(
                        'px-4 py-3 flex items-center justify-between gap-2 cursor-pointer transition-colors',
                        isSelected ? 'bg-purple-100/70' : 'hover:bg-white'
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono font-bold text-[#5e438f]">
                            #{String(idx + 1).padStart(2, '0')}
                          </span>
                          <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                            {p.name}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          <span className="font-mono">{p.id}</span> · {p.institution}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendCertificateWa(p, idx);
                          }}
                          title="Kirim E-Sertifikat via WhatsApp & otomatis salin gambar sertifikat ke Clipboard (Ctrl+V)"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>WA</span>
                        </a>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDownloadSinglePng(p, idx);
                          }}
                          title="Unduh E-Sertifikat PNG peserta ini"
                          className="p-1.5 rounded-lg bg-white hover:bg-purple-50 text-[#5e438f] border border-purple-200/80 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-slate-500 space-y-2">
                  <Users className="w-7 h-7 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">
                    Belum ada peserta yang melakukan Check-in
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Pratinjau di samping menampilkan contoh sertifikat. Klik tombol di bawah untuk
                    menampilkan seluruh peserta terdaftar:
                  </p>
                  {participants.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterMode('ALL');
                        setSelectedParticipantId(participants[0].id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5e438f] text-white text-xs font-semibold cursor-pointer"
                    >
                      <span>Tampilkan Semua Peserta ({participants.length})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
