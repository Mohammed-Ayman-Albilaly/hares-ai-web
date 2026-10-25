import { createContext, useContext } from 'react';

interface Shell {
  /** Open the navigation drawer (phones). */
  openMenu: () => void;
}

export const ShellContext = createContext<Shell>({ openMenu: () => undefined });
export const useShell = (): Shell => useContext(ShellContext);
