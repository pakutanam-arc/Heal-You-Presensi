# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Every path not explicitly matched in `/databases/{database}/documents` is unconditionally denied (`allow read, write: if false;`).
2. **Tiered Role-Based Access Control (RBAC)**:
   - **Tier 1 (Admin: `paku.tanam@gmail.com` with `email_verified == true`)**: Full access to create, update, and delete workshop configuration (`/workshops/main`) and participants (`/workshops/main/participants/{participantId}`).
   - **Tier 2 (Panitia / Staff: Any other signed-in user with `email_verified == true`)**: Can read the shared workshop (`/workshops/main`) and participants list, and can **ONLY** update attendance status fields (`status`, `checkInTime`, `updatedAt`) on existing participants. Non-admin staff cannot create participants (cannot Buat QR), cannot edit participant profile details, cannot delete participants, and cannot modify workshop settings.
3. **Strict Schema & Size Bounds (`isValidWorkshop`, `isValidParticipant`)**: Every string field is strictly bounded by `.size() >= min && .size() <= max` and `keys().hasAll(...) && keys().hasOnly(...)` to block shadow fields and resource-exhaustion payloads.
4. **Temporal & Identity Immutability**: `createdAt` and `updatedAt` must match server time (`request.time`), and `workshopId` / `id` are immutable on update.
5. **Secure List Queries**: `allow list` on `/workshops/{workshopId}/participants` enforces `workshopId == 'main' && existing().workshopId == 'main'` without `get()`/`exists()` inside `list`.
