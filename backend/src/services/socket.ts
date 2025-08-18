import { Server } from 'socket.io';
import WebSocket from 'ws';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

/**
 * Socket.IO Service for Real-time Updates
 * 
 * Features:
 * - Real-time device location updates
 * - Subscription status changes
 * - Payment notifications
 * - Admin dashboard updates
 */
export function initializeSocket(io: Server) {
  console.log('🔌 Initializing Socket.IO service...');

  // Authentication middleware
  io.use(async (socket: any, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, role: true }
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user.id;
      socket.userRole = user.role;
      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  // Handle client connections
  io.on('connection', (socket: any) => {
    console.log(`👤 User ${socket.userId} connected`);

    // Join user-specific room
    socket.join(`user:${socket.userId}`);
    
    // Join admin room if user is admin
    if (socket.userRole === 'ADMIN') {
      socket.join('admin');
    }

    // Handle device tracking subscription
    socket.on('subscribe:devices', async (deviceIds: string[]) => {
      try {
        // Verify user owns these devices
        const userDevices = await prisma.device.findMany({
          where: {
            userId: socket.userId,
            id: { in: deviceIds },
            isActive: true
          }
        });

        // Join device-specific rooms
        userDevices.forEach(device => {
          socket.join(`device:${device.id}`);
        });

        socket.emit('devices:subscribed', userDevices.map(d => d.id));
      } catch (error) {
        socket.emit('error', { message: 'Failed to subscribe to devices' });
      }
    });

    // Handle device tracking unsubscription
    socket.on('unsubscribe:devices', (deviceIds: string[]) => {
      deviceIds.forEach(deviceId => {
        socket.leave(`device:${deviceId}`);
      });
      socket.emit('devices:unsubscribed', deviceIds);
    });

    // Handle admin dashboard subscription
    socket.on('subscribe:admin', () => {
      if (socket.userRole === 'ADMIN') {
        socket.join('admin:dashboard');
        socket.emit('admin:subscribed');
      } else {
        socket.emit('error', { message: 'Admin access required' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`👤 User ${socket.userId} disconnected`);
    });
  });

  // Start Traccar WebSocket connection for real-time updates
  startTraccarWebSocket(io);

  return io;
}

/**
 * Connect to Traccar WebSocket for real-time position updates
 */
function startTraccarWebSocket(io: Server) {
  const traccarUrl = process.env.TRACCAR_URL || 'http://localhost:8082';
  const wsUrl = traccarUrl.replace('http', 'ws') + '/api/socket';
  
  console.log('🛰️ Connecting to Traccar WebSocket:', wsUrl);

  const ws = new WebSocket(wsUrl, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(
        `${process.env.TRACCAR_USER}:${process.env.TRACCAR_PASS}`
      ).toString('base64')
    }
  });

  ws.on('open', () => {
    console.log('✅ Connected to Traccar WebSocket');
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.positions) {
        // Handle position updates
        for (const position of message.positions) {
          await handlePositionUpdate(io, position);
        }
      }

      if (message.devices) {
        // Handle device updates
        for (const device of message.devices) {
          await handleDeviceUpdate(io, device);
        }
      }
    } catch (error) {
      console.error('❌ Error processing Traccar message:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ Traccar WebSocket error:', error.message);
    // Don't flood console with full error stack
  });

  ws.on('close', () => {
    console.log('🔌 Traccar WebSocket connection closed, attempting to reconnect...');
    
    // Reconnect after 30 seconds to avoid spam
    setTimeout(() => {
      startTraccarWebSocket(io);
    }, 30000);
  });
}

/**
 * Handle position updates from Traccar
 */
async function handlePositionUpdate(io: Server, position: any) {
  try {
    // Find device in our database
    const device = await prisma.device.findUnique({
      where: { traccarId: position.deviceId }
    });

    if (!device) return;

    // Update device position in database
    await prisma.device.update({
      where: { id: device.id },
      data: {
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        course: position.course,
        lastUpdate: new Date(position.fixTime),
      }
    });

    // Emit to device subscribers
    io.to(`device:${device.id}`).emit('position:update', {
      deviceId: device.id,
      position: {
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        course: position.course,
        timestamp: position.fixTime,
        attributes: position.attributes,
      }
    });

    // Emit to user
    io.to(`user:${device.userId}`).emit('device:position', {
      deviceId: device.id,
      position
    });

  } catch (error) {
    console.error('❌ Error handling position update:', error);
  }
}

/**
 * Handle device updates from Traccar
 */
async function handleDeviceUpdate(io: Server, traccarDevice: any) {
  try {
    // Find device in our database
    const device = await prisma.device.findUnique({
      where: { traccarId: traccarDevice.id }
    });

    if (!device) return;

    // Emit device status update
    io.to(`user:${device.userId}`).emit('device:status', {
      deviceId: device.id,
      status: traccarDevice.status,
      lastUpdate: traccarDevice.lastUpdate,
    });

    // Emit to admin dashboard
    io.to('admin:dashboard').emit('device:update', {
      deviceId: device.id,
      traccarDevice,
    });

  } catch (error) {
    console.error('❌ Error handling device update:', error);
  }
}

/**
 * Emit subscription update to user
 */
export function emitSubscriptionUpdate(io: Server, userId: string, subscription: any) {
  io.to(`user:${userId}`).emit('subscription:update', subscription);
  io.to('admin:dashboard').emit('subscription:change', { userId, subscription });
}

/**
 * Emit payment update to user
 */
export function emitPaymentUpdate(io: Server, userId: string, payment: any) {
  io.to(`user:${userId}`).emit('payment:update', payment);
  io.to('admin:dashboard').emit('payment:change', { userId, payment });
}