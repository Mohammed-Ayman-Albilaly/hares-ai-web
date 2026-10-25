import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { session as defaultSession, type Session, type SessionState } from './session';

const SessionContext = createContext<Session>(defaultSession);

/** Starts the silent refresh on mount, before any guarded route renders. */
export function AuthProvider({ children, session = defaultSession }: { children: ReactNode; session?: Session }) {
  useEffect(() => {
    void session.boot();
  }, [session]);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  return useContext(SessionContext);
}

/** The current session state (re-renders on change). */
export function useAuth(): SessionState {
  const s = useSession();
  return useSyncExternalStore(s.subscribe, s.getSnapshot, s.getSnapshot);
}
