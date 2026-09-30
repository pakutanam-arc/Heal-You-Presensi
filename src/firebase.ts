import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  initializeFirestore,
  setLogLevel,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Suppress internal @firebase/firestore noisy network timeout console.error logs in iframe/offline environments
setLogLevel('silent');

const app = initializeApp(firebaseConfig);

// Use experimentalAutoDetectLongPolling so Firestore works reliably behind proxies & preview iframes
export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is currently operating in offline/local mode.');
    }
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const msg = error instanceof Error ? error.message : String(error);

  // Gracefully ignore transient offline/network timeout errors so local mode continues working seamlessly
  if (
    msg.includes('the client is offline') ||
    msg.includes('Could not reach Cloud Firestore backend') ||
    msg.includes('unavailable')
  ) {
    console.warn(`Firestore offline fallback (${operationType} on ${path}):`, msg);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: msg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function signInWithGoogleCloud() {
  const res = await signInWithPopup(auth, googleProvider);
  void testConnection();
  return res;
}

export async function signOutFromCloud() {
  return signOut(auth);
}
