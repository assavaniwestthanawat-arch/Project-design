// SBP AirCare — soft air wisps (Rev.09 round 3, owner: "ลมต้องดูเป็นธรรมชาติ ไม่ใช่เหมือนสาดน้ำ").
// Air is invisible; what reads as "air" in a picture is a thin, translucent streamline that drifts, spreads and fades —
// like smoke in a wind tunnel — not bright blue drops or dashes. Every air visual (room air physics in airflow3d,
// the cut-away flows in howitworks3d and the unit viewer in ac3d) draws through this one renderer:
// each particle is a short polyline (head → tail); every segment is a camera-facing ribbon whose alpha and width
// taper toward the tail. Ribbons keep at least ~1 px on screen (alpha is reduced instead), so thin wisps never flicker.
import * as THREE from './three.module.min.js';

const VERT = /* glsl */`
attribute vec3 aP0; attribute vec3 aP1; attribute vec3 aC; attribute vec2 aA; attribute vec2 aW;
uniform float uPx; uniform float uMinPx;
varying vec3 vC; varying float vA; varying float vY;
void main(){
  vec4 a = modelViewMatrix * vec4(aP0, 1.0); vec4 b = modelViewMatrix * vec4(aP1, 1.0);
  vec2 d = b.xy - a.xy; float L = length(d); vec2 n = L > 1e-6 ? vec2(-d.y, d.x) / L : vec2(1.0, 0.0);
  vec4 p = mix(a, b, position.x);
  float w = mix(aW.x, aW.y, position.x);
  float wMin = uMinPx * uPx * max(0.05, -p.z);        // world width of uMinPx pixels at this depth
  float we = max(w, wMin);
  p.xy += n * we * position.y;
  vC = aC; vA = mix(aA.x, aA.y, position.x) * (w / we); vY = position.y;
  gl_Position = projectionMatrix * p;
}`;
const FRAG = /* glsl */`
uniform float uOp;
varying vec3 vC; varying float vA; varying float vY;
void main(){
  float across = 1.0 - abs(vY);
  float a = vA * uOp * across * across * (3.0 - 2.0 * across);   // smooth soft edge
  if (a < 0.003) discard;
  gl_FragColor = vec4(vC, a);
}`;

/**
 * createWisps(parent, { max, additive }) → batch
 *   batch.begin(); batch.seg(x0,y0,z0, x1,y1,z1, r,g,b, a0,a1, w0,w1) …; batch.end();
 *   batch.mesh.material.opacity scales every wisp (kept for callers that fade a whole flow).
 */
export function createWisps(parent, o = {}) {
  const max = o.max || 4096;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3)); geo.setIndex([0, 1, 2, 0, 2, 3]);
  const P0 = new Float32Array(max * 3), P1 = new Float32Array(max * 3), C = new Float32Array(max * 3), A = new Float32Array(max * 2), Wd = new Float32Array(max * 2);
  const att = [['aP0', P0, 3], ['aP1', P1, 3], ['aC', C, 3], ['aA', A, 2], ['aW', Wd, 2]].map(([k, arr, n]) => { const a = new THREE.InstancedBufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); return a; });
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uPx: { value: 0.002 }, uMinPx: { value: o.minPx ?? 1.1 }, uOp: { value: 1 } },
  });
  mat.opacity = 1;
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = o.renderOrder ?? 6;
  // world size of one pixel at unit depth, from the camera actually rendering this frame
  mesh.onBeforeRender = (r, s, cam) => {
    const hpx = r.domElement.height / r.getPixelRatio() || 600;
    mat.uniforms.uPx.value = cam.isPerspectiveCamera ? 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / (cam.zoom || 1) / hpx : (cam.top - cam.bottom) / (cam.zoom || 1) / hpx;
    mat.uniforms.uOp.value = mat.opacity;
  };
  parent && parent.add(mesh);
  let n = 0;
  return {
    mesh, max,
    begin() { n = 0; },
    seg(x0, y0, z0, x1, y1, z1, r, g, b, a0, a1, w0, w1 = w0) {
      if (n >= max) return; const i3 = n * 3, i2 = n * 2;
      P0[i3] = x0; P0[i3 + 1] = y0; P0[i3 + 2] = z0; P1[i3] = x1; P1[i3 + 1] = y1; P1[i3 + 2] = z1;
      C[i3] = r; C[i3 + 1] = g; C[i3 + 2] = b; A[i2] = a0; A[i2 + 1] = a1; Wd[i2] = w0; Wd[i2 + 1] = w1; n++;
    },
    end() { geo.instanceCount = n; att.forEach(a => { a.needsUpdate = true; a.addUpdateRange ? (a.clearUpdateRanges(), a.addUpdateRange(0, n * a.itemSize)) : null; }); },
    count: () => n,
    setAdditive(v) { mat.blending = v ? THREE.AdditiveBlending : THREE.NormalBlending; mat.needsUpdate = true; },
    dispose() { geo.dispose(); mat.dispose(); mesh.parent && mesh.parent.remove(mesh); },
  };
}

// soften a temperature colour for air: less saturated, a touch lighter (cold air is a pale cyan haze, not water-blue)
export function airTint(rgb, dark, out = rgb) {
  const l = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2], k = dark ? 0.78 : 0.72;   // keep k of the chroma
  const lift = dark ? 0.07 : 0.04;
  out[0] = Math.min(1, l + (rgb[0] - l) * k + lift); out[1] = Math.min(1, l + (rgb[1] - l) * k + lift); out[2] = Math.min(1, l + (rgb[2] - l) * k + lift);
  return out;
}

// cheap smooth 3-D "turbulence" (sum of sines): returns a gentle swirl vector at (x, y, z, t) into out
export function swirl(x, y, z, t, s, out) {
  out[0] = Math.sin(y * 2.1 + t * 0.9 + s) + 0.6 * Math.sin(z * 3.3 - t * 1.3 + s * 2.1);
  out[1] = 0.55 * (Math.sin(x * 1.9 + t * 0.7 + s * 1.7) + 0.5 * Math.sin(z * 2.7 + t * 1.1));
  out[2] = Math.sin(x * 2.3 - t * 1.1 + s * 0.6) + 0.6 * Math.sin(y * 3.1 + t * 0.8 + s * 2.9);
  return out;
}

// faint "cool air mass" haze: large soft sprites at a fraction of the wisp heads (very low alpha each)
const HVERT = /* glsl */`
attribute vec3 aC; attribute float aA; attribute float aS;
uniform float uPx; varying vec3 vC; varying float vA;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(aS / (uPx * max(0.05, -mv.z)), 1.0, 220.0); vC = aC; vA = aA; gl_Position = projectionMatrix * mv; }`;
const HFRAG = /* glsl */`
uniform float uOp; varying vec3 vC; varying float vA;
void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard; float a = vA * uOp * exp(-3.2 * r) * (1.0 - r); gl_FragColor = vec4(vC, a); }`;
export function createHaze(parent, o = {}) {
  const max = o.max || 1024;
  const geo = new THREE.BufferGeometry();
  const P = new Float32Array(max * 3), C = new Float32Array(max * 3), A = new Float32Array(max), Sz = new Float32Array(max);
  const att = [['position', P, 3], ['aC', C, 3], ['aA', A, 1], ['aS', Sz, 1]].map(([k, arr, n]) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); return a; });
  geo.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({ vertexShader: HVERT, fragmentShader: HFRAG, transparent: true, depthWrite: false, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uPx: { value: 0.002 }, uOp: { value: 1 } } });
  mat.opacity = 1;
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = (o.renderOrder ?? 6) - 1;
  pts.onBeforeRender = (r, s, cam) => { const hpx = r.domElement.height / r.getPixelRatio() || 600; mat.uniforms.uPx.value = 2 * Math.tan(THREE.MathUtils.degToRad((cam.fov || 40) / 2)) / (cam.zoom || 1) / hpx; mat.uniforms.uOp.value = mat.opacity; };
  parent && parent.add(pts);
  let n = 0;
  return {
    mesh: pts,
    begin() { n = 0; },
    add(x, y, z, r, g, b, a, size) { if (n >= max) return; const i3 = n * 3; P[i3] = x; P[i3 + 1] = y; P[i3 + 2] = z; C[i3] = r; C[i3 + 1] = g; C[i3 + 2] = b; A[n] = a; Sz[n] = size; n++; },
    end() { geo.setDrawRange(0, n); att.forEach(a => { a.needsUpdate = true; }); },
    setAdditive(v) { mat.blending = v ? THREE.AdditiveBlending : THREE.NormalBlending; mat.needsUpdate = true; },
    dispose() { geo.dispose(); mat.dispose(); pts.parent && pts.parent.remove(pts); },
  };
}
