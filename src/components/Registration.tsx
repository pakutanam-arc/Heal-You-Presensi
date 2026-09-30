import React, { useState, useRef, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import * as XLSX from 'xlsx';
import { useAppContext } from '../store';
import { AttendanceStatus, Participant } from '../types';
import {
  UserPlus,
  Download,
  QrCode,
  CheckCircle2,
  Search,
  Upload,
  RotateCcw,
  UserCheck,
  SlidersHorizontal,
  Check,
  Trash2,
  Pencil,
  FileSpreadsheet,
  Layers,
  MessageCircle,
  Copy,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { buildWhatsAppUrl, buildWhatsAppMessage } from '../lib/whatsapp';
import { format } from 'date-fns';
import { HealYouLogo, HEAL_YOU_DATA_URI, loadLogoImage } from './HealYouLogo';
import { BatchPrintModal } from './BatchPrintModal';
import { WhatsAppBroadcastModal } from './WhatsAppBroadcastModal';

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

export const Registration: React.FC = () => {
  const {
    participants,
    config,
    selectedParticipantId: selectedId,
    setSelectedParticipantId: setSelectedId,
    registerParticipant,
    importParticipants,
    updateParticipant,
    deleteParticipant,
    updateConfig,
  } = useAppContext();

  const selectedParticipant =
    participants.find((p) => p.id === selectedId) || participants[0] || null;

  const [formTab, setFormTab] = useState<'edit' | 'new' | 'event'>('edit');

  // New participant form state
  const [newName, setNewName] = useState('');
  const [newCustomId, setNewCustomId] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newInstitution, setNewInstitution] = useState('');
  const [newRole, setNewRole] = useState('Peserta Workshop');
  const [newPhone, setNewPhone] = useState('');

  // Controlled Draft State for Editing Selected Participant (avoids input snap-back bug)
  const [draftId, setDraftId] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftRole, setDraftRole] = useState('');
  const [draftInstitution, setDraftInstitution] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftStatus, setDraftStatus] = useState<AttendanceStatus>('PENDING');

  // Controlled Draft State for Editing Card Event & Branding
  const [draftOrganizer, setDraftOrganizer] = useState('');
  const [draftTagline, setDraftTagline] = useState('');
  const [draftEventLabel, setDraftEventLabel] = useState('');
  const [draftEventName, setDraftEventName] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [draftTime, setDraftTime] = useState('');
  const [draftLocation, setDraftLocation] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isWaBroadcastOpen, setIsWaBroadcastOpen] = useState(false);
  const [copiedWa, setCopiedWa] = useState(false);

  const handleCopyWaMessage = async (p: Participant) => {
    try {
      await navigator.clipboard.writeText(buildWhatsAppMessage(p, config));
      setCopiedWa(true);
      window.setTimeout(() => setCopiedWa(false), 2500);
    } catch {
      // Ignore clipboard error
    }
  };

  const qrContainerRef = useRef<HTMLDivElement>(null);
  const editorPanelRef = useRef<HTMLDivElement>(null);
  const editNameInputRef = useRef<HTMLInputElement>(null);
  const editEventInputRef = useRef<HTMLInputElement>(null);
  const editOrganizerInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Sync selected participant into draft fields when selection changes
  useEffect(() => {
    if (selectedParticipant) {
      setSelectedId(selectedParticipant.id);
      setDraftId(selectedParticipant.id);
      setDraftName(selectedParticipant.name);
      setDraftRole(selectedParticipant.role ?? 'Peserta Workshop');
      setDraftInstitution(selectedParticipant.institution);
      setDraftEmail(selectedParticipant.email);
      setDraftPhone(selectedParticipant.phone ?? '');
      setDraftStatus(selectedParticipant.status);
    }
  }, [selectedParticipant?.id]);

  // Sync config into draft fields
  useEffect(() => {
    setDraftOrganizer(config.organizer ?? 'Muslimah Healing Journey');
    setDraftTagline(config.tagline ?? "Let's Heal");
    setDraftEventLabel(config.eventLabel ?? 'Agenda Workshop Psikologi');
    setDraftEventName(config.name);
    setDraftDate(config.date);
    setDraftLocation(config.location);
    try {
      setDraftTime(format(new Date(config.startTime), 'HH:mm'));
    } catch {
      setDraftTime('08:00');
    }
  }, [
    config.organizer,
    config.tagline,
    config.eventLabel,
    config.name,
    config.date,
    config.location,
    config.startTime,
  ]);

  // Handlers that update both local draft AND store live so the preview updates as you type
  const handleParticipantFieldChange = (
    field: 'name' | 'role' | 'institution' | 'email' | 'phone' | 'status',
    value: string
  ) => {
    if (!selectedParticipant) return;
    if (field === 'name') setDraftName(value);
    if (field === 'role') setDraftRole(value);
    if (field === 'institution') setDraftInstitution(value);
    if (field === 'email') setDraftEmail(value);
    if (field === 'phone') setDraftPhone(value);
    if (field === 'status') {
      const st = value as AttendanceStatus;
      setDraftStatus(st);
      updateParticipant(selectedParticipant.id, {
        status: st,
        checkInTime:
          st === 'PENDING'
            ? undefined
            : selectedParticipant.checkInTime || new Date().toISOString(),
      });
      return;
    }
    updateParticipant(selectedParticipant.id, { [field]: value });
  };

  const handleSaveParticipantAndCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParticipant) return;

    const cleanId = draftId.trim().toUpperCase() || selectedParticipant.id;
    const cleanName = draftName.trim() || selectedParticipant.name;

    updateParticipant(selectedParticipant.id, {
      id: cleanId,
      name: cleanName,
      role: draftRole.trim() || 'Peserta Workshop',
      institution: draftInstitution.trim(),
      email: draftEmail.trim(),
      phone: draftPhone.trim(),
      status: draftStatus,
    });

    if (cleanId !== selectedParticipant.id) {
      setSelectedId(cleanId);
    }

    let newStartTime = config.startTime;
    if (draftDate && draftTime) {
      const combined = new Date(`${draftDate}T${draftTime}:00`);
      if (!isNaN(combined.getTime())) {
        newStartTime = combined.toISOString();
      }
    }

    updateConfig({
      organizer: draftOrganizer.trim() || 'Muslimah Healing Journey',
      tagline: draftTagline.trim() || "Let's Heal",
      eventLabel: draftEventLabel.trim() || 'Agenda Workshop Psikologi',
      name: draftEventName.trim() || config.name,
      date: draftDate || config.date,
      location: draftLocation.trim() || config.location,
      startTime: newStartTime,
    });

    showToast(`Perubahan kartu "${cleanName}" berhasil disimpan!`);
  };

  const handleSaveEventConfig = (e: React.FormEvent) => {
    e.preventDefault();
    let newStartTime = config.startTime;
    if (draftDate && draftTime) {
      const combined = new Date(`${draftDate}T${draftTime}:00`);
      if (!isNaN(combined.getTime())) {
        newStartTime = combined.toISOString();
      }
    }

    updateConfig({
      organizer: draftOrganizer.trim() || 'Muslimah Healing Journey',
      tagline: draftTagline.trim() || "Let's Heal",
      eventLabel: draftEventLabel.trim() || 'Agenda Workshop Psikologi',
      name: draftEventName.trim() || config.name,
      date: draftDate || config.date,
      location: draftLocation.trim() || config.location,
      startTime: newStartTime,
    });

    showToast('Pengaturan acara & tampilan kartu berhasil disimpan!');
  };

  const handleCreateParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newInstitution.trim()) return;

    const created = registerParticipant({
      id: newCustomId,
      name: newName,
      email: newEmail,
      institution: newInstitution,
      role: newRole,
      phone: newPhone,
    });

    setSelectedId(created.id);
    setNewName('');
    setNewCustomId('');
    setNewEmail('');
    setNewInstitution('');
    setNewPhone('');
    setFormTab('edit');
    showToast(`Peserta baru "${created.name}" (${created.id}) berhasil ditambahkan!`);
  };

  const handleDeleteCurrentParticipant = () => {
    if (!selectedParticipant || participants.length <= 1) return;
    const removedName = selectedParticipant.name;
    const remaining = participants.filter((p) => p.id !== selectedParticipant.id);
    deleteParticipant(selectedParticipant.id);
    if (remaining.length > 0) {
      setSelectedId(remaining[0].id);
    }
    showToast(`Data peserta "${removedName}" telah dihapus.`);
  };

  const focusEditorSection = (section: 'participant' | 'event' | 'header', participantId?: string) => {
    if (participantId) {
      setSelectedId(participantId);
    }
    setFormTab('edit');
    editorPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      if (section === 'participant') {
        editNameInputRef.current?.focus();
        editNameInputRef.current?.select();
      } else if (section === 'event') {
        editEventInputRef.current?.focus();
        editEventInputRef.current?.select();
      } else {
        editOrganizerInputRef.current?.focus();
        editOrganizerInputRef.current?.select();
      }
    }, 150);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateConfig({ customLogoUrl: reader.result });
        showToast('Logo kartu berhasil diperbarui!');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDownloadImportTemplate = () => {
    const sampleRows = [
      {
        'Nama Peserta': 'Dr. Aisyah Putri, M.Psi., Psikolog',
        'Peran / Kategori': 'Peserta Workshop',
        Institusi: 'Klinik Psikologi Harapan',
        Email: 'aisyah.putri@klinik.id',
        'No. WhatsApp': '0812-3456-7890',
        'ID Presensi (Opsional)': '',
      },
      {
        'Nama Peserta': 'Nadia Zahra, S.Psi.',
        'Peran / Kategori': 'Tamu VIP',
        Institusi: 'Universitas Indonesia',
        Email: 'nadia.z@ui.ac.id',
        'No. WhatsApp': '0813-9876-5432',
        'ID Presensi (Opsional)': '',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    ws['!cols'] = [
      { wch: 32 },
      { wch: 20 },
      { wch: 28 },
      { wch: 28 },
      { wch: 18 },
      { wch: 22 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Peserta');
    XLSX.writeFile(wb, 'Template_Impor_Peserta_HealYou.xlsx');
  };

  const handleImportExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
          defval: '',
        });

        const parsedRows = rawRows
          .map((row) => {
            const entries = Object.entries(row);
            const findVal = (keywords: string[]) => {
              const found = entries.find(([k]) =>
                keywords.some((kw) => k.toLowerCase().includes(kw))
              );
              return found ? String(found[1] ?? '').trim() : '';
            };

            const name = findVal(['nama', 'name', 'peserta', 'participant']);
            const role = findVal(['peran', 'role', 'kategori', 'jabatan']);
            const institution = findVal(['institusi', 'instansi', 'institution', 'afiliasi', 'organisasi']);
            const email = findVal(['email', 'surel']);
            const phone = findVal(['whatsapp', 'wa', 'hp', 'telepon', 'phone', 'kontak']);
            const id = findVal(['id presensi', 'no presensi', 'kode', 'id']);

            return { id, name, role, institution, email, phone };
          })
          .filter((r) => r.name.length > 0);

        if (parsedRows.length === 0) {
          showToast('File tidak memiliki baris data peserta yang valid (pastikan ada kolom Nama).');
          return;
        }

        const count = importParticipants(parsedRows);
        setFormTab('edit');
        showToast(`Berhasil mengimpor ${count} peserta baru dari file Excel/CSV!`);
      } catch {
        showToast('Gagal membaca file. Pastikan format file adalah .xlsx, .xls, atau .csv.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Live values shown on the card preview (reflecting current typing immediately)
  const displayOrganizer = draftOrganizer || config.organizer || 'Muslimah Healing Journey';
  const displayTagline = draftTagline || config.tagline || "Let's Heal";
  const displayEventLabel = draftEventLabel || config.eventLabel || 'Agenda Workshop Psikologi';
  const displayEventName = draftEventName || config.name;
  const displayDate = draftDate || config.date;
  const displayTime = draftTime || '08:00';
  const displayLocation = draftLocation || config.location;

  const displayParticipantId = draftId || selectedParticipant?.id || 'HY-001';
  const displayParticipantName = draftName || selectedParticipant?.name || '';
  const displayParticipantRole = draftRole || selectedParticipant?.role || 'Peserta Workshop';
  const displayParticipantInst = draftInstitution || selectedParticipant?.institution || '';
  const displayParticipantEmail = draftEmail || selectedParticipant?.email || '';
  const displayParticipantPhone = draftPhone ?? selectedParticipant?.phone ?? '';

  const handleDownloadIdCard = async () => {
    if (!selectedParticipant || !qrContainerRef.current) return;
    const qrCanvas = qrContainerRef.current.querySelector('canvas');
    if (!qrCanvas) return;

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    // 1:1 CSS Pixel Layout matching the 448px (max-w-md) Web Preview at 2x Retina Resolution
    const scale = 2;
    const baseW = 448;

    const measureCanvas = document.createElement('canvas');
    const mCtx = measureCanvas.getContext('2d');
    if (!mCtx) return;

    // Pre-wrap multi-line text blocks using the exact web preview font sizes & max-widths
    mCtx.font = '700 31px "Cormorant Garamond", Georgia, serif';
    const nameLines = wrapCanvasLines(mCtx, displayParticipantName, 332);

    mCtx.font = '500 13px "Plus Jakarta Sans", sans-serif';
    const instLines = wrapCanvasLines(mCtx, displayParticipantInst, 332);

    const contactLine = displayParticipantPhone
      ? `${displayParticipantEmail}  ·  ${displayParticipantPhone}`
      : displayParticipantEmail;
    mCtx.font = '400 12px "Plus Jakarta Sans", sans-serif';
    const contactLines = wrapCanvasLines(mCtx, contactLine, 332);

    mCtx.font = '700 21px "Cormorant Garamond", Georgia, serif';
    const eventLines = wrapCanvasLines(mCtx, displayEventName, 320);

    mCtx.font = '500 11px "Plus Jakarta Sans", sans-serif';
    mCtx.letterSpacing = '1.32px';
    const locationLines = wrapCanvasLines(mCtx, displayLocation.toUpperCase(), 320);
    mCtx.letterSpacing = '0px';

    // Compute exact dynamic height of the inner filigree box & porcelain sheet
    const nameLineH = 35;
    const instLineH = 19;
    const contactLineH = 17;
    const eventLineH = 26;
    const locationLineH = 16;

    // Inner filigree content height (matches py-6 = 24px top + 24px bottom)
    let innerContentH = 24; // top padding
    innerContentH += 14; // Role kicker (10px)
    innerContentH += 6 + nameLines.length * nameLineH; // mt-1.5 + Name
    innerContentH += 4 + instLines.length * instLineH; // mt-1 + Institution
    innerContentH += 2 + contactLines.length * contactLineH; // mt-0.5 + Email/Phone
    innerContentH += 28; // my-3.5 Diamond filigree divider
    innerContentH += 18; // Event Label (14px italic)
    innerContentH += 4 + eventLines.length * eventLineH; // mt-0.5 + Event Title
    innerContentH += 6 + 17; // mt-1.5 + Date & Time
    innerContentH += 4 + locationLines.length * locationLineH; // mt-1 + Location
    innerContentH += 16 + 192; // mt-4 + QR Medallion (168px QR + p-3*2 = 192px)
    innerContentH += 16 + 15; // mt-4 + No. Presensi
    innerContentH += 4 + 15; // mt-1 + Footer caption
    innerContentH += 24; // bottom padding (py-6)

    const sheetY = 186; // 24 (top p-6) + 8 (lanyard) + 20 (mb-5) + 114 (header) + 20 (mb-5)
    const sheetH = innerContentH + 20; // p-2.5 (10px top + 10px bottom) around inner filigree box
    const baseH = sheetY + sheetH + 24; // + 24px bottom padding (p-6)

    const cardCanvas = document.createElement('canvas');
    cardCanvas.width = baseW * scale;
    cardCanvas.height = baseH * scale;
    const ctx = cardCanvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);

    // Clip Outer Card to rounded-[36px] just like the Web Preview
    ctx.save();
    drawRoundedRect(ctx, 0, 0, baseW, baseH, 36);
    ctx.clip();

    // 1. Background Gradient (160deg matching the Web Preview)
    const bgGrad = ctx.createLinearGradient(0, 0, baseW * 0.65, baseH);
    bgGrad.addColorStop(0, '#f2cbfc');
    bgGrad.addColorStop(0.3, '#d5c4fc');
    bgGrad.addColorStop(0.62, '#b8d0ff');
    bgGrad.addColorStop(1, '#ede8ff');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, baseW, baseH);

    // Soft Radial Top Aura (-top-16 left-1/2 w-72 h-52 bg-white/45 blur-2xl)
    const aura = ctx.createRadialGradient(baseW / 2, 30, 8, baseW / 2, 30, 180);
    aura.addColorStop(0, 'rgba(255, 255, 255, 0.52)');
    aura.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, baseW, baseH);

    // Subtle Inner Couture Frame Line (inset-3 rounded-[28px] border-white/60)
    drawRoundedRect(ctx, 12, 12, baseW - 24, baseH - 24, 28);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Lanyard Slot Cutout (w-14 h-2 = 56x8px at y=24)
    drawRoundedRect(ctx, (baseW - 56) / 2, 24, 56, 8, 4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 2. Centered Symmetrical Couture Header (starts at y=52)
    const logoPadSize = 76; // 68px logo + p-1 (4px*2)
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
      // Fallback if logo load fails
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Organizer Subtitle (mt-3, 11px, tracking-[0.26em], uppercase, #3d2863)
    ctx.fillStyle = '#3d2863';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '2.86px';
    ctx.fillText(displayOrganizer.toUpperCase(), baseW / 2, 149);
    ctx.letterSpacing = '0px';

    // Tagline (mt-0.5, 16px Cormorant Garamond italic semibold, #5e438f)
    ctx.fillStyle = '#5e438f';
    ctx.font = 'italic 600 16px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(`— ${displayTagline} —`, baseW / 2, 168);

    // 3. Porcelain Sanctuary Sheet (x=24, y=186, w=400, rounded-[26px], p-2.5 = 10px)
    const sheetX = 24;
    const sheetW = baseW - 48; // 400px

    drawRoundedRect(ctx, sheetX, sheetY, sheetW, sheetH, 26);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner Filigree Border (x=34, y=196, w=380, rounded-[20px], border-[#b49ae6]/30)
    const innerX = sheetX + 10;
    const innerY = sheetY + 10;
    const innerW = sheetW - 20;
    drawRoundedRect(ctx, innerX, innerY, innerW, innerContentH, 20);
    ctx.strokeStyle = 'rgba(180, 154, 230, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4. Flow Content Inside Inner Filigree Box
    let cursorY = innerY + 24; // top padding py-6

    // Role Kicker (10px, tracking-[0.24em], uppercase, #7c5bb0)
    ctx.fillStyle = '#7c5bb0';
    ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '2.4px';
    ctx.fillText(displayParticipantRole.toUpperCase(), baseW / 2, cursorY + 10);
    ctx.letterSpacing = '0px';
    cursorY += 14;

    // Participant Name (31px Cormorant Garamond bold, #1f1235)
    cursorY += 6;
    ctx.fillStyle = '#1f1235';
    ctx.font = '700 31px "Cormorant Garamond", Georgia, serif';
    for (const line of nameLines) {
      ctx.fillText(line, baseW / 2, cursorY + 26);
      cursorY += nameLineH;
    }

    // Institution (13px Plus Jakarta Sans medium, #4a3b69)
    cursorY += 4;
    ctx.fillStyle = '#4a3b69';
    ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
    for (const line of instLines) {
      ctx.fillText(line, baseW / 2, cursorY + 13);
      cursorY += instLineH;
    }

    // Contact Email & Phone (12px Plus Jakarta Sans regular, #7c6f99)
    cursorY += 2;
    ctx.fillStyle = '#7c6f99';
    ctx.font = '400 12px "Plus Jakarta Sans", sans-serif';
    for (const line of contactLines) {
      ctx.fillText(line, baseW / 2, cursorY + 12);
      cursorY += contactLineH;
    }

    // Ornamental Diamond Filigree Divider (w=240px, my-3.5)
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

    // Workshop Event Label (14px Cormorant Garamond italic semibold, #8b6fc9)
    ctx.fillStyle = '#8b6fc9';
    ctx.font = 'italic 600 14px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(displayEventLabel, baseW / 2, cursorY + 13);
    cursorY += 18;

    // Workshop Event Name (21px Cormorant Garamond bold, #261742, wrapped to 320px)
    cursorY += 4;
    ctx.fillStyle = '#261742';
    ctx.font = '700 21px "Cormorant Garamond", Georgia, serif';
    for (const line of eventLines) {
      ctx.fillText(line, baseW / 2, cursorY + 19);
      cursorY += eventLineH;
    }

    // Event Date & Time (12px Plus Jakarta Sans medium, #52436e)
    cursorY += 6;
    ctx.fillStyle = '#52436e';
    ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      `${formatSafeDate(displayDate, 'dd MMMM yyyy')}  ·  Pukul ${displayTime} WIB`,
      baseW / 2,
      cursorY + 12
    );
    cursorY += 17;

    // Event Location (11px Plus Jakarta Sans medium, tracking-[0.12em], uppercase, #7c6f99)
    cursorY += 4;
    ctx.fillStyle = '#7c6f99';
    ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '1.32px';
    for (const line of locationLines) {
      ctx.fillText(line, baseW / 2, cursorY + 11);
      cursorY += locationLineH;
    }
    ctx.letterSpacing = '0px';

    // Framed QR Code Medallion (mt-4, 192x192px box with 168x168px QR code & center Heal You logo)
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

    const qrDrawSize = 168;
    const qrDrawX = qrBoxX + (qrBoxSize - qrDrawSize) / 2;
    const qrDrawY = qrBoxY + (qrBoxSize - qrDrawSize) / 2;
    ctx.drawImage(qrCanvas, qrDrawX, qrDrawY, qrDrawSize, qrDrawSize);

    // Crisp Leaf-Shaped Center Logo Overlay matching Web Preview (34px pad, 30px logo)
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
      // Fallback if center logo fails
    }
    cursorY += qrBoxSize;

    // Registration ID (mt-4, 11px Plus Jakarta Sans semibold, tracking-[0.2em], uppercase, #4c3575)
    cursorY += 16;
    ctx.fillStyle = '#4c3575';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '2.2px';
    ctx.fillText(`NO. PRESENSI  ·  ${displayParticipantId.toUpperCase()}`, baseW / 2, cursorY + 11);
    ctx.letterSpacing = '0px';
    cursorY += 15;

    // Quiet Caption (mt-1, 11px Plus Jakarta Sans regular, #8b7fa8)
    cursorY += 4;
    ctx.fillStyle = '#8b7fa8';
    ctx.font = '400 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      'Tunjukkan kartu ini pada meja registrasi untuk pemindaian kehadiran',
      baseW / 2,
      cursorY + 11
    );

    ctx.restore();

    const dataUrl = cardCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `IDCard_HealYou_${displayParticipantId}_${displayParticipantName.replace(/[^a-z0-9]/gi, '_')}.png`;
    link.href = dataUrl;
    link.click();
  };

  const filteredParticipants = participants.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.institution.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Unified Editor & Participant Directory */}
      <div className="lg:col-span-7 flex flex-col gap-6" ref={editorPanelRef}>
        <div className="bg-white rounded-2xl border border-purple-100 shadow-xs overflow-hidden">
          <div
            className="p-5 border-b border-purple-100/80"
            style={{
              background:
                'linear-gradient(115deg, rgba(240,189,251,0.18) 0%, rgba(201,179,252,0.18) 50%, rgba(137,180,255,0.18) 100%)',
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Editor Kartu Tanda Pengenal & Peserta
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                  Semua perubahan langsung terlihat pada pratinjau kartu di sebelah kanan
                </p>
              </div>
              <HealYouLogo
                customLogoUrl={config.customLogoUrl}
                size={48}
                className="rounded-tl-xl rounded-br-xl rounded-tr-xs rounded-bl-xs shadow-xs"
              />
            </div>

            {/* Segmented Mode Control */}
            <div className="mt-4 grid grid-cols-3 gap-1 p-1 bg-white/85 backdrop-blur-xs border border-purple-200/60 rounded-xl">
              <button
                type="button"
                onClick={() => setFormTab('edit')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer',
                  formTab === 'edit'
                    ? 'bg-[#5e438f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <UserCheck className="w-4 h-4 shrink-0" />
                <span className="truncate">Ubah Data Kartu</span>
              </button>
              <button
                type="button"
                onClick={() => setFormTab('new')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer',
                  formTab === 'new'
                    ? 'bg-[#5e438f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span className="truncate">Tambah Peserta Baru</span>
              </button>
              <button
                type="button"
                onClick={() => setFormTab('event')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer',
                  formTab === 'event'
                    ? 'bg-[#5e438f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <SlidersHorizontal className="w-4 h-4 shrink-0" />
                <span className="truncate">Acara & Logo</span>
              </button>
            </div>
          </div>

          <div className="p-6">
            {toastMessage && (
              <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-900 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{toastMessage}</span>
              </div>
            )}

            {/* TAB 1: UNIFIED CARD & PARTICIPANT EDITOR */}
            {formTab === 'edit' && selectedParticipant && (
              <form onSubmit={handleSaveParticipantAndCard} className="space-y-6">
                {/* Section A: Data Diri Peserta pada Kartu */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-[#2b1b47]">
                        1. Data Diri Peserta pada Kartu
                      </h3>
                      <p className="text-xs text-slate-500">
                        Sedang mengedit kartu milik{' '}
                        <span className="font-semibold text-slate-700">
                          {selectedParticipant.name}
                        </span>
                      </p>
                    </div>
                    {participants.length > 1 && (
                      <button
                        type="button"
                        onClick={handleDeleteCurrentParticipant}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        title="Hapus peserta ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus Peserta
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Lengkap & Gelar
                      </label>
                      <input
                        ref={editNameInputRef}
                        type="text"
                        required
                        value={draftName}
                        onChange={(e) => handleParticipantFieldChange('name', e.target.value)}
                        placeholder="Masukkan nama lengkap peserta..."
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        No. / ID Presensi (QR)
                      </label>
                      <input
                        type="text"
                        required
                        value={draftId}
                        onChange={(e) => setDraftId(e.target.value.toUpperCase())}
                        placeholder="HY-001"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Peran / Kategori Kartu
                      </label>
                      <input
                        type="text"
                        value={draftRole}
                        onChange={(e) => handleParticipantFieldChange('role', e.target.value)}
                        placeholder="Peserta Workshop / VIP"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Institusi / Afiliasi
                      </label>
                      <input
                        type="text"
                        value={draftInstitution}
                        onChange={(e) =>
                          handleParticipantFieldChange('institution', e.target.value)
                        }
                        placeholder="Nama institusi..."
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Status Presensi
                      </label>
                      <select
                        value={draftStatus}
                        onChange={(e) => handleParticipantFieldChange('status', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      >
                        <option value="PENDING">PENDING (Belum Hadir)</option>
                        <option value="PRESENT">PRESENT (Hadir Tepat Waktu)</option>
                        <option value="LATE">LATE (Hadir Terlambat)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Alamat Email
                      </label>
                      <input
                        type="email"
                        value={draftEmail}
                        onChange={(e) => handleParticipantFieldChange('email', e.target.value)}
                        placeholder="email@institusi.com"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        No. WhatsApp / Kontak (Opsional)
                      </label>
                      <input
                        type="text"
                        value={draftPhone}
                        onChange={(e) => handleParticipantFieldChange('phone', e.target.value)}
                        placeholder="Contoh: 0812-3456-7890"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Section B: Informasi Acara & Header Kartu */}
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#2b1b47]">
                      2. Informasi Acara Workshop & Teks Kartu
                    </h3>
                    <p className="text-xs text-slate-500">
                      Ubah judul workshop, tanggal, jam, lokasi, serta subjudul header kartu
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Judul Acara Workshop
                      </label>
                      <input
                        ref={editEventInputRef}
                        type="text"
                        value={draftEventName}
                        onChange={(e) => {
                          setDraftEventName(e.target.value);
                          updateConfig({ name: e.target.value });
                        }}
                        placeholder="Contoh: Self Healing and Flower Arranging"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tempat / Lokasi Acara
                      </label>
                      <input
                        type="text"
                        value={draftLocation}
                        onChange={(e) => {
                          setDraftLocation(e.target.value);
                          updateConfig({ location: e.target.value });
                        }}
                        placeholder="Contoh: Grand Ballroom, Hotel Mulia"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tanggal Acara
                      </label>
                      <input
                        type="date"
                        value={draftDate}
                        onChange={(e) => {
                          setDraftDate(e.target.value);
                          updateConfig({ date: e.target.value });
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Jam Mulai
                      </label>
                      <input
                        type="time"
                        value={draftTime}
                        onChange={(e) => {
                          setDraftTime(e.target.value);
                          const combined = new Date(`${draftDate || config.date}T${e.target.value}:00`);
                          if (!isNaN(combined.getTime())) {
                            updateConfig({ startTime: combined.toISOString() });
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Subjudul Header
                      </label>
                      <input
                        ref={editOrganizerInputRef}
                        type="text"
                        value={draftOrganizer}
                        onChange={(e) => {
                          setDraftOrganizer(e.target.value);
                          updateConfig({ organizer: e.target.value });
                        }}
                        placeholder="Muslimah Healing Journey"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tagline Kartu
                      </label>
                      <input
                        type="text"
                        value={draftTagline}
                        onChange={(e) => {
                          setDraftTagline(e.target.value);
                          updateConfig({ tagline: e.target.value });
                        }}
                        placeholder="Let's Heal"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    Tips: Anda juga dapat mengklik langsung bagian teks pada gambar kartu di kanan untuk mengeditnya.
                  </p>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl shadow-xs hover:opacity-95 transition-opacity cursor-pointer shrink-0"
                    style={{
                      background:
                        'linear-gradient(115deg, #7c52b8 0%, #6b63c9 50%, #587cd9 100%)',
                    }}
                  >
                    <Check className="w-4 h-4" />
                    Simpan Perubahan Kartu
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: TAMBAH PESERTA BARU */}
            {formTab === 'new' && (
              <form onSubmit={handleCreateParticipant} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="reg-name"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Nama Lengkap & Gelar
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Contoh: Dr. Aisyah Putri, M.Psi., Psikolog"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-custom-id"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      ID Presensi (Opsional)
                    </label>
                    <input
                      id="reg-custom-id"
                      type="text"
                      value={newCustomId}
                      onChange={(e) => setNewCustomId(e.target.value.toUpperCase())}
                      placeholder="Otomatis (mis. HY-009)"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="reg-role"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Peran / Kategori
                    </label>
                    <input
                      id="reg-role"
                      type="text"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      placeholder="Peserta Workshop"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-institution"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Institusi / Afiliasi
                    </label>
                    <input
                      id="reg-institution"
                      type="text"
                      required
                      value={newInstitution}
                      onChange={(e) => setNewInstitution(e.target.value)}
                      placeholder="Fakultas Psikologi / Klinik"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="reg-email"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Alamat Email
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-phone"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      No. WhatsApp / Kontak
                    </label>
                    <input
                      id="reg-phone"
                      type="text"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="0812-xxxx-xxxx"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    Peserta baru otomatis mendapatkan Kartu Tanda Pengenal bertema Heal You.
                  </p>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-opacity hover:opacity-95 cursor-pointer shrink-0 shadow-xs"
                    style={{
                      background:
                        'linear-gradient(115deg, #7c52b8 0%, #6b63c9 50%, #587cd9 100%)',
                    }}
                  >
                    <QrCode className="w-4 h-4" />
                    Simpan & Buat Kartu Pengenal
                  </button>
                </div>

                {/* Bulk Import Section inside Tab 2 */}
                <div className="mt-6 pt-5 border-t border-slate-100">
                  <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#2b1b47] flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-[#5e438f]" />
                        Impor Banyak Peserta Sekaligus (Excel / CSV)
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Unggah daftar peserta dari Excel/Google Forms. ID Presensi (<span className="font-mono">HY-xxx</span>) akan dibuat otomatis.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleDownloadImportTemplate}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Unduh Template
                      </button>
                      <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#5e438f] hover:bg-[#4c3575] rounded-lg transition-colors cursor-pointer shadow-2xs">
                        <Upload className="w-3.5 h-3.5" />
                        Pilih File Excel / CSV
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleImportExcelFile}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 3: PENGATURAN ACARA & LOGO KARTU */}
            {formTab === 'event' && (
              <form onSubmit={handleSaveEventConfig} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Nama Acara Workshop
                    </label>
                    <input
                      type="text"
                      value={draftEventName}
                      onChange={(e) => {
                        setDraftEventName(e.target.value);
                        updateConfig({ name: e.target.value });
                      }}
                      placeholder="Nama acara workshop..."
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Label Kategori Acara pada Kartu
                    </label>
                    <input
                      type="text"
                      value={draftEventLabel}
                      onChange={(e) => {
                        setDraftEventLabel(e.target.value);
                        updateConfig({ eventLabel: e.target.value });
                      }}
                      placeholder="Agenda Workshop Psikologi"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Subjudul Organisasi / Header
                    </label>
                    <input
                      type="text"
                      value={draftOrganizer}
                      onChange={(e) => {
                        setDraftOrganizer(e.target.value);
                        updateConfig({ organizer: e.target.value });
                      }}
                      placeholder="Muslimah Healing Journey"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Tagline Kartu
                    </label>
                    <input
                      type="text"
                      value={draftTagline}
                      onChange={(e) => {
                        setDraftTagline(e.target.value);
                        updateConfig({ tagline: e.target.value });
                      }}
                      placeholder="Let's Heal"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Tanggal Acara
                    </label>
                    <input
                      type="date"
                      value={draftDate}
                      onChange={(e) => {
                        setDraftDate(e.target.value);
                        updateConfig({ date: e.target.value });
                      }}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Jam Mulai
                    </label>
                    <input
                      type="time"
                      value={draftTime}
                      onChange={(e) => {
                        setDraftTime(e.target.value);
                        const combined = new Date(`${draftDate || config.date}T${e.target.value}:00`);
                        if (!isNaN(combined.getTime())) {
                          updateConfig({ startTime: combined.toISOString() });
                        }
                      }}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Tempat / Lokasi
                    </label>
                    <input
                      type="text"
                      value={draftLocation}
                      onChange={(e) => {
                        setDraftLocation(e.target.value);
                        updateConfig({ location: e.target.value });
                      }}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                </div>

                {/* Custom Logo Upload Option */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <HealYouLogo
                      customLogoUrl={config.customLogoUrl}
                      size={44}
                      className="rounded-tl-xl rounded-br-xl rounded-tr-xs rounded-bl-xs border border-purple-200"
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        Logo Heal You pada Kartu Pengenal
                      </p>
                      <p className="text-xs text-slate-500">
                        Logo bawaan Heal You sudah terpasang. Anda juga dapat mengunggah file gambar logo sendiri.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {config.customLogoUrl && (
                      <button
                        type="button"
                        onClick={() => updateConfig({ customLogoUrl: undefined })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Logo
                      </button>
                    )}
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#5e438f] bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      Ganti File Logo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
                    style={{
                      background:
                        'linear-gradient(115deg, #7c52b8 0%, #6b63c9 50%, #587cd9 100%)',
                    }}
                  >
                    <Check className="w-4 h-4" />
                    Simpan Pengaturan Acara
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Participant Directory List */}
        <div className="bg-white rounded-2xl border border-purple-100 shadow-xs overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Daftar Peserta ({participants.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Klik peserta untuk memilih kartu, atau gunakan aksi massal di kanan
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label
                  title="Impor daftar peserta dari file Excel (.xlsx) atau CSV"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#5e438f] bg-purple-50 hover:bg-purple-100 border border-purple-200/80 rounded-lg transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Impor Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImportExcelFile}
                    className="sr-only"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#5e438f] hover:bg-[#4c3575] rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Cetak Semua Kartu ({participants.length})
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama peserta, ID (HY-...), atau institusi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 w-full"
              />
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {filteredParticipants.map((p) => {
              const isSelected = selectedParticipant?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedId(p.id);
                    setFormTab('edit');
                  }}
                  className={cn(
                    'w-full text-left px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 transition-colors cursor-pointer',
                    isSelected ? 'bg-purple-50/80' : 'hover:bg-slate-50'
                  )}
                >
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-sm font-semibold break-words sm:truncate',
                        isSelected ? 'text-[#2b1b47]' : 'text-slate-900'
                      )}
                    >
                      {p.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                      <span className="font-mono tabular-nums font-medium text-[#6b4c8c] shrink-0">
                        {p.id}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{p.role || 'Peserta Workshop'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[200px] sm:max-w-[260px]">{p.institution}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                      href={buildWhatsAppUrl(p, config)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={
                        p.phone
                          ? `Kirim info tiket via WhatsApp (${p.phone})`
                          : 'Kirim info tiket via WhatsApp'
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/70 rounded-lg transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-3 h-3" />
                      Kirim WA
                    </a>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        focusEditorSection('participant', p.id);
                      }}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer',
                        isSelected
                          ? 'bg-[#5e438f] text-white'
                          : 'text-[#5e438f] bg-purple-50 hover:bg-purple-100'
                      )}
                    >
                      <Pencil className="w-3 h-3" />
                      Edit Data
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredParticipants.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">
                Tidak ada peserta yang cocok dengan pencarian.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Interactive Couture Editorial Heal You ID Badge */}
      <div className="lg:col-span-5">
        <div className="sticky top-22 flex flex-col items-center">
          {selectedParticipant ? (
            <div
              className="w-full max-w-md rounded-[36px] p-5 sm:p-6 shadow-xl relative overflow-hidden"
              style={{
                background:
                  'linear-gradient(160deg, #f2cbfc 0%, #d5c4fc 30%, #b8d0ff 62%, #ede8ff 100%)',
              }}
            >
              {/* Subtle Inner Couture Frame Line */}
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

              {/* Centered Symmetrical Couture Header (Click to edit header text) */}
              <div
                onClick={() => focusEditorSection('header')}
                title="Klik untuk mengubah teks header kartu"
                className="relative flex flex-col items-center text-center mb-5 cursor-pointer group rounded-2xl py-1 transition-colors hover:bg-white/20"
              >
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

              {/* Porcelain Sanctuary Sheet with Double Filigree Border */}
              <div className="relative bg-white/90 backdrop-blur-md rounded-[26px] p-2 sm:p-2.5 border border-white shadow-sm">
                <div className="rounded-[20px] border border-[#b49ae6]/30 px-3.5 sm:px-5 py-5 sm:py-6 text-center flex flex-col items-center">
                  {/* Participant Data Section (Click to edit participant) */}
                  <div
                    onClick={() => focusEditorSection('participant')}
                    title="Klik untuk mengubah data diri peserta"
                    className="w-full cursor-pointer rounded-xl py-1 px-1 sm:px-2 transition-colors hover:bg-purple-50/60"
                  >
                    <span className="block text-[10px] font-semibold tracking-[0.2em] uppercase text-[#7c5bb0] break-words">
                      {displayParticipantRole}
                    </span>

                    <h3
                      className="mt-1.5 text-2xl sm:text-[31px] font-bold text-[#1f1235] leading-tight break-words"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      {displayParticipantName}
                    </h3>

                    <p className="mt-1 text-xs sm:text-[13px] font-medium text-[#4a3b69] break-words">
                      {displayParticipantInst}
                    </p>
                    <p className="mt-0.5 text-[11px] sm:text-xs text-[#7c6f99] break-all sm:break-words">
                      {displayParticipantEmail}
                      {displayParticipantPhone ? `  ·  ${displayParticipantPhone}` : ''}
                    </p>
                  </div>

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

                  {/* Workshop Event Block (Click to edit event) */}
                  <div
                    onClick={() => focusEditorSection('event')}
                    title="Klik untuk mengubah data acara workshop"
                    className="w-full cursor-pointer rounded-xl py-1 px-2 transition-colors hover:bg-purple-50/60 flex flex-col items-center"
                  >
                    <p
                      className="text-sm italic font-semibold text-[#8b6fc9]"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      {displayEventLabel}
                    </p>
                    <h4
                      className="mt-0.5 text-lg sm:text-[21px] font-bold text-[#261742] leading-snug max-w-xs"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      {displayEventName}
                    </h4>
                    <p className="mt-1.5 text-xs font-medium text-[#52436e]">
                      {formatSafeDate(displayDate, 'dd MMMM yyyy')} &nbsp;·&nbsp; Pukul{' '}
                      {displayTime} WIB
                    </p>
                    <p className="mt-1 text-[11px] font-medium tracking-[0.12em] uppercase text-[#7c6f99]">
                      {displayLocation}
                    </p>
                  </div>

                  {/* Framed QR Code Medallion with Center Heal You Logo */}
                  <div className="mt-4 relative p-3 bg-white rounded-2xl border border-[#dcd0ff] shadow-2xs flex items-center justify-center">
                    <div ref={qrContainerRef} className="relative flex items-center justify-center">
                      <QRCodeCanvas
                        value={displayParticipantId}
                        size={320}
                        level="H"
                        minVersion={4}
                        marginSize={2}
                        fgColor="#261742"
                        bgColor="#ffffff"
                        style={{ width: 168, height: 168 }}
                        imageSettings={{
                          src: config.customLogoUrl || HEAL_YOU_DATA_URI,
                          height: 60,
                          width: 60,
                          excavate: true,
                        }}
                      />
                      {/* Crisp Leaf-Shaped Center Logo Overlay matching excavated zone */}
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

                  {/* Registration ID & Quiet Caption */}
                  <p className="mt-4 text-[11px] font-semibold tracking-[0.2em] uppercase text-[#4c3575]">
                    No. Presensi &nbsp;·&nbsp; {displayParticipantId}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8b7fa8]">
                    Tunjukkan kartu ini pada meja registrasi untuk pemindaian kehadiran
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Action Buttons Under Card */}
          {selectedParticipant && (
            <div className="w-full max-w-md mt-4 flex flex-col gap-2.5">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadIdCard}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl font-semibold text-sm shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
                  style={{
                    background:
                      'linear-gradient(115deg, #7c52b8 0%, #6b63c9 50%, #587cd9 100%)',
                  }}
                >
                  <Download className="w-4 h-4" />
                  Unduh Kartu Ini (PNG)
                </button>
                <button
                  type="button"
                  onClick={() => focusEditorSection('participant')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-white hover:bg-purple-50 text-[#5e438f] border border-purple-200 rounded-xl font-medium text-sm transition-colors cursor-pointer shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Ubah Data Kartu
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <a
                  href={buildWhatsAppUrl(selectedParticipant, config)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-2xs transition-colors cursor-pointer"
                  title={
                    selectedParticipant.phone
                      ? `Buka chat WhatsApp ke ${selectedParticipant.phone}`
                      : 'Kirim undangan & detail kartu via WhatsApp'
                  }
                >
                  <MessageCircle className="w-4 h-4" />
                  1-Klik Kirim via WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => void handleCopyWaMessage(selectedParticipant)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-medium text-xs sm:text-sm transition-colors cursor-pointer shrink-0"
                  title="Salin teks pesan undangan WhatsApp ke clipboard"
                >
                  {copiedWa ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Teks Tersalin!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Salin Pesan WA
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-[#4c3575] border border-purple-200/80 rounded-xl font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-[#5e438f]" />
                  Cetak Semua ({participants.length} Kartu A4)
                </button>
                <button
                  type="button"
                  onClick={() => setIsWaBroadcastOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl font-semibold text-xs sm:text-sm transition-colors cursor-pointer shrink-0"
                  title="Kirim ke semua nomor WhatsApp peserta secara beruntun"
                >
                  <MessageCircle className="w-4 h-4 text-teal-600" />
                  Broadcast Semua WA
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <BatchPrintModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        participants={participants}
        config={config}
      />

      <WhatsAppBroadcastModal
        isOpen={isWaBroadcastOpen}
        onClose={() => setIsWaBroadcastOpen(false)}
        participants={participants}
        config={config}
      />
    </div>
  );
};
