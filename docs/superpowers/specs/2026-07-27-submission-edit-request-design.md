# Submission Edit-Request Flow + Admin Dashboard Visibility

## Problem

Once a user submits a project for certification, `Project.status` flips to `IN_REVIEW` and the project is fully locked (enforced by `status !== 'ONGOING'` checks in the project PATCH and checklist-response routes) until an admin approves it. There's no way for the user to make a correction an admin flags during review without the project falling out of the approval queue, and no reject path exists at all (`SubmissionStatus` only has `PENDING`/`APPROVED`). Pending approvals also aren't visible anywhere outside the dedicated `/admin/project-approvals` page.

## Data model

Edit-access state is scoped to the current review cycle, so it lives on `ProjectSubmission`, not `Project`. A future resubmission starts a fresh submission row at `NONE`.

```prisma
enum SubmissionStatus {
  PENDING
  APPROVED
  REJECTED
}

enum EditAccessStatus {
  NONE
  REQUESTED
  GRANTED
}

model ProjectSubmission {
  id                    String            @id @default(uuid())
  projectId             String
  tokenHash             String            @unique
  status                SubmissionStatus  @default(PENDING)
  submittedTo           String
  approvedAt            DateTime?
  rejectedAt            DateTime?
  reviewNote            String?           // admin's reason, set on reject
  editAccessStatus      EditAccessStatus  @default(NONE)
  editAccessRequestedAt DateTime?
  editAccessGrantedAt   DateTime?
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt
  project               Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, status])
}
```

## Lock/unlock semantics

- `Project.status === ONGOING` → always editable (unchanged).
- `Project.status === IN_REVIEW` → editable only if the current `PENDING` submission has `editAccessStatus === GRANTED`. Otherwise locked as today.
- `Project.status === COMPLETED` → never editable (unchanged).
- **Approve** (unchanged): submission → `APPROVED`, project → `COMPLETED`.
- **Reject** (new): submission → `REJECTED` + `rejectedAt` + `reviewNote`, project → `ONGOING` (fully unlocked; user can edit freely and resubmit later).
- **Grant edit access** (new): submission `editAccessStatus` → `GRANTED`, `editAccessGrantedAt` = now. Project **stays** `IN_REVIEW` — it never leaves the approval queue.
- No separate "deny edit request" action exists. If an admin doesn't want to grant edit access, they can simply not act, or reject the whole submission (which unlocks fully anyway). Keeps the action surface minimal.
- No email notifications are sent for any of these transitions, consistent with the existing approve flow (email delivery is a separate known issue, tracked outside this feature).

## API changes

- **`src/app/api/projects/[id]/submit/request-edit/route.ts`** (new) — `POST`, called by the project owner/editor. Requires `project.status === 'IN_REVIEW'` and the active `PENDING` submission's `editAccessStatus === 'NONE'`. Sets `editAccessStatus = REQUESTED`, `editAccessRequestedAt = now`. No-op (200) if already `REQUESTED`/`GRANTED`. 404/403 follow the same ownership/permission checks as the existing submit route.

- **`src/app/api/admin/project-approvals/route.ts`**:
  - `GET` — accepts `?status=pending|approved|rejected`. Normalized payload gains `editAccessStatus`, `editAccessRequestedAt`, `reviewNote`.
  - `POST` — body becomes `{ submissionId, action: 'approve' | 'reject' | 'grantEdit', note?: string }`:
    - `approve` — unchanged behavior, requires submission `status === PENDING`.
    - `reject` — requires `status === PENDING`; sets `REJECTED`, `rejectedAt`, `reviewNote = note ?? null`; project → `ONGOING`.
    - `grantEdit` — requires `status === PENDING && editAccessStatus === REQUESTED`; sets `editAccessStatus = GRANTED`, `editAccessGrantedAt = now`.

- **`src/app/api/projects/[id]/route.ts`** (GET) — include the current `PENDING` submission's `editAccessStatus`/`editAccessRequestedAt`, and if the project is `ONGOING` and its most recent submission is `REJECTED`, include that submission's `reviewNote` so the user can see why it was returned.

- Existing lock checks (`src/app/api/projects/[id]/route.ts:173`, `src/app/api/projects/[id]/responses/batch/route.ts:73`) change from `status !== 'ONGOING'` to also allow `status === 'IN_REVIEW' && <active submission>.editAccessStatus === 'GRANTED'`.

## UI changes

### `src/components/ProjectOverview.tsx`

`isReadOnly` currently only reflects team role/status, not review lock — the Edit buttons show even when `IN_REVIEW` and a save would 409. This changes:

- `status === IN_REVIEW && editAccessStatus !== GRANTED` → treat as locked: hide Edit Project Details / Edit Solutions actions.
  - `editAccessStatus === NONE`: banner "This project is under review and locked for edits." + **Request Edit Access** button (calls the new request-edit route).
  - `editAccessStatus === REQUESTED`: banner "Edit access requested — waiting on admin approval." (button becomes a disabled/pending indicator).
- `status === IN_REVIEW && editAccessStatus === GRANTED`: editing UI behaves like `ONGOING` (Edit buttons active), Submit button stays disabled/labeled "Submitted" as today. Banner: "Edit access granted — changes you make are visible to the reviewing admin."
- `status === ONGOING` and latest submission is `REJECTED`: dismissible banner showing `reviewNote` ("Your last submission was returned: ..."). Normal full-edit rules apply otherwise.

### `src/components/AdminProjectApprovalsClient.tsx`

- Third tab: Pending / Rejected / Approved.
- Pending rows show an "Edit access requested" badge when `editAccessStatus === REQUESTED`, with a **Grant Edit Access** button alongside **Approve**.
- **Reject** button opens an inline optional note field, calls `action: 'reject'`.

### `src/app/(dashboard)/page.tsx` (My Projects / home)

- Admin-only (`session.user.role === 'ADMIN'`): fetch pending count via `/api/admin/project-approvals?status=pending`, render a slim banner at the top ("N projects awaiting approval" → links to `/admin/project-approvals`). Not rendered for non-admins or when count is 0.

## Out of scope

- Email notifications for request/grant/reject.
- A dedicated admin dashboard home page (deferred; banner lives on My Projects instead, per explicit decision).
- A distinct "deny edit request" action separate from full reject.
- Auto-revoking edit access after a single edit session (grant lasts until admin acts).
