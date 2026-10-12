// SBP AirCare — Rev.11 "ประสบการณ์ที่ไม่คาดคิด" for A · B · C (owner 12 ต.ค. 2569: "พัฒนา A B C ให้แบบล้ำสมัยแบบประสบการณ์ที่
// USER EXPERIENCE ไม่คาดคิดว่าจะเจอหรือมีจริงๆ"). One call per page, after mountSite():
//   talk.js        เล่าให้ฟัง — speak or type in everyday Thai → the job, the Pricebook price, a filled booking form
//   soundmatch.js  เสียงแอร์แบบนี้ไหม — synthesised AC noises to compare with; the closest one → common causes → the right visit
//   passport.js    แอร์ของฉัน — the customer's units on this device: last service, next clean due, one tap to book again
//   tilt.js        phone tilt moves the hero 3D view (motion sensors, asked on first tap where the browser requires it)
// AR (ar.js, real-size unit on the customer's own wall) lives in the product detail (model3d.js); cinematic page changes in site.js.
// Every part is optional: a browser without the feature (voice, AR, sensors, view transitions) gets the same content without it.
import { $ } from './sbp-core.js';

// mount a part when its root comes near the screen (hidden views never intersect, so parts in other pages wait for their page)
const near = (el, fn) => {
  if (!el) return;
  if (!('IntersectionObserver' in window)) return void fn();
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: '600px 0px' });
  io.observe(el);
};
const warn = what => e => console.warn(`[wow] ${what} not mounted`, e);

export function mountWow({ variant = 'C' } = {}) {
  const cfg = { variant };
  // the header entry ("เล่าให้ฟัง" next to search) exists from the start; the full panel loads near its section
  import('./talk.js').then(m => m.mountTalkEntry && m.mountTalkEntry(cfg)).catch(warn('talk entry'));
  near($('#talkRoot'), () => import('./talk.js').then(m => m.mountTalk($('#talkRoot'), cfg)).catch(warn('talk')));
  near($('#soundRoot'), () => import('./soundmatch.js').then(m => m.mountSoundMatch($('#soundRoot'), cfg)).catch(warn('sound match')));
  near($('#mineRoot'), () => import('./passport.js').then(m => m.mountPassport($('#mineRoot'), cfg)).catch(warn('passport')));
  import('./tilt.js').then(m => m.mountTilt && m.mountTilt(cfg)).catch(warn('tilt'));
}
