// Shared helpers for the Playwright checks. Serve the repo root first:  python3 -m http.server 8765
import { chromium } from 'playwright';
export const BASE = process.env.BASE || 'http://localhost:8765';
// swiftshader = software WebGL, so headless runs (CI / no GPU) can render three.js scenes. It is SLOW:
// screenshots of 3D canvases can take 1–3 minutes → always pass a long timeout.
export const launch = () => chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
export async function scrollAll(p, step = 700, wait = 1000) {
  const H = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < H; y += step) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(wait); }
  return H;
}
