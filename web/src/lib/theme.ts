import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'hares.theme';
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage blocked */
  }
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let current: Theme = read();

export function applyTheme(theme: Theme): void {
  current = theme;
  document.documentElement.setAttribute('data-theme', theme);
  listeners.forEach((l) => l());
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* the choice just will not persist */
  }
  applyTheme(theme);
}

export function initTheme(): void {
  applyTheme(read());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => 'light' as Theme,
  );
}
