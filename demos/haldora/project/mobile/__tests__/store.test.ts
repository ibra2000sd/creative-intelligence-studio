import { store } from '../src/store';
import { stringsFor } from '../src/i18n';

beforeEach(() => store.reset());

test('notifies subscribers only when something changes', () => {
  const seen = jest.fn();
  const off = store.subscribe(seen);
  store.set({ reserve: 30 });
  expect(seen).not.toHaveBeenCalled();
  store.set({ reserve: 55 });
  expect(seen).toHaveBeenCalledTimes(1);
  expect(store.get().reserve).toBe(55);
  off();
  store.set({ reserve: 60 });
  expect(seen).toHaveBeenCalledTimes(1);
});

test('reset restores defaults', () => {
  store.set({ onboarded: true, locale: 'ar', online: false });
  store.reset();
  expect(store.get()).toMatchObject({ onboarded: false, locale: 'en', online: true });
});

test('both locales define the same keys', () => {
  const shape = (o: unknown): unknown => (o && typeof o === 'object' ? (Array.isArray(o) ? o.map(shape) : Object.fromEntries(Object.entries(o).sort().map(([k, v]) => [k, shape(v)]))) : typeof o);
  expect(shape(stringsFor('ar'))).toEqual(shape(stringsFor('en')));
});
