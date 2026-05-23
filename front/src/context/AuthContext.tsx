import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { authFetch, setToken, clearToken, getToken } from '../utils/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  register: (username: string, password: string, displayName: string, avatarTitle: string) => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await authFetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.data);
      } else {
        clearToken();
      }
    } catch {
      clearToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (username: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!data.success) return data.error;
      setToken(data.data.token);
      setUser(data.data.user);
      return null;
    } catch {
      return "网络异常，无法登殿。";
    }
  };

  const register = async (username: string, password: string, displayName: string, avatarTitle: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, displayName, avatarTitle }),
      });
      const data = await res.json();
      if (!data.success) return data.error;
      setToken(data.data.token);
      setUser(data.data.user);
      return null;
    } catch {
      return "网络异常，无法注册。";
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
