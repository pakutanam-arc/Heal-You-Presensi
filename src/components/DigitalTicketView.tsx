import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Participant, WorkshopConfig } from '../types';
import { HealYouLogo } from './HealYouLogo';
import { buildSignedParticipantQrValue } from '../lib/qrSecurity';
import { useAppContext } from '../store';
import {
  formatSafeDateStr,
  formatSafeTimeStr,
  renderParticipantCardCanvas,
  copyParticipantCardToClipboard,
  shareParticipantCardFile,
} from '../lib/whatsapp';
import {
  Download,
  Share2,
  Copy,
  Check,
  Sparkles,
  Calendar,
  MapPin,
  Clock,
  ArrowLeft,
} from 'lucide-react';

interface DigitalTicketViewProps {
  participant: Participant;
  config: WorkshopConfig;
  onExitTicketMode: () => void;
}

export const DigitalTicketView: React.FC<DigitalTicketViewProps> = ({
  participant,
  config,
  onExitTicketMode,
}) => {
  const { activeWorkshopId } = useAppContext();
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedCard, setCopiedCard] = useState(false);

  const displayOrganizer = config.organizer || 'Muslimah Healing Journey';
  const displayTagline = config.tagline || "Let's Heal";
  const displayEventLabel = config.eventLabel || 'Agenda Workshop Psikologi';
  const displayTime = formatSafeTimeStr(config.startTime);

  const getQrCanvas = (): HTMLCanvasElement | null => {
    return (
      qrContainerRef.current?.querySelector('canvas') ||
      (document.getElementById(`global-qr-${participant.id}`) as HTMLCanvasElement | null)
    );
  };

  const handleDownloadPng = async () => {
    setIsDownloading(true);
    try {
      const cardCanvas = await renderParticipantCardCanvas(participant, config, getQrCanvas());
      const dataUrl = cardCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `IDCard_HealYou_${participant.id}_${participant.name.replace(/[^a-z0-9]/gi, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyCardImage = async () => {
    const ok = await copyParticipantCardToClipboard(participant, config, getQrCanvas());
    if (ok) {
      setCopiedCard(true);
      window.setTimeout(() => setCopiedCard(false), 3000);
    }
  };

  const handleShareCard = async () => {
    const shared = await shareParticipantCardFile(participant, config, getQrCanvas());
    if (!shared) {
      await handleDownloadPng();
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between py-6 px-4 sm:px-6"
      style={{
        background:
          'radial-gradient(circle at 20% 15%, #f5ecff 0%, #faf8ff 50%, #eef3fc 100%)',
      }}
    >
      {/* Top Bar */}
      <div className="max-w-lg w-full mx-auto flex items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-2.5">
          <HealYouLogo
            customLogoUrl={config.customLogoUrl}
            size={36}
            className="rounded-xl shadow-2xs"
          />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5e438f]">
              E-Tiket &amp; Kartu Presensi Resmi
            </p>
            <h1
              className="text-lg font-bold text-[#23153c] leading-tight"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Heal You · {displayOrganizer}
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={onExitTicketMode}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#4c3575] bg-white/85 hover:bg-white border border-purple-100 shadow-2xs transition-colors cursor-pointer"
          title="Buka Dashboard Aplikasi"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>
      </div>

      {/* Center Couture ID Card */}
      <div className="max-w-md w-full mx-auto my-auto flex flex-col items-center">
        <div
          className="w-full rounded-[36px] p-4 sm:p-6 shadow-xl relative overflow-hidden border border-white"
          style={{
            background:
              'linear-gradient(160deg, #f2cbfc 0%, #d5c4fc 30%, #b8d0ff 62%, #ede8ff 100%)',
          }}
        >
          {/* Inner Couture Frame Line */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-3 rounded-[28px] border border-white/60"
          />

          {/* Soft Radial Top Aura */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-52 rounded-full bg-white/45 blur-2xl"
          />

          {/* Lanyard Slot Cutout */}
          <div className="relative w-14 h-2 mx-auto mb-5 rounded-full bg-white/80 border border-white shadow-inner" />

          {/* Header */}
          <div className="relative flex flex-col items-center text-center mb-5">
            <div className="p-1 bg-white/85 rounded-tl-[22px] rounded-br-[22px] rounded-tr-sm rounded-bl-sm shadow-xs">
              <HealYouLogo
                customLogoUrl={config.customLogoUrl}
                size={68}
                className="rounded-tl-[19px] rounded-br-[19px] rounded-tr-xs rounded-bl-xs"
              />
            </div>

            <p className="mt-3 text-[11px] font-semibold tracking-[0.26em] uppercase text-[#3d2863]">
              {displayOrganizer}
            </p>

            <p
              className="mt-0.5 text-base italic font-semibold text-[#5e438f]"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              — {displayTagline} —
            </p>
          </div>

          {/* Porcelain Sanctuary Sheet */}
          <div className="relative bg-white/92 backdrop-blur-md rounded-[26px] p-2 sm:p-2.5 border border-white shadow-sm">
            <div className="rounded-[20px] border border-[#b49ae6]/30 px-4 sm:px-5 py-5 sm:py-6 text-center flex flex-col items-center">
              <span className="block text-[10px] font-semibold tracking-[0.22em] uppercase text-[#7c5bb0] break-words">
                {participant.role || 'Peserta Workshop'}
              </span>

              <h2
                className="mt-1.5 text-2xl sm:text-[31px] font-bold text-[#1f1235] leading-tight break-words"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                {participant.name}
              </h2>

              <p className="mt-1 text-xs sm:text-[13px] font-medium text-[#4a3b69] break-words">
                {participant.institution}
              </p>

              {/* Ornamental Diamond Filigree Divider */}
              <div className="w-full max-w-[240px] my-3.5 flex items-center gap-2.5">
                <div
                  className="flex-1 h-px"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(167,139,250,0.5) 100%)',
                  }}
                />
                <span className="w-1.5 h-1.5 rotate-45 bg-[#b197fc] shrink-0" />
                <div
                  className="flex-1 h-px"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(167,139,250,0.5) 0%, transparent 100%)',
                  }}
                />
              </div>

              <p
                className="text-sm italic font-semibold text-[#8b6fc9]"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                {displayEventLabel}
              </p>
              <h3
                className="mt-0.5 text-lg sm:text-[21px] font-bold text-[#261742] leading-snug max-w-xs break-words"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                {config.name}
              </h3>
              <p className="mt-1.5 text-xs font-medium text-[#52436e]">
                {formatSafeDateStr(config.date, 'dd MMMM yyyy')} &nbsp;·&nbsp; Pukul {displayTime}{' '}
                WIB
              </p>
              <p className="mt-1 text-[11px] font-medium tracking-[0.12em] uppercase text-[#7c6f99] break-words">
                {config.location}
              </p>

              {/* Framed QR Code Medallion */}
              <div className="mt-4 relative p-3 bg-white rounded-2xl border border-[#dcd0ff] shadow-2xs flex items-center justify-center">
                <div ref={qrContainerRef} className="relative flex items-center justify-center">
                  <QRCodeCanvas
                    value={buildSignedParticipantQrValue(participant.id, activeWorkshopId)}
                    size={320}
                    level="H"
                    minVersion={4}
                    marginSize={2}
                    fgColor="#261742"
                    bgColor="#ffffff"
                    style={{ width: 168, height: 168 }}
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="p-0.5 bg-white rounded-tl-[10px] rounded-br-[10px] rounded-tr-xs rounded-bl-xs shadow-2xs">
                      <HealYouLogo
                        customLogoUrl={config.customLogoUrl}
                        size={30}
                        className="rounded-tl-[8px] rounded-br-[8px] rounded-tr-[2px] rounded-bl-[2px]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-4 font-mono text-[11px] font-semibold tracking-[0.2em] uppercase text-[#4c3575]">
                No. Presensi &nbsp;·&nbsp; {participant.id}
              </p>

              <p className="mt-1 text-[11px] text-[#8b7fa8]">
                Tunjukkan kartu ini pada meja registrasi atau kamera Layar TV untuk check-in
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons for Participant */}
        <div className="mt-5 w-full flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            disabled={isDownloading}
            onClick={() => void handleDownloadPng()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-white text-sm font-semibold rounded-2xl shadow-md hover:opacity-95 transition-opacity cursor-pointer"
            style={{
              background: 'linear-gradient(115deg, #68428B 0%, #5B3E96 50%, #4E54B5 100%)',
            }}
          >
            <Download className="w-4 h-4" />
            <span>{isDownloading ? 'Menyiapkan Kartu...' : 'Simpan Kartu QR (PNG)'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleCopyCardImage()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-3 text-xs sm:text-sm font-semibold text-[#4c3575] bg-white hover:bg-purple-50 border border-purple-200 rounded-2xl shadow-2xs transition-colors cursor-pointer"
          >
            {copiedCard ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Gambar Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#5e438f]" />
                <span>Salin Gambar</span>
              </>
            )}
          </button>

          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={() => void handleShareCard()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl shadow-2xs transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-emerald-600" />
              <span>Bagikan</span>
            </button>
          )}
        </div>

        {/* Helpful Venue Summary */}
        <div className="mt-4 w-full bg-white/80 backdrop-blur-xs rounded-2xl p-4 border border-purple-100 text-xs text-slate-600 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-[#5e438f]" />
            {formatSafeDateStr(config.date)}
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-[#5e438f]" />
            Pukul {displayTime} WIB
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <MapPin className="w-3.5 h-3.5 text-[#5e438f]" />
            {config.location}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-lg w-full mx-auto pt-6 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-[#5e438f]" />
        <span>Heal You · {displayOrganizer} · Ruang Aman Pemulihan Batin</span>
      </div>
    </div>
  );
};
