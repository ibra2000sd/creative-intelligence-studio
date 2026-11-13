// Mock API with realistic latency and failure modes. Replace with real
// requests; the screens already handle loading, empty and error results.
// ?scenario=slow | error | empty | save-error exercises each state.
import { dayCurve, history } from './logic.js';

const scenario = () => new URLSearchParams(location.search).get('scenario') || '';
const wait = (ms) => new Promise((r) => setTimeout(r, scenario() === 'slow' ? ms * 6 : ms));
let attempts = 0;

export async function fetchDay(seed = 1, reserve = 30) {
  await wait(220);
  return dayCurve(seed, { reserve: reserve / 100 });
}

export async function fetchDevices() {
  await wait(420);
  attempts++;
  // "error" fails the first request only, so the retry path can be exercised end to end.
  if (scenario() === 'error' && attempts === 1) throw new Error('network');
  if (scenario() === 'empty') return [];
  return [
    { id: 'cell-1', kind: 'battery', name: 'Haldora Cell', location: 'Garage', status: 'online', firmware: '2.4.1', serial: 'HC-0193-2291', lastSeen: '2026-11-13T13:02:00Z' },
    { id: 'sense-1', kind: 'plug', name: 'Haldora Sense', location: 'Fuse board', status: 'online', firmware: '1.9.0', serial: 'HS-5510-0042', lastSeen: '2026-11-13T13:02:00Z' },
    { id: 'ev-1', kind: 'car', name: 'Car charger', location: 'Driveway', status: 'attention', firmware: '3.0.2', serial: 'EV-7781-1200', lastSeen: '2026-11-13T12:30:00Z' },
    { id: 'roof-1', kind: 'sun', name: 'Roof inverter', location: 'Loft', status: 'offline', firmware: '5.2.0', serial: 'IN-3301-8875', lastSeen: '2026-11-13T07:00:00Z' },
  ];
}

export async function fetchHistory() {
  await wait(260);
  return history(30);
}

export async function saveSettings(settings) {
  await wait(500);
  if (scenario() === 'save-error') throw new Error('network');
  return settings;
}
