// Motion Intelligence Engine: decide whether an interaction should move at all,
// pick the lightest runtime that can do the job, and lint a motion spec against
// the project's Experience DNA.

/**
 * Should this move? Frequency is the strongest signal: the more often a person
 * meets a motion, the less of it they want. These are defaults a project can
 * overrule by recording a rationale, not laws.
 */
export function decide(m, dna) {
  const intensity = dna.motion.intensity;
  if (intensity === 'none') return { decision: 'none', rule: 'project-motion-disabled', why: 'The Experience DNA sets motion intensity to none.' };
  if (m.frequency === 'constant') {
    return { decision: 'none', rule: 'constant-frequency', why: 'Seen constantly (typing, keyboard navigation, command palettes): any delay reads as lag.' };
  }
  if (m.intent === 'delight') {
    if (!['rare', 'once'].includes(m.frequency)) return { decision: 'none', rule: 'delight-must-be-rare', why: 'Delight wears off on repetition; reserve it for first runs and milestones.' };
    if (intensity === 'subtle') return { decision: 'none', rule: 'delight-needs-intensity', why: 'A subtle motion personality has no room for decorative moments.' };
  }
  if (m.intent === 'storytelling' && !['marketing', '3d'].includes(m.surface)) {
    return { decision: 'none', rule: 'storytelling-surface', why: 'Narrative motion belongs on marketing surfaces, not in tools people use to get work done.' };
  }
  if (m.frequency === 'frequent' && !['feedback', 'continuity', 'status'].includes(m.intent)) {
    return { decision: 'none', rule: 'frequent-needs-function', why: 'Frequently seen motion must confirm an action, preserve context, or report status.' };
  }
  return { decision: 'animate', rule: 'purposeful', why: `Serves ${m.intent} at ${m.frequency} frequency.` };
}

/** Longest duration token that stays comfortable at a given frequency. */
export function maxDuration(m) {
  if (m.trigger === 'scroll') return 'scrubbed';
  if (m.frequency === 'frequent') return 'fast';
  if (m.frequency === 'occasional') return 'base';
  if (m.intent === 'storytelling') return 'cinematic';
  return 'slow';
}

const DURATION_ORDER = ['instant', 'fast', 'base', 'slow', 'cinematic'];

/**
 * Pick a runtime. The ladder runs from "costs nothing" to "ships an engine";
 * a motion only climbs when the rung below cannot express it.
 */
export function chooseRuntime(m, ctx = {}) {
  const props = m.properties || ['transform', 'opacity'];
  const framework = ctx.framework || 'vanilla';
  const cheap = props.every((p) => ['transform', 'opacity', 'color', 'filter', 'clip-path'].includes(p));
  if (m.surface === 'mobile') {
    return m.gestureDriven || m.interruptible || props.includes('layout')
      ? { runtime: 'reanimated', why: 'Gesture-driven and interruptible motion must run on the UI thread.' }
      : { runtime: 'reanimated', why: 'Reanimated layout and entering/exiting animations keep motion off the JS thread.' };
  }
  if (m.surface === '3d' || props.includes('camera') || props.includes('material')) {
    return { runtime: 'three', why: 'Camera and material animation live in the render loop.' };
  }
  if (m.trigger === 'scroll') {
    if (m.duration === 'scrubbed' || m.intent === 'storytelling') return { runtime: 'gsap-scrolltrigger', why: 'Pinned, scrubbed, multi-element sequences need a timeline bound to scroll position.' };
    return { runtime: 'css', why: 'A one-shot reveal needs only an IntersectionObserver and a CSS transition.' };
  }
  if (m.trigger === 'in-view') return { runtime: 'css', why: 'A one-shot reveal needs only an IntersectionObserver and a CSS transition.' };
  if (m.trigger === 'route-change') return { runtime: 'view-transitions', why: 'The View Transitions API animates between DOM states natively and degrades to an instant swap.' };
  if (props.includes('svg-path')) return { runtime: 'gsap', why: 'Sequenced SVG path animation benefits from a timeline.' };
  if (m.trigger === 'drag' || m.gestureDriven) {
    return framework === 'react' ? { runtime: 'motion', why: 'Drag with spring release and interruption is what Motion is built for.' } : { runtime: 'waapi', why: 'Pointer events plus the Web Animations API cover drag-release without a library.' };
  }
  if (props.includes('layout')) {
    return framework === 'react' ? { runtime: 'motion', why: 'Layout animation needs FLIP; Motion does it interruptibly.' } : { runtime: 'view-transitions', why: 'Same-document view transitions perform FLIP natively.' };
  }
  if (m.trigger === 'data-update') return framework === 'react' ? { runtime: 'motion', why: 'Value-driven springs keep charts in step with data.' } : { runtime: 'waapi', why: 'Programmatic keyframes from data values.' };
  if (['hover', 'press', 'state-change', 'load'].includes(m.trigger) && cheap) {
    if (m.easing === 'spring' && framework === 'react') return { runtime: 'motion', why: 'True springs with velocity carry-over.' };
    return { runtime: 'css', why: 'Transform, opacity and colour transitions cost no JavaScript.' };
  }
  return { runtime: 'waapi', why: 'Programmatic control without a dependency.' };
}

const WEIGHT = { css: 0, 'view-transitions': 0, waapi: 0, native: 0, reanimated: 1, motion: 1, gsap: 1, 'gsap-scrolltrigger': 1, three: 2, lottie: 2, rive: 2 };

/** Lint a motion spec. Errors are contract problems; warnings are judgement calls to justify. */
export function lintMotion(spec, dna) {
  const issues = [];
  const add = (level, id, message) => issues.push({ level, motion: id, message });
  if (spec.dnaRevision !== dna.revision) add('warning', '*', `spec was written against DNA revision ${spec.dnaRevision}; current is ${dna.revision}`);
  const ids = new Set();
  const bySurface = {};
  for (const m of spec.motions) {
    if (ids.has(m.id)) add('error', m.id, 'duplicate motion id');
    ids.add(m.id);
    const rec = decide(m, dna);
    if (m.decision === 'animate' && rec.decision === 'none') {
      const justified = m.rationale && m.rationale.length >= 40;
      add(rec.rule === 'project-motion-disabled' ? 'error' : justified ? 'info' : 'warning', m.id, `default would be no motion (${rec.rule}: ${rec.why})${justified ? ' — overridden with a recorded rationale' : ' — record a specific rationale or drop it'}`);
    }
    if (m.decision !== 'animate') continue;
    (bySurface[m.surface] ||= new Set()).add(m.runtime);
    const cap = maxDuration(m);
    if (DURATION_ORDER.includes(m.duration) && DURATION_ORDER.includes(cap) && DURATION_ORDER.indexOf(m.duration) > DURATION_ORDER.indexOf(cap)) {
      add('warning', m.id, `duration "${m.duration}" is long for a ${m.frequency} ${m.intent} motion; "${cap}" or shorter is the default ceiling`);
    }
    if (m.duration === 'scrubbed' && m.trigger !== 'scroll' && m.trigger !== 'drag') add('error', m.id, 'only scroll- or drag-driven motion can be scrubbed');
    if (m.reducedMotionFallback === 'not-applicable' && (m.properties || []).some((p) => ['transform', 'layout', 'camera', 'clip-path'].includes(p))) {
      add('error', m.id, 'moves things on screen, so it needs a reduced-motion fallback');
    }
    if (['drag'].includes(m.trigger) && !m.keyboardEquivalent) add('error', m.id, 'dragging needs a single-pointer or keyboard alternative (WCAG 2.2 SC 2.5.7)');
    if (m.trigger === 'hover' && m.intent !== 'feedback' && !m.keyboardEquivalent) add('warning', m.id, 'hover-only behaviour is unreachable by touch and keyboard');
    if ((m.properties || []).includes('layout') && !['motion', 'view-transitions', 'reanimated'].includes(m.runtime)) {
      add('warning', m.id, 'animating layout properties directly forces reflow each frame; use FLIP (Motion, View Transitions) instead');
    }
    if (!m.interruptible && ['hover', 'press', 'drag'].includes(m.trigger)) add('warning', m.id, 'input-driven motion should be interruptible so it never fights the user');
    const want = chooseRuntime(m, { framework: m.surface === 'application' ? 'react' : 'vanilla' });
    if (WEIGHT[m.runtime] > WEIGHT[want.runtime]) add('info', m.id, `"${want.runtime}" would be enough here (${want.why}); "${m.runtime}" is heavier`);
    if (m.surface === 'mobile' && !['reanimated', 'native', 'lottie', 'rive'].includes(m.runtime)) add('error', m.id, `"${m.runtime}" is not a mobile runtime`);
    if (m.surface !== 'mobile' && m.runtime === 'reanimated') add('error', m.id, 'reanimated is a React Native runtime');
  }
  for (const [surface, runtimes] of Object.entries(bySurface)) {
    const heavy = [...runtimes].filter((r) => WEIGHT[r] >= 1);
    if (heavy.length > 2) add('warning', '*', `${surface} loads ${heavy.length} animation engines (${heavy.join(', ')}); consolidate`);
  }
  const animated = spec.motions.filter((m) => m.decision === 'animate').length;
  const summary = { total: spec.motions.length, animate: animated, none: spec.motions.length - animated, runtimes: Object.fromEntries(Object.entries(bySurface).map(([k, v]) => [k, [...v].sort()])) };
  return { issues, summary };
}
