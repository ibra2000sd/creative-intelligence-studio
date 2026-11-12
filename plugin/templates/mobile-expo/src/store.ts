// A small external store. Screens subscribe with useStore(selector).
import { useSyncExternalStore } from 'react';

export type Locale = 'en' | 'ar';
export type State = { onboarded: boolean; locale: Locale; reserve: number; alerts: boolean; online: boolean; hour: number };

const initial: State = { onboarded: false, locale: 'en', reserve: 30, alerts: true, online: true, hour: 13 };
let state: State = { ...initial };
const listeners = new Set<() => void>();

export const store = {
  get: () => state,
  set(patch: Partial<State>) {
    const next = { ...state, ...patch };
    if (Object.keys(patch).every((k) => state[k as keyof State] === next[k as keyof State])) return;
    state = next;
    listeners.forEach((l) => l());
  },
  reset: () => store.set({ ...initial }),
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(state), () => selector(state));
}
