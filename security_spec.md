# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Every path not explicitly matched in `/databases/{database}/documents` is unconditionally denied (`allow read, write: if false;`).
2. **Tiered Role-Based Access Control (RBAC)**:
   - **Tier 1 (Admin: `paku.tanam@gmail.com` with `email_verified == true`)**: Full access to create, update, and delete workshop configuration (`/workshops/{workshopId}`), participants (`/workshops/{workshopId}/participants/{participantId}`), and per-event E-Certificate settings (`/workshops/{workshopId}/certificateSettings/{settingsId}`).
   - **Tier 2 (Panitia / Staff: Any other signed-in user with `email_verified == true`)**: Can read the shared workshop (`/workshops/{workshopId}`), participants list, and E-Certificate settings (`/workshops/{workshopId}/certificateSettings/{settingsId}`), and can **ONLY** update attendance status fields (`status`, `checkInTime`, `updatedAt`) on existing participants. Non-admin staff cannot create participants, cannot edit participant profile details, cannot delete participants, and cannot modify workshop or E-Certificate settings.
3. **Strict Schema & Size Bounds (`isValidWorkshop`, `isValidParticipant`, `isValidCertificateSettings`)**: Every string field is strictly bounded by `.size() >= min && .size() <= max` and `keys().hasAll(...) && keys().hasOnly(...)` to block shadow fields and resource-exhaustion payloads.
4. **Temporal & Identity Immutability**: `createdAt` and `updatedAt` must match server time (`request.time`), and `workshopId` / `id` / `settingsId` are immutable on update.
5. **Secure List Queries**: `allow list` on `/workshops/{workshopId}/participants` enforces `existing().workshopId == workshopId` without `get()`/`exists()` inside `list`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth: null` attempting `create` on `/workshops/main`.
2. **Unverified Email Write**: `email_verified: false` attempting `create` on `/workshops/main`.
3. **Identity Spoofing (`ownerId` mismatch)**: `incoming().ownerId != request.auth.uid` on `/workshops/main`.
4. **Cross-Tenant / Non-Admin Workshop Creation**: Non-admin user attempting to create `/workshops/evt-custom`.
5. **Shadow / Ghost Field Injection on Create**: Extra key `isAdmin: true` on `/workshops/main`.
6. **Shadow / Ghost Field Injection on Update**: Extra key `hacked: 'yes'` on `/workshops/main/certificateSettings/config`.
7. **Orphaned Subcollection Write (Master Gate Bypass)**: Writing `/workshops/nonexistent/certificateSettings/config` when parent workshop does not exist.
8. **ID Poisoning Attack**: Invalid characters in document ID `/workshops/main/participants/INVALID$ID!`.
9. **Value Poisoning (Oversized String)**: `signer1Name` > 160 chars on `/workshops/main/certificateSettings/config`.
10. **Invalid Enum State**: `signer1SigMode: 'HACKED_MODE'` on `/workshops/main/certificateSettings/config`.
11. **Non-Admin Certificate Settings Mutation**: Verified non-admin staff attempting `update` on `/workshops/main/certificateSettings/config`.
12. **Cross-Workshop List Scraping**: Querying `/workshops/main/participants` without `where('workshopId', '==', 'main')`.
