import { useCallback, useEffect, useState } from 'react';

// Light/dark theming. The active theme is reflected as a `data-theme`
// attribute on <html>, which drives the CSS custom properties in styles.css.
// The choice is persisted to localStorage and falls back to the OS preference.

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ondc-theme';

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

// Stored choice wins; otherwise mirror the OS, defaulting to dark.
export function getInitialTheme(): Theme {
  const stored = readStored();
  if (stored) return stored;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }
  return 'dark';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

// Owns the current theme for a page, applies it to <html>, and persists it.
// Each route mounts its own copy; only one page is ever live, so they stay in
// sync through the shared localStorage key + the <html> attribute.
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage may be unavailable; the in-memory theme still applies */
    }
  }, [theme]);

  const toggle = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    []
  );

  return { theme, toggle };
}
