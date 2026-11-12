import { arcPoint, clamp, clock, settlePage, sliderValue, snapshot } from '../src/logic';

describe('sliderValue', () => {
  it('maps position to a stepped value and clamps', () => {
    expect(sliderValue(0, 200, 10, 100, 5)).toBe(10);
    expect(sliderValue(200, 200, 10, 100, 5)).toBe(100);
    expect(sliderValue(100, 200, 10, 100, 5)).toBe(55);
    expect(sliderValue(-40, 200, 10, 100, 5)).toBe(10);
    expect(sliderValue(999, 200, 10, 100, 5)).toBe(100);
    expect(sliderValue(50, 0, 10, 100, 5)).toBe(10);
  });
  it('mirrors in right-to-left', () => {
    expect(sliderValue(0, 200, 10, 100, 5, true)).toBe(100);
    expect(sliderValue(200, 200, 10, 100, 5, true)).toBe(10);
  });
});

describe('settlePage', () => {
  it('stays put on a small drag and advances on a long one', () => {
    expect(settlePage(0, -40, 0, 400, 3)).toBe(0);
    expect(settlePage(0, -260, 0, 400, 3)).toBe(1);
    expect(settlePage(1, 260, 0, 400, 3)).toBe(0);
  });
  it('a fast fling turns the page even when short', () => {
    expect(settlePage(0, -60, -1200, 400, 3)).toBe(1);
    expect(settlePage(1, 60, 1200, 400, 3)).toBe(0);
  });
  it('never leaves the range, in either direction', () => {
    expect(settlePage(0, 300, 1500, 400, 3)).toBe(0);
    expect(settlePage(2, -300, -1500, 400, 3)).toBe(2);
    expect(settlePage(0, 260, 0, 400, 3, true)).toBe(1);
  });
});

describe('day model', () => {
  it('places the sun left to right and highest at midday', () => {
    const box = { cx: 100, cy: 100, r: 80 };
    expect(arcPoint(6, box).x).toBeLessThan(arcPoint(13, box).x);
    expect(arcPoint(13, box).x).toBeLessThan(arcPoint(20, box).x);
    expect(arcPoint(13, box).y).toBeLessThan(arcPoint(7, box).y);
    expect(arcPoint(2, box).daylight).toBe(false);
  });
  it('never reports a battery below the reserve', () => {
    for (let h = 0; h < 24; h += 0.5) {
      expect(snapshot(h, 40).battery).toBeGreaterThanOrEqual(40);
      expect(snapshot(h, 40).battery).toBeLessThanOrEqual(100);
    }
  });
  it('charges at noon and discharges in the evening', () => {
    expect(snapshot(12, 30).state).toBe('charging');
    expect(snapshot(19, 30).state).toBe('discharging');
    expect(snapshot(1, 30).solarKw).toBe(0);
  });
  it('formats time', () => {
    expect(clock(6.5)).toBe('06:30');
    expect(clamp(5, 0, 3)).toBe(3);
  });
});
