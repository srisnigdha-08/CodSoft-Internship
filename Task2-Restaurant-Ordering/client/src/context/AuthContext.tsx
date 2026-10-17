import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<User>;
  logout: () => Promise<void>;
  quickLogin: (role: Role) => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const currentUser = await api.getMe();
        setUser(currentUser);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.login({ email, password });
    setUser(data.user);
    return data.user;
  };

  const register = async (userData: { name: string; email: string; password: string; phone?: string }) => {
    const data = await api.register(userData);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  const quickLogin = async (role: Role) => {
    let email = 'customer@dinedesk.local';
    let password = 'Customer@12345';

    if (role === 'KITCHEN_STAFF') {
      email = 'kitchen@dinedesk.local';
      password = 'Kitchen@12345';
    } else if (role === 'ADMIN') {
      email = 'admin@dinedesk.local';
      password = 'Admin@12345';
    }

    return login(email, password);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, quickLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
