// src/lib/chapterLimits.ts
//
// Jedno źródło prawdy dla limitów liczby rozdziałów per rola użytkownika.
// Importowane przez:
//   • API generate-toc (server) — klampuje wybór usera i wstrzykuje do promptu,
//   • front (Step1Details) — rysuje slider w uczciwym zakresie roli.
// Gdy limity się zmienią, edytujemy TYLKO ten plik.

export interface ChapterLimits {
  min: number;
  max: number;
  /** Wartość domyślna slidera (bez regresji: celujemy w max, jak dotychczas prompt). */
  default: number;
}

export function getChapterLimits(role?: string | null): ChapterLimits {
  const r = (role || 'free').toLowerCase();

  // Dolna granica zawsze 4 — każdy plan może zejść do 4 rozdziałów.
  // Górna granica zależy od planu. Domyślnie celujemy w max (zero regresji).
  if (r === 'free' || r === 'free_ver' || r === 'rookie') {
    return { min: 4, max: 6, default: 6 };
  }
  if (r === 'creator') {
    return { min: 4, max: 12, default: 12 };
  }
  // unlimited / god / wszystko inne
  return { min: 4, max: 15, default: 15 };
}