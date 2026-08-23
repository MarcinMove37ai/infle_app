// src/lib/planLimits.ts
//
// Jedno źródło prawdy dla nazw planów i limitów per aspekt.
// Limity rozdziałów CZYTAMY z chapterLimits.ts — nie duplikujemy ich tutaj,
// żeby przy zmianie dalej edytować jeden plik.
// Nazwy planów są wyłącznie prezentacyjne — role w bazie zostają nietknięte.

import { getChapterLimits } from './chapterLimits';
import { getVariantLimit } from './image-variant-limits';

export type PlanId = 'starter' | 'business' | 'scale';
export type Aspect = 'sources' | 'chapters' | 'intro' | 'variants';

interface Plan {
  id: PlanId;
  name: string;
  /** Reprezentatywna rola — pozwala czytać limity z istniejących funkcji. */
  role: string;
  /** Infinity = bez limitu. */
  sources: number;
}

/** Plany od najniższego. Kolejność definiuje, co znaczy „plan wyższy". */
const PLANS: Plan[] = [
  { id: 'starter',  name: 'Starter',  role: 'rookie',    sources: 1 },
  { id: 'business', name: 'Business', role: 'creator',   sources: 5 },
  { id: 'scale',    name: 'Scale',    role: 'unlimited', sources: Infinity },
];

/** Plany, w ktorych ebook moze miec wygenerowany wstep. */
const INTRO_PLANS: PlanId[] = ['business', 'scale'];

/** Czy plan uzytkownika obejmuje generowanie wstepu. */
export function hasIntroAccess(role?: string | null): boolean {
  return INTRO_PLANS.includes(getPlan(role).id);
}


/** Maksymalna dlugosc skracania AI w danym planie (znaki). */
const SUMMARY_LIMITS: Record<PlanId, number> = {
  starter: 1000,
  business: 5000,
  scale: 10000,
};

/** Limit skracania dla roli — uzywany TEZ po stronie serwera, jako egzekucja planu. */
export function getMaxSummaryLength(role?: string | null): number {
  return SUMMARY_LIMITS[getPlan(role).id];
}

/** Nazwy planów do użycia poza kontekstem konkretnej roli (np. „od planu X"). */
export const PLAN_NAMES = {
  starter: PLANS[0].name,
  business: PLANS[1].name,
  scale: PLANS[2].name,
} as const;

/** Rola z bazy → plan pokazywany w UI. */
export function getPlan(role?: string | null): Plan {
  const r = (role || 'free').toLowerCase();
  if (r === 'free' || r === 'free_ver' || r === 'rookie') return PLANS[0];
  if (r === 'creator') return PLANS[1];
  return PLANS[2];
}

/** Limit danego aspektu w danym planie, gotowy do wyświetlenia. */
function describeLimit(plan: Plan, aspect: Aspect): string {
  if (aspect === 'sources') {
    return plan.sources === Infinity ? 'Unlimited' : String(plan.sources);
  }
  // Wstep nie ma wartosci liczbowej — tylko dostepnosc.
  if (aspect === 'intro') {
    return INTRO_PLANS.includes(plan.id) ? 'Available' : 'Unavailable';
  }
  // Warianty grafik czytamy z image-variant-limits.ts — bez duplikowania liczb.
  if (aspect === 'variants') {
    return String(getVariantLimit(plan.role));
  }
  return `Up to ${getChapterLimits(plan.role).max}`;
}

/** Plan użytkownika + wszystkie wyższe — materiał dla dymka. */
export function getPlanLadder(role: string | null | undefined, aspect: Aspect) {
  const current = getPlan(role);
  return PLANS.slice(PLANS.indexOf(current)).map((p) => ({
    id: p.id,
    name: p.name,
    limit: describeLimit(p, aspect),
    isCurrent: p.id === current.id,
  }));
}