import { PrismaClient, UserRole, OperationalStatus, AppointmentStatus, QueueStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

async function main() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/velora?schema=public',
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding Velora production database with authentic operational data...');

  // 1. Seed Features
  const featuresData = [
    { key: 'core.base', name: 'Velora Core', description: 'Salon profile, staff operational profiles, and hours' },
    { key: 'book.advance', name: 'Advance Booking', description: 'Dynamic slot availability and advance reservations' },
    { key: 'queue.live', name: 'Live Walk-in Queue', description: 'QR walk-in joining, real-time token tracking, privacy screen' },
    { key: 'flow.unified', name: 'Velora Flow', description: 'Synchronized timeline connecting bookings, walk-ins, and capacity' },
    { key: 'desk.reception', name: 'Velora Desk', description: 'High-speed reception command centre and global search' },
    { key: 'notify.whatsapp', name: 'Automated Notifications', description: 'WhatsApp and SMS booking reminders and queue ETA updates' },
    { key: 'insights.basic', name: 'Basic Insights', description: 'Daily metrics, wait times, and demand reports' },
    { key: 'insights.advanced', name: 'Advanced Insights', description: 'Customer retention, staff utilization, and peak hour forecasting' },
    { key: 'pay.deposits', name: 'Booking Deposits', description: 'Razorpay online deposits and payment protection' },
    { key: 'branch.multi', name: 'Multi-Branch', description: 'Multi-location operations and central management' },
  ];

  for (const f of featuresData) {
    await prisma.feature.upsert({
      where: { key: f.key },
      create: f,
      update: f,
    });
  }

  // 2. Seed Plans
  const startPlan = await prisma.plan.upsert({
    where: { code: 'START' },
    create: {
      code: 'START',
      name: 'Velora Start',
      description: 'Essential advance booking and customer records for boutique salons',
      monthlyPrice: 3500,
      setupPrice: 10000,
      annualPrice: 35000,
    },
    update: {},
  });

  const flowPlan = await prisma.plan.upsert({
    where: { code: 'FLOW' },
    create: {
      code: 'FLOW',
      name: 'Velora Flow',
      description: 'The flagship operating system unifying bookings, live walk-in queues, and stylist capacity',
      monthlyPrice: 5000,
      setupPrice: 15000,
      annualPrice: 50000,
    },
    update: {},
  });

  const proPlan = await prisma.plan.upsert({
    where: { code: 'PRO' },
    create: {
      code: 'PRO',
      name: 'Velora Pro',
      description: 'For busy studios requiring booking deposits, advanced analytics, and custom website',
      monthlyPrice: 8500,
      setupPrice: 20000,
      annualPrice: 85000,
    },
    update: {},
  });

  const multiPlan = await prisma.plan.upsert({
    where: { code: 'MULTI' },
    create: {
      code: 'MULTI',
      name: 'Velora Multi',
      description: 'Enterprise multi-branch management and central organizational reporting',
      monthlyPrice: 15000,
      setupPrice: 30000,
      annualPrice: 150000,
    },
    update: {},
  });

  // Map Plan Features
  const allFeatures = await prisma.feature.findMany();
  const featureMap = new Map(allFeatures.map((f) => [f.key, f.id]));

  const planFeatureMatrix = [
    { plan: startPlan, features: ['core.base', 'book.advance', 'desk.reception', 'insights.basic'] },
    { plan: flowPlan, features: ['core.base', 'book.advance', 'queue.live', 'flow.unified', 'desk.reception', 'notify.whatsapp', 'insights.basic'] },
    { plan: proPlan, features: ['core.base', 'book.advance', 'queue.live', 'flow.unified', 'desk.reception', 'notify.whatsapp', 'insights.basic', 'insights.advanced', 'pay.deposits'] },
    { plan: multiPlan, features: ['core.base', 'book.advance', 'queue.live', 'flow.unified', 'desk.reception', 'notify.whatsapp', 'insights.basic', 'insights.advanced', 'pay.deposits', 'branch.multi'] },
  ];

  for (const entry of planFeatureMatrix) {
    for (const fKey of entry.features) {
      const fId = featureMap.get(fKey);
      if (fId) {
        await prisma.planFeature.upsert({
          where: { planId_featureId: { planId: entry.plan.id, featureId: fId } },
          create: { planId: entry.plan.id, featureId: fId, enabled: true },
          update: { enabled: true },
        });
      }
    }
  }

  // 3. Seed Primary Salon Tenant: Velora Signature Studio
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'velora-signature' },
    create: {
      slug: 'velora-signature',
      name: 'Velora Signature Studio',
      status: 'ACTIVE',
    },
    update: {
      name: 'Velora Signature Studio',
      status: 'ACTIVE',
    },
  });

  await prisma.salonProfile.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      tagline: 'Smarter Booking. Smoother Flow.',
      about: 'A premier grooming and beauty sanctuary delivering tailored haircare, esthetics, and contemporary styling with zero waiting chaos.',
      logoUrl: '/images/velora-logo.svg',
      coverUrl: '/images/salon-cover.jpg',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      cancellationWindowHours: 2,
      depositType: 'NONE',
    },
    update: {
      tagline: 'Smarter Booking. Smoother Flow.',
    },
  });

  // Assign FLOW Plan Subscription
  await prisma.subscription.upsert({
    where: { id: `sub_${tenant.id}` },
    create: {
      id: `sub_${tenant.id}`,
      tenantId: tenant.id,
      planId: flowPlan.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    update: {
      status: SubscriptionStatus.ACTIVE,
    },
  });

  // 4. Seed Primary Branch
  const branch = await prisma.branch.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'saheed-nagar' } },
    create: {
      tenantId: tenant.id,
      slug: 'saheed-nagar',
      name: 'Velora Signature - Saheed Nagar',
      address: 'Plot 112, Janpath Road, Saheed Nagar',
      city: 'Bhubaneswar',
      state: 'Odisha',
      pincode: '751007',
      phone: '+919876543210',
      whatsapp: '+919876543210',
      email: 'saheednagar@velorastudio.com',
      openingTime: '09:00',
      closingTime: '21:00',
      weeklyHolidays: ['TUESDAY'],
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      active: true,
    },
    update: {
      phone: '+919876543210',
    },
  });

  // Create Branch Queue
  await prisma.queue.upsert({
    where: { branchId: branch.id },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      prefix: 'V',
      currentSequence: 3,
    },
    update: {},
  });

  // 5. Seed Users & Operational Staff
  const defaultPasswordHash = await bcrypt.hash('Velora2026!Secure', 12);

  // Owner
  await prisma.user.upsert({
    where: { email: 'sarthak@velora.com' },
    create: {
      email: 'sarthak@velora.com',
      name: 'Sarthak Tripathy',
      passwordHash: defaultPasswordHash,
      role: UserRole.SALON_OWNER,
      tenantId: tenant.id,
      branchId: branch.id,
      phone: '+919876543210',
    },
    update: {
      tenantId: tenant.id,
      branchId: branch.id,
    },
  });

  // Receptionist
  const receptionistUser = await prisma.user.upsert({
    where: { email: 'reception@velorastudio.com' },
    create: {
      email: 'reception@velorastudio.com',
      name: 'Sunita Das',
      passwordHash: defaultPasswordHash,
      role: UserRole.RECEPTIONIST,
      tenantId: tenant.id,
      branchId: branch.id,
      phone: '+919876543211',
    },
    update: {},
  });

  // Stylists
  const stylists = [
    {
      email: 'rahul@velorastudio.com',
      name: 'Rahul Sharma',
      title: 'Senior Creative Stylist',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      rating: 4.9,
      reviewCount: 142,
    },
    {
      email: 'riya@velorastudio.com',
      name: 'Riya Sen',
      title: 'Master Colorist & Spa Expert',
      photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
      rating: 4.9,
      reviewCount: 188,
    },
    {
      email: 'ananya@velorastudio.com',
      name: 'Ananya Roy',
      title: 'Senior Esthetician & Skin Specialist',
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
      rating: 4.8,
      reviewCount: 96,
    },
    {
      email: 'vikram@velorastudio.com',
      name: 'Vikram Rathore',
      title: 'Master Barber & Grooming Specialist',
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      rating: 4.9,
      reviewCount: 115,
    },
  ];

  const createdStaff: any[] = [];
  for (const s of stylists) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      create: {
        email: s.email,
        name: s.name,
        passwordHash: defaultPasswordHash,
        role: UserRole.PROFESSIONAL,
        tenantId: tenant.id,
        branchId: branch.id,
      },
      update: {},
    });

    const staffProfile = await prisma.staffProfile.upsert({
      where: { userId: user.id },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        name: s.name,
        title: s.title,
        photoUrl: s.photoUrl,
        rating: s.rating,
        reviewCount: s.reviewCount,
        operationalStatus: OperationalStatus.AVAILABLE,
      },
      update: {
        title: s.title,
        photoUrl: s.photoUrl,
        rating: s.rating,
        reviewCount: s.reviewCount,
      },
    });

    // Seed staff weekly schedule (Mon - Sat working, Tuesday closed)
    for (let day = 0; day <= 6; day++) {
      const isWorkingDay = day !== 2; // Tuesday is weekly salon holiday
      await prisma.staffSchedule.upsert({
        where: {
          staffId_branchId_dayOfWeek: {
            staffId: staffProfile.id,
            branchId: branch.id,
            dayOfWeek: day,
          },
        },
        create: {
          staffId: staffProfile.id,
          branchId: branch.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '20:30',
          isWorkingDay,
        },
        update: {
          isWorkingDay,
        },
      });
    }

    createdStaff.push(staffProfile);
  }

  // 6. Seed Service Categories & Real Services
  const categories = [
    { name: 'Hair Services', slug: 'hair', displayOrder: 1 },
    { name: 'Grooming & Shaving', slug: 'grooming', displayOrder: 2 },
    { name: 'Facial & Skin Care', slug: 'skin', displayOrder: 3 },
    { name: 'Hair Spa & Scalp Therapy', slug: 'spa', displayOrder: 4 },
  ];

  const createdCategories: any[] = [];
  for (const c of categories) {
    const cat = await prisma.serviceCategory.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: c.slug } },
      create: { tenantId: tenant.id, ...c },
      update: { displayOrder: c.displayOrder },
    });
    createdCategories.push(cat);
  }

  const servicesData = [
    {
      categorySlug: 'hair',
      name: 'Signature Precision Haircut & Styling',
      slug: 'signature-precision-haircut',
      description: 'Consultation, scalp wash, precision shear & texturizing cut, blow-dry styling.',
      price: 650,
      duration: 35,
      buffer: 5,
    },
    {
      categorySlug: 'hair',
      name: 'Balayage & Global Dimensional Colour',
      slug: 'balayage-dimensional-colour',
      description: 'Custom sun-kissed high-dimension highlights with gloss and Olaplex bond repair.',
      price: 4500,
      duration: 120,
      buffer: 15,
    },
    {
      categorySlug: 'grooming',
      name: 'Royal Beard Sculpture & Hot Towel Treatment',
      slug: 'royal-beard-sculpture',
      description: 'Razor edge contouring, botanical beard oil steam massage, and ice tonic finish.',
      price: 450,
      duration: 25,
      buffer: 5,
    },
    {
      categorySlug: 'grooming',
      name: 'Charcoal Purifying Shave',
      slug: 'charcoal-purifying-shave',
      description: 'Pre-shave eucalyptus butter, double hot towel, straight razor glide, and soothing balm.',
      price: 350,
      duration: 20,
      buffer: 5,
    },
    {
      categorySlug: 'skin',
      name: 'Hydrafacial Radiance Skin Infusion',
      slug: 'hydrafacial-radiance',
      description: 'Deep vortex pore extraction, hyaluronic acid peptide infusion, and LED phototherapy.',
      price: 3200,
      duration: 60,
      buffer: 10,
    },
    {
      categorySlug: 'skin',
      name: 'O3+ Deep Brightening Oxygen Cleanup',
      slug: 'o3-oxygen-cleanup',
      description: 'Active oxygen booster exfoliation, blackhead suction, and alginate radiance pack.',
      price: 1500,
      duration: 45,
      buffer: 5,
    },
    {
      categorySlug: 'spa',
      name: 'Kérastase Chronologiste Luxury Caviar Spa',
      slug: 'kerastase-chronologiste-spa',
      description: 'Biomimetic caviar pearl treatment rejuvenating hair fiber and balancing scalp pH.',
      price: 2400,
      duration: 60,
      buffer: 10,
    },
  ];

  const createdServices: any[] = [];
  for (const s of servicesData) {
    const cat = createdCategories.find((c) => c.slug === s.categorySlug);
    const service = await prisma.service.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: s.slug } },
      create: {
        tenantId: tenant.id,
        categoryId: cat.id,
        name: s.name,
        slug: s.slug,
        description: s.description,
        price: s.price,
        duration: s.duration,
        buffer: s.buffer,
      },
      update: {
        price: s.price,
        duration: s.duration,
      },
    });
    createdServices.push(service);
  }

  // 7. Associate Stylists with Qualified Services (Section 6 & 26)
  // Rahul Sharma: Haircuts, Beard, Colour
  // Riya Sen: Haircuts, Colour, Hair Spa
  // Ananya Roy: Facial, Skin, Hair Spa
  // Vikram Rathore: Haircut, Beard Sculpture, Charcoal Shave
  const [rahul, riya, ananya, vikram] = createdStaff;

  const staffServiceMatrix = [
    { staff: rahul, serviceSlugs: ['signature-precision-haircut', 'royal-beard-sculpture', 'balayage-dimensional-colour'] },
    { staff: riya, serviceSlugs: ['signature-precision-haircut', 'balayage-dimensional-colour', 'kerastase-chronologiste-spa'] },
    { staff: ananya, serviceSlugs: ['hydrafacial-radiance', 'o3-oxygen-cleanup', 'kerastase-chronologiste-spa'] },
    { staff: vikram, serviceSlugs: ['signature-precision-haircut', 'royal-beard-sculpture', 'charcoal-purifying-shave'] },
  ];

  for (const item of staffServiceMatrix) {
    for (const slug of item.serviceSlugs) {
      const s = createdServices.find((srv) => srv.slug === slug);
      if (s) {
        await prisma.staffService.upsert({
          where: { staffId_serviceId: { staffId: item.staff.id, serviceId: s.id } },
          create: { staffId: item.staff.id, serviceId: s.id },
          update: {},
        });
      }
    }
  }

  // 8. Seed Live Operational Queue & Today's Appointments
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date(`${todayStr}T00:00:00.000Z`);

  // Customer 1: Rohan Gupta (In service with Riya)
  const cust1 = await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId: tenant.id, phone: '+919937012345' } },
    create: {
      tenantId: tenant.id,
      name: 'Rohan Gupta',
      phone: '+919937012345',
      email: 'rohan.gupta@gmail.com',
      totalVisits: 4,
      lastVisitAt: new Date(),
    },
    update: {},
  });

  // Customer 2: Priya Patel (Waiting in queue, Token V002)
  const cust2 = await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId: tenant.id, phone: '+919861098765' } },
    create: {
      tenantId: tenant.id,
      name: 'Priya Patel',
      phone: '+919861098765',
      email: 'priya.patel@outlook.com',
      totalVisits: 2,
      lastVisitAt: new Date(),
    },
    update: {},
  });

  // Customer 3: Amit Verma (Waiting in queue, Token V003)
  const cust3 = await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId: tenant.id, phone: '+919437055443' } },
    create: {
      tenantId: tenant.id,
      name: 'Amit Verma',
      phone: '+919437055443',
      totalVisits: 1,
      lastVisitAt: new Date(),
    },
    update: {},
  });

  const haircutService = createdServices.find((s) => s.slug === 'signature-precision-haircut');
  const spaService = createdServices.find((s) => s.slug === 'kerastase-chronologiste-spa');

  const queue = await prisma.queue.findUnique({ where: { branchId: branch.id } });

  // Token V001: IN_SERVICE
  await prisma.queueEntry.upsert({
    where: { id: `entry_v001_${branch.id}` },
    create: {
      id: `entry_v001_${branch.id}`,
      tenantId: tenant.id,
      branchId: branch.id,
      queueId: queue!.id,
      customerId: cust1.id,
      staffId: riya.id,
      tokenNumber: 'V001',
      displayNumber: 1,
      serviceIds: [spaService.id],
      totalDuration: spaService.duration,
      totalBuffer: spaService.buffer,
      status: QueueStatus.IN_SERVICE,
      position: 1,
      estimatedWaitMinutes: 0,
      serviceStartAt: new Date(Date.now() - 20 * 60 * 1000),
      checkInAt: new Date(Date.now() - 25 * 60 * 1000),
    },
    update: {},
  });

  // Mark Riya as BUSY
  await prisma.staffProfile.update({
    where: { id: riya.id },
    data: { operationalStatus: OperationalStatus.BUSY },
  });

  // Token V002: WAITING
  await prisma.queueEntry.upsert({
    where: { id: `entry_v002_${branch.id}` },
    create: {
      id: `entry_v002_${branch.id}`,
      tenantId: tenant.id,
      branchId: branch.id,
      queueId: queue!.id,
      customerId: cust2.id,
      staffId: rahul.id,
      tokenNumber: 'V002',
      displayNumber: 2,
      serviceIds: [haircutService.id],
      totalDuration: haircutService.duration,
      totalBuffer: haircutService.buffer,
      status: QueueStatus.WAITING,
      position: 2,
      estimatedWaitMinutes: 15,
      checkInAt: new Date(Date.now() - 10 * 60 * 1000),
    },
    update: {},
  });

  // Token V003: WAITING
  await prisma.queueEntry.upsert({
    where: { id: `entry_v003_${branch.id}` },
    create: {
      id: `entry_v003_${branch.id}`,
      tenantId: tenant.id,
      branchId: branch.id,
      queueId: queue!.id,
      customerId: cust3.id,
      staffId: null, // Any Available
      tokenNumber: 'V003',
      displayNumber: 3,
      serviceIds: [haircutService.id],
      totalDuration: haircutService.duration,
      totalBuffer: haircutService.buffer,
      status: QueueStatus.WAITING,
      position: 3,
      estimatedWaitMinutes: 30,
      checkInAt: new Date(Date.now() - 5 * 60 * 1000),
    },
    update: {},
  });

  // Advance Booking for later today: 16:00
  const apptStartTime = new Date(`${todayStr}T16:00:00.000Z`);
  const apptEndTime = new Date(apptStartTime.getTime() + 40 * 60 * 1000);

  await prisma.appointment.upsert({
    where: { id: `appt_seed_${branch.id}` },
    create: {
      id: `appt_seed_${branch.id}`,
      tenantId: tenant.id,
      branchId: branch.id,
      customerId: cust2.id,
      staffId: rahul.id,
      date: today,
      startTime: apptStartTime,
      endTime: apptEndTime,
      totalDuration: 35,
      totalBuffer: 5,
      totalPrice: 650,
      status: AppointmentStatus.CONFIRMED,
      services: {
        create: [
          {
            serviceId: haircutService.id,
            price: haircutService.price,
            duration: haircutService.duration,
            buffer: haircutService.buffer,
          },
        ],
      },
    },
    update: {},
  });

  console.log('✅ Velora production seed completed successfully!');
  console.log('Tenant Slug: velora-signature');
  console.log('Admin Account: sarthak@velora.com / Velora2026!Secure');
  console.log('Receptionist Account: reception@velorastudio.com / Velora2026!Secure');

  await pool.end();
}

main().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
