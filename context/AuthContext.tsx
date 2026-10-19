import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  userId: string | null;
  email: string | null;
  isLoading: boolean;
  /** Devuelven null si salió bien o el mensaje de error para mostrar en pantalla. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Sesión guardada en SecureStore (si la hay) antes de decidir qué pantallas mostrar
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setIsLoading(false));

    // Login, logout y refresco del token: Stack.Protected reacciona al cambio de session
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? error.message : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return error ? error.message : null;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
      isLoading,
      signIn,
      signUp,
      signOut,
    }),
    [session, isLoading, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return context;
}
