// Jedno źródło prawdy dla URL-i assetów z /api/assets/.
//
// IDEMPOTENTNY: podanie już znormalizowanej ścieżki zwraca ją bez zmian.
// To usuwa przyczynę wielokrotnego prefiksu — dawne kopie tej logiki kończyły się
// catch-allem `/api/assets/uploads/${path}`, który doklejał prefiks w KAŻDEJ
// warstwie łańcucha (page.tsx → PublicPageClient → demo.tsx), dając adresy typu
// /api/assets/uploads//api/assets/uploads//api/assets/uploads/...

const ASSETS_PREFIX = '/api/assets/';

/** URL zewnętrzny (np. Google CDN) — nie nasz asset, nie ruszamy go. */
export function isExternalAsset(path: string): boolean {
  return /^https?:\/\//.test(path) && !path.includes(ASSETS_PREFIX);
}

/**
 * Normalizuje ścieżkę assetu do postaci relatywnej + opcjonalny cache-bust.
 *
 *   https://lh3.googleusercontent.com/...=s96-c → bez zmian (sufiks =sNN-c jest
 *                                                 wymagany; bez niego lh3 daje 404)
 *   https://host/api/assets/...                 → /api/assets/...  (ścięty host)
 *   /api/assets/...                             → /api/assets/...  (IDEMPOTENCJA)
 *   /uploads/x.png                              → /api/assets/uploads/x.png
 *   x.png                                       → /api/assets/uploads/x.png
 *
 * Relatywna ścieżka rozwiązuje się względem domeny, która renderuje — działa na
 * app.inflee.app, na custom domenie i na localhoście przy jednej wspólnej bazie.
 */
export function assetUrl(path?: string | null, bust?: string | Date | null): string {
  if (!path) return '';
  if (isExternalAsset(path)) return path;

  const idx = path.indexOf(ASSETS_PREFIX);
  let url: string;

  if (idx !== -1) {
    url = path.substring(idx);
  } else if (path.startsWith('/uploads/')) {
    url = `/api/assets/uploads/${path.substring('/uploads/'.length)}`;
  } else {
    url = `/api/assets/uploads/${path.replace(/^\/+/, '')}`;
  }

  // Bez bustu ZWRACAMY URL NIETKNIĘTY — łącznie z istniejącym ?t=.
  // Kluczowe: warstwy niżej (normalizeAvatarUrl w demo.tsx) wołają assetUrl bez
  // parametru `bust`, więc ucinanie query tutaj gubiło cache-bust dodany wyżej.
  if (!bust) return url;

  // Z bustem: odcinamy stary ?t=, żeby nie mnożyć parametrów przy wielokrotnym wywołaniu.
  const [clean] = url.split('?');
  const t = new Date(bust).getTime();
  return Number.isNaN(t) ? clean : `${clean}?t=${t}`;
}

/** Wariant absolutny — wyłącznie dla Open Graph / Twitter, gdzie scraper wymaga pełnego URL-a. */
export function absoluteAssetUrl(path: string | null | undefined, origin: string): string {
  if (!path) return '';
  if (isExternalAsset(path)) return path;
  return `${origin}${assetUrl(path)}`;
}