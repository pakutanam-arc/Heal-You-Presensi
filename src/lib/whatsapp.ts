import { format } from 'date-fns';
import { Participant, WorkshopConfig } from '../types';
import { loadLogoImage } from '../components/HealYouLogo';

export function normalizeWhatsAppPhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}

export function formatSafeDateStr(dateStr: string, pattern = 'dd MMMM yyyy'): string {
  try {
    const parsed = dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T00:00:00`);
    if (isNaN(parsed.getTime())) return dateStr;
    return format(parsed, pattern);
  } catch {
    return dateStr;
  }
}

export function formatSafeTimeStr(startTimeStr: string): string {
  try {
    if (/^\d{2}:\d{2}$/.test(startTimeStr)) return startTimeStr;
    const parsed = new Date(startTimeStr);
    if (isNaN(parsed.getTime())) return '08:00';
    return format(parsed, 'HH:mm');
  } catch {
    return '08:00';
  }
}

export function buildDigitalTicketUrl(participant: Participant, config: WorkshopConfig): string {
  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '';
  const params = new URLSearchParams({
    ticket: participant.id,
    name: participant.name,
    role: participant.role || 'Peserta Workshop',
    inst: participant.institution,
    event: config.name,
    label: config.eventLabel || 'Agenda Workshop Psikologi',
    date: config.date,
    time: formatSafeTimeStr(config.startTime),
    loc: config.location,
    org: config.organizer || 'Muslimah Healing Journey',
    tag: config.tagline || "Let's Heal",
  });
  return `${baseUrl}?${params.toString()}`;
}

export function parseDigitalTicketFromUrl(): {
  participant: Participant;
  config: WorkshopConfig;
} | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const ticketId = params.get('ticket');
  if (!ticketId) return null;

  const date = params.get('date') || format(new Date(), 'yyyy-MM-dd');
  const time = params.get('time') || '08:00';

  const participant: Participant = {
    id: ticketId.trim().toUpperCase(),
    name: params.get('name') || 'Peserta Workshop',
    role: params.get('role') || 'Peserta Workshop',
    institution: params.get('inst') || '-',
    email: params.get('email') || '',
    phone: params.get('phone') || '',
    status: 'PENDING',
  };

  const config: WorkshopConfig = {
    name: params.get('event') || 'Self Healing & Mindfulness Workshop',
    eventLabel: params.get('label') || 'Agenda Workshop Psikologi',
    date,
    startTime: `${date}T${time}:00`,
    location: params.get('loc') || 'Lokasi Acara',
    organizer: params.get('org') || 'Muslimah Healing Journey',
    tagline: params.get('tag') || "Let's Heal",
  };

  return { participant, config };
}

export function buildWhatsAppMessage(participant: Participant, config: WorkshopConfig): string {
  const organizer = config.organizer || 'Muslimah Healing Journey';
  const dateFormatted = formatSafeDateStr(config.date);
  const timeFormatted = formatSafeTimeStr(config.startTime);
  const role = participant.role || 'Peserta Workshop';
  const ticketUrl = buildDigitalTicketUrl(participant, config);

  return [
    `Assalamu'alaikum / Halo *${participant.name}*,`,
    ``,
    `Berikut informasi *Kartu Tanda Pengenal & Presensi* Anda untuk kegiatan:`,
    `*${config.name}*`,
    `Penyelenggara: *Heal You · ${organizer}*`,
    ``,
    `*Detail Presensi Peserta:*`,
    `• No. Presensi: *${participant.id}*`,
    `• Peran: ${role}`,
    `• Institusi: ${participant.institution}`,
    `• Tanggal: ${dateFormatted}`,
    `• Jam Mulai: Pukul ${timeFormatted} WIB`,
    `• Lokasi: ${config.location}`,
    ``,
    `*Kartu QR & Tiket Digital Anda:*`,
    `Lihat & unduh Kartu QR Anda di HP melalui tautan berikut:`,
    ticketUrl,
    ``,
    `Mohon tunjukkan Kartu QR tersebut di meja registrasi / Layar Sambutan TV saat kedatangan. Sampai jumpa di lokasi acara!`,
  ].join('\n');
}

export function buildWhatsAppUrl(participant: Participant, config: WorkshopConfig): string {
  const phone = normalizeWhatsAppPhone(participant.phone);
  const text = encodeURIComponent(buildWhatsAppMessage(participant, config));
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
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

/**
 * Renders the Couture Heal You ID Card for any participant into a high-resolution HTMLCanvasElement.
 */
export async function renderParticipantCardCanvas(
  participant: Participant,
  config: WorkshopConfig,
  explicitQrCanvas?: HTMLCanvasElement | null
): Promise<HTMLCanvasElement> {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const qrCanvas =
    explicitQrCanvas ||
    (document.getElementById(`global-qr-${participant.id}`) as HTMLCanvasElement | null);

  const scale = 3;
  const baseW = 448;
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');

  const displayOrganizer = config.organizer || 'Muslimah Healing Journey';
  const displayTagline = config.tagline || "Let's Heal";
  const displayEventLabel = config.eventLabel || 'Agenda Workshop Psikologi';
  const displayEventName = config.name;
  const displayDate = config.date;
  const displayTime = formatSafeTimeStr(config.startTime);
  const displayLocation = config.location;
  const displayParticipantRole = participant.role || 'Peserta Workshop';
  const displayParticipantName = participant.name;
  const displayParticipantInst = participant.institution || '-';
  const contactStr = [participant.email, participant.phone].filter(Boolean).join('  ·  ');

  let nameLines = [displayParticipantName];
  let instLines = [displayParticipantInst];
  let contactLines = contactStr ? [contactStr] : [];
  let eventLines = [displayEventName];
  let locationLines = [displayLocation.toUpperCase()];

  if (mCtx) {
    mCtx.font = '700 31px "Cormorant Garamond", Georgia, serif';
    nameLines = wrapCanvasLines(mCtx, displayParticipantName, 336);

    mCtx.font = '500 13px "Plus Jakarta Sans", sans-serif';
    instLines = wrapCanvasLines(mCtx, displayParticipantInst, 336);

    if (contactStr) {
      mCtx.font = '400 12px "Plus Jakarta Sans", sans-serif';
      contactLines = wrapCanvasLines(mCtx, contactStr, 336);
    }

    mCtx.font = '700 21px "Cormorant Garamond", Georgia, serif';
    eventLines = wrapCanvasLines(mCtx, displayEventName, 316);

    mCtx.font = '500 11px "Plus Jakarta Sans", sans-serif';
    locationLines = wrapCanvasLines(mCtx, displayLocation.toUpperCase(), 310);
  }

  const nameLineH = 34;
  const instLineH = 18;
  const contactLineH = 16;
  const eventLineH = 26;
  const locationLineH = 15;

  const innerContentH =
    24 +
    14 +
    6 +
    nameLines.length * nameLineH +
    4 +
    instLines.length * instLineH +
    (contactLines.length > 0 ? 2 + contactLines.length * contactLineH : 0) +
    28 +
    18 +
    4 +
    eventLines.length * eventLineH +
    6 +
    17 +
    4 +
    locationLines.length * locationLineH +
    16 +
    192 +
    16 +
    15 +
    4 +
    15 +
    24;

  const sheetH = innerContentH + 20;
  const sheetY = 186;
  const baseH = sheetY + sheetH + 24;

  const cardCanvas = document.createElement('canvas');
  cardCanvas.width = baseW * scale;
  cardCanvas.height = baseH * scale;
  const ctx = cardCanvas.getContext('2d');
  if (!ctx) return cardCanvas;

  ctx.scale(scale, scale);
  ctx.save();
  drawRoundedRect(ctx, 0, 0, baseW, baseH, 36);
  ctx.clip();

  // 1. Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, baseW * 0.65, baseH);
  bgGrad.addColorStop(0, '#f2cbfc');
  bgGrad.addColorStop(0.3, '#d5c4fc');
  bgGrad.addColorStop(0.62, '#b8d0ff');
  bgGrad.addColorStop(1, '#ede8ff');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, baseW, baseH);

  // Soft Radial Top Aura
  const aura = ctx.createRadialGradient(baseW / 2, 30, 8, baseW / 2, 30, 180);
  aura.addColorStop(0, 'rgba(255, 255, 255, 0.52)');
  aura.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, baseW, baseH);

  // Inner Couture Frame Line
  drawRoundedRect(ctx, 12, 12, baseW - 24, baseH - 24, 28);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Lanyard Slot Cutout
  drawRoundedRect(ctx, (baseW - 56) / 2, 24, 56, 8, 4);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 2. Header Logo
  const logoPadSize = 76;
  const logoSize = 68;
  const logoPadX = (baseW - logoPadSize) / 2;
  const logoPadY = 52;

  try {
    const logoImg = await loadLogoImage(config.customLogoUrl);
    drawLeafRect(ctx, logoPadX, logoPadY, logoPadSize, logoPadSize, 22, 4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();

    ctx.save();
    drawLeafRect(ctx, logoPadX + 4, logoPadY + 4, logoSize, logoSize, 19, 3);
    ctx.clip();
    ctx.drawImage(logoImg, logoPadX + 4, logoPadY + 4, logoSize, logoSize);
    ctx.restore();
  } catch {
    // Fallback
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#3d2863';
  ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
  ctx.letterSpacing = '2.86px';
  ctx.fillText(displayOrganizer.toUpperCase(), baseW / 2, 149);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = '#5e438f';
  ctx.font = 'italic 600 16px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(`— ${displayTagline} —`, baseW / 2, 168);

  // 3. Porcelain Sanctuary Sheet
  const sheetX = 24;
  const sheetW = baseW - 48;

  drawRoundedRect(ctx, sheetX, sheetY, sheetW, sheetH, 26);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();

  const innerX = sheetX + 10;
  const innerY = sheetY + 10;
  const innerW = sheetW - 20;
  drawRoundedRect(ctx, innerX, innerY, innerW, innerContentH, 20);
  ctx.strokeStyle = 'rgba(180, 154, 230, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  let cursorY = innerY + 24;

  ctx.fillStyle = '#7c5bb0';
  ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
  ctx.letterSpacing = '2.4px';
  ctx.fillText(displayParticipantRole.toUpperCase(), baseW / 2, cursorY + 10);
  ctx.letterSpacing = '0px';
  cursorY += 14;

  cursorY += 6;
  ctx.fillStyle = '#1f1235';
  ctx.font = '700 31px "Cormorant Garamond", Georgia, serif';
  for (const line of nameLines) {
    ctx.fillText(line, baseW / 2, cursorY + 26);
    cursorY += nameLineH;
  }

  cursorY += 4;
  ctx.fillStyle = '#4a3b69';
  ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
  for (const line of instLines) {
    ctx.fillText(line, baseW / 2, cursorY + 13);
    cursorY += instLineH;
  }

  if (contactLines.length > 0) {
    cursorY += 2;
    ctx.fillStyle = '#7c6f99';
    ctx.font = '400 12px "Plus Jakarta Sans", sans-serif';
    for (const line of contactLines) {
      ctx.fillText(line, baseW / 2, cursorY + 12);
      cursorY += contactLineH;
    }
  }

  // Ornamental Diamond Filigree Divider
  const divY = cursorY + 14;
  const divHalfW = 120;
  const lineGradLeft = ctx.createLinearGradient(baseW / 2 - divHalfW, divY, baseW / 2 - 12, divY);
  lineGradLeft.addColorStop(0, 'rgba(167, 139, 250, 0)');
  lineGradLeft.addColorStop(1, 'rgba(167, 139, 250, 0.5)');
  ctx.strokeStyle = lineGradLeft;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(baseW / 2 - divHalfW, divY);
  ctx.lineTo(baseW / 2 - 12, divY);
  ctx.stroke();

  const lineGradRight = ctx.createLinearGradient(baseW / 2 + 12, divY, baseW / 2 + divHalfW, divY);
  lineGradRight.addColorStop(0, 'rgba(167, 139, 250, 0.5)');
  lineGradRight.addColorStop(1, 'rgba(167, 139, 250, 0)');
  ctx.strokeStyle = lineGradRight;
  ctx.beginPath();
  ctx.moveTo(baseW / 2 + 12, divY);
  ctx.lineTo(baseW / 2 + divHalfW, divY);
  ctx.stroke();

  ctx.fillStyle = '#b197fc';
  ctx.beginPath();
  ctx.moveTo(baseW / 2, divY - 4);
  ctx.lineTo(baseW / 2 + 4, divY);
  ctx.lineTo(baseW / 2, divY + 4);
  ctx.lineTo(baseW / 2 - 4, divY);
  ctx.closePath();
  ctx.fill();
  cursorY += 28;

  ctx.fillStyle = '#8b6fc9';
  ctx.font = 'italic 600 14px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(displayEventLabel, baseW / 2, cursorY + 13);
  cursorY += 18;

  cursorY += 4;
  ctx.fillStyle = '#261742';
  ctx.font = '700 21px "Cormorant Garamond", Georgia, serif';
  for (const line of eventLines) {
    ctx.fillText(line, baseW / 2, cursorY + 19);
    cursorY += eventLineH;
  }

  cursorY += 6;
  ctx.fillStyle = '#52436e';
  ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `${formatSafeDateStr(displayDate, 'dd MMMM yyyy')}  ·  Pukul ${displayTime} WIB`,
    baseW / 2,
    cursorY + 12
  );
  cursorY += 17;

  cursorY += 4;
  ctx.fillStyle = '#7c6f99';
  ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
  ctx.letterSpacing = '1.32px';
  for (const line of locationLines) {
    ctx.fillText(line, baseW / 2, cursorY + 11);
    cursorY += locationLineH;
  }
  ctx.letterSpacing = '0px';

  // QR Code Box
  cursorY += 16;
  const qrBoxSize = 192;
  const qrBoxX = (baseW - qrBoxSize) / 2;
  const qrBoxY = cursorY;

  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#dcd0ff';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (qrCanvas) {
    const qrDrawSize = 168;
    const qrDrawX = qrBoxX + (qrBoxSize - qrDrawSize) / 2;
    const qrDrawY = qrBoxY + (qrBoxSize - qrDrawSize) / 2;
    ctx.drawImage(qrCanvas, qrDrawX, qrDrawY, qrDrawSize, qrDrawSize);

    try {
      const centerLogoImg = await loadLogoImage(config.customLogoUrl);
      const centerPadSize = 34;
      const centerLogoSize = 30;
      const cx = qrBoxX + qrBoxSize / 2;
      const cy = qrBoxY + qrBoxSize / 2;

      drawLeafRect(
        ctx,
        cx - centerPadSize / 2,
        cy - centerPadSize / 2,
        centerPadSize,
        centerPadSize,
        10,
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
        8,
        2
      );
      ctx.clip();
      ctx.drawImage(
        centerLogoImg,
        cx - centerLogoSize / 2,
        cy - centerLogoSize / 2,
        centerLogoSize,
        centerLogoSize
      );
      ctx.restore();
    } catch {
      // Fallback
    }
  }
  cursorY += qrBoxSize;

  cursorY += 16;
  ctx.fillStyle = '#4c3575';
  ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
  ctx.letterSpacing = '2.2px';
  ctx.fillText(`NO. PRESENSI  ·  ${participant.id.toUpperCase()}`, baseW / 2, cursorY + 11);
  ctx.letterSpacing = '0px';
  cursorY += 15;

  cursorY += 4;
  ctx.fillStyle = '#8b7fa8';
  ctx.font = '400 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    'Tunjukkan kartu ini pada meja registrasi untuk pemindaian kehadiran',
    baseW / 2,
    cursorY + 11
  );

  ctx.restore();
  return cardCanvas;
}

export async function renderParticipantCardBlob(
  participant: Participant,
  config: WorkshopConfig,
  explicitQrCanvas?: HTMLCanvasElement | null
): Promise<Blob> {
  const canvas = await renderParticipantCardCanvas(participant, config, explicitQrCanvas);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Gagal membuat Blob PNG kartu'));
      }
    }, 'image/png');
  });
}

/**
 * Copies the participant's Kartu Tanda Pengenal PNG directly to the system Clipboard
 * so the user can simply press Ctrl+V (Paste) inside WhatsApp Web / Desktop.
 */
export async function copyParticipantCardToClipboard(
  participant: Participant,
  config: WorkshopConfig,
  explicitQrCanvas?: HTMLCanvasElement | null
): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard || !window.ClipboardItem) {
      return false;
    }

    const blobPromise = renderParticipantCardBlob(participant, config, explicitQrCanvas);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blobPromise,
        }),
      ]);
      return true;
    } catch {
      const resolvedBlob = await blobPromise;
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': resolvedBlob,
        }),
      ]);
      return true;
    }
  } catch {
    return false;
  }
}

/**
 * Uses the native Web Share API (on mobile Android/iOS or supported desktops) to share
 * the actual Kartu PNG file + WhatsApp caption directly into WhatsApp.
 */
export async function shareParticipantCardFile(
  participant: Participant,
  config: WorkshopConfig,
  explicitQrCanvas?: HTMLCanvasElement | null
): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.share) return false;
    const blob = await renderParticipantCardBlob(participant, config, explicitQrCanvas);
    const fileName = `IDCard_HealYou_${participant.id}_${participant.name.replace(/[^a-z0-9]/gi, '_')}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });
    const shareData: ShareData = {
      title: `Kartu QR ${participant.name} - ${config.name}`,
      text: buildWhatsAppMessage(participant, config),
      files: [file],
    };
    if (navigator.canShare && !navigator.canShare(shareData)) {
      return false;
    }
    await navigator.share(shareData);
    return true;
  } catch {
    return false;
  }
}
