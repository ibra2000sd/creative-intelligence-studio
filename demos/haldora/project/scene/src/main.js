// Interactive product scene. Materials, lighting and motion timing come from
// the generated scene.json; nothing here hard-codes a brand colour.
import scene from './dna/scene.json';

const STRINGS = {
  en: {
    title: 'Haldora Cell',
    finish: 'Finish',
    time: 'Time of day',
    reset: 'Reset view',
    help: 'Drag to turn. Scroll or pinch to zoom. With the keyboard: arrow keys turn, plus and minus zoom.',
    label: (f, t) => `Interactive 3D model of the product in the ${f} finish at ${t}.`,
    loading: 'Loading the model…',
    ready: '',
    still: 'Showing a still image: this device cannot run the 3D view.',
    stillChosen: 'Showing a still image.',
    lost: 'The 3D view stopped. Showing a still image instead.',
    fallbackAlt: (f) => `The product in the ${f} finish, front view.`,
  },
  ar: {
    title: 'هالدورا سِل',
    finish: 'اللون',
    time: 'الوقت من اليوم',
    reset: 'إعادة ضبط العرض',
    help: 'اسحب للتدوير. استخدم العجلة أو إصبعين للتكبير. بلوحة المفاتيح: الأسهم للتدوير، وعلامتا الزائد والناقص للتكبير.',
    label: (f, t) => `نموذج ثلاثي الأبعاد تفاعلي للمنتج بلون ${f} عند الساعة ${t}.`,
    loading: 'جارٍ تحميل النموذج…',
    ready: '',
    still: 'نعرض صورة ثابتة لأن هذا الجهاز لا يدعم العرض ثلاثي الأبعاد.',
    stillChosen: 'نعرض صورة ثابتة.',
    lost: 'توقّف العرض ثلاثي الأبعاد. نعرض صورة ثابتة بدلاً منه.',
    fallbackAlt: (f) => `المنتج بلون ${f}، من الأمام.`,
  },
};

const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'ar' ? 'ar' : 'en';
const t = STRINGS[lang];
const embed = params.has('embed');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.lang = lang;
document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
if (params.get('scheme')) document.documentElement.dataset.scheme = params.get('scheme');
document.body.classList.toggle('embed', embed);

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const fallbackImg = $('fallback');
const status = $('status');
const timeInput = $('time');
const state = { finish: scene.finishes[0].id, time: Number(timeInput.value), mode: 'loading' };

$('panel-title').textContent = t.title;
$('finish-legend').textContent = t.finish;
$('time-label').textContent = t.time;
$('reset').textContent = t.reset;
$('scene-help').textContent = t.help;
document.title = t.title;

const clock = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const finishName = () => scene.finishes.find((f) => f.id === state.finish).name;

for (const f of scene.finishes) {
  const label = document.createElement('label');
  label.className = 'swatch';
  const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'finish', value: f.id, checked: f.id === state.finish });
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = f.baseColor;
  const name = document.createElement('span');
  name.textContent = f.name;
  label.append(input, dot, name);
  $('finishes').append(label);
}

function describe() {
  $('time-out').textContent = clock(state.time);
  canvas.setAttribute('aria-label', t.label(finishName(), clock(state.time)));
  fallbackImg.alt = t.fallbackAlt(finishName());
  fallbackImg.src = `fallback/cell-${state.finish}.webp`;
}

function showFallback(message) {
  state.mode = 'fallback';
  canvas.hidden = true;
  fallbackImg.hidden = false;
  $('time-field').hidden = true;
  $('reset').hidden = true;
  $('scene-help').hidden = true;
  status.textContent = message;
  describe();
  window.__scene = { mode: 'fallback', reason: message };
  parent !== window && parent.postMessage({ type: 'cis-scene-ready', mode: 'fallback' }, location.origin);
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2'));
  } catch {
    return false;
  }
}

let api = null;

document.getElementById('finishes').addEventListener('change', (e) => {
  state.finish = e.target.value;
  describe();
  api?.setFinish(state.finish);
});
timeInput.addEventListener('input', () => {
  state.time = Number(timeInput.value);
  describe();
  api?.setTime(state.time);
});
$('reset').addEventListener('click', () => api?.resetView());

describe();
status.textContent = t.loading;

if (params.has('fallback') || navigator.connection?.saveData) {
  showFallback(t.stillChosen);
} else if (!webglAvailable()) {
  showFallback(t.still);
} else {
  // The engine is a separate chunk: devices that get the still image never download it.
  import('./scene.js')
    .then(({ createScene }) => createScene({ canvas, scene, state, reduceMotion, embed, onLost: () => showFallback(t.lost) }))
    .then((created) => {
      api = created;
      state.mode = 'webgl';
      status.textContent = t.ready;
      parent !== window && parent.postMessage({ type: 'cis-scene-ready', mode: 'webgl' }, location.origin);
    })
    .catch((err) => {
      console.error(err);
      showFallback(t.still);
    });
}

// When embedded, the host page drives the camera with scroll progress (0..1)
// and may switch scheme or pause rendering while off-screen.
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return; // only the page that embeds this scene may drive it
  const m = e.data;
  if (!m || typeof m !== 'object') return;
  if (m.type === 'cis-scene-progress' && typeof m.value === 'number') api?.setProgress(Math.max(0, Math.min(1, m.value)));
  if (m.type === 'cis-scene-scheme' && (m.value === 'light' || m.value === 'dark')) {
    document.documentElement.dataset.scheme = m.value;
    api?.setScheme(m.value);
  }
});
