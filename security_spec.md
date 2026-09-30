# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Authenticated Identity**: All writes require an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`).
3. **Workshop Ownership Invariant**: A `/workshops/{workshopId}` document can only be created, read, updated, or deleted if `workshopId == request.auth.uid` and `ownerId == request.auth.uid`.
4. **Master Gate Relational Invariant**: A `/workshops/{workshopId}/participants/{participantId}` document cannot exist without a parent `/workshops/{workshopId}` document owned by `request.auth.uid`, and must have `workshopId == workshopId`, `ownerId == request.auth.uid`, and `id == participantId`.
5. **PII Isolation & Query Enforcer**: Because `Participant` documents contain PII (`email`, `phone`), `get` and `list` operations strictly verify `resource.data.ownerId == request.auth.uid` and `workshopId == request.auth.uid`. No `get()` or `exists()` calls are placed inside `allow list`.
6. **Temporal & Immutable Integrity**: `createdAt` and `updatedAt` must equal `request.time` on creation; on update, `createdAt`, `ownerId`, `workshopId`, and `id` are immutable and `updatedAt == request.time`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: Creating `/workshops/user1` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: Creating `/workshops/user1` where `auth.token.email_verified == false` -> `PERMISSION_DENIED`.
3. **Identity Spoofing (`ownerId` mismatch)**: User `user1` creating `/workshops/user1` with `ownerId: "user2"` -> `PERMISSION_DENIED`.
4. **Cross-Tenant Path Hijack**: User `user1` creating `/workshops/user2` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection on Create**: Creating `/workshops/user1` with an extra undeclared field `isAdmin: true` -> `PERMISSION_DENIED`.
6. **Shadow / Ghost Field Injection on Update**: Updating `/workshops/user1` with an undeclared field `hacked: "yes"` -> `PERMISSION_DENIED`.
7. **Orphaned Subcollection Write (Master Gate Bypass)**: Creating `/workshops/user1/participants/HY-001` when `/workshops/user1` does not exist -> `PERMISSION_DENIED`.
8. **ID Poisoning Attack**: Creating `/workshops/user1/participants/INVALID$ID!` with non-alphanumeric characters or >128 chars -> `PERMISSION_DENIED`.
9. **Value Poisoning (Oversized String)**: Updating `/workshops/user1/participants/HY-001` with a `name` string of 500 characters (>160 max) -> `PERMISSION_DENIED`.
10. **Invalid Enum State**: Updating `/workshops/user1/participants/HY-001` with `status: "HACKED_STATUS"` -> `PERMISSION_DENIED`.
11. **Immutable Field Mutation**: Updating `/workshops/user1/participants/HY-001` to change `ownerId` or `createdAt` -> `PERMISSION_DENIED`.
12. **Cross-User PII Read / List Scraping**: User `user2` attempting `get` or `list` on `/workshops/user1/participants` -> `PERMISSION_DENIED`.
