// Pure functions shared by components and tests. Functions used inside
// gesture callbacks carry the 'worklet' directive so they can run on the UI thread.

export function clamp(v: number, lo: number, hi: number): number {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
}

/** Convert a horizontal position inside a track to a stepped value. `rtl` mirrors the track. */
export function sliderValue(x: number, width: number, min: number, max: number, step: number, rtl = false): number {
  'worklet';
  if (width <= 0) return min;
  const ratio = clamp(x / width, 0, 1);
  const raw = min + (rtl ? 1 - ratio : ratio) * (max - min);
  return clamp(Math.round(raw / step) * step, min, max);
}

/** Which onboarding page a swipe should settle on, from drag distance and fling velocity. */
export function settlePage(index: number, translationX: number, velocityX: number, width: number, count: number, rtl = false): number {
  'worklet';
  const dir = rtl ? -1 : 1;
  const travelled = (-translationX * dir) / width;
  const flung = Math.abs(velocityX) > 600 ? (-Math.sign(velocityX) * dir) * 0.5 : 0;
  return clamp(Math.round(index + travelled + flung), 0, count - 1);
}

/** Point on the day arc for an hour: 06:00 at the left end, 20:00 at the right. */
export function arcPoint(hour: number, box: { cx: number; cy: number; r: number }) {
  const p = clamp((hour - 6) / 14, 0, 1);
  const a = Math.PI * (1 - p);
  return { x: box.cx + box.r * Math.cos(a), y: box.cy - box.r * Math.sin(a), daylight: hour >= 6 && hour <= 20, progress: p };
}

export type Snapshot = { hour: number; battery: number; solarKw: number; homeKw: number; gridKw: number; state: 'charging' | 'discharging' | 'idle' };

/** Deterministic household snapshot for an hour of the day. Replace with a real API. */
export function snapshot(hour: number, reservePct = 30): Snapshot {
  const sun = Math.max(0, Math.sin(((hour - 6) / 13) * Math.PI));
  const solarKw = hour < 6 || hour > 19 ? 0 : Math.round(4.8 * sun ** 1.6 * 10) / 10;
  const homeKw = Math.round((0.35 + 0.9 * Math.exp(-((hour - 7.5) ** 2) / 2.2) + 2.1 * Math.exp(-((hour - 19) ** 2) / 4.5)) * 10) / 10;
  const base = hour < 6 ? 34 - hour : hour < 14 ? 28 + (hour - 6) * 9 : 100 - (hour - 14) * 7;
  const battery = Math.round(clamp(base, reservePct, 100));
  const net = solarKw - homeKw;
  const state = net > 0.15 && battery < 100 ? 'charging' : net < -0.15 && battery > reservePct ? 'discharging' : 'idle';
  const gridKw = state === 'idle' && net < 0 ? Math.round(-net * 10) / 10 : 0;
  return { hour, battery, solarKw, homeKw, gridKw, state };
}

export const clock = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;

export type Device = { id: string; kind: string; name: string; location: string; status: 'online' | 'offline' | 'attention'; firmware: string };

export const DEVICES: Device[] = [
  { id: 'cell-1', kind: 'battery', name: 'Haldora Cell', location: 'Garage', status: 'online', firmware: '2.4.1' },
  { id: 'sense-1', kind: 'plug', name: 'Haldora Sense', location: 'Fuse board', status: 'online', firmware: '1.9.0' },
  { id: 'ev-1', kind: 'car', name: 'Car charger', location: 'Driveway', status: 'attention', firmware: '3.0.2' },
];
