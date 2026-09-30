import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Participant, WorkshopConfig } from '../types';
import { HealYouLogo, HEAL_YOU_DATA_URI, loadLogoImage } from './HealYouLogo';
import { Download, Printer, X, Layers, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

function formatSafeDate(dateStr: string, pattern: string) {
  try {
    const parsed = dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T00:00:00`);
    if (isNaN(parsed.getTime())) return dateStr;
    return format(parsed, pattern);
  } catch {
    return dateStr;
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawLeafRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rLarge: number,
  rSmall: number
) {
  ctx.beginPath();
  ctx.moveTo(x + rLarge, y);
  ctx.lineTo(x + w - rSmall, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rSmall);
  ctx.lineTo(x + w, y + h - rLarge);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rLarge, y + h);
  ctx.lineTo(x + rSmall, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rSmall);
  ctx.lineTo(x, y + rLarge);
  ctx.quadraticCurveTo(x, y, x + rLarge, y);
  ctx.closePath();
}

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length === 0 || !words[0]) return [''];
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = `${currentLine} ${words[i]}`;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

interface BatchPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  config: WorkshopConfig;
}

export const BatchPrintModal: React.FC<BatchPrintModalProps> = ({
  isOpen,
  onClose,
  participants,
  config,
}) => {
  const qrRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [isGeneratingSheets, setIsGeneratingSheets] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  if (!isOpen) return null;

  const organizer = config.organizer || 'Muslimah Healing Journey';
  const tagline = config.tagline || "Let's Heal";
  const eventLabel = config.eventLabel || 'Agenda Workshop Psikologi';
  let eventTime = '08:00';
  try {
    eventTime = format(new Date(config.startTime), 'HH:mm');
  } catch {
    eventTime = '08:00';
  }

  // Group into pages of 4 cards (2x2 grid per A4 sheet)
  const pages: Participant[][] = [];
  for (let i = 0; i < participants.length; i += 4) {
    pages.push(participants.slice(i, i + 4));
  }

  const drawSingleCardToCanvas = async (
    p: Participant,
    qrCanvas: HTMLCanvasElement,
    logoImg: HTMLImageElement | null
  ): Promise<HTMLCanvasElement> => {
    const scale = 2;
    const baseW = 448;
    const baseH = 688;

    const c = document.createElement('canvas');
    c.width = baseW * scale;
    c.height = baseH * scale;
    const ctx = c.getContext('2d')!;
    ctx.scale(scale, scale);

    ctx.save();
    drawRoundedRect(ctx, 0, 0, baseW, baseH, 36);
    ctx.clip();

    const bgGrad = ctx.createLinearGradient(0, 0, baseW * 0.65, baseH);
    bgGrad.addColorStop(0, '#f2cbfc');
    bgGrad.addColorStop(0.3, '#d5c4fc');
    bgGrad.addColorStop(0.62, '#b8d0ff');
    bgGrad.addColorStop(1, '#ede8ff');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, baseW, baseH);

    drawRoundedRect(ctx, 12, 12, baseW - 24, baseH - 24, 28);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1;
    ctx.stroke();

    drawRoundedRect(ctx, (baseW - 56) / 2, 22, 56, 8, 4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fill();

    // Header Logo
    const logoPadSize = 72;
    const logoSize = 64;
    const logoPadX = (baseW - logoPadSize) / 2;
    const logoPadY = 46;

    if (logoImg) {
      drawLeafRect(ctx, logoPadX, logoPadY, logoPadSize, logoPadSize, 20, 4);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fill();

      ctx.save();
      drawLeafRect(ctx, logoPadX + 4, logoPadY + 4, logoSize, logoSize, 17, 3);
      ctx.clip();
      ctx.drawImage(logoImg, logoPadX + 4, logoPadY + 4, logoSize, logoSize);
      ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#3d2863';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '2.6px';
    ctx.fillText(organizer.toUpperCase(), baseW / 2, 138);
    ctx.letterSpacing = '0px';

    ctx.fillStyle = '#5e438f';
    ctx.font = 'italic 600 15px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(`— ${tagline} —`, baseW / 2, 156);

    // Porcelain Sheet
    const sheetX = 24;
    const sheetY = 172;
    const sheetW = baseW - 48;
    const sheetH = baseH - sheetY - 22;

    drawRoundedRect(ctx, sheetX, sheetY, sheetW, sheetH, 26);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fill();

    drawRoundedRect(ctx, sheetX + 10, sheetY + 10, sheetW - 20, sheetH - 20, 20);
    ctx.strokeStyle = 'rgba(180, 154, 230, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    let cursorY = sheetY + 30;

    ctx.fillStyle = '#7c5bb0';
    ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '2.2px';
    ctx.fillText((p.role || 'Peserta Workshop').toUpperCase(), baseW / 2, cursorY + 10);
    ctx.letterSpacing = '0px';
    cursorY += 18;

    ctx.fillStyle = '#1f1235';
    ctx.font = '700 28px "Cormorant Garamond", Georgia, serif';
    const nameLines = wrapCanvasLines(ctx, p.name, 330).slice(0, 2);
    for (const line of nameLines) {
      ctx.fillText(line, baseW / 2, cursorY + 24);
      cursorY += 31;
    }

    cursorY += 3;
    ctx.fillStyle = '#4a3b69';
    ctx.font = '500 12.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(p.institution, baseW / 2, cursorY + 12);
    cursorY += 17;

    ctx.fillStyle = '#7c6f99';
    ctx.font = '400 11.5px "Plus Jakarta Sans", sans-serif';
    const contact = p.phone ? `${p.email} · ${p.phone}` : p.email;
    ctx.fillText(contact, baseW / 2, cursorY + 11);
    cursorY += 16;

    // Divider
    const divY = cursorY + 10;
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.4)';
    ctx.beginPath();
    ctx.moveTo(baseW / 2 - 110, divY);
    ctx.lineTo(baseW / 2 + 110, divY);
    ctx.stroke();
    cursorY += 22;

    // Event
    ctx.fillStyle = '#8b6fc9';
    ctx.font = 'italic 600 13.5px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(eventLabel, baseW / 2, cursorY + 12);
    cursorY += 16;

    ctx.fillStyle = '#261742';
    ctx.font = '700 19px "Cormorant Garamond", Georgia, serif';
    const eventLines = wrapCanvasLines(ctx, config.name, 320).slice(0, 2);
    for (const line of eventLines) {
      ctx.fillText(line, baseW / 2, cursorY + 17);
      cursorY += 22;
    }

    cursorY += 4;
    ctx.fillStyle = '#52436e';
    ctx.font = '500 11.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      `${formatSafeDate(config.date, 'dd MMMM yyyy')} · Pukul ${eventTime} WIB`,
      baseW / 2,
      cursorY + 11
    );
    cursorY += 15;

    ctx.fillStyle = '#7c6f99';
    ctx.font = '500 10.5px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '1.2px';
    ctx.fillText(config.location.toUpperCase(), baseW / 2, cursorY + 11);
    ctx.letterSpacing = '0px';
    cursorY += 14;

    // QR Medallion
    cursorY += 10;
    const qrBoxSize = 176;
    const qrBoxX = (baseW - qrBoxSize) / 2;
    const qrBoxY = cursorY;

    drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#dcd0ff';
    ctx.lineWidth = 1;
    ctx.stroke();

    const qrDrawSize = 154;
    ctx.drawImage(
      qrCanvas,
      qrBoxX + (qrBoxSize - qrDrawSize) / 2,
      qrBoxY + (qrBoxSize - qrDrawSize) / 2,
      qrDrawSize,
      qrDrawSize
    );

    if (logoImg) {
      const centerPadSize = 32;
      const centerLogoSize = 28;
      const cx = qrBoxX + qrBoxSize / 2;
      const cy = qrBoxY + qrBoxSize / 2;

      drawLeafRect(
        ctx,
        cx - centerPadSize / 2,
        cy - centerPadSize / 2,
        centerPadSize,
        centerPadSize,
        9,
        2
      );
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.save();
      drawLeafRect(
        ctx,
        cx - centerLogoSize / 2,
        cy - centerLogoSize / 2,
        centerLogoSize,
        centerLogoSize,
        7,
        2
      );
      ctx.clip();
      ctx.drawImage(
        logoImg,
        cx - centerLogoSize / 2,
        cy - centerLogoSize / 2,
        centerLogoSize,
        centerLogoSize
      );
      ctx.restore();
    }
    cursorY += qrBoxSize;

    cursorY += 14;
    ctx.fillStyle = '#4c3575';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText(`NO. PRESENSI  ·  ${p.id.toUpperCase()}`, baseW / 2, cursorY + 10);
    ctx.letterSpacing = '0px';

    ctx.restore();
    return c;
  };

  const handleDownloadAllSheets = async () => {
    setIsGeneratingSheets(true);
    setStatusNote(null);

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      let logoImg: HTMLImageElement | null = null;
      try {
        logoImg = await loadLogoImage(config.customLogoUrl);
      } catch {
        logoImg = null;
      }

      for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
        const pageParticipants = pages[pageIdx];
        // A4 Sheet Canvas (2x2 grid of 896x1376 cards + margins)
        const sheetCanvas = document.createElement('canvas');
        sheetCanvas.width = 1960;
        sheetCanvas.height = 2940;
        const sCtx = sheetCanvas.getContext('2d')!;

        sCtx.fillStyle = '#ffffff';
        sCtx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

        // Header label on sheet
        sCtx.fillStyle = '#4c3575';
        sCtx.font = '600 24px "Plus Jakarta Sans", sans-serif';
        sCtx.fillText(
          `LEMBAR CETAK KARTU TANDA PENGENAL HEAL YOU — ${config.name.toUpperCase()} (Halaman ${pageIdx + 1} / ${pages.length})`,
          64,
          56
        );

        const positions = [
          { x: 64, y: 88 },
          { x: 1000, y: 88 },
          { x: 64, y: 1504 },
          { x: 1000, y: 1504 },
        ];

        for (let i = 0; i < pageParticipants.length; i++) {
          const p = pageParticipants[i];
          const qrWrap = qrRefs.current[p.id];
          const qrCanvas = qrWrap?.querySelector('canvas');
          if (!qrCanvas) continue;

          const cardCanv = await drawSingleCardToCanvas(p, qrCanvas, logoImg);
          sCtx.drawImage(cardCanv, positions[i].x, positions[i].y);
        }

        const dataUrl = sheetCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Lembar_Cetak_A4_HealYou_Hal_${pageIdx + 1}.png`;
        link.href = dataUrl;
        link.click();

        await new Promise((r) => setTimeout(r, 250));
      }

      setStatusNote(
        `Berhasil mengunduh ${pages.length} lembar cetak A4 (${participants.length} kartu peserta)!`
      );
    } finally {
      setIsGeneratingSheets(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col">
      {/* Top Action Bar */}
      <div className="bg-white border-b border-purple-100 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#5e438f] flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Cetak & Unduh Semua Kartu Peserta ({participants.length} Kartu · {pages.length} Halaman A4)
            </h2>
            <p className="text-xs text-slate-500">
              Setiap halaman memuat 4 Kartu Tanda Pengenal lengkap dengan QR Code berlogo Heal You
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadAllSheets}
            disabled={isGeneratingSheets}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white rounded-xl shadow-xs hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-60"
            style={{
              background: 'linear-gradient(115deg, #7c52b8 0%, #6b63c9 50%, #587cd9 100%)',
            }}
          >
            <Download className="w-4 h-4" />
            {isGeneratingSheets
              ? 'Menyiapkan Lembar A4...'
              : `Unduh Semua Lembar A4 (${pages.length} PNG)`}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-[#5e438f] bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Cetak Printer / PDF
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {statusNote && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-center gap-2 text-emerald-900 text-xs sm:text-sm font-medium print:hidden">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusNote}</span>
        </div>
      )}

      {/* Scrollable A4 Pages Preview */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 print:p-0 print:space-y-0">
        {pages.map((pageGroup, pageIdx) => (
          <div
            key={pageIdx}
            className="max-w-4xl mx-auto bg-white rounded-2xl shadow-md border border-slate-200 p-6 sm:p-8 print:shadow-none print:border-none print:rounded-none print:break-after-page"
          >
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100 print:hidden">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Halaman A4 #{pageIdx + 1} dari {pages.length}
              </span>
              <span className="text-xs text-slate-400">
                Menampilkan {pageGroup.length} Kartu Peserta
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {pageGroup.map((p) => (
                <div
                  key={p.id}
                  className="rounded-[28px] p-4 shadow-sm relative overflow-hidden border border-purple-200/60"
                  style={{
                    background:
                      'linear-gradient(160deg, #f2cbfc 0%, #d5c4fc 30%, #b8d0ff 62%, #ede8ff 100%)',
                  }}
                >
                  <div className="w-10 h-1.5 mx-auto mb-3 rounded-full bg-white/80" />

                  <div className="flex flex-col items-center text-center mb-3">
                    <div className="p-0.5 bg-white/85 rounded-tl-[16px] rounded-br-[16px] rounded-tr-xs rounded-bl-xs shadow-2xs">
                      <HealYouLogo
                        customLogoUrl={config.customLogoUrl}
                        size={48}
                        className="rounded-tl-[14px] rounded-br-[14px] rounded-tr-xs rounded-bl-xs"
                      />
                    </div>
                    <p className="mt-2 text-[9px] font-semibold tracking-[0.24em] uppercase text-[#3d2863]">
                      {organizer}
                    </p>
                    <p
                      className="text-xs italic font-semibold text-[#5e438f]"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      — {tagline} —
                    </p>
                  </div>

                  <div className="bg-white/92 rounded-[20px] p-2 border border-white">
                    <div className="rounded-[15px] border border-[#b49ae6]/30 px-3.5 py-4 text-center flex flex-col items-center">
                      <span className="text-[9px] font-semibold tracking-[0.22em] uppercase text-[#7c5bb0]">
                        {p.role || 'Peserta Workshop'}
                      </span>
                      <h3
                        className="mt-1 text-xl font-bold text-[#1f1235] leading-tight"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                      >
                        {p.name}
                      </h3>
                      <p className="mt-0.5 text-[11px] font-medium text-[#4a3b69]">
                        {p.institution}
                      </p>
                      <p className="text-[10px] text-[#7c6f99]">
                        {p.email}
                        {p.phone ? ` · ${p.phone}` : ''}
                      </p>

                      <div className="w-36 my-2.5 h-px bg-purple-200/70" />

                      <p
                        className="text-xs italic font-semibold text-[#8b6fc9]"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                      >
                        {eventLabel}
                      </p>
                      <h4
                        className="text-sm font-bold text-[#261742] leading-snug max-w-[240px]"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                      >
                        {config.name}
                      </h4>
                      <p className="mt-1 text-[10px] font-medium text-[#52436e]">
                        {formatSafeDate(config.date, 'dd MMMM yyyy')} · Pukul {eventTime} WIB
                      </p>
                      <p className="text-[9px] font-medium tracking-[0.1em] uppercase text-[#7c6f99]">
                        {config.location}
                      </p>

                      <div className="mt-3 p-2.5 bg-white rounded-xl border border-[#dcd0ff] flex items-center justify-center">
                        <div
                          ref={(el) => {
                            qrRefs.current[p.id] = el;
                          }}
                          className="relative flex items-center justify-center"
                        >
                          <QRCodeCanvas
                            value={p.id}
                            size={320}
                            level="H"
                            minVersion={4}
                            marginSize={2}
                            fgColor="#261742"
                            bgColor="#ffffff"
                            style={{ width: 124, height: 124 }}
                            imageSettings={{
                              src: config.customLogoUrl || HEAL_YOU_DATA_URI,
                              height: 60,
                              width: 60,
                              excavate: true,
                            }}
                          />
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="p-0.5 bg-white rounded-tl-[8px] rounded-br-[8px] rounded-tr-[2px] rounded-bl-[2px]">
                              <HealYouLogo
                                customLogoUrl={config.customLogoUrl}
                                size={22}
                                className="rounded-tl-[6px] rounded-br-[6px] rounded-tr-[1px] rounded-bl-[1px]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="mt-2.5 text-[10px] font-semibold tracking-[0.18em] uppercase text-[#4c3575]">
                        No. Presensi · {p.id}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
