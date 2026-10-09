// SBP AirCare — film director (r16 A2–D2). Every chapter of the new editions is a scene played as a sequence of shots, with
// subtitles, a progress line, transitions and (per edition) letterbox bars, a mission HUD or an inspector. A chapter is any
// element with data-film='{kind, drive, …scene options}' (scene kinds: filmscenes.js) holding a .fm-stage. Three drivers:
//   progress  the chapter is a tall .fm-track; the stage is sticky and the scroll position picks the shot (film, A2)
//   blocks    the shots are blocks of text in the page flow; the one crossing the middle of the screen plays (showroom, C2)
//   player    buttons, a shot list, autoplay while the stage is in view (game B2, digital twin D2)
//   none      the stage is driven by something else (the hero's own camera, the showroom, the concierge)
// The 3D view of a chapter is built only when the visitor gets near it, one build at a time (nearest first); the captions
// load before it (stepsOf: no WebGL needed), so the story reads complete on a device that cannot draw it. Unit chapters
// ([data-stage] stages) share the page's one cinema (stage.js) instead of building their own. Reduced motion: no autoplay,
// no transitions. On phones a scene far from the screen is freed (rebuilt when the visitor comes back).
// mountFilm({ stage, theme, mood, quality, autoplay, onStep(ch, i, step), onDone(ch), onBuilt(ch) }) → { chapters, byId, go(id, i), play(id) }
import { h, $, $$ } from './sbp-core.js';
import { makeScene, stepsOf, UNIT_SHOTS } from './filmscenes.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const parse = s => { try { return JSON.parse(s || '{}'); } catch (_) { return {}; } };
const COARSE = matchMedia('(pointer: coarse)').matches;
const TIGHT = COARSE || (navigator.deviceMemory && navigator.deviceMemory <= 4);
const glOK = () => typeof WebGLRenderingContext !== 'undefined';

export function mountFilm({ stage = null, theme = 'dark', mood, quality, autoplay = true, onStep, onDone, onBuilt } = {}) {
  const env = { theme, mood, quality };
  const chapters = $$('[data-film]').map(el => setup(el));
  const byId = Object.fromEntries(chapters.map(c => [c.id, c]));

  /* ---------- a chapter ---------- */
  function setup(el) {
    const spec = parse(el.dataset.film);
    const st = $('.fm-stage', el);
    const ch = { el, id: el.id, spec, drive: spec.drive || 'none', st, steps: null, cur: -1, scene: null, building: false, failed: false, near: false, on: false, done: false, paused: !autoplay || spec.autoplay === false, timer: 0 };
    if (spec.len) el.style.setProperty('--len', spec.len);
    if (spec.n) el.style.setProperty('--n', spec.n);
    // the shared cinema stage (unit chapters) or a host for the chapter's own 3D view
    ch.unit = spec.kind === 'unit' && st && st.hasAttribute('data-stage');
    if (st && !ch.unit && spec.kind) { ch.gl = h('div', { class: 'fm-gl' }); st.prepend(ch.gl); }
    // (unit stages carry their own notice: the page's .stage-cap, or the showroom's caption)
    if (st && !ch.unit && !$('.fm-tag, .stage-cap', st)) st.append(h('p', { class: 'fm-tag' }, 'แบบจำลองเพื่ออธิบาย'));
    if (st && spec.kind && !ch.unit) st.append(h('p', { class: 'fm-wait', 'aria-hidden': 'true' }, h('i'), 'กำลังเตรียมฉาก'));
    if (st) st.append(ch.cutEl = h('i', { class: 'fm-cut', 'aria-hidden': 'true' }));
    // subtitle: the page may place it (B2 dialogue box, D2 inspector); otherwise it sits on the stage
    ch.sub = $('.fm-sub', el);
    if (!ch.sub && st && ch.drive !== 'none') { ch.sub = h('div', { class: 'fm-sub' }); st.append(ch.sub); }
    if (ch.sub) {
      if (!ch.sub.children.length) ch.sub.append(h('p', { class: 'fm-sub-k' }), h('p', { class: 'fm-sub-t' }), h('p', { class: 'fm-sub-d' }));
      // spoken aloud only where the visitor steps through it with buttons; the shot list is the readable version
      if (ch.drive === 'player') ch.sub.setAttribute('aria-live', 'polite'); else ch.sub.setAttribute('aria-hidden', 'true');
    }
    ch.list = $('.fm-shots', el);
    ch.count = $$('[data-count]', el);
    ch.prog = $('[data-prog]', el);
    ch.detail = $('[data-detail]', el);
    if (ch.drive === 'player') player(ch);
    return ch;
  }

  /* ---------- captions + shot list ---------- */
  async function loadSteps(ch) {
    if (ch.steps || ch.stepsP) return ch.stepsP;
    ch.stepsP = (ch.unit ? Promise.resolve((ch.spec.shots ? ch.spec.shots : UNIT_SHOTS).map(({ t, d }) => ({ t, d }))) : stepsOf(ch.spec)).then(s => {
      ch.steps = s; ch.el.style.setProperty('--n', s.length); drawList(ch); paint(ch); return s;
    }).catch(e => { console.warn('film steps', ch.id, e); ch.steps = []; return []; });
    return ch.stepsP;
  }
  function drawList(ch) {
    if (!ch.list) return;
    const S = ch.steps;
    if (ch.drive === 'player') {
      ch.list.replaceChildren(...S.map((s, i) => h('li', {}, h('button', { type: 'button', class: 'fm-shot', 'aria-label': `ขั้นที่ ${i + 1} ${s.t}`, onclick: () => { stop(ch, true); show(ch, i); } }, h('i', { class: 'fm-shot-n' }, String(i + 1)), h('span', { class: 'fm-shot-t' }, s.t)))));
    } else {
      ch.list.replaceChildren(...S.map((s, i) => h('li', { class: 'fm-shot', 'data-i': i },
        h(ch.drive === 'blocks' ? 'h3' : 'p', { class: 'fm-shot-t' }, s.t),
        s.d ? h('p', { class: 'fm-shot-d' }, s.d) : null,
        s.why ? h('p', { class: 'fm-shot-x' }, h('b', {}, 'ทำไม '), s.why) : null,
        s.get ? h('p', { class: 'fm-shot-x' }, h('b', {}, 'ลูกค้าได้ '), s.get) : null,
        s.who ? h('p', { class: 'fm-shot-x' }, h('b', {}, 'ทีมช่าง '), `หัวหน้า: ${s.who[0]} · ผู้ช่วย: ${s.who[1]}`) : null,
        s.form ? h('p', { class: 'fm-shot-f' }, s.form) : null)));
      if (ch.drive === 'blocks') blocks(ch);
    }
  }
  function paint(ch) {
    const S = ch.steps || [], i = ch.cur, s = S[i];
    ch.el.classList.toggle('is-titled', i < 0);
    ch.el.style.setProperty('--step', Math.max(0, i));
    if (ch.sub) {
      const [k, t, d] = ch.sub.children;
      if (k) k.textContent = s ? `${i + 1} / ${S.length}${s.who ? ' · ทีมช่าง 2 คน' : ''}` : '';
      if (t) t.textContent = s ? s.t : '';
      if (d) d.textContent = s ? s.d || '' : '';
      ch.sub.classList.toggle('is-empty', !s);
      // re-run the caption's entrance (CSS) each time the shot changes
      ch.sub.classList.remove('is-in'); void ch.sub.offsetWidth; if (s) ch.sub.classList.add('is-in');
    }
    ch.count.forEach(c => { c.textContent = s ? `${i + 1} / ${S.length}` : S.length ? `${S.length} ขั้น` : ''; });
    if (ch.prog && ch.drive === 'player') ch.prog.style.setProperty('--p', S.length ? (i + 1) / S.length : 0);
    if (ch.list) $$('.fm-shot', ch.list).forEach((b, j) => { b.classList.toggle('on', j === i); b.classList.toggle('past', j < i); if (b.tagName === 'BUTTON') b.setAttribute('aria-current', j === i ? 'step' : 'false'); });
    if (ch.detail) {
      ch.detail.replaceChildren(...(s ? [h('p', { class: 'fm-dt-n' }, `ขั้นที่ ${i + 1} จาก ${S.length}`), h('h3', { class: 'fm-dt-t' }, s.t), s.d ? h('p', {}, s.d) : null,
        s.why ? h('p', {}, h('b', {}, 'ทำไม '), s.why) : null, s.get ? h('p', {}, h('b', {}, 'ลูกค้าได้ '), s.get) : null,
        s.who ? h('dl', { class: 'fm-dt-who' }, h('dt', {}, 'ช่างหัวหน้า'), h('dd', {}, s.who[0]), h('dt', {}, 'ช่างผู้ช่วย'), h('dd', {}, s.who[1])) : null,
        s.form ? h('p', { class: 'fm-dt-f' }, s.form) : null] : [h('p', { class: 'fm-dt-n' }, S.length ? `${S.length} ขั้น กดเล่นหรือเลือกขั้น` : 'กำลังเตรียมขั้นตอน')]).filter(Boolean));
    }
  }

  /* ---------- show a shot ---------- */
  function show(ch, i) {
    const n = ch.steps ? ch.steps.length : 0;
    i = clamp(i, -1, Math.max(-1, n - 1));
    if (i === ch.cur) return;
    ch.cur = i; paint(ch);
    if (ch.on && !RM() && i >= 0) { ch.cutEl.classList.remove('go'); void ch.cutEl.offsetWidth; ch.cutEl.classList.add('go'); }
    apply(ch);
    onStep && onStep(ch, i, ch.steps && ch.steps[i]);
    if (n && i === n - 1) { ch.done = true; onDone && onDone(ch); }
  }
  function apply(ch) {
    if (ch.unit) { if (!stage || ch.cur < 0) return; const shots = ch.spec.shots || UNIT_SHOTS, s = shots[ch.cur]; if (s) stage.set(ch.st, { ...s.s, auto: false }); return; }
    if (ch.scene) try { ch.scene.go(ch.cur); } catch (e) { console.warn('film shot', ch.id, e); }
  }

  /* ---------- build the 3D view: one at a time, nearest first ---------- */
  const queue = new Set(); let pumping = false;
  const distOf = ch => { const r = ch.st.getBoundingClientRect(), vh = innerHeight || 800; return r.bottom < 0 ? -r.bottom / vh : r.top > vh ? (r.top - vh) / vh : 0; };
  function want(ch) { if (ch.unit || !ch.gl || ch.scene || ch.building || ch.failed) return; queue.add(ch); pump(); }
  async function pump() {
    if (pumping) return; pumping = true;
    try {
      while (queue.size) {
        const ch = [...queue].sort((a, b) => distOf(a) - distOf(b))[0]; queue.delete(ch);
        if (!ch.near || ch.scene || ch.failed) continue;
        const onScreen = distOf(ch) === 0;
        await build(ch);
        // let the page breathe between two heavy builds unless the visitor is already looking at the next one
        await new Promise(r => setTimeout(r, onScreen ? 60 : 420));
      }
    } finally { pumping = false; }
  }
  async function build(ch) {
    ch.building = true; ch.el.classList.add('is-loading');
    try {
      await loadSteps(ch);
      if (!glOK()) throw new Error('no WebGL');
      ch.scene = await makeScene(ch.spec, ch.gl, env);
      ch.el.classList.add('is-live'); ch.el.classList.remove('no-gl');
      if (ch.cur >= 0 || ch.spec.kind !== 'crew') try { ch.scene.go(ch.cur); } catch (_) {}
      onBuilt && onBuilt(ch);
    } catch (e) {
      ch.failed = true; ch.el.classList.add('no-gl'); console.warn('film scene unavailable', ch.id, e);
    } finally { ch.building = false; ch.el.classList.remove('is-loading'); }
  }
  function free(ch) {
    if (!ch.scene || !ch.scene.disposable || ch.building) return;
    try { ch.scene.dispose(); } catch (_) {}
    ch.scene = null; ch.gl.replaceChildren(); ch.el.classList.remove('is-live');
  }

  /* ---------- drivers ---------- */
  // progress: p over the track → the establishing shot (the title card) then each step
  const prog = chapters.filter(c => c.drive === 'progress');
  let raf = 0;
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
  function tick() {
    raf = 0;
    const vh = innerHeight || 800;
    prog.forEach(ch => {
      if (!ch.near) return;
      const tr = $('.fm-track', ch.el) || ch.el, r = tr.getBoundingClientRect(), span = r.height - vh;
      const p = span > 0 ? clamp(-r.top / span, 0, 1) : (r.top < vh / 2 ? 1 : 0);
      ch.el.style.setProperty('--p', p.toFixed(4));
      const n = ch.steps ? ch.steps.length : 0;
      if (n) show(ch, Math.min(n - 1, Math.floor(p * (n + 1) * 0.9999) - 1));
    });
  }
  if (prog.length) { addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); }

  // blocks: the step crossing the middle of the screen
  function blocks(ch) {
    if (ch.io) ch.io.disconnect();
    ch.io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) show(ch, +e.target.dataset.i); }), { rootMargin: '-48% 0px -48% 0px' });
    $$('.fm-shot', ch.list).forEach(li => ch.io.observe(li));
    // above the first block: back to the establishing shot
    const first = $('.fm-shot', ch.list);
    if (first) { const top = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting && e.boundingClientRect.top > 0) show(ch, -1); }), { rootMargin: '0px 0px -48% 0px' }); top.observe(first); }
  }

  // player: controls, autoplay while in view
  function player(ch) {
    const ctl = $('.fm-ctl', ch.el);
    const prev = h('button', { type: 'button', class: 'fm-b fm-prev', 'aria-label': 'ขั้นก่อนหน้า', onclick: () => { stop(ch, true); show(ch, ch.cur - 1); } }, h('span', { 'aria-hidden': 'true' }, '‹'));
    const next = h('button', { type: 'button', class: 'fm-b fm-next', 'aria-label': 'ขั้นถัดไป', onclick: () => { stop(ch, true); show(ch, ch.cur + 1); } }, h('span', { 'aria-hidden': 'true' }, '›'));
    const play = h('button', { type: 'button', class: 'fm-b fm-play', 'aria-pressed': 'false', onclick: () => { if (ch.playing) stop(ch, true); else start(ch, true); } }, 'เล่น');
    ch.playB = play;
    if (ctl) ctl.append(prev, play, next);
    ch.el.addEventListener('keydown', e => {
      if (!e.target.closest('.fm-ctl, .fm-shots, .fm-stage')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); stop(ch, true); show(ch, ch.cur + (e.key === 'ArrowRight' ? 1 : -1)); }
    });
  }
  function dwell(s) { return clamp(2600 + 40 * ((s.t || '').length + (s.d || '').length), 4200, 9500); }
  function start(ch, user) {
    if (!ch.steps || !ch.steps.length) { loadSteps(ch).then(() => start(ch, user)); return; }
    if (user) ch.paused = false;
    if (ch.cur >= ch.steps.length - 1) show(ch, -1);   // played to the end: start again
    ch.playing = true; ch.playB && (ch.playB.textContent = 'หยุด', ch.playB.setAttribute('aria-pressed', 'true'));
    ch.el.classList.add('is-playing');
    const stepOn = () => {
      clearTimeout(ch.timer);
      if (!ch.playing) return;
      if (ch.cur >= ch.steps.length - 1) { stop(ch); return; }
      show(ch, ch.cur + 1);
      const wait = () => { if (!ch.playing) return; if (ch.scene && ch.scene.busy && ch.scene.busy()) { ch.timer = setTimeout(wait, 300); return; } ch.timer = setTimeout(stepOn, dwell(ch.steps[ch.cur] || {})); };
      ch.timer = setTimeout(wait, 400);
    };
    ch.timer = setTimeout(stepOn, ch.cur < 0 ? 700 : 0);
  }
  function stop(ch, user) {
    clearTimeout(ch.timer); ch.playing = false; if (user) ch.paused = true;
    ch.el.classList.remove('is-playing');
    if (ch.playB) { ch.playB.textContent = ch.steps && ch.cur >= ch.steps.length - 1 ? 'เล่นอีกครั้ง' : 'เล่น'; ch.playB.setAttribute('aria-pressed', 'false'); }
  }

  /* ---------- who is near, who is on screen ---------- */
  const nearIO = new IntersectionObserver(es => es.forEach(e => {
    const ch = chapters.find(c => c.st === e.target); if (!ch) return;
    ch.near = e.isIntersecting;
    if (ch.near) { loadSteps(ch).then(() => { want(ch); if (ch.drive === 'progress') onScroll(); }); }
  }), { rootMargin: '140% 0px' });
  const onIO = new IntersectionObserver(es => es.forEach(e => {
    const ch = chapters.find(c => c.st === e.target); if (!ch) return;
    const on = e.isIntersecting && e.intersectionRatio >= 0.45;
    if (on === ch.on) return;
    ch.on = on; ch.el.classList.toggle('is-on', on);
    if (ch.drive === 'player') { if (on && !ch.paused && !RM()) start(ch); else if (!on) stop(ch); }
  }), { threshold: [0, 0.25, 0.45, 0.7, 1] });
  // phones: a scene four screens away gives its memory back
  const farIO = TIGHT ? new IntersectionObserver(es => es.forEach(e => { const ch = chapters.find(c => c.st === e.target); if (ch && !e.isIntersecting) free(ch); }), { rootMargin: '400% 0px' }) : null;
  const tracked = ch => ch.drive === 'progress' && $('.fm-track', ch.el) && $('.fm-track', ch.el) !== ch.st;
  chapters.forEach(ch => { if (!ch.st) return; if (!tracked(ch)) nearIO.observe(ch.st); onIO.observe(ch.st); farIO && farIO.observe(ch.st); });
  // a progress chapter's stage is sticky inside a tall track: watch the track for "near"
  prog.forEach(ch => { const tr = $('.fm-track', ch.el); if (tr && tr !== ch.st) { const io = new IntersectionObserver(es => es.forEach(e => { ch.near = e.isIntersecting; if (ch.near) loadSteps(ch).then(() => { want(ch); onScroll(); }); }), { rootMargin: '140% 0px' }); io.observe(tr); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) chapters.forEach(ch => ch.playing && stop(ch)); });

  return {
    chapters, byId,
    /** jump to a chapter's shot (player chapters; scroll chapters follow the scroll position) */
    go(id, i) { const ch = byId[id]; if (!ch) return; loadSteps(ch).then(() => { stop(ch, true); show(ch, i); }); },
    play(id) { const ch = byId[id]; if (ch && ch.drive === 'player') start(ch, true); },
    stop(id) { const ch = byId[id]; if (ch) stop(ch, true); },
    scene: id => byId[id] && byId[id].scene,
  };
}
