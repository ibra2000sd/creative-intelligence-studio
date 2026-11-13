import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LazyMotion, MotionConfig, m as motion, useReducedMotion, useSpring, useTransform } from 'motion/react';

// Only the small animation feature set is used, and it loads after first paint.
const loadMotion = () => import('./motion-features.js').then((r) => r.default);
import dna from './dna/dna.json';
import icons from './dna/icons.json';
import { STRINGS, localeFromUrl } from './i18n.js';
import { fetchDay, fetchDevices, fetchHistory, saveSettings } from './api.js';
import { areaPath, batteryState, clock, filterRows, formatNumber, linePath, paginate, scalePoints, sortRows, sunOnAxis, totals, validateSettings } from './logic.js';

const ROUTES = ['overview', 'devices', 'history', 'settings'];
const ROUTE_ICON = { overview: 'arc', devices: 'device', history: 'history', settings: 'sliders' };
// Motion values come from the Experience DNA: the spring is the brand's, not a library default.
const SPRING = { type: 'spring', ...dna.motion.spring };
const EASE = dna.motion.easing.standard;
const sec = (k) => dna.motion.durationMs[k] / 1000;
const FAST = { duration: sec('fast'), ease: EASE };

export function Icon({ name, size = 24 }) {
  const paths = icons.icons[name] || icons.icons.sun;
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={icons.meta.strokeWidth} strokeLinecap={icons.meta.terminals} strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

function useHashRoute() {
  const read = () => {
    const r = location.hash.replace(/^#\/?/, '');
    return ROUTES.includes(r) ? r : 'overview';
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

/** Number that springs to its new value; with reduced motion it simply changes. */
function Figure({ value, digits = 1, locale }) {
  const reduce = useReducedMotion();
  const spring = useSpring(value, dna.motion.spring);
  const text = useTransform(spring, (v) => formatNumber(v, locale, digits));
  useEffect(() => {
    if (reduce) spring.jump(value);
    else spring.set(value);
  }, [value, reduce, spring]);
  return <motion.span className="figure">{text}</motion.span>;
}

function Stat({ icon, label, value, unit, digits, tone, locale }) {
  return (
    <div className={`stat tone-${tone}`}>
      <span className="stat-icon"><Icon name={icon} /></span>
      <p className="stat-label">{label}</p>
      <p className="stat-value"><Figure value={value} digits={digits} locale={locale} /><span className="unit">{unit}</span></p>
    </div>
  );
}

function DayChart({ points, hour, now, onHour, t, locale }) {
  const [shown, setShown] = useState({ solar: true, home: true, battery: true });
  const [table, setTable] = useState(false);
  const descId = useId();
  const W = 720;
  const H = 320;
  const PAD = 28;
  const TOP = 78; // the series stop here; the band above belongs to the sun
  const max = Math.max(...points.map((p) => Math.max(p.solar, p.home)), 1) * 1.08;
  const xy = (key, m) => scalePoints(points, key, { width: W, height: H, pad: PAD, padTop: TOP, max: m });
  const solar = xy('solar', max);
  const home = xy('home', max);
  const battery = xy('battery', 1);
  const i = Math.round(hour * 2);
  const p = points[i] || points[0];
  const xAt = (h) => PAD + (h / 23.5) * (W - PAD * 2);
  const cursorX = xAt(hour);
  // The arc stands on sunrise and sunset on the same time axis as the data, so the sun is always above the cursor.
  const sun = sunOnAxis(hour, { x0: PAD, x1: W - PAD, cy: H - PAD, ry: H - PAD - 20 });
  const series = [['solar', 1], ['home', 3], ['battery', 2]];
  // Measured up to now; the rest of the day is a forecast and is drawn fainter.
  const n = Math.round(now * 2);
  const past = (pts) => pts.slice(0, n + 1);
  const ahead = (pts) => pts.slice(n);
  const fade = { duration: sec('slow'), ease: EASE };
  const FORECAST = 0.34;
  return (
    <section className="panel chart" aria-labelledby="chart-title">
      <header className="panel-head">
        <h2 id="chart-title">{t.chartTitle}</h2>
        <div className="legend" role="group" aria-label={t.seriesToggle}>
          {series.map(([k, n]) => (
            <button key={k} type="button" className="chip" aria-pressed={shown[k]} onClick={() => setShown((s) => ({ ...s, [k]: !s[k] }))}>
              <span className={`swatch viz-${n} ${k === 'battery' ? 'dashed' : ''}`} />{t.series[k]}
            </button>
          ))}
        </div>
      </header>
      <p id={descId} className="sr-only">{t.chartDesc}</p>
      {/* Time runs left to right in every locale: the chart depicts the sky, not reading order. */}
      <svg className="plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="chart-title" aria-describedby={descId} dir="ltr">
        <path className="day-arc" d={`M${sun.left.toFixed(1)} ${H - PAD}A${sun.rx.toFixed(1)} ${H - PAD - 20} 0 0 1 ${sun.right.toFixed(1)} ${H - PAD}`} />
        {[0, 6, 12, 18].map((h) => <text key={h} className="tick" x={PAD + (h / 23.5) * (W - PAD * 2)} y={H - 6}>{clock(h)}</text>)}
        <line className="axis" x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} />
        {/* Series fade in and out with opacity only: it is composited, so the entrance costs no layout or paint. */}
        <AnimatePresence>
          {shown.solar && <motion.path key="solar-a" className="area viz-1" d={areaPath(past(solar), H - PAD)} initial={{ opacity: 0 }} animate={{ opacity: 0.28 }} exit={{ opacity: 0, transition: FAST }} transition={fade} />}
          {shown.solar && <motion.path key="solar-l" className="line viz-1" d={linePath(past(solar))} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: FAST }} transition={fade} />}
          {shown.solar && <motion.path key="solar-f" className="line viz-1 forecast" d={linePath(ahead(solar))} initial={{ opacity: 0 }} animate={{ opacity: FORECAST }} exit={{ opacity: 0, transition: FAST }} transition={fade} />}
          {shown.home && <motion.path key="home-l" className="line viz-3" d={linePath(past(home))} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: FAST }} transition={{ ...fade, delay: dna.motion.staggerMs / 1000 }} />}
          {shown.home && <motion.path key="home-f" className="line viz-3 forecast" d={linePath(ahead(home))} initial={{ opacity: 0 }} animate={{ opacity: FORECAST }} exit={{ opacity: 0, transition: FAST }} transition={{ ...fade, delay: dna.motion.staggerMs / 1000 }} />}
          {shown.battery && <motion.path key="bat-l" className="line viz-2 dashed" d={linePath(past(battery))} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: FAST }} transition={{ ...fade, delay: (dna.motion.staggerMs * 2) / 1000 }} />}
          {shown.battery && <motion.path key="bat-f" className="line viz-2 dashed forecast" d={linePath(ahead(battery))} initial={{ opacity: 0 }} animate={{ opacity: FORECAST }} exit={{ opacity: 0, transition: FAST }} transition={{ ...fade, delay: (dna.motion.staggerMs * 2) / 1000 }} />}
        </AnimatePresence>
        <line className="now-line" x1={xAt(now)} x2={xAt(now)} y1={TOP - 14} y2={H - PAD} />
        <text className="now-label" x={xAt(now) + 6} y={TOP - 4}>{t.now}</text>
        <motion.line className="cursor" y1={PAD / 2} y2={H - PAD} initial={false} animate={{ x1: cursorX, x2: cursorX }} transition={SPRING} />
        <motion.g initial={false} animate={{ x: sun.x, y: sun.y, opacity: sun.daylight ? 1 : 0 }} transition={SPRING}>
          <circle className="sun-halo" r="15" />
          <circle className="sun-core" r="7.5" />
        </motion.g>
      </svg>
      <div className="scrub">
        <label htmlFor="hour">{t.time}</label>
        <input id="hour" type="range" min="0" max="23.5" step="0.5" value={hour} onChange={(e) => onHour(Number(e.target.value))} aria-valuetext={clock(hour)} dir="ltr" />
        <output htmlFor="hour" className="readout" aria-live="off" dir="ltr">
          <b>{clock(hour)}</b>
          <span><i className="swatch viz-1" />{formatNumber(p.solar, locale)} kW</span>
          <span><i className="swatch viz-3" />{formatNumber(p.home, locale)} kW</span>
          <span><i className="swatch viz-2 dashed" />{Math.round(p.battery * 100)}%</span>
        </output>
      </div>
      <p className="muted chart-note">{t.forecastNote}</p>
      <button type="button" className="link-button" aria-expanded={table} aria-controls="chart-table" onClick={() => setTable((v) => !v)}>{table ? t.hideTable : t.showTable}</button>
      {table && (
        <div id="chart-table" className="table-wrap" tabIndex={0} role="region" aria-labelledby="chart-title">
          <table>
            <thead><tr><th scope="col">{t.time}</th><th scope="col">{t.series.solar} (kW)</th><th scope="col">{t.series.home} (kW)</th><th scope="col">{t.series.battery}</th></tr></thead>
            <tbody>{points.filter((_, k) => k % 2 === 0).map((r) => <tr key={r.h}><th scope="row">{clock(r.h)}</th><td>{formatNumber(r.solar, locale)}</td><td>{formatNumber(r.home, locale)}</td><td>{Math.round(r.battery * 100)}%</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Flow({ p, t, locale, title }) {
  const state = batteryState(p);
  const nodes = [['sun', t.flowSolar, `${formatNumber(p.solar, locale)} kW`, null, p.solar > 0.05], ['battery', t.flowBattery, `${Math.round(p.battery * 100)}%`, t[state], state !== 'idle'], ['home', t.flowHome, `${formatNumber(p.home, locale)} kW`, null, true], ['grid', t.flowGrid, `${formatNumber(p.grid, locale)} kW`, null, p.grid > 0.05]];
  return (
    <section className="panel flow" aria-labelledby="flow-title">
      <h2 id="flow-title">{title}</h2>
      <ol className="flow-list">
        {nodes.map(([icon, label, value, word, active]) => (
          <li key={icon} className={active ? 'is-active' : ''}>
            <span className="flow-icon"><Icon name={icon} /></span>
            <span className="flow-label">{label}</span>
            {/* Figures are set in the mono face; words never are, so Arabic keeps its own typeface. */}
            <span className="flow-value"><span className="num" dir="ltr">{value}</span>{word && <span className="flow-state">{word}</span>}</span>
            <span className="flow-line" aria-hidden="true" />
          </li>
        ))}
      </ol>
    </section>
  );
}

// The demonstration's present moment. Everything on the Today page is true of this time unless
// the person moves the time slider, and then the page says which moment it is showing.
const NOW = 13;

function Overview({ t, locale, reserve }) {
  const [points, setPoints] = useState(null);
  const [hour, setHour] = useState(NOW);
  const [seed, setSeed] = useState(1);
  const stamp = `${clock(NOW).slice(0, 2)}:${String(2 + (((seed - 1) * 7) % 26)).padStart(2, '0')}`;
  useEffect(() => {
    let alive = true;
    fetchDay(seed, reserve).then((d) => alive && setPoints(d));
    return () => { alive = false; };
  }, [seed, reserve]);
  if (!points) return <Skeleton label={t.overview.chartTitle} rows={4} />;
  const p = points[Math.round(hour * 2)];
  const sum = totals(points.slice(0, Math.round(hour * 2) + 1));
  const soFar = totals(points.slice(0, NOW * 2 + 1));
  const o = t.overview;
  const away = hour !== NOW;
  return (
    <>
      <div className="page-head">
        <h1 tabIndex={-1}>{o.title}</h1>
        <p className="muted">{o.updated} <span dir="ltr">{stamp}</span> · <b dir="ltr">{soFar.selfPowered}%</b> {o.selfPowered}</p>
        <button type="button" className="button ghost" onClick={() => { setSeed((s) => s + 1); setHour(NOW); }}><Icon name="refresh" size={20} />{o.refresh}</button>
      </div>
      {away && (
        <p className="inspect" role="status">
          <span>{o.showing} <b dir="ltr">{clock(hour)}</b> · {hour > NOW ? o.forecast : o.earlier}</span>
          <button type="button" className="link-button" onClick={() => setHour(NOW)}>{o.backToNow}</button>
        </p>
      )}
      <div className="stats">
        <Stat icon="battery" label={o.battery} value={p.battery * 100} digits={0} unit="%" tone="2" locale={locale} />
        <Stat icon="sun" label={o.solar} value={p.solar} unit="kW" tone="1" locale={locale} />
        <Stat icon="home" label={o.home} value={p.home} unit="kW" tone="3" locale={locale} />
        <Stat icon="grid" label={o.grid} value={sum.grid} unit="kWh" tone="4" locale={locale} />
      </div>
      <div className="split">
        <DayChart points={points} hour={hour} now={NOW} onHour={setHour} t={o} locale={locale} />
        <Flow p={p} t={o} locale={locale} title={away ? `${o.at} ${clock(hour)}` : o.flowTitle} />
      </div>
    </>
  );
}

function Skeleton({ label, rows = 3 }) {
  return (
    <div className="skeleton" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="bone" style={{ '--i': i }} />)}
    </div>
  );
}

function Devices({ t }) {
  const d = t.devices;
  const [state, setState] = useState({ status: 'loading', items: [] });
  const [open, setOpen] = useState(null);
  const load = useCallback(() => {
    setState({ status: 'loading', items: [] });
    fetchDevices().then((items) => setState({ status: items.length ? 'ready' : 'empty', items }), () => setState({ status: 'error', items: [] }));
  }, []);
  useEffect(load, [load]);
  return (
    <>
      <div className="page-head"><h1 tabIndex={-1}>{d.title}</h1></div>
      {state.status === 'loading' && <Skeleton label={d.loading} rows={4} />}
      {state.status === 'error' && (
        <div className="notice danger" role="alert">
          <Icon name="alert" /><div><h2>{d.errorTitle}</h2><p>{d.errorBody}</p></div>
          <button type="button" className="button primary" onClick={load}>{d.retry}</button>
        </div>
      )}
      {state.status === 'empty' && (
        <div className="empty"><img src="./assets/feature-instrument.webp" alt="" width="1200" height="900" /><h2>{d.emptyTitle}</h2><p>{d.emptyBody}</p></div>
      )}
      {state.status === 'ready' && (
        <ul className="devices">
          {state.items.map((it, i) => {
            const isOpen = open === it.id;
            return (
              <motion.li key={it.id} className="device" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: (i * dna.motion.staggerMs) / 1000 }}>
                <div className="device-row">
                  <span className="device-icon"><Icon name={it.kind} /></span>
                  <div className="device-main"><h2>{it.name}</h2><p className="muted">{it.location}</p></div>
                  <span className={`badge ${it.status}`}><Icon name={it.status === 'online' ? 'check' : it.status === 'offline' ? 'offline' : 'alert'} size={16} />{d[it.status]}</span>
                  <button type="button" className="icon-button" aria-expanded={isOpen} aria-controls={`dev-${it.id}`} onClick={() => setOpen(isOpen ? null : it.id)}>
                    <span className="sr-only">{d.details}: {it.name}</span>
                    <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={SPRING} style={{ display: 'inline-flex' }}><Icon name="chevron-down" /></motion.span>
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.dl id={`dev-${it.id}`} className="device-details" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: sec('base'), ease: EASE }}>
                      <div><dt>{d.firmware}</dt><dd dir="ltr">{it.firmware}</dd></div>
                      <div><dt>{d.serial}</dt><dd dir="ltr">{it.serial}</dd></div>
                      <div><dt>{d.lastSeen}</dt><dd dir="ltr">{it.lastSeen.replace('T', ' ').slice(0, 16)}</dd></div>
                    </motion.dl>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function History({ t, locale }) {
  const h = t.history;
  const [rows, setRows] = useState(null);
  const [sort, setSort] = useState({ key: 'date', dir: 'descending' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { fetchHistory().then(setRows); }, []);
  const view = useMemo(() => (rows ? paginate(sortRows(filterRows(rows, query), sort.key, sort.dir), page, 8) : null), [rows, sort, query, page]);
  if (!view) return <Skeleton label={h.title} rows={6} />;
  // On a phone the table keeps date, use and self-powered; the two supporting columns are dropped, not scrolled off-screen.
  const cols = [['date', h.date], ['solar', h.solar, 'optional'], ['used', h.used], ['grid', h.grid, 'optional'], ['selfPowered', h.self]];
  const toggle = (key) => { setSort((s) => ({ key, dir: s.key === key && s.dir === 'ascending' ? 'descending' : 'ascending' })); setPage(1); };
  return (
    <>
      <div className="page-head"><h1 tabIndex={-1}>{h.title}</h1></div>
      <div className="toolbar">
        <div className="field inline"><label htmlFor="q">{h.search}</label><input id="q" type="search" value={query} placeholder={h.searchHint} onChange={(e) => { setQuery(e.target.value); setPage(1); }} dir="ltr" /></div>
        <p className="muted" role="status">{view.total} {h.rows}</p>
      </div>
      {view.total === 0 ? (
        <div className="empty"><h2>{h.empty}</h2><button type="button" className="button ghost" onClick={() => setQuery('')}>{h.clear}</button></div>
      ) : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label={h.title}>
          <table className="data">
            <thead><tr>{cols.map(([k, label, cls]) => (
              <th key={k} scope="col" className={cls} aria-sort={sort.key === k ? sort.dir : 'none'}>
                <button type="button" className="sort" onClick={() => toggle(k)}><span className="sr-only">{h.sortBy} </span>{label}<Icon name="chevron-down" size={16} /></button>
              </th>
            ))}</tr></thead>
            <tbody>{view.rows.map((r) => (
              <tr key={r.id}><th scope="row" dir="ltr">{r.date}</th><td className="optional">{formatNumber(r.solar, locale)}</td><td>{formatNumber(r.used, locale)}</td><td className="optional">{formatNumber(r.grid, locale)}</td>
                <td><span className="meter" style={{ '--v': `${r.selfPowered}%` }}><span>{r.selfPowered}%</span></span></td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {view.pages > 1 && (
        <nav className="pager" aria-label={h.page}>
          <button type="button" className="button ghost" disabled={view.page === 1} onClick={() => setPage(view.page - 1)}>{h.prev}</button>
          <span aria-current="page">{h.page} {view.page} {h.of} {view.pages}</span>
          <button type="button" className="button ghost" disabled={view.page === view.pages} onClick={() => setPage(view.page + 1)}>{h.next}</button>
        </nav>
      )}
    </>
  );
}

function Settings({ t, settings, onSaved, notify, scheme, onScheme, langHref }) {
  const s = t.settings;
  const [draft, setDraft] = useState(settings);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const emailRef = useRef(null);
  const submit = async (e) => {
    e.preventDefault();
    const found = validateSettings(draft);
    setErrors(found);
    if (found.email) emailRef.current?.focus();
    if (Object.keys(found).length) return;
    setBusy(true);
    const previous = settings;
    onSaved(draft); // optimistic: the rest of the app reflects the change immediately
    try {
      await saveSettings(draft);
      notify({ tone: 'success', text: s.saved });
    } catch {
      onSaved(previous); // roll back on failure
      setDraft(previous);
      notify({ tone: 'danger', text: s.failed });
    } finally {
      setBusy(false);
    }
  };
  const msg = { range: s.errRange, required: s.errRequired, format: s.errFormat };
  return (
    <>
      <div className="page-head"><h1 tabIndex={-1}>{s.title}</h1></div>
      <form className="panel form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="reserve">{s.reserve}</label>
          <p id="reserve-help" className="muted">{s.reserveHelp}</p>
          <div className="range-row"><input id="reserve" type="range" min="0" max="100" step="5" value={draft.reserve} aria-describedby="reserve-help reserve-err" aria-invalid={Boolean(errors.reserve)} onChange={(e) => setDraft({ ...draft, reserve: Number(e.target.value) })} dir="ltr" /><output htmlFor="reserve" dir="ltr">{draft.reserve}%</output></div>
          <p id="reserve-err" className="error" hidden={!errors.reserve}>{msg[errors.reserve]}</p>
        </div>
        <div className="field switch-row">
          <label htmlFor="alerts">{s.alerts}</label>
          <input id="alerts" type="checkbox" role="switch" checked={draft.alerts} onChange={(e) => setDraft({ ...draft, alerts: e.target.checked })} />
        </div>
        <AnimatePresence initial={false}>
          {draft.alerts && (
            <motion.div className="field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: sec('base'), ease: EASE }}>
              <label htmlFor="email">{s.email}</label>
              <input id="email" ref={emailRef} type="email" autoComplete="email" value={draft.email} aria-invalid={Boolean(errors.email)} aria-describedby="email-err" onChange={(e) => setDraft({ ...draft, email: e.target.value })} dir="ltr" />
              <p id="email-err" className="error" hidden={!errors.email}>{msg[errors.email]}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="form-foot"><button type="submit" className="button primary" disabled={busy}>{busy ? s.saving : s.save}</button><p className="muted">{s.demo}</p></div>
      </form>
      {/* Language and appearance live here on every screen size; on a phone this is the only place for them. */}
      <section className="panel form display" aria-labelledby="display-title">
        <h2 id="display-title">{s.display}</h2>
        <div className="field switch-row">
          <label htmlFor="dark-mode">{s.dark}</label>
          <input id="dark-mode" type="checkbox" role="switch" checked={scheme === 'dark'} onChange={onScheme} />
        </div>
        <div className="field switch-row">
          <span className="label">{s.language}</span>
          <a className="button ghost" data-lang-link href={langHref} hrefLang={t.otherLang} lang={t.otherLang}>{t.language}</a>
        </div>
      </section>
    </>
  );
}

/** Wraps a routed page. On every navigation after the first it moves focus to the page heading. */
function PageFrame({ route, announce, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!announce || !ref.current) return undefined;
    const focusHeading = () => {
      const h1 = ref.current?.querySelector('h1');
      h1?.focus();
      return Boolean(h1);
    };
    if (focusHeading()) return undefined;
    // Pages that load data show a skeleton first; wait for the heading to arrive.
    const mo = new MutationObserver(() => focusHeading() && mo.disconnect());
    mo.observe(ref.current, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [announce]);
  return (
    <motion.div ref={ref} key={route} className="page" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: sec('instant') } }} transition={FAST}>
      {children}
    </motion.div>
  );
}

export default function App() {
  const [locale] = useState(localeFromUrl);
  const t = STRINGS[locale];
  const route = useHashRoute();
  const [settings, setSettings] = useState({ reserve: 30, alerts: false, email: '' });
  const [toast, setToast] = useState(null);
  const [scheme, setScheme] = useState(() => document.documentElement.dataset.scheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const mainRef = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    document.title = `${t.routes[route]} · ${dna.name}`;
  }, [route, t]);
  // The first page keeps the browser's natural focus; later pages focus their heading (see PageFrame).
  const [navigated, setNavigated] = useState(false);
  useEffect(() => {
    if (first.current) first.current = false;
    else setNavigated(true);
  }, [route]);
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  const toggleScheme = () => {
    const next = scheme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.scheme = next;
    try { localStorage.setItem('scheme', next); } catch { /* private mode */ }
    setScheme(next);
  };
  const langHref = `${location.pathname}${t.otherLang === 'ar' ? '?lang=ar' : ''}${location.hash}`;

  return (
    <LazyMotion features={loadMotion} strict>
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.querySelector('h1')?.focus(); }}>{t.skip}</a>
      <div className="shell">
        <aside className="side">
          <a className="brand" href="#/overview" aria-label={dna.name}>
            <img className="on-light" src="./brand/lockup.svg" alt="" width="180" height="40" /><img className="on-dark" src="./brand/lockup-reversed.svg" alt="" width="180" height="40" />
          </a>
          <nav aria-label={t.nav}>
            <ul>
              {ROUTES.map((r) => (
                <li key={r}>
                  <a href={`#/${r}`} aria-current={route === r ? 'page' : undefined}>
                    <Icon name={ROUTE_ICON[r]} /><span>{t.routes[r]}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="side-tools">
            <a className="lang" href={langHref} hrefLang={t.otherLang} lang={t.otherLang}>{t.language}</a>
            <button type="button" className="icon-button" aria-pressed={scheme === 'dark'} onClick={toggleScheme}><span className="sr-only">{t.theme}</span><Icon name={scheme === 'dark' ? 'sun' : 'moon'} /></button>
          </div>
        </aside>
        <main id="main" ref={mainRef}>
          <AnimatePresence mode="wait" initial={false}>
            <PageFrame key={route} route={route} announce={navigated}>
              {route === 'overview' && <Overview t={t} locale={locale} reserve={settings.reserve} />}
              {route === 'devices' && <Devices t={t} />}
              {route === 'history' && <History t={t} locale={locale} />}
              {route === 'settings' && <Settings t={t} settings={settings} onSaved={setSettings} notify={setToast} scheme={scheme} onScheme={toggleScheme} langHref={langHref} />}
            </PageFrame>
          </AnimatePresence>
        </main>
      </div>
      <div className="toast-region" role="status" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <motion.div key={toast.text} className={`toast ${toast.tone}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={SPRING}>
              <Icon name={toast.tone === 'success' ? 'check' : 'alert'} size={20} /><span>{toast.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
    </LazyMotion>
  );
}
