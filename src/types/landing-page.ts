// src/types/landing-page.ts
//
// Typy TypeScript dla treści strony zapisu (LP).
//
// Backbone dla wszystkich komponentów sekcji, endpointów (preview/edit/generate)
// oraz hooków edytora. Struktura odpowiada 1:1 schematowi v2 w bazie:
//   - 7 kolumn jsonb w page_contents (po jednej na sekcję)
//   - schema_version = 'v2'
//
// Konwencja:
//   - Każda sekcja jako osobny interface (Hero, Problem, Promise, ...)
//   - PageContent = kontener łączący wszystkie + meta
//   - PreviewApiResponse = full response z /api/pages/preview/[token]
//   - Helpers (type guards) w runtime'ie do walidacji nieznanego JSON-a

// ──────────────────────────────────────────────────────────────────────────
// IKONY — whitelist 16 nazw lucide-react używanych w benefits.items[].icon
// ──────────────────────────────────────────────────────────────────────────

export const ICON_NAMES = [
  'Target', 'Bell', 'Filter', 'Users', 'ListChecks', 'Calculator',
  'Shield', 'Zap', 'BookOpen', 'BrainCircuit', 'TrendingUp', 'Lightbulb',
  'Compass', 'Rocket', 'Database', 'Award',
] as const;

export type IconName = typeof ICON_NAMES[number];

export const isValidIcon = (s: unknown): s is IconName =>
  typeof s === 'string' && (ICON_NAMES as readonly string[]).includes(s);

// ──────────────────────────────────────────────────────────────────────────
// SEKCJA 1: HERO
// ──────────────────────────────────────────────────────────────────────────

/**
 * Hero — pierwsza sekcja LP. Headline w dwóch warstwach (l1 + l2),
 * podtytuł z mechanizmem, 3 bariery "Bez ..." i przycisk CTA.
 */
export interface HeroSection {
  /** Główny headline z transformacją PRZED → PO (max 12 słów). */
  headline_l1: string;
  /** Drugi headline w sentence case, pod akcent kolorystyczny (3-6 słów). */
  headline_l2: string;
  /** Mechanizm prostymi słowami (max 18 słów, JEDNO zdanie). */
  subheadline: string;
  /** Trzy "Bez ..." bullet pointy — różne wymiary obaw. */
  barriers: [string, string, string];
  /** Etykieta przycisku akcji (max 5 słów). */
  cta_primary: string;
}

// ──────────────────────────────────────────────────────────────────────────
// SEKCJA 2: PROBLEM
// ──────────────────────────────────────────────────────────────────────────

export interface ProblemPain {
  /** Tytuł bólu (max 12 słów, konkret). */
  title: string;
  /** Rozwinięcie 1-2 zdania (max 40 słów, czas teraźniejszy, perspektywa "Ty"). */
  text: string;
}

/**
 * Problem — sekcja bólu. Hook + żywa scena + 6-8 osi bólu + puenta.
 * Cała sekcja w czasie teraźniejszym, perspektywa "Ty".
 */
export interface ProblemSection {
  /** Hook (max 8 słów) — pytanie lub stwierdzenie. */
  headline: string;
  /** Żywa scena zmysłowa (max 40 słów, 1-2 zdania). */
  intro: string;
  /** 6-8 osi bólu, każda z innego wymiaru. */
  pains: ProblemPain[];
  /** Synteza w jedną mocną linię (max 25 słów). */
  summary: string;
}

// ──────────────────────────────────────────────────────────────────────────
// SEKCJA 3: PROMISE
// ──────────────────────────────────────────────────────────────────────────

/**
 * Promise — most z bólu do rozwiązania. Eyebrow label + headline + tekst
 * z refrenem "bez X, bez Y" + 3 obserwowalne outcomes z kotwicą czasową.
 */
export interface PromiseSection {
  /** Eyebrow text nad headline (max 6 słów, np. "Po przeczytaniu tego e-booka"). */
  label: string;
  /** Główna obietnica w jednej linii (max 12 słów). */
  headline: string;
  /** Rozwinięcie 2-3 zdania (max 60 słów) — refren "bez X, bez Y". */
  text: string;
  /** Trzy obserwowalne zmiany z kotwicą czasową ("Od jutra ...", "Za tydzień ..."). */
  outcomes: [string, string, string];
}

// ──────────────────────────────────────────────────────────────────────────
// SEKCJA 4: BENEFITS
// ──────────────────────────────────────────────────────────────────────────

export interface BenefitItem {
  /** Konkretna rzecz którą czytelnik dostaje (max 7 słów, NIE slogan). */
  title: string;
  /** Mechanizm + rezultat (max 45 słów, 2 zdania). */
  text: string;
  /** Nazwa ikony z whitelisty IconName. */
  icon: IconName;
}

/**
 * Benefits — 6-8 konkretnych narzędzi/metod, każde z innej osi.
 * Perspektywa REZULTATU (co masz), NIE bólu.
 */
export interface BenefitsSection {
  /** Tytuł sekcji (max 6 słów). */
  headline: string;
  /** Pod-tytuł (max 15 słów). */
  subheadline: string;
  /** 6-8 elementów. */
  items: BenefitItem[];
}

// ──────────────────────────────────────────────────────────────────────────
// SEKCJA 5: CONTENT (WIIFM milestones)
// ──────────────────────────────────────────────────────────────────────────

export interface ContentItem {
  /** Korzyść w trybie konkretnym, druga osoba (max 8 słów). */
  title: string;
  /** Dlaczego to dla Ciebie dobre — deklaratywnie (max 30 słów). */
  text: string;
}

/**
 * Content — DOKŁADNIE 4 milestone'y WIIFM (What's In It For Me).
 * NIE jest spisem rozdziałów. Logiczna progresja korzyści, każda z innej osi.
 * Frontend dorabia numerację 1-4.
 */
export interface ContentSection {
  /** Tytuł sekcji (max 6 słów). */
  headline: string;
  /** Pod-tytuł (max 15 słów). */
  subheadline: string;
  /** Dokładnie 4 milestone'y. */
  items: [ContentItem, ContentItem, ContentItem, ContentItem];
}

// ──────────────────────────────────────────────────────────────────────────
// SEKCJA 6: FORM
// ──────────────────────────────────────────────────────────────────────────

/**
 * Form — sekcja konwersyjna. Headline + sub + CTA + linia zaufania.
 */
export interface FormSection {
  /** Imperative headline z wykrzyknikiem (max 12 słów). */
  headline: string;
  /** Mikro-zachęta pod headline (max 15 słów). */
  subheadline: string;
  /** Etykieta przycisku (max 5 słów, outcome-focused). */
  cta: string;
  /** Linia zaufania pod przyciskiem (max 12 słów). */
  trust_line: string;
}

// ──────────────────────────────────────────────────────────────────────────
// SEKCJA 7: FAQ
// ──────────────────────────────────────────────────────────────────────────

export interface FaqItem {
  /** Obiekcja psychologiczna (max 25 słów). */
  question: string;
  /** Empatyczna odpowiedź 3-częściowa (max 60 słów). */
  answer: string;
}

/**
 * FAQ — 7-9 obiekcji psychologicznych przed konwersją.
 */
export interface FaqSection {
  /** Tytuł sekcji (max 4 słowa). */
  headline: string;
  /** 7-9 par pytanie/odpowiedź. */
  items: FaqItem[];
}

// ──────────────────────────────────────────────────────────────────────────
// KONTENER — pełna treść strony (1:1 z page_contents w bazie)
// ──────────────────────────────────────────────────────────────────────────

/**
 * PageContent — pełna struktura zwracana przez API i renderowana przez frontend.
 * Każda sekcja może być null jeśli treść nie została jeszcze wygenerowana
 * (np. tuż po utworzeniu strony przed wywołaniem /api/pages/new-ai-content).
 */
export interface PageContent {
  id: string;
  schema_version: 'v2' | string;
  hero: HeroSection | null;
  problem: ProblemSection | null;
  promise: PromiseSection | null;
  benefits: BenefitsSection | null;
  content: ContentSection | null;
  form: FormSection | null;
  faq: FaqSection | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** Union nazw sekcji — dla walidacji ścieżek edycji. */
export type SectionName = 'hero' | 'problem' | 'promise' | 'benefits' | 'content' | 'form' | 'faq';

export const SECTION_NAMES = [
  'hero', 'problem', 'promise', 'benefits', 'content', 'form', 'faq',
] as const satisfies readonly SectionName[];

export const isSectionName = (s: unknown): s is SectionName =>
  typeof s === 'string' && (SECTION_NAMES as readonly string[]).includes(s);

// ──────────────────────────────────────────────────────────────────────────
// API — response z /api/pages/preview/[token]
// ──────────────────────────────────────────────────────────────────────────

/** Pojedynczy rozdział e-booka w spisie treści (TOC). */
export interface EbookChapterTocItem {
  position: number;
  title: string;
  /** Pierwsze ~120 znaków treści rozdziału — do pokazania w TOC. */
  preview: string;
}

/** E-book — okładka + meta do TOC. */
export interface EbookData {
  id: number;
  title: string;
  subtitle: string | null;
  total_pages: number | null;
  estimatedPages: number;
  chapterCount: number;
  chapters: EbookChapterTocItem[];
}

/**
 * PreviewApiResponse — pełen kontekst LP.
 * Zwracany przez GET /api/pages/preview/[token].
 */
export interface PreviewApiResponse {
  // Metadata strony
  id: string;
  title: string;
  status: 'draft' | 'pending' | 'published' | string;
  type: string | null;
  language: 'pl' | 'en' | string;
  color: string | null;
  url: string | null;
  draft_url: string | null;
  visitors: number;
  userId: string | null;
  ebookId: number | null;
  authorDisplayName: string | null;
  authorLogoUrl: string;

  // Treść strony
  pageContent: PageContent | null;

  // E-book + TOC
  ebook: EbookData | null;

  // Resolved mockup URL — gotowy do wstawienia w <Image src={...} />
  resolvedMockupUrl: string;
}

// ──────────────────────────────────────────────────────────────────────────
// API — body PATCH-a /api/pages/[id]/content
// ──────────────────────────────────────────────────────────────────────────

/**
 * EditPath — ścieżka edycji.
 * Pierwszy element zawsze SectionName, reszta to klucze obiektów lub indeksy tablic.
 *
 * Przykłady:
 *   ['hero', 'headline_l1']
 *   ['hero', 'barriers', 0]
 *   ['benefits', 'items', 2, 'title']
 *   ['faq', 'items', 0, 'question']
 */
export type EditPath = [SectionName, ...Array<string | number>];

export interface EditPatchBody {
  path: EditPath;
  value: string;
}

export interface EditPatchResponse {
  success: true;
  pageId: string;
  section: SectionName;
  path: EditPath;
  value: string;
  updatedAt: string;
  /** Cała sekcja po edycji — wygodne dla optymistycznego update'u w UI. */
  updatedSection: HeroSection | ProblemSection | PromiseSection | BenefitsSection | ContentSection | FormSection | FaqSection;
}

// ──────────────────────────────────────────────────────────────────────────
// RUNTIME GUARDS — walidacja nieznanego JSON-a
// ──────────────────────────────────────────────────────────────────────────

/** Typ pomocniczy dla obiektów. */
type UnknownObject = Record<string, unknown>;

const isObject = (v: unknown): v is UnknownObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const hasStringField = (obj: UnknownObject, key: string): boolean =>
  typeof obj[key] === 'string';

const hasArrayField = (obj: UnknownObject, key: string): obj is UnknownObject & Record<string, unknown[]> =>
  Array.isArray(obj[key]);

/**
 * isHeroSection — sprawdza strukturę w runtime'ie.
 * NIE waliduje długości (limity słów) — to jest robione w endpoint POST.
 */
export function isHeroSection(v: unknown): v is HeroSection {
  if (!isObject(v)) return false;
  if (!hasStringField(v, 'headline_l1')) return false;
  if (!hasStringField(v, 'headline_l2')) return false;
  if (!hasStringField(v, 'subheadline')) return false;
  if (!hasStringField(v, 'cta_primary')) return false;
  if (!Array.isArray(v.barriers) || v.barriers.length !== 3) return false;
  if (!v.barriers.every(b => typeof b === 'string')) return false;
  return true;
}

export function isProblemSection(v: unknown): v is ProblemSection {
  if (!isObject(v)) return false;
  if (!hasStringField(v, 'headline')) return false;
  if (!hasStringField(v, 'intro')) return false;
  if (!hasStringField(v, 'summary')) return false;
  if (!hasArrayField(v, 'pains')) return false;
  return v.pains.every(p =>
    isObject(p) && hasStringField(p, 'title') && hasStringField(p, 'text'),
  );
}

export function isPromiseSection(v: unknown): v is PromiseSection {
  if (!isObject(v)) return false;
  if (!hasStringField(v, 'label')) return false;
  if (!hasStringField(v, 'headline')) return false;
  if (!hasStringField(v, 'text')) return false;
  if (!Array.isArray(v.outcomes) || v.outcomes.length !== 3) return false;
  return v.outcomes.every(o => typeof o === 'string');
}

export function isBenefitsSection(v: unknown): v is BenefitsSection {
  if (!isObject(v)) return false;
  if (!hasStringField(v, 'headline')) return false;
  if (!hasStringField(v, 'subheadline')) return false;
  if (!hasArrayField(v, 'items')) return false;
  return v.items.every(it =>
    isObject(it) &&
    hasStringField(it, 'title') &&
    hasStringField(it, 'text') &&
    isValidIcon(it.icon),
  );
}

export function isContentSection(v: unknown): v is ContentSection {
  if (!isObject(v)) return false;
  if (!hasStringField(v, 'headline')) return false;
  if (!hasStringField(v, 'subheadline')) return false;
  if (!Array.isArray(v.items) || v.items.length !== 4) return false;
  return v.items.every(it =>
    isObject(it) && hasStringField(it, 'title') && hasStringField(it, 'text'),
  );
}

export function isFormSection(v: unknown): v is FormSection {
  if (!isObject(v)) return false;
  return (
    hasStringField(v, 'headline') &&
    hasStringField(v, 'subheadline') &&
    hasStringField(v, 'cta') &&
    hasStringField(v, 'trust_line')
  );
}

export function isFaqSection(v: unknown): v is FaqSection {
  if (!isObject(v)) return false;
  if (!hasStringField(v, 'headline')) return false;
  if (!hasArrayField(v, 'items')) return false;
  return v.items.every(it =>
    isObject(it) && hasStringField(it, 'question') && hasStringField(it, 'answer'),
  );
}

/**
 * isPageContent — sprawdza pełną strukturę pageContent.
 * Każda sekcja może być null — wtedy nie waliduje tej sekcji.
 */
export function isPageContent(v: unknown): v is PageContent {
  if (!isObject(v)) return false;
  if (!hasStringField(v, 'id')) return false;
  if (!hasStringField(v, 'schema_version')) return false;

  // Każda sekcja: null lub odpowiedni kształt
  const sections: Array<[string, (val: unknown) => boolean]> = [
    ['hero', isHeroSection],
    ['problem', isProblemSection],
    ['promise', isPromiseSection],
    ['benefits', isBenefitsSection],
    ['content', isContentSection],
    ['form', isFormSection],
    ['faq', isFaqSection],
  ];

  for (const [key, guard] of sections) {
    const val = v[key];
    if (val !== null && !guard(val)) return false;
  }

  return true;
}