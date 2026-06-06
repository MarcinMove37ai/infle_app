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
  free: 1,
  free_ver: 2,   // trial rookie — dostaje tyle co rookie
  demo: 1,
  rookie: 2,
  creator: 3,
  unlimited: 5,
  payd: 3,
  premium: 5,
  GOD: 5,
  admin: 5,
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

/**
 * Czy dany plan w ogóle korzysta z wyboru wariantów (limit > 1).
 * Przydatne w UI, by zdecydować, czy pokazywać galerię wyboru, czy klasyczny pojedynczy obraz.
 */
export function supportsVariantChoice(role: string | null | undefined): boolean {
  return getVariantLimit(role) > 1;
}