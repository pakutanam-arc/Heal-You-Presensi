import React, { useState, useEffect, useRef, useId } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QRCodeCanvas } from 'qrcode.react';
import { useAppContext } from '../store';
import { Participant, WorkshopConfig, FeedbackRecommendation } from '../types';
import { HealYouLogo } from './HealYouLogo';
import {
  renderParticipantCardCanvas,
  buildParticipantPortalUrl,
  formatSafeDateStr,
  formatSafeTimeStr,
} from '../lib/whatsapp';
import {
  renderBotanicalCertificateCanvas,
  getCanonicalParticipantSeqIndex,
  formatOfficialCertificateNumber,
  computeParticipantQrSignature,
  buildCertificateVerificationUrl,
} from '../lib/certificateRenderer';
import {
  buildSignedParticipantQrValue,
  verifyScannedParticipantQr,
  decodeQrFromUploadedCardOrImage,
} from '../lib/qrSecurity';
import { playScanBeep } from '../lib/sound';
import {
  UserPlus,
  Award,
  QrCode,
  Camera,
  CameraOff,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Copy,
  Check,
  Sparkles,
  Star,
  Calendar,
  MapPin,
  ShieldCheck,
  FileCheck2,
  MessageSquareHeart,
  ArrowRight,
  RotateCcw,
  Maximize2,
  X,
  Eye,
  EyeOff,
  ArrowLeft,
  Share2,
  Lock,
  HardDrive,
  Trash2,
  Image as ImageIcon,
  Link2,
  Pencil,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ParticipantPortalViewProps {
  initialTab?: 'register' | 'certificate';
  configFallback?: WorkshopConfig;
  isAdminPreview?: boolean;
  onExitAdminPreview?: () => void;
}

interface LocalUploadedCardRecord {
  participantId: string;
  participantName: string;
  fileName: string;
  uploadedAt: string;
  previewDataUrl: string;
  isVerifiedSignature: boolean;
}

interface MuslimahHealingFormRecord {
  participantId: string;
  fullName: string;
  phone: string;
  favoriteActivity: string;
  domicile: string;
  feelingBeforeEvent: string;
  followedHealYou: string;
  healingTarget: string;
  hopeOrPrayer: string;
  transferFileName: string;
  transferPreviewDataUrl: string;
  followedSupporter: string;
  commitmentStatement: string;
  submittedAt: string;
}

const FEELING_OPTIONS = [
  'Senang dan antusias! 😍',
  'Butuh ketenangan nih 🥺',
  'Pengen coba hal baru 🌸',
];

const HEALING_WOUND_OPTIONS = [
  'Anxiety',
  'Trauma',
  'Gejala Overthinking',
  'Stress',
  'Masalah regulasi emosi',
];

const SUPPORTER_FOLLOW_OPTIONS = [
  'Mau! Sudah follow 😍',
  'Punten belum bersedia 😊🙏',
];

const COMMITMENT_OPTIONS = [
  'Aku siap menerima segala kebaikan dari Allah SWT ✨',
  'Yes! Aku siap merasakan rahmat-Mu yaa Rabb 🤍',
];

function compressTransferProofForLocal(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 480;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        } else {
          resolve('');
        }
      };
      img.onerror = () => resolve('');
      img.src = String(reader.result || '');
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

const QUICK_TAKEAWAY_CHIPS = [
  'Materi sangat aplikatif & menenangkan hati',
  'Penyampaian narasumber sangat mudah dipahami',
  'Membantu saya memahami regulasi emosi & self-healing',
  'Suasana workshop sangat hangat dan suportif',
];

export const ParticipantPortalView: React.FC<ParticipantPortalViewProps> = ({
  initialTab = 'register',
  configFallback,
  isAdminPreview = false,
  onExitAdminPreview,
}) => {
  const {
    participants,
    config: storeConfig,
    certificateSettings,
    feedbacks,
    submitParticipantFeedback,
    activeWorkshopId,
    registerParticipant,
    updateParticipant,
  } = useAppContext();

  const activeConfig = storeConfig?.name ? storeConfig : configFallback || storeConfig;
  const localCardStorageKey = `heal_you_local_uploaded_card_${activeWorkshopId}`;
  const localSelfRegKey = `heal_you_self_reg_${activeWorkshopId}`;

  const [portalTab, setPortalTab] = useState<'register' | 'certificate'>(initialTab);
  const [hideAdminBanner, setHideAdminBanner] = useState(false);
  const [copiedPortalLink, setCopiedPortalLink] = useState<'register' | 'certificate' | null>(null);
  const [showShareQrModal, setShowShareQrModal] = useState(false);

  // Tab 1: Self-Registration Form State ("Muslimah Healing Day! 🌷" format)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('');
  const [role, setRole] = useState('');
  const [feelingBeforeEvent, setFeelingBeforeEvent] = useState<string>('');
  const [followedHealYou, setFollowedHealYou] = useState<string>('');
  const [healingWoundChoice, setHealingWoundChoice] = useState<string>('');
  const [healingWoundOther, setHealingWoundOther] = useState<string>('');
  const [hopeOrPrayer, setHopeOrPrayer] = useState<string>('');
  const [transferFileName, setTransferFileName] = useState<string>('');
  const [transferPreviewDataUrl, setTransferPreviewDataUrl] = useState<string>('');
  const [followedSupporter, setFollowedSupporter] = useState<string>('');
  const [commitmentStatement, setCommitmentStatement] = useState<string>('');
  const [copiedRekening, setCopiedRekening] = useState(false);
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [justUpdatedData, setJustUpdatedData] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateParticipant, setDuplicateParticipant] = useState<Participant | null>(null);
  const transferInputRef = useRef<HTMLInputElement | null>(null);
  const localFormDetailsKey = `heal_you_mhd_form_details_${activeWorkshopId}`;

  const [savedFormDetails, setSavedFormDetails] = useState<MuslimahHealingFormRecord | null>(() => {
    try {
      const raw = localStorage.getItem(localFormDetailsKey);
      return raw ? (JSON.parse(raw) as MuslimahHealingFormRecord) : null;
    } catch {
      return null;
    }
  });

  // Registered Participant Card State (stored in browser localStorage)
  const [registeredParticipant, setRegisteredParticipant] = useState<Participant | null>(() => {
    try {
      const savedId = localStorage.getItem(localSelfRegKey);
      if (savedId) {
        return participants.find((p) => p.id.toUpperCase() === savedId.toUpperCase()) || null;
      }
    } catch {
      // Ignore
    }
    return null;
  });
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [isRenderingCard, setIsRenderingCard] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Tab 2: Scan Kartu Pengenal / Foto / Barcode State (ONLY Upload or Camera — NO Manual ID Input!)
  const [scanMethod, setScanMethod] = useState<'upload' | 'camera'>('upload');
  const [isCameraScanning, setIsCameraScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFileScanning, setIsFileScanning] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Locally stored uploaded Kartu Pengenal / Foto / Barcode (strictly in browser localStorage, never Firebase)
  const [localUploadedCard, setLocalUploadedCard] = useState<LocalUploadedCardRecord | null>(() => {
    try {
      const raw = localStorage.getItem(localCardStorageKey);
      if (raw) {
        return JSON.parse(raw) as LocalUploadedCardRecord;
      }
    } catch {
      // Ignore
    }
    return null;
  });

  const [verifiedParticipant, setVerifiedParticipant] = useState<Participant | null>(() => {
    try {
      const raw = localStorage.getItem(localCardStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalUploadedCardRecord;
        if (parsed?.participantId) {
          return (
            participants.find(
              (p) => p.id.toUpperCase() === parsed.participantId.toUpperCase()
            ) || null
          );
        }
      }
    } catch {
      // Ignore
    }
    return null;
  });
  const [verifiedCardPreviewUrl, setVerifiedCardPreviewUrl] = useState<string | null>(null);

  // Post-Workshop Evaluation Form State
  const [isEditingFeedback, setIsEditingFeedback] = useState(false);
  const [overallRating, setOverallRating] = useState<number>(5);
  const [speakerRating, setSpeakerRating] = useState<number>(5);
  const [facilityRating, setFacilityRating] = useState<number>(5);
  const [takeaway, setTakeaway] = useState('');
  const [suggestedTopic, setSuggestedTopic] = useState('');
  const [recommendation, setRecommendation] = useState<FeedbackRecommendation>(
    'Sangat Merekomendasikan'
  );
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [justSubmittedFeedback, setJustSubmittedFeedback] = useState(false);

  // Certificate Preview State
  const [certPreviewUrl, setCertPreviewUrl] = useState<string | null>(null);
  const [isRenderingCert, setIsRenderingCert] = useState(false);
  const [isDownloadingCert, setIsDownloadingCert] = useState(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);

  const uniqueId = useId().replace(/:/g, '');
  const cameraContainerId = `portal-qr-reader-${uniqueId}`;
  const fileScannerId = `portal-qr-file-${uniqueId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Keep registeredParticipant synced with live participant updates (all 4 profile fields + status)
  useEffect(() => {
    if (!registeredParticipant) return;
    const fresh = participants.find(
      (p) => p.id.toUpperCase() === registeredParticipant.id.toUpperCase()
    );
    if (
      fresh &&
      (fresh.status !== registeredParticipant.status ||
        fresh.name !== registeredParticipant.name ||
        fresh.phone !== registeredParticipant.phone ||
        fresh.role !== registeredParticipant.role ||
        fresh.institution !== registeredParticipant.institution ||
        fresh.email !== registeredParticipant.email)
    ) {
      setRegisteredParticipant(fresh);
    }
  }, [participants, registeredParticipant]);

  // Keep verifiedParticipant synced with live participant updates (all 4 profile fields + status)
  useEffect(() => {
    if (!verifiedParticipant) return;
    const fresh = participants.find(
      (p) => p.id.toUpperCase() === verifiedParticipant.id.toUpperCase()
    );
    if (
      fresh &&
      (fresh.status !== verifiedParticipant.status ||
        fresh.name !== verifiedParticipant.name ||
        fresh.phone !== verifiedParticipant.phone ||
        fresh.role !== verifiedParticipant.role ||
        fresh.institution !== verifiedParticipant.institution ||
        fresh.email !== verifiedParticipant.email)
    ) {
      setVerifiedParticipant(fresh);
    }
  }, [participants, verifiedParticipant]);

  // Render Kartu Peserta Preview whenever registeredParticipant changes
  useEffect(() => {
    let cancelled = false;
    if (!registeredParticipant) {
      setCardPreviewUrl(null);
      return;
    }

    setIsRenderingCard(true);
    const timer = window.setTimeout(async () => {
      try {
        const qrEl = document.getElementById(
          `portal-reg-qr-${registeredParticipant.id}`
        ) as HTMLCanvasElement | null;
        const canvas = await renderParticipantCardCanvas(
          registeredParticipant,
          activeConfig,
          qrEl
        );
        if (!cancelled) {
          setCardPreviewUrl(canvas.toDataURL('image/png'));
        }
      } catch {
        // Fallback
      } finally {
        if (!cancelled) {
          setIsRenderingCard(false);
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [registeredParticipant, activeConfig]);

  // Pre-fill feedback form when verifiedParticipant changes
  useEffect(() => {
    if (!verifiedParticipant) return;
    const existing = feedbacks[verifiedParticipant.id.toUpperCase()];
    if (existing) {
      setOverallRating(existing.overallRating);
      setSpeakerRating(existing.speakerRating);
      setFacilityRating(existing.facilityRating);
      setTakeaway(existing.takeaway);
      setSuggestedTopic(existing.suggestedTopic || '');
      setRecommendation(existing.recommendation);
      setIsEditingFeedback(false);
    } else {
      setOverallRating(5);
      setSpeakerRating(5);
      setFacilityRating(5);
      setTakeaway('');
      setSuggestedTopic('');
      setRecommendation('Sangat Merekomendasikan');
      setIsEditingFeedback(false);
    }
  }, [verifiedParticipant, feedbacks]);

  // Render E-Sertifikat or Kartu Peserta for verifiedParticipant in Tab 2
  useEffect(() => {
    let cancelled = false;
    if (!verifiedParticipant) {
      setCertPreviewUrl(null);
      setVerifiedCardPreviewUrl(null);
      return;
    }

    if (verifiedParticipant.status === 'PENDING') {
      const timer = window.setTimeout(async () => {
        try {
          const qrEl = document.getElementById(
            `portal-ver-qr-${verifiedParticipant.id}`
          ) as HTMLCanvasElement | null;
          const canvas = await renderParticipantCardCanvas(
            verifiedParticipant,
            activeConfig,
            qrEl
          );
          if (!cancelled) {
            setVerifiedCardPreviewUrl(canvas.toDataURL('image/png'));
          }
        } catch {
          // Ignore
        }
      }, 100);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    const canonicalSeqIdx = getCanonicalParticipantSeqIndex(
      verifiedParticipant.id,
      participants
    );
    setIsRenderingCert(true);
    const timer = window.setTimeout(async () => {
      try {
        const canvas = await renderBotanicalCertificateCanvas(
          verifiedParticipant,
          canonicalSeqIdx,
          activeConfig,
          certificateSettings
        );
        if (!cancelled) {
          setCertPreviewUrl(canvas.toDataURL('image/png'));
        }
      } catch {
        // Ignore
      } finally {
        if (!cancelled) {
          setIsRenderingCert(false);
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [verifiedParticipant, activeConfig, certificateSettings, participants]);

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // Ignore
      }
      scannerRef.current = null;
    }
    setIsCameraScanning(false);
  };

  useEffect(() => {
    if (portalTab !== 'certificate' || scanMethod !== 'camera') {
      void stopCamera();
    }
    return () => {
      void stopCamera();
    };
  }, [portalTab, scanMethod]);

  const startCamera = async () => {
    setCameraError(null);
    setLookupError(null);
    try {
      await stopCamera();
      const html5QrCode = new Html5Qrcode(cameraContainerId);
      scannerRef.current = html5QrCode;
      setIsCameraScanning(true);

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 230, height: 230 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleVerifyScannedQr(decodedText, 'Scan Kamera Langsung', '');
          void stopCamera();
        },
        () => {
          // Ignore frame errors
        }
      );
    } catch {
      setIsCameraScanning(false);
      setCameraError(
        'Kamera tidak dapat diakses. Silakan gunakan metode Unggah Kartu Pengenal / Foto / Barcode.'
      );
    }
  };

  /**
   * Handles uploading Kartu Pengenal Pendaftaran / Foto Kartu / Gambar Barcode.
   * Decodes QR locally in the browser and stores the uploaded card preview ONLY in localStorage (never Firebase).
   */
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLookupError(null);
    setIsFileScanning(true);

    try {
      if (isCameraScanning) {
        await stopCamera();
      }

      const { decodedText, previewDataUrl } = await decodeQrFromUploadedCardOrImage(
        file,
        fileScannerId
      );

      if (decodedText) {
        handleVerifyScannedQr(decodedText, file.name, previewDataUrl);
      } else {
        playScanBeep('error');
        setLookupError(
          'Barcode / QR tidak terbaca dari foto atau gambar yang diunggah. Pastikan bagian QR Code pada Kartu Pengenal Pendaftaran terlihat jelas dan tidak terpotong.'
        );
      }
    } catch {
      playScanBeep('error');
      setLookupError(
        'Gagal memproses file gambar. Pastikan Anda mengunggah file gambar (PNG / JPG / WEBP) Kartu Pengenal atau Barcode Anda.'
      );
    } finally {
      setIsFileScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleVerifyScannedQr = (
    rawQrText: string,
    sourceFileName: string,
    previewDataUrl: string
  ) => {
    setLookupError(null);
    setJustSubmittedFeedback(false);

    const verification = verifyScannedParticipantQr(
      rawQrText,
      participants,
      activeWorkshopId
    );

    if (verification.isForgedSignature) {
      playScanBeep('error');
      setVerifiedParticipant(null);
      setLookupError(
        'Kode Barcode / QR ditolak karena tanda tangan keamanan (#HY-Signature) tidak valid atau bukan berasal dari Kartu Pengenal resmi Heal You.'
      );
      return;
    }

    if (!verification.participant) {
      playScanBeep('error');
      setVerifiedParticipant(null);
      setLookupError(
        `Peserta dari Barcode yang dipindai (${verification.extractedId || 'Tidak Dikenal'}) tidak ditemukan pada sesi acara ini.`
      );
      return;
    }

    const matched = verification.participant;
    playScanBeep('success');
    setVerifiedParticipant(matched);

    // Save uploaded card & verified identity ONLY to browser localStorage (never to Firebase!)
    const record: LocalUploadedCardRecord = {
      participantId: matched.id,
      participantName: matched.name,
      fileName: sourceFileName || `Kartu_${matched.id}.png`,
      uploadedAt: new Date().toISOString(),
      previewDataUrl: previewDataUrl || localUploadedCard?.previewDataUrl || '',
      isVerifiedSignature: verification.isVerifiedSignature,
    };
    setLocalUploadedCard(record);
    try {
      localStorage.setItem(localCardStorageKey, JSON.stringify(record));
    } catch {
      // If previewDataUrl is too large for quota, save without image data URL
      try {
        localStorage.setItem(
          localCardStorageKey,
          JSON.stringify({ ...record, previewDataUrl: '' })
        );
      } catch {
        // Ignore
      }
    }
  };

  const handleClearLocalUploadedCard = () => {
    setLocalUploadedCard(null);
    setVerifiedParticipant(null);
    setLookupError(null);
    try {
      localStorage.removeItem(localCardStorageKey);
    } catch {
      // Ignore
    }
  };

  const handleTransferFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setFormError('Ukuran file bukti transfer maksimal 10 MB ya, Shalihah.');
      return;
    }
    setFormError(null);
    setTransferFileName(file.name);
    const preview = await compressTransferProofForLocal(file);
    setTransferPreviewDataUrl(preview);
  };

  const handleCopyRekening = async () => {
    try {
      await navigator.clipboard.writeText('8901562030');
      setCopiedRekening(true);
      window.setTimeout(() => setCopiedRekening(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleStartEditRegistered = (target: Participant) => {
    setEditingParticipantId(target.id);
    setJustUpdatedData(false);
    setFormError(null);
    setDuplicateParticipant(null);
    setFullName(target.name);
    setPhone(target.phone || '');
    setRole(target.role || '');
    setInstitution(target.institution || '');
    if (savedFormDetails && savedFormDetails.participantId.toUpperCase() === target.id.toUpperCase()) {
      setFeelingBeforeEvent(savedFormDetails.feelingBeforeEvent || 'Senang dan antusias! 😍');
      setFollowedHealYou(savedFormDetails.followedHealYou || 'Sudah dong :)');
      if (HEALING_WOUND_OPTIONS.includes(savedFormDetails.healingTarget)) {
        setHealingWoundChoice(savedFormDetails.healingTarget);
        setHealingWoundOther('');
      } else if (savedFormDetails.healingTarget) {
        setHealingWoundChoice('OTHER');
        setHealingWoundOther(savedFormDetails.healingTarget);
      }
      setHopeOrPrayer(savedFormDetails.hopeOrPrayer || '');
      setTransferFileName(savedFormDetails.transferFileName || 'Bukti_Transfer_Tersimpan.jpg');
      setTransferPreviewDataUrl(savedFormDetails.transferPreviewDataUrl || '');
      setFollowedSupporter(savedFormDetails.followedSupporter || '');
      setCommitmentStatement(
        savedFormDetails.commitmentStatement || COMMITMENT_OPTIONS[0]
      );
    } else {
      setFeelingBeforeEvent('Senang dan antusias! 😍');
      setFollowedHealYou('Sudah dong :)');
      setHealingWoundChoice('Anxiety');
      setTransferFileName('Bukti_Transfer_Tersimpan.jpg');
      setCommitmentStatement(COMMITMENT_OPTIONS[0]);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setDuplicateParticipant(null);

    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanFavoriteActivity = role.trim();
    const cleanDomicile = institution.trim();
    const cleanEmail = email.trim() || '-';
    const resolvedHealingTarget =
      healingWoundChoice === 'OTHER' ? healingWoundOther.trim() : healingWoundChoice.trim();

    if (!cleanName) {
      setFormError('Shalihah, mohon isi "Siapa Nama kamu di Bumi?" terlebih dahulu ya 😊💕');
      return;
    }
    if (!cleanPhone) {
      setFormError('Shalihah, mohon isi "No Whatsapp kamu?" terlebih dahulu ya 📞');
      return;
    }
    if (!cleanFavoriteActivity) {
      setFormError('Shalihah, mohon isi "Pekerjaan / Kegiatan favorite-mu?" terlebih dahulu ya 💕');
      return;
    }
    if (!cleanDomicile) {
      setFormError('Shalihah, mohon isi "Dibumi sebelah mana kamu tinggal?" terlebih dahulu ya 🌏🌱');
      return;
    }
    if (!followedHealYou) {
      setFormError('Mohon konfirmasi sudah follow @Healyou.official dulu ya, Shalihah 🤩');
      return;
    }
    if (!resolvedHealingTarget) {
      setFormError(
        'Mohon pilih atau tuliskan "Luka apa yang kamu harap bisa sembuh dalam dirimu?" ya 🖤'
      );
      return;
    }
    if (!transferFileName) {
      setFormError('Mohon unggah file "Bukti Transfer (Early bird 2 Rp.179k)" terlebih dahulu ya 🌷');
      return;
    }
    if (!commitmentStatement) {
      setFormError('Mohon pilih pernyataan kesiapan mengikuti Muslimah Healing Day di bagian akhir form ya 🌸');
      return;
    }

    const existingMatch = participants.find(
      (p) =>
        (editingParticipantId && p.id.toUpperCase() === editingParticipantId.toUpperCase()) ||
        (email.trim() && p.email.toLowerCase() === email.trim().toLowerCase()) ||
        (cleanPhone.length >= 8 &&
          p.phone &&
          p.phone.replace(/\D/g, '').slice(-9) === cleanPhone.replace(/\D/g, '').slice(-9))
    );

    let savedParticipant: Participant;

    if (existingMatch) {
      const updated = updateParticipant(
        existingMatch.id,
        {
          name: cleanName,
          phone: cleanPhone,
          role: cleanFavoriteActivity || 'Peserta Workshop',
          institution: cleanDomicile,
        },
        { allowSelfUpdate: true }
      );
      savedParticipant = updated || {
        ...existingMatch,
        name: cleanName,
        phone: cleanPhone,
        role: cleanFavoriteActivity || 'Peserta Workshop',
        institution: cleanDomicile,
      };
      setJustUpdatedData(true);
      setEditingParticipantId(null);
    } else {
      savedParticipant = registerParticipant(
        {
          name: cleanName,
          email: cleanEmail,
          institution: cleanDomicile,
          role: cleanFavoriteActivity || 'Peserta Workshop',
          phone: cleanPhone,
        },
        { allowSelfRegister: true }
      );
      setJustUpdatedData(false);
    }

    const formRecord: MuslimahHealingFormRecord = {
      participantId: savedParticipant.id,
      fullName: cleanName,
      phone: cleanPhone,
      favoriteActivity: cleanFavoriteActivity,
      domicile: cleanDomicile,
      feelingBeforeEvent: feelingBeforeEvent || 'Senang dan antusias! 😍',
      followedHealYou,
      healingTarget: resolvedHealingTarget,
      hopeOrPrayer: hopeOrPrayer.trim(),
      transferFileName,
      transferPreviewDataUrl,
      followedSupporter: followedSupporter || '-',
      commitmentStatement,
      submittedAt: new Date().toISOString(),
    };

    setSavedFormDetails(formRecord);
    try {
      localStorage.setItem(localSelfRegKey, savedParticipant.id);
      localStorage.setItem(localFormDetailsKey, JSON.stringify(formRecord));
    } catch {
      // Ignore
    }

    playScanBeep('success');
    setRegisteredParticipant(savedParticipant);
    setVerifiedParticipant(savedParticipant);
    const autoRecord: LocalUploadedCardRecord = {
      participantId: savedParticipant.id,
      participantName: savedParticipant.name,
      fileName: `Kartu_Pengenal_${savedParticipant.id}.png`,
      uploadedAt: new Date().toISOString(),
      previewDataUrl: '',
      isVerifiedSignature: true,
    };
    setLocalUploadedCard(autoRecord);
    try {
      localStorage.setItem(localCardStorageKey, JSON.stringify(autoRecord));
    } catch {
      // Ignore
    }
    setFullName('');
    setEmail('');
    setPhone('');
    setInstitution('');
    setRole('');
    setHopeOrPrayer('');
  };

  const handleDownloadRegisteredCard = async () => {
    if (!registeredParticipant) return;
    try {
      const qrEl = document.getElementById(
        `portal-reg-qr-${registeredParticipant.id}`
      ) as HTMLCanvasElement | null;
      const canvas = await renderParticipantCardCanvas(registeredParticipant, activeConfig, qrEl);
      const link = document.createElement('a');
      link.download = `Kartu_Peserta_${registeredParticipant.id}_${registeredParticipant.name.replace(/[^a-z0-9]/gi, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // Ignore
    }
  };

  const handleDownloadVerifiedCard = async () => {
    if (!verifiedParticipant) return;
    try {
      const qrEl = document.getElementById(
        `portal-ver-qr-${verifiedParticipant.id}`
      ) as HTMLCanvasElement | null;
      const canvas = await renderParticipantCardCanvas(verifiedParticipant, activeConfig, qrEl);
      const link = document.createElement('a');
      link.download = `Kartu_Peserta_${verifiedParticipant.id}_${verifiedParticipant.name.replace(/[^a-z0-9]/gi, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // Ignore
    }
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedParticipant) return;
    setFeedbackError(null);

    if (!takeaway.trim() || takeaway.trim().length < 5) {
      setFeedbackError(
        'Mohon tuliskan kesan, pesan, atau manfaat utama yang Anda dapatkan (minimal 5 karakter).'
      );
      return;
    }

    submitParticipantFeedback({
      participantId: verifiedParticipant.id,
      participantName: verifiedParticipant.name,
      institution: verifiedParticipant.institution,
      overallRating,
      speakerRating,
      facilityRating,
      takeaway: takeaway.trim(),
      suggestedTopic: suggestedTopic.trim(),
      recommendation,
    });

    playScanBeep('success');
    setIsEditingFeedback(false);
    setJustSubmittedFeedback(true);
  };

  const handleDownloadCertificate = async () => {
    if (!verifiedParticipant) return;
    setIsDownloadingCert(true);
    try {
      const canonicalSeqIdx = getCanonicalParticipantSeqIndex(
        verifiedParticipant.id,
        participants
      );
      const canvas = await renderBotanicalCertificateCanvas(
        verifiedParticipant,
        canonicalSeqIdx,
        activeConfig,
        certificateSettings
      );
      const link = document.createElement('a');
      const safeName = verifiedParticipant.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
      link.download = `ESertifikat_HealYou_${verifiedParticipant.id}_${safeName}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } finally {
      setIsDownloadingCert(false);
    }
  };

  const handleCopyPortalUrl = async (targetTab: 'register' | 'certificate') => {
    const url = buildParticipantPortalUrl(activeWorkshopId, activeConfig, targetTab);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPortalLink(targetTab);
      window.setTimeout(() => setCopiedPortalLink(null), 2500);
    } catch {
      // Ignore
    }
  };

  const currentFeedback = verifiedParticipant
    ? feedbacks[verifiedParticipant.id.toUpperCase()]
    : undefined;

  const verifiedCertNumber = verifiedParticipant
    ? formatOfficialCertificateNumber(
        verifiedParticipant.id,
        participants,
        certificateSettings.numberSuffix
      )
    : '';

  const registeredCertNumber = registeredParticipant
    ? formatOfficialCertificateNumber(
        registeredParticipant.id,
        participants,
        certificateSettings.numberSuffix
      )
    : '';

  const shareRegistrationUrl = buildParticipantPortalUrl(
    activeWorkshopId,
    activeConfig,
    'register'
  );

  return (
    <div
      className="min-h-screen flex flex-col font-sans text-slate-900"
      style={{
        background:
          'linear-gradient(155deg, #fdf8ff 0%, #f5eeff 38%, #eef4ff 75%, #f8f5ff 100%)',
      }}
    >
      {/* Hidden Signed QR Canvases for instant participant card & E-Certificate rendering */}
      <div className="hidden" aria-hidden="true">
        {registeredParticipant && (
          <>
            <QRCodeCanvas
              id={`portal-reg-qr-${registeredParticipant.id}`}
              value={buildSignedParticipantQrValue(registeredParticipant.id, activeWorkshopId)}
              size={360}
              level="H"
              includeMargin={false}
              fgColor="#261742"
              bgColor="#ffffff"
            />
            <QRCodeCanvas
              id={`portal-cert-qr-${registeredParticipant.id}`}
              value={buildCertificateVerificationUrl(
                registeredParticipant,
                getCanonicalParticipantSeqIndex(registeredParticipant.id, participants),
                certificateSettings.numberSuffix
              )}
              size={360}
              level="M"
              includeMargin={false}
              fgColor="#261742"
              bgColor="#ffffff"
            />
          </>
        )}
        {verifiedParticipant && (
          <>
            <QRCodeCanvas
              id={`portal-ver-qr-${verifiedParticipant.id}`}
              value={buildSignedParticipantQrValue(verifiedParticipant.id, activeWorkshopId)}
              size={360}
              level="H"
              includeMargin={false}
              fgColor="#261742"
              bgColor="#ffffff"
            />
            <QRCodeCanvas
              id={`portal-cert-qr-${verifiedParticipant.id}`}
              value={buildCertificateVerificationUrl(
                verifiedParticipant,
                getCanonicalParticipantSeqIndex(verifiedParticipant.id, participants),
                certificateSettings.numberSuffix
              )}
              size={360}
              level="M"
              includeMargin={false}
              fgColor="#261742"
              bgColor="#ffffff"
            />
          </>
        )}
        <div id={fileScannerId} />
      </div>

      {/* Optional Admin Preview Control Bar (ONLY shown when Admin clicks preview inside Admin Panel) */}
      {isAdminPreview && !hideAdminBanner && (
        <div className="bg-slate-900 text-white border-b border-slate-800 px-4 py-2.5 sticky top-0 z-50 shadow-md">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Mode Pratinjau Admin
              </span>
              <p className="text-xs text-slate-300">
                Saat peserta membuka <strong>Link Khusus Peserta</strong>, mereka{' '}
                <span className="text-white font-semibold underline decoration-emerald-400">
                  hanya dapat mengakses halaman ini saja
                </span>{' '}
                (tanpa akses ke Dashboard Panitia).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyPortalUrl('register')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all cursor-pointer"
              >
                {copiedPortalLink === 'register' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Link Disalin!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Salin Link Pendaftaran
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowShareQrModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-purple-300" />
                QR Link
              </button>
              <button
                type="button"
                onClick={() => setHideAdminBanner(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                title="Sembunyikan bar ini untuk melihat tampilan 100% peserta"
              >
                <EyeOff className="w-3.5 h-3.5" />
                Layar Murni
              </button>
              {onExitAdminPreview && (
                <button
                  type="button"
                  onClick={onExitAdminPreview}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Kembali ke Admin
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating button to restore admin bar if hidden during Admin Preview */}
      {isAdminPreview && hideAdminBanner && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHideAdminBanner(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-slate-900/90 text-white shadow-lg hover:bg-slate-900 backdrop-blur-xs cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-purple-300" />
            Tampilkan Bar Admin
          </button>
          {onExitAdminPreview && (
            <button
              type="button"
              onClick={onExitAdminPreview}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-purple-700 text-white shadow-lg hover:bg-purple-800 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Panel Admin
            </button>
          )}
        </div>
      )}

      {/* Main Participant Portal Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6">
        {/* Couture Workshop Event Header Card */}
        <div
          className="relative rounded-3xl p-6 sm:p-8 border border-white shadow-sm overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, rgba(242,203,252,0.55) 0%, rgba(213,196,252,0.5) 45%, rgba(184,208,255,0.55) 100%)',
          }}
        >
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-tl-[20px] rounded-br-[20px] rounded-tr-[4px] rounded-bl-[4px] bg-white/90 p-1.5 shadow-sm border border-purple-100 mb-3">
              <HealYouLogo
                className="w-full h-full rounded-tl-[16px] rounded-br-[16px] rounded-tr-[3px] rounded-bl-[3px]"
                customLogoUrl={activeConfig.customLogoUrl}
              />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#3d2863]">
              {activeConfig.organizer || 'Muslimah Healing Journey'}
            </p>
            <p className="font-serif italic text-sm font-semibold text-[#5e438f] mt-0.5">
              — {activeConfig.tagline || "Let's Heal"} —
            </p>

            <div className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/80 border border-purple-200/70 text-[11px] font-semibold text-purple-900 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              Portal Resmi Peserta · {activeConfig.eventLabel || 'Agenda Workshop Psikologi'}
            </div>

            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1f1235] mt-3 max-w-2xl leading-snug">
              {activeConfig.name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm text-[#4a3b69] font-medium">
              <span className="inline-flex items-center gap-1.5 bg-white/80 px-3.5 py-1.5 rounded-xl border border-white shadow-2xs">
                <Calendar className="w-4 h-4 text-purple-700" />
                {formatSafeDateStr(activeConfig.date, 'dd MMMM yyyy')} · Pukul{' '}
                {formatSafeTimeStr(activeConfig.startTime)} WIB
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/80 px-3.5 py-1.5 rounded-xl border border-white shadow-2xs">
                <MapPin className="w-4 h-4 text-purple-700" />
                {activeConfig.location}
              </span>
            </div>
          </div>
        </div>

        {/* Two-Mode Switcher for Participant: 1. Formulir Pendaftaran | 2. Scan Kartu & Klaim E-Sertifikat */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-2 border border-purple-100 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPortalTab('register')}
            className={cn(
              'flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all cursor-pointer',
              portalTab === 'register'
                ? 'text-purple-950 shadow-xs border border-purple-200/80'
                : 'text-slate-600 hover:bg-purple-50/50'
            )}
            style={
              portalTab === 'register'
                ? {
                    background:
                      'linear-gradient(115deg, rgba(240,189,251,0.42) 0%, rgba(201,179,252,0.42) 50%, rgba(137,180,255,0.42) 100%)',
                  }
                : undefined
            }
          >
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                portalTab === 'register'
                  ? 'bg-purple-900 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-600'
              )}
            >
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">1. Formulir Pendaftaran Peserta</span>
                {registeredParticipant && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Terdaftar ({registeredParticipant.id})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar mandiri &amp; unduh Kartu Pengenal ber-Barcode QR
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setPortalTab('certificate');
            }}
            className={cn(
              'flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all cursor-pointer',
              portalTab === 'certificate'
                ? 'bg-emerald-900 text-white shadow-xs border border-emerald-800'
                : 'text-slate-600 hover:bg-emerald-50/60'
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                portalTab === 'certificate'
                  ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/30'
                  : 'bg-emerald-50 text-emerald-700'
              )}
            >
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">
                  2. Upload / Scan Kartu &amp; Klaim Sertifikat
                </span>
              </div>
              <p
                className={cn(
                  'text-xs mt-0.5',
                  portalTab === 'certificate' ? 'text-emerald-100/90' : 'text-slate-500'
                )}
              >
                Upload Kartu Pengenal / Barcode untuk evaluasi &amp; E-Sertifikat
              </p>
            </div>
          </button>
        </div>

        {/* TAB 1: FORMULIR PENDAFTARAN MANDIRI PESERTA ("Muslimah Healing Day! 🌷" Format) */}
        {portalTab === 'register' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-4">
              {/* Card 0: Undangan & Deskripsi Acara "Muslimah Healing Day! 🌷" */}
              <div className="bg-white rounded-3xl border border-pink-200/80 shadow-xs overflow-hidden">
                <div
                  className="h-3 w-full"
                  style={{
                    background:
                      'linear-gradient(90deg, #f4a5d0 0%, #c9b3fc 50%, #9ec2ff 100%)',
                  }}
                />
                <div className="p-6 sm:p-7 space-y-4 text-slate-800 text-sm leading-relaxed">
                  <h2
                    className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap"
                    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                  >
                    <span className="italic">Muslimah Healing Day!</span>
                    <span>🌷</span>
                  </h2>

                  <p className="font-medium text-slate-800">
                    Assalamu&apos;alaikum, Shalihah! 💕
                  </p>

                  <p className="text-slate-700">
                    Pernah merasa lelah dan butuh me-time yang menenangkan?
                  </p>

                  <p className="text-slate-700">
                    Yuk, luangkan waktu untuk diri sendiri di Hari Kesehatan Mental Sedunia dalam{' '}
                    <strong>&quot;Muslimah Healing Day!&quot;</strong> workshop merangkai bunga +
                    self healing yang insyaAllah will soothe your heart and refresh your soul 💐✨
                  </p>

                  <div className="p-4 rounded-2xl bg-pink-50/55 border border-pink-100/90 space-y-1.5 text-slate-800">
                    <p className="font-bold text-slate-900">Save the date:</p>
                    <p>🗓️ Sabtu, 10 Oktober 2026</p>
                    <p>⏰ 13.00 – Selesai</p>
                    <p>📍 J Chicken Tole, Depok</p>
                    <p>👗 Dresscode: Soft pink / Cream / White</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100/80 space-y-1.5 text-slate-800">
                    <p className="font-bold text-slate-900">Benefit yang kamu dapat:</p>
                    <p>🍗 Lunch J Chicken</p>
                    <p>🎁 Goodie bag dari supporter event</p>
                    <p>💐 Bouquet Flower karya tangan sendiri</p>
                    <p>📝 Worksheet regulasi emosi (Trigger Innerchild)</p>
                    <p>🌷 Hadiah Games</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 space-y-1">
                    <p className="font-bold text-slate-900">💰 Investasi Healing-mu:</p>
                    <p className="font-semibold text-purple-950">
                      Hanya 179 untuk Early Bird 2! <span className="text-slate-500 font-normal">(Normal 229K)</span>
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1 text-slate-700">
                    <p className="font-medium text-slate-900">
                      Yuk, segera isi formulirnya, Shalihah!
                    </p>
                    <p>
                      Karena hati yang tenang itu priceless namun karena Intimate workshop jadi
                      pesertanya terbatas ya shalihah 🥺💗
                    </p>
                    <p className="pt-1 font-medium text-slate-900">
                      Sampai bertemu di acara yang penuh keberkahan ini, ya! 😊🌸
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-xs text-rose-600 font-medium">
                    * Menunjukkan pertanyaan yang wajib diisi
                  </div>
                </div>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {formError && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 shadow-2xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="font-medium">{formError}</span>
                  </div>
                )}

                {duplicateParticipant && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                          Nomor WhatsApp Sudah Terdaftar, Shalihah! 💕
                        </h4>
                        <p className="text-xs text-amber-900 mt-1">
                          Kamu sudah terdaftar pada acara ini. Untuk melihat Kartu Pengenal atau
                          klaim E-Sertifikat, silakan gunakan{' '}
                          <strong>Kartu Pengenal Pendaftaran / Barcode QR</strong> pada menu{' '}
                          <strong>2. Upload / Scan Kartu &amp; Klaim Sertifikat</strong>.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDuplicateParticipant(null);
                          setPortalTab('certificate');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 transition-all cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Menuju Upload Kartu Pengenal / Barcode
                      </button>
                    </div>
                  </div>
                )}

                {/* Q1: Siapa Nama kamu di Bumi? */}
                <div className="bg-white rounded-2xl border border-pink-100/90 shadow-2xs p-5 sm:p-6 space-y-3">
                  <label className="block text-sm sm:text-base font-medium text-slate-900">
                    Siapa Nama kamu di Bumi? 😊💕 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jawaban Anda"
                    className="w-full px-1 py-2.5 text-sm text-slate-900 bg-transparent border-b border-slate-300 focus:border-purple-600 focus:outline-none transition-colors placeholder:text-slate-400"
                  />
                  <p className="text-[11px] text-slate-400">
                    Nama ini juga akan tercetak pada Kartu Pengenal QR &amp; E-Sertifikat kamu ya,
                    Shalihah.
                  </p>
                </div>

                {/* Q2: No Whatsapp kamu? */}
                <div className="bg-white rounded-2xl border border-pink-100/90 shadow-2xs p-5 sm:p-6 space-y-3">
                  <label className="block text-sm sm:text-base font-medium text-slate-900">
                    No Whatsapp kamu? 📞 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Jawaban Anda"
                    className="w-full max-w-sm px-1 py-2.5 text-sm text-slate-900 bg-transparent border-b border-slate-300 focus:border-purple-600 focus:outline-none transition-colors placeholder:text-slate-400"
                  />
                </div>

                {/* Q3: Pekerjaan / Kegiatan favorite-mu? */}
                <div className="bg-white rounded-2xl border border-pink-100/90 shadow-2xs p-5 sm:p-6 space-y-3">
                  <label className="block text-sm sm:text-base font-medium text-slate-900">
                    Pekerjaan / Kegiatan favorite-mu? 💕 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Jawaban Anda"
                    className="w-full px-1 py-2.5 text-sm text-slate-900 bg-transparent border-b border-slate-300 focus:border-purple-600 focus:outline-none transition-colors placeholder:text-slate-400"
                  />
                </div>

                {/* Q4: Dibumi sebelah mana kamu tinggal? */}
                <div className="bg-white rounded-2xl border border-pink-100/90 shadow-2xs p-5 sm:p-6 space-y-3">
                  <label className="block text-sm sm:text-base font-medium text-slate-900">
                    Dibumi sebelah mana kamu tinggal? 🌏🌱 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Jawaban Anda"
                    className="w-full px-1 py-2.5 text-sm text-slate-900 bg-transparent border-b border-slate-300 focus:border-purple-600 focus:outline-none transition-colors placeholder:text-slate-400"
                  />
                </div>

                {/* Q5: Bagaimana perasaanmu menjelang acara ini? */}
                <div className="bg-white rounded-2xl border border-pink-100/90 shadow-2xs p-5 sm:p-6 space-y-3.5">
                  <label className="block text-sm sm:text-base font-medium text-slate-900">
                    Bagaimana perasaanmu menjelang acara ini? 🥰
                  </label>
                  <div className="space-y-2.5">
                    {FEELING_OPTIONS.map((opt) => (
                      <label
                        key={opt}
                        className="flex items-center gap-3 text-sm text-slate-800 cursor-pointer select-none py-0.5"
                      >
                        <input
                          type="radio"
                          name="feelingBeforeEvent"
                          value={opt}
                          checked={feelingBeforeEvent === opt}
                          onChange={(e) => setFeelingBeforeEvent(e.target.value)}
                          className="w-4 h-4 accent-purple-700 cursor-pointer"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Q6: Mari tumbuh bersama @Healyou.official, sudah follow aku? */}
                <div className="bg-white rounded-2xl border border-pink-100/90 shadow-2xs p-5 sm:p-6 space-y-3">
                  <div className="space-y-1">
                    <label className="block text-sm sm:text-base font-medium text-slate-900">
                      Mari tumbuh bersama @Healyou.official, sudah follow aku? 🤩{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <a
                      href="https://www.instagram.com/healyou.official"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-sm font-medium text-blue-600 hover:text-blue-700 underline"
                    >
                      Klik untuk follow!
                    </a>
                  </div>
                  <div className="pt-1">
                    <label className="flex items-center gap-3 text-sm text-slate-800 cursor-pointer select-none py-0.5">
                      <input
                        type="radio"
                        name="followedHealYou"
                        required
                        value="Sudah dong :)"
                        checked={followedHealYou === 'Sudah dong :)'}
                        onChange={(e) => setFollowedHealYou(e.target.value)}
                        className="w-4 h-4 accent-purple-700 cursor-pointer"
                      />
                      <span>Sudah dong :)</span>
                    </label>
                  </div>
                </div>

                {/* Q7: Luka apa yang kamu harap bisa sembuh dalam dirimu? */}
                <div className="bg-white rounded-2xl border border-pink-100/90 shadow-2xs p-5 sm:p-6 space-y-3.5">
                  <div>
                    <label className="block text-sm sm:text-base font-medium text-slate-900">
                      Luka apa yang kamu harap bisa sembuh dalam dirimu? 🖤{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-xs sm:text-sm italic text-slate-700 mt-0.5">
                      (Biar bisa aku aminin hehe) 🤩
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {HEALING_WOUND_OPTIONS.map((opt) => (
                      <label
                        key={opt}
                        className="flex items-center gap-3 text-sm text-slate-800 cursor-pointer select-none py-0.5"
                      >
                        <input
                          type="radio"
                          name="healingWoundChoice"
                          value={opt}
                          checked={healingWoundChoice === opt}
                          onChange={(e) => setHealingWoundChoice(e.target.value)}
                          className="w-4 h-4 accent-purple-700 cursor-pointer"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}

                    <div className="flex items-center gap-3 text-sm text-slate-800 py-0.5">
                      <label className="flex items-center gap-3 cursor-pointer select-none shrink-0">
                        <input
                          type="radio"
                          name="healingWoundChoice"
                          value="OTHER"
                          checked={healingWoundChoice === 'OTHER'}
                          onChange={(e) => setHealingWoundChoice(e.target.value)}
                          className="w-4 h-4 accent-purple-700 cursor-pointer"
                        />
                        <span>Yang lain:</span>
                      </label>
                      <input
                        type="text"
                        value={healingWoundOther}
                        onFocus={() => setHealingWoundChoice('OTHER')}
                        onChange={(e) => {
                          setHealingWoundChoice('OTHER');
                          setHealingWoundOther(e.target.value);
                        }}
                        placeholder="Tuliskan di sini..."
                        className="flex-1 px-1 py-1 text-sm text-slate-900 bg-transparent border-b border-slate-300 focus:border-purple-600 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Q8: Harapan atau doa yang ingin kamu capai dari acara ini? (opsional) */}
                <div className="bg-white rounded-2xl border border-pink-100/90 shadow-2xs p-5 sm:p-6 space-y-3">
                  <label className="block text-sm sm:text-base font-medium text-slate-900">
                    Harapan atau doa yang ingin kamu capai dari acara ini? 🌷🤍{' '}
                    <span className="text-slate-500 font-normal">(opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={hopeOrPrayer}
                    onChange={(e) => setHopeOrPrayer(e.target.value)}
                    placeholder="Jawaban Anda"
                    className="w-full px-1 py-2.5 text-sm text-slate-900 bg-transparent border-b border-slate-300 focus:border-purple-600 focus:outline-none transition-colors placeholder:text-slate-400"
                  />
                </div>

                {/* Q9: Bukti Transfer (Early bird 2 Rp.179k) */}
                <div className="bg-white rounded-2xl border border-pink-100/90 shadow-2xs p-5 sm:p-6 space-y-3.5">
                  <div>
                    <label className="block text-sm sm:text-base font-medium text-slate-900">
                      Bukti Transfer (Early bird 2 Rp.179k) 🌷{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                      <div className="text-xs sm:text-sm text-slate-800 space-y-0.5">
                        <p className="font-bold text-slate-900">BSI</p>
                        <p className="font-mono font-semibold text-purple-900">890-1562-030</p>
                        <p className="text-slate-700">a/n MAYANK INTAMI</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopyRekening()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 shadow-2xs transition-all cursor-pointer shrink-0"
                      >
                        {copiedRekening ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-purple-700" />
                            <span>Salin No. Rek</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">
                    Upload 1 file yang didukung. Maks 10 MB. (Tersimpan aman di perangkat Anda)
                  </p>

                  <input
                    ref={transferInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleTransferFileChange}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => transferInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-blue-600 bg-white hover:bg-blue-50/70 border border-slate-300 transition-colors cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{transferFileName ? 'Ganti file' : 'Tambahkan file'}</span>
                    </button>

                    {transferFileName && (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate max-w-[200px] font-medium">
                          {transferFileName}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setTransferFileName('');
                            setTransferPreviewDataUrl('');
                            if (transferInputRef.current) {
                              transferInputRef.current.value = '';
                            }
                          }}
                          className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                          title="Hapus file"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {transferPreviewDataUrl && (
                    <div className="pt-1">
                      <img
                        src={transferPreviewDataUrl}
                        alt="Pratinjau Bukti Transfer"
                        className="h-28 w-auto rounded-xl border border-slate-200 object-cover shadow-2xs"
                      />
                    </div>
                  )}
                </div>

                {/* Q10: Supporter kami skincare For Her */}
                <div className="bg-white rounded-2xl border border-pink-100/90 shadow-2xs p-5 sm:p-6 space-y-3">
                  <div className="space-y-1">
                    <label className="block text-sm sm:text-base font-medium text-slate-900">
                      Supporter kami skincare For Her mau kasih gift untuk yang follow instagram
                      nya, kamu mau ngga? 🤩
                    </label>
                    <a
                      href="https://www.instagram.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-sm font-medium text-blue-600 hover:text-blue-700 underline"
                    >
                      Klik untuk follow!
                    </a>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {SUPPORTER_FOLLOW_OPTIONS.map((opt) => (
                      <label
                        key={opt}
                        className="flex items-center gap-3 text-sm text-slate-800 cursor-pointer select-none py-0.5"
                      >
                        <input
                          type="radio"
                          name="followedSupporter"
                          value={opt}
                          checked={followedSupporter === opt}
                          onChange={(e) => setFollowedSupporter(e.target.value)}
                          className="w-4 h-4 accent-purple-700 cursor-pointer"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Q11: Pernyataan Kesiapan Mengikuti Muslimah Healing Day */}
                <div className="bg-white rounded-2xl border border-pink-100/90 shadow-2xs p-5 sm:p-6 space-y-3.5">
                  <label className="block text-sm sm:text-base font-medium text-slate-900 leading-relaxed">
                    Dengan mengisi form ini, saya siap ikut serta dalam Muslimah Healing Day,
                    memberi ruang jeda &amp; aman untuk diri saya serta siap menerima kebaikan di
                    hari itu 🌸 <span className="text-rose-500">*</span>
                  </label>

                  <div className="space-y-2.5">
                    {COMMITMENT_OPTIONS.map((opt) => (
                      <label
                        key={opt}
                        className="flex items-center gap-3 text-sm text-slate-800 cursor-pointer select-none py-0.5"
                      >
                        <input
                          type="radio"
                          name="commitmentStatement"
                          required
                          value={opt}
                          checked={commitmentStatement === opt}
                          onChange={(e) => setCommitmentStatement(e.target.value)}
                          className="w-4 h-4 accent-purple-700 cursor-pointer"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Submit & Secondary Switcher Card */}
                <div className="bg-white rounded-2xl border border-purple-100 shadow-xs p-5 space-y-3">
                  {editingParticipantId && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-xs text-amber-950">
                      <span>
                        Mode Perbarui Data untuk Kartu &amp; E-Sertifikat (<strong>{editingParticipantId}</strong>)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingParticipantId(null);
                          setFullName('');
                          setPhone('');
                          setRole('');
                          setInstitution('');
                        }}
                        className="font-bold text-amber-800 hover:underline cursor-pointer"
                      >
                        Batal Edit
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 px-5 rounded-xl font-bold text-sm text-purple-950 shadow-sm hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-purple-300/80"
                    style={{
                      background:
                        'linear-gradient(115deg, #f0bdfb 0%, #c9b3fc 50%, #89b4ff 100%)',
                    }}
                  >
                    <UserPlus className="w-4 h-4" />
                    {editingParticipantId
                      ? 'Simpan Perubahan Data Kartu & E-Sertifikat 🌸'
                      : 'Kirim Formulir & Terbitkan Kartu Pengenal QR 🌸'}
                  </button>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>Sudah daftar &amp; punya Kartu Pengenal QR?</span>
                    <button
                      type="button"
                      onClick={() => setPortalTab('certificate')}
                      className="font-bold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1 cursor-pointer"
                    >
                      Upload Kartu / Scan Barcode di Sini
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Right Column: Instant Kartu Pengenal & Signed QR Code Preview */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {registeredParticipant ? (
                <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm p-5 space-y-4">
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        Pendaftaran Berhasil · Tersimpan di Perangkat Ini
                      </span>
                      <h3 className="text-sm font-bold text-emerald-950">
                        Wajib Simpan Kartu Pengenal Anda!
                      </h3>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Kartu ini dilengkapi <strong>Barcode QR Berenkripsi</strong> yang menjadi
                        kunci tunggal untuk <strong>Scan &amp; Klaim E-Sertifikat</strong> Anda
                        setelah acara selesai.
                      </p>
                    </div>
                  </div>

                  {/* High-Res Botanical ID Card Preview */}
                  <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3 flex items-center justify-center min-h-[340px]">
                    {isRenderingCard || !cardPreviewUrl ? (
                      <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
                        <div className="w-7 h-7 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-medium">Merender Kartu Pengenal QR...</span>
                      </div>
                    ) : (
                      <img
                        src={cardPreviewUrl}
                        alt={`Kartu Peserta ${registeredParticipant.name}`}
                        className="w-full max-w-[300px] h-auto rounded-2xl shadow-md"
                      />
                    )}
                  </div>

                  {/* Linked Barcode Pengenal <-> E-Sertifikat Synchronization Summary */}
                  <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-purple-950 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                        <Link2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        Sinkronisasi Data Kartu &amp; E-Sertifikat
                      </span>
                      <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        SIG-{computeParticipantQrSignature(registeredParticipant.id)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-mono break-all">
                      No. Sertifikat: <strong className="text-purple-950">{registeredCertNumber}</strong>
                    </p>

                    <div className="pt-2 border-t border-purple-200/60 space-y-1 text-[11px] text-slate-700">
                      <p>
                        <strong>1. Nama (Kartu &amp; Sertifikat):</strong>{' '}
                        <span className="font-semibold text-slate-900">{registeredParticipant.name}</span>
                      </p>
                      <p>
                        <strong>2. No. WhatsApp (Kartu &amp; Kontak):</strong>{' '}
                        <span className="font-mono text-slate-900">{registeredParticipant.phone || '-'}</span>
                      </p>
                      <p>
                        <strong>3. Pekerjaan / Kegiatan (Kartu &amp; Sertifikat):</strong>{' '}
                        <span className="text-slate-900">{registeredParticipant.role || '-'}</span>
                      </p>
                      <p>
                        <strong>4. Domisili / Tinggal (Kartu &amp; Sertifikat):</strong>{' '}
                        <span className="text-slate-900">{registeredParticipant.institution || '-'}</span>
                      </p>
                    </div>

                    {justUpdatedData && (
                      <div className="p-2 rounded-lg bg-emerald-100/80 text-emerald-900 text-[11px] font-semibold">
                        ✓ Keempat data di atas telah diperbarui &amp; tersinkronisasi langsung ke Kartu Pengenal dan E-Sertifikat!
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleStartEditRegistered(registeredParticipant)}
                      className="w-full mt-1 py-2 px-3 rounded-lg text-[11px] font-bold bg-white hover:bg-purple-100/80 text-purple-900 border border-purple-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3 text-purple-700" />
                      <span>Edit / Perbarui 4 Data Kartu &amp; Sertifikat</span>
                    </button>
                  </div>

                  {/* Muslimah Healing Day Local Registration Summary */}
                  {savedFormDetails &&
                    savedFormDetails.participantId.toUpperCase() ===
                      registeredParticipant.id.toUpperCase() && (
                      <div className="p-3.5 rounded-2xl bg-pink-50/60 border border-pink-200/80 space-y-1.5 text-xs text-slate-700">
                        <p className="font-bold text-pink-950 text-[11px] uppercase tracking-wider">
                          🌷 Ringkasan Pendaftaran Shalihah (Local Storage)
                        </p>
                        <p>
                          <strong>Perasaan:</strong> {savedFormDetails.feelingBeforeEvent}
                        </p>
                        <p>
                          <strong>Harapan Sembuh:</strong> {savedFormDetails.healingTarget}
                        </p>
                        {savedFormDetails.hopeOrPrayer && (
                          <p>
                            <strong>Harapan / Doa:</strong> &ldquo;{savedFormDetails.hopeOrPrayer}&rdquo;
                          </p>
                        )}
                        {savedFormDetails.transferFileName && (
                          <p className="text-emerald-800 font-medium">
                            ✓ Bukti Transfer: {savedFormDetails.transferFileName}
                          </p>
                        )}
                      </div>
                    )}

                  {/* Download & Switch to Certificate Verification */}
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={handleDownloadRegisteredCard}
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-purple-900 hover:bg-purple-950 text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Unduh Kartu Pengenal Pendaftaran (PNG)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!verifiedParticipant) {
                          setVerifiedParticipant(registeredParticipant);
                        }
                        setPortalTab('certificate');
                      }}
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-emerald-700" />
                      Menuju Upload Kartu &amp; Klaim E-Sertifikat
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white/85 rounded-3xl border border-purple-100 p-6 text-center space-y-4 shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-100 text-purple-700 flex items-center justify-center mx-auto">
                    <QrCode className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Kartu Pengenal Ber-Barcode QR Sebagai Kunci Sertifikat
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Begitu Anda mendaftar, sistem menerbitkan{' '}
                      <strong>Kartu Pengenal Pendaftaran (PNG)</strong> dengan Barcode QR bertanda
                      tangan digital unik yang hanya dimiliki oleh Anda.
                    </p>
                  </div>
                  <div className="text-left bg-purple-50/60 rounded-2xl p-4 border border-purple-100 space-y-2.5 text-xs text-slate-700">
                    <div className="font-bold text-purple-950 uppercase tracking-wider text-[10px]">
                      Alur Keamanan Peserta:
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-purple-200 text-purple-900 font-bold text-[11px] flex items-center justify-center shrink-0">
                        1
                      </span>
                      <span>
                        Isi formulir pendaftaran &amp; <strong>unduh Kartu Pengenal QR</strong> ke HP
                        Anda.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-purple-200 text-purple-900 font-bold text-[11px] flex items-center justify-center shrink-0">
                        2
                      </span>
                      <span>Tunjukkan Kartu QR kepada panitia saat check-in kehadiran acara.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-purple-200 text-purple-900 font-bold text-[11px] flex items-center justify-center shrink-0">
                        3
                      </span>
                      <span>
                        Setelah acara selesai, <strong>unggah Kartu Pengenal / Foto / Barcode</strong>{' '}
                        Anda pada tab ke-2 untuk klaim E-Sertifikat (tersimpan aman di Local Storage
                        HP Anda).
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: UPLOAD / SCAN KARTU PENGENAL, EVALUASI & KLAIM E-SERTIFIKAT (TANPA INPUT ID MANUAL) */}
        {portalTab === 'certificate' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Upload Kartu Pengenal / Foto / Barcode OR Live Camera Scan */}
            <div className="lg:col-span-5 bg-white rounded-3xl border border-purple-100 shadow-xs overflow-hidden">
              <div className="p-5 bg-emerald-950 text-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold">
                      Scan Identitas via Kartu Pengenal / Barcode
                    </h2>
                    <p className="text-[11px] text-emerald-200/90">
                      Unggah Kartu Pengenal / Foto / Barcode Anda untuk membuka E-Sertifikat
                    </p>
                  </div>
                </div>

                {/* ONLY 2 Methods: Upload Kartu/Foto/Barcode OR Kamera (Manual ID Removed for Security!) */}
                <div className="grid grid-cols-2 gap-1.5 mt-4 bg-emerald-900/70 p-1 rounded-xl border border-emerald-800">
                  <button
                    type="button"
                    onClick={() => setScanMethod('upload')}
                    className={cn(
                      'py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                      scanMethod === 'upload'
                        ? 'bg-white text-emerald-950 shadow-2xs'
                        : 'text-emerald-100 hover:bg-emerald-800/60'
                    )}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Kartu / Barcode
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanMethod('camera')}
                    className={cn(
                      'py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                      scanMethod === 'camera'
                        ? 'bg-white text-emerald-950 shadow-2xs'
                        : 'text-emerald-100 hover:bg-emerald-800/60'
                    )}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Scan Kamera
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Method 1: Upload Kartu Pengenal Pendaftaran / Foto Kartu / Barcode */}
                {scanMethod === 'upload' && (
                  <div className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileScan}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isFileScanning}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-7 px-4 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 transition-all flex flex-col items-center justify-center gap-2.5 cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        {isFileScanning ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Upload className="w-6 h-6" />
                        )}
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-bold text-emerald-950 block">
                          {isFileScanning
                            ? 'Memindai Barcode Identitas dari Gambar...'
                            : 'Upload Kartu Pengenal Pendaftaran / Foto / Barcode'}
                        </span>
                        <span className="text-[11px] text-slate-500 mt-1 block">
                          Pilih gambar Kartu Pengenal (PNG/JPG), foto kartu cetak, atau gambar
                          Barcode QR Anda
                        </span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Method 2: Live Camera QR Scanner */}
                {scanMethod === 'camera' && (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square flex items-center justify-center border border-slate-800">
                      <div id={cameraContainerId} className="w-full h-full" />
                      {!isCameraScanning && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/95 text-white gap-3">
                          <Camera className="w-10 h-10 text-emerald-400" />
                          <div>
                            <p className="text-xs font-bold">Scan Barcode Kartu via Kamera</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Arahkan kamera ke Barcode QR pada Kartu Pengenal Pendaftaran Anda
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={startCamera}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer"
                          >
                            Aktifkan Kamera Pemindai
                          </button>
                        </div>
                      )}
                    </div>
                    {isCameraScanning && (
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CameraOff className="w-4 h-4" />
                        Matikan Kamera
                      </button>
                    )}
                    {cameraError && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                        {cameraError}
                      </div>
                    )}
                  </div>
                )}

                {/* LocalStorage Uploaded Card Preview & Privacy Guarantee */}
                {localUploadedCard && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                        <HardDrive className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Tersimpan di Local Storage Perangkat</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearLocalUploadedCard}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                        title="Hapus kartu yang diunggah dari Local Storage browser ini"
                      >
                        <Trash2 className="w-3 h-3" />
                        Hapus dari Perangkat
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      {localUploadedCard.previewDataUrl ? (
                        <img
                          src={localUploadedCard.previewDataUrl}
                          alt="Kartu Pengenal yang Diunggah"
                          className="w-14 h-20 object-cover rounded-xl border border-purple-200 shadow-2xs shrink-0 bg-white"
                        />
                      ) : (
                        <div className="w-14 h-20 rounded-xl border border-purple-200 bg-purple-50 flex items-center justify-center shrink-0 text-purple-600">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {localUploadedCard.participantName}
                        </p>
                        <p className="text-[11px] font-mono font-semibold text-purple-800">
                          ID: {localUploadedCard.participantId}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          File: {localUploadedCard.fileName}
                        </p>
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          Tidak dikirim ke Firebase
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {lookupError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{lookupError}</span>
                  </div>
                )}

                {/* Security & LocalStorage Info Box */}
                <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100 space-y-1.5 text-[11px] text-slate-600 leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-purple-950">
                    <Lock className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                    <span>Proteksi Privasi &amp; Keamanan Sertifikat</span>
                  </div>
                  <p>
                    • <strong>Tanpa Input Nomor ID:</strong> Pencarian manual dengan Nomor ID
                    dinonaktifkan agar peserta lain tidak dapat menebak ID (<code>HY-001</code>,{' '}
                    <code>HY-002</code>) dan mengakses sertifikat milik Anda.
                  </p>
                  <p>
                    • <strong>100% Local Storage Pengguna:</strong> Kartu pengenal / foto / barcode
                    yang Anda unggah diproses langsung di browser perangkat Anda dan{' '}
                    <strong>tidak pernah disimpan ke server/Firebase</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Verification Result, Post-Workshop Evaluation & Certificate Download */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {!verifiedParticipant ? (
                <div className="bg-white/90 rounded-3xl border border-purple-100 p-8 text-center space-y-4 shadow-xs">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <div className="max-w-md mx-auto">
                    <h3 className="text-base font-bold text-slate-900">
                      Unggah Kartu Pengenal / Foto / Barcode Anda
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      Silakan klik tombol{' '}
                      <strong>Upload Kartu Pengenal Pendaftaran / Foto / Barcode</strong> di panel
                      sebelah kiri (atau pindai dengan kamera) untuk memverifikasi identitas Anda,
                      mengisi evaluasi acara, dan mengunduh E-Sertifikat resmi.
                    </p>
                  </div>
                </div>
              ) : verifiedParticipant.status === 'PENDING' ? (
                /* Participant found via Barcode, but has NOT checked in at the event yet */
                <div className="bg-white rounded-3xl border border-amber-200 shadow-xs overflow-hidden">
                  <div className="p-5 bg-amber-50 border-b border-amber-200 flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-950">
                        Identitas Terbaca · Menunggu Check-in Kehadiran
                      </span>
                      <h3 className="text-base font-bold text-amber-950 mt-1">
                        {verifiedParticipant.name}
                      </h3>
                      <p className="text-xs text-amber-900/90 mt-0.5">
                        ID Presensi: <strong className="font-mono">{verifiedParticipant.id}</strong>{' '}
                        · {verifiedParticipant.role || 'Peserta Workshop'} · {verifiedParticipant.institution}
                        {verifiedParticipant.phone ? ` · WA: ${verifiedParticipant.phone}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-xs text-amber-950 leading-relaxed space-y-1.5">
                      <p className="font-bold">
                        Mengapa E-Sertifikat saya belum dapat diunduh?
                      </p>
                      <p>
                        Kartu Pengenal Anda valid dan terdaftar, namun status presensi Anda masih{' '}
                        <strong>BELUM CHECK-IN (PENDING)</strong>. E-Sertifikat dan Formulir
                        Evaluasi Pasca-Workshop akan terbuka secara otomatis setelah Barcode Kartu
                        Peserta Anda dipindai oleh panitia saat menghadiri acara.
                      </p>
                    </div>

                    {verifiedCardPreviewUrl && (
                      <div className="flex flex-col items-center gap-3">
                        <img
                          src={verifiedCardPreviewUrl}
                          alt={`Kartu Peserta ${verifiedParticipant.name}`}
                          className="w-full max-w-[270px] rounded-2xl shadow-md border border-purple-100"
                        />
                        <button
                          type="button"
                          onClick={handleDownloadVerifiedCard}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-purple-900 hover:bg-purple-950 text-white transition-all cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          Unduh Kartu Pengenal QR (PNG)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Participant HAS attended (PRESENT or LATE)! Show Evaluation Gate + Certificate Claim */
                <div className="space-y-5">
                  <div className="bg-white rounded-3xl border border-emerald-200 shadow-xs overflow-hidden">
                    <div className="p-5 bg-emerald-950 text-white flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                              Barcode Terverifikasi ·{' '}
                              {verifiedParticipant.status === 'PRESENT'
                                ? 'Hadir Tepat Waktu'
                                : 'Hadir'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-emerald-200 border border-emerald-400/30">
                              SIG-{computeParticipantQrSignature(verifiedParticipant.id)}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-white mt-1">
                            {verifiedParticipant.name}
                          </h3>
                          <p className="text-xs text-emerald-200 font-mono">
                            {verifiedCertNumber}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleClearLocalUploadedCard}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-emerald-100 transition-all cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Scan Kartu Lain
                      </button>
                    </div>

                    {/* Step 1: Post-Workshop Evaluation Form (Shown if not yet submitted OR if editing) */}
                    {(!currentFeedback || isEditingFeedback) && (
                      <form onSubmit={handleFeedbackSubmit} className="p-6 space-y-5">
                        <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200/80 flex items-start gap-3">
                          <MessageSquareHeart className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-950">
                              Evaluasi Pasca-Workshop &amp; Klaim E-Sertifikat Mandiri
                            </h4>
                            <p className="text-xs text-purple-900 mt-0.5 leading-relaxed">
                              Identitas Barcode Anda telah terverifikasi! Mohon isi umpan balik
                              evaluasi singkat di bawah ini untuk membuka unduhan{' '}
                              <strong>E-Sertifikat Resmi</strong> Anda.
                            </p>
                          </div>
                        </div>

                        {feedbackError && (
                          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{feedbackError}</span>
                          </div>
                        )}

                        {/* 3 Star Rating Dimensions */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {[
                            {
                              label: 'Kepuasan Acara',
                              sub: 'Kesan keseluruhan',
                              val: overallRating,
                              setVal: setOverallRating,
                            },
                            {
                              label: 'Materi & Narasumber',
                              sub: 'Kualitas pemaparan',
                              val: speakerRating,
                              setVal: setSpeakerRating,
                            },
                            {
                              label: 'Panitia & Fasilitas',
                              sub: 'Pelayanan & kenyamanan',
                              val: facilityRating,
                              setVal: setFacilityRating,
                            },
                          ].map((item) => (
                            <div
                              key={item.label}
                              className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col items-center text-center"
                            >
                              <span className="text-xs font-bold text-slate-800">
                                {item.label}
                              </span>
                              <span className="text-[10px] text-slate-500 mb-2">{item.sub}</span>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => item.setVal(star)}
                                    className="p-1 cursor-pointer transition-transform hover:scale-110"
                                  >
                                    <Star
                                      className={cn(
                                        'w-5 h-5',
                                        star <= item.val
                                          ? 'fill-amber-400 text-amber-400'
                                          : 'text-slate-300'
                                      )}
                                    />
                                  </button>
                                ))}
                              </div>
                              <span className="text-[11px] font-bold text-amber-700 mt-1">
                                {item.val} / 5 Bintang
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Main Takeaway / Impression */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Kesan, Pesan &amp; Manfaat Utama yang Anda Dapatkan{' '}
                            <span className="text-rose-500">*</span>
                          </label>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {QUICK_TAKEAWAY_CHIPS.map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() =>
                                  setTakeaway((prev) => (prev ? `${prev}. ${chip}` : chip))
                                }
                                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 transition-all cursor-pointer"
                              >
                                + {chip}
                              </button>
                            ))}
                          </div>
                          <textarea
                            rows={3}
                            required
                            value={takeaway}
                            onChange={(e) => setTakeaway(e.target.value)}
                            placeholder="Tuliskan insight, manfaat yang dirasakan, atau masukan membangun untuk penyelenggara..."
                            className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/25 focus:border-purple-500 focus:bg-white transition-all"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                              Usulan Topik Workshop Selanjutnya (Opsional)
                            </label>
                            <input
                              type="text"
                              value={suggestedTopic}
                              onChange={(e) => setSuggestedTopic(e.target.value)}
                              placeholder="Contoh: Inner Child Healing, Manajemen Cemas..."
                              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/25 focus:border-purple-500 focus:bg-white transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                              Rekomendasi Acara
                            </label>
                            <select
                              value={recommendation}
                              onChange={(e) =>
                                setRecommendation(e.target.value as FeedbackRecommendation)
                              }
                              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/25 focus:border-purple-500 focus:bg-white transition-all"
                            >
                              <option value="Sangat Merekomendasikan">
                                Sangat Merekomendasikan
                              </option>
                              <option value="Merekomendasikan">Merekomendasikan</option>
                              <option value="Cukup">Cukup</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 pt-1">
                          {isEditingFeedback && (
                            <button
                              type="button"
                              onClick={() => setIsEditingFeedback(false)}
                              className="px-4 py-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                            >
                              Batal
                            </button>
                          )}
                          <button
                            type="submit"
                            className="flex-1 py-3.5 px-5 rounded-xl text-sm font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <FileCheck2 className="w-4 h-4" />
                            {currentFeedback
                              ? 'Simpan Perubahan Evaluasi & Tampilkan E-Sertifikat'
                              : 'Kirim Evaluasi & Klaim E-Sertifikat Resmi Saya'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Step 2: Unlocked E-Certificate Preview & High-Res Download */}
                    {currentFeedback && !isEditingFeedback && (
                      <div className="p-6 space-y-5">
                        {justSubmittedFeedback && (
                          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>
                              Terima kasih atas evaluasi Anda! E-Sertifikat resmi Anda kini telah
                              terbuka dan siap diunduh.
                            </span>
                          </div>
                        )}

                        {/* Official Certificate Metadata & Signers */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-xs">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Pemegang Sertifikat &amp; Kartu Pengenal
                            </span>
                            <span className="font-bold text-slate-900 block mt-0.5">
                              {verifiedParticipant.name}
                            </span>
                            <span className="text-purple-800 font-semibold block">
                              {verifiedParticipant.role || 'Peserta Workshop'} · {verifiedParticipant.institution || '-'}
                            </span>
                            {verifiedParticipant.phone && (
                              <span className="text-slate-500 font-mono text-[11px] block">
                                WA: {verifiedParticipant.phone}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Pejabat Penandatangan
                            </span>
                            <span className="font-semibold text-slate-800 block mt-0.5">
                              1. {certificateSettings.signer1Name} (
                              {certificateSettings.signer1Title})
                            </span>
                            {certificateSettings.enableSigner2 && (
                              <span className="font-semibold text-slate-800 block">
                                2. {certificateSettings.signer2Name} (
                                {certificateSettings.signer2Title})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Live Rendered Botanical Certificate Preview */}
                        <div className="relative rounded-2xl bg-slate-100 border border-slate-200 p-3 flex items-center justify-center min-h-[260px]">
                          {isRenderingCert || !certPreviewUrl ? (
                            <div className="flex flex-col items-center gap-2 py-12 text-slate-500">
                              <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                              <span className="text-xs font-medium">
                                Merender E-Sertifikat Resmi Anda...
                              </span>
                            </div>
                          ) : (
                            <div className="relative group w-full">
                              <img
                                src={certPreviewUrl}
                                alt={`E-Sertifikat ${verifiedParticipant.name}`}
                                onClick={() => setIsZoomModalOpen(true)}
                                className="w-full h-auto rounded-xl shadow-md cursor-zoom-in"
                              />
                              <button
                                type="button"
                                onClick={() => setIsZoomModalOpen(true)}
                                className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-slate-900/80 text-white text-xs font-semibold backdrop-blur-xs hover:bg-slate-900 inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                                Perbesar
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Primary Download & Edit Evaluation Actions */}
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            disabled={isDownloadingCert}
                            onClick={handleDownloadCertificate}
                            className="flex-1 py-3.5 px-5 rounded-xl text-sm font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                          >
                            <Download className="w-4 h-4" />
                            {isDownloadingCert
                              ? 'Menyiapkan File PNG Resolusi Tinggi...'
                              : 'Unduh E-Sertifikat Resmi (PNG Resolusi Tinggi)'}
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsEditingFeedback(true)}
                            className="px-4 py-3.5 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <MessageSquareHeart className="w-4 h-4 text-purple-700" />
                            Ubah Evaluasi ({currentFeedback.overallRating}★)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="py-5 text-center text-xs text-slate-400 border-t border-purple-100/60 bg-white/50">
        Portal Resmi Peserta · Heal You ({activeConfig.organizer || 'Muslimah Healing Journey'})
      </footer>

      {/* Certificate Fullscreen Zoom Modal */}
      {isZoomModalOpen && certPreviewUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsZoomModalOpen(false)}
        >
          <div
            className="relative max-w-5xl w-full bg-white rounded-3xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Pratinjau E-Sertifikat Resmi · {verifiedParticipant?.name}
                </h4>
                <p className="text-xs text-slate-500 font-mono">{verifiedCertNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCertificate}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh PNG
                </button>
                <button
                  type="button"
                  onClick={() => setIsZoomModalOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <img
              src={certPreviewUrl}
              alt="Pratinjau Penuh E-Sertifikat"
              className="w-full h-auto rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* Share QR Link Modal (for Admin Preview) */}
      {showShareQrModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowShareQrModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-left">
                <Share2 className="w-4 h-4 text-purple-700" />
                <h4 className="text-sm font-bold text-slate-900">
                  QR &amp; Link Pendaftaran Mandiri Peserta
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowShareQrModal(false)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100 inline-block mx-auto">
              <QRCodeCanvas
                value={shareRegistrationUrl}
                size={200}
                level="M"
                includeMargin={true}
                fgColor="#261742"
                bgColor="#ffffff"
              />
            </div>

            <p className="text-xs text-slate-600">
              Bagikan QR Code atau tautan di bawah ini kepada calon peserta. Peserta yang membuka
              tautan ini <strong>hanya dapat mengakses formulir pendaftaran &amp; cek sertifikat</strong>.
            </p>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600 break-all text-left">
              {shareRegistrationUrl}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyPortalUrl('register')}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-purple-900 hover:bg-purple-950 text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copiedPortalLink === 'register' ? (
                  <>
                    <Check className="w-4 h-4" />
                    Tautan Disalin!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Salin Link Pendaftaran
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleCopyPortalUrl('certificate')}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copiedPortalLink === 'certificate' ? (
                  <>
                    <Check className="w-4 h-4" />
                    Tautan Klaim Disalin!
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    Salin Link Klaim Sertifikat
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
