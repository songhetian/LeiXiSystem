import { io } from 'socket.io-client';
import { getApiBaseUrl } from './apiConfig';

let socket;

export const connectSocket = (userId, token) => {
  if (socket && socket.connected) {
    console.log('Socket already connected.');
    return;
  }

  const serverUrl = getApiBaseUrl().replace('/api', '');
  socket = io(serverUrl, {
    query: { userId, token },
    transports: ['websocket'], // Force WebSocket
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    // Emit user online status
    socket.emit('user:online', userId);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('Socket reconnected after', attemptNumber, 'attempts');
    socket.emit('user:online', userId); // Re-emit online status on reconnect
  });

  socket.on('reconnect_error', (error) => {
    console.error('Socket reconnection error:', error);
  });

  socket.on('reconnect_failed', () => {
    console.error('Socket reconnection failed permanently.');
  });
};

export const disconnectSocket = () => {
  if (socket) {
    console.log('Disconnecting socket...');
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export const emitSocketEvent = (event, data) => {
  if (socket && socket.connected) {
    socket.emit(event, data);
  } else {
    console.warn('Socket not connected, cannot emit event:', event, data);
  }
};

export const listenSocketEvent = (event, handler) => {
  if (socket) {
    socket.on(event, handler);
  } else {
    console.warn('Socket not initialized, cannot listen to event:', event);
  }
};

export const removeSocketListener = (event, handler) => {
  if (socket) {
    socket.off(event, handler);
  }
};
