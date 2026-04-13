import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      if (!session) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const me = await api('/me');
        if (!cancelled) setProfile(me.profile);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    setLoading(true);
    loadProfile();
    return () => { cancelled = true; };
  }, [session]);

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signUp = (email, password) => supabase.auth.signUp({ email, password });
  const signOut = () => supabase.auth.signOut();

  async function bootstrapProfile(payload) {
    const created = await api('/me/bootstrap', { method: 'POST', body: payload });
    setProfile(created);
    return created;
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, signIn, signUp, signOut, bootstrapProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
