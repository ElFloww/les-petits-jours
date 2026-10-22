import {
  ACESFilmicToneMapping, AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight, DoubleSide,
  ExtrudeGeometry, Float32BufferAttribute, Group, HemisphereLight, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshPhysicalMaterial, MeshStandardMaterial, PMREMGenerator, PerspectiveCamera, Plane, PlaneGeometry, PointLight, Points, PointsMaterial,
  Scene, Shape, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3, WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * A real 3D fir tree.
 *
 * Every needle is an individual instanced blade. Boughs are built like a Nordmann fir: whorls of main
 * branches that rise out of the trunk, droop and curl up at the tip; each carries flat, alternating
 * side twigs, and every twig is combed with needles — glossy dark green on top, silvery underneath,
 * with lighter new growth at the tips. Lit with physically based lights, reflective glass baubles,
 * a gold bead garland and fairy lights that actually light the needles around them.
 */

export interface TreeOptions { quality: 'high' | 'low'; snow?: boolean; seed?: number; autoRotate?: boolean; }
export interface TreeHandle { dispose(): void; setVisible(visible: boolean): void; }

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const UP = new Vector3(0, 1, 0);

interface Stem { pts: Vector3[]; r0: number; r1: number; }

function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,.35)') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, inner); gradient.addColorStop(.25, mid); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient; g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

/** Adds a gentle breeze to a material (needles and twigs share it so they stay attached). */
function addWind(material: MeshStandardMaterial, uniform: { value: number }) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = uniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        float reach = length(mvPosition.xz);
        float a = reach * 0.011;
        mvPosition.x += sin(uTime * 1.25 + mvPosition.y * 2.1 + mvPosition.z * 1.3) * a;
        mvPosition.z += cos(uTime * 1.05 + mvPosition.y * 1.7 + mvPosition.x * 1.2) * a;
        mvPosition.y += sin(uTime * 1.7 + mvPosition.x * 2.0) * a * 0.45;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
      `);
  };
}

export function mountTree(container: HTMLElement, options: TreeOptions): TreeHandle {
  const low = options.quality === 'low';
  const random = mulberry32(options.seed ?? 20261);
  const R = (a: number, b: number) => a + random() * (b - a);

  // ---------------------------------------------------------------- renderer
  const renderer = new WebGLRenderer({ antialias: !low, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'rtree-canvas';
  container.appendChild(canvas);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.16;

  const camera = new PerspectiveCamera(30, 1, 0.5, 40);
  const tree = new Group();
  scene.add(tree);

  // ---------------------------------------------------------------- lights
  scene.add(new HemisphereLight(0xdfe9f2, 0x1c2a1a, 0.32));
  const key = new DirectionalLight(0xfff0d8, 1.55); key.position.set(3.5, 6.5, 5); scene.add(key);
  const rim = new DirectionalLight(0xa9c9ff, 0.9); rim.position.set(-5, 3, -4); scene.add(rim);
  const glowLights = [
    { color: 0xffb35c, y: 1.1, x: .5, z: .9 }, { color: 0xffc27a, y: 1.8, x: -.5, z: .8 },
    { color: 0xffd9a0, y: 2.3, x: .3, z: .6 }, { color: 0xffb870, y: 0.9, x: -.6, z: .9 },
  ].map(spec => { const l = new PointLight(spec.color, 0.7, 2.4, 1.8); l.position.set(spec.x, spec.y, spec.z); scene.add(l); return l; });

  // ---------------------------------------------------------------- tree structure
  const stems: Stem[] = [];
  const needleData: { m: Matrix4; c: Color }[] = [];
  const lightSpots: Vector3[] = [];
  const ornamentSpots: Vector3[] = [];
  const snowSpots: { p: Vector3; s: number }[] = [];
  const tmpM = new Matrix4();
  const X = new Vector3(), Y = new Vector3(), Z = new Vector3();
  const fresh = new Color(), col = new Color();

  const TOP = 3.05, BOTTOM = 0.6;
  const spacing = low ? 0.03 : 0.02;

  function needlesAlong(stem: Vector3[], opts: { len: number; maxR: number; tipFresh: boolean; perNode: number; snowy: boolean }) {
    const n = stem.length - 1;
    // Resample the stem so that nodes are evenly spaced.
    let total = 0;
    for (let i = 0; i < n; i++) total += stem[i].distanceTo(stem[i + 1]);
    const steps = Math.max(2, Math.floor(total / spacing));
    const tangent = new Vector3(), up = new Vector3(), side = new Vector3(), dir = new Vector3(), pos = new Vector3();
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const f = t * n, i = Math.min(n - 1, Math.floor(f));
      pos.lerpVectors(stem[i], stem[i + 1], f - i);
      tangent.subVectors(stem[i + 1], stem[i]).normalize();
      up.copy(UP).addScaledVector(tangent, -UP.dot(tangent)).normalize();
      side.crossVectors(tangent, up).normalize();
      const taper = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.85)) ** 0.6;
      const radial = Math.hypot(pos.x, pos.z);
      const ao = 0.3 + 0.7 * smoothstep(0.0, Math.max(0.6, opts.maxR), radial);
      const isTip = opts.tipFresh && t > 0.8;
      for (let j = 0; j < opts.perNode; j++) {
        // Angle around the stem measured from "up": mostly on top and the flanks, a few underneath.
        const underside = random() < 0.16;
        const phi = underside ? R(2.4, 3.9) : R(-1.75, 1.75);
        const theta = R(0.62, 0.95);
        const ring = new Vector3().addScaledVector(up, Math.cos(phi)).addScaledVector(side, Math.sin(phi));
        dir.copy(tangent).multiplyScalar(Math.cos(theta)).addScaledVector(ring, Math.sin(theta));
        dir.y -= 0.05; dir.normalize();
        const length = opts.len * taper * R(0.78, 1.12);
        const width = R(0.82, 1.15);
        // Blade basis: z along the needle, x across it (flat side facing mostly up).
        Z.copy(dir);
        X.crossVectors(UP, Z); if (X.lengthSq() < 1e-4) X.set(1, 0, 0); X.normalize();
        Y.crossVectors(Z, X).normalize();
        const p = pos.clone().addScaledVector(ring, 0.006);
        tmpM.makeBasis(X.clone().multiplyScalar(width), Y.clone(), Z.clone().multiplyScalar(length)).setPosition(p);
        // Colour: glossy dark green on top, silvery blue-green underneath, lighter new growth at the tips.
        const lum = R(-0.03, 0.04);
        if (underside) col.setHSL(R(0.42, 0.47), 0.32, 0.26 + lum);
        else col.setHSL(R(0.35, 0.41), R(0.55, 0.72), 0.07 + lum * 0.7 + 0.055 * Math.max(0, ring.y));
        if (isTip && !underside) { fresh.setHSL(R(0.22, 0.28), R(0.5, 0.7), R(0.2, 0.28)); col.lerp(fresh, 0.55); }
        col.multiplyScalar(ao);
        if (opts.snowy && !underside && random() < 0.03) col.lerp(new Color(0xeef6fb), 0.7);
        needleData.push({ m: tmpM.clone(), c: col.clone() });
      }
    }
  }

  function buildBranch(az: number, yRoot: number, len: number, f: number, whorl: number) {
    const droop = 0.55 + f * 0.32;
    const n = 14;
    const spine: Vector3[] = [];
    const wob = R(-0.12, 0.12), wobPhase = R(0, 6);
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const r = len * s;
      const y = yRoot + len * (0.12 * s - 0.30 * droop * Math.pow(s, 1.7)) + len * 0.11 * (0.4 + f) * Math.pow(smoothstep(0.8, 1, s), 2);
      const a = az + Math.sin(s * 3 + wobPhase) * wob * s;
      spine.push(new Vector3(Math.cos(a) * (r + 0.04), y, Math.sin(a) * (r + 0.04)));
    }
    stems.push({ pts: spine, r0: 0.022 + f * 0.018, r1: 0.004 });
    const maxR = 0.16 + 1.22 * Math.pow(f, 0.85);
    needlesAlong(spine, { len: 0.125, maxR, tipFresh: true, perNode: low ? 5 : 9, snowy: false });

    // Alternating side twigs, almost in one plane — the typical flat "spray" of a fir.
    const tan = new Vector3(), lat = new Vector3(), up = new Vector3();
    const stepS = low ? 0.085 : 0.05;
    for (let s = 0.1; s < 0.985; s += stepS * R(0.8, 1.25)) {
      const idx = s * n, i = Math.min(n - 1, Math.floor(idx));
      const base = new Vector3().lerpVectors(spine[i], spine[i + 1], idx - i);
      tan.subVectors(spine[i + 1], spine[i]).normalize();
      lat.crossVectors(UP, tan).normalize();
      up.crossVectors(tan, lat).normalize();
      for (const side of [-1, 1]) {
        const twigLen = (len * 0.44 * Math.pow(Math.sin(Math.PI * (0.1 + 0.86 * s)), 0.9) + 0.07) * R(0.72, 1.18);
        const ang = R(0.85, 1.15);
        const dir = tan.clone().multiplyScalar(Math.cos(ang)).addScaledVector(lat, side * Math.sin(ang)).addScaledVector(up, 0.1).normalize();
        const pts: Vector3[] = [];
        for (let k = 0; k <= 4; k++) {
          const t = k / 4;
          pts.push(base.clone().addScaledVector(dir, twigLen * t).add(new Vector3(0, -0.16 * twigLen * t * t + 0.05 * twigLen * Math.sin(t * Math.PI), 0)));
        }
        stems.push({ pts, r0: 0.0075, r1: 0.0018 });
        const outer = s > 0.45;
        needlesAlong(pts, { len: 0.12, maxR, tipFresh: random() < 0.22, perNode: low ? 5 : 9, snowy: !!options.snow && outer });
        const tip = pts[4];
        if (outer && random() < 0.12) lightSpots.push(tip.clone().add(new Vector3(0, -0.035, 0)));
        if (s > 0.55 && random() < 0.1) ornamentSpots.push(tip.clone());
        if (options.snow && outer && random() < 0.28) snowSpots.push({ p: pts[3 - Math.floor(random() * 2)].clone(), s: R(0.5, 1.2) });
      }
    }
    // Terminal tuft.
    const tip = spine[n], before = spine[n - 1];
    const dirTip = tip.clone().sub(before).normalize();
    const tuft: Vector3[] = [tip.clone(), tip.clone().addScaledVector(dirTip, 0.1), tip.clone().addScaledVector(dirTip, 0.2).add(new Vector3(0, 0.02, 0))];
    needlesAlong(tuft, { len: 0.1, maxR, tipFresh: true, perNode: 6, snowy: false });
    if (whorl % 2 === 0 && random() < 0.5) ornamentSpots.push(tip.clone());
  }

  const tiers = low ? 11 : 14;
  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1);
    const y = TOP - f * (TOP - BOTTOM);
    const maxLen = 0.17 + 1.2 * Math.pow(f, 0.85);
    const count = Math.round(5 + f * 4);
    const az0 = R(0, Math.PI * 2);
    for (let b = 0; b < count; b++) buildBranch(az0 + (b * Math.PI * 2) / count + R(-0.2, 0.2), y + R(-0.05, 0.05), maxLen * R(0.88, 1.12), f, b);
    // A second, shorter whorl in between fills the gaps and gives the tree its density.
    const yMid = y - (TOP - BOTTOM) / (tiers - 1) * 0.5;
    for (let b = 0; b < count; b++) buildBranch(az0 + ((b + 0.5) * Math.PI * 2) / count + R(-0.2, 0.2), yMid, maxLen * R(0.62, 0.8), f, b + 1);
    for (let b = 0; b < count; b++) buildBranch(az0 + ((b + 0.25) * Math.PI * 2) / count + R(-0.2, 0.2), y - (TOP - BOTTOM) / (tiers - 1) * 0.25, maxLen * R(0.5, 0.7), f, b + 1);
  }
  // Leader at the very top.
  {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 8; i++) pts.push(new Vector3(Math.sin(i) * 0.004, 2.95 + i * 0.045, 0));
    stems.push({ pts, r0: 0.012, r1: 0.003 });
    needlesAlong(pts, { len: 0.085, maxR: 0.3, tipFresh: true, perNode: 8, snowy: false });
  }

  // ---------------------------------------------------------------- needles mesh
  const needleGeometry = new BufferGeometry();
  needleGeometry.setAttribute('position', new Float32BufferAttribute([
    -0.5 * 0.014, 0, 0, 0.5 * 0.014, 0, 0, -0.46 * 0.014, 0.004, 0.5, 0.46 * 0.014, 0.004, 0.5, 0, 0.0, 1,
  ], 3));
  needleGeometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  needleGeometry.computeVertexNormals();
  const time = { value: 0 };
  const needleMaterial = new MeshStandardMaterial({ roughness: 0.5, metalness: 0, side: DoubleSide, envMapIntensity: 0.22 });
  addWind(needleMaterial, time);
  const needles = new InstancedMesh(needleGeometry, needleMaterial, needleData.length);
  const colors = new Float32Array(needleData.length * 3);
  needleData.forEach((d, i) => { needles.setMatrixAt(i, d.m); colors[i * 3] = d.c.r; colors[i * 3 + 1] = d.c.g; colors[i * 3 + 2] = d.c.b; });
  needles.instanceColor = new InstancedBufferAttribute(colors, 3);
  needles.instanceMatrix.needsUpdate = true;
  needles.frustumCulled = false;
  tree.add(needles);

  // ---------------------------------------------------------------- twigs & trunk
  {
    const positions: number[] = [], normals: number[] = [], vertexColors: number[] = [], indices: number[] = [];
    const seg = 5;
    const tangent = new Vector3(), a = new Vector3(), b = new Vector3();
    const base = new Color(0x3a2a1c), green = new Color(0x2d3a22);
    for (const stem of stems) {
      const start = positions.length / 3;
      const m = stem.pts.length;
      for (let i = 0; i < m; i++) {
        const t = i / (m - 1);
        const p = stem.pts[i];
        tangent.subVectors(stem.pts[Math.min(m - 1, i + 1)], stem.pts[Math.max(0, i - 1)]).normalize();
        a.crossVectors(tangent, UP); if (a.lengthSq() < 1e-4) a.set(1, 0, 0); a.normalize();
        b.crossVectors(tangent, a).normalize();
        const r = stem.r0 + (stem.r1 - stem.r0) * t;
        const c = base.clone().lerp(green, t);
        for (let j = 0; j < seg; j++) {
          const ang = (j / seg) * Math.PI * 2;
          const nx = a.x * Math.cos(ang) + b.x * Math.sin(ang), ny = a.y * Math.cos(ang) + b.y * Math.sin(ang), nz = a.z * Math.cos(ang) + b.z * Math.sin(ang);
          positions.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
          normals.push(nx, ny, nz);
          vertexColors.push(c.r, c.g, c.b);
        }
      }
      for (let i = 0; i < m - 1; i++) for (let j = 0; j < seg; j++) {
        const i0 = start + i * seg + j, i1 = start + i * seg + ((j + 1) % seg), i2 = i0 + seg, i3 = i1 + seg;
        indices.push(i0, i2, i1, i1, i2, i3);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(vertexColors, 3));
    geometry.setIndex(indices);
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, envMapIntensity: 0.3 });
    addWind(material, time);
    const twigs = new Mesh(geometry, material);
    twigs.frustumCulled = false;
    tree.add(twigs);

    // Trunk with bark-like colour variation.
    const trunkGeometry = new CylinderGeometry(0.05, 0.1, 1.9, 14, 8, true);
    const pos = trunkGeometry.getAttribute('position');
    const tc: number[] = [];
    for (let i = 0; i < pos.count; i++) { const v = 0.55 + 0.45 * random(); tc.push(0.26 * v, 0.17 * v, 0.1 * v); }
    trunkGeometry.setAttribute('color', new Float32BufferAttribute(tc, 3));
    const trunk = new Mesh(trunkGeometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    trunk.position.y = 0.95;
    tree.add(trunk);
  }

  // ---------------------------------------------------------------- snow clumps
  if (options.snow && snowSpots.length) {
    const snow = new InstancedMesh(new SphereGeometry(0.03, 7, 5), new MeshStandardMaterial({ color: 0xf4f9fd, roughness: 0.9, envMapIntensity: 0.8 }), snowSpots.length);
    snowSpots.forEach((s, i) => { tmpM.makeScale(s.s * 1.4, s.s * 0.55, s.s).setPosition(s.p.x, s.p.y + 0.012, s.p.z); snow.setMatrixAt(i, tmpM); });
    snow.frustumCulled = false;
    tree.add(snow);
  }

  // ---------------------------------------------------------------- baubles
  const baubleColors = [0xc8222f, 0xe0b04a, 0x2f7fc4, 0xc8222f, 0xdfe6ea, 0x2f9a63, 0xd84f98, 0xe0b04a];
  const baubleCount = Math.min(ornamentSpots.length, low ? 30 : 56);
  const chosen = ornamentSpots.sort(() => random() - 0.5).slice(0, baubleCount);
  const baubleGeometry = new SphereGeometry(1, 28, 20);
  const capGeometry = new CylinderGeometry(0.28, 0.34, 0.34, 10);
  const capMaterial = new MeshStandardMaterial({ color: 0xd9b45a, metalness: 1, roughness: 0.28, envMap: envTexture, envMapIntensity: 1.2 });
  const thread = new MeshBasicMaterial({ color: 0xcdb27a });
  chosen.forEach((spot, i) => {
    const radius = R(0.07, 0.115);
    const drop = R(0.07, 0.13);
    const material = new MeshPhysicalMaterial({
      color: baubleColors[i % baubleColors.length], metalness: i % 4 === 1 ? 1 : 0.55, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, envMap: envTexture, envMapIntensity: 1.5,
    });
    const ball = new Mesh(baubleGeometry, material);
    ball.scale.setScalar(radius);
    ball.position.set(spot.x, spot.y - drop - radius, spot.z);
    const cap = new Mesh(capGeometry, capMaterial);
    cap.scale.setScalar(radius * 0.55);
    cap.position.set(spot.x, spot.y - drop + radius * 0.02, spot.z);
    const wire = new Mesh(new CylinderGeometry(0.0015, 0.0015, drop, 4), thread);
    wire.position.set(spot.x, spot.y - drop / 2, spot.z);
    tree.add(ball, cap, wire);
  });

  // ---------------------------------------------------------------- gold bead garland
  {
    const beadGeometry = new SphereGeometry(0.021, 10, 8);
    const gold = new MeshStandardMaterial({ color: 0xe6bd55, metalness: 1, roughness: 0.22, envMap: envTexture, envMapIntensity: 1.3 });
    const pts: Vector3[] = [];
    const turns = 3.4, samples = 520;
    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      const y0 = 2.85 - u * 2.15;
      const angle = u * Math.PI * 2 * turns;
      const phase = ((angle * 1.5) / (Math.PI * 2)) % 1;
      const y = y0 - 0.11 * Math.sin(Math.PI * phase);
      const outer = 0.12 + 1.02 * Math.pow((3.1 - y) / 2.6, 0.92);
      pts.push(new Vector3(Math.cos(angle) * outer, y, Math.sin(angle) * outer));
    }
    const beads: Vector3[] = [pts[0]];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) { acc += pts[i].distanceTo(pts[i - 1]); if (acc > 0.05) { beads.push(pts[i]); acc = 0; } }
    const mesh = new InstancedMesh(beadGeometry, gold, beads.length);
    beads.forEach((p, i) => { tmpM.makeTranslation(p.x, p.y, p.z); mesh.setMatrixAt(i, tmpM); });
    mesh.frustumCulled = false;
    tree.add(mesh);
  }

  // ---------------------------------------------------------------- fairy lights
  const lampColors = [0xffe3a0, 0xff6a73, 0x7dd6ff, 0x8dffb4, 0xffa3d9, 0xffd36a].map(c => new Color(c));
  const lampCount = Math.min(lightSpots.length, low ? 46 : 80);
  const lamps = lightSpots.sort(() => random() - 0.5).slice(0, lampCount);
  const lampPhase = lamps.map(() => random() * 6.28);
  const lampSpeed = lamps.map(() => R(0.9, 2.2));
  const lampColor = lamps.map((_, i) => lampColors[i % lampColors.length]);
  const glowGeometry = new BufferGeometry();
  glowGeometry.setAttribute('position', new Float32BufferAttribute(lamps.flatMap(p => [p.x, p.y, p.z]), 3));
  const glowColors = new Float32Array(lamps.length * 3);
  glowGeometry.setAttribute('color', new BufferAttribute(glowColors, 3));
  const glowMaterial = new PointsMaterial({ size: low ? 0.55 : 0.5, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true });
  const glow = new Points(glowGeometry, glowMaterial);
  glow.frustumCulled = false;
  tree.add(glow);
  const bulbs = new InstancedMesh(new SphereGeometry(0.024, 10, 8), new MeshBasicMaterial({ color: 0xffffff }), lamps.length);
  lamps.forEach((p, i) => { tmpM.makeTranslation(p.x, p.y, p.z); bulbs.setMatrixAt(i, tmpM); bulbs.setColorAt(i, lampColor[i].clone().lerp(new Color(0xffffff), 0.45)); });
  bulbs.frustumCulled = false;
  tree.add(bulbs);

  // ---------------------------------------------------------------- star
  const starGroup = new Group();
  {
    const shape = new Shape();
    for (let i = 0; i < 10; i++) {
      const ang = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.092 : 0.21;
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      if (i) shape.lineTo(x, y); else shape.moveTo(x, y);
    }
    shape.closePath();
    const geometry = new ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.018, bevelSegments: 3 });
    geometry.translate(0, 0, -0.025);
    const star = new Mesh(geometry, new MeshStandardMaterial({ color: 0xffd45e, emissive: 0xffa928, emissiveIntensity: 0.9, metalness: 0.9, roughness: 0.25, envMap: envTexture, envMapIntensity: 1.2 }));
    starGroup.add(star);
    const halo = new Points(new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0.05], 3)),
      new PointsMaterial({ size: 1.35, map: glowTexture('rgba(255,236,170,1)', 'rgba(255,205,100,.4)'), transparent: true, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true }));
    starGroup.add(halo);
    starGroup.position.set(0, 3.37, 0);
    tree.add(starGroup);
    const starLight = new PointLight(0xffd27a, 4, 2.4, 1.4); starLight.position.set(0, 3.25, 0.2); tree.add(starLight);
  }

  // ---------------------------------------------------------------- ground: skirt & soft shadow
  {
    const skirt = new Mesh(new CylinderGeometry(1.02, 1.04, 0.035, 64), new MeshStandardMaterial({ color: 0xd9cdb4, roughness: 0.95 }));
    skirt.position.y = 0.018;
    const rim = new Mesh(new TorusGeometry(1.03, 0.028, 10, 80), new MeshStandardMaterial({ color: 0xb8222f, roughness: 0.7 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.03;
    tree.add(skirt, rim);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 128;
    const g = shadowCanvas.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(20,12,6,.5)'); grad.addColorStop(.6, 'rgba(20,12,6,.18)'); grad.addColorStop(1, 'rgba(20,12,6,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    const shadow = new Mesh(new PlaneGeometry(2.9, 2.9), new MeshBasicMaterial({ map: new CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.004;
    scene.add(shadow);
  }
  void Plane;

  // ---------------------------------------------------------------- camera, controls & loop
  const target = new Vector3(0, 1.72, 0);
  let yaw = options.seed ? 0.4 : 0.3, targetYaw = yaw, velocity = 0, dragging = false, lastX = 0, hoverTilt = 0, hoverTarget = 0;
  const autoRotate = options.autoRotate ?? true;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const distance = 8.6;

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; velocity = 0; canvas.setPointerCapture(e.pointerId); };
  const move = (e: PointerEvent) => {
    if (dragging) { const dx = e.clientX - lastX; lastX = e.clientX; targetYaw += dx * 0.011; velocity = dx * 0.011; }
    else if (e.pointerType === 'mouse') { const r = canvas.getBoundingClientRect(); hoverTarget = ((e.clientY - r.top) / r.height - 0.5) * -0.14; }
  };
  const up = (e: PointerEvent) => { dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch { /* already released */ } };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  let visible = true, running = true, frame = 0, last = performance.now();
  const clock0 = performance.now();
  function render(now: number) {
    frame = 0;
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - clock0) / 1000;
    time.value = reduced ? 0 : t;
    if (!dragging) {
      targetYaw += velocity; velocity *= 0.94;
      if (autoRotate && !reduced) targetYaw += dt * 0.16;
    }
    yaw += (targetYaw - yaw) * 0.18;
    hoverTilt += (hoverTarget - hoverTilt) * 0.06;
    tree.rotation.y = yaw;
    camera.position.set(0, target.y + 0.95 + hoverTilt * 8, distance);
    camera.lookAt(target);
    starGroup.rotation.y = reduced ? 0 : t * 0.9;

    for (let i = 0; i < lamps.length; i++) {
      const k = reduced ? 1 : 0.55 + 0.45 * Math.sin(t * lampSpeed[i] + lampPhase[i]);
      glowColors[i * 3] = lampColor[i].r * k * 1.25; glowColors[i * 3 + 1] = lampColor[i].g * k * 1.25; glowColors[i * 3 + 2] = lampColor[i].b * k * 1.25;
    }
    (glowGeometry.getAttribute('color') as BufferAttribute).needsUpdate = true;
    glowLights.forEach((l, i) => { l.intensity = reduced ? 1.1 : 0.9 + 0.5 * Math.sin(t * (1.1 + i * 0.37) + i * 1.7); });
    renderer.render(scene, camera);
    if (visible && !reduced) frame = requestAnimationFrame(render);
  }
  const start = () => { if (!frame) { last = performance.now(); frame = requestAnimationFrame(render); } };
  start();
  if (reduced) { // Static, but keep reacting to drags.
    const kick = () => start();
    canvas.addEventListener('pointermove', kick);
  }

  return {
    setVisible(value: boolean) { visible = value; if (value) start(); },
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
      scene.traverse(object => {
        const mesh = object as Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;
        if (Array.isArray(material)) material.forEach(m => m.dispose()); else material?.dispose();
      });
      envTexture.dispose(); pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
