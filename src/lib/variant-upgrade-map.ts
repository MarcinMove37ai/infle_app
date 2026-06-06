// src/lib/variant-upgrade-map.ts
//
// Mapa upsellu dla modala wyboru wariantów grafik (okładka + rozdziały).
// Definiuje — per rola usera — jakie ZABLOKOWANE kafelki planów pokazać w siatce
// oraz jaki pasek CTA (darmowa weryfikacja vs płatny upgrade).
//
// Zasada (uzgodniona): pokazujemy tylko plany, NA KTÓRE user może realnie przejść:
//   free      → Rookie (darmowa weryfikacja konta, 21 dni)
//   demo      → Rookie (jak free)
//   free_ver  → Creator, Unlimited (płatny upgrade)
//   rookie    → Creator, Unlimited (płatny upgrade)
//   creator   → Unlimited (płatny upgrade)
//   unlimited → (nic — szczyt)
//
// Liczby okładek/grafik trzymamy spójnie z IMAGE_VARIANT_LIMITS (rookie 2, creator 3, unlimited 5).

export type UpgradeTier = {
  // Klucz roli docelowej (do logiki/analityki).
  role: 'rookie' | 'creator' | 'unlimited';
  // Etykieta planu na kafelku.
  label: string;
  // Liczba wariantów, jaką ten plan daje (do podpisu "X covers to choose from").
  variants: number;
};

export type UpgradeBar = {
  // Styl/wydźwięk paska: 'free' = darmowa weryfikacja (zielony), 'paid' = płatny upgrade (niebieski).
  kind: 'free' | 'paid';
  // Tekst paska (EN).
  message: string;
  // Etykieta przycisku CTA.
  cta: string;
};

export type UpgradeInfo = {
  // Zablokowane kafelki planów do pokazania (w kolejności).
  tiers: UpgradeTier[];
  // Pasek CTA pod siatką (lub null, gdy brak — np. unlimited).
  bar: UpgradeBar | null;
};

const ROOKIE: UpgradeTier = { role: 'rookie', label: 'Rookie', variants: 2 };
const CREATOR: UpgradeTier = { role: 'creator', label: 'Creator', variants: 3 };
const UNLIMITED: UpgradeTier = { role: 'unlimited', label: 'Unlimited', variants: 5 };

const FREE_BAR: UpgradeBar = {
  kind: 'free',
  message: 'Verify your account to unlock 2 covers to choose from — free for 21 days.',
  cta: 'Verify',
};

const PAID_BAR: UpgradeBar = {
  kind: 'paid',
  message: 'Upgrade to generate more covers at once — up to 3 on Creator, up to 5 on Unlimited.',
  cta: 'See plans',
};

// Mapa per rola. Role spoza mapy (np. admin, GOD, payd, premium) → brak upsellu.
const MAP: Record<string, UpgradeInfo> = {
  free: { tiers: [ROOKIE], bar: FREE_BAR },
  demo: { tiers: [ROOKIE], bar: FREE_BAR },
  free_ver: { tiers: [CREATOR, UNLIMITED], bar: PAID_BAR },
  rookie: { tiers: [CREATOR, UNLIMITED], bar: PAID_BAR },
  creator: { tiers: [UNLIMITED], bar: PAID_BAR },
  unlimited: { tiers: [], bar: null },
};

/**
 * Zwraca informacje o upsellu (zablokowane kafelki + pasek) dla danej roli.
 * Role bez zdefiniowanego upsellu (admin, GOD, payd, premium, nieznane) → brak kafelków i paska.
 */
export function getUpgradeInfo(role: string | null | undefined): UpgradeInfo {
  if (!role) return { tiers: [], bar: null };
  return MAP[role] ?? { tiers: [], bar: null };
}