# Submission Edit-Request Flow + Admin Approvals Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user request (and an admin grant) edit access on an `IN_REVIEW` project without it leaving the approval queue, add a minimal reject path for `ProjectSubmission`, and surface pending approvals on the admin's My Projects page.

**Architecture:** Edit-access state and reject state live on `ProjectSubmission` (scoped to the current review cycle). A shared helper (`isProjectEditable`) centralizes the lock/unlock rule so the two existing lock checks and any future ones stay consistent. Admin actions (approve/reject/grantEdit) go through one `POST` endpoint with an `action` discriminator, matching the existing single-endpoint shape.

**Tech Stack:** Next.js App Router route handlers, Prisma/Postgres, React client components (existing patterns: `useSession` from `next-auth/react`, Tailwind, `lucide-react` icons).

## Global Constraints

- This project has no automated test framework (no jest/vitest in `package.json`, no `*.test.ts` files). "Test" steps below mean: `npx tsc --noEmit` for type-check, `npm run lint`, and a manual dev-server/`curl` check — this matches how the rest of the codebase is verified.
- Follow the project's established git workflow: all work happens on `dev`, gets pushed, and is verified on the Vercel Preview deploy before merging to `main`. **Do not merge to `main`** as part of this plan — the final task stops at "pushed to dev, ready for preview verification."
- Match existing code style: no comments unless explaining non-obvious *why*, `(session.user as any).role`/`.id` casts (existing pattern, don't "fix" it), Tailwind utility classes matching surrounding markup, `lucide-react` for icons.
- Reference spec: `docs/superpowers/specs/2026-07-27-submission-edit-request-design.md`

---

### Task 1: Prisma schema — REJECTED status + edit-access fields

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `SubmissionStatus` enum gains `REJECTED`. New `EditAccessStatus` enum (`NONE`, `REQUESTED`, `GRANTED`). `ProjectSubmission` gains `rejectedAt: DateTime?`, `reviewNote: String?`, `editAccessStatus: EditAccessStatus @default(NONE)`, `editAccessRequestedAt: DateTime?`, `editAccessGrantedAt: DateTime?`.

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, find the `ProjectSubmission` model and `SubmissionStatus` enum (near the bottom of the file, right before `enum SystemRole`):

```prisma
model ProjectSubmission {
  id          String           @id @default(uuid())
  projectId   String
  tokenHash   String           @unique
  status      SubmissionStatus @default(PENDING)
  submittedTo String
  approvedAt  DateTime?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  project     Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, status])
}
```

Replace it with:

```prisma
model ProjectSubmission {
  id                    String            @id @default(uuid())
  projectId             String
  tokenHash             String            @unique
  status                SubmissionStatus  @default(PENDING)
  submittedTo           String
  approvedAt            DateTime?
  rejectedAt            DateTime?
  reviewNote            String?
  editAccessStatus      EditAccessStatus  @default(NONE)
  editAccessRequestedAt DateTime?
  editAccessGrantedAt   DateTime?
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt
  project               Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, status])
}
```

Find:

```prisma
enum SubmissionStatus {
  PENDING
  APPROVED
}
```

Replace with:

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
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_submission_edit_request_flow`

Expected: prisma creates `prisma/migrations/<timestamp>_add_submission_edit_request_flow/migration.sql`, applies it to the dev database, and regenerates the client. Output ends with `Your database is now in sync with your schema.` and `✔ Generated Prisma Client`.

- [ ] **Step 3: Verify the generated client has the new fields**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`

Expected: no errors referencing `ProjectSubmission` or `EditAccessStatus` (there will be no consumers yet, so this should simply pass or show unrelated pre-existing errors only).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "$(cat <<'EOF'
Add REJECTED status and edit-access fields to ProjectSubmission

Lays the data-model groundwork for the edit-request flow: a submission
can now be rejected (with a reviewer note) and can track whether the
project owner requested/was granted edit access mid-review.
EOF
)"
```

---

### Task 2: Shared project-editability helper

**Files:**
- Create: `src/lib/projectEditability.ts`

**Interfaces:**
- Produces: `isProjectEditable(status: string, pendingEditAccessStatus: string | null | undefined): boolean`

- [ ] **Step 1: Write the helper**

```typescript
export function isProjectEditable(
  status: string,
  pendingEditAccessStatus?: string | null
): boolean {
  if (status === 'ONGOING') return true;
  if (status === 'IN_REVIEW') return pendingEditAccessStatus === 'GRANTED';
  return false;
}
```

- [ ] **Step 2: Verify with a scratch check**

Run:
```bash
node -e "
const { isProjectEditable } = require('./src/lib/projectEditability.ts');
" 2>&1 | head -5
```
This will fail because Node can't `require` a `.ts` file directly — that's expected and fine; the real check is the type-check in the next step. Skip straight to Step 3.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/projectEditability.ts
git commit -m "$(cat <<'EOF'
Add isProjectEditable helper for the review-lock/edit-access rule

Centralizes the ONGOING-always-editable / IN_REVIEW-editable-only-when-
granted rule so both existing lock checks (and the new request-edit
route) stay consistent instead of duplicating the condition.
EOF
)"
```

---

### Task 3: Wire the helper into the two existing lock checks

**Files:**
- Modify: `src/app/api/projects/[id]/route.ts` (PATCH handler, the `project.status !== 'ONGOING'` check)
- Modify: `src/app/api/projects/[id]/responses/batch/route.ts` (the `project.status !== 'ONGOING'` check)

**Interfaces:**
- Consumes: `isProjectEditable(status, pendingEditAccessStatus)` from Task 2.

- [ ] **Step 1: Update `src/app/api/projects/[id]/route.ts`**

Add the import near the top (after the existing imports, around line 7):

```typescript
import { isProjectEditable } from '@/lib/projectEditability';
```

In the `PATCH` handler, the `project` query currently is (around line 150):

```typescript
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        teamMembers: {
          where: { userId },
        },
      },
    });
```

Change it to also fetch the active pending submission's edit-access status:

```typescript
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        teamMembers: {
          where: { userId },
        },
        submissions: {
          where: { status: 'PENDING' },
          take: 1,
          select: { editAccessStatus: true },
        },
      },
    });
```

Then change the lock check (around line 173):

```typescript
    if (project.status !== 'ONGOING') {
      return NextResponse.json({ error: 'Project is not editable in its current status' }, { status: 409 });
    }
```

to:

```typescript
    if (!isProjectEditable(project.status, project.submissions[0]?.editAccessStatus)) {
      return NextResponse.json({ error: 'Project is not editable in its current status' }, { status: 409 });
    }
```

- [ ] **Step 2: Update `src/app/api/projects/[id]/responses/batch/route.ts`**

Add the same import after the existing imports (around line 7):

```typescript
import { isProjectEditable } from '@/lib/projectEditability';
```

The `project` query currently is (around line 39):

```typescript
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        teamMembers: {
          where: { userId },
        },
      },
    });
```

Change it to:

```typescript
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        teamMembers: {
          where: { userId },
        },
        submissions: {
          where: { status: 'PENDING' },
          take: 1,
          select: { editAccessStatus: true },
        },
      },
    });
```

Then change the lock check (around line 73):

```typescript
    if (project.status !== 'ONGOING') {
      return NextResponse.json({ error: 'Project is not editable in its current status' }, { status: 409 });
    }
```

to:

```typescript
    if (!isProjectEditable(project.status, project.submissions[0]?.editAccessStatus)) {
      return NextResponse.json({ error: 'Project is not editable in its current status' }, { status: 409 });
    }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: no new errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev` (in one terminal), then in another:

```bash
curl -s -X PATCH http://localhost:3001/api/projects/does-not-exist -H "Content-Type: application/json" -d '{}'
```

Expected: `{"error":"Unauthorized"}` (no session cookie) — confirms the route still compiles and responds; full behavioral verification (an actual `IN_REVIEW` + `GRANTED` project) happens in Task 10 once the rest of the flow exists.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/projects/[id]/route.ts src/app/api/projects/[id]/responses/batch/route.ts
git commit -m "$(cat <<'EOF'
Allow edits on IN_REVIEW projects once edit access is granted

Both lock checks now go through isProjectEditable instead of a bare
status === 'ONGOING' comparison, so a project stays in the review
queue while still being editable once an admin grants edit access.
EOF
)"
```

---

### Task 4: Request-edit endpoint

**Files:**
- Create: `src/app/api/projects/[id]/submit/request-edit/route.ts`

**Interfaces:**
- Consumes: Prisma `ProjectSubmission.editAccessStatus`/`editAccessRequestedAt` (Task 1).
- Produces: `POST /api/projects/:id/submit/request-edit` → `{ editAccessStatus: 'REQUESTED' }` on success.

- [ ] **Step 1: Write the route**

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as any).id;
    const systemRole = (session.user as any).role;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        teamMembers: { where: { userId } },
        submissions: {
          where: { status: 'PENDING' },
          take: 1,
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const membership = project.teamMembers[0];
    const canEdit =
      systemRole === 'ADMIN' ||
      project.userId === userId ||
      (membership?.status === 'ACTIVE' && ['ADMIN', 'EDITOR'].includes(membership.permission));

    if (!canEdit) {
      return NextResponse.json({ error: 'Unauthorized: missing edit permissions' }, { status: 403 });
    }

    if (project.status !== 'IN_REVIEW') {
      return NextResponse.json({ error: 'Project is not currently under review' }, { status: 409 });
    }

    const submission = project.submissions[0];
    if (!submission) {
      return NextResponse.json({ error: 'No pending submission found for this project' }, { status: 409 });
    }

    if (submission.editAccessStatus === 'NONE') {
      await prisma.projectSubmission.update({
        where: { id: submission.id },
        data: {
          editAccessStatus: 'REQUESTED',
          editAccessRequestedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ editAccessStatus: 'REQUESTED' });
  } catch (error: any) {
    console.error('Error requesting edit access:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

Expected: no new errors.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, then:

```bash
curl -s -X POST http://localhost:3001/api/projects/does-not-exist/submit/request-edit
```

Expected: `{"error":"Unauthorized"}` (no session) — confirms the route compiles and is reachable at the expected path.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/projects/[id]/submit/request-edit/route.ts
git commit -m "$(cat <<'EOF'
Add POST /api/projects/:id/submit/request-edit

Lets the project owner/editor flag that they want edit access while
their submission is IN_REVIEW. Idempotent no-op if already requested
or granted.
EOF
)"
```

---

### Task 5: Expose submission state on `GET /api/projects/[id]`

**Files:**
- Modify: `src/app/api/projects/[id]/route.ts` (GET handler)

**Interfaces:**
- Produces: JSON response gains `currentSubmission: { id, status, editAccessStatus, editAccessRequestedAt, editAccessGrantedAt, reviewNote, rejectedAt, approvedAt, createdAt } | null` (replacing any raw `submissions` array — never expose `tokenHash`).

- [ ] **Step 1: Update the GET query's include**

The GET handler's `project` query currently is (around line 24):

```typescript
    const project = await prisma.project.findFirst({
      where: {
        id,
        ...(systemRole === 'ADMIN'
          ? {}
          : {
              OR: [
                { userId },
                {
                  teamMembers: {
                    some: {
                      userId,
                      status: 'ACTIVE'
                    }
                  }
                }
              ]
            })
      },
      include: {
        facilityUses: {
          where: { archivedAt: null },
        },
        responses: true,
        sectionToggles: true,
        teamMembers: {
          where: { userId },
        }
      },
    });
```

Add a `submissions` include for the most recent submission only:

```typescript
    const project = await prisma.project.findFirst({
      where: {
        id,
        ...(systemRole === 'ADMIN'
          ? {}
          : {
              OR: [
                { userId },
                {
                  teamMembers: {
                    some: {
                      userId,
                      status: 'ACTIVE'
                    }
                  }
                }
              ]
            })
      },
      include: {
        facilityUses: {
          where: { archivedAt: null },
        },
        responses: true,
        sectionToggles: true,
        teamMembers: {
          where: { userId },
        },
        submissions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            editAccessStatus: true,
            editAccessRequestedAt: true,
            editAccessGrantedAt: true,
            reviewNote: true,
            rejectedAt: true,
            approvedAt: true,
            createdAt: true,
          },
        },
      },
    });
```

- [ ] **Step 2: Replace the raw spread with an explicit `currentSubmission` field**

The return statement currently starts with (around line 111):

```typescript
    return NextResponse.json({
      ...project,
      userRole,
```

Change it to strip the raw `submissions` array out of the spread and add `currentSubmission` explicitly:

```typescript
    const { submissions, ...projectFields } = project;

    return NextResponse.json({
      ...projectFields,
      currentSubmission: submissions[0] || null,
      userRole,
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: no new errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, then:

```bash
curl -s http://localhost:3001/api/projects/does-not-exist
```

Expected: `{"error":"Unauthorized"}` (no session) — confirms the route still compiles; full field verification happens once logged in during Task 10.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/projects/[id]/route.ts
git commit -m "$(cat <<'EOF'
Expose currentSubmission on GET /api/projects/:id

Returns the most recent submission's status, edit-access state, and
review note (never the raw tokenHash) so the client can render lock
banners without a second request.
EOF
)"
```

---

### Task 6: Admin approvals route — reject + grantEdit actions, rejected tab

**Files:**
- Modify: `src/app/api/admin/project-approvals/route.ts`

**Interfaces:**
- Produces: `GET ?status=pending|approved|rejected`. `POST { submissionId, action: 'approve' | 'reject' | 'grantEdit', note?: string }`.

- [ ] **Step 1: Update `normalizeSubmission` and `GET` to support the rejected tab and new fields**

Replace the whole file's `normalizeSubmission` function and `GET` handler:

```typescript
function normalizeSubmission(submission: any) {
  return {
    id: submission.id,
    status: submission.status,
    submittedTo: submission.submittedTo,
    createdAt: submission.createdAt,
    approvedAt: submission.approvedAt,
    rejectedAt: submission.rejectedAt,
    reviewNote: submission.reviewNote,
    editAccessStatus: submission.editAccessStatus,
    editAccessRequestedAt: submission.editAccessRequestedAt,
    project: {
      id: submission.project.id,
      projectNumber: submission.project.projectNumber,
      projectName: submission.project.projectName,
      contactName: submission.project.contactName,
      contactEmail: submission.project.contactEmail,
      firmName: submission.project.firmName,
      ownerName: submission.project.ownerName,
      status: submission.project.status,
      score: submission.project.score,
      updatedAt: submission.project.updatedAt,
      user: {
        name: `${submission.project.user.firstName} ${submission.project.user.lastName}`.trim(),
        email: submission.project.user.email,
      },
    },
  };
}

export async function GET(req: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const statusParam = new URL(req.url).searchParams.get('status');
  const status =
    statusParam === 'approved' ? 'APPROVED' : statusParam === 'rejected' ? 'REJECTED' : 'PENDING';
  const submissions = await prisma.projectSubmission.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    include: {
      project: {
        select: {
          id: true,
          projectNumber: true,
          projectName: true,
          contactName: true,
          contactEmail: true,
          firmName: true,
          ownerName: true,
          status: true,
          score: true,
          updatedAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json(submissions.map(normalizeSubmission));
}
```

- [ ] **Step 2: Replace the `POST` handler with the action-based version**

```typescript
export async function POST(req: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { submissionId, action, note } = await req.json();
    if (!submissionId || typeof submissionId !== 'string') {
      return NextResponse.json({ error: 'Submission ID is required' }, { status: 400 });
    }
    if (!['approve', 'reject', 'grantEdit'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const submission = await prisma.projectSubmission.findFirst({
      where: {
        id: submissionId,
        status: 'PENDING',
      },
      select: {
        id: true,
        projectId: true,
        editAccessStatus: true,
      },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Pending submission not found' }, { status: 404 });
    }

    if (action === 'approve') {
      await prisma.$transaction([
        prisma.projectSubmission.update({
          where: { id: submission.id },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
          },
        }),
        prisma.project.update({
          where: { id: submission.projectId },
          data: { status: 'COMPLETED' },
        }),
      ]);
    } else if (action === 'reject') {
      await prisma.$transaction([
        prisma.projectSubmission.update({
          where: { id: submission.id },
          data: {
            status: 'REJECTED',
            rejectedAt: new Date(),
            reviewNote: typeof note === 'string' && note.trim() ? note.trim() : null,
          },
        }),
        prisma.project.update({
          where: { id: submission.projectId },
          data: { status: 'ONGOING' },
        }),
      ]);
    } else {
      if (submission.editAccessStatus !== 'REQUESTED') {
        return NextResponse.json({ error: 'Edit access was not requested for this submission' }, { status: 409 });
      }
      await prisma.projectSubmission.update({
        where: { id: submission.id },
        data: {
          editAccessStatus: 'GRANTED',
          editAccessGrantedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (approvalError: any) {
    console.error('[ADMIN_PROJECT_APPROVAL_ERROR]', approvalError);
    return NextResponse.json({ error: approvalError?.message || 'Unable to process submission' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/project-approvals/route.ts
git commit -m "$(cat <<'EOF'
Add reject and grantEdit actions to the admin approvals endpoint

POST now takes an action discriminator (approve/reject/grantEdit)
instead of only supporting approve. Reject sets REJECTED + an optional
review note and unlocks the project back to ONGOING; grantEdit unlocks
editing without leaving the review queue. GET gains a rejected tab.
EOF
)"
```

---

### Task 7: `ProjectOverview.tsx` — lock banners and request-edit button

**Files:**
- Modify: `src/components/ProjectOverview.tsx`

**Interfaces:**
- Consumes: `project.status`, `project.currentSubmission` (from Task 5): `{ status: 'PENDING'|'APPROVED'|'REJECTED', editAccessStatus: 'NONE'|'REQUESTED'|'GRANTED', reviewNote: string | null } | null`.

- [ ] **Step 1: Extend the `ProjectData` interface**

Find the `ProjectData` interface (around line 17) and add the new field after `userStatus`:

```typescript
  userStatus: string;
  currentSubmission: {
    id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    editAccessStatus: 'NONE' | 'REQUESTED' | 'GRANTED';
    reviewNote: string | null;
  } | null;
```

- [ ] **Step 2: Add lock-state derivation and the request-edit handler**

`isReadOnly` (line 128) is declared *before* `isSubmitted`/`canSubmitProject` (declared later, around line 180) — don't touch line 128. Instead, add a new derived flag after the `canSubmitProject` block and use that flag wherever edit affordances need to also respect the review lock.

Add a new state variable near the other `useState` calls (around line 126, right after `cardError`):

```typescript
  const [isRequestingEdit, setIsRequestingEdit] = useState(false);
  const [requestEditError, setRequestEditError] = useState<string | null>(null);
```

Find where `isSubmitted`/`isCertified`/`canSubmitProject` are computed (around line 180-188):

```typescript
  const isSubmitted = project.status === 'IN_REVIEW';
  const isCertified = project.status === 'COMPLETED';
  const canSubmitProject = Boolean(
    !isSubmitted &&
    !isCertified &&
    project.certificationStatus?.isQualifying &&
    project.certificationStatus?.isThresholdMet &&
    project.certificationStatus?.isMandatoryMet
  );
```

Add right after that block:

```typescript
  const editAccessStatus = project.currentSubmission?.editAccessStatus ?? 'NONE';
  const isReviewLocked = isSubmitted && editAccessStatus !== 'GRANTED';
  const rejectionNote =
    project.status === 'ONGOING' && project.currentSubmission?.status === 'REJECTED'
      ? project.currentSubmission.reviewNote
      : null;
  const showEditActions = !isReadOnly && !isReviewLocked;
```

Then, everywhere the component currently gates edit affordances on `!isReadOnly` for things that should also respect the review lock — the "Edit Project Details" / "Edit Solutions" buttons in the title bar, and the per-card "Edit" links/buttons — switch those specific conditions from `!isReadOnly` to `showEditActions`. The **Submit** button block and the Team Members section stay on `!isReadOnly` (submitting is already separately gated by `canSubmitProject`, and team view/edit labels already branch correctly).

Concretely:
- Title bar: the `Edit Project Details` link and the `Submit` button currently share **one** conditional fragment (around line 329):

  ```typescript
    {!isReadOnly && (
      <>
        <Link href={`/projects/${id}/edit`}>
          <Button variant="primary" className="gap-2 text-sm">
            <Edit size={16} /> Edit Project Details
          </Button>
        </Link>
        <Button
          variant="secondary"
          className="gap-2 text-sm disabled:bg-slate-400"
          disabled={!canSubmitProject || isSubmittingProject}
          title={submitTitle}
          aria-disabled={!canSubmitProject}
          onClick={handleSubmitProject}
        >
          {isSubmittingProject ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {isSubmittingProject ? 'Submitting...' : submitButtonLabel}
        </Button>
      </>
    )}
  ```

  Split it into two separately-gated blocks so the Submit button keeps its existing visibility (it already renders as a disabled "Submitted" button once `isSubmitted` is true, which is worth keeping as a status indicator) while only the Edit link respects the new lock:

  ```typescript
    {!isReadOnly && !isReviewLocked && (
      <Link href={`/projects/${id}/edit`}>
        <Button variant="primary" className="gap-2 text-sm">
          <Edit size={16} /> Edit Project Details
        </Button>
      </Link>
    )}
    {!isReadOnly && (
      <Button
        variant="secondary"
        className="gap-2 text-sm disabled:bg-slate-400"
        disabled={!canSubmitProject || isSubmittingProject}
        title={submitTitle}
        aria-disabled={!canSubmitProject}
        onClick={handleSubmitProject}
      >
        {isSubmittingProject ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {isSubmittingProject ? 'Submitting...' : submitButtonLabel}
      </Button>
    )}
  ```
- Project Information card `{!isReadOnly && editingCard !== 'projectInfo' && (` (around line 412) → `{showEditActions && editingCard !== 'projectInfo' && (`
- Contact Information card (around line 443) → `{showEditActions && editingCard !== 'contactInfo' && (`
- Earned Credits Edit link (around line 488) → `{showEditActions && (`
- Certification card (around line 559) → `{showEditActions && editingCard !== 'certification' && (`

Leave the `isReadOnly`-gated "Read-Only Mode" badge, checklist button label, and Team Members section untouched — those already read correctly for the VIEWER/PENDING case and don't need the review-lock distinction (a `GRANTED` `IN_REVIEW` project should still say "Edit Solutions"/"Edit Team", which `isReadOnly` already allows since `isReviewLocked` is false in that case and `isReadOnly` doesn't include the lock).

- [ ] **Step 3: Add the request-edit handler**

Add this function right after `handleSubmitProject` (around line 220, after its closing brace):

```typescript
  const handleRequestEditAccess = async () => {
    if (isRequestingEdit || editAccessStatus !== 'NONE') return;
    setIsRequestingEdit(true);
    setRequestEditError(null);

    try {
      const response = await fetch(`/api/projects/${id}/submit/request-edit`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Unable to request edit access.');
      }

      setProject((current) =>
        current
          ? {
              ...current,
              currentSubmission: current.currentSubmission
                ? { ...current.currentSubmission, editAccessStatus: 'REQUESTED' }
                : current.currentSubmission,
            }
          : current
      );
    } catch (error: any) {
      setRequestEditError(error.message || 'Unable to request edit access.');
    } finally {
      setIsRequestingEdit(false);
    }
  };
```

- [ ] **Step 4: Render the lock/rejection banners**

Find the `submitMessage` banner block (around line 352):

```typescript
      {submitMessage && (
        <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {submitMessage}
        </div>
      )}
```

Add these banners right after it:

```typescript
      {isReviewLocked && editAccessStatus === 'NONE' && (
        <div className="flex flex-col gap-2 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>This project is under review and locked for edits.</span>
          <button
            type="button"
            onClick={handleRequestEditAccess}
            disabled={isRequestingEdit}
            className="inline-flex items-center gap-2 rounded-sm bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isRequestingEdit ? <Loader2 size={14} className="animate-spin" /> : null}
            {isRequestingEdit ? 'Requesting...' : 'Request Edit Access'}
          </button>
        </div>
      )}

      {isReviewLocked && editAccessStatus === 'REQUESTED' && (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Edit access requested — waiting on admin approval.
        </div>
      )}

      {isSubmitted && editAccessStatus === 'GRANTED' && (
        <div className="rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Edit access granted — changes you make are visible to the reviewing admin.
        </div>
      )}

      {requestEditError && (
        <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {requestEditError}
        </div>
      )}

      {rejectionNote && (
        <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Your last submission was returned: {rejectionNote}
        </div>
      )}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`

Expected: no new errors. If you see "used before declaration" for `editAccessStatus`/`isReviewLocked`/`rejectionNote`/`showEditActions`, confirm they were added right after the `canSubmitProject` block (which is itself after `isSubmitted`/`isCertified`) and before any JSX/handler that references them.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, log in as a test user with an `ONGOING` project, and confirm the page still renders and edit buttons still work (no `currentSubmission` yet is fine — the optional chaining defaults `editAccessStatus` to `'NONE'` and all the new banners are gated on `isSubmitted`/`isReviewLocked`, which are both false for an `ONGOING` project). Full lock-flow verification (submitting, requesting, granting) happens in Task 10.

- [ ] **Step 7: Commit**

```bash
git add src/components/ProjectOverview.tsx
git commit -m "$(cat <<'EOF'
Show review-lock state and Request Edit Access on ProjectOverview

isReadOnly previously ignored IN_REVIEW entirely, so Edit buttons stayed
visible even though saving would 409. Now the UI honestly reflects the
lock, offers a Request Edit Access button, and surfaces the admin's
rejection note after a submission is returned.
EOF
)"
```

---

### Task 8: `AdminProjectApprovalsClient.tsx` — rejected tab, grant/reject actions

**Files:**
- Modify: `src/components/AdminProjectApprovalsClient.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/project-approvals` with `{ submissionId, action, note? }` (Task 6). `GET` response items now include `editAccessStatus`, `editAccessRequestedAt`, `reviewNote`, `rejectedAt` (Task 6).

- [ ] **Step 1: Extend types and tab state**

Change the `ApprovalStatus` type and `ProjectApproval` type (top of file, around lines 8-32):

```typescript
type ApprovalStatus = 'pending' | 'approved' | 'rejected';

type ProjectApproval = {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedTo: string;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  reviewNote: string | null;
  editAccessStatus: 'NONE' | 'REQUESTED' | 'GRANTED';
  editAccessRequestedAt: string | null;
  project: {
    id: string;
    projectNumber: number;
    projectName: string;
    contactName: string;
    contactEmail: string;
    firmName: string | null;
    ownerName: string | null;
    status: string;
    score: number;
    updatedAt: string;
    user: {
      name: string;
      email: string;
    };
  };
};
```

- [ ] **Step 2: Add reject-note state and rewrite the action handler**

Replace the `approvingId`/`message`/`error` state block (around line 50) — add two new state vars right after it:

```typescript
  const [approvingId, setApprovingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [rejectingId, setRejectingId] = useState('');
  const [rejectNote, setRejectNote] = useState('');
```

Replace the `approveSubmission` function (around line 86) with a generalized action handler plus two thin wrappers:

```typescript
  async function runAction(item: ProjectApproval, action: 'approve' | 'reject' | 'grantEdit', note?: string) {
    setApprovingId(item.id);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/admin/project-approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: item.id, action, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update submission');
      const successMessage =
        action === 'approve'
          ? `${item.project.projectName} has been certified.`
          : action === 'reject'
          ? `${item.project.projectName} has been returned to the owner.`
          : `Edit access granted for ${item.project.projectName}.`;
      setMessage(successMessage);
      setRejectingId('');
      setRejectNote('');
      await loadApprovals(status);
    } catch (err: any) {
      setError(err.message || 'Unable to update submission');
    } finally {
      setApprovingId('');
    }
  }

  function approveSubmission(item: ProjectApproval) {
    return runAction(item, 'approve');
  }

  function grantEditAccess(item: ProjectApproval) {
    return runAction(item, 'grantEdit');
  }

  function submitReject(item: ProjectApproval) {
    return runAction(item, 'reject', rejectNote);
  }
```

- [ ] **Step 3: Add the rejected tab**

Find the tab toggle (around line 118):

```typescript
            {(['pending', 'approved'] as ApprovalStatus[]).map((option) => (
```

Change to:

```typescript
            {(['pending', 'approved', 'rejected'] as ApprovalStatus[]).map((option) => (
```

- [ ] **Step 4: Update the empty-state and row-action rendering**

Find the empty-state text (around line 158):

```typescript
            <p className="mt-4 text-sm font-bold text-slate-700">No {status} projects</p>
```

No change needed there — `status` already interpolates correctly for `'rejected'`.

Find the row status badge (around line 170):

```typescript
                    <span className={`rounded px-2 py-1 text-xs font-bold ${item.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {item.status === 'APPROVED' ? 'Certified' : 'Pending approval'}
                    </span>
```

Replace with a three-way badge, and add an edit-access badge next to it:

```typescript
                    <span className={`rounded px-2 py-1 text-xs font-bold ${
                      item.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : item.status === 'REJECTED'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.status === 'APPROVED' ? 'Certified' : item.status === 'REJECTED' ? 'Rejected' : 'Pending approval'}
                    </span>
                    {item.editAccessStatus === 'REQUESTED' && (
                      <span className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                        Edit access requested
                      </span>
                    )}
                    {item.editAccessStatus === 'GRANTED' && (
                      <span className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                        Edit access granted
                      </span>
                    )}
```

Find the row action buttons (around line 185):

```typescript
                <div className="flex flex-col gap-2 lg:items-end">
                  {item.status === 'PENDING' ? (
                    <button
                      type="button"
                      onClick={() => approveSubmission(item)}
                      disabled={Boolean(approvingId)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-[#001d3d] disabled:bg-slate-300"
                    >
                      {approvingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Approve
                    </button>
                  ) : (
                    <div className="text-right text-sm font-semibold text-emerald-700">
                      Approved {formatDate(item.approvedAt)}
                    </div>
                  )}
                  <Link href={`/projects/${item.project.id}`} className="text-sm font-bold text-secondary hover:underline">
                    Review project
                  </Link>
                </div>
```

Replace with:

```typescript
                <div className="flex flex-col gap-2 lg:items-end">
                  {item.status === 'PENDING' ? (
                    <>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => approveSubmission(item)}
                          disabled={Boolean(approvingId) || rejectingId === item.id}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-[#001d3d] disabled:bg-slate-300"
                        >
                          {approvingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Approve
                        </button>
                        {item.editAccessStatus === 'REQUESTED' && (
                          <button
                            type="button"
                            onClick={() => grantEditAccess(item)}
                            disabled={Boolean(approvingId) || rejectingId === item.id}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                          >
                            Grant Edit Access
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setRejectingId(rejectingId === item.id ? '' : item.id)}
                          disabled={Boolean(approvingId)}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                      {rejectingId === item.id && (
                        <div className="flex flex-col gap-2 lg:items-end">
                          <textarea
                            value={rejectNote}
                            onChange={(event) => setRejectNote(event.target.value)}
                            placeholder="Optional note for the project owner"
                            className="h-20 w-full rounded-md border border-slate-200 p-2 text-sm lg:w-80"
                          />
                          <button
                            type="button"
                            onClick={() => submitReject(item)}
                            disabled={Boolean(approvingId)}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {approvingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Confirm Reject
                          </button>
                        </div>
                      )}
                    </>
                  ) : item.status === 'REJECTED' ? (
                    <div className="text-right text-sm font-semibold text-red-700">
                      Rejected {formatDate(item.rejectedAt)}
                      {item.reviewNote && <div className="mt-1 text-xs font-medium text-slate-500">{item.reviewNote}</div>}
                    </div>
                  ) : (
                    <div className="text-right text-sm font-semibold text-emerald-700">
                      Approved {formatDate(item.approvedAt)}
                    </div>
                  )}
                  <Link href={`/projects/${item.project.id}`} className="text-sm font-bold text-secondary hover:underline">
                    Review project
                  </Link>
                </div>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`

Expected: no new errors.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, log in as an admin, visit `/admin/project-approvals`, and confirm all three tabs (Pending/Approved/Rejected) load without errors (Rejected will be empty until Task 10's end-to-end check produces one).

- [ ] **Step 7: Commit**

```bash
git add src/components/AdminProjectApprovalsClient.tsx
git commit -m "$(cat <<'EOF'
Add reject and grant-edit-access actions to the admin approvals UI

Adds a Rejected tab, a Reject button with an optional note (calls the
new reject action), and a Grant Edit Access button that appears when
a submission's editAccessStatus is REQUESTED.
EOF
)"
```

---

### Task 9: Admin pending-approvals banner on My Projects

**Files:**
- Create: `src/components/AdminPendingApprovalsBanner.tsx`
- Modify: `src/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/project-approvals?status=pending` (existing, returns an array).
- Produces: `<AdminPendingApprovalsBanner />` — renders nothing for non-admins or when the pending count is 0.

- [ ] **Step 1: Write the banner component**

```typescript
'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';

export default function AdminPendingApprovalsBanner() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'ADMIN';
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    fetch('/api/admin/project-approvals?status=pending')
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (!cancelled) setCount(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!isAdmin || count === 0) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <Link
        href="/admin/project-approvals"
        className="flex items-center justify-between gap-3 rounded-sm border border-secondary/30 bg-amber-50 px-4 py-3 text-sm font-bold text-primary shadow-sm transition hover:bg-amber-100"
      >
        <span className="flex items-center gap-2">
          <ClipboardCheck size={16} />
          {count} project{count === 1 ? '' : 's'} awaiting approval
        </span>
        <span className="text-secondary underline">Review now</span>
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Render it above `ProjectTable` in the home page**

Current `src/app/(dashboard)/page.tsx`:

```typescript
import ProjectTable from "@/components/ProjectTable";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-80px-200px)] flex flex-col items-center justify-start bg-slate-50">
      <ProjectTable />
    </div>
  );
}
```

Replace with:

```typescript
import ProjectTable from "@/components/ProjectTable";
import AdminPendingApprovalsBanner from "@/components/AdminPendingApprovalsBanner";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-80px-200px)] flex flex-col items-center justify-start bg-slate-50">
      <AdminPendingApprovalsBanner />
      <ProjectTable />
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: no new errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, log in as a non-admin — confirm no banner appears. Log in as an admin with at least one pending submission — confirm the banner appears above the table and links to `/admin/project-approvals`.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdminPendingApprovalsBanner.tsx "src/app/(dashboard)/page.tsx"
git commit -m "$(cat <<'EOF'
Surface pending project approvals on the admin's My Projects page

Admin-only banner showing a pending-approval count with a link to the
full Project Approvals page, so admins don't have to visit that page
just to check if anything's waiting.
EOF
)"
```

---

### Task 10: End-to-end manual verification and push to dev

**Files:** none (verification only)

- [ ] **Step 1: Full build check**

Run: `npm run build`

Expected: build completes with no type errors. (This also runs `prisma generate`, confirming the schema/client are in sync.)

- [ ] **Step 2: Manual end-to-end walkthrough**

With `npm run dev` running, using two browser sessions (or incognito for the second) — one as a regular user with an `ONGOING` project that meets the submit threshold, one as an admin:

1. As the user: submit the project (existing Submit button). Confirm it now shows the "under review and locked" banner with **Request Edit Access**, and that Edit Project Details/Edit Solutions affordances are hidden.
2. Click **Request Edit Access**. Confirm the banner switches to "waiting on admin approval".
3. As the admin: open `/admin/project-approvals`, confirm the pending row shows an "Edit access requested" badge and a **Grant Edit Access** button. Click it.
4. As the user: reload the project page. Confirm the "Edit access granted" banner appears and Edit Project Details/Edit Solutions are now clickable and saving works (PATCH no longer 409s).
5. As the admin: click **Reject** on a different pending submission (or resubmit and reject this one after granting — either order works since granting doesn't block reject), type a note, confirm. Confirm the submission moves to the Rejected tab with the note visible.
6. As the user: reload that project. Confirm it's back to `ONGOING`, fully editable, with a red banner showing "Your last submission was returned: <note>".
7. As the admin: visit `/` (My Projects). Confirm the pending-approvals banner count matches the Project Approvals pending tab, and disappears once there are zero pending submissions.

Fix anything that doesn't match before proceeding.

- [ ] **Step 3: Lint**

Run: `npm run lint`

Expected: no new errors introduced by this feature's files.

- [ ] **Step 4: Push to dev**

```bash
git push
```

Expected: pushes the commits from Tasks 1-9 to `dev`, triggering a Vercel Preview deploy. **Do not merge to `main`** — per the project's workflow, wait for explicit confirmation that the Preview deploy works before merging.
