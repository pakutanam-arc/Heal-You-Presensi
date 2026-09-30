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

interface AppState {
  participants: Participant[];
  config: WorkshopConfig;
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
  resetData: () => void;
  cloudUser: User | null;
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

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [participants, setParticipants] = useState<Participant[]>(() => {
    const saved = localStorage.getItem('workshop_participants');
    if (saved) {
      try {
        const parsed: Participant[] = JSON.parse(saved);
        return parsed.map((p) => ({ ...p, id: migrateId(p.id) }));
      } catch {
        return INITIAL_PARTICIPANTS;
      }
    }
    return INITIAL_PARTICIPANTS;
  });

  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(() => {
    const saved = localStorage.getItem('workshop_participants');
    if (saved) {
      try {
        const list: Participant[] = JSON.parse(saved);
        return list[0]?.id ? migrateId(list[0].id) : 'HY-001';
      } catch {
        return 'HY-001';
      }
    }
    return INITIAL_PARTICIPANTS[0]?.id || 'HY-001';
  });

  const [config, setConfig] = useState<WorkshopConfig>(() => {
    const saved = localStorage.getItem('workshop_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.organizer || parsed.organizer === 'Heal You Psychology Center') {
          parsed.organizer = 'Muslimah Healing Journey';
        }
        return { ...WORKSHOP_CONFIG, ...parsed };
      } catch {
        return WORKSHOP_CONFIG;
      }
    }
    return WORKSHOP_CONFIG;
  });

  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);

  const participantsRef = useRef(participants);
  const configRef = useRef(config);

  useEffect(() => {
    participantsRef.current = participants;
    localStorage.setItem('workshop_participants', JSON.stringify(participants));
  }, [participants]);

  useEffect(() => {
    configRef.current = config;
    localStorage.setItem('workshop_config', JSON.stringify(config));
  }, [config]);

  // Listen to Firebase Auth & attach real-time Firestore listeners when authenticated
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCloudUser(user);
      if (!user) {
        setIsCloudSyncing(false);
        return;
      }

      setIsCloudSyncing(true);
      const uid = user.uid;
      const workshopDocRef = doc(db, 'workshops', uid);

      // Seed initial workshop & participants if this user has no workshop document in Firestore yet
      try {
        const snap = await getDoc(workshopDocRef);
        if (!snap.exists()) {
          const curCfg = configRef.current;
          await setDoc(workshopDocRef, {
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

          const batch = writeBatch(db);
          for (const p of participantsRef.current) {
            const safeId = migrateId(p.id);
            const pRef = doc(db, 'workshops', uid, 'participants', safeId);
            batch.set(pRef, {
              id: safeId,
              workshopId: uid,
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
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `workshops/${uid}`);
      }
    });

    return () => unsubAuth();
  }, []);

  // Real-time onSnapshot listeners when cloudUser is active
  useEffect(() => {
    if (!cloudUser) return;
    const uid = cloudUser.uid;
    const workshopPath = `workshops/${uid}`;
    const participantsPath = `workshops/${uid}/participants`;

    const unsubWorkshop = onSnapshot(
      doc(db, 'workshops', uid),
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
      collection(db, 'workshops', uid, 'participants'),
      where('ownerId', '==', uid)
    );

    const unsubParticipants = onSnapshot(
      qParticipants,
      (querySnap) => {
        if (!querySnap.empty) {
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
  }, [cloudUser]);

  const syncParticipantUpdateToCloud = async (id: string, updates: Record<string, unknown>) => {
    if (!cloudUser) return;
    const uid = cloudUser.uid;
    const safeId = migrateId(id);
    const pPath = `workshops/${uid}/participants/${safeId}`;
    try {
      await updateDoc(doc(db, 'workshops', uid, 'participants', safeId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, pPath);
    }
  };

  const syncNewParticipantToCloud = async (p: Participant) => {
    if (!cloudUser) return;
    const uid = cloudUser.uid;
    const safeId = migrateId(p.id);
    const pPath = `workshops/${uid}/participants/${safeId}`;
    try {
      await setDoc(doc(db, 'workshops', uid, 'participants', safeId), {
        id: safeId,
        workshopId: uid,
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

    const merged: Participant = { ...current, ...updates };
    setParticipants((prev) => prev.map((p) => (p.id === id ? merged : p)));

    if (cloudUser) {
      if (updates.id && updates.id !== id) {
        // ID changed: delete old doc and create new doc
        const uid = cloudUser.uid;
        void deleteDoc(doc(db, 'workshops', uid, 'participants', migrateId(id))).catch((e) =>
          handleFirestoreError(e, OperationType.DELETE, `workshops/${uid}/participants/${id}`)
        );
        void syncNewParticipantToCloud(merged);
      } else {
        void syncParticipantUpdateToCloud(id, {
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
  };

  const deleteParticipant = (id: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    if (cloudUser) {
      const uid = cloudUser.uid;
      const safeId = migrateId(id);
      void deleteDoc(doc(db, 'workshops', uid, 'participants', safeId)).catch((e) =>
        handleFirestoreError(e, OperationType.DELETE, `workshops/${uid}/participants/${safeId}`)
      );
    }
  };

  const updateConfig = (updates: Partial<WorkshopConfig>) => {
    const merged: WorkshopConfig = { ...config, ...updates };
    setConfig(merged);

    if (cloudUser) {
      const uid = cloudUser.uid;
      const wPath = `workshops/${uid}`;
      void updateDoc(doc(db, 'workshops', uid), {
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

  const resetData = () => {
    setParticipants(INITIAL_PARTICIPANTS);
    setConfig(WORKSHOP_CONFIG);
    localStorage.removeItem('workshop_participants');
    localStorage.removeItem('workshop_config');

    if (cloudUser) {
      const uid = cloudUser.uid;
      void (async () => {
        try {
          await updateDoc(doc(db, 'workshops', uid), {
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
          handleFirestoreError(e, OperationType.WRITE, `workshops/${uid}`);
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
        selectedParticipantId,
        setSelectedParticipantId,
        checkIn,
        registerParticipant,
        importParticipants,
        updateParticipant,
        deleteParticipant,
        updateConfig,
        resetData,
        cloudUser,
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
