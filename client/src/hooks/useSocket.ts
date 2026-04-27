import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (token?: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const socket = io('http://localhost:3000', {
      auth: { token },
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to game server');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from game server');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return { socket: socketRef.current, isConnected };
};
