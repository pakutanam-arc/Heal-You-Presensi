/**
 * Dirty Dozen Security Specification Test Suite (firestore.rules.test.ts)
 * Verifies all 12 adversarial payloads defined in security_spec.md are rejected with PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Write',
    collectionPath: '/workshops/user1',
    operation: 'create',
    auth: null,
    payload: { ownerId: 'user1', name: 'Workshop' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    collectionPath: '/workshops/user1',
    operation: 'create',
    auth: { uid: 'user1', email_verified: false },
    payload: { ownerId: 'user1', name: 'Workshop' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing (ownerId mismatch)',
    collectionPath: '/workshops/user1',
    operation: 'create',
    auth: { uid: 'user1', email_verified: true },
    payload: { ownerId: 'user2', name: 'Workshop' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Cross-Tenant Path Hijack',
    collectionPath: '/workshops/user2',
    operation: 'create',
    auth: { uid: 'user1', email_verified: true },
    payload: { ownerId: 'user1', name: 'Workshop' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow / Ghost Field Injection on Create',
    collectionPath: '/workshops/user1',
    operation: 'create',
    auth: { uid: 'user1', email_verified: true },
    payload: { ownerId: 'user1', name: 'Workshop', isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow / Ghost Field Injection on Update',
    collectionPath: '/workshops/user1',
    operation: 'update',
    auth: { uid: 'user1', email_verified: true },
    payload: { ownerId: 'user1', name: 'Workshop', hacked: 'yes' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Orphaned Subcollection Write (Master Gate Bypass)',
    collectionPath: '/workshops/user1/participants/HY-001',
    operation: 'create',
    auth: { uid: 'user1', email_verified: true },
    payload: { id: 'HY-001', workshopId: 'user1', ownerId: 'user1', name: 'Test' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID Poisoning Attack',
    collectionPath: '/workshops/user1/participants/INVALID$ID!',
    operation: 'create',
    auth: { uid: 'user1', email_verified: true },
    payload: { id: 'INVALID$ID!', workshopId: 'user1', ownerId: 'user1', name: 'Test' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Value Poisoning (Oversized String > 160 chars)',
    collectionPath: '/workshops/user1/participants/HY-001',
    operation: 'update',
    auth: { uid: 'user1', email_verified: true },
    payload: { name: 'A'.repeat(500) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Invalid Enum State',
    collectionPath: '/workshops/user1/participants/HY-001',
    operation: 'update',
    auth: { uid: 'user1', email_verified: true },
    payload: { status: 'HACKED_STATUS' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Immutable Field Mutation (ownerId / createdAt)',
    collectionPath: '/workshops/user1/participants/HY-001',
    operation: 'update',
    auth: { uid: 'user1', email_verified: true },
    payload: { ownerId: 'user2' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Cross-User PII Read / List Scraping',
    collectionPath: '/workshops/user1/participants',
    operation: 'list',
    auth: { uid: 'user2', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
