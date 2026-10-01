import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import {
  Participant,
  WorkshopConfig,
  CertificateSettings,
  ParticipantFeedback,
  FeedbackRecommendation,
} from './types';
import { INITIAL_PARTICIPANTS, WORKSHOP_CONFIG } from './data';
import {
  DEFAULT_CERT_SETTINGS,
  normalizeCertificateSettings,
} from './lib/certificateRenderer';
import {
  getParticipantPaymentRecord,
  saveParticipantTransferSubmission,
  setParticipantPaymentApproval,
} from './lib/registrationTemplate';
import {
  verifyScannedParticipantQr,
  extractBaseParticipantIdFromQr,
} from './lib/qrSecurity';
import { isAfter } from 'date-fns';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  doc,
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogleCloud,
  signOutFromCloud,
} from './firebase';

export const ADMIN_EMAIL = 'paku.tanam@gmail.com';
export const PANITIA_PASSWORD = '12345678';
const AUTH_SESSION_STORAGE_KEY = 'healyou_auth_session_v1';
const DEFAULT_WORKSHOP_ID = 'main';
const CERT_SETTINGS_DOC_ID = 'config';

export type AppUserRole = 'admin' | 'panitia';

export interface AuthenticatedUserSession {
  role: AppUserRole;
  identifier: string;
  displayName: string;
  loggedInAt: string;
}

export const PANITIA_ACCOUNTS: Record<string, { identifier: string; displayName: string }> = {
  panitia1: { identifier: 'panitia1', displayName: 'Panitia 1' },
  'panitia 1': { identifier: 'panitia1', displayName: 'Panitia 1' },
  'panitia-1': { identifier: 'panitia1', displayName: 'Panitia 1' },
  'panitia_1': { identifier: 'panitia1', displayName: 'Panitia 1' },
  panitia2: { identifier: 'panitia2', displayName: 'Panitia 2' },
  'panitia 2': { identifier: 'panitia2', displayName: 'Panitia 2' },
  'panitia-2': { identifier: 'panitia2', displayName: 'Panitia 2' },
  'panitia_2': { identifier: 'panitia2', displayName: 'Panitia 2' },
  panitia3: { identifier: 'panitia3', displayName: 'Panitia 3' },
  'panitia 3': { identifier: 'panitia3', displayName: 'Panitia 3' },
  'panitia-3': { identifier: 'panitia3', displayName: 'Panitia 3' },
  'panitia_3': { identifier: 'panitia3', displayName: 'Panitia 3' },
};

function loadInitialAuthSession(): AuthenticatedUserSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthenticatedUserSession;
    if (
      parsed &&
      (parsed.role === 'admin' || parsed.role === 'panitia') &&
      typeof parsed.identifier === 'string' &&
      typeof parsed.displayName === 'string'
    ) {
      if (parsed.role === 'admin' && parsed.identifier.toLowerCase() !== ADMIN_EMAIL) {
        return null;
      }
      if (
        parsed.role === 'panitia' &&
        !['panitia1', 'panitia2', 'panitia3'].includes(parsed.identifier.toLowerCase())
      ) {
        return null;
      }
      return parsed;
    }
  } catch {
    // Ignore storage read error
  }
  return null;
}

export interface WorkshopEventItem {
  workshopId: string;
  config: WorkshopConfig;
  participantCount?: number;
  certificateSettings?: CertificateSettings;
}

interface LocalSessionRecord {
  workshopId: string;
  config: WorkshopConfig;
  participants: Participant[];
  certificateSettings: CertificateSettings;
  feedbacks: Record<string, ParticipantFeedback>;
}

interface AppState {
  participants: Participant[];
  config: WorkshopConfig;
  certificateSettings: CertificateSettings;
  feedbacks: Record<string, ParticipantFeedback>;
  submitParticipantFeedback: (data: {
    participantId: string;
    participantName: string;
    institution: string;
    overallRating: number;
    speakerRating: number;
    facilityRating: number;
    takeaway: string;
    suggestedTopic?: string;
    recommendation: FeedbackRecommendation;
  }) => ParticipantFeedback;
  updateCertificateSettings: (
    updates:
      | Partial<CertificateSettings>
      | ((prev: CertificateSettings) => CertificateSettings)
  ) => void;
  resetCertificateSettings: () => void;
  saveCertificateSettingsToCloudNow: () => Promise<boolean>;
  copyCertificateSettingsToAllWorkshops: () => Promise<number>;
  isCertCloudSynced: boolean;
  isCertCloudSaving: boolean;
  lastCertCloudSyncAt: string | null;
  eventsList: WorkshopEventItem[];
  activeWorkshopId: string;
  switchWorkshop: (workshopId: string) => void;
  createNewWorkshop: (params: {
    name: string;
    date: string;
    startTime: string;
    location: string;
    copyParticipants?: boolean;
  }) => Promise<string>;
  deleteWorkshop: (workshopId: string) => Promise<void>;
  selectedParticipantId: string;
  setSelectedParticipantId: (id: string) => void;
  checkIn: (id: string) => { success: boolean; message: string; participant?: Participant };
  registerParticipant: (
    data: {
      id?: string;
      name: string;
      email: string;
      institution: string;
      role?: string;
      phone?: string;
      paymentVerified?: boolean;
      paymentProofUrl?: string;
      paymentFileName?: string;
      paymentSubmittedAt?: string;
    },
    options?: { allowSelfRegister?: boolean }
  ) => Participant;
  importParticipants: (
    rows: Array<{
      id?: string;
      name: string;
      email?: string;
      institution?: string;
      role?: string;
      phone?: string;
    }>
  ) => number;
  updateParticipant: (
    id: string,
    updates: Partial<Participant>,
    options?: { allowSelfUpdate?: boolean }
  ) => Participant | null;
  verifyParticipantPayment: (
    id: string,
    verified: boolean,
    proofUrl?: string
  ) => Participant | null;
  deleteParticipant: (id: string) => void;
  updateConfig: (updates: Partial<WorkshopConfig>) => void;
  resetAttendance: () => void;
  resetData: () => void;
  cloudUser: User | null;
  authSession: AuthenticatedUserSession | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isPanitia: boolean;
  canManageParticipants: boolean;
  canVerifyPayment: boolean;
  isCloudSyncing: boolean;
  loginWithCredentials: (
    identifier: string,
    password?: string
  ) => Promise<{ success: boolean; message: string }>;
  loginWithGoogleAdmin: () => Promise<{ success: boolean; message: string }>;
  logoutApp: () => Promise<void>;
  connectCloud: () => Promise<void>;
  disconnectCloud: () => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

const migrateId = (id: string) =>
  id
    .split('#HY')[0]
    .replace(/^PSY-/i, 'HY-')
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .slice(0, 64) || 'HY-001';

const LEGACY_INSTITUTION_TO_DOMICILE: Record<string, string> = {
  'National Psych Institute': 'Depok, Jawa Barat',
  'City Health Clinic': 'Jakarta Selatan',
  'Memorial Hospital': 'Bogor, Jawa Barat',
  'Wilson Psychological Services': 'Tangerang Selatan',
  'Wellness Center': 'Bekasi, Jawa Barat',
  'Universitas Indonesia': 'Depok, Jawa Barat',
  'Klinik Mindful Jakarta': 'Jakarta Selatan',
  'RSUPN Dr. Cipto Mangunkusumo': 'Jakarta Pusat',
  'Universitas Gadjah Mada': 'Sleman, Yogyakarta',
  'Pusat Konseling Harapan': 'Bogor, Jawa Barat',
  'Universitas Airlangga': 'Surabaya, Jawa Timur',
  'Biro Psikologi Lentera': 'Tangerang Selatan',
  'Universitas Padjadjaran': 'Bandung, Jawa Barat',
  'Sekolah Bintang Bangsa': 'Bekasi, Jawa Barat',
  'Klinik Tumbuh Kembang Anak': 'Margonda, Depok',
  'Universitas Brawijaya': 'Malang, Jawa Timur',
  'Yayasan Pulih Bersama': 'Jakarta Timur',
  'Peserta Umum': '-',
};

const migrateParticipantDomicile = (
  p: Participant,
  workshopId: string = DEFAULT_WORKSHOP_ID
): Participant => {
  const cleanInst = (p.institution || '').trim();
  const mappedDomicile = LEGACY_INSTITUTION_TO_DOMICILE[cleanInst] || cleanInst || '-';
  const cleanId = migrateId(p.id);
  const paymentRec = getParticipantPaymentRecord(workshopId, cleanId, p.phone);

  const resolvedVerified =
    paymentRec !== null
      ? paymentRec.verified === true
      : Boolean(p.paymentVerifiedAt);

  return {
    ...p,
    id: cleanId,
    institution: mappedDomicile,
    paymentVerified: resolvedVerified,
    paymentProofUrl: paymentRec?.proofDataUrl || p.paymentProofUrl || undefined,
    paymentFileName: paymentRec?.proofFileName || p.paymentFileName || undefined,
    paymentSubmittedAt: paymentRec?.submittedAt || p.paymentSubmittedAt || undefined,
    paymentVerifiedAt:
      (paymentRec?.verified !== false ? paymentRec?.verifiedAt : undefined) ||
      p.paymentVerifiedAt ||
      undefined,
    paymentVerifiedBy:
      (paymentRec?.verified !== false ? paymentRec?.verifiedBy : undefined) ||
      p.paymentVerifiedBy ||
      undefined,
  };
};

const clampStr = (val: string | undefined, max: number, fallback = ''): string => {
  const clean = (val ?? '').trim();
  if (!clean) return fallback;
  return clean.slice(0, max);
};

function loadLegacyCertSettings(workshopId?: string): CertificateSettings {
  try {
    if (workshopId) {
      const perEventRaw = localStorage.getItem(`heal_you_cert_settings_${workshopId}`);
      if (perEventRaw) {
        return normalizeCertificateSettings(JSON.parse(perEventRaw));
      }
    }
    const legacyGlobalRaw = localStorage.getItem('heal_you_certificate_settings_v1');
    if (legacyGlobalRaw) {
      return normalizeCertificateSettings(JSON.parse(legacyGlobalRaw));
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULT_CERT_SETTINGS };
}

function loadLegacyFeedbacks(workshopId: string): Record<string, ParticipantFeedback> {
  try {
    const raw = localStorage.getItem(`heal_you_feedbacks_${workshopId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

function buildFirestoreCertPayload(
  s: CertificateSettings,
  workshopId: string,
  ownerUid: string
) {
  const norm = normalizeCertificateSettings(s);
  return {
    settingsId: CERT_SETTINGS_DOC_ID,
    workshopId,
    ownerId: ownerUid,
    organizerHeader: (norm.organizerHeader ?? '').trim().slice(0, 160),
    certTitle: clampStr(norm.certTitle, 120, DEFAULT_CERT_SETTINGS.certTitle),
    certSubtitle: clampStr(norm.certSubtitle, 160, DEFAULT_CERT_SETTINGS.certSubtitle),
    numberSuffix: clampStr(norm.numberSuffix, 80, DEFAULT_CERT_SETTINGS.numberSuffix),
    city: clampStr(norm.city, 80, DEFAULT_CERT_SETTINGS.city),
    bodyIntro: clampStr(norm.bodyIntro, 300, DEFAULT_CERT_SETTINGS.bodyIntro),
    signer1Label: clampStr(norm.signer1Label, 120, DEFAULT_CERT_SETTINGS.signer1Label),
    signer1Name: clampStr(norm.signer1Name, 160, DEFAULT_CERT_SETTINGS.signer1Name),
    signer1Title: clampStr(norm.signer1Title, 160, DEFAULT_CERT_SETTINGS.signer1Title),
    signer1SigMode:
      norm.signer1SigMode === 'IMAGE' || norm.signer1SigMode === 'NONE'
        ? norm.signer1SigMode
        : 'TEXT',
    signer1SignatureText: (norm.signer1SignatureText ?? '').trim().slice(0, 100),
    signer1SignatureDataUrl: (norm.signer1SignatureDataUrl ?? '').slice(0, 150000),
    enableSigner2: Boolean(norm.enableSigner2),
    signer2Name: (norm.signer2Name ?? '').trim().slice(0, 160),
    signer2Title: (norm.signer2Title ?? '').trim().slice(0, 160),
    signer2SigMode:
      norm.signer2SigMode === 'IMAGE' || norm.signer2SigMode === 'NONE'
        ? norm.signer2SigMode
        : 'TEXT',
    signer2SignatureText: (norm.signer2SignatureText ?? '').trim().slice(0, 100),
    signer2SignatureDataUrl: (norm.signer2SignatureDataUrl ?? '').slice(0, 150000),
    customTemplateDataUrl: (norm.customTemplateDataUrl ?? '').slice(0, 450000),
  };
}

function loadInitialSessions(): Record<string, LocalSessionRecord> {
  const savedSessions = localStorage.getItem('workshop_sessions_v1');
  if (savedSessions) {
    try {
      const parsed = JSON.parse(savedSessions) as Record<
        string,
        Partial<LocalSessionRecord> & {
          workshopId: string;
          config: WorkshopConfig;
          participants: Participant[];
        }
      >;
      if (parsed && Object.keys(parsed).length > 0) {
        const hydrated: Record<string, LocalSessionRecord> = {};
        for (const [k, val] of Object.entries(parsed)) {
          hydrated[k] = {
            workshopId: val.workshopId || k,
            config: val.config || WORKSHOP_CONFIG,
            participants: Array.isArray(val.participants)
              ? val.participants.map((p) => migrateParticipantDomicile(p, val.workshopId || k))
              : INITIAL_PARTICIPANTS.map((p) =>
                  migrateParticipantDomicile(p, val.workshopId || k)
                ),
            certificateSettings: val.certificateSettings
              ? normalizeCertificateSettings(val.certificateSettings)
              : loadLegacyCertSettings(k),
            feedbacks:
              val.feedbacks && typeof val.feedbacks === 'object'
                ? val.feedbacks
                : loadLegacyFeedbacks(k),
          };
        }
        return hydrated;
      }
    } catch {
      // Fallback below
    }
  }

  // Migrate legacy single-event localStorage
  let initialParticipants = INITIAL_PARTICIPANTS;
  const savedPart = localStorage.getItem('workshop_participants');
  if (savedPart) {
    try {
      const parsed: Participant[] = JSON.parse(savedPart);
      initialParticipants = parsed.map((p) => migrateParticipantDomicile(p));
    } catch {
      initialParticipants = INITIAL_PARTICIPANTS;
    }
  }

  let initialConfig = WORKSHOP_CONFIG;
  const savedCfg = localStorage.getItem('workshop_config');
  if (savedCfg) {
    try {
      const parsed = JSON.parse(savedCfg);
      if (!parsed.organizer || parsed.organizer === 'Heal You Psychology Center') {
        parsed.organizer = 'Muslimah Healing Journey';
      }
      initialConfig = { ...WORKSHOP_CONFIG, ...parsed };
    } catch {
      initialConfig = WORKSHOP_CONFIG;
    }
  }

  return {
    [DEFAULT_WORKSHOP_ID]: {
      workshopId: DEFAULT_WORKSHOP_ID,
      config: initialConfig,
      participants: initialParticipants,
      certificateSettings: loadLegacyCertSettings(DEFAULT_WORKSHOP_ID),
      feedbacks: loadLegacyFeedbacks(DEFAULT_WORKSHOP_ID),
    },
  };
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [localSessions, setLocalSessions] = useState<Record<string, LocalSessionRecord>>(() =>
    loadInitialSessions()
  );

  const [activeWorkshopId, setActiveWorkshopId] = useState<string>(() => {
    const savedId = localStorage.getItem('active_workshop_id');
    const initialMap = loadInitialSessions();
    if (savedId && initialMap[savedId]) {
      return savedId;
    }
    return Object.keys(initialMap)[0] || DEFAULT_WORKSHOP_ID;
  });

  const [participants, setParticipants] = useState<Participant[]>(() => {
    const initialMap = loadInitialSessions();
    const active = initialMap[activeWorkshopId] || initialMap[DEFAULT_WORKSHOP_ID];
    return active ? active.participants : INITIAL_PARTICIPANTS;
  });

  const [config, setConfig] = useState<WorkshopConfig>(() => {
    const initialMap = loadInitialSessions();
    const active = initialMap[activeWorkshopId] || initialMap[DEFAULT_WORKSHOP_ID];
    return active ? active.config : WORKSHOP_CONFIG;
  });

  const [certificateSettings, setCertificateSettings] = useState<CertificateSettings>(() => {
    const initialMap = loadInitialSessions();
    const active = initialMap[activeWorkshopId] || initialMap[DEFAULT_WORKSHOP_ID];
    return active
      ? normalizeCertificateSettings(active.certificateSettings)
      : loadLegacyCertSettings(activeWorkshopId);
  });

  const [feedbacks, setFeedbacks] = useState<Record<string, ParticipantFeedback>>(() => {
    const initialMap = loadInitialSessions();
    const active = initialMap[activeWorkshopId] || initialMap[DEFAULT_WORKSHOP_ID];
    return active?.feedbacks || loadLegacyFeedbacks(activeWorkshopId);
  });

  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(() => {
    return participants[0]?.id || 'HY-001';
  });

  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [authSession, setAuthSession] = useState<AuthenticatedUserSession | null>(
    loadInitialAuthSession
  );
  const [isCloudReady, setIsCloudReady] = useState<boolean>(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [isCertCloudSynced, setIsCertCloudSynced] = useState<boolean>(false);
  const [isCertCloudSaving, setIsCertCloudSaving] = useState<boolean>(false);
  const [lastCertCloudSyncAt, setLastCertCloudSyncAt] = useState<string | null>(null);

  const persistAuthSession = (session: AuthenticatedUserSession | null) => {
    setAuthSession(session);
    try {
      if (session) {
        localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage error
    }
  };

  // Strict RBAC derived from authenticated session:
  // - Admin (paku.tanam@gmail.com): full access to everything
  // - Panitia 1-3 (pass: 12345678): access only to Dashboard Kehadiran Peserta, Scanner, and Layar TV
  const isAuthenticated = authSession !== null;
  const isAdmin =
    authSession?.role === 'admin' && authSession.identifier.toLowerCase() === ADMIN_EMAIL;
  const isPanitia = authSession?.role === 'panitia';
  const canManageParticipants = isAdmin;
  const canVerifyPayment = isAdmin || isPanitia;

  const participantsRef = useRef(participants);
  const configRef = useRef(config);
  const certificateSettingsRef = useRef(certificateSettings);
  const feedbacksRef = useRef(feedbacks);
  const activeWorkshopIdRef = useRef(activeWorkshopId);
  const certDebounceTimerRef = useRef<number | null>(null);
  const isApplyingExternalSyncRef = useRef<boolean>(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const broadcastSessionSync = (
    targetWorkshopId: string,
    nextRecord: LocalSessionRecord
  ) => {
    if (isApplyingExternalSyncRef.current) return;
    try {
      broadcastChannelRef.current?.postMessage({
        type: 'SESSION_SYNC',
        workshopId: targetWorkshopId,
        record: nextRecord,
        timestamp: Date.now(),
      });
    } catch {
      // Ignore BroadcastChannel errors
    }
  };

  // Real-time Cross-Tab / Cross-Window Synchronization (BroadcastChannel + localStorage event)
  useEffect(() => {
    const applyIncomingSession = (targetId: string, incoming: LocalSessionRecord) => {
      if (!incoming || !targetId) return;
      isApplyingExternalSyncRef.current = true;
      try {
        setLocalSessions((prev) => ({
          ...prev,
          [targetId]: incoming,
        }));
        if (targetId === activeWorkshopIdRef.current) {
          if (Array.isArray(incoming.participants)) {
            participantsRef.current = incoming.participants;
            setParticipants(incoming.participants);
          }
          if (incoming.config) {
            configRef.current = incoming.config;
            setConfig(incoming.config);
          }
          if (incoming.certificateSettings) {
            const normCert = normalizeCertificateSettings(incoming.certificateSettings);
            certificateSettingsRef.current = normCert;
            setCertificateSettings(normCert);
          }
          if (incoming.feedbacks) {
            feedbacksRef.current = incoming.feedbacks;
            setFeedbacks(incoming.feedbacks);
          }
        }
      } finally {
        window.setTimeout(() => {
          isApplyingExternalSyncRef.current = false;
        }, 40);
      }
    };

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const ch = new BroadcastChannel('heal_you_realtime_sync_v1');
        broadcastChannelRef.current = ch;
        ch.onmessage = (ev) => {
          if (ev.data?.type === 'SESSION_SYNC' && ev.data.workshopId && ev.data.record) {
            applyIncomingSession(ev.data.workshopId, ev.data.record as LocalSessionRecord);
          }
        };
      } catch {
        // Ignore if BroadcastChannel is blocked
      }
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'workshop_sessions_v1' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as Record<string, LocalSessionRecord>;
          const curId = activeWorkshopIdRef.current;
          if (parsed && parsed[curId]) {
            applyIncomingSession(curId, parsed[curId]);
          }
        } catch {
          // Ignore malformed JSON
        }
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      try {
        broadcastChannelRef.current?.close();
      } catch {
        // Ignore
      }
      broadcastChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    activeWorkshopIdRef.current = activeWorkshopId;
    localStorage.setItem('active_workshop_id', activeWorkshopId);
  }, [activeWorkshopId]);

  useEffect(() => {
    participantsRef.current = participants;
    localStorage.setItem('workshop_participants', JSON.stringify(participants));
    setLocalSessions((prev) => {
      const curId = activeWorkshopIdRef.current;
      const nextRec: LocalSessionRecord = {
        workshopId: curId,
        config: configRef.current,
        participants,
        certificateSettings: certificateSettingsRef.current,
        feedbacks: feedbacksRef.current,
      };
      const updated = {
        ...prev,
        [curId]: nextRec,
      };
      try {
        localStorage.setItem('workshop_sessions_v1', JSON.stringify(updated));
      } catch {
        // Ignore quota errors
      }
      broadcastSessionSync(curId, nextRec);
      return updated;
    });
  }, [participants]);

  useEffect(() => {
    configRef.current = config;
    localStorage.setItem('workshop_config', JSON.stringify(config));
    setLocalSessions((prev) => {
      const curId = activeWorkshopIdRef.current;
      const nextRec: LocalSessionRecord = {
        workshopId: curId,
        config,
        participants: participantsRef.current,
        certificateSettings: certificateSettingsRef.current,
        feedbacks: feedbacksRef.current,
      };
      const updated = {
        ...prev,
        [curId]: nextRec,
      };
      try {
        localStorage.setItem('workshop_sessions_v1', JSON.stringify(updated));
      } catch {
        // Ignore quota errors
      }
      broadcastSessionSync(curId, nextRec);
      return updated;
    });
  }, [config]);

  useEffect(() => {
    certificateSettingsRef.current = certificateSettings;
    const curId = activeWorkshopIdRef.current;
    try {
      localStorage.setItem(
        `heal_you_cert_settings_${curId}`,
        JSON.stringify(certificateSettings)
      );
      localStorage.setItem(
        'heal_you_certificate_settings_v1',
        JSON.stringify(certificateSettings)
      );
    } catch {
      // Ignore quota errors
    }
    setLocalSessions((prev) => {
      const nextRec: LocalSessionRecord = {
        workshopId: curId,
        config: configRef.current,
        participants: participantsRef.current,
        certificateSettings,
        feedbacks: feedbacksRef.current,
      };
      const updated = {
        ...prev,
        [curId]: nextRec,
      };
      try {
        localStorage.setItem('workshop_sessions_v1', JSON.stringify(updated));
      } catch {
        // Ignore quota errors
      }
      broadcastSessionSync(curId, nextRec);
      return updated;
    });
  }, [certificateSettings]);

  useEffect(() => {
    feedbacksRef.current = feedbacks;
    const curId = activeWorkshopIdRef.current;
    try {
      localStorage.setItem(`heal_you_feedbacks_${curId}`, JSON.stringify(feedbacks));
    } catch {
      // Ignore quota errors
    }
    setLocalSessions((prev) => {
      const nextRec: LocalSessionRecord = {
        workshopId: curId,
        config: configRef.current,
        participants: participantsRef.current,
        certificateSettings: certificateSettingsRef.current,
        feedbacks,
      };
      const updated = {
        ...prev,
        [curId]: nextRec,
      };
      try {
        localStorage.setItem('workshop_sessions_v1', JSON.stringify(updated));
      } catch {
        // Ignore quota errors
      }
      broadcastSessionSync(curId, nextRec);
      return updated;
    });
  }, [feedbacks]);

  const upsertCertSettingsToFirestore = async (
    targetWorkshopId: string,
    settingsToSave: CertificateSettings,
    userObj: User | null = cloudUser
  ): Promise<boolean> => {
    const activeAuthUser = auth.currentUser || userObj;
    if (
      !activeAuthUser ||
      !activeAuthUser.emailVerified ||
      activeAuthUser.email?.toLowerCase() !== ADMIN_EMAIL
    ) {
      return false;
    }
    const certDocRef = doc(
      db,
      'workshops',
      targetWorkshopId,
      'certificateSettings',
      CERT_SETTINGS_DOC_ID
    );
    const certPath = `workshops/${targetWorkshopId}/certificateSettings/${CERT_SETTINGS_DOC_ID}`;
    const payload = buildFirestoreCertPayload(
      settingsToSave,
      targetWorkshopId,
      activeAuthUser.uid
    );

    setIsCertCloudSaving(true);
    try {
      const snap = await getDoc(certDocRef);
      if (snap.exists()) {
        await updateDoc(certDocRef, {
          ownerId: payload.ownerId,
          organizerHeader: payload.organizerHeader,
          certTitle: payload.certTitle,
          certSubtitle: payload.certSubtitle,
          numberSuffix: payload.numberSuffix,
          city: payload.city,
          bodyIntro: payload.bodyIntro,
          signer1Label: payload.signer1Label,
          signer1Name: payload.signer1Name,
          signer1Title: payload.signer1Title,
          signer1SigMode: payload.signer1SigMode,
          signer1SignatureText: payload.signer1SignatureText,
          signer1SignatureDataUrl: payload.signer1SignatureDataUrl,
          enableSigner2: payload.enableSigner2,
          signer2Name: payload.signer2Name,
          signer2Title: payload.signer2Title,
          signer2SigMode: payload.signer2SigMode,
          signer2SignatureText: payload.signer2SignatureText,
          signer2SignatureDataUrl: payload.signer2SignatureDataUrl,
          customTemplateDataUrl: payload.customTemplateDataUrl,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(certDocRef, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setIsCertCloudSynced(true);
      setLastCertCloudSyncAt(new Date().toISOString());
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, certPath);
      return false;
    } finally {
      setIsCertCloudSaving(false);
    }
  };

  // Listen to Firebase Auth & initialize default 'main' workshop document if needed
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCloudUser(null);
        setIsCloudReady(false);
        setIsCloudSyncing(false);
        setIsCertCloudSynced(false);
        return;
      }

      // Only allow verified paku.tanam@gmail.com to authenticate via Google Cloud
      if (!user.emailVerified || user.email?.toLowerCase() !== ADMIN_EMAIL) {
        await signOutFromCloud();
        setCloudUser(null);
        setIsCloudReady(false);
        setIsCloudSyncing(false);
        setIsCertCloudSynced(false);
        return;
      }

      setCloudUser(user);
      persistAuthSession({
        role: 'admin',
        identifier: ADMIN_EMAIL,
        displayName: user.displayName || 'Admin Utama (paku.tanam@gmail.com)',
        loggedInAt: new Date().toISOString(),
      });

      setIsCloudSyncing(true);
      const uid = user.uid;
      const curEventId = activeWorkshopIdRef.current || DEFAULT_WORKSHOP_ID;
      const workshopDocRef = doc(db, 'workshops', curEventId);
      const certDocRef = doc(
        db,
        'workshops',
        curEventId,
        'certificateSettings',
        CERT_SETTINGS_DOC_ID
      );

      try {
        await user.getIdToken();
        if (!auth.currentUser || auth.currentUser.uid !== uid) {
          return;
        }

        const snap = await getDoc(workshopDocRef);
        if (!auth.currentUser || auth.currentUser.uid !== uid) {
          return;
        }

        if (!snap.exists()) {
          const curCfg = configRef.current;
          // 1. Create parent workshop document first so exists(/workshops/{id}) is true for subcollections
          await setDoc(workshopDocRef, {
            workshopId: curEventId,
            ownerId: uid,
            name: clampStr(curCfg.name, 200, WORKSHOP_CONFIG.name),
            date: clampStr(curCfg.date, 40, WORKSHOP_CONFIG.date),
            startTime: clampStr(curCfg.startTime, 64, WORKSHOP_CONFIG.startTime),
            location: clampStr(curCfg.location, 200, WORKSHOP_CONFIG.location),
            organizer: clampStr(curCfg.organizer, 120, 'Muslimah Healing Journey'),
            tagline: clampStr(curCfg.tagline, 120, "Let's Heal"),
            eventLabel: clampStr(curCfg.eventLabel, 120, 'Agenda Workshop Psikologi'),
            customLogoUrl: (curCfg.customLogoUrl ?? '').slice(0, 350000),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // 2. Upsert certificate settings safely
          await upsertCertSettingsToFirestore(
            curEventId,
            certificateSettingsRef.current,
            user
          );

          // 3. Seed initial participants if not already present
          for (const p of participantsRef.current) {
            if (!auth.currentUser || auth.currentUser.uid !== uid) break;
            const safeId = migrateId(p.id);
            const pRef = doc(db, 'workshops', curEventId, 'participants', safeId);
            const pSnap = await getDoc(pRef);
            if (!pSnap.exists()) {
              await setDoc(pRef, {
                id: safeId,
                workshopId: curEventId,
                ownerId: uid,
                name: clampStr(p.name, 160, 'Peserta'),
                email: clampStr(p.email, 160, '-'),
                institution: clampStr(p.institution, 160, '-'),
                role: clampStr(p.role, 100, 'Peserta Workshop'),
                phone: (p.phone ?? '').trim().slice(0, 60),
                status: p.status,
                checkInTime: (p.checkInTime ?? '').slice(0, 64),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          }
        } else {
          const d = snap.data();
          const hasAllRequiredFields =
            typeof d.workshopId === 'string' &&
            typeof d.ownerId === 'string' &&
            typeof d.organizer === 'string' &&
            typeof d.tagline === 'string' &&
            typeof d.eventLabel === 'string' &&
            typeof d.customLogoUrl === 'string' &&
            Boolean(d.createdAt);

          if (!hasAllRequiredFields && user.email?.toLowerCase() === ADMIN_EMAIL) {
            await setDoc(workshopDocRef, {
              workshopId: curEventId,
              ownerId: uid,
              name: clampStr(d.name, 200, WORKSHOP_CONFIG.name),
              date: clampStr(d.date, 40, WORKSHOP_CONFIG.date),
              startTime: clampStr(d.startTime, 64, WORKSHOP_CONFIG.startTime),
              location: clampStr(d.location, 200, WORKSHOP_CONFIG.location),
              organizer: clampStr(d.organizer, 120, 'Muslimah Healing Journey'),
              tagline: clampStr(d.tagline, 120, "Let's Heal"),
              eventLabel: clampStr(d.eventLabel, 120, 'Agenda Workshop Psikologi'),
              customLogoUrl: (d.customLogoUrl ?? '').slice(0, 350000),
              createdAt: d.createdAt || serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          // Ensure certificateSettings/config exists for existing workshop if user is Admin
          if (user.email?.toLowerCase() === ADMIN_EMAIL) {
            const certSnap = await getDoc(certDocRef);
            if (!certSnap.exists()) {
              await upsertCertSettingsToFirestore(
                curEventId,
                certificateSettingsRef.current,
                user
              );
            }
          }
        }

        if (auth.currentUser && auth.currentUser.uid === uid) {
          setIsCloudReady(true);
        }
      } catch (error) {
        if (auth.currentUser && auth.currentUser.uid === uid) {
          handleFirestoreError(error, OperationType.WRITE, `workshops/${curEventId}`);
        }
      } finally {
        setIsCloudSyncing(false);
      }
    });

    return () => unsubAuth();
  }, []);

  // Real-time onSnapshot listeners on the currently selected activeWorkshopId
  useEffect(() => {
    if (!cloudUser || !isCloudReady) return;
    const currentEventId = activeWorkshopId;
    const workshopPath = `workshops/${currentEventId}`;
    const participantsPath = `workshops/${currentEventId}/participants`;
    const certPath = `workshops/${currentEventId}/certificateSettings/${CERT_SETTINGS_DOC_ID}`;
    const feedbacksPath = `workshops/${currentEventId}/feedbacks`;

    const unsubWorkshop = onSnapshot(
      doc(db, 'workshops', currentEventId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setConfig({
            name: data.name || WORKSHOP_CONFIG.name,
            date: data.date || WORKSHOP_CONFIG.date,
            startTime: data.startTime || WORKSHOP_CONFIG.startTime,
            location: data.location || WORKSHOP_CONFIG.location,
            organizer: data.organizer || 'Muslimah Healing Journey',
            tagline: data.tagline || "Let's Heal",
            eventLabel: data.eventLabel || 'Agenda Workshop Psikologi',
            customLogoUrl: data.customLogoUrl || '',
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, workshopPath);
      }
    );

    const unsubCertSettings = onSnapshot(
      doc(db, 'workshops', currentEventId, 'certificateSettings', CERT_SETTINGS_DOC_ID),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const synced = normalizeCertificateSettings({
            organizerHeader: data.organizerHeader ?? '',
            certTitle: data.certTitle,
            certSubtitle: data.certSubtitle,
            numberSuffix: data.numberSuffix,
            city: data.city,
            bodyIntro: data.bodyIntro,
            signer1Label: data.signer1Label,
            signer1Name: data.signer1Name,
            signer1Title: data.signer1Title,
            signer1SigMode: data.signer1SigMode,
            signer1SignatureText: data.signer1SignatureText,
            signer1SignatureDataUrl: data.signer1SignatureDataUrl || undefined,
            enableSigner2: Boolean(data.enableSigner2),
            signer2Name: data.signer2Name,
            signer2Title: data.signer2Title,
            signer2SigMode: data.signer2SigMode,
            signer2SignatureText: data.signer2SignatureText,
            signer2SignatureDataUrl: data.signer2SignatureDataUrl || undefined,
            customTemplateDataUrl: data.customTemplateDataUrl || undefined,
          });
          setCertificateSettings(synced);
          setIsCertCloudSynced(true);
          setLastCertCloudSyncAt(new Date().toISOString());
        } else if (cloudUser.email?.toLowerCase() === ADMIN_EMAIL) {
          const localFallback =
            localSessions[currentEventId]?.certificateSettings ||
            loadLegacyCertSettings(currentEventId);
          void upsertCertSettingsToFirestore(currentEventId, localFallback, cloudUser);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, certPath);
      }
    );

    const qParticipants = query(
      collection(db, 'workshops', currentEventId, 'participants'),
      where('workshopId', '==', currentEventId)
    );

    const unsubParticipants = onSnapshot(
      qParticipants,
      (querySnap) => {
        const prevMap = new Map<string, Participant>();
        participantsRef.current.forEach((existingP) => {
          prevMap.set(existingP.id.toUpperCase(), existingP);
        });
        const list: Participant[] = querySnap.docs.map((d) => {
          const item = d.data();
          const prevP = prevMap.get(String(item.id || d.id).toUpperCase());
          return migrateParticipantDomicile(
            {
              id: item.id,
              name: item.name,
              email: item.email,
              institution: item.institution,
              role: item.role || 'Peserta Workshop',
              phone: item.phone || '',
              status: item.status,
              checkInTime: item.checkInTime ? item.checkInTime : undefined,
              paymentVerified: prevP?.paymentVerified,
              paymentProofUrl: prevP?.paymentProofUrl,
              paymentFileName: prevP?.paymentFileName,
              paymentSubmittedAt: prevP?.paymentSubmittedAt,
              paymentVerifiedAt: prevP?.paymentVerifiedAt,
              paymentVerifiedBy: prevP?.paymentVerifiedBy,
            },
            currentEventId
          );
        });
        list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
        setParticipants(list);
        if (list.length > 0) {
          setSelectedParticipantId(list[0].id);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, participantsPath);
      }
    );

    const qFeedbacks = query(
      collection(db, 'workshops', currentEventId, 'feedbacks'),
      where('workshopId', '==', currentEventId)
    );

    const unsubFeedbacks = onSnapshot(
      qFeedbacks,
      (querySnap) => {
        const map: Record<string, ParticipantFeedback> = { ...feedbacksRef.current };
        querySnap.docs.forEach((d) => {
          const item = d.data();
          const pid = item.participantId || d.id;
          map[pid] = {
            participantId: pid,
            participantName: item.participantName || 'Peserta',
            institution: item.institution || '-',
            overallRating: Number(item.overallRating) || 5,
            speakerRating: Number(item.speakerRating) || 5,
            facilityRating: Number(item.facilityRating) || 5,
            takeaway: item.takeaway || '',
            suggestedTopic: item.suggestedTopic || '',
            recommendation:
              item.recommendation === 'Merekomendasikan' || item.recommendation === 'Cukup'
                ? item.recommendation
                : 'Sangat Merekomendasikan',
            submittedAt: item.submittedAt || new Date().toISOString(),
            certificateClaimed: Boolean(item.certificateClaimed),
          };
        });
        setFeedbacks(map);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, feedbacksPath);
      }
    );

    return () => {
      unsubWorkshop();
      unsubCertSettings();
      unsubParticipants();
      unsubFeedbacks();
    };
  }, [cloudUser, isCloudReady, activeWorkshopId]);

  const eventsList: WorkshopEventItem[] = (Object.values(localSessions) as LocalSessionRecord[])
    .map((s) => ({
      workshopId: s.workshopId,
      config: s.config,
      participantCount: s.participants.length,
      certificateSettings: s.certificateSettings,
    }))
    .sort((a, b) => b.config.date.localeCompare(a.config.date));

  const switchWorkshop = (workshopId: string) => {
    if (workshopId === activeWorkshopId) return;
    if (certDebounceTimerRef.current) {
      window.clearTimeout(certDebounceTimerRef.current);
      certDebounceTimerRef.current = null;
    }

    const target = localSessions[workshopId];
    activeWorkshopIdRef.current = workshopId;
    setActiveWorkshopId(workshopId);

    if (target) {
      setConfig(target.config);
      setParticipants(target.participants);
      setCertificateSettings(
        normalizeCertificateSettings(
          target.certificateSettings || loadLegacyCertSettings(workshopId)
        )
      );
      setFeedbacks(target.feedbacks || loadLegacyFeedbacks(workshopId));
      if (target.participants[0]?.id) {
        setSelectedParticipantId(target.participants[0].id);
      }
    } else {
      setCertificateSettings(loadLegacyCertSettings(workshopId));
      setFeedbacks(loadLegacyFeedbacks(workshopId));
    }
  };

  const submitParticipantFeedback = (data: {
    participantId: string;
    participantName: string;
    institution: string;
    overallRating: number;
    speakerRating: number;
    facilityRating: number;
    takeaway: string;
    suggestedTopic?: string;
    recommendation: FeedbackRecommendation;
  }): ParticipantFeedback => {
    const safePid = migrateId(data.participantId.trim().toUpperCase());
    const clampRating = (n: number) => Math.max(1, Math.min(5, Math.round(n || 5)));
    const record: ParticipantFeedback = {
      participantId: safePid,
      participantName: clampStr(data.participantName, 160, 'Peserta'),
      institution: clampStr(data.institution, 160, '-'),
      overallRating: clampRating(data.overallRating),
      speakerRating: clampRating(data.speakerRating),
      facilityRating: clampRating(data.facilityRating),
      takeaway: clampStr(data.takeaway, 1000, 'Sangat bermanfaat'),
      suggestedTopic: (data.suggestedTopic ?? '').trim().slice(0, 300),
      recommendation:
        data.recommendation === 'Merekomendasikan' || data.recommendation === 'Cukup'
          ? data.recommendation
          : 'Sangat Merekomendasikan',
      submittedAt: new Date().toISOString(),
      certificateClaimed: true,
    };

    setFeedbacks((prev) => ({
      ...prev,
      [safePid]: record,
    }));

    const activeUser = auth.currentUser;
    if (
      cloudUser &&
      activeUser &&
      activeUser.emailVerified &&
      activeUser.email?.toLowerCase() === ADMIN_EMAIL
    ) {
      const curEventId = activeWorkshopIdRef.current;
      const fRef = doc(db, 'workshops', curEventId, 'feedbacks', safePid);
      const fPath = `workshops/${curEventId}/feedbacks/${safePid}`;
      const uid = activeUser.uid;
      void (async () => {
        try {
          const snap = await getDoc(fRef);
          const payload = {
            feedbackId: safePid,
            workshopId: curEventId,
            ownerId: uid,
            participantId: safePid,
            participantName: record.participantName,
            institution: record.institution,
            overallRating: record.overallRating,
            speakerRating: record.speakerRating,
            facilityRating: record.facilityRating,
            takeaway: record.takeaway,
            suggestedTopic: record.suggestedTopic || '',
            recommendation: record.recommendation,
            submittedAt: record.submittedAt,
            certificateClaimed: true,
          };
          if (snap.exists()) {
            await updateDoc(fRef, {
              ownerId: payload.ownerId,
              participantName: payload.participantName,
              institution: payload.institution,
              overallRating: payload.overallRating,
              speakerRating: payload.speakerRating,
              facilityRating: payload.facilityRating,
              takeaway: payload.takeaway,
              suggestedTopic: payload.suggestedTopic,
              recommendation: payload.recommendation,
              submittedAt: payload.submittedAt,
              certificateClaimed: true,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(fRef, {
              ...payload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, fPath);
        }
      })();
    }

    return record;
  };

  const updateCertificateSettings = (
    updates:
      | Partial<CertificateSettings>
      | ((prev: CertificateSettings) => CertificateSettings)
  ) => {
    if (!canManageParticipants) return;
    const prev = certificateSettingsRef.current;
    const rawNext = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
    const next = normalizeCertificateSettings(rawNext);
    certificateSettingsRef.current = next;
    setCertificateSettings(next);

    if (cloudUser && isAdmin) {
      const targetEventId = activeWorkshopIdRef.current;
      if (certDebounceTimerRef.current) {
        window.clearTimeout(certDebounceTimerRef.current);
      }
      certDebounceTimerRef.current = window.setTimeout(() => {
        void upsertCertSettingsToFirestore(targetEventId, next, cloudUser);
      }, 450);
    }
  };

  const resetCertificateSettings = () => {
    if (!canManageParticipants) return;
    const fresh = { ...DEFAULT_CERT_SETTINGS };
    certificateSettingsRef.current = fresh;
    setCertificateSettings(fresh);
    if (cloudUser && isAdmin) {
      void upsertCertSettingsToFirestore(activeWorkshopIdRef.current, fresh, cloudUser);
    }
  };

  const saveCertificateSettingsToCloudNow = async (): Promise<boolean> => {
    if (certDebounceTimerRef.current) {
      window.clearTimeout(certDebounceTimerRef.current);
      certDebounceTimerRef.current = null;
    }
    if (!cloudUser || !isAdmin) return false;
    return upsertCertSettingsToFirestore(
      activeWorkshopIdRef.current,
      certificateSettingsRef.current,
      cloudUser
    );
  };

  const copyCertificateSettingsToAllWorkshops = async (): Promise<number> => {
    if (!canManageParticipants) return 0;
    const currentCert = normalizeCertificateSettings(certificateSettingsRef.current);
    const allEventIds = Object.keys(localSessions);

    setLocalSessions((prev) => {
      const updated: Record<string, LocalSessionRecord> = {};
      for (const [id, rec] of Object.entries(prev) as Array<[string, LocalSessionRecord]>) {
        updated[id] = {
          ...rec,
          certificateSettings: { ...currentCert },
        };
        try {
          localStorage.setItem(
            `heal_you_cert_settings_${id}`,
            JSON.stringify(currentCert)
          );
        } catch {
          // Ignore quota
        }
      }
      try {
        localStorage.setItem('workshop_sessions_v1', JSON.stringify(updated));
      } catch {
        // Ignore quota
      }
      return updated;
    });

    if (cloudUser && isAdmin) {
      for (const id of allEventIds) {
        await upsertCertSettingsToFirestore(id, currentCert, cloudUser);
      }
    }

    return allEventIds.length;
  };

  const createNewWorkshop = async (params: {
    name: string;
    date: string;
    startTime: string;
    location: string;
    copyParticipants?: boolean;
  }): Promise<string> => {
    if (!canManageParticipants) return activeWorkshopId;

    const newWorkshopId = `evt-${Date.now()}`;
    const newConfig: WorkshopConfig = {
      name: clampStr(params.name, 200, 'Workshop Baru Heal You'),
      date: clampStr(params.date, 40, WORKSHOP_CONFIG.date),
      startTime: clampStr(params.startTime, 64, WORKSHOP_CONFIG.startTime),
      location: clampStr(params.location, 200, WORKSHOP_CONFIG.location),
      organizer: config.organizer || 'Muslimah Healing Journey',
      tagline: config.tagline || "Let's Heal",
      eventLabel: config.eventLabel || 'Agenda Workshop Psikologi',
      customLogoUrl: config.customLogoUrl || '',
    };

    const initialNewCertSettings: CertificateSettings = normalizeCertificateSettings({
      ...certificateSettingsRef.current,
    });

    const initialNewParticipants: Participant[] = params.copyParticipants
      ? participants.map((p) => ({
          ...p,
          status: 'PENDING',
          checkInTime: undefined,
        }))
      : [];

    setLocalSessions((prev) => {
      const updated = {
        ...prev,
        [newWorkshopId]: {
          workshopId: newWorkshopId,
          config: newConfig,
          participants: initialNewParticipants,
          certificateSettings: initialNewCertSettings,
          feedbacks: {},
        },
      };
      try {
        localStorage.setItem('workshop_sessions_v1', JSON.stringify(updated));
        localStorage.setItem(
          `heal_you_cert_settings_${newWorkshopId}`,
          JSON.stringify(initialNewCertSettings)
        );
      } catch {
        // Ignore quota
      }
      return updated;
    });

    const activeUser = auth.currentUser;
    if (
      cloudUser &&
      isAdmin &&
      activeUser &&
      activeUser.emailVerified &&
      activeUser.email?.toLowerCase() === ADMIN_EMAIL
    ) {
      const uid = activeUser.uid;
      try {
        const batch = writeBatch(db);
        const wRef = doc(db, 'workshops', newWorkshopId);
        batch.set(wRef, {
          workshopId: newWorkshopId,
          ownerId: uid,
          name: newConfig.name,
          date: newConfig.date,
          startTime: newConfig.startTime,
          location: newConfig.location,
          organizer: clampStr(newConfig.organizer, 120, 'Muslimah Healing Journey'),
          tagline: clampStr(newConfig.tagline, 120, "Let's Heal"),
          eventLabel: clampStr(newConfig.eventLabel, 120, 'Agenda Workshop Psikologi'),
          customLogoUrl: (newConfig.customLogoUrl ?? '').slice(0, 350000),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const certRef = doc(
          db,
          'workshops',
          newWorkshopId,
          'certificateSettings',
          CERT_SETTINGS_DOC_ID
        );
        batch.set(certRef, {
          ...buildFirestoreCertPayload(initialNewCertSettings, newWorkshopId, uid),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        for (const p of initialNewParticipants) {
          const safeId = migrateId(p.id);
          const pRef = doc(db, 'workshops', newWorkshopId, 'participants', safeId);
          batch.set(pRef, {
            id: safeId,
            workshopId: newWorkshopId,
            ownerId: uid,
            name: clampStr(p.name, 160, 'Peserta'),
            email: clampStr(p.email, 160, '-'),
            institution: clampStr(p.institution, 160, '-'),
            role: clampStr(p.role, 100, 'Peserta Workshop'),
            phone: (p.phone ?? '').trim().slice(0, 60),
            status: 'PENDING',
            checkInTime: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `workshops/${newWorkshopId}`);
      }
    }

    activeWorkshopIdRef.current = newWorkshopId;
    setActiveWorkshopId(newWorkshopId);
    setConfig(newConfig);
    setParticipants(initialNewParticipants);
    setCertificateSettings(initialNewCertSettings);
    setFeedbacks({});
    if (initialNewParticipants[0]?.id) {
      setSelectedParticipantId(initialNewParticipants[0].id);
    }

    return newWorkshopId;
  };

  const deleteWorkshop = async (workshopIdToDelete: string) => {
    if (!canManageParticipants) return;
    if (eventsList.length <= 1) return;

    const remainingEvents = eventsList.filter((e) => e.workshopId !== workshopIdToDelete);
    const nextActiveId =
      workshopIdToDelete === activeWorkshopId
        ? remainingEvents[0]?.workshopId || DEFAULT_WORKSHOP_ID
        : activeWorkshopId;

    setLocalSessions((prev) => {
      const copy = { ...prev };
      delete copy[workshopIdToDelete];
      try {
        localStorage.setItem('workshop_sessions_v1', JSON.stringify(copy));
        localStorage.removeItem(`heal_you_cert_settings_${workshopIdToDelete}`);
        localStorage.removeItem(`heal_you_feedbacks_${workshopIdToDelete}`);
      } catch {
        // Ignore
      }
      return copy;
    });

    const activeUser = auth.currentUser;
    if (
      cloudUser &&
      isAdmin &&
      activeUser &&
      activeUser.emailVerified &&
      activeUser.email?.toLowerCase() === ADMIN_EMAIL
    ) {
      try {
        const pQuery = query(
          collection(db, 'workshops', workshopIdToDelete, 'participants'),
          where('workshopId', '==', workshopIdToDelete)
        );
        const fQuery = query(
          collection(db, 'workshops', workshopIdToDelete, 'feedbacks'),
          where('workshopId', '==', workshopIdToDelete)
        );
        const [pSnap, fSnap] = await Promise.all([getDocs(pQuery), getDocs(fQuery)]);
        const batch = writeBatch(db);
        pSnap.docs.forEach((d) => batch.delete(d.ref));
        fSnap.docs.forEach((d) => batch.delete(d.ref));
        batch.delete(
          doc(db, 'workshops', workshopIdToDelete, 'certificateSettings', CERT_SETTINGS_DOC_ID)
        );
        batch.delete(doc(db, 'workshops', workshopIdToDelete));
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `workshops/${workshopIdToDelete}`);
      }
    }

    if (workshopIdToDelete === activeWorkshopId) {
      switchWorkshop(nextActiveId);
    }
  };

  const syncParticipantUpdateToCloud = async (id: string, updates: Record<string, unknown>) => {
    const activeUser = auth.currentUser;
    if (
      !cloudUser ||
      !activeUser ||
      !activeUser.emailVerified ||
      activeUser.email?.toLowerCase() !== ADMIN_EMAIL
    ) {
      return;
    }
    const curEventId = activeWorkshopIdRef.current;
    const safeId = migrateId(id);
    const pPath = `workshops/${curEventId}/participants/${safeId}`;
    try {
      await updateDoc(doc(db, 'workshops', curEventId, 'participants', safeId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, pPath);
    }
  };

  const syncNewParticipantToCloud = async (p: Participant, allowSelfRegister = false) => {
    const activeUser = auth.currentUser;
    if (
      !cloudUser ||
      !activeUser ||
      !activeUser.emailVerified ||
      activeUser.email?.toLowerCase() !== ADMIN_EMAIL
    ) {
      return;
    }
    if (!isAdmin && !allowSelfRegister) return;
    const uid = activeUser.uid;
    const curEventId = activeWorkshopIdRef.current;
    const safeId = migrateId(p.id);
    const pPath = `workshops/${curEventId}/participants/${safeId}`;
    try {
      await setDoc(doc(db, 'workshops', curEventId, 'participants', safeId), {
        id: safeId,
        workshopId: curEventId,
        ownerId: uid,
        name: clampStr(p.name, 160, 'Peserta'),
        email: clampStr(p.email, 160, '-'),
        institution: clampStr(p.institution, 160, '-'),
        role: clampStr(p.role, 100, 'Peserta Workshop'),
        phone: (p.phone ?? '').trim().slice(0, 60),
        status: p.status,
        checkInTime: (p.checkInTime ?? '').slice(0, 64),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, pPath);
    }
  };

  const checkIn = (id: string) => {
    const verification = verifyScannedParticipantQr(
      id,
      participants,
      activeWorkshopIdRef.current
    );

    if (verification.isForgedSignature) {
      return {
        success: false,
        message:
          'Kode Barcode / QR ditolak karena tanda tangan keamanan (#HY-Signature) tidak valid.',
      };
    }

    const extracted = extractBaseParticipantIdFromQr(id);
    const normalizedId = migrateId(extracted || id.trim());
    const participantIndex = participants.findIndex(
      (p) =>
        p.id.toUpperCase() === normalizedId.toUpperCase() ||
        p.id.toUpperCase() === extracted.toUpperCase()
    );

    if (participantIndex === -1) {
      return { success: false, message: 'Peserta tidak ditemukan atau kode QR tidak valid.' };
    }

    const participant = participants[participantIndex];

    if (participant.paymentVerified === false) {
      return {
        success: false,
        message: `Pembayaran ${participant.name} (${participant.id}) belum diverifikasi (Menunggu Approval Admin/Panitia). Silakan ACC pembayaran terlebih dahulu.`,
        participant,
      };
    }

    if (participant.status !== 'PENDING') {
      return {
        success: false,
        message: `${participant.name} sudah melakukan check-in sebelumnya.`,
        participant,
      };
    }

    const now = new Date();
    const startTime = new Date(config.startTime);
    const isLate = isAfter(now, startTime);
    const checkInIso = now.toISOString();

    const updatedParticipant: Participant = {
      ...participant,
      status: isLate ? 'LATE' : 'PRESENT',
      checkInTime: checkInIso,
    };

    const newParticipants = [...participants];
    newParticipants[participantIndex] = updatedParticipant;
    setParticipants(newParticipants);

    void syncParticipantUpdateToCloud(participant.id, {
      status: updatedParticipant.status,
      checkInTime: checkInIso,
    });

    return {
      success: true,
      message: `${updatedParticipant.name} berhasil check-in (${isLate ? 'Hadir Terlambat' : 'Hadir Tepat Waktu'}).`,
      participant: updatedParticipant,
    };
  };

  const registerParticipant = (
    data: {
      id?: string;
      name: string;
      email: string;
      institution: string;
      role?: string;
      phone?: string;
      paymentVerified?: boolean;
      paymentProofUrl?: string;
      paymentFileName?: string;
      paymentSubmittedAt?: string;
    },
    options?: { allowSelfRegister?: boolean }
  ): Participant => {
    const existingNums = participants
      .map((p) => {
        const match = p.id.match(/^(?:HY|PSY)-(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const nextNum =
      existingNums.length > 0 ? Math.max(...existingNums) + 1 : participants.length + 1;
    const autoId = `HY-${String(nextNum).padStart(3, '0')}`;
    const newId = data.id?.trim() ? migrateId(data.id.trim().toUpperCase()) : autoId;
    const curEvtId = activeWorkshopIdRef.current;
    const nowIso = new Date().toISOString();

    const isVerified =
      typeof data.paymentVerified === 'boolean'
        ? data.paymentVerified
        : options?.allowSelfRegister
          ? false
          : true;

    const verifierName = isVerified
      ? authSession?.displayName || (isAdmin ? 'Admin Utama' : 'Admin / Panitia')
      : undefined;

    if (options?.allowSelfRegister && !isVerified) {
      saveParticipantTransferSubmission(curEvtId, {
        participantId: newId,
        phone: data.phone,
        proofDataUrl: data.paymentProofUrl,
        proofFileName: data.paymentFileName,
      });
    } else if (isVerified) {
      setParticipantPaymentApproval(curEvtId, {
        participantId: newId,
        phone: data.phone,
        verified: true,
        verifiedBy: verifierName,
        proofDataUrl: data.paymentProofUrl,
        proofFileName: data.paymentFileName,
      });
    }

    const newParticipant: Participant = {
      id: newId,
      name: clampStr(data.name, 160, 'Peserta'),
      email: clampStr(data.email, 160, '-'),
      institution: clampStr(data.institution, 160, '-'),
      role: clampStr(data.role, 100, 'Peserta Workshop'),
      phone: (data.phone ?? '').trim().slice(0, 60),
      status: 'PENDING',
      paymentVerified: isVerified,
      paymentProofUrl: data.paymentProofUrl || undefined,
      paymentFileName: data.paymentFileName || undefined,
      paymentSubmittedAt: data.paymentSubmittedAt || nowIso,
      paymentVerifiedAt: isVerified ? nowIso : undefined,
      paymentVerifiedBy: verifierName,
    };

    if (!canManageParticipants && !options?.allowSelfRegister) {
      return newParticipant;
    }

    setParticipants((prev) =>
      [...prev, newParticipant].sort((a, b) =>
        a.id.localeCompare(b.id, undefined, { numeric: true })
      )
    );
    void syncNewParticipantToCloud(newParticipant, Boolean(options?.allowSelfRegister));
    return newParticipant;
  };

  const importParticipants = (
    rows: Array<{
      id?: string;
      name: string;
      email?: string;
      institution?: string;
      role?: string;
      phone?: string;
    }>
  ): number => {
    if (!canManageParticipants) return 0;

    const validRows = rows.filter((r) => r.name && r.name.trim().length > 0);
    if (validRows.length === 0) return 0;

    const existingNums = participants
      .map((p) => {
        const match = p.id.match(/^(?:HY|PSY)-(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    let nextNum =
      existingNums.length > 0 ? Math.max(...existingNums) + 1 : participants.length + 1;

    const existingIds = new Set(participants.map((p) => p.id.toUpperCase()));
    const created: Participant[] = [];

    for (const row of validRows) {
      let candidateId = row.id?.trim() ? migrateId(row.id.trim().toUpperCase()) : '';
      if (!candidateId || existingIds.has(candidateId)) {
        while (existingIds.has(`HY-${String(nextNum).padStart(3, '0')}`)) {
          nextNum++;
        }
        candidateId = `HY-${String(nextNum).padStart(3, '0')}`;
        nextNum++;
      }
      existingIds.add(candidateId);
      created.push({
        id: candidateId,
        name: clampStr(row.name, 160, 'Peserta'),
        email: clampStr(row.email, 160, '-'),
        institution: clampStr(row.institution, 160, '-'),
        role: clampStr(row.role, 100, 'Peserta Workshop'),
        phone: (row.phone ?? '').trim().slice(0, 60),
        status: 'PENDING',
      });
    }

    if (created.length > 0) {
      setSelectedParticipantId(created[0].id);
      setParticipants((prev) =>
        [...prev, ...created].sort((a, b) =>
          a.id.localeCompare(b.id, undefined, { numeric: true })
        )
      );
      for (const p of created) {
        void syncNewParticipantToCloud(p);
      }
    }

    return created.length;
  };

  const updateParticipant = (
    id: string,
    updates: Partial<Participant>,
    options?: { allowSelfUpdate?: boolean }
  ): Participant | null => {
    const current = participants.find((p) => p.id.toUpperCase() === id.toUpperCase());
    if (!current) return null;

    const isStatusOnlyUpdate = Object.keys(updates).every(
      (k) => k === 'status' || k === 'checkInTime'
    );
    const isPaymentOnlyUpdate = Object.keys(updates).every(
      (k) =>
        k === 'paymentVerified' ||
        k === 'paymentProofUrl' ||
        k === 'paymentFileName' ||
        k === 'paymentSubmittedAt' ||
        k === 'paymentVerifiedAt' ||
        k === 'paymentVerifiedBy'
    );

    if (
      !canManageParticipants &&
      !isStatusOnlyUpdate &&
      !(canVerifyPayment && isPaymentOnlyUpdate) &&
      !options?.allowSelfUpdate
    ) {
      return current;
    }

    const curEventId = activeWorkshopIdRef.current;
    const nowIso = new Date().toISOString();
    const verifierLabel =
      authSession?.displayName || (isAdmin ? 'Admin Utama' : isPanitia ? 'Panitia' : 'Admin');

    const nextPaymentVerified =
      typeof updates.paymentVerified === 'boolean'
        ? updates.paymentVerified
        : current.paymentVerified;

    const merged: Participant = {
      ...current,
      ...updates,
      paymentVerified: nextPaymentVerified,
      paymentVerifiedAt:
        typeof updates.paymentVerified === 'boolean'
          ? updates.paymentVerified
            ? updates.paymentVerifiedAt || nowIso
            : undefined
          : current.paymentVerifiedAt,
      paymentVerifiedBy:
        typeof updates.paymentVerified === 'boolean'
          ? updates.paymentVerified
            ? updates.paymentVerifiedBy || verifierLabel
            : undefined
          : current.paymentVerifiedBy,
    };

    if (
      typeof updates.paymentVerified === 'boolean' ||
      updates.paymentProofUrl !== undefined ||
      updates.paymentFileName !== undefined
    ) {
      setParticipantPaymentApproval(curEventId, {
        participantId: merged.id,
        phone: merged.phone,
        verified: Boolean(merged.paymentVerified),
        verifiedBy: merged.paymentVerifiedBy,
        proofDataUrl: merged.paymentProofUrl,
        proofFileName: merged.paymentFileName,
      });
    }

    setParticipants((prev) =>
      prev.map((p) => (p.id.toUpperCase() === id.toUpperCase() ? merged : p))
    );

    if (cloudUser) {
      if (isStatusOnlyUpdate) {
        void syncParticipantUpdateToCloud(current.id, {
          status: merged.status,
          checkInTime: (merged.checkInTime ?? '').slice(0, 64),
        });
      } else if (isAdmin && !isPaymentOnlyUpdate) {
        if (updates.id && updates.id !== current.id) {
          void deleteDoc(
            doc(db, 'workshops', curEventId, 'participants', migrateId(current.id))
          ).catch((e) =>
            handleFirestoreError(
              e,
              OperationType.DELETE,
              `workshops/${curEventId}/participants/${current.id}`
            )
          );
          void syncNewParticipantToCloud(merged);
        } else {
          void syncParticipantUpdateToCloud(current.id, {
            ownerId: cloudUser.uid,
            name: clampStr(merged.name, 160, 'Peserta'),
            email: clampStr(merged.email, 160, '-'),
            institution: clampStr(merged.institution, 160, '-'),
            role: clampStr(merged.role, 100, 'Peserta Workshop'),
            phone: (merged.phone ?? '').trim().slice(0, 60),
            status: merged.status,
            checkInTime: (merged.checkInTime ?? '').slice(0, 64),
          });
        }
      }
    }

    return merged;
  };

  const verifyParticipantPayment = (
    id: string,
    verified: boolean,
    proofUrl?: string
  ): Participant | null => {
    if (!canVerifyPayment) return null;
    const verifierLabel =
      authSession?.displayName || (isAdmin ? 'Admin Utama' : isPanitia ? 'Panitia' : 'Admin');
    return updateParticipant(id, {
      paymentVerified: verified,
      paymentVerifiedAt: verified ? new Date().toISOString() : undefined,
      paymentVerifiedBy: verified ? verifierLabel : undefined,
      ...(proofUrl ? { paymentProofUrl: proofUrl } : {}),
    });
  };

  const deleteParticipant = (id: string) => {
    if (!canManageParticipants) return;
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    if (cloudUser && isAdmin) {
      const curEventId = activeWorkshopIdRef.current;
      const safeId = migrateId(id);
      void deleteDoc(doc(db, 'workshops', curEventId, 'participants', safeId)).catch((e) =>
        handleFirestoreError(
          e,
          OperationType.DELETE,
          `workshops/${curEventId}/participants/${safeId}`
        )
      );
    }
  };

  const updateConfig = (updates: Partial<WorkshopConfig>) => {
    if (!canManageParticipants) return;
    const merged: WorkshopConfig = { ...config, ...updates };
    setConfig(merged);

    if (
      cloudUser &&
      isAdmin &&
      auth.currentUser &&
      auth.currentUser.email?.toLowerCase() === ADMIN_EMAIL
    ) {
      const curEventId = activeWorkshopIdRef.current;
      const wPath = `workshops/${curEventId}`;
      const wRef = doc(db, 'workshops', curEventId);
      const uid = auth.currentUser.uid;
      void (async () => {
        try {
          const snap = await getDoc(wRef);
          await setDoc(wRef, {
            workshopId: curEventId,
            ownerId: uid,
            name: clampStr(merged.name, 200, WORKSHOP_CONFIG.name),
            date: clampStr(merged.date, 40, WORKSHOP_CONFIG.date),
            startTime: clampStr(merged.startTime, 64, WORKSHOP_CONFIG.startTime),
            location: clampStr(merged.location, 200, WORKSHOP_CONFIG.location),
            organizer: clampStr(merged.organizer, 120, 'Muslimah Healing Journey'),
            tagline: clampStr(merged.tagline, 120, "Let's Heal"),
            eventLabel: clampStr(merged.eventLabel, 120, 'Agenda Workshop Psikologi'),
            customLogoUrl: (merged.customLogoUrl ?? '').slice(0, 350000),
            createdAt: snap.exists() && snap.data().createdAt ? snap.data().createdAt : serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.UPDATE, wPath);
        }
      })();
    }
  };

  const resetAttendance = () => {
    const attendedList = participants.filter((p) => p.status !== 'PENDING' || p.checkInTime);
    setParticipants((prev) =>
      prev.map((p) => ({
        ...p,
        status: 'PENDING',
        checkInTime: undefined,
      }))
    );

    if (cloudUser) {
      for (const p of attendedList) {
        void syncParticipantUpdateToCloud(p.id, {
          status: 'PENDING',
          checkInTime: '',
        });
      }
    }
  };

  const resetData = () => {
    if (!canManageParticipants) return;
    const curEventId = activeWorkshopIdRef.current;
    setParticipants(INITIAL_PARTICIPANTS);
    setConfig(WORKSHOP_CONFIG);
    setCertificateSettings({ ...DEFAULT_CERT_SETTINGS });
    setFeedbacks({});

    if (
      cloudUser &&
      isAdmin &&
      auth.currentUser &&
      auth.currentUser.email?.toLowerCase() === ADMIN_EMAIL
    ) {
      const uid = auth.currentUser.uid;
      void (async () => {
        try {
          const wRef = doc(db, 'workshops', curEventId);
          const snap = await getDoc(wRef);
          await setDoc(wRef, {
            workshopId: curEventId,
            ownerId: uid,
            name: WORKSHOP_CONFIG.name,
            date: WORKSHOP_CONFIG.date,
            startTime: WORKSHOP_CONFIG.startTime,
            location: WORKSHOP_CONFIG.location,
            organizer: WORKSHOP_CONFIG.organizer || 'Muslimah Healing Journey',
            tagline: WORKSHOP_CONFIG.tagline || "Let's Heal",
            eventLabel: WORKSHOP_CONFIG.eventLabel || 'Agenda Workshop Psikologi',
            customLogoUrl: '',
            createdAt: snap.exists() && snap.data().createdAt ? snap.data().createdAt : serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await upsertCertSettingsToFirestore(
            curEventId,
            { ...DEFAULT_CERT_SETTINGS },
            auth.currentUser
          );
          for (const p of INITIAL_PARTICIPANTS) {
            await syncNewParticipantToCloud(p);
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `workshops/${curEventId}`);
        }
      })();
    }
  };

  const loginWithCredentials = async (
    identifier: string,
    password = ''
  ): Promise<{ success: boolean; message: string }> => {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Check Admin (paku.tanam@gmail.com or paku.tanam)
    if (cleanId === ADMIN_EMAIL || cleanId === 'paku.tanam') {
      const session: AuthenticatedUserSession = {
        role: 'admin',
        identifier: ADMIN_EMAIL,
        displayName: 'Admin Utama (paku.tanam@gmail.com)',
        loggedInAt: new Date().toISOString(),
      };
      persistAuthSession(session);
      return {
        success: true,
        message: 'Berhasil masuk sebagai Admin Utama (paku.tanam@gmail.com).',
      };
    }

    // 2. Check Panitia 1 - 3
    const matchedPanitia = PANITIA_ACCOUNTS[cleanId];
    if (matchedPanitia) {
      if (cleanPass !== PANITIA_PASSWORD) {
        return {
          success: false,
          message: 'Kata sandi yang Anda masukkan tidak sesuai. Silakan periksa kembali.',
        };
      }
      if (auth.currentUser) {
        try {
          await signOutFromCloud();
        } catch {
          // Ignore signout error
        }
      }
      const session: AuthenticatedUserSession = {
        role: 'panitia',
        identifier: matchedPanitia.identifier,
        displayName: matchedPanitia.displayName,
        loggedInAt: new Date().toISOString(),
      };
      persistAuthSession(session);
      return {
        success: true,
        message: `Berhasil masuk sebagai ${matchedPanitia.displayName}.`,
      };
    }

    return {
      success: false,
      message:
        'Akses ditolak. Email/username atau kata sandi tidak terdaftar dalam sistem manajemen.',
    };
  };

  const loginWithGoogleAdmin = async (): Promise<{ success: boolean; message: string }> => {
    setIsCloudSyncing(true);
    try {
      const user = await signInWithGoogleCloud();
      const email = user?.email?.toLowerCase() || '';
      if (email !== ADMIN_EMAIL) {
        await signOutFromCloud();
        setIsCloudSyncing(false);
        return {
          success: false,
          message:
            'Akses ditolak. Akun Google yang dipilih tidak memiliki hak akses Administrator pada sistem ini.',
        };
      }
      const session: AuthenticatedUserSession = {
        role: 'admin',
        identifier: ADMIN_EMAIL,
        displayName: user?.displayName || 'Administrator Utama',
        loggedInAt: new Date().toISOString(),
      };
      persistAuthSession(session);
      return {
        success: true,
        message: 'Berhasil masuk sebagai Administrator Utama.',
      };
    } catch (error) {
      setIsCloudSyncing(false);
      console.error('Google Sign-in failed:', error);
      return {
        success: false,
        message: 'Otentikasi Google dibatalkan atau tidak dapat diselesaikan.',
      };
    }
  };

  const logoutApp = async () => {
    persistAuthSession(null);
    setCloudUser(null);
    setIsCloudReady(false);
    setIsCloudSyncing(false);
    setIsCertCloudSynced(false);
    if (auth.currentUser) {
      try {
        await signOutFromCloud();
      } catch (error) {
        console.error('Sign-out failed:', error);
      }
    }
  };

  const connectCloud = async () => {
    const res = await loginWithGoogleAdmin();
    if (!res.success) {
      throw new Error(res.message);
    }
  };

  const disconnectCloud = async () => {
    await signOutFromCloud();
    setCloudUser(null);
    setIsCloudReady(false);
    setIsCloudSyncing(false);
    setIsCertCloudSynced(false);
  };

  return (
    <AppContext.Provider
      value={{
        participants,
        config,
        certificateSettings,
        feedbacks,
        submitParticipantFeedback,
        updateCertificateSettings,
        resetCertificateSettings,
        saveCertificateSettingsToCloudNow,
        copyCertificateSettingsToAllWorkshops,
        isCertCloudSynced,
        isCertCloudSaving,
        lastCertCloudSyncAt,
        eventsList,
        activeWorkshopId,
        switchWorkshop,
        createNewWorkshop,
        deleteWorkshop,
        selectedParticipantId,
        setSelectedParticipantId,
        checkIn,
        registerParticipant,
        importParticipants,
        updateParticipant,
        verifyParticipantPayment,
        deleteParticipant,
        updateConfig,
        resetAttendance,
        resetData,
        cloudUser,
        authSession,
        isAuthenticated,
        isAdmin,
        isPanitia,
        canManageParticipants,
        canVerifyPayment,
        isCloudSyncing,
        loginWithCredentials,
        loginWithGoogleAdmin,
        logoutApp,
        connectCloud,
        disconnectCloud,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
