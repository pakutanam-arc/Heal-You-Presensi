import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Participant, WorkshopConfig } from './types';
import { INITIAL_PARTICIPANTS, WORKSHOP_CONFIG } from './data';
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
const DEFAULT_WORKSHOP_ID = 'main';

export interface WorkshopEventItem {
  workshopId: string;
  config: WorkshopConfig;
  participantCount?: number;
}

interface LocalSessionRecord {
  workshopId: string;
  config: WorkshopConfig;
  participants: Participant[];
}

interface AppState {
  participants: Participant[];
  config: WorkshopConfig;
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
  registerParticipant: (data: {
    id?: string;
    name: string;
    email: string;
    institution: string;
    role?: string;
    phone?: string;
  }) => Participant;
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
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  deleteParticipant: (id: string) => void;
  updateConfig: (updates: Partial<WorkshopConfig>) => void;
  resetAttendance: () => void;
  resetData: () => void;
  cloudUser: User | null;
  isAdmin: boolean;
  canManageParticipants: boolean;
  isCloudSyncing: boolean;
  connectCloud: () => Promise<void>;
  disconnectCloud: () => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

const migrateId = (id: string) =>
  id
    .replace(/^PSY-/i, 'HY-')
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .slice(0, 64) || 'HY-001';

const clampStr = (val: string | undefined, max: number, fallback = ''): string => {
  const clean = (val ?? '').trim();
  if (!clean) return fallback;
  return clean.slice(0, max);
};

function loadInitialSessions(): Record<string, LocalSessionRecord> {
  const savedSessions = localStorage.getItem('workshop_sessions_v1');
  if (savedSessions) {
    try {
      const parsed = JSON.parse(savedSessions) as Record<string, LocalSessionRecord>;
      if (parsed && Object.keys(parsed).length > 0) {
        return parsed;
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
      initialParticipants = parsed.map((p) => ({ ...p, id: migrateId(p.id) }));
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

  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(() => {
    return participants[0]?.id || 'HY-001';
  });

  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [isCloudReady, setIsCloudReady] = useState<boolean>(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);

  const isAdmin = Boolean(
    cloudUser && cloudUser.email && cloudUser.email.toLowerCase() === ADMIN_EMAIL
  );
  const canManageParticipants = !cloudUser || isAdmin;

  const participantsRef = useRef(participants);
  const configRef = useRef(config);
  const activeWorkshopIdRef = useRef(activeWorkshopId);

  useEffect(() => {
    activeWorkshopIdRef.current = activeWorkshopId;
    localStorage.setItem('active_workshop_id', activeWorkshopId);
  }, [activeWorkshopId]);

  useEffect(() => {
    participantsRef.current = participants;
    localStorage.setItem('workshop_participants', JSON.stringify(participants));
    setLocalSessions((prev) => {
      const curId = activeWorkshopIdRef.current;
      const updated = {
        ...prev,
        [curId]: {
          workshopId: curId,
          config: configRef.current,
          participants,
        },
      };
      localStorage.setItem('workshop_sessions_v1', JSON.stringify(updated));
      return updated;
    });
  }, [participants]);

  useEffect(() => {
    configRef.current = config;
    localStorage.setItem('workshop_config', JSON.stringify(config));
    setLocalSessions((prev) => {
      const curId = activeWorkshopIdRef.current;
      const updated = {
        ...prev,
        [curId]: {
          workshopId: curId,
          config,
          participants: participantsRef.current,
        },
      };
      localStorage.setItem('workshop_sessions_v1', JSON.stringify(updated));
      return updated;
    });
  }, [config]);

  // Listen to Firebase Auth & initialize default 'main' workshop document if needed
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCloudUser(user);
      if (!user) {
        setIsCloudReady(false);
        setIsCloudSyncing(false);
        return;
      }

      setIsCloudSyncing(true);
      const uid = user.uid;
      const curEventId = activeWorkshopIdRef.current || DEFAULT_WORKSHOP_ID;
      const workshopDocRef = doc(db, 'workshops', curEventId);

      try {
        const snap = await getDoc(workshopDocRef);
        if (!snap.exists()) {
          const curCfg = configRef.current;
          const batch = writeBatch(db);
          batch.set(workshopDocRef, {
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

          for (const p of participantsRef.current) {
            const safeId = migrateId(p.id);
            const pRef = doc(db, 'workshops', curEventId, 'participants', safeId);
            batch.set(pRef, {
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
          await batch.commit();
        } else if (
          !snap.data().workshopId &&
          user.email?.toLowerCase() === ADMIN_EMAIL
        ) {
          const d = snap.data();
          await updateDoc(workshopDocRef, {
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
            updatedAt: serverTimestamp(),
          });
        }
        setIsCloudReady(true);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `workshops/${curEventId}`);
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

    const qParticipants = query(
      collection(db, 'workshops', currentEventId, 'participants'),
      where('workshopId', '==', currentEventId)
    );

    const unsubParticipants = onSnapshot(
      qParticipants,
      (querySnap) => {
        const list: Participant[] = querySnap.docs.map((d) => {
          const item = d.data();
          return {
            id: item.id,
            name: item.name,
            email: item.email,
            institution: item.institution,
            role: item.role || 'Peserta Workshop',
            phone: item.phone || '',
            status: item.status,
            checkInTime: item.checkInTime ? item.checkInTime : undefined,
          };
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

    return () => {
      unsubWorkshop();
      unsubParticipants();
    };
  }, [cloudUser, isCloudReady, activeWorkshopId]);

  const eventsList: WorkshopEventItem[] = (Object.values(localSessions) as LocalSessionRecord[])
    .map((s) => ({
      workshopId: s.workshopId,
      config: s.config,
      participantCount: s.participants.length,
    }))
    .sort((a, b) => b.config.date.localeCompare(a.config.date));

  const switchWorkshop = (workshopId: string) => {
    if (workshopId === activeWorkshopId) return;
    setActiveWorkshopId(workshopId);

    if (!cloudUser) {
      const target = localSessions[workshopId];
      if (target) {
        setConfig(target.config);
        setParticipants(target.participants);
        if (target.participants[0]?.id) {
          setSelectedParticipantId(target.participants[0].id);
        }
      }
    }
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

    const initialNewParticipants: Participant[] = params.copyParticipants
      ? participants.map((p) => ({
          ...p,
          status: 'PENDING',
          checkInTime: undefined,
        }))
      : [];

    // Save locally
    setLocalSessions((prev) => {
      const updated = {
        ...prev,
        [newWorkshopId]: {
          workshopId: newWorkshopId,
          config: newConfig,
          participants: initialNewParticipants,
        },
      };
      localStorage.setItem('workshop_sessions_v1', JSON.stringify(updated));
      return updated;
    });

    // Save to Cloud if Admin is logged in
    if (cloudUser && isAdmin) {
      const uid = cloudUser.uid;
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

    setActiveWorkshopId(newWorkshopId);
    setConfig(newConfig);
    setParticipants(initialNewParticipants);
    if (initialNewParticipants[0]?.id) {
      setSelectedParticipantId(initialNewParticipants[0].id);
    }

    return newWorkshopId;
  };

  const deleteWorkshop = async (workshopIdToDelete: string) => {
    if (!canManageParticipants) return;
    if (eventsList.length <= 1) return; // Keep at least 1 workshop event

    const remainingEvents = eventsList.filter((e) => e.workshopId !== workshopIdToDelete);
    const nextActiveId =
      workshopIdToDelete === activeWorkshopId
        ? remainingEvents[0]?.workshopId || DEFAULT_WORKSHOP_ID
        : activeWorkshopId;

    setLocalSessions((prev) => {
      const copy = { ...prev };
      delete copy[workshopIdToDelete];
      localStorage.setItem('workshop_sessions_v1', JSON.stringify(copy));
      return copy;
    });

    if (cloudUser && isAdmin) {
      try {
        const pQuery = query(
          collection(db, 'workshops', workshopIdToDelete, 'participants'),
          where('workshopId', '==', workshopIdToDelete)
        );
        const pSnap = await getDocs(pQuery);
        const batch = writeBatch(db);
        pSnap.docs.forEach((d) => batch.delete(d.ref));
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
    if (!cloudUser) return;
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

  const syncNewParticipantToCloud = async (p: Participant) => {
    if (!cloudUser || !isAdmin) return;
    const uid = cloudUser.uid;
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
    const normalizedId = migrateId(id.trim());
    const participantIndex = participants.findIndex(
      (p) =>
        p.id.toUpperCase() === normalizedId.toUpperCase() ||
        p.id.toUpperCase() === id.trim().toUpperCase()
    );

    if (participantIndex === -1) {
      return { success: false, message: 'Peserta tidak ditemukan atau kode QR tidak valid.' };
    }

    const participant = participants[participantIndex];

    if (participant.status !== 'PENDING') {
      return {
        success: false,
        message: `${participant.name} sudah melakukan check-in sebelumnya.`,
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

  const registerParticipant = (data: {
    id?: string;
    name: string;
    email: string;
    institution: string;
    role?: string;
    phone?: string;
  }): Participant => {
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

    const newParticipant: Participant = {
      id: newId,
      name: clampStr(data.name, 160, 'Peserta'),
      email: clampStr(data.email, 160, '-'),
      institution: clampStr(data.institution, 160, '-'),
      role: clampStr(data.role, 100, 'Peserta Workshop'),
      phone: (data.phone ?? '').trim().slice(0, 60),
      status: 'PENDING',
    };

    if (!canManageParticipants) {
      return newParticipant;
    }

    setParticipants((prev) => [newParticipant, ...prev]);
    void syncNewParticipantToCloud(newParticipant);
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
      setParticipants((prev) => [...created, ...prev]);
      for (const p of created) {
        void syncNewParticipantToCloud(p);
      }
    }

    return created.length;
  };

  const updateParticipant = (id: string, updates: Partial<Participant>) => {
    const current = participants.find((p) => p.id === id);
    if (!current) return;

    const isStatusOnlyUpdate = Object.keys(updates).every(
      (k) => k === 'status' || k === 'checkInTime'
    );

    if (!canManageParticipants && !isStatusOnlyUpdate) {
      return;
    }

    const merged: Participant = { ...current, ...updates };
    setParticipants((prev) => prev.map((p) => (p.id === id ? merged : p)));

    if (cloudUser) {
      const curEventId = activeWorkshopIdRef.current;
      if (isStatusOnlyUpdate) {
        void syncParticipantUpdateToCloud(id, {
          status: merged.status,
          checkInTime: (merged.checkInTime ?? '').slice(0, 64),
        });
      } else if (isAdmin) {
        if (updates.id && updates.id !== id) {
          void deleteDoc(
            doc(db, 'workshops', curEventId, 'participants', migrateId(id))
          ).catch((e) =>
            handleFirestoreError(
              e,
              OperationType.DELETE,
              `workshops/${curEventId}/participants/${id}`
            )
          );
          void syncNewParticipantToCloud(merged);
        } else {
          void syncParticipantUpdateToCloud(id, {
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

    if (cloudUser && isAdmin) {
      const curEventId = activeWorkshopIdRef.current;
      const wPath = `workshops/${curEventId}`;
      void updateDoc(doc(db, 'workshops', curEventId), {
        ownerId: cloudUser.uid,
        name: clampStr(merged.name, 200, WORKSHOP_CONFIG.name),
        date: clampStr(merged.date, 40, WORKSHOP_CONFIG.date),
        startTime: clampStr(merged.startTime, 64, WORKSHOP_CONFIG.startTime),
        location: clampStr(merged.location, 200, WORKSHOP_CONFIG.location),
        organizer: clampStr(merged.organizer, 120, 'Muslimah Healing Journey'),
        tagline: clampStr(merged.tagline, 120, "Let's Heal"),
        eventLabel: clampStr(merged.eventLabel, 120, 'Agenda Workshop Psikologi'),
        customLogoUrl: (merged.customLogoUrl ?? '').slice(0, 350000),
        updatedAt: serverTimestamp(),
      }).catch((e) => handleFirestoreError(e, OperationType.UPDATE, wPath));
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

    if (cloudUser && isAdmin) {
      void (async () => {
        try {
          await updateDoc(doc(db, 'workshops', curEventId), {
            ownerId: cloudUser.uid,
            name: WORKSHOP_CONFIG.name,
            date: WORKSHOP_CONFIG.date,
            startTime: WORKSHOP_CONFIG.startTime,
            location: WORKSHOP_CONFIG.location,
            organizer: WORKSHOP_CONFIG.organizer || 'Muslimah Healing Journey',
            tagline: WORKSHOP_CONFIG.tagline || "Let's Heal",
            eventLabel: WORKSHOP_CONFIG.eventLabel || 'Agenda Workshop Psikologi',
            customLogoUrl: '',
            updatedAt: serverTimestamp(),
          });
          for (const p of INITIAL_PARTICIPANTS) {
            await syncNewParticipantToCloud(p);
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `workshops/${curEventId}`);
        }
      })();
    }
  };

  const connectCloud = async () => {
    await signInWithGoogleCloud();
  };

  const disconnectCloud = async () => {
    await signOutFromCloud();
  };

  return (
    <AppContext.Provider
      value={{
        participants,
        config,
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
        deleteParticipant,
        updateConfig,
        resetAttendance,
        resetData,
        cloudUser,
        isAdmin,
        canManageParticipants,
        isCloudSyncing,
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
