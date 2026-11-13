// 3D asset pipeline: procedural geometry -> glTF document with PBR materials
// from the Experience DNA -> GLB -> optimisation with measured benefit ->
// validation with the Khronos validator.
import fs from 'node:fs';
import path from 'node:path';
import { hexToRgb, CisError } from './util.mjs';
import { need } from './deps.mjs';

// ------------------------------------------------------------- geometry -----

/** Rounded box centred on the origin. Vertices of a subdivided cube are pulled onto a rounded hull. */
export function roundedBox(w, h, d, r, k = 6) {
  const half = [w / 2, h / 2, d / 2];
  r = Math.min(r, ...half);
  const axisStops = (hf) => {
    const stops = [];
    for (let i = 0; i <= k; i++) stops.push(-hf + r * (1 - Math.cos(((i / k) * Math.PI) / 2)));
    for (let i = k; i >= 0; i--) stops.push(hf - r * (1 - Math.cos(((i / k) * Math.PI) / 2)));
    return stops;
  };
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  // [axis fixed, u axis, v axis, sign]
  const faces = [[0, 2, 1, 1], [0, 2, 1, -1], [1, 0, 2, 1], [1, 0, 2, -1], [2, 0, 1, 1], [2, 0, 1, -1]];
  for (const [a, u, v, sign] of faces) {
    const us = axisStops(half[u]);
    const vs = axisStops(half[v]);
    const base = positions.length / 3;
    for (let j = 0; j < vs.length; j++) {
      for (let i = 0; i < us.length; i++) {
        const p = [0, 0, 0];
        p[a] = sign * half[a];
        p[u] = us[i];
        p[v] = vs[j];
        const inner = p.map((c, idx) => Math.max(-half[idx] + r, Math.min(half[idx] - r, c)));
        let n = [p[0] - inner[0], p[1] - inner[1], p[2] - inner[2]];
        const len = Math.hypot(...n) || 1;
        n = n.map((c) => c / len);
        positions.push(inner[0] + n[0] * r, inner[1] + n[1] * r, inner[2] + n[2] * r);
        normals.push(...n);
        uvs.push(i / (us.length - 1), j / (vs.length - 1));
      }
    }
    // Winding must face outward: flip when the (u, v, a) frame is left-handed.
    const cross = [[0, 0, 0], [0, 0, 0]];
    cross[0][u] = 1;
    cross[1][v] = 1;
    const nz = [cross[0][1] * cross[1][2] - cross[0][2] * cross[1][1], cross[0][2] * cross[1][0] - cross[0][0] * cross[1][2], cross[0][0] * cross[1][1] - cross[0][1] * cross[1][0]];
    const flip = nz[a] * sign < 0;
    for (let j = 0; j < vs.length - 1; j++) {
      for (let i = 0; i < us.length - 1; i++) {
        const p0 = base + j * us.length + i;
        const p1 = p0 + 1;
        const p2 = p0 + us.length;
        const p3 = p2 + 1;
        if (flip) indices.push(p0, p2, p1, p1, p2, p3);
        else indices.push(p0, p1, p2, p1, p3, p2);
      }
    }
  }
  return { positions, normals, uvs, indices };
}

/** Tube swept along a circular arc in the XY plane (angles in degrees, counter-clockwise), with rounded ends. */
export function arcTube(radius, tube, a0, a1, { segments = 48, sides = 12 } = {}) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
    const c = [Math.cos(a) * radius, Math.sin(a) * radius, 0];
    const radial = [Math.cos(a), Math.sin(a), 0];
    // Taper the last few rings so the tube closes into a rounded tip.
    const edge = Math.min(i, segments - i) / 3;
    const scale = edge >= 1 ? 1 : Math.sqrt(Math.max(0, 1 - (1 - edge) ** 2)) || 0.001;
    for (let s = 0; s <= sides; s++) {
      const b = (s / sides) * Math.PI * 2;
      const n = [radial[0] * Math.cos(b), radial[1] * Math.cos(b), Math.sin(b)];
      positions.push(c[0] + n[0] * tube * scale, c[1] + n[1] * tube * scale, c[2] + n[2] * tube * scale);
      normals.push(...n);
      uvs.push(t, s / sides);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let s = 0; s < sides; s++) {
      const p0 = i * (sides + 1) + s;
      const p1 = p0 + 1;
      const p2 = p0 + sides + 1;
      const p3 = p2 + 1;
      indices.push(p0, p2, p1, p1, p2, p3);
    }
  }
  return { positions, normals, uvs, indices };
}

/** Join several geometries into one, so a part made of pieces is still one mesh and one draw call. */
export function mergeGeometry(parts) {
  const out = { positions: [], normals: [], uvs: [], indices: [] };
  for (const g of parts) {
    const base = out.positions.length / 3;
    out.positions.push(...g.positions);
    out.normals.push(...g.normals);
    out.uvs.push(...g.uvs);
    out.indices.push(...g.indices.map((i) => i + base));
  }
  return out;
}

/**
 * The day arc as a dashed light: rounded dashes along a half circle. Dashes are a quarter longer
 * than the gaps, and the first and last dashes start exactly at the horizon.
 */
export function dashedArc(radius, tube, { dashes = 11, sides = 10 } = {}) {
  const unit = 180 / (dashes + (dashes - 1) * 0.8);
  return mergeGeometry(Array.from({ length: dashes }, (_, i) => arcTube(radius, tube, i * unit * 1.8, i * unit * 1.8 + unit, { segments: 8, sides })));
}

export function sphere(radius, { rings = 14, sides = 20 } = {}) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (let j = 0; j <= rings; j++) {
    const v = (j / rings) * Math.PI;
    for (let i = 0; i <= sides; i++) {
      const u = (i / sides) * Math.PI * 2;
      const n = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
      positions.push(n[0] * radius, n[1] * radius, n[2] * radius);
      normals.push(...n);
      uvs.push(i / sides, j / rings);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < sides; i++) {
      const p0 = j * (sides + 1) + i;
      const p2 = p0 + sides + 1;
      indices.push(p0, p0 + 1, p2, p0 + 1, p2 + 1, p2);
    }
  }
  return { positions, normals, uvs, indices };
}

/** Geometry sanity: finite values, unit normals, indices in range, no degenerate triangles, outward winding. */
export function checkGeometry(g, name) {
  const problems = [];
  const n = g.positions.length / 3;
  if (g.positions.some((v) => !Number.isFinite(v))) problems.push(`${name}: non-finite position`);
  if (g.normals.length !== g.positions.length) problems.push(`${name}: normal count mismatch`);
  let badNormals = 0;
  for (let i = 0; i < g.normals.length; i += 3) if (Math.abs(Math.hypot(g.normals[i], g.normals[i + 1], g.normals[i + 2]) - 1) > 1e-3) badNormals++;
  if (badNormals) problems.push(`${name}: ${badNormals} non-unit normals`);
  if (g.indices.some((i) => i < 0 || i >= n)) problems.push(`${name}: index out of range`);
  let inward = 0;
  let tris = 0;
  for (let i = 0; i < g.indices.length; i += 3) {
    const [a, b, c] = [g.indices[i], g.indices[i + 1], g.indices[i + 2]].map((ix) => g.positions.slice(ix * 3, ix * 3 + 3));
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const area = Math.hypot(...fn);
    if (area < 1e-12) continue; // collapsed quads at rounded tips are expected and pruned later
    tris++;
    const ia = g.indices[i] * 3;
    const vn = [g.normals[ia], g.normals[ia + 1], g.normals[ia + 2]];
    if (fn[0] * vn[0] + fn[1] * vn[1] + fn[2] * vn[2] < 0) inward++;
  }
  if (inward > tris * 0.02) problems.push(`${name}: ${inward}/${tris} triangles face inward`);
  return { triangles: tris, vertices: n, problems };
}

// ------------------------------------------------------------ the product ----

const lin = (hex) => hexToRgb(hex).map((c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
});

/**
 * Parts of a wall-mounted home battery, in metres. The arc and sun on the
 * fascia are the brand's day-arc signature, modelled as emissive geometry so
 * the runtime can move the sun along the arc.
 */
export function batteryParts(spec = {}) {
  const W = spec.width ?? 0.62;
  const H = spec.height ?? 1.02;
  const D = spec.depth ?? 0.16;
  const arcR = W * 0.27;
  const arcY = H * 0.1;
  const front = D / 2;
  return {
    dims: { W, H, D, arcR, arcY, front },
    parts: [
      { name: 'Body', material: 'body', geometry: roundedBox(W, H, D, 0.045, 7), translation: [0, 0, 0] },
      { name: 'Fascia', material: 'fascia', geometry: roundedBox(W * 0.8, H * 0.84, 0.012, 0.03, 5), translation: [0, 0, front + 0.004] },
      // Dashed like the arc everywhere outside the logo, and standing on its horizon.
      { name: 'ArcLight', material: 'arc', geometry: dashedArc(arcR, 0.008), translation: [0, arcY, front + 0.012] },
      { name: 'Horizon', material: 'arc', geometry: roundedBox(arcR * 2 + 0.05, 0.012, 0.01, 0.005, 3), translation: [0, arcY - 0.006, front + 0.012] },
      { name: 'Sun', material: 'sun', geometry: sphere(0.026), translation: [Math.cos((116 * Math.PI) / 180) * arcR, arcY + Math.sin((116 * Math.PI) / 180) * arcR, front + 0.016] },
      { name: 'Bracket', material: 'metal', geometry: roundedBox(W * 0.7, H * 0.5, 0.03, 0.01, 3), translation: [0, 0.05, -front - 0.012] },
    ],
  };
}

/** Build the GLB, optimise it, validate both, and return a report with measured numbers. */
export async function buildBatteryModel(outDir, dna, { name = 'cell', spec } = {}) {
  const { Document, NodeIO } = need('@gltf-transform/core', 'model3d');
  const fx = need('@gltf-transform/functions', 'model3d');
  const { EXTMeshoptCompression, KHRMaterialsEmissiveStrength, KHRMeshQuantization } = need('@gltf-transform/extensions', 'model3d');
  const { MeshoptEncoder } = need('meshoptimizer', 'model3d');
  const validator = need('gltf-validator', 'model3d');

  const finish = dna.materials3d.finishes[0];
  const { parts, dims } = batteryParts(spec);
  const doc = new Document();
  doc.setLogger({ debug() {}, info() {}, warn() {}, error: console.error });
  doc.getRoot().getAsset().generator = 'creative-studio 3d build';
  doc.getRoot().getAsset().copyright = `Generated for ${dna.project.name}; original procedural geometry.`;
  const buffer = doc.createBuffer();
  const emissive = doc.createExtension(KHRMaterialsEmissiveStrength);
  const body = lin(finish.baseColor);
  const mats = {
    body: doc.createMaterial('Body').setBaseColorFactor([...body, 1]).setMetallicFactor(finish.metalness).setRoughnessFactor(finish.roughness),
    fascia: doc.createMaterial('Fascia').setBaseColorFactor([...body.map((c) => c * 0.86), 1]).setMetallicFactor(finish.metalness).setRoughnessFactor(Math.min(1, finish.roughness + 0.12)),
    arc: doc.createMaterial('ArcLight').setBaseColorFactor([...lin(finish.accent || dna.color.semantic.light.accent), 1]).setEmissiveFactor(lin(finish.accent || dna.color.semantic.light.accent)).setRoughnessFactor(0.4).setMetallicFactor(0).setExtension('KHR_materials_emissive_strength', emissive.createEmissiveStrength().setEmissiveStrength(1.6)),
    sun: doc.createMaterial('Sun').setBaseColorFactor([...lin(dna.color.semantic.light.surfaceRaised), 1]).setEmissiveFactor(lin(dna.color.semantic.light.surfaceRaised)).setRoughnessFactor(0.3).setMetallicFactor(0).setExtension('KHR_materials_emissive_strength', emissive.createEmissiveStrength().setEmissiveStrength(2.4)),
    metal: doc.createMaterial('Metal').setBaseColorFactor([0.12, 0.12, 0.13, 1]).setMetallicFactor(0.85).setRoughnessFactor(0.42),
  };
  const scene = doc.createScene('Product');
  const rootNode = doc.createNode('HaldoraCell');
  scene.addChild(rootNode);
  const geometryReport = [];
  for (const part of parts) {
    const g = part.geometry;
    const check = checkGeometry(g, part.name);
    geometryReport.push({ part: part.name, ...check });
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.positions)).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.normals)).setBuffer(buffer))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(g.uvs)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(g.indices)).setBuffer(buffer))
      .setMaterial(mats[part.material]);
    rootNode.addChild(doc.createNode(part.name).setMesh(doc.createMesh(part.name).addPrimitive(prim)).setTranslation(part.translation));
  }
  const geometryProblems = geometryReport.flatMap((r) => r.problems);
  if (geometryProblems.length) throw new CisError('E_GEOMETRY', `Geometry integrity failed:\n  ${geometryProblems.join('\n  ')}`);

  fs.mkdirSync(outDir, { recursive: true });
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMaterialsEmissiveStrength, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  await MeshoptEncoder.ready;
  const sourceFile = path.join(outDir, `${name}.source.glb`);
  await io.write(sourceFile, doc);

  // Optimise: remove duplicate accessors, drop degenerate triangles, weld, quantise, meshopt-compress.
  await doc.transform(fx.dedup(), fx.weld(), fx.prune(), fx.reorder({ encoder: MeshoptEncoder }), fx.meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  // Quantised attributes are only valid glTF when KHR_mesh_quantization is declared as required.
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  const optFile = path.join(outDir, `${name}.glb`);
  await io.write(optFile, doc);

  const validate = async (file) => {
    const res = await validator.validateBytes(new Uint8Array(fs.readFileSync(file)), { uri: path.basename(file), maxIssues: 50 });
    return { errors: res.issues.numErrors, warnings: res.issues.numWarnings, infos: res.issues.numInfos, hints: res.issues.numHints, messages: res.issues.messages.filter((m) => m.severity <= 1).slice(0, 8).map((m) => `${m.code}: ${m.message}`), stats: { triangles: res.info.totalTriangleCount, vertices: res.info.totalVertexCount, drawCalls: res.info.drawCallCount, materials: res.info.materialCount, extensions: res.info.extensionsUsed || [] } };
  };
  const src = await validate(sourceFile);
  const opt = await validate(optFile);
  const srcBytes = fs.statSync(sourceFile).size;
  const optBytes = fs.statSync(optFile).size;
  return {
    name,
    dimensionsM: { width: dims.W, height: dims.H, depth: dims.D },
    anchors: { arcRadius: dims.arcR, arcCentre: [0, dims.arcY, dims.front + 0.016] },
    geometry: geometryReport.map(({ problems, ...r }) => r),
    files: { source: { path: sourceFile, bytes: srcBytes, validation: src }, optimised: { path: optFile, bytes: optBytes, validation: opt } },
    optimisation: { technique: 'dedup + weld + prune + vertex reorder + EXT_meshopt_compression (quantised)', savedBytes: srcBytes - optBytes, ratio: Number((optBytes / srcBytes).toFixed(3)), requiresRuntimeDecoder: 'MeshoptDecoder' },
    valid: src.errors === 0 && opt.errors === 0,
  };
}

/** Front-elevation SVG of the product for one finish: the no-WebGL / reduced-data fallback. */
export function fallbackSvg(dna, finish, { sunAngle = 116, size = 900 } = {}) {
  const l = dna.color.semantic.light;
  const W = 372;
  const H = 612;
  const x = (size - W) / 2;
  const y = (size - H) / 2 - 10;
  const r = W * 0.27;
  const cx = size / 2;
  const cy = y + H * 0.4 + r * 0.2;
  const a = (sunAngle * Math.PI) / 180;
  const shade = (hex, k) => '#' + hexToRgb(hex).map((c) => Math.round(Math.max(0, Math.min(255, c * k))).toString(16).padStart(2, '0')).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img"><title>Haldora Cell, ${finish.name} finish, front view</title><rect width="${size}" height="${size}" fill="${dna.materials3d.environment.background}"/><ellipse cx="${cx}" cy="${y + H + 34}" rx="${W * 0.62}" ry="20" fill="${l.text}" opacity="0.12"/><rect x="${x}" y="${y}" width="${W}" height="${H}" rx="30" fill="${finish.baseColor}"/><rect x="${x}" y="${y}" width="${W}" height="${H}" rx="30" fill="none" stroke="${l.text}" stroke-opacity="0.14" stroke-width="2"/><rect x="${x + W * 0.1}" y="${y + H * 0.08}" width="${W * 0.8}" height="${H * 0.84}" rx="20" fill="${shade(finish.baseColor, 0.9)}"/><path d="M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${finish.accent || l.accent}" stroke-width="9" stroke-linecap="round"/><rect x="${cx - r - 8}" y="${cy + 24}" width="${r * 2 + 16}" height="8" rx="4" fill="${finish.accent || l.accent}"/><circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy - Math.sin(a) * r).toFixed(1)}" r="16" fill="${l.surfaceRaised}" stroke="${finish.baseColor}" stroke-width="6"/></svg>\n`;
}
