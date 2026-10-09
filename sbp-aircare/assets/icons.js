// SBP AirCare — one SVG icon set for controls and status marks (Rev.09 r6).
// Replaces text glyphs (▶ ❚❚ ✓ ★ ✍ × +) that render differently per font/OS and read as emoji on some phones.
// 24-unit grid, 1.8 stroke, round caps/joins, currentColor — same drawing rules as the service/intent icons in site.js.
const P = {
  play: '<path d="M8 5.6v12.8L18.5 12z" fill="currentColor"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  check: '<path d="M5 12.5l4.4 4.4L19 7.4"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.4"/>',
  warn: '<path d="M12 4.5l8.5 14.5h-17z"/><path d="M12 10v4.2M12 16.8v.3"/>',
  star: '<path d="M12 4l2.4 5 5.4.7-4 3.7 1 5.4L12 16.2l-4.8 2.6 1-5.4-4-3.7 5.4-.7z"/>',
  sign: '<path d="M4 18.5c2.6-.6 3.6-4.5 5.4-4.5 1.6 0 .8 2.8 2.4 2.8 1.4 0 2.3-2.6 3.6-2.6M14.6 5.2l3.2 3.2-7 7H7.6v-3.2z"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  minus: '<path d="M5.5 12h13"/>',
  compare: '<path d="M8 4.5v15M16 4.5v15M4.5 9H8M16 15h3.5"/>',
  external: '<path d="M13.5 4.5h6v6M19.5 4.5l-8.5 8.5M17.5 13.5v5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h5"/>',
  phone: '<path d="M6.6 4.5h3l1.5 3.8-2 1.3a10 10 0 0 0 5.3 5.3l1.3-2 3.8 1.5v3a1.6 1.6 0 0 1-1.7 1.6A15 15 0 0 1 5 6.2a1.6 1.6 0 0 1 1.6-1.7z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.6"/><path d="M4 7l8 6 8-6"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.6"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.6 15.6l4.6 4.6"/>',
  pin: '<path d="M12 20.5s6.5-5.6 6.5-10.6a6.5 6.5 0 0 0-13 0c0 5 6.5 10.6 6.5 10.6z"/><circle cx="12" cy="9.8" r="2.3"/>',
};
/** icon(name, { size, label, cls }) → <svg> element. Decorative (aria-hidden) unless a label is given. */
export function icon(name, { size = 18, label = '', cls = '' } = {}) {
  const NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('class', ('ic ' + cls).trim()); s.setAttribute('focusable', 'false');
  if (label) { s.setAttribute('role', 'img'); s.setAttribute('aria-label', label); } else s.setAttribute('aria-hidden', 'true');
  s.innerHTML = P[name] || '';
  return s;
}
/** set a button's content to [icon] + text (keeps one text node for screen readers) */
export function iconLabel(btn, name, text) { btn.replaceChildren(icon(name, { size: 16 }), document.createTextNode(text)); return btn; }
