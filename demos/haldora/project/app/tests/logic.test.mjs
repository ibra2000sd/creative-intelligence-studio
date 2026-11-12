import test from 'node:test';
import assert from 'node:assert/strict';
import { dayCurve, totals, scalePoints, linePath, areaPath, arcPoint, history, sortRows, paginate, filterRows, validateSettings, formatNumber, clock } from '../src/logic.js';

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
