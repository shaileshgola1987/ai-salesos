-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO');

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "lastInboundMessageAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "type" "MessageType" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "mediaProviderId" TEXT,
ADD COLUMN     "mediaUrl" TEXT,
ADD COLUMN     "mediaMimeType" TEXT;
