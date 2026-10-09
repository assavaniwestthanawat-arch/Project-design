// SBP AirCare — r18 typesetting helpers shared by A / B / C (no rendering of its own, no globals).
// Owner 7 ต.ค. 2569: "พัฒนา … ความคมชัด รายละเอียดแต่ละส่วน … ตรวจเช็คและพัฒนาทุกจุด"

// Thai headings: Chromium breaks Thai at dictionary word boundaries and ignores `word-break: keep-all` for Thai, so balanced
// headings split compounds across lines ("ติด|ตั้ง", "ร้าน|ค้า", "รี|โนเวต"). Each space-separated phrase becomes an inline-block
// (`.thp`): it moves to the next line whole when it fits there, and still wraps inside itself when it is wider than the line,
// so nothing can overflow. Text stays in the DOM in order (screen readers, copy, search read it unchanged).
const TH = /[฀-๿]/;
export function thaiPhrases(sel, root = document) {
  for (const hd of root.querySelectorAll(sel)) {
    if (hd.dataset.thp) continue;
    hd.dataset.thp = '1';
    const tw = document.createTreeWalker(hd, NodeFilter.SHOW_TEXT), nodes = [];
    for (let n; (n = tw.nextNode());) if (TH.test(n.data) && !n.parentElement.closest('.thp,svg')) nodes.push(n);
    for (const n of nodes) {
      const parts = n.data.split(/(\s+)/).filter(s => s !== '');
      if (parts.length === 1 && !/\S/.test(parts[0])) continue;
      const frag = document.createDocumentFragment();
      for (const s of parts) {
        if (/^\s+$/.test(s) || !TH.test(s)) frag.append(s);
        else { const sp = document.createElement('span'); sp.className = 'thp'; sp.textContent = s; frag.append(sp); }
      }
      n.replaceWith(frag);
    }
  }
}

// Section zones: a page heading lists its sections as numbered jump links (site.js); the same number is written on each
// section's eyebrow (`data-sec-n`) so the link and the section it opens read as one pair. Editions decide whether to show it.
// r20: was `data-zone` — that name already marks the service-area checker, which then mounted on the wrong element.
export function zoneMarks(root = document) {
  for (const nav of root.querySelectorAll('.sx-jump')) {
    [...nav.querySelectorAll('a[href^="#"]')].forEach((a, i) => {
      const sec = document.getElementById(a.getAttribute('href').slice(1));
      if (!sec) return;
      sec.dataset.secN = String(i + 1);
      const eb = sec.querySelector('.sec-h .eyebrow');
      if (eb) eb.dataset.secN = String(i + 1);
    });
  }
}
