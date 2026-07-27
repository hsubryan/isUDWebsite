import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

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
