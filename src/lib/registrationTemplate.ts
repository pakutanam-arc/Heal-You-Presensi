export interface RegistrationFormTemplate {
  shareLinkSlug: string;
  participantQuota: number;
  certificateClaimAdminApproved?: boolean;
  // Section 1: Kartu Undangan Acara ("Muslimah Healing Day! 🌷")
  invitationTitle: string;
  greetingText: string;
  introParagraph1: string;
  introParagraph2: string;
  saveTheDateTitle: string;
  dateDisplay: string;
  timeDisplay: string;
  locationDisplay: string;
  dresscodeDisplay: string;
  benefitTitle: string;
  benefitItems: string[];
  closingCallout: string;
  closingQuote: string;

  // Section 2: 4 Pertanyaan Utama (Tersinkronisasi ke Kartu QR & E-Sertifikat)
  q1NameLabel: string;
  q1NamePlaceholder: string;
  q2PhoneLabel: string;
  q2PhonePlaceholder: string;
  q3RoleLabel: string;
  q3RolePlaceholder: string;
  q4DomicileLabel: string;
  q4DomicilePlaceholder: string;

  // Section 3: Pertanyaan Interaktif & Healing (Q5 - Q11)
  q5FeelingLabel: string;
  q5FeelingOptions: string[];

  q6FollowLabel: string;
  q6FollowLinkText: string;
  q6FollowLinkUrl: string;
  q6FollowOptions: string[];

  q7WoundLabel: string;
  q7WoundSubLabel: string;
  q7WoundOptions: string[];
  q7AllowOther: boolean;

  q8HopeLabel: string;
  q8HopePlaceholder: string;

  q9TransferEnabled: boolean;
  q9TransferLabel: string;
  q9BankName: string;
  q9BankAccount: string;
  q9BankHolder: string;
  paymentAccessCodeRequired: boolean;
  masterPaymentAccessCode: string;
  adminConfirmationWhatsapp: string;

  q10SupporterEnabled: boolean;
  q10SupporterLabel: string;
  q10SupporterLinkText: string;
  q10SupporterLinkUrl: string;
  q10SupporterOptions: string[];

  q11CommitmentLabel: string;
  q11CommitmentOptions: string[];

  submitButtonText: string;
}

export const DEFAULT_REGISTRATION_FORM_TEMPLATE: RegistrationFormTemplate = {
  shareLinkSlug: 'HealYou-Pendaftaran',
  participantQuota: 30,
  certificateClaimAdminApproved: false,
  invitationTitle: 'Muslimah Healing Day! 🌷',
  greetingText: "Assalamu'alaikum, Shalihah! 💕",
  introParagraph1: 'Pernah merasa lelah dan butuh me-time yang menenangkan?',
  introParagraph2:
    'Yuk, luangkan waktu untuk diri sendiri di Hari Kesehatan Mental Sedunia dalam "Muslimah Healing Day!" workshop merangkai bunga + self healing yang insyaAllah will soothe your heart and refresh your soul 💐✨',
  saveTheDateTitle: 'Save the date:',
  dateDisplay: '🗓️ Sabtu, 10 Oktober 2026',
  timeDisplay: '⏰ 13.00 – Selesai',
  locationDisplay: '📍 J Chicken Tole, Depok',
  dresscodeDisplay: '👗 Dresscode: Soft pink / Cream / White',
  benefitTitle: 'Benefit yang kamu dapat:',
  benefitItems: [
    '🍗 Lunch J Chicken',
    '🎁 Goodie bag dari supporter event',
    '💐 Bouquet Flower karya tangan sendiri',
    '📝 Worksheet regulasi emosi (Trigger Innerchild)',
    '🌷 Hadiah Games',
    '👭 Relasi baru yang positif dan suportif',
    '💌 E-Sertifikat resmi terverifikasi Barcode',
  ],
  closingCallout:
    'Yuk daftar sekarang dan hadiahkan dirimu hari penuh ketenangan dan makna 🌸',
  closingQuote: '"Take a pause, breathe with flower, and heal with us"',

  q1NameLabel: 'Siapa Nama kamu di Bumi? 😊💕',
  q1NamePlaceholder: 'Jawaban Anda',
  q2PhoneLabel: 'No Whatsapp kamu? 📞',
  q2PhonePlaceholder: 'Jawaban Anda',
  q3RoleLabel: 'Pekerjaan / Kegiatan favorite-mu? 💕',
  q3RolePlaceholder: 'Jawaban Anda',
  q4DomicileLabel: 'Dibumi sebelah mana kamu tinggal? 🌏🌱',
  q4DomicilePlaceholder: 'Tempat tinggal / domisili (contoh: Depok, Jakarta Selatan)',

  q5FeelingLabel: 'Gimana perasaan kamu sebelum ikut acara ini? 🌷',
  q5FeelingOptions: [
    'Senang dan antusias! 😍',
    'Butuh ketenangan & me-time 🤍',
    'Lelah dan ingin recharge energi 🌱',
    'Penasaran & ingin mencoba hal baru ✨',
  ],

  q6FollowLabel: 'Sudah follow @Healyou.official belum? 🤩',
  q6FollowLinkText: 'Klik untuk follow',
  q6FollowLinkUrl: 'https://www.instagram.com/healyou.official',
  q6FollowOptions: ['Sudah dong :)'],

  q7WoundLabel: 'Luka apa yang kamu harap bisa sembuh dalam dirimu? 🖤',
  q7WoundSubLabel: '(Biar bisa aku aminin hehe) 🤩',
  q7WoundOptions: [
    'Trauma masa lalu',
    'Kekecewaan',
    'Marah yang terpendam',
    'Anxiety',
    'Tidak percaya diri',
  ],
  q7AllowOther: true,

  q8HopeLabel: 'Harapan atau doa yang ingin kamu capai dari acara ini? 🌷🤍',
  q8HopePlaceholder: 'Jawaban Anda',

  q9TransferEnabled: true,
  q9TransferLabel: 'Bukti Transfer (Early bird 2 Rp.179k) 🌷',
  q9BankName: 'BSI',
  q9BankAccount: '890-1562-030',
  q9BankHolder: 'a/n MAYANK INTAMI',
  paymentAccessCodeRequired: true,
  masterPaymentAccessCode: 'HEALYOU2026',
  adminConfirmationWhatsapp: '085772904491',

  q10SupporterEnabled: true,
  q10SupporterLabel:
    'Supporter kami skincare For Her mau kasih gift untuk yang follow instagram nya, kamu mau ngga? 🤩',
  q10SupporterLinkText: 'Klik untuk follow!',
  q10SupporterLinkUrl: 'https://www.instagram.com/',
  q10SupporterOptions: [
    'Sudah follow ya! 😊',
    'Otw meluncur! 🛸',
    'Ngga dulu deh',
  ],

  q11CommitmentLabel:
    'Dengan mengisi form ini, saya siap ikut serta dalam Muslimah Healing Day, memberi ruang jeda & aman untuk diri saya serta siap menerima kebaikan di hari itu 🌸',
  q11CommitmentOptions: [
    'Siap, insyaAllah! 🌸',
    'Bismillah, hadir dengan hati yang lapang 🤍',
  ],

  submitButtonText: 'Kirim Formulir & Terbitkan Kartu Pengenal QR 🌸',
};

const TEMPLATE_STORAGE_PREFIX = 'healyou_reg_form_template_v1_';

export function getTemplateStorageKey(workshopId: string): string {
  return `${TEMPLATE_STORAGE_PREFIX}${workshopId || 'main'}`;
}

export function normalizeRegistrationTemplate(
  raw?: Partial<RegistrationFormTemplate> | null
): RegistrationFormTemplate {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_REGISTRATION_FORM_TEMPLATE };
  }
  const d = DEFAULT_REGISTRATION_FORM_TEMPLATE;
  return {
    shareLinkSlug:
      typeof raw.shareLinkSlug === 'string' && raw.shareLinkSlug.trim()
        ? raw.shareLinkSlug.trim().replace(/\s+/g, '-')
        : d.shareLinkSlug,
    participantQuota:
      typeof raw.participantQuota === 'number' &&
      Number.isFinite(raw.participantQuota) &&
      raw.participantQuota >= 1
        ? Math.round(raw.participantQuota)
        : d.participantQuota,
    certificateClaimAdminApproved:
      typeof raw.certificateClaimAdminApproved === 'boolean'
        ? raw.certificateClaimAdminApproved
        : Boolean(d.certificateClaimAdminApproved),
    invitationTitle:
      typeof raw.invitationTitle === 'string' && raw.invitationTitle.trim()
        ? raw.invitationTitle
        : d.invitationTitle,
    greetingText:
      typeof raw.greetingText === 'string' ? raw.greetingText : d.greetingText,
    introParagraph1:
      typeof raw.introParagraph1 === 'string' ? raw.introParagraph1 : d.introParagraph1,
    introParagraph2:
      typeof raw.introParagraph2 === 'string' ? raw.introParagraph2 : d.introParagraph2,
    saveTheDateTitle:
      typeof raw.saveTheDateTitle === 'string' && raw.saveTheDateTitle.trim()
        ? raw.saveTheDateTitle
        : d.saveTheDateTitle,
    dateDisplay:
      typeof raw.dateDisplay === 'string' && raw.dateDisplay.trim()
        ? raw.dateDisplay
        : d.dateDisplay,
    timeDisplay:
      typeof raw.timeDisplay === 'string' && raw.timeDisplay.trim()
        ? raw.timeDisplay
        : d.timeDisplay,
    locationDisplay:
      typeof raw.locationDisplay === 'string' && raw.locationDisplay.trim()
        ? raw.locationDisplay
        : d.locationDisplay,
    dresscodeDisplay:
      typeof raw.dresscodeDisplay === 'string' ? raw.dresscodeDisplay : d.dresscodeDisplay,
    benefitTitle:
      typeof raw.benefitTitle === 'string' && raw.benefitTitle.trim()
        ? raw.benefitTitle
        : d.benefitTitle,
    benefitItems:
      Array.isArray(raw.benefitItems) && raw.benefitItems.length > 0
        ? raw.benefitItems.map((s) => String(s)).filter((s) => s.trim().length > 0)
        : [...d.benefitItems],
    closingCallout:
      typeof raw.closingCallout === 'string' ? raw.closingCallout : d.closingCallout,
    closingQuote:
      typeof raw.closingQuote === 'string' ? raw.closingQuote : d.closingQuote,

    q1NameLabel:
      typeof raw.q1NameLabel === 'string' && raw.q1NameLabel.trim()
        ? raw.q1NameLabel
        : d.q1NameLabel,
    q1NamePlaceholder:
      typeof raw.q1NamePlaceholder === 'string' && raw.q1NamePlaceholder.trim()
        ? raw.q1NamePlaceholder
        : d.q1NamePlaceholder,
    q2PhoneLabel:
      typeof raw.q2PhoneLabel === 'string' && raw.q2PhoneLabel.trim()
        ? raw.q2PhoneLabel
        : d.q2PhoneLabel,
    q2PhonePlaceholder:
      typeof raw.q2PhonePlaceholder === 'string' && raw.q2PhonePlaceholder.trim()
        ? raw.q2PhonePlaceholder
        : d.q2PhonePlaceholder,
    q3RoleLabel:
      typeof raw.q3RoleLabel === 'string' && raw.q3RoleLabel.trim()
        ? raw.q3RoleLabel
        : d.q3RoleLabel,
    q3RolePlaceholder:
      typeof raw.q3RolePlaceholder === 'string' && raw.q3RolePlaceholder.trim()
        ? raw.q3RolePlaceholder
        : d.q3RolePlaceholder,
    q4DomicileLabel:
      typeof raw.q4DomicileLabel === 'string' && raw.q4DomicileLabel.trim()
        ? raw.q4DomicileLabel
        : d.q4DomicileLabel,
    q4DomicilePlaceholder:
      typeof raw.q4DomicilePlaceholder === 'string' && raw.q4DomicilePlaceholder.trim()
        ? raw.q4DomicilePlaceholder
        : d.q4DomicilePlaceholder,

    q5FeelingLabel:
      typeof raw.q5FeelingLabel === 'string' && raw.q5FeelingLabel.trim()
        ? raw.q5FeelingLabel
        : d.q5FeelingLabel,
    q5FeelingOptions:
      Array.isArray(raw.q5FeelingOptions) && raw.q5FeelingOptions.length > 0
        ? raw.q5FeelingOptions.map((s) => String(s)).filter((s) => s.trim().length > 0)
        : [...d.q5FeelingOptions],

    q6FollowLabel:
      typeof raw.q6FollowLabel === 'string' && raw.q6FollowLabel.trim()
        ? raw.q6FollowLabel
        : d.q6FollowLabel,
    q6FollowLinkText:
      typeof raw.q6FollowLinkText === 'string' ? raw.q6FollowLinkText : d.q6FollowLinkText,
    q6FollowLinkUrl:
      typeof raw.q6FollowLinkUrl === 'string' && raw.q6FollowLinkUrl.trim()
        ? raw.q6FollowLinkUrl
        : d.q6FollowLinkUrl,
    q6FollowOptions:
      Array.isArray(raw.q6FollowOptions) && raw.q6FollowOptions.length > 0
        ? raw.q6FollowOptions.map((s) => String(s)).filter((s) => s.trim().length > 0)
        : [...d.q6FollowOptions],

    q7WoundLabel:
      typeof raw.q7WoundLabel === 'string' && raw.q7WoundLabel.trim()
        ? raw.q7WoundLabel
        : d.q7WoundLabel,
    q7WoundSubLabel:
      typeof raw.q7WoundSubLabel === 'string' ? raw.q7WoundSubLabel : d.q7WoundSubLabel,
    q7WoundOptions:
      Array.isArray(raw.q7WoundOptions) && raw.q7WoundOptions.length > 0
        ? raw.q7WoundOptions.map((s) => String(s)).filter((s) => s.trim().length > 0)
        : [...d.q7WoundOptions],
    q7AllowOther:
      typeof raw.q7AllowOther === 'boolean' ? raw.q7AllowOther : d.q7AllowOther,

    q8HopeLabel:
      typeof raw.q8HopeLabel === 'string' && raw.q8HopeLabel.trim()
        ? raw.q8HopeLabel
        : d.q8HopeLabel,
    q8HopePlaceholder:
      typeof raw.q8HopePlaceholder === 'string' && raw.q8HopePlaceholder.trim()
        ? raw.q8HopePlaceholder
        : d.q8HopePlaceholder,

    q9TransferEnabled:
      typeof raw.q9TransferEnabled === 'boolean'
        ? raw.q9TransferEnabled
        : d.q9TransferEnabled,
    q9TransferLabel:
      typeof raw.q9TransferLabel === 'string' && raw.q9TransferLabel.trim()
        ? raw.q9TransferLabel
        : d.q9TransferLabel,
    q9BankName:
      typeof raw.q9BankName === 'string' && raw.q9BankName.trim()
        ? raw.q9BankName
        : d.q9BankName,
    q9BankAccount:
      typeof raw.q9BankAccount === 'string' && raw.q9BankAccount.trim()
        ? raw.q9BankAccount
        : d.q9BankAccount,
    q9BankHolder:
      typeof raw.q9BankHolder === 'string' && raw.q9BankHolder.trim()
        ? raw.q9BankHolder
        : d.q9BankHolder,
    paymentAccessCodeRequired:
      typeof raw.paymentAccessCodeRequired === 'boolean'
        ? raw.paymentAccessCodeRequired
        : d.paymentAccessCodeRequired,
    masterPaymentAccessCode:
      typeof raw.masterPaymentAccessCode === 'string' && raw.masterPaymentAccessCode.trim()
        ? raw.masterPaymentAccessCode.trim().toUpperCase()
        : d.masterPaymentAccessCode,
    adminConfirmationWhatsapp:
      typeof raw.adminConfirmationWhatsapp === 'string' &&
      raw.adminConfirmationWhatsapp.trim() &&
      raw.adminConfirmationWhatsapp.trim() !== '081234567890'
        ? raw.adminConfirmationWhatsapp.trim()
        : d.adminConfirmationWhatsapp,

    q10SupporterEnabled:
      typeof raw.q10SupporterEnabled === 'boolean'
        ? raw.q10SupporterEnabled
        : d.q10SupporterEnabled,
    q10SupporterLabel:
      typeof raw.q10SupporterLabel === 'string' && raw.q10SupporterLabel.trim()
        ? raw.q10SupporterLabel
        : d.q10SupporterLabel,
    q10SupporterLinkText:
      typeof raw.q10SupporterLinkText === 'string'
        ? raw.q10SupporterLinkText
        : d.q10SupporterLinkText,
    q10SupporterLinkUrl:
      typeof raw.q10SupporterLinkUrl === 'string' && raw.q10SupporterLinkUrl.trim()
        ? raw.q10SupporterLinkUrl
        : d.q10SupporterLinkUrl,
    q10SupporterOptions:
      Array.isArray(raw.q10SupporterOptions) && raw.q10SupporterOptions.length > 0
        ? raw.q10SupporterOptions.map((s) => String(s)).filter((s) => s.trim().length > 0)
        : [...d.q10SupporterOptions],

    q11CommitmentLabel:
      typeof raw.q11CommitmentLabel === 'string' && raw.q11CommitmentLabel.trim()
        ? raw.q11CommitmentLabel
        : d.q11CommitmentLabel,
    q11CommitmentOptions:
      Array.isArray(raw.q11CommitmentOptions) && raw.q11CommitmentOptions.length > 0
        ? raw.q11CommitmentOptions.map((s) => String(s)).filter((s) => s.trim().length > 0)
        : [...d.q11CommitmentOptions],

    submitButtonText:
      typeof raw.submitButtonText === 'string' && raw.submitButtonText.trim()
        ? raw.submitButtonText
        : d.submitButtonText,
  };
}

export function loadRegistrationTemplate(workshopId: string = 'main'): RegistrationFormTemplate {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_REGISTRATION_FORM_TEMPLATE };
  }

  // First check if URL has encoded template overrides (?ft=...)
  try {
    const params = new URLSearchParams(window.location.search);
    const ftParam = params.get('ft');
    if (ftParam) {
      const decodedJson = decodeURIComponent(escape(atob(ftParam)));
      const parsedFromUrl = JSON.parse(decodedJson) as Partial<RegistrationFormTemplate>;
      if (parsedFromUrl && typeof parsedFromUrl === 'object') {
        const merged = normalizeRegistrationTemplate(parsedFromUrl);
        localStorage.setItem(getTemplateStorageKey(workshopId), JSON.stringify(merged));
        return merged;
      }
    }
  } catch {
    // Ignore invalid URL param
  }

  try {
    const raw = localStorage.getItem(getTemplateStorageKey(workshopId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RegistrationFormTemplate>;
      return normalizeRegistrationTemplate(parsed);
    }
  } catch {
    // Ignore localStorage error
  }

  return { ...DEFAULT_REGISTRATION_FORM_TEMPLATE };
}

export function saveRegistrationTemplate(
  workshopId: string,
  template: RegistrationFormTemplate
): RegistrationFormTemplate {
  const normalized = normalizeRegistrationTemplate(template);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(getTemplateStorageKey(workshopId), JSON.stringify(normalized));
      window.dispatchEvent(
        new CustomEvent('healyou-registration-template-updated', {
          detail: { workshopId, template: normalized },
        })
      );
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('heal_you_portal_sync_v1');
        bc.postMessage({
          type: 'TEMPLATE_UPDATED',
          workshopId,
          quota: normalized.participantQuota,
          certificateClaimAdminApproved: Boolean(normalized.certificateClaimAdminApproved),
        });
        bc.close();
      }
    } catch {
      // Ignore storage quota error
    }
  }
  return normalized;
}

export function resetRegistrationTemplate(workshopId: string): RegistrationFormTemplate {
  const fresh = { ...DEFAULT_REGISTRATION_FORM_TEMPLATE };
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(getTemplateStorageKey(workshopId));
      window.dispatchEvent(
        new CustomEvent('healyou-registration-template-updated', {
          detail: { workshopId, template: fresh },
        })
      );
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('heal_you_portal_sync_v1');
        bc.postMessage({
          type: 'TEMPLATE_UPDATED',
          workshopId,
          quota: fresh.participantQuota,
        });
        bc.close();
      }
    } catch {
      // Ignore
    }
  }
  return fresh;
}

export function encodeTemplateDiffForUrl(template: RegistrationFormTemplate): string | null {
  const d = DEFAULT_REGISTRATION_FORM_TEMPLATE;
  const diff: Partial<RegistrationFormTemplate> = {};
  let hasDiff = false;

  (Object.keys(d) as Array<keyof RegistrationFormTemplate>).forEach((key) => {
    const curVal = template[key];
    const defVal = d[key];
    if (JSON.stringify(curVal) !== JSON.stringify(defVal)) {
      (diff as Record<string, unknown>)[key] = curVal;
      hasDiff = true;
    }
  });

  if (!hasDiff) return null;

  try {
    const json = JSON.stringify(diff);
    return btoa(unescape(encodeURIComponent(json)));
  } catch {
    return null;
  }
}

/**
 * Normalizes a WhatsApp / phone number so that "0812-3456-7890", "+62 812 3456 7890",
 * and "6281234567890" all map to the exact same canonical digit tail ("81234567890").
 */
export function normalizePhoneForPaymentCode(rawPhone: string): string {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('620')) {
    return digits.slice(3);
  }
  if (digits.startsWith('62')) {
    return digits.slice(2);
  }
  if (digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Deterministic Opsi 2 Payment Access Code generator.
 * Produces a unique 6-character code (`HY-XXXX`) bound to the participant's WhatsApp number
 * (or participant ID) and workshop event ID, so a code generated on the Admin's device
 * is 100% valid when entered on the Participant's device.
 */
export function computePaymentAccessCode(
  phoneOrIdentifier: string,
  workshopId: string = 'main'
): string {
  const cleanPhone = normalizePhoneForPaymentCode(phoneOrIdentifier);
  const key = cleanPhone.length >= 6 ? cleanPhone : (phoneOrIdentifier || '').trim().toUpperCase();
  if (!key) return 'HY-2026';

  const payload = `HEALYOU-PAY-V1|${(workshopId || 'main').toUpperCase()}|${key}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + (i * 17);
    h2 = Math.imul(h2, 0x85ebca6b);
  }

  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Unambiguous uppercase chars (no 0/O/1/I)
  const combined = ((h1 >>> 0) ^ (h2 >>> 0)) >>> 0;
  let code = '';
  let val = combined;
  for (let i = 0; i < 4; i++) {
    code += alphabet[val % alphabet.length];
    val = Math.floor(val / alphabet.length) ^ ((h1 >>> (i * 4)) & 0xff);
  }
  return `HY-${code}`;
}

/**
 * Verifies whether an entered payment access code is valid for a given participant's
 * WhatsApp number, Participant ID, or the event's Master Payment PIN.
 */
export function verifyPaymentAccessCode(params: {
  inputCode: string;
  phone: string;
  participantId?: string;
  workshopId?: string;
  masterCode?: string;
}): { valid: boolean; matchedType: 'personal_phone' | 'participant_id' | 'master_pin' | null } {
  const cleanInput = (params.inputCode || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!cleanInput) {
    return { valid: false, matchedType: null };
  }

  const normalizedInputNoDash = cleanInput.replace(/^HY-?/i, 'HY-');
  const evtId = params.workshopId || 'main';

  // 1. Check unique personal code derived from participant's WhatsApp number
  if (params.phone && params.phone.trim().length >= 6) {
    const expectedPhoneCode = computePaymentAccessCode(params.phone, evtId).toUpperCase();
    const expectedPhoneDigitsOnly = expectedPhoneCode.replace('HY-', '');
    if (
      cleanInput === expectedPhoneCode ||
      normalizedInputNoDash === expectedPhoneCode ||
      cleanInput === expectedPhoneDigitsOnly
    ) {
      return { valid: true, matchedType: 'personal_phone' };
    }
  }

  // 2. Check unique code derived from participant ID (e.g. HY-001)
  if (params.participantId && params.participantId.trim()) {
    const expectedIdCode = computePaymentAccessCode(params.participantId, evtId).toUpperCase();
    const expectedIdDigitsOnly = expectedIdCode.replace('HY-', '');
    if (
      cleanInput === expectedIdCode ||
      normalizedInputNoDash === expectedIdCode ||
      cleanInput === expectedIdDigitsOnly
    ) {
      return { valid: true, matchedType: 'participant_id' };
    }
  }

  // 3. Check Master Payment Access Code configured by Admin
  const cleanMaster = (params.masterCode || DEFAULT_REGISTRATION_FORM_TEMPLATE.masterPaymentAccessCode)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (cleanMaster && cleanInput === cleanMaster) {
    return { valid: true, matchedType: 'master_pin' };
  }

  return { valid: false, matchedType: null };
}

const VERIFIED_PAYMENT_STORAGE_PREFIX = 'healyou_verified_payments_v1_';

export interface VerifiedPaymentEntry {
  verified?: boolean;
  verifiedAt: string;
  verifiedBy?: string;
  codeUsed: string;
  proofDataUrl?: string;
  proofFileName?: string;
  submittedAt?: string;
}

export interface VerifiedPaymentMap {
  [key: string]: VerifiedPaymentEntry;
}

function getVerifiedPaymentStorageKey(workshopId: string): string {
  return `${VERIFIED_PAYMENT_STORAGE_PREFIX}${workshopId || 'main'}`;
}

export function loadVerifiedPaymentsMap(workshopId: string = 'main'): VerifiedPaymentMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getVerifiedPaymentStorageKey(workshopId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as VerifiedPaymentMap;
      }
    }
  } catch {
    // Ignore storage error
  }
  return {};
}

function persistVerifiedPaymentsMap(workshopId: string, map: VerifiedPaymentMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getVerifiedPaymentStorageKey(workshopId), JSON.stringify(map));
  } catch {
    // If localStorage quota is tight due to images, strip proofDataUrl from older entries
    try {
      const slimMap: VerifiedPaymentMap = {};
      for (const [k, v] of Object.entries(map)) {
        slimMap[k] = { ...v, proofDataUrl: v.proofDataUrl ? v.proofDataUrl.slice(0, 120000) : '' };
      }
      localStorage.setItem(getVerifiedPaymentStorageKey(workshopId), JSON.stringify(slimMap));
    } catch {
      // Ignore
    }
  }
  try {
    window.dispatchEvent(new CustomEvent('healyou-payment-verification-updated'));
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('heal_you_portal_sync_v1');
      bc.postMessage({ type: 'PAYMENT_VERIFIED_UPDATED', workshopId });
      bc.close();
    }
  } catch {
    // Ignore
  }
}

export function clearVerifiedPaymentsMap(workshopId: string = 'main'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getVerifiedPaymentStorageKey(workshopId));
    window.dispatchEvent(new CustomEvent('healyou-payment-verification-updated'));
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('heal_you_portal_sync_v1');
      bc.postMessage({ type: 'PAYMENT_VERIFIED_UPDATED', workshopId });
      bc.close();
    }
  } catch {
    // Ignore
  }
}

export function getParticipantPaymentRecord(
  workshopId: string,
  participantId?: string,
  phone?: string
): VerifiedPaymentEntry | null {
  const map = loadVerifiedPaymentsMap(workshopId);
  if (participantId && participantId.trim()) {
    const byId = map[`ID:${participantId.trim().toUpperCase()}`];
    if (byId) return byId;
  }
  const normPhone = normalizePhoneForPaymentCode(phone || '');
  if (normPhone) {
    const byWa = map[`WA:${normPhone}`];
    if (byWa) return byWa;
  }
  return null;
}

export function isParticipantPaymentVerified(
  workshopId: string,
  phone?: string,
  participantId?: string
): boolean {
  const rec = getParticipantPaymentRecord(workshopId, participantId, phone);
  if (!rec) return false;
  return rec.verified !== false;
}

export function saveParticipantTransferSubmission(
  workshopId: string,
  params: {
    participantId?: string;
    phone?: string;
    proofDataUrl?: string;
    proofFileName?: string;
    keepVerifiedIfAlreadyApproved?: boolean;
  }
): VerifiedPaymentEntry {
  const map = loadVerifiedPaymentsMap(workshopId);
  const existing = getParticipantPaymentRecord(workshopId, params.participantId, params.phone);
  const isAlreadyVerified = Boolean(
    params.keepVerifiedIfAlreadyApproved && existing && existing.verified !== false
  );
  const nowIso = new Date().toISOString();

  const entry: VerifiedPaymentEntry = {
    verified: isAlreadyVerified,
    verifiedAt: isAlreadyVerified ? existing?.verifiedAt || nowIso : '',
    verifiedBy: isAlreadyVerified ? existing?.verifiedBy : undefined,
    codeUsed: isAlreadyVerified ? existing?.codeUsed || 'ADMIN-ACC' : 'PENDING-ACC',
    proofDataUrl: params.proofDataUrl || existing?.proofDataUrl || '',
    proofFileName: params.proofFileName || existing?.proofFileName || 'Bukti_Transfer.jpg',
    submittedAt: existing?.submittedAt || nowIso,
  };

  if (params.participantId && params.participantId.trim()) {
    map[`ID:${params.participantId.trim().toUpperCase()}`] = entry;
  }
  const normPhone = normalizePhoneForPaymentCode(params.phone || '');
  if (normPhone) {
    map[`WA:${normPhone}`] = entry;
  }
  persistVerifiedPaymentsMap(workshopId, map);
  return entry;
}

export function setParticipantPaymentApproval(
  workshopId: string,
  params: {
    participantId?: string;
    phone?: string;
    verified: boolean;
    verifiedBy?: string;
    proofDataUrl?: string;
    proofFileName?: string;
  }
): VerifiedPaymentEntry {
  const map = loadVerifiedPaymentsMap(workshopId);
  const existing = getParticipantPaymentRecord(workshopId, params.participantId, params.phone);
  const nowIso = new Date().toISOString();

  const entry: VerifiedPaymentEntry = {
    verified: params.verified,
    verifiedAt: params.verified ? nowIso : '',
    verifiedBy: params.verified ? params.verifiedBy || 'Admin / Panitia' : undefined,
    codeUsed: params.verified ? 'ADMIN-ACC' : 'PENDING-ACC',
    proofDataUrl: params.proofDataUrl ?? existing?.proofDataUrl ?? '',
    proofFileName: params.proofFileName ?? existing?.proofFileName ?? '',
    submittedAt: existing?.submittedAt || nowIso,
  };

  if (params.participantId && params.participantId.trim()) {
    map[`ID:${params.participantId.trim().toUpperCase()}`] = entry;
  }
  const normPhone = normalizePhoneForPaymentCode(params.phone || '');
  if (normPhone) {
    map[`WA:${normPhone}`] = entry;
  }
  persistVerifiedPaymentsMap(workshopId, map);
  return entry;
}

export function markParticipantPaymentVerified(
  workshopId: string,
  phone?: string,
  participantId?: string,
  codeUsed: string = 'ADMIN-ACC',
  verifiedBy: string = 'Admin / Panitia'
): void {
  const map = loadVerifiedPaymentsMap(workshopId);
  const existing = getParticipantPaymentRecord(workshopId, participantId, phone);
  const nowIso = new Date().toISOString();
  const entry: VerifiedPaymentEntry = {
    verified: true,
    verifiedAt: nowIso,
    verifiedBy,
    codeUsed: codeUsed.trim().toUpperCase(),
    proofDataUrl: existing?.proofDataUrl || '',
    proofFileName: existing?.proofFileName || '',
    submittedAt: existing?.submittedAt || nowIso,
  };
  if (participantId && participantId.trim()) {
    map[`ID:${participantId.trim().toUpperCase()}`] = entry;
  }
  const normPhone = normalizePhoneForPaymentCode(phone || '');
  if (normPhone) {
    map[`WA:${normPhone}`] = entry;
  }
  persistVerifiedPaymentsMap(workshopId, map);
}

/**
 * Generates a deterministic cryptographic signature token when Admin / Panitia
 * approves a participant's payment and sends them the unlocked QR card link via WhatsApp.
 */
export function computeApprovalSignature(
  participantId: string,
  workshopId: string = 'main'
): string {
  const cleanId = (participantId || 'HY-001').trim().toUpperCase();
  const cleanEvt = (workshopId || 'main').trim().toUpperCase();
  const raw = `HEALYOU-ACC-SIG-V1|${cleanEvt}|${cleanId}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x27d4eb2d;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i * 31;
    h2 = Math.imul(h2, 0x165667b1);
  }
  const hex1 = (h1 >>> 0).toString(36).toUpperCase();
  const hex2 = (h2 >>> 0).toString(36).toUpperCase();
  return `ACC-${hex1}${hex2}`.slice(0, 14);
}

export function verifyApprovalSignature(
  participantId: string,
  workshopId: string,
  signatureToken: string
): boolean {
  if (!participantId || !signatureToken) return false;
  const expected = computeApprovalSignature(participantId, workshopId);
  return signatureToken.trim().toUpperCase() === expected.toUpperCase();
}

export const CERT_CLAIM_DELAY_HOURS = 2;
export const CERT_CLAIM_DELAY_MS = CERT_CLAIM_DELAY_HOURS * 60 * 60 * 1000;

export function getCertificateClaimStatus(
  startTimeIso: string,
  adminApproved?: boolean,
  nowMs: number = Date.now()
): {
  isUnlocked: boolean;
  isTimeReached: boolean;
  isAdminApproved: boolean;
  unlockTimeMs: number;
  remainingMs: number;
  formattedCountdown: string;
} {
  const parsedStart = new Date(startTimeIso).getTime();
  const startTimeMs = Number.isFinite(parsedStart) ? parsedStart : nowMs;
  const unlockTimeMs = startTimeMs + CERT_CLAIM_DELAY_MS;
  const remainingMs = Math.max(0, unlockTimeMs - nowMs);
  const isTimeReached = remainingMs <= 0;
  const isAdminApproved = Boolean(adminApproved);
  const isUnlocked = isAdminApproved || isTimeReached;

  const totalSec = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  let formattedCountdown = '0 detik';
  if (remainingMs > 0) {
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours} jam`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes} menit`);
    parts.push(`${seconds} detik`);
    formattedCountdown = parts.join(' ');
  }

  return {
    isUnlocked,
    isTimeReached,
    isAdminApproved,
    unlockTimeMs,
    remainingMs,
    formattedCountdown,
  };
}

