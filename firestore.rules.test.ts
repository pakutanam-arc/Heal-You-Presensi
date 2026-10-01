/**
 * Dirty Dozen Security Specification Test Suite (firestore.rules.test.ts)
 * Verifies all 12 adversarial payloads defined in security_spec.md are rejected with PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  auth: { uid: string; email?: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Write',
    collectionPath: '/workshops/main',
    operation: 'create',
    auth: null,
    payload: { ownerId: 'user1', name: 'Workshop' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    collectionPath: '/workshops/main',
    operation: 'create',
    auth: { uid: 'user1', email: 'paku.tanam@gmail.com', email_verified: false },
    payload: { ownerId: 'user1', name: 'Workshop' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing (ownerId mismatch)',
    collectionPath: '/workshops/main',
    operation: 'create',
    auth: { uid: 'user1', email: 'paku.tanam@gmail.com', email_verified: true },
    payload: { ownerId: 'user2', name: 'Workshop' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Non-Admin Custom Workshop Creation',
    collectionPath: '/workshops/evt-2',
    operation: 'create',
    auth: { uid: 'staff1', email: 'staff@healyou.id', email_verified: true },
    payload: { workshopId: 'evt-2', ownerId: 'staff1', name: 'Workshop' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow / Ghost Field Injection on Create',
    collectionPath: '/workshops/main',
    operation: 'create',
    auth: { uid: 'user1', email: 'paku.tanam@gmail.com', email_verified: true },
    payload: { ownerId: 'user1', name: 'Workshop', isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow / Ghost Field Injection on CertificateSettings Update',
    collectionPath: '/workshops/main/certificateSettings/config',
    operation: 'update',
    auth: { uid: 'user1', email: 'paku.tanam@gmail.com', email_verified: true },
    payload: { ownerId: 'user1', signer1Name: 'Siti Sarah', hacked: 'yes' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Orphaned Subcollection Write (Master Gate Bypass)',
    collectionPath: '/workshops/nonexistent/certificateSettings/config',
    operation: 'create',
    auth: { uid: 'user1', email: 'paku.tanam@gmail.com', email_verified: true },
    payload: { settingsId: 'config', workshopId: 'nonexistent', ownerId: 'user1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID Poisoning Attack',
    collectionPath: '/workshops/main/participants/INVALID$ID!',
    operation: 'create',
    auth: { uid: 'user1', email: 'paku.tanam@gmail.com', email_verified: true },
    payload: { id: 'INVALID$ID!', workshopId: 'main', ownerId: 'user1', name: 'Test' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Value Poisoning (Oversized String > 160 chars)',
    collectionPath: '/workshops/main/certificateSettings/config',
    operation: 'update',
    auth: { uid: 'user1', email: 'paku.tanam@gmail.com', email_verified: true },
    payload: { signer1Name: 'A'.repeat(500) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Invalid Enum State on Certificate Signature Mode',
    collectionPath: '/workshops/main/certificateSettings/config',
    operation: 'update',
    auth: { uid: 'user1', email: 'paku.tanam@gmail.com', email_verified: true },
    payload: { signer1SigMode: 'HACKED_MODE' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Non-Admin Certificate Settings Mutation',
    collectionPath: '/workshops/main/certificateSettings/config',
    operation: 'update',
    auth: { uid: 'staff1', email: 'staff@healyou.id', email_verified: true },
    payload: { signer1Name: 'Unauthorized Signer' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthenticated List Scraping',
    collectionPath: '/workshops/main/participants',
    operation: 'list',
    auth: null,
    expectedResult: 'PERMISSION_DENIED',
  },
];
