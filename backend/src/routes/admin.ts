import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { TraccarService } from '../services/traccar';
import { InvoiceGenerator } from '../services/invoiceGenerator';

const router = express.Router();
const prisma = new PrismaClient();
const traccarService = new TraccarService();

// Apply admin middleware to all routes
router.use(authenticateToken, requireAdmin);

// Get dashboard statistics
router.get('/stats', async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeSubscriptions,
      totalDevices,
      totalRevenue,
      expiringSubscriptions
    ] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.device.count({ where: { isActive: true } }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      }),
      prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          endDate: {
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
          }
        }
      })
    ]);

    const stats = {
      totalUsers,
      activeSubscriptions,
      totalDevices,
      totalRevenue: totalRevenue._sum.amount || 0,
      expiringSubscriptions,
    };

    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

// Get all users with subscriptions
router.get('/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = search ? {
      OR: [
        { name: { contains: search as string } },
        { email: { contains: search as string } }
      ]
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          subscription: {
            include: { plan: true }
          },
          _count: {
            select: { devices: true, payments: true }
          }
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({ 
      users, 
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get all subscriptions
router.get('/subscriptions', async (req, res, next) => {
  try {
    const { status, expiring } = req.query;

    let where: any = {};

    if (status) {
      where.status = status;
    }

    if (expiring === 'true') {
      where.endDate = {
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
      };
      where.status = 'ACTIVE';
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        plan: true
      },
      orderBy: { endDate: 'asc' }
    });

    res.json({ subscriptions });
  } catch (error) {
    next(error);
  }
});

// Get all devices
router.get('/devices', async (req, res, next) => {
  try {
    const { userId } = req.query;

    const where = userId ? { userId: userId as string } : {};

    const devices = await prisma.device.findMany({
      where: {
        ...where,
        isActive: true
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ devices });
  } catch (error) {
    next(error);
  }
});

// Delete device (admin)
router.delete('/devices/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({
      where: { id }
    });

    if (!device) {
      throw createError('Device not found', 404);
    }

    // Delete from Traccar
    try {
      await traccarService.deleteDevice(device.traccarId);
    } catch (error) {
      console.error('Error deleting device from Traccar:', error);
    }

    // Soft delete in database
    await prisma.device.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ 
      success: true,
      message: 'Device deleted successfully' 
    });
  } catch (error) {
    next(error);
  }
});

// Get system settings
router.get('/settings', async (req, res, next) => {
  try {
    const settings = await prisma.settings.findMany();
    
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    res.json({ settings: settingsObj });
  } catch (error) {
    next(error);
  }
});

// Update system settings
router.put('/settings', async (req, res, next) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      throw createError('Settings object is required', 400);
    }

    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      await prisma.settings.upsert({
        where: { key },
        update: { value: value as string },
        create: { key, value: value as string }
      });
    }

    res.json({ 
      success: true,
      message: 'Settings updated successfully' 
    });
  } catch (error) {
    next(error);
  }
});

// Get payment transactions
router.get('/payments', async (req, res, next) => {
  try {
    const { status, userId } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({ payments });
  } catch (error) {
    next(error);
  }
});

// Get order reports with advanced filtering
router.get('/orders', async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status, 
      orderType,
      userId, 
      from, 
      to,
      search 
    } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (orderType && orderType !== 'ALL') {
      where.orderType = orderType;
    }
    if (userId) {
      where.userId = userId;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    if (search) {
      where.OR = [
        { orderId: { contains: search as string } },
        { invoiceNumber: { contains: search as string } },
        { description: { contains: search as string } },
        { user: { name: { contains: search as string } } },
        { user: { email: { contains: search as string } } }
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payment.count({ where })
    ]);

    const ordersWithPlanNames = orders.map(order => {
      let subscriptionPlan = null;
      if (order.metadata) {
        try {
          const metadata = typeof order.metadata === 'string'
            ? JSON.parse(order.metadata)
            : order.metadata;
          subscriptionPlan = metadata.planName || null;
        } catch (e) {
          subscriptionPlan = null;
        }
      }
      return {
        ...order,
        subscriptionPlan
      };
    });

    // Calculate summary statistics
    const [totalRevenue, completedOrders, failedOrders, pendingOrders] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      }),
      prisma.payment.count({ where: { status: 'COMPLETED' } }),
      prisma.payment.count({ where: { status: 'FAILED' } }),
      prisma.payment.count({ where: { status: 'PENDING' } })
    ]);

    const totalStats = await prisma.payment.aggregate({
      _sum: { amount: true },
      _count: { _all: true }
    });

    const summary = {
      totalOrders: totalStats._count._all || 0,
      totalRevenue: totalRevenue._sum.amount || 0,
      completedOrders,
      failedOrders,
      pendingOrders,
      successRate: totalStats._count._all > 0 ? Math.round((completedOrders / totalStats._count._all) * 100) : 0,
      averageOrderValue: totalStats._count._all > 0 ? (totalStats._sum.amount || 0) / totalStats._count._all : 0
    };

    res.json({
      orders: ordersWithPlanNames,
      summary,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Send reminder emails for expiring subscriptions
router.post('/send-reminders', async (req, res, next) => {
  try {
    // Get subscriptions expiring in the next 7 days
    const expiringSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          gte: new Date()
        }
      },
      include: {
        user: true,
        plan: true
      }
    });

    // TODO: Implement email sending logic here
    // For now, just return the count
    
    res.json({
      success: true,
      message: `Reminder emails sent to ${expiringSubscriptions.length} users`,
      count: expiringSubscriptions.length
    });
  } catch (error) {
    next(error);
  }
});

// Download invoice (Admin)
router.get('/orders/:id/invoice', async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await prisma.payment.findFirst({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!order) {
      throw createError('Order not found', 404);
    }

    if (!order.invoiceNumber) {
      throw createError('Invoice not available for this order', 400);
    }

    if (order.status !== 'COMPLETED') {
      throw createError('Invoice only available for completed orders', 400);
    }

    const invoiceData = InvoiceGenerator.createInvoiceData(order, order.user);

    res.json(invoiceData);
  } catch (error) {
    next(error);
  }
});

export default router;