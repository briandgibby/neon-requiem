import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../lib/api';

export const useSocket = (token?: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const socket = io(API_BASE_URL, {
      auth: { token },
      reconnectionAttempts: 5,
    });

    const handleConnect = () => {
      setSocket(socket);
      setIsConnected(true);
      console.log('Connected to game server');
    };

    const handleDisconnect = () => {
      setSocket(null);
      setIsConnected(false);
      console.log('Disconnected from game server');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.disconnect();
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [token]);

  return { socket, isConnected };
};
