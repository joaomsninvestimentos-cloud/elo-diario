import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, cloudConfigured } from './supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  cloud: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirm: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(cloudConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      cloud: cloudConfigured,
      async signIn(email, password) {
        if (!supabase) throw new Error('Nuvem não configurada.');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(traduzErro(error.message));
      },
      async signUp(email, password) {
        if (!supabase) throw new Error('Nuvem não configurada.');
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(traduzErro(error.message));
        return { needsConfirm: !data.session };
      },
      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const traduzErro = (message: string): string => {
  const map: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
    'User already registered': 'Este e-mail já tem conta. Faça login.',
    'Password should be at least 6 characters':
      'A senha precisa ter pelo menos 6 caracteres.',
    'Failed to fetch': 'Sem conexão com a nuvem. Verifique a internet.',
  };
  return map[message] ?? message;
};

export const useAuth = (): AuthState => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return context;
};
