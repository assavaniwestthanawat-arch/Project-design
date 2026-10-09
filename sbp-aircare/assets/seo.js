// SBP AirCare — structured data for search engines (schema.org JSON-LD) — Rev.09 r20
// Built from the same single sources the page shows (COMPANY, ZONES, SERVICES) so it can never drift
// from the visible content. No prices here: prices live in the Pricebook and change; production (Next.js) should emit
// Product/Offer per model page at build time (CLAUDE.md §8 step 7.6). Company facts still await owner confirmation (§7.3 #14).
import { COMPANY, ZONES, SERVICES } from './sbp-core.js';

export function companyGraph({ page = '' } = {}) {
  const org = {
    '@type': ['Organization', 'HVACBusiness'], '@id': COMPANY.webUrl + '/#org',
    name: COMPANY.th, alternateName: [COMPANY.en, COMPANY.brand], url: COMPANY.webUrl,
    telephone: COMPANY.tel, email: COMPANY.email,
    address: { '@type': 'PostalAddress', streetAddress: '593 ถนนพระราม 2 แขวงบางมด', addressLocality: 'เขตจอมทอง', addressRegion: 'กรุงเทพมหานคร', postalCode: '10150', addressCountry: 'TH' },
    areaServed: ZONES.map(z => ({ '@type': 'AdministrativeArea', name: z.province })),
    brand: [{ '@type': 'Brand', name: 'FUJIVA' }],
  };
  const svc = SERVICES.filter(s => s.id !== 'project').map(s => ({
    '@type': 'Service', name: s.th, description: s.sub, serviceType: s.th, provider: { '@id': org['@id'] }, areaServed: org.areaServed,
  }));
  const site = { '@type': 'WebPage', name: page || COMPANY.brand, inLanguage: 'th-TH', about: { '@id': org['@id'] } };
  return { '@context': 'https://schema.org', '@graph': [org, ...svc, site] };
}

// one <script type="application/ld+json"> in <head>, replaced on re-run (view changes keep a single block)
export function mountSeo(opts = {}) {
  try {
    let el = document.getElementById('sbp-ld');
    if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'sbp-ld'; document.head.append(el); }
    el.textContent = JSON.stringify(companyGraph(opts));
  } catch (e) {}
}
