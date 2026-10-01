import React, { useState, useEffect, useRef, useId } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QRCodeCanvas } from 'qrcode.react';
import { useAppContext } from '../store';
import { Participant, WorkshopConfig, FeedbackRecommendation } from '../types';
import { HealYouLogo } from './HealYouLogo';
import {
  renderParticipantCardCanvas,
  buildParticipantPortalUrl,
  copyPortalLinkWithTitle,
  formatSafeDateStr,
  formatSafeTimeStr,
} from '../lib/whatsapp';
import {
  RegistrationFormTemplate,
  loadRegistrationTemplate,
  saveRegistrationTemplate,
  isParticipantPaymentVerified,
  markParticipantPaymentVerified,
  normalizePhoneForPaymentCode,
  saveParticipantTransferSubmission,
  computeApprovalSignature,
  verifyApprovalSignature,
  getCertificateClaimStatus,
} from '../lib/registrationTemplate';
import { RegistrationFormEditorModal } from './RegistrationFormEditorModal';
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
  ExternalLink,
  CreditCard,
  KeyRound,
  Unlock,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ParticipantPortalViewProps {
  initialTab?: 'register' | 'certificate';
  configFallback?: WorkshopConfig;
  isAdminPreview?: boolean;
  openEditorInitially?: boolean;
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
  openEditorInitially = false,
  onExitAdminPreview,
}) => {
  const {
    participants,
    config: storeConfig,
    certificateSettings,
    feedbacks,
    submitParticipantFeedback,
    activeWorkshopId,
    canManageParticipants,
    canVerifyPayment,
    registerParticipant,
    updateParticipant,
    verifyParticipantPayment,
    updateConfig,
  } = useAppContext();

  const activeConfig = storeConfig?.name ? storeConfig : configFallback || storeConfig;
  const localCardStorageKey = `heal_you_local_uploaded_card_${activeWorkshopId}`;
  const localSelfRegKey = `heal_you_self_reg_${activeWorkshopId}`;

  const [formTemplate, setFormTemplate] = useState<RegistrationFormTemplate>(() =>
    loadRegistrationTemplate(activeWorkshopId)
  );
  const [isFormEditorOpen, setIsFormEditorOpen] = useState<boolean>(openEditorInitially);
  const [certNowMs, setCertNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCertNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const certClaimStatus = getCertificateClaimStatus(
    activeConfig.startTime,
    Boolean(formTemplate.certificateClaimAdminApproved || activeConfig.certificateClaimApproved),
    certNowMs
  );
  const startTimeFormatted = formatSafeTimeStr(activeConfig.startTime);
  const certUnlockTimeFormatted = formatSafeTimeStr(
    new Date(certClaimStatus.unlockTimeMs).toISOString()
  );

  const handleToggleCertClaimApproval = (approved: boolean) => {
    const updated = saveRegistrationTemplate(activeWorkshopId, {
      ...formTemplate,
      certificateClaimAdminApproved: approved,
    });
    setFormTemplate(updated);
    updateConfig({ certificateClaimApproved: approved });
    playScanBeep(approved ? 'success' : 'warning');
  };

  useEffect(() => {
    setFormTemplate(loadRegistrationTemplate(activeWorkshopId));
  }, [activeWorkshopId]);

  useEffect(() => {
    const handleTemplateUpdate = (evt: Event) => {
      const customEvt = evt as CustomEvent<{
        workshopId: string;
        template: RegistrationFormTemplate;
      }>;
      if (
        !customEvt.detail?.workshopId ||
        customEvt.detail.workshopId === activeWorkshopId
      ) {
        setFormTemplate(loadRegistrationTemplate(activeWorkshopId));
      }
    };
    window.addEventListener('healyou-registration-template-updated', handleTemplateUpdate);
    const handlePaymentVerifyUpdate = () => setPaymentVerifyTick((t) => t + 1);
    window.addEventListener('healyou-payment-verification-updated', handlePaymentVerifyUpdate);
    const handleStorageChange = () => {
      setFormTemplate(loadRegistrationTemplate(activeWorkshopId));
      setPaymentVerifyTick((t) => t + 1);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('healyou-registration-template-updated', handleTemplateUpdate);
      window.removeEventListener('healyou-payment-verification-updated', handlePaymentVerifyUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [activeWorkshopId]);

  const [isEditingQuotaInline, setIsEditingQuotaInline] = useState<boolean>(false);
  const [quotaInputDraft, setQuotaInputDraft] = useState<string>('30');

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const slug = formTemplate.shareLinkSlug || 'HealYou-Pendaftaran';
      document.title = `${slug} | ${formTemplate.invitationTitle || 'Heal You'}`;
    }
  }, [formTemplate.shareLinkSlug, formTemplate.invitationTitle]);

  const [portalTab, setPortalTab] = useState<'register' | 'certificate'>(initialTab);
  const [hideAdminBanner, setHideAdminBanner] = useState(false);
  const [copiedPortalLink, setCopiedPortalLink] = useState<'register' | 'certificate' | null>(null);
  const [showShareQrModal, setShowShareQrModal] = useState(false);

  // Tab 1: Self-Registration Form State ("Muslimah Healing Day! 🌷" format)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [domicile, setDomicile] = useState('');
  const [role, setRole] = useState('');
  const [feelingBeforeEvent, setFeelingBeforeEvent] = useState<string>('');
  const [followedHealYou, setFollowedHealYou] = useState<string>('');
  const [healingWoundChoice, setHealingWoundChoice] = useState<string>('');
  const [healingWoundOther, setHealingWoundOther] = useState<string>('');
  const [hopeOrPrayer, setHopeOrPrayer] = useState<string>('');
  const [transferFileName, setTransferFileName] = useState<string>('');
  const [transferPreviewDataUrl, setTransferPreviewDataUrl] = useState<string>('');
  const [paymentVerifyTick, setPaymentVerifyTick] = useState<number>(0);
  const [showAdminApprovalModal, setShowAdminApprovalModal] = useState<boolean>(false);
  const [approvalModalFilter, setApprovalModalFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED'>(
    'ALL'
  );
  const [lookupStatusInput, setLookupStatusInput] = useState<string>('');
  const [lookupStatusMessage, setLookupStatusMessage] = useState<string | null>(null);
  const [reuploadSuccessNotice, setReuploadSuccessNotice] = useState<boolean>(false);
  const reuploadInputRef = useRef<HTMLInputElement | null>(null);
  const [followedSupporter, setFollowedSupporter] = useState<string>('');
  const [commitmentStatement, setCommitmentStatement] = useState<string>('');
  const [copiedRekening, setCopiedRekening] = useState(false);
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [viewModeAfterReg, setViewModeAfterReg] = useState<'card' | 'form'>(
    isAdminPreview ? 'form' : 'card'
  );
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

  // Keep registeredParticipant synced with live participant updates (all 4 profile fields + status + payment approval)
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
        fresh.email !== registeredParticipant.email ||
        fresh.paymentVerified !== registeredParticipant.paymentVerified ||
        fresh.paymentProofUrl !== registeredParticipant.paymentProofUrl ||
        fresh.paymentVerifiedBy !== registeredParticipant.paymentVerifiedBy)
    ) {
      setRegisteredParticipant(fresh);
    }
  }, [participants, registeredParticipant]);

  // Handle signed approval link from Admin/Panitia WhatsApp (?pid=HY-XXX&acc=ACC-...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const pidParam = params.get('pid')?.trim().toUpperCase();
      const accParam = params.get('acc')?.trim().toUpperCase();
      if (!pidParam) return;

      const isSignedValid = accParam
        ? verifyApprovalSignature(pidParam, activeWorkshopId, accParam)
        : false;

      let target = participants.find((p) => p.id.toUpperCase() === pidParam) || null;

      if (!target && params.get('name')) {
        target = {
          id: pidParam,
          name: params.get('name') || 'Peserta Workshop',
          phone: params.get('phone') || '',
          role: params.get('role') || 'Peserta Workshop',
          institution: params.get('dom') || '-',
          email: '-',
          status: 'PENDING',
          paymentVerified: isSignedValid,
          paymentVerifiedBy: isSignedValid ? 'Admin / Panitia' : undefined,
        };
      }

      if (target) {
        if (isSignedValid) {
          markParticipantPaymentVerified(
            activeWorkshopId,
            target.phone,
            target.id,
            'ADMIN-ACC',
            'Admin / Panitia'
          );
          target = {
            ...target,
            paymentVerified: true,
            paymentVerifiedBy: target.paymentVerifiedBy || 'Admin / Panitia',
          };
        }
        setRegisteredParticipant(target);
        setVerifiedParticipant(target);
        setViewModeAfterReg('card');
        setPaymentVerifyTick((t) => t + 1);
      }
    } catch {
      // Ignore URL parse error
    }
  }, [activeWorkshopId, participants.length]);

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
      const cleanAcc =
        formTemplate.q9BankAccount.replace(/[^0-9]/g, '') ||
        formTemplate.q9BankAccount ||
        '8901562030';
      await navigator.clipboard.writeText(cleanAcc);
      setCopiedRekening(true);
      window.setTimeout(() => setCopiedRekening(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleStartEditRegistered = (target: Participant) => {
    setEditingParticipantId(target.id);
    setViewModeAfterReg('form');
    setJustUpdatedData(false);
    setFormError(null);
    setDuplicateParticipant(null);
    setFullName(target.name);
    setPhone(target.phone || '');
    setRole(target.role || '');
    setDomicile(target.institution || '');
    if (savedFormDetails && savedFormDetails.participantId.toUpperCase() === target.id.toUpperCase()) {
      setFeelingBeforeEvent(
        savedFormDetails.feelingBeforeEvent || formTemplate.q5FeelingOptions[0] || 'Senang dan antusias! 😍'
      );
      setFollowedHealYou(
        savedFormDetails.followedHealYou || formTemplate.q6FollowOptions[0] || 'Sudah dong :)'
      );
      if (formTemplate.q7WoundOptions.includes(savedFormDetails.healingTarget)) {
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
        savedFormDetails.commitmentStatement ||
          formTemplate.q11CommitmentOptions[0] ||
          COMMITMENT_OPTIONS[0]
      );
    } else {
      setFeelingBeforeEvent(formTemplate.q5FeelingOptions[0] || 'Senang dan antusias! 😍');
      setFollowedHealYou(formTemplate.q6FollowOptions[0] || 'Sudah dong :)');
      setHealingWoundChoice(formTemplate.q7WoundOptions[0] || 'Anxiety');
      setTransferFileName('Bukti_Transfer_Tersimpan.jpg');
      setCommitmentStatement(formTemplate.q11CommitmentOptions[0] || COMMITMENT_OPTIONS[0]);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setDuplicateParticipant(null);

    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanFavoriteActivity = role.trim();
    const cleanDomicile = domicile.trim();
    const cleanEmail = email.trim() || '-';
    const resolvedHealingTarget =
      healingWoundChoice === 'OTHER' ? healingWoundOther.trim() : healingWoundChoice.trim();

    if (!cleanName) {
      setFormError(`Shalihah, mohon isi "${formTemplate.q1NameLabel}" terlebih dahulu ya 😊💕`);
      return;
    }
    if (!cleanPhone) {
      setFormError(`Shalihah, mohon isi "${formTemplate.q2PhoneLabel}" terlebih dahulu ya 📞`);
      return;
    }
    if (!cleanFavoriteActivity) {
      setFormError(`Shalihah, mohon isi "${formTemplate.q3RoleLabel}" terlebih dahulu ya 💕`);
      return;
    }
    if (!cleanDomicile) {
      setFormError(`Shalihah, mohon isi "${formTemplate.q4DomicileLabel}" terlebih dahulu ya 🌏🌱`);
      return;
    }
    if (!followedHealYou) {
      setFormError(`Mohon pilih jawaban pada "${formTemplate.q6FollowLabel}" dulu ya, Shalihah 🤩`);
      return;
    }
    if (!resolvedHealingTarget) {
      setFormError(`Mohon pilih atau tuliskan "${formTemplate.q7WoundLabel}" ya 🖤`);
      return;
    }
    if (formTemplate.q9TransferEnabled && !transferFileName) {
      setFormError(`Mohon unggah file "${formTemplate.q9TransferLabel}" terlebih dahulu ya 🌷`);
      return;
    }
    if (!commitmentStatement) {
      setFormError('Mohon pilih pernyataan kesiapan di bagian akhir formulir ya 🌸');
      return;
    }

    const requiresAdminApproval =
      formTemplate.q9TransferEnabled && formTemplate.paymentAccessCodeRequired;

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
      const keepApproved = Boolean(
        existingMatch.paymentVerified &&
          isParticipantPaymentVerified(activeWorkshopId, cleanPhone, existingMatch.id)
      );
      const updated = updateParticipant(
        existingMatch.id,
        {
          name: cleanName,
          phone: cleanPhone,
          role: cleanFavoriteActivity || 'Peserta Workshop',
          institution: cleanDomicile,
          paymentProofUrl: transferPreviewDataUrl || existingMatch.paymentProofUrl,
          paymentFileName: transferFileName || existingMatch.paymentFileName,
          paymentVerified: requiresAdminApproval ? keepApproved : true,
        },
        { allowSelfUpdate: true }
      );
      savedParticipant = updated || {
        ...existingMatch,
        name: cleanName,
        phone: cleanPhone,
        role: cleanFavoriteActivity || 'Peserta Workshop',
        institution: cleanDomicile,
        paymentProofUrl: transferPreviewDataUrl || existingMatch.paymentProofUrl,
        paymentFileName: transferFileName || existingMatch.paymentFileName,
        paymentVerified: requiresAdminApproval ? keepApproved : true,
      };
      saveParticipantTransferSubmission(activeWorkshopId, {
        participantId: savedParticipant.id,
        phone: cleanPhone,
        proofDataUrl: transferPreviewDataUrl || existingMatch.paymentProofUrl,
        proofFileName: transferFileName || existingMatch.paymentFileName,
        keepVerifiedIfAlreadyApproved: true,
      });
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
          paymentVerified: !requiresAdminApproval,
          paymentProofUrl: transferPreviewDataUrl,
          paymentFileName: transferFileName,
          paymentSubmittedAt: new Date().toISOString(),
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

    if (!requiresAdminApproval) {
      markParticipantPaymentVerified(
        activeWorkshopId,
        cleanPhone,
        savedParticipant.id,
        'AUTO',
        'Otomatis'
      );
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
    setDomicile('');
    setRole('');
    setHopeOrPrayer('');
    setViewModeAfterReg('card');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const isRegisteredCardUnlocked =
    !formTemplate.q9TransferEnabled ||
    !formTemplate.paymentAccessCodeRequired ||
    Boolean(
      registeredParticipant &&
        (registeredParticipant.status === 'PRESENT' ||
          registeredParticipant.status === 'LATE' ||
          registeredParticipant.paymentVerified === true ||
          isParticipantPaymentVerified(
            activeWorkshopId,
            registeredParticipant.phone,
            registeredParticipant.id
          ))
    );
  // Reference paymentVerifyTick so React re-evaluates unlock state immediately
  void paymentVerifyTick;

  const handleReuploadTransferProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !registeredParticipant) return;
    if (file.size > 10 * 1024 * 1024) return;
    const preview = await compressTransferProofForLocal(file);
    saveParticipantTransferSubmission(activeWorkshopId, {
      participantId: registeredParticipant.id,
      phone: registeredParticipant.phone,
      proofDataUrl: preview,
      proofFileName: file.name,
      keepVerifiedIfAlreadyApproved: true,
    });
    const updated = updateParticipant(
      registeredParticipant.id,
      {
        paymentProofUrl: preview,
        paymentFileName: file.name,
      },
      { allowSelfUpdate: true }
    );
    if (updated) {
      setRegisteredParticipant(updated);
    }
    if (savedFormDetails) {
      const nextForm = {
        ...savedFormDetails,
        transferFileName: file.name,
        transferPreviewDataUrl: preview,
      };
      setSavedFormDetails(nextForm);
      try {
        localStorage.setItem(localFormDetailsKey, JSON.stringify(nextForm));
      } catch {
        // Ignore
      }
    }
    setReuploadSuccessNotice(true);
    window.setTimeout(() => setReuploadSuccessNotice(false), 3000);
    setPaymentVerifyTick((t) => t + 1);
  };

  const handleLookupRegistrationStatus = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupStatusMessage(null);
    const q = lookupStatusInput.trim();
    if (!q) return;
    const normQPhone = normalizePhoneForPaymentCode(q);
    const found = participants.find(
      (p) =>
        p.id.toUpperCase() === q.toUpperCase() ||
        (normQPhone.length >= 6 &&
          normalizePhoneForPaymentCode(p.phone || '') === normQPhone) ||
        p.name.toLowerCase() === q.toLowerCase()
    );
    if (!found) {
      setLookupStatusMessage(
        'Data pendaftaran tidak ditemukan. Pastikan memasukkan Nomor WhatsApp atau ID Peserta (HY-XXX) yang digunakan saat mendaftar.'
      );
      return;
    }
    setRegisteredParticipant(found);
    setVerifiedParticipant(found);
    try {
      localStorage.setItem(localSelfRegKey, found.id);
    } catch {
      // Ignore
    }
    setLookupStatusInput('');
    setViewModeAfterReg('card');
  };

  const adminWaDisplay =
    formTemplate.adminConfirmationWhatsapp &&
    formTemplate.adminConfirmationWhatsapp !== '081234567890'
      ? formTemplate.adminConfirmationWhatsapp
      : '085772904491';

  const buildRequestAdminApprovalWhatsAppUrl = (params: {
    name: string;
    phone: string;
    role: string;
    domicile: string;
    transferFile: string;
    participantId?: string;
  }) => {
    const normAdmin = normalizePhoneForPaymentCode(adminWaDisplay);
    const waAdminTarget = normAdmin ? `62${normAdmin}` : '6285772904491';
    const lines = [
      `Assalamu'alaikum Admin / Panitia *${activeConfig.organizer || 'Heal You'}* 🌸`,
      '',
      `Saya telah mengisi formulir pendaftaran dan mengunggah bukti transfer untuk acara *${formTemplate.invitationTitle || activeConfig.name}*. Mohon bantuannya untuk *Verifikasi / Approval (ACC)* pembayaran saya agar *Kartu Pengenal (Barcode QR)* saya aktif:`,
      '',
      params.participantId ? `• *ID Pendaftaran:* ${params.participantId}` : null,
      `• *Nama Peserta:* ${params.name || '-'}`,
      `• *No. WhatsApp:* ${params.phone || '-'}`,
      `• *Pekerjaan / Kegiatan:* ${params.role || '-'}`,
      `• *Tempat Tinggal / Domisili:* ${params.domicile || '-'}`,
      `• *Bukti Transfer:* ${params.transferFile || 'Sudah diunggah di formulir pendaftaran'}`,
      '',
      'Terima kasih banyak! 💕',
    ]
      .filter(Boolean)
      .join('\n');

    return `https://wa.me/${waAdminTarget}?text=${encodeURIComponent(lines)}`;
  };

  const buildSendApprovedCardLinkToParticipantWaUrl = (p: Participant) => {
    const cleanPhone = normalizePhoneForPaymentCode(p.phone || '');
    const waTarget = cleanPhone ? `62${cleanPhone}` : '';
    const basePortal = buildParticipantPortalUrl(activeWorkshopId, activeConfig, 'register');
    const accSig = computeApprovalSignature(p.id, activeWorkshopId);
    const sep = basePortal.includes('?') ? '&' : '?';
    const approvedUrl = `${basePortal}${sep}pid=${encodeURIComponent(p.id)}&name=${encodeURIComponent(p.name)}&phone=${encodeURIComponent(p.phone || '')}&dom=${encodeURIComponent(p.institution || '')}&role=${encodeURIComponent(p.role || '')}&acc=${encodeURIComponent(accSig)}`;

    const msg = [
      `Assalamu'alaikum Kak *${p.name}* 🌸`,
      `Alhamdulillah, pembayaran registrasi *${formTemplate.invitationTitle || activeConfig.name}* Anda (ID: *${p.id}*) telah *DIVERIFIKASI / DI-ACC* oleh Admin & Panitia.`,
      '',
      `✅ *Kartu Pengenal (Barcode QR)* resmi Anda kini sudah aktif dan dapat langsung dibuka serta diunduh melalui tautan berikut:`,
      approvedUrl,
      '',
      `Sampai jumpa di lokasi acara ya! 💕`,
    ].join('\n');

    return waTarget
      ? `https://wa.me/${waTarget}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  const handleDownloadRegisteredCard = async () => {
    if (!registeredParticipant || !isRegisteredCardUnlocked) return;
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
      const linkTitle =
        targetTab === 'register'
          ? formTemplate.shareLinkSlug || 'HealYou-Pendaftaran'
          : `${formTemplate.shareLinkSlug || 'HealYou-Pendaftaran'}-Sertifikat`;
      await copyPortalLinkWithTitle(url, linkTitle);
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

  // Real-time Participant Capacity (Kuota Peserta) & Verified (ACC) Counter
  const participantQuota = Math.max(
    1,
    formTemplate.participantQuota || activeConfig.quota || 30
  );
  const verifiedParticipantsCount = participants.filter(
    (p) => p.paymentVerified === true
  ).length;
  const unverifiedParticipantsCount = participants.filter(
    (p) => p.paymentVerified === false
  ).length;
  const remainingQuota = Math.max(0, participantQuota - verifiedParticipantsCount);
  const quotaFilledPercentage = Math.min(
    100,
    Math.round((verifiedParticipantsCount / Math.max(participantQuota, 1)) * 100)
  );
  const isQuotaLow = remainingQuota > 0 && remainingQuota <= 5;
  const isQuotaFull = remainingQuota === 0;

  const handleSaveQuotaInline = (targetQuota?: number) => {
    const parsed =
      typeof targetQuota === 'number'
        ? targetQuota
        : parseInt(quotaInputDraft.trim(), 10);
    const safeQuota =
      Number.isFinite(parsed) && parsed >= 1 ? Math.min(5000, Math.round(parsed)) : 30;
    const updatedTemplate = saveRegistrationTemplate(activeWorkshopId, {
      ...formTemplate,
      participantQuota: safeQuota,
    });
    setFormTemplate(updatedTemplate);
    updateConfig({ quota: safeQuota });
    setQuotaInputDraft(String(safeQuota));
    setIsEditingQuotaInline(false);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-900 bg-[#FAF9F6] selection:bg-purple-900 selection:text-white">
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
                certificateSettings.numberSuffix,
                activeWorkshopId
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
                certificateSettings.numberSuffix,
                activeWorkshopId
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

      {/* Single Unified Admin & Panitia Control Bar */}
      {(isAdminPreview || canManageParticipants || canVerifyPayment) && !hideAdminBanner && (
        <div className="bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-6 lg:px-10 py-2.5 sticky top-0 z-50 shadow-xs">
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                {canManageParticipants ? 'Mode Admin' : 'Mode Panitia'}
              </span>
              <span className="text-xs text-slate-300 hidden sm:inline">
                Sistem Verifikasi Pembayaran (ACC) &amp; Pratinjau Portal Peserta
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowAdminApprovalModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  Verifikasi Pembayaran (
                  {participants.filter((p) => p.paymentVerified === false).length} Menunggu)
                </span>
              </button>
              {canManageParticipants && (
                <button
                  type="button"
                  onClick={() => setIsFormEditorOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Formulir</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCopyPortalUrl('register')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors cursor-pointer"
              >
                {copiedPortalLink === 'register' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Link</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowShareQrModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-purple-300" />
                <span>QR</span>
              </button>
              <button
                type="button"
                onClick={() => setHideAdminBanner(true)}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Sembunyikan bar ini untuk melihat tampilan murni peserta"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
              {onExitAdminPreview && (
                <button
                  type="button"
                  onClick={onExitAdminPreview}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating button to restore admin bar if hidden */}
      {(isAdminPreview || canManageParticipants) && hideAdminBanner && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHideAdminBanner(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-slate-900/90 text-white shadow-lg hover:bg-slate-900 backdrop-blur-xs cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-purple-300" />
            <span>Bar Admin</span>
          </button>
          {onExitAdminPreview && (
            <button
              type="button"
              onClick={onExitAdminPreview}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-purple-700 text-white shadow-lg hover:bg-purple-800 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Panel Admin</span>
            </button>
          )}
        </div>
      )}

      {/* Full-Width Executive Top Navigation Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40">
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-tl-xl rounded-br-xl rounded-tr-xs rounded-bl-xs bg-[#FAF9F6] p-1 border border-slate-200/90 shrink-0 shadow-2xs">
              <HealYouLogo
                className="w-full h-full rounded-tl-[10px] rounded-br-[10px] rounded-tr-[2px] rounded-bl-[2px]"
                customLogoUrl={activeConfig.customLogoUrl}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold tracking-tight text-slate-900">
                  {activeConfig.organizer || 'Muslimah Healing Journey'}
                </span>
                <span className="text-slate-300 hidden md:inline" aria-hidden="true">
                  ·
                </span>
                <span
                  className="text-sm italic font-semibold text-purple-900"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  {activeConfig.tagline || "Let's Heal"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 truncate mt-0.5">
                <span>Portal Resmi Registrasi &amp; E-Sertifikat</span>
                {formTemplate.dateDisplay && (
                  <>
                    <span aria-hidden="true" className="hidden lg:inline">
                      ·
                    </span>
                    <span className="hidden lg:inline text-slate-600 font-medium truncate">
                      {formTemplate.dateDisplay}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Controls: Active Participant Toggle + Segmented Switcher */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {registeredParticipant && portalTab === 'register' && (
              <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAF9F6] border border-slate-200/80 text-xs">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    isRegisteredCardUnlocked ? 'bg-emerald-500' : 'bg-amber-500'
                  )}
                />
                <span className="text-slate-600">
                  Peserta: <strong className="text-slate-900">{registeredParticipant.name}</strong>
                </span>
                <span className="font-mono font-semibold text-purple-900">
                  ({registeredParticipant.id})
                </span>
              </div>
            )}

            <div className="bg-slate-100/90 p-1 rounded-xl border border-slate-200/70 grid grid-cols-2 gap-1 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setPortalTab('register')}
                className={cn(
                  'px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                  portalTab === 'register'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>01. Pendaftaran &amp; Kartu</span>
                {registeredParticipant && (
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded text-[10px] font-mono',
                      portalTab === 'register'
                        ? 'bg-emerald-400/20 text-emerald-200'
                        : 'bg-emerald-100 text-emerald-800'
                    )}
                  >
                    {registeredParticipant.id}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPortalTab('certificate')}
                className={cn(
                  'px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                  portalTab === 'certificate'
                    ? 'bg-emerald-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <Award className="w-3.5 h-3.5" />
                <span>02. Klaim E-Sertifikat</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Participant Portal Content — Widescreen 1440px Architectural Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8 flex flex-col gap-6">
        {/* TAB 1: WIDESCREEN REGISTRATION & CARD VIEW */}
        {portalTab === 'register' && (
          <div className="space-y-6">
            {/* Quick Toggle Banner when participant already registered */}
            {registeredParticipant && (
              <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 px-5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm">
                  <span
                    className={cn(
                      'w-2.5 h-2.5 rounded-full shrink-0',
                      isRegisteredCardUnlocked ? 'bg-emerald-500' : 'bg-amber-500'
                    )}
                  />
                  <span className="text-slate-700">
                    Status Pendaftaran:{' '}
                    <strong className="text-slate-900">{registeredParticipant.name}</strong> (
                    <span className="font-mono font-semibold text-purple-900">
                      {registeredParticipant.id}
                    </span>
                    ) ·{' '}
                    <span
                      className={cn(
                        'font-semibold',
                        isRegisteredCardUnlocked ? 'text-emerald-700' : 'text-amber-700'
                      )}
                    >
                      {isRegisteredCardUnlocked
                        ? 'Pembayaran Terverifikasi (Kartu QR Aktif)'
                        : 'Menunggu Verifikasi / ACC Admin & Panitia'}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingParticipantId(null);
                      setViewModeAfterReg('card');
                    }}
                    className={cn(
                      'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                      viewModeAfterReg === 'card' && !editingParticipantId
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    )}
                  >
                    Status &amp; Kartu QR Saya
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewModeAfterReg('form')}
                    className={cn(
                      'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                      viewModeAfterReg === 'form' || Boolean(editingParticipantId)
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    )}
                  >
                    {editingParticipantId ? 'Sedang Edit Data' : 'Lihat Undangan & Formulir'}
                  </button>
                </div>
              </div>
            )}

            {/* VIEW A: WIDESCREEN 12-COLUMN SPLIT — INVITATION DOSSIER (LEFT) + REGISTRATION FORM (RIGHT) */}
            {(!registeredParticipant || viewModeAfterReg === 'form' || Boolean(editingParticipantId)) && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
                {/* LEFT COLUMN (lg:col-span-5): STICKY EDITORIAL EVENT DOSSIER & RETURNING PARTICIPANT STATUS CHECK */}
                <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-5">
                  {!editingParticipantId && (
                    <section className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
                      {/* Regal Plum Editorial Header */}
                      <div
                        className="p-6 sm:p-7 text-white space-y-3"
                        style={{
                          background:
                            'linear-gradient(145deg, #24143d 0%, #3b2363 55%, #2b1847 100%)',
                        }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-purple-200/90">
                          <span>
                            Undangan Terbuka · {formTemplate.shareLinkSlug || 'HealYou-Pendaftaran'}
                          </span>
                          {formTemplate.greetingText && (
                            <span className="text-amber-200 font-medium">
                              {formTemplate.greetingText}
                            </span>
                          )}
                        </div>

                        <h2
                          className="text-2xl sm:text-3xl xl:text-[34px] font-bold text-white tracking-tight leading-tight"
                          style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                        >
                          {formTemplate.invitationTitle}
                        </h2>

                        {formTemplate.introParagraph1 && (
                          <p className="text-xs sm:text-sm text-purple-100/95 leading-relaxed font-medium pt-0.5">
                            {formTemplate.introParagraph1}
                          </p>
                        )}
                      </div>

                      <div className="p-6 sm:p-7 space-y-6">
                        {formTemplate.introParagraph2 && (
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                            {formTemplate.introParagraph2}
                          </p>
                        )}

                        {/* Architectural 2x2 "Save the Date" Information Matrix */}
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">
                              {formTemplate.saveTheDateTitle || 'Save the date:'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Jadwal &amp; Ketentuan
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 rounded-2xl border border-slate-200/80 bg-[#FAF9F6] divide-y sm:divide-y-0 sm:divide-x divide-slate-200/70 overflow-hidden">
                            <div className="p-4 space-y-2.5">
                              {formTemplate.dateDisplay && (
                                <div>
                                  <span className="block text-[11px] font-medium text-slate-400">
                                    Hari &amp; Tanggal
                                  </span>
                                  <p className="text-xs sm:text-sm font-semibold text-slate-900 mt-0.5">
                                    {formTemplate.dateDisplay}
                                  </p>
                                </div>
                              )}
                              {formTemplate.timeDisplay && (
                                <div className="pt-2 border-t border-slate-200/60">
                                  <span className="block text-[11px] font-medium text-slate-400">
                                    Waktu Pelaksanaan
                                  </span>
                                  <p className="text-xs sm:text-sm font-semibold text-slate-900 mt-0.5">
                                    {formTemplate.timeDisplay}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="p-4 space-y-2.5">
                              {formTemplate.locationDisplay && (
                                <div>
                                  <span className="block text-[11px] font-medium text-slate-400">
                                    Lokasi Tempat Acara
                                  </span>
                                  <p className="text-xs sm:text-sm font-semibold text-slate-900 mt-0.5">
                                    {formTemplate.locationDisplay}
                                  </p>
                                </div>
                              )}
                              {formTemplate.dresscodeDisplay && (
                                <div className="pt-2 border-t border-slate-200/60">
                                  <span className="block text-[11px] font-medium text-slate-400">
                                    Nuansa Busana (Dresscode)
                                  </span>
                                  <p className="text-xs sm:text-sm font-semibold text-slate-900 mt-0.5">
                                    {formTemplate.dresscodeDisplay}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Curated Benefit Bento Grid */}
                        {formTemplate.benefitItems.length > 0 && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">
                                {formTemplate.benefitTitle || 'Benefit yang kamu dapat:'}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                                {formTemplate.benefitItems.length} Fasilitas Peserta
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {formTemplate.benefitItems.map((benefit, idx) => (
                                <div
                                  key={idx}
                                  className="px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] border border-slate-200/70 flex items-center gap-2.5 text-xs font-medium text-slate-800"
                                >
                                  <span className="text-[10px] font-mono font-semibold text-purple-800 tabular-nums shrink-0">
                                    {String(idx + 1).padStart(2, '0')}
                                  </span>
                                  <span className="leading-snug">{benefit}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Minimalist Editorial Quote Footer */}
                        {(formTemplate.closingCallout || formTemplate.closingQuote) && (
                          <div className="pt-4 border-t border-slate-100 flex flex-col gap-1.5">
                            {formTemplate.closingCallout && (
                              <p className="text-xs sm:text-sm font-medium text-slate-800">
                                {formTemplate.closingCallout}
                              </p>
                            )}
                            {formTemplate.closingQuote && (
                              <blockquote
                                className="border-l-2 border-purple-800 pl-3.5 text-base sm:text-lg italic font-semibold text-purple-950 mt-1"
                                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                              >
                                {formTemplate.closingQuote}
                              </blockquote>
                            )}
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Quick Returning Participant Status Lookup Card (Always accessible on Left Column) */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>Sudah Mendaftar? Cek Status ACC &amp; Kartu QR</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setPortalTab('certificate')}
                        className="text-xs font-semibold text-purple-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Klaim Sertifikat</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Masukkan Nomor WhatsApp atau ID Peserta (<code className="font-mono">HY-XXX</code>)
                      untuk melihat apakah pembayaran sudah di-ACC Admin/Panitia dan mengunduh Kartu QR:
                    </p>
                    <form onSubmit={handleLookupRegistrationStatus} className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={lookupStatusInput}
                        onChange={(e) => {
                          setLookupStatusInput(e.target.value);
                          if (lookupStatusMessage) setLookupStatusMessage(null);
                        }}
                        placeholder="Ketik No. WhatsApp atau ID (HY-001)"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-slate-900"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-purple-950 text-white transition-colors cursor-pointer shrink-0"
                      >
                        Cek Status &amp; Kartu
                      </button>
                    </form>
                    {lookupStatusMessage && (
                      <p className="text-[11px] font-medium text-rose-600">{lookupStatusMessage}</p>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN (lg:col-span-7): EXECUTIVE MULTI-CHAPTER REGISTRATION FORM */}
                <form
                  onSubmit={handleRegisterSubmit}
                  className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden divide-y divide-slate-100"
                >
                {/* Sticky/Top Real-Time Participant Capacity (Kuota ACC) & Conversion Trigger Bar */}
                <div className="px-6 sm:px-8 py-5 bg-[#FAF9F6] flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        Lembar Registrasi Peserta
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Kolom bertanda <span className="text-rose-500 font-semibold">*</span> wajib
                        dilengkapi untuk penerbitan Kartu QR &amp; E-Sertifikat
                      </p>
                    </div>

                    {/* Live Capacity Counter + Admin Inline Edit Button */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className={cn(
                          'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold tabular-nums shadow-2xs',
                          isQuotaFull
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : isQuotaLow
                              ? 'bg-amber-50 border-amber-300 text-amber-950'
                              : 'bg-white border-slate-200/90 text-slate-800'
                        )}
                      >
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            isQuotaFull
                              ? 'bg-rose-600'
                              : isQuotaLow
                                ? 'bg-amber-500 animate-ping'
                                : 'bg-emerald-500'
                          )}
                        />
                        <span>
                          {verifiedParticipantsCount}/{participantQuota} Terisi ({quotaFilledPercentage}%)
                        </span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-md text-[10px] font-sans font-bold uppercase tracking-wider',
                            isQuotaFull
                              ? 'bg-rose-600 text-white'
                              : isQuotaLow
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-emerald-100 text-emerald-900'
                          )}
                        >
                          {isQuotaFull ? 'Penuh' : `Sisa ${remainingQuota} Kursi`}
                        </span>
                      </div>

                      {(canManageParticipants || canVerifyPayment || isAdminPreview) && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuotaInputDraft(String(participantQuota));
                            setIsEditingQuotaInline((prev) => !prev);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-purple-900 hover:bg-purple-950 text-white transition-colors cursor-pointer shadow-2xs"
                          title="Ubah kapasitas / kuota maksimal peserta acara ini"
                        >
                          <Pencil className="w-3 h-3 text-amber-300" />
                          <span>Ubah Kuota</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Admin/Panitia Quota Editor (toggled via Ubah Kuota) */}
                  {isEditingQuotaInline &&
                    (canManageParticipants || canVerifyPayment || isAdminPreview) && (
                      <div className="p-3.5 rounded-2xl bg-white border border-purple-200 shadow-xs space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-purple-950 block">
                              Atur Kapasitas / Kuota Maksimal Peserta
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Jumlah terisi ({verifiedParticipantsCount} peserta) dihitung otomatis
                              secara real-time dari peserta yang sudah di-ACC.
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={5000}
                              value={quotaInputDraft}
                              onChange={(e) => setQuotaInputDraft(e.target.value)}
                              className="w-20 px-2.5 py-1.5 rounded-xl border border-purple-300 text-xs font-mono font-bold text-slate-900 text-center focus:outline-none focus:border-purple-800"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveQuotaInline()}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                            >
                              Simpan
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingQuotaInline(false)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                          <span className="text-[11px] font-semibold text-slate-500 mr-1">
                            Pilih Cepat:
                          </span>
                          {[5, 10, 15, 20, 25, 30, 40, 50, 100].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleSaveQuotaInline(preset)}
                              className={cn(
                                'px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-colors cursor-pointer border',
                                participantQuota === preset
                                  ? 'bg-purple-900 text-white border-purple-900'
                                  : 'bg-slate-50 hover:bg-purple-50 text-slate-700 border-slate-200'
                              )}
                            >
                              {preset} Kursi
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Visual Capacity Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-200/90 overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all duration-500 rounded-full',
                        isQuotaFull
                          ? 'bg-rose-600'
                          : isQuotaLow
                            ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-500'
                      )}
                      style={{
                        width: `${
                          verifiedParticipantsCount > 0
                            ? Math.max(quotaFilledPercentage, 6)
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  {/* Dynamic Conversion / FOMO Scarcity Trigger Banner */}
                  <div
                    className={cn(
                      'px-3.5 py-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 transition-all',
                      isQuotaFull
                        ? 'bg-rose-50/90 border-rose-200 text-rose-900'
                        : isQuotaLow
                          ? 'bg-gradient-to-r from-amber-50 via-orange-50/90 to-rose-50 border-amber-300 text-amber-950 shadow-2xs'
                          : quotaFilledPercentage >= 50
                            ? 'bg-amber-50/70 border-amber-200/90 text-amber-950'
                            : 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
                    )}
                  >
                    <div className="flex items-center gap-2 font-medium leading-snug">
                      <Sparkles
                        className={cn(
                          'w-4 h-4 shrink-0',
                          isQuotaFull
                            ? 'text-rose-600'
                            : isQuotaLow
                              ? 'text-rose-600 animate-bounce'
                              : 'text-emerald-700'
                        )}
                      />
                      {isQuotaFull ? (
                        <span>
                          <strong>Kuota Utama Penuh ({participantQuota}/{participantQuota} Terisi)!</strong>{' '}
                          Segera daftar untuk mengamankan antrean prioritas jika ada kursi tambahan.
                        </span>
                      ) : isQuotaLow ? (
                        <span>
                          <strong className="text-rose-700 uppercase tracking-wide">
                            🔥 Kuota Hampir Habis! Tinggal {remainingQuota} Kursi Tersisa —
                          </strong>{' '}
                          <strong className="underline decoration-rose-400 underline-offset-2">
                            Segera daftar sekarang sebelum kuota habis!
                          </strong>
                        </span>
                      ) : quotaFilledPercentage >= 50 ? (
                        <span>
                          <strong>⚡ Peminat Sangat Antusias!</strong> Tersisa{' '}
                          <strong>{remainingQuota} kursi</strong> dari kuota {participantQuota}{' '}
                          peserta — <strong>Segera daftar sebelum kuota habis!</strong>
                        </span>
                      ) : (
                        <span>
                          <strong>✨ Kuota Terbatas {participantQuota} Peserta</strong> (Tersisa{' '}
                          <strong>{remainingQuota} kursi</strong>) —{' '}
                          <strong className="text-emerald-900">
                            Segera daftar &amp; amankan kursimu sebelum kuota habis!
                          </strong>
                        </span>
                      )}
                    </div>

                    {unverifiedParticipantsCount > 0 && !isQuotaFull && (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/90 border border-slate-200/80 text-slate-700 shrink-0">
                        ⏳ {unverifiedParticipantsCount} pendaftar sedang proses verifikasi
                      </span>
                    )}
                  </div>
                </div>

                {/* Error or Duplicate Alerts */}
                {(formError || duplicateParticipant) && (
                  <div className="p-6 sm:px-8 space-y-3 bg-rose-50/30">
                    {formError && (
                      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span className="font-medium">{formError}</span>
                      </div>
                    )}

                    {duplicateParticipant && (
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                        <div className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-xs font-bold text-amber-950">
                              Nomor WhatsApp Sudah Terdaftar, Shalihah! 💕
                            </h4>
                            <p className="text-xs text-amber-900 mt-1">
                              Kamu sudah terdaftar pada acara ini. Untuk melihat Kartu Pengenal atau
                              klaim E-Sertifikat, silakan gunakan{' '}
                              <strong>Kartu Pengenal Pendaftaran / Barcode QR</strong> pada tab{' '}
                              <strong>02. Klaim Sertifikat</strong>.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDuplicateParticipant(null);
                            setPortalTab('certificate');
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-800 text-white hover:bg-emerald-900 transition-all cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Buka Klaim Sertifikat / Kartu
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* CHAPTER 01: IDENTITAS & TEMPAT TINGGAL / DOMISILI (4 Pertanyaan Inti Kartu & E-Sertifikat) */}
                <div className="p-6 sm:p-8 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-purple-900">
                        01. Identitas &amp; Domisili Peserta
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Keempat data di bawah ini otomatis terhubung ke Kartu Pengenal QR dan
                        E-Sertifikat resmi kamu
                      </p>
                    </div>
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                      Sinkron Otomatis ke Kartu &amp; Sertifikat
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Q1: Nama */}
                    <div className="space-y-1.5">
                      <label className="block text-xs sm:text-sm font-semibold text-slate-900">
                        {formTemplate.q1NameLabel} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={formTemplate.q1NamePlaceholder}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] hover:bg-slate-50 focus:bg-white border border-slate-200/90 focus:border-slate-900 focus:outline-none text-sm text-slate-900 transition-colors placeholder:text-slate-400"
                      />
                      <p className="text-[11px] text-slate-400">
                        Dicetak sebagai nama penerima pada Kartu QR &amp; E-Sertifikat
                      </p>
                    </div>

                    {/* Q2: No WhatsApp */}
                    <div className="space-y-1.5">
                      <label className="block text-xs sm:text-sm font-semibold text-slate-900">
                        {formTemplate.q2PhoneLabel} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Contoh: 0812-3456-7890"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] hover:bg-slate-50 focus:bg-white border border-slate-200/90 focus:border-slate-900 focus:outline-none text-sm font-mono tabular-nums text-slate-900 transition-colors placeholder:font-sans placeholder:text-slate-400"
                      />
                      <p className="text-[11px] text-slate-400">
                        Nomor aktif untuk sinkronisasi Kartu Pengenal &amp; info acara
                      </p>
                    </div>

                    {/* Q3: Pekerjaan / Kegiatan Favorit */}
                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-semibold text-slate-900">
                        {formTemplate.q3RoleLabel} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="Contoh: Mahasiswi / Ibu Rumah Tangga / Karyawan"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] hover:bg-slate-50 focus:bg-white border border-slate-200/90 focus:border-slate-900 focus:outline-none text-sm text-slate-900 transition-colors placeholder:text-slate-400"
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          'Mahasiswi',
                          'Ibu Rumah Tangga',
                          'Karyawan Swasta',
                          'Wirausaha',
                          'Pendidik / Guru',
                          'Freelancer',
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setRole(preset)}
                            className={cn(
                              'px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer',
                              role === preset
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                            )}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Q4: Dibumi sebelah mana kamu tinggal? (Tempat Tinggal / Domisili) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="block text-xs sm:text-sm font-semibold text-slate-900">
                          {formTemplate.q4DomicileLabel} <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                          Tempat Tinggal / Domisili
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        value={domicile}
                        onChange={(e) => setDomicile(e.target.value)}
                        placeholder={formTemplate.q4DomicilePlaceholder}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] hover:bg-slate-50 focus:bg-white border border-slate-200/90 focus:border-slate-900 focus:outline-none text-sm text-slate-900 transition-colors placeholder:text-slate-400"
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          'Depok',
                          'Jakarta Selatan',
                          'Jakarta Timur',
                          'Bogor',
                          'Bekasi',
                          'Tangerang Selatan',
                        ].map((city) => (
                          <button
                            key={city}
                            type="button"
                            onClick={() => setDomicile(city)}
                            className={cn(
                              'px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer',
                              domicile === city
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                            )}
                          >
                            📍 {city}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CHAPTER 02: REFLEKSI DIRI & HARAPAN HEALING (Custom Tactile Cards — Zero Radio Circles) */}
                <div className="p-6 sm:p-8 space-y-7">
                  <div>
                    <span className="text-xs font-semibold text-purple-900">
                      02. Refleksi Diri &amp; Harapan Healing
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pilih kondisi yang paling menggambarkan perasaan dan harapanmu saat ini
                    </p>
                  </div>

                  {/* Q5: Gimana perasaan kamu sebelum ikut acara ini? */}
                  <div className="space-y-2.5">
                    <label className="block text-xs sm:text-sm font-semibold text-slate-900">
                      {formTemplate.q5FeelingLabel}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {formTemplate.q5FeelingOptions.map((opt) => {
                        const isSelected = feelingBeforeEvent === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setFeelingBeforeEvent(opt)}
                            className={cn(
                              'px-4 py-3 rounded-xl border text-left text-xs sm:text-sm transition-all flex items-center justify-between gap-3 cursor-pointer',
                              isSelected
                                ? 'bg-purple-50/60 border-slate-900 text-slate-900 font-semibold shadow-2xs'
                                : 'bg-[#FAF9F6] hover:bg-slate-50 border-slate-200/80 text-slate-700'
                            )}
                          >
                            <span>{opt}</span>
                            <span
                              className={cn(
                                'w-4 h-4 rounded-full flex items-center justify-center shrink-0 border transition-colors',
                                isSelected
                                  ? 'bg-slate-900 border-slate-900 text-white'
                                  : 'border-slate-300 bg-white'
                              )}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Q7: Luka apa yang kamu harap bisa sembuh dalam dirimu? */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-900">
                        {formTemplate.q7WoundLabel} <span className="text-rose-500">*</span>
                      </label>
                      {formTemplate.q7WoundSubLabel && (
                        <p className="text-xs italic text-slate-500 mt-0.5">
                          {formTemplate.q7WoundSubLabel}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {formTemplate.q7WoundOptions.map((opt) => {
                        const isSelected = healingWoundChoice === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setHealingWoundChoice(opt)}
                            className={cn(
                              'px-4 py-3 rounded-xl border text-left text-xs sm:text-sm transition-all flex items-center justify-between gap-3 cursor-pointer',
                              isSelected
                                ? 'bg-purple-50/60 border-slate-900 text-slate-900 font-semibold shadow-2xs'
                                : 'bg-[#FAF9F6] hover:bg-slate-50 border-slate-200/80 text-slate-700'
                            )}
                          >
                            <span>{opt}</span>
                            <span
                              className={cn(
                                'w-4 h-4 rounded-full flex items-center justify-center shrink-0 border transition-colors',
                                isSelected
                                  ? 'bg-slate-900 border-slate-900 text-white'
                                  : 'border-slate-300 bg-white'
                              )}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </span>
                          </button>
                        );
                      })}

                      {formTemplate.q7AllowOther && (
                        <div
                          onClick={() => setHealingWoundChoice('OTHER')}
                          className={cn(
                            'sm:col-span-2 px-4 py-2.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center gap-2.5 cursor-pointer',
                            healingWoundChoice === 'OTHER'
                              ? 'bg-purple-50/60 border-slate-900'
                              : 'bg-[#FAF9F6] hover:bg-slate-50 border-slate-200/80'
                          )}
                        >
                          <span className="text-xs sm:text-sm font-medium text-slate-800 shrink-0">
                            Yang lain:
                          </span>
                          <input
                            type="text"
                            value={healingWoundOther}
                            onFocus={() => setHealingWoundChoice('OTHER')}
                            onChange={(e) => {
                              setHealingWoundChoice('OTHER');
                              setHealingWoundOther(e.target.value);
                            }}
                            placeholder="Tuliskan hal lain yang ingin kamu pulihkan..."
                            className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200/90 focus:border-slate-900 focus:outline-none text-xs sm:text-sm text-slate-900"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Q8: Harapan atau doa yang ingin kamu capai dari acara ini? (opsional) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-xs sm:text-sm font-semibold text-slate-900">
                        {formTemplate.q8HopeLabel}
                      </label>
                      <span className="text-[11px] text-slate-400">Opsional</span>
                    </div>
                    <textarea
                      rows={2}
                      value={hopeOrPrayer}
                      onChange={(e) => setHopeOrPrayer(e.target.value)}
                      placeholder="Tuliskan harapan atau doa terbaikmu dari kegiatan ini..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] hover:bg-slate-50 focus:bg-white border border-slate-200/90 focus:border-slate-900 focus:outline-none text-sm text-slate-900 transition-colors placeholder:text-slate-400 resize-none"
                    />
                  </div>
                </div>

                {/* CHAPTER 03: KOMUNITAS, BUKTI TRANSFER & KOMITMEN KEHADIRAN */}
                <div className="p-6 sm:p-8 space-y-7">
                  <div>
                    <span className="text-xs font-semibold text-purple-900">
                      03. Komunitas, Konfirmasi Transfer &amp; Kesiapan Hadir
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Langkah penutup sebelum Kartu Pengenal QR kamu diterbitkan secara otomatis
                    </p>
                  </div>

                  {/* Q6 & Q10: Minimalist Social Connection Cards */}
                  <div className="grid grid-cols-1 gap-4">
                    {/* Q6: Sudah follow @Healyou.official belum? */}
                    <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-slate-200/80 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs sm:text-sm font-semibold text-slate-900">
                          {formTemplate.q6FollowLabel} <span className="text-rose-500">*</span>
                        </label>
                        {formTemplate.q6FollowLinkText && (
                          <a
                            href={
                              formTemplate.q6FollowLinkUrl ||
                              'https://www.instagram.com/healyou.official'
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-purple-50 text-purple-900 border border-slate-200/90 transition-colors"
                          >
                            <span>{formTemplate.q6FollowLinkText}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {formTemplate.q6FollowOptions.map((opt) => {
                          const isSelected = followedHealYou === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setFollowedHealYou(opt)}
                              className={cn(
                                'px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all inline-flex items-center gap-2 cursor-pointer',
                                isSelected
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              )}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-300" />}
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Q10: Supporter */}
                    {formTemplate.q10SupporterEnabled && (
                      <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-slate-200/80 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <label className="text-xs sm:text-sm font-semibold text-slate-900 max-w-lg leading-snug">
                            {formTemplate.q10SupporterLabel}
                          </label>
                          {formTemplate.q10SupporterLinkText && (
                            <a
                              href={
                                formTemplate.q10SupporterLinkUrl || 'https://www.instagram.com/'
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-purple-50 text-purple-900 border border-slate-200/90 transition-colors shrink-0"
                            >
                              <span>{formTemplate.q10SupporterLinkText}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {formTemplate.q10SupporterOptions.map((opt) => {
                            const isSelected = followedSupporter === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setFollowedSupporter(opt)}
                                className={cn(
                                  'px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all inline-flex items-center gap-2 cursor-pointer',
                                  isSelected
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                )}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-300" />}
                                <span>{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Q9: Modern Digital Bank Pass & Upload Dropzone */}
                  {formTemplate.q9TransferEnabled && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="block text-xs sm:text-sm font-semibold text-slate-900">
                          {formTemplate.q9TransferLabel} <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[11px] text-slate-400">
                          Format Gambar / PDF · Maks 10 MB
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
                        {/* Left: Minimalist Dark Bank Card */}
                        <div className="sm:col-span-5 rounded-2xl bg-slate-900 text-white p-4 flex flex-col justify-between gap-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-white/15 text-[11px] font-bold tracking-wider">
                              {formTemplate.q9BankName}
                            </span>
                            <CreditCard className="w-4 h-4 text-slate-400" />
                          </div>

                          <div>
                            <p className="text-[11px] text-slate-400">Nomor Rekening Tujuan</p>
                            <p className="text-base sm:text-lg font-mono font-bold tracking-wider text-white tabular-nums mt-0.5">
                              {formTemplate.q9BankAccount}
                            </p>
                            <p className="text-xs text-slate-300 mt-0.5">
                              {formTemplate.q9BankHolder}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => void handleCopyRekening()}
                            className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {copiedRekening ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-300" />
                                <span>Nomor Rekening Tersalin</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-300" />
                                <span>Salin Nomor Rekening</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Right: Minimalist Upload Dropzone */}
                        <div className="sm:col-span-7 rounded-2xl border border-dashed border-slate-300 bg-[#FAF9F6] p-4 flex flex-col justify-center">
                          <input
                            ref={transferInputRef}
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleTransferFileChange}
                            className="hidden"
                          />

                          {!transferFileName ? (
                            <button
                              type="button"
                              onClick={() => transferInputRef.current?.click()}
                              className="w-full h-full min-h-[120px] flex flex-col items-center justify-center text-center gap-2 cursor-pointer group"
                            >
                              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 group-hover:border-slate-900 transition-colors">
                                <Upload className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-slate-900 block">
                                  Klik untuk Unggah Bukti Transfer
                                </span>
                                <span className="text-[11px] text-slate-500 mt-0.5 block">
                                  Tersimpan aman di perangkat Anda (JPG, PNG, atau PDF)
                                </span>
                              </div>
                            </button>
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {transferPreviewDataUrl ? (
                                  <img
                                    src={transferPreviewDataUrl}
                                    alt="Pratinjau Bukti Transfer"
                                    className="w-16 h-16 rounded-xl border border-slate-200 object-cover shrink-0 bg-white"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-5 h-5" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <span className="text-[10px] font-semibold text-emerald-700 block">
                                    ✓ Bukti Transfer Terlampir
                                  </span>
                                  <p className="text-xs font-bold text-slate-900 truncate">
                                    {transferFileName}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <button
                                      type="button"
                                      onClick={() => transferInputRef.current?.click()}
                                      className="text-[11px] font-semibold text-purple-800 hover:underline cursor-pointer"
                                    >
                                      Ganti File
                                    </button>
                                    <span className="text-slate-300">·</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTransferFileName('');
                                        setTransferPreviewDataUrl('');
                                        if (transferInputRef.current) {
                                          transferInputRef.current.value = '';
                                        }
                                      }}
                                      className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                                    >
                                      Hapus
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Sistem Verifikasi / Approval Admin & Panitia Info Bar */}
                      {formTemplate.paymentAccessCodeRequired && (
                        <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5 text-xs text-slate-600">
                            <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                              <span>
                                Sistem Verifikasi / Approval Admin &amp; Panitia:
                              </span>
                            </p>
                            <p className="leading-relaxed">
                              Setelah mengirim formulir &amp; bukti transfer, Admin atau Panitia akan
                              memverifikasi (ACC) pembayaranmu. Begitu disetujui,{' '}
                              <strong>Kartu Pengenal (Barcode QR)</strong> resmi akan langsung aktif
                              dan dapat diunduh di halaman ini. Konfirmasi cepat WA Admin:{' '}
                              <a
                                href={buildRequestAdminApprovalWhatsAppUrl({
                                  name: fullName,
                                  phone,
                                  role,
                                  domicile,
                                  transferFile: transferFileName,
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-mono font-bold text-emerald-800 underline decoration-emerald-500/60 underline-offset-2 hover:text-emerald-950"
                              >
                                <span>{adminWaDisplay}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Q11: Pernyataan Kesiapan Mengikuti Muslimah Healing Day */}
                  <div className="p-5 rounded-2xl bg-[#FAF9F6] border border-slate-200/90 space-y-3.5">
                    <label className="block text-xs sm:text-sm font-medium text-slate-800 leading-relaxed">
                      {formTemplate.q11CommitmentLabel} <span className="text-rose-500">*</span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {formTemplate.q11CommitmentOptions.map((opt) => {
                        const isSelected = commitmentStatement === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setCommitmentStatement(opt)}
                            className={cn(
                              'px-4 py-3 rounded-xl border text-left text-xs sm:text-sm transition-all flex items-center justify-between gap-2.5 cursor-pointer',
                              isSelected
                                ? 'bg-slate-900 border-slate-900 text-white font-semibold shadow-2xs'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                            )}
                          >
                            <span>{opt}</span>
                            <span
                              className={cn(
                                'w-4 h-4 rounded-full flex items-center justify-center shrink-0 border',
                                isSelected
                                  ? 'bg-emerald-400 border-emerald-400 text-slate-950'
                                  : 'border-slate-300 bg-white'
                              )}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submit & Secondary Action Footer */}
                  <div className="pt-2 space-y-3">
                    {editingParticipantId && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-xs text-amber-950">
                        <span>
                          Mode Perbarui Data Kartu &amp; E-Sertifikat (
                          <strong>{editingParticipantId}</strong>)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingParticipantId(null);
                            setViewModeAfterReg('card');
                            setFullName('');
                            setPhone('');
                            setRole('');
                            setDomicile('');
                          }}
                          className="font-bold text-amber-800 hover:underline cursor-pointer"
                        >
                          Batal Edit
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm bg-slate-900 hover:bg-purple-950 text-white shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>
                        {editingParticipantId
                          ? 'Simpan Perubahan Data Kartu & E-Sertifikat 🌸'
                          : formTemplate.submitButtonText}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
              </div>
            )}

            {/* VIEW B: FOCUSED POST-REGISTRATION STATUS & KARTU PENGENAL QR (Shown when registered & not viewing form) */}
            {registeredParticipant && viewModeAfterReg === 'card' && !editingParticipantId && (
              <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                {/* LEFT COLUMN (5/12): Official Card Preview OR Locked Proof Card */}
                <div className="lg:col-span-5 lg:sticky lg:top-20 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-7 space-y-5">
                  <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-purple-800 block">
                        Dokumen Identitas Resmi
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">
                        Kartu Pengenal QR ({registeredParticipant.id})
                      </h3>
                    </div>
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                        isRegisteredCardUnlocked
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                          : 'bg-amber-50 text-amber-900 border-amber-200'
                      )}
                    >
                      {isRegisteredCardUnlocked ? 'Kartu QR Aktif' : 'Menunggu ACC'}
                    </span>
                  </div>

                  {isRegisteredCardUnlocked ? (
                    <div className="space-y-5">
                      {/* High-Res Botanical ID Card Preview */}
                      <div className="rounded-2xl bg-[#FAF9F6] border border-slate-200/80 p-5 flex items-center justify-center min-h-[340px]">
                        {isRenderingCard || !cardPreviewUrl ? (
                          <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
                            <div className="w-7 h-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-medium">
                              Merender Kartu Pengenal QR...
                            </span>
                          </div>
                        ) : (
                          <img
                            src={cardPreviewUrl}
                            alt={`Kartu Peserta ${registeredParticipant.name}`}
                            className="w-full max-w-[310px] h-auto rounded-2xl shadow-sm"
                          />
                        )}
                      </div>

                      {/* Download & Switch to Certificate Verification */}
                      <div className="space-y-2.5">
                        <button
                          type="button"
                          onClick={handleDownloadRegisteredCard}
                          className="w-full py-3.5 px-4 rounded-xl text-xs font-bold bg-[#1E1136] hover:bg-[#2d1a50] text-white transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        >
                          <Download className="w-4 h-4" />
                          <span>Unduh Kartu Pengenal QR (PNG)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!verifiedParticipant) {
                              setVerifiedParticipant(registeredParticipant);
                            }
                            setPortalTab('certificate');
                          }}
                          className="w-full py-3 px-4 rounded-xl text-xs font-semibold bg-[#FAF9F6] hover:bg-slate-100 text-slate-900 border border-slate-200/90 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Upload className="w-4 h-4 text-emerald-700" />
                          <span>Buka Klaim E-Sertifikat</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Locked Card State + Uploaded Transfer Proof Preview */
                    <div className="space-y-4">
                      <div className="p-5 rounded-2xl bg-[#FAF9F6] border border-amber-200/90 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                          <Lock className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900">
                            Barcode QR Terkunci Sementara
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">
                            Menunggu Verifikasi Admin / Panitia
                          </h4>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            Kartu Pengenal ber-Barcode QR akan muncul otomatis di panel ini begitu
                            bukti pembayaran Anda diverifikasi (ACC).
                          </p>
                        </div>
                      </div>

                      {/* Uploaded Transfer Proof Preview & Option to Re-upload */}
                      <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-slate-200/90 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">
                              Bukti Transfer Pembayaran Kamu
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {registeredParticipant.paymentFileName ||
                                savedFormDetails?.transferFileName ||
                                'Bukti transfer telah dilampirkan'}
                            </span>
                          </div>

                          <div>
                            <input
                              ref={reuploadInputRef}
                              type="file"
                              accept="image/*,.pdf"
                              onChange={handleReuploadTransferProof}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => reuploadInputRef.current?.click()}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5 text-purple-800" />
                              <span>Ganti Bukti</span>
                            </button>
                          </div>
                        </div>

                        {reuploadSuccessNotice && (
                          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
                            ✓ Bukti transfer berhasil diperbarui dan dikirim ke antrean verifikasi
                            Admin &amp; Panitia.
                          </div>
                        )}

                        {(registeredParticipant.paymentProofUrl ||
                          savedFormDetails?.transferPreviewDataUrl) && (
                          <div className="rounded-xl overflow-hidden border border-slate-200 bg-white p-2 flex items-center justify-center max-h-56">
                            <img
                              src={
                                registeredParticipant.paymentProofUrl ||
                                savedFormDetails?.transferPreviewDataUrl
                              }
                              alt="Pratinjau Bukti Transfer"
                              className="max-h-52 w-auto object-contain rounded-lg"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN (7/12): Verification Status, WhatsApp Admin Confirmation & Synchronized Data */}
                <div className="lg:col-span-7 space-y-6">
                  {isRegisteredCardUnlocked ? (
                    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-7 space-y-4">
                      <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[11px] font-semibold text-emerald-800">
                              ✓ Pembayaran Terverifikasi oleh{' '}
                              {registeredParticipant.paymentVerifiedBy || 'Admin / Panitia'} · Kartu
                              QR Aktif
                            </span>
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                              Pendaftaran Terkonfirmasi ({registeredParticipant.name})
                            </h3>
                            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                              Simpan Kartu Pengenal QR di sebelah kiri. Barcode QR terenkripsi di
                              dalamnya adalah kunci tunggal untuk <strong>Check-in Kehadiran</strong>{' '}
                              dan <strong>Klaim E-Sertifikat</strong>.
                            </p>
                          </div>
                        </div>

                        {canVerifyPayment && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = verifyParticipantPayment(
                                registeredParticipant.id,
                                false
                              );
                              if (updated) setRegisteredParticipant(updated);
                              setPaymentVerifyTick((t) => t + 1);
                            }}
                            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 transition-colors cursor-pointer shrink-0"
                          >
                            Batalkan Status ACC
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-7 space-y-5">
                      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-200 flex items-start gap-3">
                        <Clock className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                            ⏳ Menunggu Verifikasi / Approval Admin &amp; Panitia
                          </span>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900">
                            Pendaftaran Tercatat · Kartu QR Akan Aktif Setelah Pembayaran Di-ACC 🔒
                          </h3>
                          <p className="text-xs text-slate-700 leading-relaxed">
                            Terima kasih <strong>{registeredParticipant.name}</strong> (ID
                            Pendaftaran:{' '}
                            <strong className="font-mono">{registeredParticipant.id}</strong>).
                            Formulir dan bukti transfer kamu sudah masuk ke sistem. Demi keamanan,{' '}
                            <strong>Kartu Pengenal (Barcode QR)</strong> akan terbuka otomatis begitu
                            pembayaranmu diverifikasi (ACC) oleh <strong>Admin atau Panitia</strong>.
                          </p>
                        </div>
                      </div>

                      {/* Quick 1-Click Approval Bar if current viewer is Admin or Panitia */}
                      {canVerifyPayment && (
                        <div className="p-4 rounded-2xl bg-emerald-950 text-white border border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
                              Kontrol Cepat Admin / Panitia
                            </span>
                            <p className="text-xs text-emerald-50">
                              Anda sedang masuk sebagai Admin/Panitia. Klik tombol di samping untuk
                              menyetujui (ACC) pembayaran{' '}
                              <strong>{registeredParticipant.name}</strong> dan membuka Kartu QR
                              sekarang:
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = verifyParticipantPayment(
                                registeredParticipant.id,
                                true
                              );
                              if (updated) setRegisteredParticipant(updated);
                              playScanBeep('success');
                              setPaymentVerifyTick((t) => t + 1);
                            }}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Terima / ACC Pembayaran Sekarang</span>
                          </button>
                        </div>
                      )}

                      {/* WhatsApp Admin Confirmation & Auto-Refresh Status */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white space-y-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold flex items-center gap-1.5 text-white">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            Konfirmasi &amp; Percepat Verifikasi (ACC)
                          </span>
                          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-white/10 text-emerald-300">
                            WA Admin: {adminWaDisplay}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          Klik tombol di bawah untuk mengirim pesan konfirmasi langsung ke WhatsApp
                          Admin (
                          <a
                            href={buildRequestAdminApprovalWhatsAppUrl({
                              participantId: registeredParticipant.id,
                              name: registeredParticipant.name,
                              phone: registeredParticipant.phone || '',
                              role: registeredParticipant.role || '',
                              domicile: registeredParticipant.institution || '',
                              transferFile:
                                registeredParticipant.paymentFileName ||
                                savedFormDetails?.transferFileName ||
                                'Sudah diunggah di formulir',
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono font-bold text-emerald-300 underline decoration-emerald-400/70 underline-offset-2 hover:text-white"
                          >
                            {adminWaDisplay}
                          </a>
                          ). Begitu Admin atau Panitia menekan tombol <strong>ACC</strong>, halaman
                          ini akan otomatis membuka <strong>Kartu Pengenal (Barcode QR)</strong>{' '}
                          kamu:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <a
                            href={buildRequestAdminApprovalWhatsAppUrl({
                              participantId: registeredParticipant.id,
                              name: registeredParticipant.name,
                              phone: registeredParticipant.phone || '',
                              role: registeredParticipant.role || '',
                              domicile: registeredParticipant.institution || '',
                              transferFile:
                                registeredParticipant.paymentFileName ||
                                savedFormDetails?.transferFileName ||
                                'Sudah diunggah di formulir',
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors flex items-center justify-center gap-2"
                          >
                            <span>Hubungi WA Admin ({adminWaDisplay})</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>

                          <button
                            type="button"
                            onClick={() => {
                              const latest = participants.find(
                                (p) => p.id.toUpperCase() === registeredParticipant.id.toUpperCase()
                              );
                              if (latest) setRegisteredParticipant(latest);
                              setPaymentVerifyTick((t) => t + 1);
                            }}
                            className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/15 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Cek Status Verifikasi Terbaru</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Linked Barcode Pengenal <-> E-Sertifikat Synchronization Summary */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-7 space-y-4 text-xs">
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                        <Link2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        Data Tersinkronisasi ke Kartu &amp; Sertifikat
                      </span>
                      <span className="font-mono font-semibold text-[11px] px-2.5 py-1 rounded-lg bg-purple-50 text-purple-900 border border-purple-200/70">
                        SIG-{computeParticipantQrSignature(registeredParticipant.id)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono break-all">
                      No. Sertifikat:{' '}
                      <strong className="text-slate-900">{registeredCertNumber}</strong>
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-slate-200/70">
                        <span className="text-[11px] text-slate-400 block">1. Nama Peserta</span>
                        <span className="font-semibold text-slate-900 mt-0.5 block text-sm">
                          {registeredParticipant.name}
                        </span>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-slate-200/70">
                        <span className="text-[11px] text-slate-400 block">2. No. WhatsApp</span>
                        <span className="font-mono font-semibold text-slate-900 mt-0.5 block text-sm">
                          {registeredParticipant.phone || '-'}
                        </span>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-slate-200/70">
                        <span className="text-[11px] text-slate-400 block">
                          3. Pekerjaan / Kegiatan
                        </span>
                        <span className="font-medium text-slate-900 mt-0.5 block text-sm">
                          {registeredParticipant.role || '-'}
                        </span>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-slate-200/70">
                        <span className="text-[11px] text-slate-400 block">
                          4. Tempat Tinggal / Domisili
                        </span>
                        <span className="font-medium text-slate-900 mt-0.5 block text-sm">
                          📍 {registeredParticipant.institution || '-'}
                        </span>
                      </div>
                    </div>

                    {justUpdatedData && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">
                        ✓ Keempat data di atas telah diperbarui &amp; tersinkronisasi langsung ke
                        Kartu Pengenal dan E-Sertifikat.
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => handleStartEditRegistered(registeredParticipant)}
                        className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-[#FAF9F6] hover:bg-slate-100 text-slate-900 border border-slate-200/90 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-700" />
                        <span>Edit Data Kartu &amp; Sertifikat</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewModeAfterReg('form')}
                        className="py-2.5 px-4 rounded-xl text-xs font-medium bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/90 transition-colors cursor-pointer"
                      >
                        Lihat Undangan &amp; Formulir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: UPLOAD / SCAN KARTU PENGENAL, EVALUASI & KLAIM E-SERTIFIKAT (TANPA INPUT ID MANUAL) */}
        {portalTab === 'certificate' && (
          <div className="space-y-5">
            {/* Jadwal Klaim E-Sertifikat (2 Jam Setelah Acara) & Persetujuan Admin Banner */}
            <div
              className={cn(
                'rounded-3xl border p-4 sm:p-5 shadow-xs transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4',
                certClaimStatus.isUnlocked
                  ? 'bg-emerald-50/90 border-emerald-200'
                  : 'bg-amber-50/90 border-amber-300'
              )}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={cn(
                    'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs',
                    certClaimStatus.isUnlocked
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-500 text-white'
                  )}
                >
                  {certClaimStatus.isUnlocked ? (
                    <Unlock className="w-5 h-5" />
                  ) : (
                    <Clock className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                        certClaimStatus.isUnlocked
                          ? 'bg-emerald-200/80 text-emerald-950'
                          : 'bg-amber-200/90 text-amber-950'
                      )}
                    >
                      {certClaimStatus.isAdminApproved
                        ? '✓ Dibuka Atas Persetujuan Admin'
                        : certClaimStatus.isTimeReached
                          ? '✓ Jadwal Klaim Otomatis Terbuka (≥ 2 Jam Acara)'
                          : '⏳ Menunggu 2 Jam Setelah Acara / Persetujuan Admin'}
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-slate-600">
                      Jam Mulai: {startTimeFormatted} WIB · Jadwal Klaim: {certUnlockTimeFormatted} WIB
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                    {certClaimStatus.isUnlocked
                      ? 'Akses Klaim & Unduh E-Sertifikat Telah Dibuka'
                      : `Klaim E-Sertifikat Baru Dapat Dilakukan Pukul ${certUnlockTimeFormatted} WIB (2 Jam Setelah Acara) atau Atas Persetujuan Admin`}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {certClaimStatus.isUnlocked
                      ? 'Silakan unggah Kartu Pengenal / Barcode Anda di bawah untuk mengisi evaluasi singkat dan mengunduh E-Sertifikat resmi.'
                      : `Sistem akan membuka akses klaim secara otomatis 2 jam setelah acara dimulai (${certClaimStatus.formattedCountdown} lagi), atau lebih cepat apabila telah disetujui oleh Admin.`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {!certClaimStatus.isUnlocked && (
                  <div className="px-3.5 py-2 rounded-2xl bg-white border border-amber-300 text-amber-950 text-xs font-mono font-bold shadow-2xs flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                    <span>Buka dalam: {certClaimStatus.formattedCountdown}</span>
                  </div>
                )}

                {(canManageParticipants || canVerifyPayment) && (
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleCertClaimApproval(!certClaimStatus.isAdminApproved)
                    }
                    className={cn(
                      'px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs',
                      certClaimStatus.isAdminApproved
                        ? 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    )}
                  >
                    {certClaimStatus.isAdminApproved ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Kembalikan ke Jadwal 2 Jam</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Setujui &amp; Buka Klaim Sekarang (Admin)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

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
              </div>
            </div>

            {/* Right Column: Verification Result, Post-Workshop Evaluation & Certificate Download */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {!certClaimStatus.isUnlocked ? (
                /* Locked until 2 hours after event starts OR Admin approval */
                <div className="bg-white rounded-3xl border border-amber-200 shadow-xs overflow-hidden">
                  <div className="p-5 bg-amber-50 border-b border-amber-200 flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-950">
                        Klaim E-Sertifikat Belum Dibuka
                      </span>
                      <h3 className="text-base font-bold text-amber-950 mt-1">
                        {verifiedParticipant
                          ? `Halo, ${verifiedParticipant.name} (${verifiedParticipant.id})`
                          : 'Menunggu Waktu Klaim (2 Jam Setelah Acara) atau Persetujuan Admin'}
                      </h3>
                      <p className="text-xs text-amber-900/90 mt-0.5">
                        Acara dimulai pukul <strong>{startTimeFormatted} WIB</strong> · Jadwal buka
                        otomatis pukul <strong>{certUnlockTimeFormatted} WIB</strong>
                      </p>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-xs text-amber-950 leading-relaxed space-y-2">
                      <p className="font-bold text-sm">
                        Kapan E-Sertifikat dapat diklaim dan diunduh?
                      </p>
                      <p>
                        Sesuai ketentuan penyelenggara, klaim E-Sertifikat baru dapat dilakukan{' '}
                        <strong>2 jam setelah acara berlangsung</strong> (pukul{' '}
                        <strong>{certUnlockTimeFormatted} WIB</strong>) atau lebih awal{' '}
                        <strong>atas persetujuan Admin</strong>.
                      </p>
                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-amber-300 font-mono font-bold text-amber-900 text-xs">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Hitung Mundur Otomatis: {certClaimStatus.formattedCountdown}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <a
                        href={`https://wa.me/${adminWaTarget}?text=${encodeURIComponent(
                          `Assalamu'alaikum Admin, saya ${
                            verifiedParticipant
                              ? `${verifiedParticipant.name} (ID: ${verifiedParticipant.id})`
                              : 'peserta workshop'
                          } memohon persetujuan untuk membuka akses klaim E-Sertifikat (${
                            activeConfig.name
                          }). Terima kasih.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-purple-950 text-white transition-all cursor-pointer"
                      >
                        <span>Minta Persetujuan Klaim ke WA Admin</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {(canManageParticipants || canVerifyPayment) && (
                        <button
                          type="button"
                          onClick={() => handleToggleCertClaimApproval(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Setujui &amp; Buka Klaim Sekarang (Admin)</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : !verifiedParticipant ? (
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
                        · {verifiedParticipant.role || 'Peserta Workshop'} · Domisili: {verifiedParticipant.institution}
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
                              {verifiedParticipant.role || 'Peserta Workshop'} · Domisili: {verifiedParticipant.institution || '-'}
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

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 text-left space-y-1">
              <div className="font-bold text-purple-950 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-purple-700" />
                <span>Nama Link: {formTemplate.shareLinkSlug || 'HealYou-Pendaftaran'}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-600 break-all">
                {shareRegistrationUrl}
              </div>
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
                    Tersalin ({formTemplate.shareLinkSlug || 'HealYou-Pendaftaran'})!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Salin &ldquo;{formTemplate.shareLinkSlug || 'HealYou-Pendaftaran'}&rdquo;
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

      {/* Modal Verifikasi / Approval Pembayaran Peserta (Admin & Panitia) */}
      {showAdminApprovalModal && (canVerifyPayment || isAdminPreview) && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowAdminApprovalModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:px-6 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-900 text-white">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
                  Sistem Verifikasi / Approval Admin &amp; Panitia
                </span>
                <h4 className="text-base font-bold">
                  Daftar Verifikasi Pembayaran &amp; Aktivasi Kartu QR Peserta
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminApprovalModal(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'ALL', label: `Semua (${participants.length})` },
                    {
                      id: 'PENDING',
                      label: `Menunggu ACC (${participants.filter((p) => p.paymentVerified !== true).length})`,
                    },
                    {
                      id: 'VERIFIED',
                      label: `Sudah Di-ACC (${participants.filter((p) => p.paymentVerified === true).length})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setApprovalModalFilter(tab.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer',
                      approvalModalFilter === tab.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-mono text-xs font-bold">
                  Kuota ACC: {verifiedParticipantsCount}/{participantQuota} (Sisa {remainingQuota})
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-4 sm:p-6 space-y-3">
              {participants
                .filter((p) => {
                  if (approvalModalFilter === 'PENDING') return p.paymentVerified !== true;
                  if (approvalModalFilter === 'VERIFIED') return p.paymentVerified === true;
                  return true;
                })
                .map((p) => {
                  const isVerified = p.paymentVerified === true;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'p-4 rounded-2xl border flex flex-col gap-3',
                        isVerified
                          ? 'bg-white border-slate-200'
                          : 'bg-amber-50/60 border-amber-300'
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">{p.name}</span>
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-900">
                              {p.id}
                            </span>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-md text-[11px] font-bold',
                                isVerified
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-200/80 text-amber-950'
                              )}
                            >
                              {isVerified
                                ? `✓ Terverifikasi (${p.paymentVerifiedBy || 'Admin/Panitia'})`
                                : '⏳ Menunggu ACC'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {p.role || 'Peserta'} · {p.institution}
                            {p.phone ? ` · WA: ${p.phone}` : ''}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {!isVerified ? (
                            <button
                              type="button"
                              onClick={() => {
                                verifyParticipantPayment(p.id, true);
                                playScanBeep('success');
                                setPaymentVerifyTick((t) => t + 1);
                              }}
                              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Terima (ACC)</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                verifyParticipantPayment(p.id, false);
                                setPaymentVerifyTick((t) => t + 1);
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 transition-colors cursor-pointer"
                            >
                              Batalkan ACC
                            </button>
                          )}

                          <a
                            href={buildSendApprovedCardLinkToParticipantWaUrl(p)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              if (!isVerified) {
                                verifyParticipantPayment(p.id, true);
                                setPaymentVerifyTick((t) => t + 1);
                              }
                            }}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-purple-950 text-white transition-colors inline-flex items-center gap-1.5"
                            title="ACC & Kirim Link Kartu QR yang Sudah Aktif ke WhatsApp Peserta"
                          >
                            <span>Kirim Link Kartu (WA)</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      {p.paymentProofUrl && (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={p.paymentProofUrl}
                              alt={`Bukti Transfer ${p.name}`}
                              className="w-16 h-16 object-cover rounded-lg border border-slate-200 bg-white"
                            />
                            <div className="text-xs">
                              <span className="font-semibold text-slate-800 block">
                                Bukti Transfer Terlampir
                              </span>
                              <span className="text-slate-500 text-[11px]">
                                {p.paymentFileName || 'Bukti_Transfer.jpg'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Full Registration Form & Invitation Editor Modal (Admin Only) */}
      {isFormEditorOpen && canManageParticipants && (
        <RegistrationFormEditorModal
          workshopId={activeWorkshopId}
          initialTemplate={formTemplate}
          portalShareUrl={shareRegistrationUrl}
          onClose={() => setIsFormEditorOpen(false)}
          onSaved={(updated) => {
            setFormTemplate(updated);
            updateConfig({ quota: updated.participantQuota || 30 });
            setQuotaInput(String(updated.participantQuota || 30));
          }}
          onCopyPortalLink={() => void handleCopyPortalUrl('register')}
        />
      )}
    </div>
  );
};
