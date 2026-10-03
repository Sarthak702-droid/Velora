// Dedicated synthetic tenant. No existing salon records are changed or deleted.
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const slug = "velora-integration-test";
(async () => {
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (process.argv.includes("--cleanup")) {
    if (existing) await prisma.tenant.delete({ where: { id: existing.id } });
    console.log("Dedicated integration tenant removed.");
    return;
  }
  if (existing)
    throw Error(
      "Integration tenant already exists. Run --cleanup before creating a fresh fixture.",
    );
  const subscription = await prisma.subscription.findFirst({
    where: { status: "ACTIVE" },
    include: {
      plan: { include: { planFeatures: { include: { feature: true } } } },
    },
  });
  if (!subscription)
    throw Error("An active plan is needed for integration tests");
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name: "Velora Integration Salon",
      status: "ACTIVE",
      salonProfile: {
        create: {
          currency: "INR",
          timezone: "Asia/Kolkata",
          cancellationWindowHours: 2,
        },
      },
    },
  });
  const branch = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      slug: "test-branch",
      name: "Integration Branch",
      address: "Synthetic test address",
      city: "Bhubaneswar",
      state: "Odisha",
      pincode: "751007",
      phone: "+910000000000",
      weeklyHolidays: [],
      openingTime: "09:00",
      closingTime: "21:00",
    },
  });
  const otherBranch = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      slug: "other-test-branch",
      name: "Other Integration Branch",
      address: "Synthetic second branch",
      city: "Bhubaneswar",
      state: "Odisha",
      pincode: "751007",
      phone: "+910000000001",
      weeklyHolidays: [],
    },
  });
  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: subscription.planId,
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 86400000 * 30),
    },
  });
  for (const key of [
    "book.advance",
    "queue.live",
    "desk.reception",
    "insights.basic",
    "flow.unified",
  ]) {
    const feature = await prisma.feature.findUnique({ where: { key } });
    if (feature)
      await prisma.tenantFeatureOverride.create({
        data: {
          tenantId: tenant.id,
          featureId: feature.id,
          enabled: true,
          reason: "Isolated integration fixture",
        },
      });
  }
  const password = "Integration-Test-Only-2026!";
  const owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      email: "integration-owner@velora.test",
      name: "Integration Owner",
      passwordHash: await bcrypt.hash(password, 10),
      role: "SALON_OWNER",
    },
  });
  const receptionist = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      email: "integration-reception@velora.test",
      name: "Integration Reception",
      passwordHash: await bcrypt.hash(password, 10),
      role: "RECEPTIONIST",
    },
  });
  const category = await prisma.serviceCategory.create({
    data: { tenantId: tenant.id, name: "Hair Services", slug: "hair" },
  });
  const haircut = await prisma.service.create({
    data: {
      tenantId: tenant.id,
      categoryId: category.id,
      name: "Integration Haircut",
      slug: "test-haircut",
      price: 650,
      duration: 35,
      buffer: 5,
    },
  });
  const spa = await prisma.service.create({
    data: {
      tenantId: tenant.id,
      categoryId: category.id,
      name: "Integration Hair Spa",
      slug: "test-spa",
      price: 1000,
      duration: 60,
      buffer: 10,
    },
  });
  const staff = await prisma.staffProfile.create({
    data: {
      tenantId: tenant.id,
      name: "Integration Stylist",
      title: "Senior Stylist",
      services: { create: [{ serviceId: haircut.id }, { serviceId: spa.id }] },
    },
  });
  const incompatible = await prisma.staffProfile.create({
    data: {
      tenantId: tenant.id,
      name: "Limited Stylist",
      services: { create: [{ serviceId: haircut.id }] },
    },
  });
  for (const s of [staff, incompatible])
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++)
      await prisma.staffSchedule.create({
        data: {
          staffId: s.id,
          branchId: branch.id,
          dayOfWeek,
          startTime: "09:00",
          endTime: "20:30",
          isWorkingDay: true,
        },
      });
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++)
    await prisma.staffSchedule.create({
      data: {
        staffId: incompatible.id,
        branchId: otherBranch.id,
        dayOfWeek,
        startTime: "09:00",
        endTime: "20:30",
        isWorkingDay: true,
      },
    });
  await prisma.staffBreak.create({
    data: { staffId: staff.id, startTime: "13:00", endTime: "14:00" },
  });
  // Synthetic payment states test SQL persistence/authorization, not real Razorpay transactions.
  const premiumCustomer = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      name: "Synthetic Premium Customer",
      phone: "+910000000199",
      marketingConsent: false,
    },
  });
  const premiumPaid = await prisma.payment.create({
    data: {
      tenantId: tenant.id,
      customerId: premiumCustomer.id,
      amount: 499,
      currency: "INR",
      purpose: "PREMIUM",
      provider: "RAZORPAY_TEST",
      orderId: "order_fixture_paid",
      paymentId: "pay_fixture_paid",
      status: "PAID",
      premiumExpiresAt: new Date(Date.now() + 30 * 86400000),
    },
  });
  const premiumPending = await prisma.payment.create({
    data: {
      tenantId: tenant.id,
      customerId: premiumCustomer.id,
      amount: 499,
      currency: "INR",
      purpose: "PREMIUM",
      provider: "RAZORPAY_TEST",
      orderId: "order_fixture_pending",
      status: "PENDING",
    },
  });
  const signReceipt = (id) => {
    const expires = Math.floor(Date.now() / 1000) + 30 * 86400;
    return `${expires}.${require("crypto").createHmac("sha256", process.env.JWT_SECRET).update(`velora-receipt:payment:${tenant.id}:${id}:${expires}`).digest("hex")}`;
  };
  fs.writeFileSync(
    "/tmp/velora-integration-fixture.json",
    JSON.stringify({
      tenantId: tenant.id,
      branchId: branch.id,
      otherBranchId: otherBranch.id,
      serviceId: haircut.id,
      spaId: spa.id,
      staffId: staff.id,
      incompatibleStaffId: incompatible.id,
      ownerEmail: owner.email,
      receptionistEmail: receptionist.email,
      password,
      slug,
      premiumPaidId: premiumPaid.id,
      premiumPendingId: premiumPending.id,
      premiumPaidReceipt: signReceipt(premiumPaid.id),
      premiumPendingReceipt: signReceipt(premiumPending.id),
    }),
  );
  console.log("Dedicated synthetic integration tenant created.");
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
