# Project-design
SAHABURAPA AirCare website (บริษัท สหบูรพากรุ๊ป จำกัด)

## Projects

| Folder | What | Start here |
|---|---|---|
| [`sbp-aircare/`](sbp-aircare/) | SBP AirCare website prototypes A · B · C (vanilla ES modules + three.js r170, single-file builds) | [`sbp-aircare/HANDOFF.md`](sbp-aircare/HANDOFF.md) → [`sbp-aircare/CLAUDE.md`](sbp-aircare/CLAUDE.md) |

### sbp-aircare quick start

```bash
cd sbp-aircare
npm install                 # playwright 1.56.0 + axe-core (Chromium: use the system one, or `npx playwright install chromium` locally)
npm run serve               # http://localhost:8765/a.html  b.html  c.html  preview.html
npm run smoke && npm run smoke:mobile && npm run textscan
npm run recon               # needs internal/sbp_real.json (internal file — never commit)
npm run build               # dist/offline/*.html (double-click) · dist/art/*.html (Artifact pages)
```
