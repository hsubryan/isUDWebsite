ALTER TABLE "ProjectSubmission" DROP COLUMN "editAccessStatus";
ALTER TABLE "ProjectSubmission" DROP COLUMN "editAccessRequestedAt";
ALTER TABLE "ProjectSubmission" DROP COLUMN "editAccessGrantedAt";

DROP TYPE "EditAccessStatus";
