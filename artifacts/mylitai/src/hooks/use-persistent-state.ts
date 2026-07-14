import { useEffect, useRef, useState } from 'react';

const PREFIX = 'mylitai.draft.';

/**
 * Drop-in replacement for useState that transparently persists the value to
 * localStorage, so a practitioner's in-progress inputs survive a page reload,
 * a lunch break, or returning the next morning. Scoped by a stable key.
 */
export function usePersistentState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const storageKey = PREFIX + key;
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  const isFirst = useRef(true);
  useEffect(() => {
    // Avoid an unnecessary write on first mount
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* ignore quota / serialization errors */
    }
  }, [storageKey, value]);

  return [value, setValue];
}

/** Clear a persisted draft (e.g. after the user resets a tool). */
export function clearPersistentState(key: string) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/**
 * Wipe ALL persisted in-progress drafts. Called on login/logout so that on a
 * shared device one practitioner can never inherit another's draft inputs or
 * outputs (client confidentiality). Saved work itself lives server-side, scoped
 * to the access code, and is unaffected.
 */
export function clearAllDrafts() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
