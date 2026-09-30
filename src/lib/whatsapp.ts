import { format } from 'date-fns';
import { Participant, WorkshopConfig } from '../types';

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

function formatSafeDateStr(dateStr: string): string {
  try {
    const parsed = dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T00:00:00`);
    if (isNaN(parsed.getTime())) return dateStr;
    return format(parsed, 'dd MMMM yyyy');
  } catch {
    return dateStr;
  }
}

function formatSafeTimeStr(startTimeStr: string): string {
  try {
    const parsed = new Date(startTimeStr);
    if (isNaN(parsed.getTime())) return '08:00';
    return format(parsed, 'HH:mm');
  } catch {
    return '08:00';
  }
}

export function buildWhatsAppMessage(participant: Participant, config: WorkshopConfig): string {
  const organizer = config.organizer || 'Muslimah Healing Journey';
  const dateFormatted = formatSafeDateStr(config.date);
  const timeFormatted = formatSafeTimeStr(config.startTime);
  const role = participant.role || 'Peserta Workshop';

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
    `Mohon tunjukkan Kartu QR Anda atau sebutkan kode *${participant.id}* di meja registrasi saat kedatangan. Sampai jumpa di lokasi acara!`,
  ].join('\n');
}

export function buildWhatsAppUrl(participant: Participant, config: WorkshopConfig): string {
  const phone = normalizeWhatsAppPhone(participant.phone);
  const text = encodeURIComponent(buildWhatsAppMessage(participant, config));
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}
