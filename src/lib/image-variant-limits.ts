// src/lib/image-variant-limits.ts
//
// Limit wariantów grafik (okładka + ilustracje rozdziałów) generowanych jednocześnie,
// zależny od roli/planu usera. Jedno źródło prawdy — używają tego oba generatory
// (generate-cover, chapters/.../generate-image) oraz UI (Step4, modal wyboru).
//
// Semantyka:
//   1  → brak wyboru wariantów: generujemy jedną grafikę (klasyczny flow).
//   2+ → generujemy N wariantów naraz, user wybiera jeden, reszta trafia do archiwum.
//
// Liczby są celowo w jednym miejscu — zmiana planów = zmiana tej mapy, bez dotykania
// generatorów ani UI.

import type { Role } from '@prisma/client';

export const IMAGE_VARIANT_LIMITS: Record<Role, number> = {
  // Starter — jedna grafika, bez wyboru wariantow.
  // Wczesniej rookie i free_ver mialy 2, a free i demo 1; wyrownane w dol,
  // zeby wszystkie role Startera mialy identyczne limity (patrz planLimits.ts).
  free: 1,
  free_ver: 1,
  demo: 1,
  rookie: 1,
  // Business
  creator: 3,
  payd: 3,
  // Scale
  unlimited: 10,
  premium: 10,
  GOD: 10,
  admin: 10,
};

// Bezpieczny domyślny limit, gdy rola jest nieznana/niepodana.
const DEFAULT_VARIANT_LIMIT = 1;

/**
 * Zwraca liczbę wariantów grafiki do wygenerowania naraz dla danej roli.
 * Nieznana/pusta rola → DEFAULT_VARIANT_LIMIT (1, czyli klasyczny flow bez wyboru).
 */
export function getVariantLimit(role: string | null | undefined): number {
  if (!role) return DEFAULT_VARIANT_LIMIT;
  const limit = (IMAGE_VARIANT_LIMITS as Record<string, number>)[role];
  return typeof limit === 'number' ? limit : DEFAULT_VARIANT_LIMIT;
}
