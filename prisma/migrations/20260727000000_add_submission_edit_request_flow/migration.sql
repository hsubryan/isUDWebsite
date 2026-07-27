-- CreateEnum
CREATE TYPE "EditAccessStatus" AS ENUM ('NONE', 'REQUESTED', 'GRANTED');

-- AlterEnum
ALTER TYPE "SubmissionStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "ProjectSubmission" ADD COLUMN     "editAccessGrantedAt" TIMESTAMP(3),
ADD COLUMN     "editAccessRequestedAt" TIMESTAMP(3),
ADD COLUMN     "editAccessStatus" "EditAccessStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "reviewNote" TEXT;
