import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = express.Router();
const prisma = new PrismaClient();

// Get user profile
router.get('/profile', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      }
    });

    if (!user) {
      throw createError('User not found', 404);
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { name, email } = req.body;

    if (!name && !email) {
      throw createError('At least one field (name or email) is required', 400);
    }

    // If email is being updated, check if it's already taken
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: { 
          email,
          NOT: { id: req.user!.id }
        }
      });

      if (existingUser) {
        throw createError('Email already in use', 409);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      }
    });

    res.json({ 
      success: true,
      user: updatedUser,
      message: 'Profile updated successfully' 
    });

  } catch (error) {
    next(error);
  }
});

// Change password
router.put('/password', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw createError('Current password and new password are required', 400);
    }

    if (newPassword.length < 6) {
      throw createError('New password must be at least 6 characters long', 400);
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    if (!user) {
      throw createError('User not found', 404);
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw createError('Current password is incorrect', 401);
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashedNewPassword }
    });

    res.json({ 
      success: true,
      message: 'Password changed successfully' 
    });

  } catch (error) {
    next(error);
  }
});

// Get user statistics
router.get('/stats', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    // Get device count
    const deviceCount = await prisma.device.count({
      where: { 
        userId,
        isActive: true 
      }
    });

    // Get payment count
    const paymentCount = await prisma.payment.count({
      where: { userId }
    });

    // Get successful payments total
    const successfulPayments = await prisma.payment.aggregate({
      where: { 
        userId,
        status: 'COMPLETED'
      },
      _sum: { amount: true },
      _count: true
    });

    // Get subscription info
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true }
    });

    const stats = {
      deviceCount,
      totalPayments: paymentCount,
      successfulPayments: successfulPayments._count || 0,
      totalSpent: successfulPayments._sum.amount || 0,
      currentPlan: subscription?.plan.name || 'No Plan',
      subscriptionStatus: subscription?.status || 'INACTIVE',
      memberSince: req.user!.createdAt,
    };

    res.json({ stats });

  } catch (error) {
    next(error);
  }
});

// Delete user account
router.delete('/account', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      throw createError('Password confirmation is required', 400);
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    if (!user) {
      throw createError('User not found', 404);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw createError('Password is incorrect', 401);
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: req.user!.id }
    });

    res.json({ 
      success: true,
      message: 'Account deleted successfully' 
    });

  } catch (error) {
    next(error);
  }
});

export default router;