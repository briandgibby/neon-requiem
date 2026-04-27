import { useState, useEffect } from 'react';

interface User {
  id: string;
  username: string;
}

export const useAuth = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('nr_token'));
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('nr_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const response = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      const error: any = new Error(data.error || 'Login failed');
      error.details = data.details;
      throw error;
    }

    const userData = { id: data.accountId, username: data.username };
    setToken(data.token);
    setUser(userData);
    localStorage.setItem('nr_token', data.token);
    localStorage.setItem('nr_user', JSON.stringify(userData));
  };

  const register = async (username: string, email: string, password: string) => {
    const response = await fetch('http://localhost:3000/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      const error: any = new Error(data.error || 'Registration failed');
      error.details = data.details;
      throw error;
    }

    const userData = { id: data.accountId, username: data.username };
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

  return { token, user, login, register, logout, isLoading };
};
