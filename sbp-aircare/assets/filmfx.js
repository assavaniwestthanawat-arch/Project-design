// SBP AirCare — film effects for the r16 editions: kinetic titles, film grain, interface sounds. All of it is decoration
// over content that is already complete in the HTML: titles keep their text for screen readers and search, grain and sound
// are off for reduced motion, sound only ever starts from a click.
//   kinetic(root)  every [data-kinetic] heading is split into Thai words (Intl.Segmenter — Thai has no spaces between words,
//                  so splitting by letters would break lines inside words) and plays its entrance once, when it is seen
//   grain(el)      a moving film grain over el (one small noise tile made on a canvas, moved by the compositor)
//   tone(kind)     a short interface sound (WebAudio) — only after sound(true) from a visitor's click
import { $$ } from './sbp-core.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let seen = null;
export function kinetic(root = document) {
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
  if (!seen) seen = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('k-on'); seen.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
  $$('[data-kinetic]', root).forEach(el => {
    if (el.dataset.k) return;
    el.dataset.k = '1';
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    // a .nw span inside the heading stays one unit (a word the segmenter would split, e.g. a name)
    const parts = [];
    el.childNodes.forEach(nd => {
      if (nd.nodeType === 1 && nd.classList.contains('nw')) { parts.push({ nw: nd.textContent }); return; }
      const t = (nd.textContent || '').replace(/\s+/g, ' ');
      (seg ? [...seg.segment(t)].map(s => s.segment) : t.split(/(\s+)/)).forEach(w => parts.push(w));
    });
    const vis = document.createElement('span'); vis.className = 'kw-line'; vis.setAttribute('aria-hidden', 'true');
    let n = 0;
    parts.forEach(w => {
      if (!w) return;
      if (typeof w === 'string' && /^\s+$/.test(w)) { vis.append(' '); return; }
      const s = document.createElement('span'); s.className = typeof w === 'string' ? 'kw' : 'kw nw'; s.style.setProperty('--i', n++); s.textContent = typeof w === 'string' ? w : w.nw; vis.append(s);
    });
    const sr = document.createElement('span'); sr.className = 'vh'; sr.textContent = text;
    el.replaceChildren(sr, vis);
    el.style.setProperty('--kw', n);
    if (RM()) el.classList.add('k-on'); else seen.observe(el);
  });
}

export function grain(el) {
  if (!el) return;
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d'); if (!g) return;
  const im = g.createImageData(160, 160), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  g.putImageData(im, 0, 0);
  el.style.setProperty('--grain', `url(${c.toDataURL('image/png')})`);
  el.classList.add('fx-grain-on');
}

// interface sounds: a soft click, a step tone, a "done" chord — synthesised, nothing downloaded
let ctx = null, on = false;
export function sound(v) {
  on = !!v && !RM();
  if (on && !ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { on = false; } }
  if (ctx && on && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return on;
}
export const soundOn = () => on;
export function tone(kind = 'tick') {
  if (!on || !ctx || document.hidden) return;
  const t0 = ctx.currentTime;
  const notes = kind === 'done' ? [523.25, 659.25, 783.99] : kind === 'step' ? [659.25] : kind === 'badge' ? [783.99, 1046.5] : [880];
  const len = kind === 'done' ? 0.9 : kind === 'badge' ? 0.55 : 0.16;
  notes.forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = kind === 'tick' ? 'triangle' : 'sine'; o.frequency.value = f;
    const g = ctx.createGain(); const s = t0 + i * (kind === 'done' ? 0.09 : 0.07);
    g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(kind === 'tick' ? 0.05 : 0.08, s + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, s + len);
    o.connect(g); g.connect(ctx.destination); o.start(s); o.stop(s + len + 0.05);
  });
}
