import test from 'node:test';
import assert from 'node:assert/strict';
import { dayCurve, totals, scalePoints, linePath, areaPath, arcPoint, sunOnAxis, batteryState, friendlyDate, history, sortRows, paginate, filterRows, validateSettings, formatNumber, clock } from '../src/logic.js';

test('dayCurve is deterministic and physically sensible', () => {
  const a = dayCurve(3);
  assert.deepEqual(a, dayCurve(3));
  assert.equal(a.length, 48);
  assert.ok(a.every((p) => p.solar >= 0 && p.home > 0 && p.battery >= 0 && p.battery <= 1 && p.grid >= 0));
  assert.equal(a[0].solar, 0, 'no solar at midnight');
  assert.ok(Math.max(...a.map((p) => p.solar)) > 3, 'solar peaks around midday');
});

test('the battery never discharges below the chosen reserve', () => {
  const pts = dayCurve(5, { reserve: 0.4 });
  let prev = 0.34;
  for (const p of pts) {
    if (p.battery < prev) assert.ok(p.battery >= 0.4 - 1e-9 || prev <= 0.4, `discharged to ${p.battery}`);
    prev = p.battery;
  }
});

test('totals', () => {
  const t = totals(dayCurve(1));
  assert.ok(t.solar > 10 && t.home > 10);
  assert.ok(t.selfPowered >= 0 && t.selfPowered <= 100);
});

test('chart geometry stays inside the plot', () => {
  const xy = scalePoints(dayCurve(1), 'solar', { width: 600, height: 200, pad: 10 });
  assert.ok(xy.every(([x, y]) => x >= 10 && x <= 590 && y >= 10 && y <= 190));
  assert.ok(xy[0][0] < xy.at(-1)[0], 'time runs left to right');
  assert.match(linePath(xy), /^M[\d.]+ [\d.]+L/);
  assert.match(areaPath(xy, 190), /Z$/);
  assert.equal(areaPath([], 0), '');
});

test('arcPoint', () => {
  const box = { cx: 100, cy: 100, rx: 80, ry: 60 };
  assert.ok(arcPoint(6, box).x < arcPoint(13, box).x && arcPoint(13, box).x < arcPoint(20, box).x);
  assert.ok(arcPoint(13, box).y < arcPoint(6, box).y);
  assert.equal(arcPoint(2, box).daylight, false);
});

test('sorting, filtering and paging', () => {
  const rows = history(30);
  const asc = sortRows(rows, 'solar', 'ascending');
  assert.ok(asc.every((r, i) => i === 0 || asc[i - 1].solar <= r.solar));
  assert.equal(sortRows(rows, 'solar', 'descending')[0].solar, asc.at(-1).solar);
  assert.equal(rows[0].id, 1, 'input not mutated');
  const p = paginate(rows, 2, 10);
  assert.deepEqual([p.rows.length, p.page, p.pages, p.total], [10, 2, 3, 30]);
  assert.equal(paginate(rows, 99, 10).page, 3, 'page clamps');
  assert.equal(paginate([], 1, 10).pages, 1);
  assert.equal(filterRows(rows, '2026-10-3').length, 2);
  assert.equal(filterRows(rows, 'zzz').length, 0);
});

test('settings validation', () => {
  assert.deepEqual(validateSettings({ reserve: 30, alerts: false, email: '' }), {});
  assert.deepEqual(validateSettings({ reserve: 5, alerts: false }), { reserve: 'range' });
  assert.deepEqual(validateSettings({ reserve: 30, alerts: true, email: '' }), { email: 'required' });
  assert.deepEqual(validateSettings({ reserve: 30, alerts: true, email: 'nope' }), { email: 'format' });
  assert.deepEqual(validateSettings({ reserve: 30, alerts: true, email: 'a@b.co' }), {});
});

test('formatting', () => {
  assert.equal(formatNumber(12.34, 'en'), '12.3');
  assert.match(formatNumber(12.34, 'ar'), /^12/, 'Latin digits in Arabic');
  assert.equal(clock(6.5), '06:30');
  assert.equal(clock(18), '18:00');
});

test('sunOnAxis: the arc stands on sunrise and sunset and the sun is above its own hour', () => {
  const box = { x0: 28, x1: 692, cy: 272, ry: 250 };
  const xAt = (h) => 28 + (h / 23.5) * (692 - 28);
  for (const h of [6, 9.5, 13, 17, 20]) assert.ok(Math.abs(sunOnAxis(h, box).x - xAt(h)) < 1e-9, `sun is above ${h}:00`);
  assert.ok(Math.abs(sunOnAxis(6, box).y - 272) < 1e-6 && Math.abs(sunOnAxis(20, box).y - 272) < 1e-6, 'feet on the axis at sunrise and sunset');
  assert.ok(Math.abs(sunOnAxis(13, box).y - 22) < 1e-6, 'highest at the middle of the day');
  assert.equal(sunOnAxis(2, box).daylight, false);
  assert.equal(sunOnAxis(12, box).daylight, true);
  assert.ok(Math.abs(sunOnAxis(6, box).left - xAt(6)) < 1e-9 && Math.abs(sunOnAxis(6, box).right - xAt(20)) < 1e-9);
});

test('batteryState: a full battery is not described as charging', () => {
  assert.equal(batteryState({ solar: 4.6, home: 0.5, battery: 1 }), 'full');
  assert.equal(batteryState({ solar: 4.6, home: 0.5, battery: 0.6 }), 'charging');
  assert.equal(batteryState({ solar: 0, home: 1.8, battery: 0.6 }), 'discharging');
  assert.equal(batteryState({ solar: 0, home: 1.8, battery: 1 }), 'discharging');
  assert.equal(batteryState({ solar: 0.5, home: 0.5, battery: 0.5 }), 'idle');
  assert.equal(batteryState({ solar: 0, home: 1.8, battery: 0.3 }), 'idle');
});

test('scalePoints: head-room above the series when padTop is given', () => {
  const pts = [{ h: 0, v: 0 }, { h: 23.5, v: 10 }];
  const xy = scalePoints(pts, 'v', { width: 100, height: 100, pad: 10, padTop: 40, max: 10 });
  assert.deepEqual(xy[0], [10, 90]);
  assert.deepEqual(xy[1], [90, 40]);
});

test('friendlyDate and filtering by the date people read', () => {
  assert.equal(friendlyDate('2026-10-31', 'en-GB'), 'Sat 31 Oct');
  assert.match(friendlyDate('2026-10-31', 'ar'), /31/, 'Latin digits in Arabic');
  const rows = [{ date: '2026-10-31' }, { date: '2026-10-30' }, { date: '2026-09-01' }];
  assert.equal(filterRows(rows, '2026-10', 'en-GB').length, 2, 'ISO still works');
  assert.equal(filterRows(rows, '31 oct', 'en-GB').length, 1, 'readable date works');
  assert.equal(filterRows(rows, 'sat', 'en-GB').length, 1, 'weekday works');
  assert.equal(filterRows(rows, '1999', 'en-GB').length, 0);
});
