import { useState } from 'react';
import { ApiRequestError, apiUrl } from '../lib/api';

interface User {
  id: string;
  username: string;
  isAdmin: boolean;
}

interface AuthResponse {
  token: string;
  accountId: string;
  username: string;
  isAdmin?: boolean;
  error?: string;
  details?: { fieldErrors?: Record<string, string[]> };
}

function readStoredUser(): User | null {
  const storedUser = localStorage.getItem('nr_user');
  if (!storedUser) return null;

  try {
    const parsed = JSON.parse(storedUser) as Partial<User>;
    if (typeof parsed.id !== 'string' || typeof parsed.username !== 'string') return null;
    return { id: parsed.id, username: parsed.username, isAdmin: parsed.isAdmin === true };
  } catch {
    return null;
  }
}

export const useAuth = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('nr_token'));
  const [user, setUser] = useState<User | null>(readStoredUser);

  const login = async (username: string, password: string) => {
    const response = await fetch(apiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json() as AuthResponse;
    if (!response.ok) {
      throw new ApiRequestError(data.error || 'Login failed', data.details);
    }

    const userData = { id: data.accountId, username: data.username, isAdmin: data.isAdmin === true };
    setToken(data.token);
    setUser(userData);
    localStorage.setItem('nr_token', data.token);
    localStorage.setItem('nr_user', JSON.stringify(userData));
  };

  const register = async (username: string, email: string, password: string) => {
    const response = await fetch(apiUrl('/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json() as AuthResponse;
    if (!response.ok) {
      throw new ApiRequestError(data.error || 'Registration failed', data.details);
    }

    const userData = { id: data.accountId, username: data.username, isAdmin: data.isAdmin === true };
    setToken(data.token);
    setUser(userData);
    localStorage.setItem('nr_token', data.token);
    localStorage.setItem('nr_user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('nr_token');
    localStorage.removeItem('nr_user');
  };

  return { token, user, login, register, logout, isLoading: false };
};
