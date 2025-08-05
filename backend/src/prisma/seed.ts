import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create subscription plans
  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'Free' },
    update: {},
    create: {
      name: 'Free',
      deviceLimit: 1,
      durationDays: 30,
      price: 0,
      description: 'Free plan with 1 device for 30 days',
      isActive: true,
    },
  });

  const basicPlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'Basic' },
    update: {},
    create: {
      name: 'Basic',
      deviceLimit: 5,
      durationDays: 30,
      price: 299.99,
      description: 'Basic plan with 5 devices for 30 days',
      isActive: true,
    },
  });

  const premiumPlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'Premium' },
    update: {},
    create: {
      name: 'Premium',
      deviceLimit: 20,
      durationDays: 30,
      price: 799.99,
      description: 'Premium plan with 20 devices for 30 days',
      isActive: true,
    },
  });

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@traccar.com' },
    update: {},
    create: {
      email: 'admin@traccar.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  // Create test user with free subscription
  const testUserPassword = await bcrypt.hash('user123', 10);
  const testUser = await prisma.user.upsert({
    where: { email: 'user@test.com' },
    update: {},
    create: {
      email: 'user@test.com',
      password: testUserPassword,
      name: 'Test User',
      role: 'USER',
    },
  });

  // Create subscription for test user
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  await prisma.subscription.upsert({
    where: { userId: testUser.id },
    update: {},
    create: {
      userId: testUser.id,
      planId: freePlan.id,
      status: 'ACTIVE',
      endDate: endDate,
    },
  });

  // Create default settings
  const defaultSettings = [
    { key: 'TRACCAR_URL', value: 'http://localhost:8082' },
    { key: 'TRACCAR_USER', value: 'admin' },
    { key: 'TRACCAR_PASS', value: 'admin' },
    { key: 'TELEBIRR_MODE', value: 'sandbox' },
    { key: 'EMAIL_NOTIFICATIONS', value: 'true' },
  ];

  for (const setting of defaultSettings) {
    await prisma.settings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log('✅ Database seeded successfully!');
  console.log('📧 Admin: admin@traccar.com / admin123');
  console.log('👤 Test User: user@test.com / user123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });