import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const bezier = ([x1, y1, x2, y2]) => (x) => {
  // Solve the cubic for t at x, then evaluate y: the same curve CSS uses.
  let lo = 0;
  let hi = 1;
  let tt = x;
  for (let i = 0; i < 20; i++) {
    tt = (lo + hi) / 2;
    const cx = 3 * (1 - tt) ** 2 * tt * x1 + 3 * (1 - tt) * tt ** 2 * x2 + tt ** 3;
    if (cx < x) lo = tt;
    else hi = tt;
  }
  return 3 * (1 - tt) ** 2 * tt * y1 + 3 * (1 - tt) * tt ** 2 * y2 + tt ** 3;
};

// Camera choreography for the embedded scroll sequence: [azimuth, polar, distance, targetY].
const SHOTS = [
  { at: 0, view: [0.55, 1.5, 3.2, -0.12] },
  { at: 0.5, view: [0.12, 1.52, 1.5, 0.2] },
  { at: 1, view: [-1.0, 1.48, 3.0, -0.12] },
];
const HOME = SHOTS[0].view;

export async function createScene({ canvas, scene: cfg, state, reduceMotion, embed, shot = false, onLost, onGround }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // The neutral tone mapper keeps base colours true to their tokens: a finish specified as
  // chalk should read as chalk, which a filmic curve shifts toward tan.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = cfg.environment.exposure ?? 1;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);

  const world = new THREE.Scene();
  // Give the browser a turn between heavy start-up steps so input is never blocked for long.
  const breathe = () => new Promise((r) => setTimeout(r, 0));

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
  const key = new THREE.DirectionalLight(cfg.environment.keyLight, 2.2);
  key.position.set(-2.4, 3.2, 3.4);
  const fill = new THREE.DirectionalLight(new THREE.Color(cfg.environment.fillLight).lerp(new THREE.Color(cfg.environment.keyLight), 0.5), 0.7);
  fill.position.set(3, 0.6, 2);
  // A hemisphere light stands in for an environment map: these finishes are matte, and
  // skipping the prefiltered environment removes the costliest start-up step.
  // The bounce from below is mostly neutral with a little of the warm fill, so pale finishes are not tinted.
  const sky = new THREE.HemisphereLight(cfg.environment.keyLight, new THREE.Color(cfg.environment.keyLight).lerp(new THREE.Color(cfg.environment.fillLight), 0.22), 1.1);
  world.add(key, fill, sky);

  // The setting: the background is the wall the product hangs on, with a floor and a skirting
  // board below it. Their colours come from the scheme's surface tokens, unlit, so the room
  // matches the page around it. A soft contact shadow is drawn once to a canvas texture.
  const scheme = () => document.documentElement.dataset.scheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const day = new THREE.Color(cfg.environment.background);
  const night = new THREE.Color(cfg.semantic.dark.bg);
  const bg = new THREE.Color();
  world.background = bg;
  const WALL_Z = -0.13;
  const FLOOR_Y = -0.9;
  const floorMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const skirtMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, FLOOR_Y, WALL_Z + 3);
  const skirting = new THREE.Mesh(new THREE.BoxGeometry(14, 0.085, 0.014), skirtMat);
  skirting.position.set(0, FLOOR_Y + 0.0425, WALL_Z + 0.007);
  // A still is placed on a page of the same wall colour; a floor would end at the picture's edge.
  if (!shot) world.add(floor, skirting);
  const tone = (name, dusk) => new THREE.Color(cfg.semantic[scheme()][name]).lerp(new THREE.Color(cfg.semantic.dark[name]), dusk);
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 256;
  const g = shadowCanvas.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  // White with falling alpha: tinted black it is the shadow on a pale wall, tinted with a raised
  // surface colour it is the pool of light around the product on a dark wall.
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.65), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.position.set(0.05, -0.05, WALL_Z + 0.002);
  world.add(shadow);
  // A tight, darker shadow where the unit meets the wall: it sits on the wall, it does not float.
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 1.12), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.55 }));
  contact.position.set(0.012, -0.02, WALL_Z + 0.003);
  world.add(contact);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(cfg.model.url);
  await breathe();
  const product = gltf.scene;
  world.add(product);
  const parts = {};
  product.traverse((o) => {
    if (o.isMesh) parts[o.name] = o;
  });
  const required = ['Body', 'Fascia', 'ArcLight', 'Sun'];
  const missing = required.filter((n) => !parts[n]);
  if (missing.length) throw new Error(`Model is missing parts: ${missing.join(', ')}`);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.enablePan = false;
  controls.minDistance = 1.0;
  controls.maxDistance = 4;
  controls.minPolarAngle = 0.9;
  controls.maxPolarAngle = 1.9;
  controls.minAzimuthAngle = -1.35; // the product hangs on a wall: never orbit behind it
  controls.maxAzimuthAngle = 1.35;
  controls.zoomSpeed = 0.7;

  const view = { az: HOME[0], pol: HOME[1], dist: HOME[2], ty: HOME[3] };
  const applyView = () => {
    controls.target.set(0, view.ty, 0);
    camera.position.set(view.dist * Math.sin(view.pol) * Math.sin(view.az), view.ty + view.dist * Math.cos(view.pol), view.dist * Math.sin(view.pol) * Math.cos(view.az));
    camera.lookAt(controls.target);
  };
  const readView = () => {
    const off = camera.position.clone().sub(controls.target);
    const s = new THREE.Spherical().setFromVector3(off);
    Object.assign(view, { az: s.theta, pol: s.phi, dist: s.radius, ty: controls.target.y });
  };

  // ---- render on demand: idle scenes cost nothing --------------------------
  const diag = { mode: 'webgl', frames: 0, frameMs: [], contextLost: false, dprDrops: 0 };
  let dirty = true;
  let raf = 0;
  let scheduled = false;
  let last = 0;
  const tweens = new Set();
  // Exactly one animation frame may be pending at a time, however many things ask for one.
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    raf = requestAnimationFrame(frame);
  };
  const invalidate = () => {
    dirty = true;
    schedule();
  };
  function frame(now) {
    scheduled = false;
    const dt = last ? now - last : 16.7;
    last = now;
    for (const tw of [...tweens]) if (tw(now)) tweens.delete(tw);
    const moved = controls.update();
    if (dirty || moved || tweens.size) {
      renderer.render(world, camera);
      dirty = false;
      diag.frames++;
      if (dt < 200) {
        diag.frameMs.push(dt);
        if (diag.frameMs.length > 240) diag.frameMs.shift();
        // Sustained slow frames: drop resolution before dropping frames.
        if (diag.frameMs.length >= 60 && dpr > 1 && diag.frameMs.slice(-60).reduce((a, b) => a + b, 0) / 60 > 28) {
          dpr = Math.max(1, dpr - 0.5);
          renderer.setPixelRatio(dpr);
          diag.dprDrops++;
          diag.frameMs.length = 0;
        }
      }
    }
    if (moved || tweens.size) schedule();
    else last = 0;
  }
  controls.addEventListener('change', invalidate);

  const durations = cfg.motion.durationMs;
  const ease = bezier(cfg.motion.easing.standard);
  const easeEnter = bezier(cfg.motion.easing.enter);
  /** Tween helper honouring reduced motion: values jump instead of travelling. */
  function tween(ms, fn, curve = ease) {
    if (reduceMotion || cfg.motion.intensity === 'none' || ms <= 0) {
      fn(1);
      invalidate();
      return null;
    }
    let start = 0;
    const run = (now) => {
      start ||= now;
      const p = Math.min(1, (now - start) / ms);
      fn(curve(p));
      return p >= 1;
    };
    tweens.add(run);
    invalidate();
    return run;
  }

  // ---- finishes -----------------------------------------------------------
  const bodyMat = parts.Body.material;
  const fasciaMat = parts.Fascia.material;
  const arcMat = parts.ArcLight.material;
  function setFinish(id, animate = true) {
    const f = cfg.finishes.find((x) => x.id === id) || cfg.finishes[0];
    const from = { c: bodyMat.color.clone(), m: bodyMat.metalness, r: bodyMat.roughness, a: arcMat.emissive.clone() };
    const to = { c: new THREE.Color(f.baseColor), a: new THREE.Color(f.accent || cfg.semantic.light.accent) };
    tween(animate ? durations.slow : 0, (p) => {
      bodyMat.color.copy(from.c).lerp(to.c, p);
      fasciaMat.color.copy(bodyMat.color).multiplyScalar(0.94);
      bodyMat.metalness = fasciaMat.metalness = from.m + (f.metalness - from.m) * p;
      bodyMat.roughness = from.r + (f.roughness - from.r) * p;
      fasciaMat.roughness = Math.min(1, bodyMat.roughness + 0.12);
      // The arc is a light, not a painted surface: it shows its accent colour exactly, whatever the room light.
      arcMat.emissive.copy(from.a).lerp(to.a, p);
      parts.Sun.material.emissive.copy(arcMat.emissive);
    });
  }
  for (const m of [arcMat, parts.Sun.material]) {
    m.color.set(0x000000);
    m.metalness = 0;
    m.roughness = 1;
  }

  // ---- time of day: the sun travels the arc on the product ----------------
  const [ax, ay, az] = cfg.model.anchors.arcCentre;
  const warm = new THREE.Color(cfg.environment.fillLight);
  const white = new THREE.Color(cfg.environment.keyLight);
  function setTime(hours) {
    const p = (hours - 6) / 16; // 06:00 -> 0, 22:00 -> 1
    const angle = Math.PI * (1 - p);
    parts.Sun.position.set(ax + Math.cos(angle) * cfg.model.anchors.arcRadius, ay + Math.sin(angle) * cfg.model.anchors.arcRadius, az);
    // The brand's rule: no sun above the horizon after sunset.
    parts.Sun.visible = hours >= 6 && hours <= 20;
    const noon = Math.sin(Math.PI * Math.min(1, Math.max(0, p))); // 0 at the ends, 1 at midday
    // Evening falls quickly: a slow blend from a pale wall to a dark one lingers on grey.
    const late = Math.min(1, Math.max(0, (hours - 18) / 2.25));
    const dusk = late * late * (3 - 2 * late);
    // Warm only near sunrise and sunset; through the day the key light is neutral, so finishes keep their colour.
    key.color.copy(warm).lerp(white, Math.min(1, noon * 1.6));
    key.intensity = 0.9 + noon * 2.0;
    key.position.set(-3.2 + p * 6.4, 1.2 + noon * 2.4, 3.2);
    fill.intensity = 0.35 + (1 - noon) * 0.5;
    sky.intensity = 0.75 + noon * 0.85;
    const base = scheme() === 'dark' ? night : day;
    const d = Math.min(1, dusk);
    bg.copy(base).lerp(night, d);
    floorMat.color.copy(tone('surface', d));
    skirtMat.color.copy(tone('border', d));
    const darkWall = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b < 0.18;
    shadow.material.color.set(darkWall ? cfg.semantic.dark.surfaceRaised : '#000000');
    shadow.material.opacity = darkWall ? 0.55 : 0.2;
    contact.material.color.set('#000000');
    contact.material.opacity = darkWall ? 0.5 : 0.42;
    arcMat.emissiveIntensity = 1 + d * 0.5;
    parts.Sun.material.emissiveIntensity = 1.1 + d * 0.7;
    // Text laid over the canvas must take its colour from the wall behind it, not from the page scheme.
    const lum = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b; // Color components are linear
    onGround?.(lum < 0.18 ? 'dark' : 'light');
    invalidate();
  }

  // ---- camera -------------------------------------------------------------
  let userUntil = 0;
  controls.addEventListener('start', () => {
    userUntil = performance.now() + 2500; // the person has the camera; choreography waits
  });
  controls.addEventListener('end', () => {
    readView();
    goal = [view.az, view.pol, view.dist, view.ty];
  });
  let goal = [...HOME];
  let cameraTween = null;
  /** Move the camera to a view. A new move replaces the one in flight instead of fighting it. */
  function goTo(v, ms) {
    goal = [...v];
    if (cameraTween) tweens.delete(cameraTween);
    const from = { ...view };
    cameraTween = tween(ms, (p) => {
      view.az = from.az + (v[0] - from.az) * p;
      view.pol = from.pol + (v[1] - from.pol) * p;
      view.dist = from.dist + (v[2] - from.dist) * p;
      view.ty = from.ty + (v[3] - from.ty) * p;
      applyView();
    }, easeEnter);
  }
  function setProgress(p) {
    if (performance.now() < userUntil) return;
    let i = 0;
    while (i < SHOTS.length - 2 && p > SHOTS[i + 1].at) i++;
    const a = SHOTS[i];
    const b = SHOTS[i + 1];
    const k = ease(Math.min(1, Math.max(0, (p - a.at) / (b.at - a.at))));
    view.az = a.view[0] + (b.view[0] - a.view[0]) * k;
    view.pol = a.view[1] + (b.view[1] - a.view[1]) * k;
    view.dist = a.view[2] + (b.view[2] - a.view[2]) * k;
    view.ty = a.view[3] + (b.view[3] - a.view[3]) * k;
    applyView();
    invalidate();
  }

  // Keyboard equivalent of dragging and zooming.
  canvas.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.3 : 0.12;
    const moves = { ArrowLeft: [-step, 0, 0], ArrowRight: [step, 0, 0], ArrowUp: [0, -step * 0.6, 0], ArrowDown: [0, step * 0.6, 0], '+': [0, 0, -0.2], '=': [0, 0, -0.2], '-': [0, 0, 0.2], _: [0, 0, 0.2] }[e.key];
    if (!moves) return;
    e.preventDefault();
    // Steps add up from where the camera is heading, so quick repeated presses are not lost.
    goTo([THREE.MathUtils.clamp(goal[0] + moves[0], controls.minAzimuthAngle, controls.maxAzimuthAngle), THREE.MathUtils.clamp(goal[1] + moves[1], controls.minPolarAngle, controls.maxPolarAngle), THREE.MathUtils.clamp(goal[2] + moves[2], controls.minDistance, controls.maxDistance), goal[3]], durations.fast);
  });

  // ---- sizing -------------------------------------------------------------
  const ro = new ResizeObserver(() => {
    const { clientWidth: w, clientHeight: h } = canvas.parentElement;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the whole product in frame on tall, narrow viewports.
    camera.fov = w / h < 0.8 ? 44 : 32;
    camera.updateProjectionMatrix();
    invalidate();
  });
  ro.observe(canvas.parentElement);

  // ---- resilience ---------------------------------------------------------
  let lostTimer = 0;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    diag.contextLost = true;
    lostTimer = setTimeout(onLost, 3000); // give the browser a moment to restore it
  });
  canvas.addEventListener('webglcontextrestored', () => {
    clearTimeout(lostTimer);
    diag.contextLost = false;
    invalidate();
  });
  const visible = () => document.visibilityState === 'visible' && invalidate();
  document.addEventListener('visibilitychange', visible);

  function dispose() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    document.removeEventListener('visibilitychange', visible);
    controls.dispose();
    world.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      for (const m of [].concat(o.material)) {
        for (const v of Object.values(m)) v?.isTexture && v.dispose();
        m.dispose();
      }
    });
    shadowTex.dispose();
    renderer.dispose();
  }
  window.addEventListener('pagehide', dispose, { once: true });

  // ---- first frame --------------------------------------------------------
  await breathe();
  await renderer.compileAsync(world, camera); // parallel shader compilation where the driver supports it
  setFinish(state.finish, false);
  setTime(state.time);
  if (reduceMotion || embed) {
    applyView();
  } else {
    Object.assign(view, { az: HOME[0] - 0.5, pol: HOME[1], dist: HOME[2] + 0.9, ty: HOME[3] });
    applyView();
    goTo(HOME, durations.cinematic);
  }
  invalidate();

  const api = {
    setFinish: (id) => setFinish(id, true),
    setTime,
    setProgress,
    setScheme: () => setTime(state.time),
    resetView: () => {
      readView();
      goTo(HOME, durations.slow);
    },
    dispose,
  };
  // Read-only diagnostics for the QA harness.
  window.__scene = {
    get mode() {
      return diag.mode;
    },
    settled: () => tweens.size === 0,
    info: () => ({ frames: diag.frames, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, dpr, dprDrops: diag.dprDrops, contextLost: diag.contextLost, pendingTweens: tweens.size, rafActive: scheduled }),
    frameStats: () => {
      const s = [...diag.frameMs].sort((a, b) => a - b);
      return s.length ? { samples: s.length, medianMs: s[Math.floor(s.length / 2)], p95Ms: s[Math.floor(s.length * 0.95)], over33ms: s.filter((v) => v > 33.4).length } : { samples: 0 };
    },
    view: () => ({ ...view }),
    /** Render, then read a grid of pixels in the same task: how many distinct tones are on screen. */
    sample: () => {
      renderer.render(world, camera);
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      const tones = new Set();
      for (let y = 1; y < 24; y++) for (let x = 1; x < 24; x++) {
        gl.readPixels(Math.floor((gl.drawingBufferWidth * x) / 24), Math.floor((gl.drawingBufferHeight * y) / 24), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        tones.add(`${px[0] >> 3},${px[1] >> 3},${px[2] >> 3}`);
      }
      return tones.size;
    },
    sun: () => parts.Sun.position.toArray(),
    bodyColor: () => '#' + bodyMat.color.getHexString(),
    api,
  };
  return api;
}
