-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "customerId" TEXT,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "purpose" TEXT NOT NULL,
    "notes" TEXT,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkInLat" DECIMAL(9,6) NOT NULL,
    "checkInLng" DECIMAL(9,6) NOT NULL,
    "checkOutAt" TIMESTAMP(3),
    "checkOutLat" DECIMAL(9,6),
    "checkOutLng" DECIMAL(9,6),
    "checkOutNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visits_organizationId_clientId_key" ON "visits"("organizationId", "clientId");

-- CreateIndex
CREATE INDEX "visits_organizationId_idx" ON "visits"("organizationId");

-- CreateIndex
CREATE INDEX "visits_organizationId_userId_idx" ON "visits"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "visits_leadId_idx" ON "visits"("leadId");

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
