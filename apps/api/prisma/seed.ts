// Demo data for local development. Run with: npm run prisma:seed -w apps/api
import { PrismaClient, Lead, UserRole, LeadSource, LeadStatus, LeadTemperature, MessageDirection, MessageType, QuotationStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const DEMO_PASSWORD = 'Demo@1234';
const SUPER_ADMIN_EMAIL = 'superadmin@aisalesos.com';
const SUPER_ADMIN_PASSWORD = 'SuperAdmin@123';

async function main() {
  // --- PlatformAdmin (Super Admin — cross-tenant, /platform/* only) ---
  const superAdminPasswordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, SALT_ROUNDS);
  await prisma.platformAdmin.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {},
    create: { email: SUPER_ADMIN_EMAIL, passwordHash: superAdminPasswordHash },
  });

  // --- Organization + pipeline stages ---
  const existingOrg = await prisma.organization.findFirst({ where: { name: 'Demo Traders Pvt Ltd' } });
  if (existingOrg) {
    console.log('Demo organization already exists, skipping seed (delete it first to reseed).');
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  const org = await prisma.organization.create({
    data: {
      name: 'Demo Traders Pvt Ltd',
      gstin: '27AAAPL1234C1ZV',
      plan: 'BUSINESS',
      pipelineStages: {
        create: [
          { name: 'New', order: 0 },
          { name: 'Contacted', order: 1 },
          { name: 'Qualified', order: 2 },
          { name: 'Quotation Sent', order: 3 },
          { name: 'Negotiation', order: 4 },
          { name: 'Won', order: 5, isClosed: true },
          { name: 'Lost', order: 6, isClosed: true },
        ],
      },
    },
    include: { pipelineStages: true },
  });
  const stage = (name: string) => org.pipelineStages.find((s) => s.name === name)!.id;

  // --- Users ---
  const [owner, manager, exec1, fieldExec] = await Promise.all([
    prisma.user.create({
      data: { organizationId: org.id, name: 'Asha Mehta', email: 'owner@demo.com', phone: '9820000001', passwordHash, role: UserRole.OWNER },
    }),
    prisma.user.create({
      data: { organizationId: org.id, name: 'Rohit Sharma', email: 'manager@demo.com', phone: '9820000002', passwordHash, role: UserRole.SALES_MANAGER },
    }),
    prisma.user.create({
      data: { organizationId: org.id, name: 'Priya Nair', email: 'sales@demo.com', phone: '9820000003', passwordHash, role: UserRole.SALES_EXECUTIVE },
    }),
    prisma.user.create({
      data: { organizationId: org.id, name: 'Vikram Singh', email: 'field@demo.com', phone: '9820000004', passwordHash, role: UserRole.FIELD_SALES_EXECUTIVE },
    }),
  ]);

  // --- Products ---
  const products = await Promise.all([
    prisma.product.create({ data: { organizationId: org.id, name: 'Steel Pipe 2-inch', sku: 'SP-2IN', unit: 'meter', unitPrice: 450, taxRatePercent: 18 } }),
    prisma.product.create({ data: { organizationId: org.id, name: 'Industrial Valve', sku: 'VLV-100', unit: 'pcs', unitPrice: 2200, taxRatePercent: 18 } }),
    prisma.product.create({ data: { organizationId: org.id, name: 'Cotton Fabric Roll', sku: 'CFR-50', unit: 'roll', unitPrice: 3200, taxRatePercent: 5 } }),
    prisma.product.create({ data: { organizationId: org.id, name: 'Packaging Box (Medium)', sku: 'PKB-M', unit: 'box', unitPrice: 25, taxRatePercent: 12 } }),
    prisma.product.create({ data: { organizationId: org.id, name: 'LED Panel Light', sku: 'LED-40W', unit: 'pcs', unitPrice: 650, taxRatePercent: 18 } }),
  ]);

  // --- Message templates ---
  await prisma.messageTemplate.createMany({
    data: [
      { organizationId: org.id, name: 'Welcome', body: 'Hi {{1}}, thanks for reaching out to Demo Traders! How can we help you today?' },
      { organizationId: org.id, name: 'Quotation Follow-up', body: 'Hi {{1}}, just following up on the quotation we sent — happy to answer any questions.' },
    ],
  });

  // --- Leads ---
  const leadDefs = [
    { name: 'Sunil Traders', companyName: 'Sunil Traders', phone: '919810000101', source: LeadSource.WHATSAPP, status: LeadStatus.NEW, temperature: LeadTemperature.HOT, score: 82, stage: 'New', assignedTo: exec1.id },
    { name: 'Metro Hardware', companyName: 'Metro Hardware Co', phone: '919810000102', source: LeadSource.INDIAMART, status: LeadStatus.CONTACTED, temperature: LeadTemperature.WARM, score: 61, stage: 'Contacted', assignedTo: exec1.id },
    { name: 'Bright Textiles', companyName: 'Bright Textiles Ltd', phone: '919810000103', source: LeadSource.WEBSITE_FORM, status: LeadStatus.QUALIFIED, temperature: LeadTemperature.WARM, score: 55, stage: 'Qualified', assignedTo: manager.id },
    { name: 'Om Enterprises', companyName: 'Om Enterprises', phone: '919810000104', source: LeadSource.REFERRAL, status: LeadStatus.QUOTATION_SENT, temperature: LeadTemperature.HOT, score: 75, stage: 'Quotation Sent', assignedTo: exec1.id },
    { name: 'Kapoor Industries', companyName: 'Kapoor Industries', phone: '919810000105', source: LeadSource.JUSTDIAL, status: LeadStatus.NEGOTIATION, temperature: LeadTemperature.HOT, score: 88, stage: 'Negotiation', assignedTo: manager.id },
    { name: 'Sharma Electricals', companyName: 'Sharma Electricals', phone: '919810000106', source: LeadSource.META_ADS, status: LeadStatus.WON, temperature: LeadTemperature.HOT, score: 91, stage: 'Won', assignedTo: exec1.id },
    { name: 'Patel Packaging', companyName: 'Patel Packaging', phone: '919810000107', source: LeadSource.GOOGLE_ADS, status: LeadStatus.LOST, temperature: LeadTemperature.COLD, score: 20, stage: 'Lost', assignedTo: fieldExec.id },
    { name: 'Desai & Sons', companyName: 'Desai & Sons', phone: '919810000108', source: LeadSource.MANUAL, status: LeadStatus.NEW, temperature: LeadTemperature.COLD, score: 30, stage: 'New', assignedTo: fieldExec.id },
  ];
  const leads: Lead[] = [];
  for (const l of leadDefs) {
    leads.push(
      await prisma.lead.create({
        data: {
          organizationId: org.id,
          name: l.name,
          companyName: l.companyName,
          phone: l.phone,
          source: l.source,
          status: l.status,
          temperature: l.temperature,
          score: l.score,
          pipelineStageId: stage(l.stage),
          assignedToId: l.assignedTo,
        },
      }),
    );
  }

  // --- Customers (won leads become customers) ---
  const customer1 = await prisma.customer.create({
    data: { organizationId: org.id, name: 'Sharma Electricals', companyName: 'Sharma Electricals', phone: '919810000106', healthScore: 92 },
  });
  const customer2 = await prisma.customer.create({
    data: { organizationId: org.id, name: 'Gupta Traders', companyName: 'Gupta Traders', phone: '919810000200', healthScore: 78 },
  });

  // --- Tasks ---
  const now = Date.now();
  await prisma.task.createMany({
    data: [
      { organizationId: org.id, leadId: leads[0].id, assignedToId: exec1.id, title: 'Call Sunil Traders to confirm requirement', dueAt: new Date(now + 86400000) },
      { organizationId: org.id, leadId: leads[3].id, assignedToId: exec1.id, title: 'Send revised quotation to Om Enterprises', dueAt: new Date(now + 2 * 86400000) },
      { organizationId: org.id, leadId: leads[4].id, assignedToId: manager.id, title: 'Negotiation call with Kapoor Industries', dueAt: new Date(now + 3600000) },
      { organizationId: org.id, assignedToId: fieldExec.id, title: 'Field visit — Patel Packaging follow-up', dueAt: new Date(now - 86400000), status: 'COMPLETED', completedAt: new Date(now - 3600000) },
    ],
  });

  // --- Conversations + messages ---
  const conv1 = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      phone: leads[0].phone,
      leadId: leads[0].id,
      lastMessageAt: new Date(),
      lastInboundMessageAt: new Date(),
    },
  });
  await prisma.message.createMany({
    data: [
      { organizationId: org.id, conversationId: conv1.id, direction: MessageDirection.INBOUND, type: MessageType.TEXT, body: 'Hi, I need a quote for steel pipes.', createdAt: new Date(now - 3600000) },
      { organizationId: org.id, conversationId: conv1.id, direction: MessageDirection.OUTBOUND, type: MessageType.TEXT, body: 'Sure! How many meters do you need?', sentById: exec1.id, createdAt: new Date(now - 3500000) },
      { organizationId: org.id, conversationId: conv1.id, direction: MessageDirection.INBOUND, type: MessageType.TEXT, body: 'About 200 meters, 2-inch diameter.', createdAt: new Date(now - 1800000) },
    ],
  });

  const conv2 = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      phone: customer1.phone,
      customerId: customer1.id,
      lastMessageAt: new Date(),
      lastInboundMessageAt: new Date(),
    },
  });
  await prisma.message.createMany({
    data: [
      { organizationId: org.id, conversationId: conv2.id, direction: MessageDirection.OUTBOUND, type: MessageType.TEXT, body: 'Thanks for your order! Your LED panels shipped today.', sentById: exec1.id, createdAt: new Date(now - 7200000) },
      { organizationId: org.id, conversationId: conv2.id, direction: MessageDirection.INBOUND, type: MessageType.TEXT, body: 'Great, thank you!', createdAt: new Date(now - 7000000) },
    ],
  });

  // --- Quotation ---
  const quoteItems = [
    { product: products[1], qty: 10 },
    { product: products[0], qty: 200 },
  ];
  let subtotal = 0;
  let taxAmount = 0;
  const itemsData = quoteItems.map((qi, idx) => {
    const lineTotal = Number(qi.product.unitPrice) * qi.qty;
    const lineTax = (lineTotal * Number(qi.product.taxRatePercent)) / 100;
    subtotal += lineTotal;
    taxAmount += lineTax;
    return {
      productId: qi.product.id,
      description: qi.product.name,
      quantity: qi.qty,
      unitPrice: qi.product.unitPrice,
      taxRatePercent: qi.product.taxRatePercent,
      lineTotal,
      sortOrder: idx,
    };
  });
  await prisma.quotation.create({
    data: {
      organizationId: org.id,
      number: 'Q-0001',
      leadId: leads[3].id,
      createdById: exec1.id,
      status: QuotationStatus.SENT,
      validUntil: new Date(now + 14 * 86400000),
      subtotal,
      taxAmount,
      totalAmount: subtotal + taxAmount,
      sentAt: new Date(now - 86400000),
      items: { create: itemsData },
    },
  });

  // --- Visits ---
  await prisma.visit.createMany({
    data: [
      {
        organizationId: org.id,
        leadId: leads[6].id,
        userId: fieldExec.id,
        purpose: 'Site visit — discuss packaging requirement',
        checkInAt: new Date(now - 90000000),
        checkInLat: 19.076,
        checkInLng: 72.8777,
        checkOutAt: new Date(now - 86400000),
        checkOutLat: 19.076,
        checkOutLng: 72.8777,
        checkOutNotes: 'Customer not interested at this time.',
      },
      {
        organizationId: org.id,
        customerId: customer2.id,
        userId: fieldExec.id,
        purpose: 'Relationship visit — Gupta Traders',
        checkInAt: new Date(now - 3600000),
        checkInLat: 19.0596,
        checkInLng: 72.8295,
      },
    ],
  });

  console.log('Seed complete.');
  console.log('--- Demo Organization users (password for all: %s) ---', DEMO_PASSWORD);
  console.log('Owner:', owner.email);
  console.log('Sales Manager:', manager.email);
  console.log('Sales Executive:', exec1.email);
  console.log('Field Sales Executive:', fieldExec.email);
  console.log('--- Platform Super Admin ---');
  console.log('Email:', SUPER_ADMIN_EMAIL, 'Password:', SUPER_ADMIN_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
