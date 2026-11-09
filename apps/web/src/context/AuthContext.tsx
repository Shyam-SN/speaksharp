import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isConfigured } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  token: string | null;
  isDemo: boolean;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInAsDemo: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER: User = {
  id: 'demo-user-default',
  app_metadata: { provider: 'anonymous' },
  user_metadata: { name: 'Demo Speaker' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check if demo user flag was saved
    const storedDemo = localStorage.getItem('speaksharp_demo_mode');
    if (storedDemo === 'true') {
      setUser(DEMO_USER);
      setToken('demo-token');
      api.setToken('demo-token');
      setIsDemo(true);
      setLoading(false);
      return;
    }

    if (!isConfigured) {
      // Default to demo mode if Supabase cloud keys not configured
      setUser(DEMO_USER);
      setToken('demo-token');
      api.setToken('demo-token');
      setIsDemo(true);
      setLoading(false);
      return;
    }

    // Initialize Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      const jwt = session?.access_token ?? null;
      setToken(jwt);
      api.setToken(jwt);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      const jwt = session?.access_token ?? null;
      setToken(jwt);
      api.setToken(jwt);
      setIsDemo(false);
      localStorage.removeItem('speaksharp_demo_mode');
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string) => {
    if (!isConfigured) {
      signInAsDemo();
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    if (!isConfigured) {
      signInAsDemo();
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error: error as Error | null };
  };

  const signInAsDemo = () => {
    localStorage.setItem('speaksharp_demo_mode', 'true');
    setUser(DEMO_USER);
    setToken('demo-token');
    api.setToken('demo-token');
    setIsDemo(true);
    setLoading(false);
  };

  const signOut = async () => {
    localStorage.removeItem('speaksharp_demo_mode');
    setIsDemo(false);
    setUser(null);
    setSession(null);
    setToken(null);
    api.setToken(null);
    if (isConfigured) {
      await supabase.auth.signOut();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        token,
        isDemo,
        loading,
        signInWithEmail,
        signInWithGoogle,
        signInAsDemo,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

