// src/components/pages/settings/CustomDomainsSection.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe, Plus, Trash2, Copy, CheckCircle, AlertCircle, Loader2,
  Lock, X, ExternalLink, RefreshCw, ChevronDown, ChevronUp, Info,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════
// Translations (self-contained)
// ════════════════════════════════════════════════════════════════════════
const translations = {
  pl: {
    sectionTitle: 'Własne domeny',
    sectionSubtitle: 'Podepnij własną subdomenę pod swoje strony zapisu',

    lockedBadge: 'Plan Creator',
    lockedHint: 'Dostępne w planach Creator i Unlimited',
    upgradeBtn: 'Zaktualizuj plan',

    emptyTitle: 'Brak podpiętych domen',
    emptyHint: 'Dodaj subdomenę, aby publikować strony zapisu pod własną marką',

    addBtn: 'Dodaj domenę',
    addLabel: 'Nowa subdomena',
    inputPlaceholder: 'landing.twojadomena.pl',
    inputHelper: 'Podaj subdomenę (np. landing.firma.pl, ebook.firma.pl)',
    submitBtn: 'Dodaj',
    submitting: 'Dodawanie...',
    cancelBtn: 'Anuluj',

    errorRequired: 'Podaj subdomenę',
    errorFormat: 'Niepoprawny format domeny',
    errorApex: 'Wymagana subdomena (np. landing.firma.pl, nie sama firma.pl)',
    errorReserved: 'Ta domena jest zarezerwowana',
    errorAlreadyExists: 'Ta domena jest już zarejestrowana',
    errorLimit: 'Limit domen osiągnięty ({current}/{limit})',
    errorLimitUpgrade: 'Upgrade na Unlimited dla nielimitowanej liczby',

    conflictTitle: 'Ta subdomena jest już używana',
    conflictBody: 'Aktualnie wskazuje na: {target} (rekord {type})',
    conflictWarning: 'Jeśli kontynuujesz, nasze instrukcje DNS zastąpią istniejącą konfigurację. Twoja obecna strona przestanie działać.',
    conflictForceBtn: 'Rozumiem, dodaj mimo to',
    conflictCancelBtn: 'Anuluj',

    statusPending: 'Konfiguracja DNS',
    statusVerifying: 'Weryfikacja DNS',
    statusActive: 'Aktywna',
    statusFailed: 'Niepowodzenie',

    instructionsTitle: 'Dodaj te rekordy DNS',
    instructionsStep1: 'Zaloguj się do panelu Twojego rejestratora (OVH, Cloudflare, GoDaddy, home.pl itd.) i znajdź sekcję "DNS" lub "Strefa DNS".',
    instructionsStep2: 'Dla każdego rekordu poniżej kliknij "Dodaj rekord", wybierz odpowiedni Typ (CNAME/TXT) i wklej skopiowane wartości w pola Nazwa i Wartość.',
    instructionsStep3: 'Zapisz zmiany. Sprawdzimy automatycznie co 30 sekund — gdy wszystko się powiedzie, zobaczysz status "Aktywna".',
    instructionsHintTime: 'Propagacja DNS może trwać od kilku minut do 30 minut.',
    purposeCname: 'Kieruje ruch z Twojej domeny na nasz serwer',
    purposeOwnership: 'Potwierdza, że domena należy do Ciebie',
    purposeDcv: 'Pozwala automatycznie wystawić certyfikat SSL (HTTPS)',
    recordStatusOk: 'OK',
    recordStatusPending: 'Czeka',
    recordStatusError: 'Sprawdź wartość',
    recordName: 'Nazwa',
    recordValue: 'Wartość',
    copied: 'Skopiowano',
    refreshBtn: 'Sprawdź teraz',
    refreshing: 'Sprawdzanie...',
    autoCheckHint: 'Auto-sprawdzanie co 30s',
    showDetails: 'Pokaż szczegóły',
    hideDetails: 'Ukryj szczegóły',

    sslValid: 'Cert SSL aktywny',
    openLink: 'Otwórz w nowej karcie',

    failedHint: 'Sprawdź czy rekordy DNS zostały poprawnie dodane',
    pendingShortHint: 'Wymaga konfiguracji DNS',
    showInstructionsBtn: 'Pokaż instrukcje',
    modalTitle: 'Konfiguracja DNS',
    modalCloseBtn: 'Zamknij',

    confirmDeleteTitle: 'Usuń domenę',
    confirmDeleteMsg: 'Czy na pewno chcesz usunąć domenę {domain}? Strony używające tej domeny wrócą do domyślnego adresu app.inflee.app.',
    confirmDeleteBtn: 'Usuń domenę',
    confirmCancelBtn: 'Anuluj',

    toastAdded: 'Domena {domain} została dodana',
    toastDeleted: 'Domena {domain} została usunięta',
    toastError: 'Wystąpił błąd. Spróbuj ponownie.',
    toastVerified: 'Domena {domain} została zweryfikowana',
  },
  en: {
    sectionTitle: 'Custom domains',
    sectionSubtitle: 'Connect your own subdomain to your landing pages',

    lockedBadge: 'Creator plan',
    lockedHint: 'Available on Creator and Unlimited plans',
    upgradeBtn: 'Upgrade plan',

    emptyTitle: 'No domains connected',
    emptyHint: 'Add a subdomain to publish your landing pages under your own brand',

    addBtn: 'Add domain',
    addLabel: 'New subdomain',
    inputPlaceholder: 'landing.yourdomain.com',
    inputHelper: 'Enter a subdomain (e.g. landing.company.com, ebook.company.com)',
    submitBtn: 'Add',
    submitting: 'Adding...',
    cancelBtn: 'Cancel',

    errorRequired: 'Enter a subdomain',
    errorFormat: 'Invalid domain format',
    errorApex: 'Subdomain required (e.g. landing.company.com, not just company.com)',
    errorReserved: 'This domain is reserved',
    errorAlreadyExists: 'This domain is already registered',
    errorLimit: 'Domain limit reached ({current}/{limit})',
    errorLimitUpgrade: 'Upgrade to Unlimited for unlimited domains',

    conflictTitle: 'This subdomain is already in use',
    conflictBody: 'Currently points to: {target} ({type} record)',
    conflictWarning: 'If you continue, our DNS instructions will replace the existing configuration. Your current site will stop working.',
    conflictForceBtn: 'Understood, add anyway',
    conflictCancelBtn: 'Cancel',

    statusPending: 'DNS configuration',
    statusVerifying: 'DNS Verifying',
    statusActive: 'Active',
    statusFailed: 'Failed',

    instructionsTitle: 'Add these DNS records',
    instructionsStep1: 'Log into your domain registrar panel (OVH, Cloudflare, GoDaddy, Namecheap, etc.) and find the "DNS" or "DNS Zone" section.',
    instructionsStep2: 'For each record below, click "Add record", choose the appropriate Type (CNAME/TXT), and paste the copied values into the Name and Value fields.',
    instructionsStep3: 'Save changes. We\'ll check automatically every 30 seconds — once everything works, you\'ll see "Active" status.',
    instructionsHintTime: 'DNS propagation may take from a few minutes to 30 minutes.',
    purposeCname: 'Routes traffic from your domain to our server',
    purposeOwnership: 'Proves the domain belongs to you',
    purposeDcv: 'Allows automatic SSL certificate (HTTPS) issuance',
    recordStatusOk: 'OK',
    recordStatusPending: 'Waiting',
    recordStatusError: 'Check value',
    recordName: 'Name',
    recordValue: 'Value',
    copied: 'Copied',
    refreshBtn: 'Check now',
    refreshing: 'Checking...',
    autoCheckHint: 'Auto-check every 30s',
    showDetails: 'Show details',
    hideDetails: 'Hide details',

    sslValid: 'SSL cert active',
    openLink: 'Open in new tab',

    failedHint: 'Check that DNS records were added correctly',
    pendingShortHint: 'DNS configuration required',
    showInstructionsBtn: 'Show instructions',
    modalTitle: 'DNS Configuration',
    modalCloseBtn: 'Close',

    confirmDeleteTitle: 'Remove domain',
    confirmDeleteMsg: 'Are you sure you want to remove {domain}? Pages using this domain will revert to the default app.inflee.app address.',
    confirmDeleteBtn: 'Remove domain',
    confirmCancelBtn: 'Cancel',

    toastAdded: 'Domain {domain} added',
    toastDeleted: 'Domain {domain} removed',
    toastError: 'An error occurred. Please try again.',
    toastVerified: 'Domain {domain} verified',
  },
} as const;

// ════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════
type DomainStatus = 'pending' | 'verifying' | 'active' | 'failed';

interface CustomDomain {
  id: string;
  domain: string;
  status: DomainStatus;
  sslStatus?: string | null;
  ownershipVerification?: { type: string; name: string; value: string } | null;
  verificationErrors?: Array<{ message: string }> | null;
  verifiedAt?: string | null;
  lastCheckedAt?: string | null;
  createdAt: string;
}

type RecordCheckStatus = 'ok' | 'pending' | 'error';

interface DomainInstructions {
  ownershipTxt?: { name: string; value: string } | null;
  dcvTxt?: { name: string; value: string } | null;
  cname?: { name: string; value: string } | null;
  // Per-record live status from backend DNS check.
  // Każdy klucz może być undefined (gdy rekord nie jest wymagany / już zweryfikowany przez CF).
  recordStatus?: {
    cname?: RecordCheckStatus;
    ownership?: RecordCheckStatus;
    dcv?: RecordCheckStatus;
  };
}

interface CustomDomainsSectionProps {
  userRole?: string | null;
  currentLang?: 'pl' | 'en';
}

// ════════════════════════════════════════════════════════════════════════
// Plan limits
// ════════════════════════════════════════════════════════════════════════
const ROLES_WITH_DOMAINS = new Set(['creator', 'unlimited', 'GOD']);

function getDomainLimit(role: string | null | undefined): number {
  if (role === 'creator') return 5;
  if (role === 'unlimited' || role === 'GOD') return Infinity;
  return 0;
}

// ════════════════════════════════════════════════════════════════════════
// Frontend domain validator (subdomena tylko, ≥3 segmenty)
// ════════════════════════════════════════════════════════════════════════
function validateSubdomain(raw: string): { ok: true; normalized: string } | { ok: false; error: string } {
  if (!raw || !raw.trim()) return { ok: false, error: 'errorRequired' };
  const normalized = raw.toLowerCase().trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  const hostnameRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
  if (!hostnameRegex.test(normalized)) return { ok: false, error: 'errorFormat' };
  if (normalized === 'inflee.app' || normalized.endsWith('.inflee.app')) {
    return { ok: false, error: 'errorReserved' };
  }
  const segments = normalized.split('.');
  if (segments.length < 3) return { ok: false, error: 'errorApex' };
  return { ok: true, normalized };
}

// ════════════════════════════════════════════════════════════════════════
// Status badge — kolorystyka spójna z resztą Settings
// (emerald dla active, amber dla pending, blue dla verifying, red dla failed)
// Wszystkie kolory tekstu i tła literalne, bez przezroczystości w klasach.
// ════════════════════════════════════════════════════════════════════════
function StatusBadge({ status, t }: { status: DomainStatus; t: typeof translations['pl'] }) {
  const config = {
    pending:   { label: t.statusPending,   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   icon: Loader2,     iconClass: 'animate-spin' },
    verifying: { label: t.statusVerifying, bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    icon: Loader2,     iconClass: 'animate-spin' },
    active:    { label: t.statusActive,    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle, iconClass: '' },
    failed:    { label: t.statusFailed,    bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: AlertCircle, iconClass: '' },
  }[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 ${config.bg} ${config.text} border ${config.border} text-[0.65rem] font-bold uppercase tracking-wider rounded`}>
      <Icon className={`w-3 h-3 ${config.iconClass}`} />
      {config.label}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Copy-to-clipboard button
// ════════════════════════════════════════════════════════════════════════
function CopyButton({ value, t }: { value: string; t: typeof translations['pl'] }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center justify-center w-6 h-6 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors cursor-pointer flex-shrink-0"
      title={copied ? t.copied : 'Copy'}
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Single DNS field — label + monospace value box + own copy button.
// User kopiuje DOKŁADNIE to czego potrzebuje wkleić w jednym polu rejestratora.
// ════════════════════════════════════════════════════════════════════════
function DnsField({ label, value, t }: { label: string; value: string; t: typeof translations['pl'] }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <div>
      <div className="text-[0.6rem] uppercase tracking-wider text-gray-500 font-semibold mb-1">{label}</div>
      <div className="flex items-stretch gap-1.5">
        <div className="flex-1 min-w-0 text-xs font-mono text-gray-900 break-all bg-white border border-gray-200 rounded px-2 py-1.5">
          {value}
        </div>
        <button
          onClick={handleCopy}
          className="inline-flex items-center justify-center w-8 bg-white text-gray-600 border border-gray-200 rounded hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer flex-shrink-0"
          title={copied ? t.copied : 'Copy'}
        >
          {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Per-record live status badge — pokazuje czy rekord:
//  - 'ok'      → ✓ zielony (rekord wykryty w DNS, wartość poprawna)
//  - 'pending' → ⏳ amber (rekord jeszcze nie istnieje, propagacja w toku)
//  - 'error'   → ⚠ czerwony (rekord istnieje ale wartość JEST INNA niż oczekiwana — literówka u usera)
// Brak prop'a status → badge się nie renderuje (np. dla rekordów które CF już zweryfikował).
// ════════════════════════════════════════════════════════════════════════
function RecordStatusBadge({
  status,
  t,
}: {
  status: 'ok' | 'pending' | 'error' | undefined;
  t: typeof translations['pl'];
}) {
  if (!status) return null;

  const config = {
    ok:      { label: t.recordStatusOk,      bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle,  iconClass: '' },
    pending: { label: t.recordStatusPending, bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   icon: Loader2,      iconClass: 'animate-spin' },
    error:   { label: t.recordStatusError,   bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: AlertCircle,  iconClass: '' },
  }[status];

  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 ${config.bg} ${config.text} border ${config.border} text-[0.6rem] font-bold uppercase tracking-wider rounded flex-shrink-0`}>
      <Icon className={`w-2.5 h-2.5 ${config.iconClass}`} />
      {config.label}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════
// DNS record card — type badge + purpose explanation + per-record live
// status badge + two fields (Name, Value) z osobnymi Copy buttonami.
// Zaprojektowane dla nietechnicznych użytkowników.
// ════════════════════════════════════════════════════════════════════════
function DnsRecordRow({
  type,
  purpose,
  name,
  value,
  status,
  t,
}: {
  type: string;
  purpose: string;
  name: string;
  value: string;
  status?: 'ok' | 'pending' | 'error';
  t: typeof translations['pl'];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2.5">
      {/* Header — type badge + krótkie wyjaśnienie + per-record status badge po prawej */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0 flex-1">
          <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-900 text-white text-[0.6rem] font-bold uppercase tracking-wider rounded flex-shrink-0">
            {type}
          </span>
          <span className="text-[0.7rem] text-gray-600 leading-snug">{purpose}</span>
        </div>
        <RecordStatusBadge status={status} t={t} />
      </div>

      {/* Two fields — każde z własnym Copy buttonem */}
      <div className="space-y-2">
        <DnsField label={t.recordName} value={name} t={t} />
        <DnsField label={t.recordValue} value={value} t={t} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Per-domain row — kompaktowa karta (1 wiersz nagłówek + 1 wiersz info).
// Pełne instrukcje DNS przeniesione do DnsInstructionsModal — user otwiera
// modalem przez button "Pokaż instrukcje" (lub auto przy dodawaniu nowej).
// ════════════════════════════════════════════════════════════════════════
interface DomainRowProps {
  domain: CustomDomain;
  onShowInstructions: () => void;
  onRefresh: () => void;
  onDelete: () => void;
  isRefreshing: boolean;
  t: typeof translations['pl'];
}

function DomainRow({ domain, onShowInstructions, onRefresh, onDelete, isRefreshing, t }: DomainRowProps) {
  const isPending = domain.status === 'pending' || domain.status === 'verifying';
  const isActive = domain.status === 'active';
  const isFailed = domain.status === 'failed';

  // Border color matching status (subtelny accent)
  const borderClass = isActive
    ? 'border-emerald-200'
    : isFailed
    ? 'border-red-200'
    : 'border-amber-200';

  return (
    <div className={`bg-white rounded-lg border ${borderClass} overflow-hidden`}>
      {/* Top row — domena (lewa) + akcje (prawa).
          Status badge ukryty na mobile (sm:flex), pokazuje się dopiero >=640px. */}
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Globe className={`w-4 h-4 flex-shrink-0 ${
            isActive ? 'text-emerald-600' : isFailed ? 'text-red-600' : 'text-amber-600'
          }`} />
          <span className="font-mono text-sm text-gray-900 truncate">{domain.domain}</span>
          {isActive && (
            <a
              href={`https://${domain.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-emerald-600 hover:text-emerald-700 transition-colors flex-shrink-0"
              title={t.openLink}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Status badge — desktop ZAWSZE, mobile TYLKO dla active.
              Pending/failed na mobile mają osobny wiersz pod top row (więcej miejsca dla buttonów akcji). */}
          <span className={`${isActive ? 'inline-flex' : 'hidden sm:inline-flex'}`}>
            <StatusBadge status={domain.status} t={t} />
          </span>

          {/* Pending: amber CTA "Pokaż instrukcje" */}
          {isPending && (
            <button
              onClick={onShowInstructions}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white text-[0.7rem] font-medium rounded-md hover:bg-amber-700 transition-colors cursor-pointer"
            >
              {t.showInstructionsBtn}
            </button>
          )}

          {/* Failed: red Refresh button + subtle Show instructions link */}
          {isFailed && (
            <>
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-red-700 text-[0.7rem] font-medium border border-red-300 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {isRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {t.refreshBtn}
              </button>
              <button
                onClick={onShowInstructions}
                className="inline-flex items-center gap-1 px-2 py-1 text-[0.7rem] font-medium text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
              >
                {t.showInstructionsBtn}
              </button>
            </>
          )}

          {/* Active: brak buttona — domena działa, user niczego nie potrzebuje */}

          <button
            onClick={onDelete}
            className="inline-flex items-center justify-center w-6 h-6 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Status badge — TYLKO mobile dla pending/failed. Active mieści się w top row,
          więc ten dodatkowy wiersz nie jest potrzebny. */}
      {!isActive && (
        <div className="sm:hidden px-3 pb-2.5 -mt-1">
          <StatusBadge status={domain.status} t={t} />
        </div>
      )}

      {/* Failed state — error message pod główną linią (zarówno desktop jak mobile) */}
      {isFailed && (
        <div className="px-3 pb-2.5 -mt-1">
          <p className="text-[0.7rem] text-red-700 leading-relaxed">
            {domain.verificationErrors?.[0]?.message || t.failedHint}
          </p>
        </div>
      )}
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════
// Add domain form (inline)
// ════════════════════════════════════════════════════════════════════════
interface AddFormProps {
  onSubmit: (domain: string, force: boolean) => Promise<void>;
  onCancel: () => void;
  conflictWarning: { target: string; type: string } | null;
  errorOverride: string | null;
  isSubmitting: boolean;
  t: typeof translations['pl'];
}

function AddDomainForm({ onSubmit, onCancel, conflictWarning, errorOverride, isSubmitting, t }: AddFormProps) {
  const [value, setValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (force: boolean) => {
    const result = validateSubdomain(value);
    if (!result.ok) {
      setValidationError(result.error);
      return;
    }
    setValidationError(null);
    await onSubmit(result.normalized, force);
  };

  const displayedError = errorOverride
    ? errorOverride
    : (validationError ? (t as any)[validationError] || t.errorFormat : null);

  return (
    <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-2.5">
      <div>
        <label className="block text-[0.65rem] font-semibold text-gray-900 uppercase tracking-wider mb-1.5">
          {t.addLabel}
        </label>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setValidationError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !isSubmitting && !conflictWarning) handleSubmit(false); }}
          disabled={isSubmitting || !!conflictWarning}
          placeholder={t.inputPlaceholder}
          className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-md bg-gray-50 text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
        />
        {!displayedError && !conflictWarning && (
          <p className="text-[0.7rem] text-gray-500 mt-1.5">{t.inputHelper}</p>
        )}
        {displayedError && !conflictWarning && (
          <p className="text-[0.7rem] text-red-600 mt-1.5 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            {displayedError}
          </p>
        )}
      </div>

      {conflictWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-[0.7rem] font-semibold text-amber-900">{t.conflictTitle}</p>
              <p className="text-[0.7rem] text-amber-800">
                {t.conflictBody.replace('{target}', conflictWarning.target).replace('{type}', conflictWarning.type)}
              </p>
              <p className="text-[0.7rem] text-amber-800 leading-relaxed">{t.conflictWarning}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {conflictWarning ? t.conflictCancelBtn : t.cancelBtn}
        </button>
        <button
          onClick={() => handleSubmit(!!conflictWarning)}
          disabled={isSubmitting || !value.trim()}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed ${
            conflictWarning
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
          {isSubmitting ? t.submitting : (conflictWarning ? t.conflictForceBtn : t.submitBtn)}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Confirm modal
// ════════════════════════════════════════════════════════════════════════
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  t: typeof translations['pl'];
}

function ConfirmModal({ isOpen, title, message, confirmLabel, onConfirm, onCancel, t }: ConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-gray-950/50 backdrop-blur-sm cursor-pointer" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 mb-6">{message}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
              {t.confirmCancelBtn}
            </button>
            <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer">
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// DNS instructions modal — full-size modal with step-by-step instructions
// and DNS records (CNAME + TXT + TXT). Replaces inline expanded panel.
// Auto-opens when a new domain is added; user can also open via "Show instructions".
// ════════════════════════════════════════════════════════════════════════
interface DnsInstructionsModalProps {
  isOpen: boolean;
  domain: CustomDomain | null;
  instructions: DomainInstructions | null;
  isPolling: boolean;
  onRefresh: () => void;
  onClose: () => void;
  isRefreshing: boolean;
  t: typeof translations['pl'];
}

function DnsInstructionsModal({
  isOpen, domain, instructions, isPolling, onRefresh, onClose, isRefreshing, t,
}: DnsInstructionsModalProps) {
  if (!isOpen || !domain) return null;

  const isPending = domain.status === 'pending' || domain.status === 'verifying';
  const isFailed = domain.status === 'failed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-950/50 backdrop-blur-sm cursor-pointer" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Globe className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-gray-900 leading-tight">{t.modalTitle}</h3>
              <p className="text-xs text-gray-500 font-mono truncate mt-0.5">{domain.domain}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={domain.status} t={t} />
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center w-7 h-7 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors cursor-pointer"
              title={t.modalCloseBtn}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body — scrollable when content exceeds modal height */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Failed banner — when domain verification failed */}
          {isFailed && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 leading-relaxed">
                  {domain.verificationErrors?.[0]?.message || t.failedHint}
                </p>
              </div>
            </div>
          )}

          {/* Step-by-step instructions */}
          <div>
            <div className="text-xs font-semibold text-gray-900 mb-2">{t.instructionsTitle}</div>
            <ol className="text-xs text-gray-700 leading-relaxed space-y-1.5 list-decimal list-inside">
              <li>{t.instructionsStep1}</li>
              <li>{t.instructionsStep2}</li>
              <li>{t.instructionsStep3}</li>
            </ol>
            {isPending && (
              <p className="text-xs text-gray-500 mt-2 italic">
                💡 {t.instructionsHintTime}
              </p>
            )}
          </div>

          {/* DNS records — każdy z live per-record status badge */}
          <div className="space-y-2">
            {instructions?.cname && (
              <DnsRecordRow
                type="CNAME"
                purpose={t.purposeCname}
                name={instructions.cname.name}
                value={instructions.cname.value}
                status={instructions.recordStatus?.cname}
                t={t}
              />
            )}
            {instructions?.ownershipTxt && (
              <DnsRecordRow
                type="TXT"
                purpose={t.purposeOwnership}
                name={instructions.ownershipTxt.name}
                value={instructions.ownershipTxt.value}
                status={instructions.recordStatus?.ownership}
                t={t}
              />
            )}
            {instructions?.dcvTxt && (
              <DnsRecordRow
                type="TXT"
                purpose={t.purposeDcv}
                name={instructions.dcvTxt.name}
                value={instructions.dcvTxt.value}
                status={instructions.recordStatus?.dcv}
                t={t}
              />
            )}
          </div>
        </div>

        {/* Footer — auto-check hint + manual refresh + close */}
        <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-gray-200 flex-shrink-0 bg-gray-50 rounded-b-xl">
          {isPending ? (
            <>
              <span className="text-[0.7rem] text-gray-500 inline-flex items-center gap-1.5">
                {isPolling && <Loader2 className="w-3 h-3 animate-spin" />}
                {t.autoCheckHint}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-700 text-xs font-medium border border-blue-200 rounded-md hover:bg-blue-50 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {isRefreshing ? t.refreshing : t.refreshBtn}
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  {t.modalCloseBtn}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={onClose}
              className="ml-auto px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {t.modalCloseBtn}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════
export default function CustomDomainsSection({ userRole, currentLang = 'pl' }: CustomDomainsSectionProps) {
  const t = translations[currentLang];
  const canUseFeature = !!userRole && ROLES_WITH_DOMAINS.has(userRole);
  const limit = getDomainLimit(userRole);

  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [instructionsMap, setInstructionsMap] = useState<Record<string, DomainInstructions>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<{ target: string; type: string } | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomDomain | null>(null);
  const [instructionsModalDomainId, setInstructionsModalDomainId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadDomains = useCallback(async () => {
    if (!canUseFeature) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/domains');
      if (res.ok) {
        const data = await res.json();
        setDomains(data.domains || []);
      }
    } catch (err) {
      console.error('Failed to load domains:', err);
    } finally {
      setIsLoading(false);
    }
  }, [canUseFeature]);

  useEffect(() => { loadDomains(); }, [loadDomains]);

  const syncDomain = useCallback(async (id: string): Promise<{ status: DomainStatus } | null> => {
    try {
      const res = await fetch(`/api/domains/${id}`);
      if (!res.ok) return null;
      const data = await res.json();
      setDomains(prev => prev.map(d => d.id === id ? { ...d, ...data.domain } : d));
      if (data.instructions) {
        // Łączymy instrukcje DNS z per-record status check (recordStatus jest osobnym
        // top-level polem w API response, ale w UI traktujemy je jako część instructions).
        setInstructionsMap(prev => ({
          ...prev,
          [id]: { ...data.instructions, recordStatus: data.recordStatus },
        }));
      }
      return { status: data.domain.status as DomainStatus };
    } catch (err) {
      console.error(`Failed to sync domain ${id}:`, err);
      return null;
    }
  }, []);

  useEffect(() => {
    const pendingIds = domains.filter(d => d.status === 'pending' || d.status === 'verifying').map(d => d.id);
    if (pendingIds.length === 0) return;

    const intervalId = setInterval(async () => {
      for (const id of pendingIds) {
        const prevStatus = domains.find(d => d.id === id)?.status;
        const result = await syncDomain(id);
        if (result?.status === 'active' && prevStatus !== 'active') {
          const dom = domains.find(d => d.id === id);
          if (dom) showToast('success', t.toastVerified.replace('{domain}', dom.domain));
        }
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [domains, syncDomain, showToast, t]);

  const handleRefresh = useCallback(async (id: string) => {
    setRefreshingId(id);
    await syncDomain(id);
    setRefreshingId(null);
  }, [syncDomain]);

  // Open instructions modal — fetch instructions on demand if we don't have
  // them cached (list endpoint doesn't return instructions, only basic fields).
  const handleShowInstructions = useCallback(async (id: string) => {
    setInstructionsModalDomainId(id);
    if (!instructionsMap[id]) {
      // Fire-and-forget: syncDomain populates instructionsMap when CF returns details.
      // Modal will re-render automatically when state updates.
      syncDomain(id);
    }
  }, [instructionsMap, syncDomain]);

  const handleAdd = useCallback(async (domain: string, force: boolean) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, force }),
      });
      const data = await res.json();

      if (res.status === 409 && data.error === 'domain_not_empty') {
        setConflictWarning({
          target: data.currentTarget || 'unknown',
          type: data.recordType || '?',
        });
        return;
      }
      if (res.status === 409 && data.error === 'domain_already_registered') {
        setSubmitError(t.errorAlreadyExists);
        return;
      }
      if (!res.ok) {
        setSubmitError(data.message || t.toastError);
        return;
      }

      setDomains(prev => [{ ...data.domain }, ...prev]);
      if (data.instructions) {
        // Po dodaniu nowej domeny POST nie zwraca recordStatus (jeszcze nie sprawdziliśmy),
        // więc inicjalizujemy go jako 'pending' dla każdego rekordu który ma instructions.
        // Pierwszy syncDomain (auto-otwarcie modala wywoła go) napełni właściwymi statusami.
        setInstructionsMap(prev => ({
          ...prev,
          [data.domain.id]: {
            ...data.instructions,
            recordStatus: {
              cname: data.instructions.cname ? 'pending' : undefined,
              ownership: data.instructions.ownershipTxt ? 'pending' : undefined,
              dcv: data.instructions.dcvTxt ? 'pending' : undefined,
            },
          },
        }));
      }
      setShowAddForm(false);
      setConflictWarning(null);
      // Auto-open modal so user immediately sees what DNS records to copy
      setInstructionsModalDomainId(data.domain.id);
      showToast('success', t.toastAdded.replace('{domain}', data.domain.domain));
    } catch (err) {
      console.error('Add domain error:', err);
      setSubmitError(t.toastError);
    } finally {
      setIsSubmitting(false);
    }
  }, [t, showToast]);

  const handleDelete = useCallback(async (id: string) => {
    const dom = domains.find(d => d.id === id);
    if (!dom) return;
    try {
      const res = await fetch(`/api/domains/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDomains(prev => prev.filter(d => d.id !== id));
        setInstructionsMap(prev => { const next = { ...prev }; delete next[id]; return next; });
        showToast('success', t.toastDeleted.replace('{domain}', dom.domain));
      } else {
        showToast('error', t.toastError);
      }
    } catch {
      showToast('error', t.toastError);
    } finally {
      setDeleteTarget(null);
    }
  }, [domains, t, showToast]);

  const isAtLimit = canUseFeature && domains.length >= limit;
  const limitText = limit === Infinity ? '∞' : String(limit);

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* Header — TYLKO label nad ramką (jak HEADER PREVIEW / AUTHOR NAME / IMAGE SETUP) */}
      <div className="mb-2 px-1">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {t.sectionTitle}
        </label>
      </div>

      {/* Card body — subtitle + licznik na górze ramki, potem zawartość */}
      <div className="bg-white rounded-xl border border-gray-200 px-3 py-4 sm:p-6">

        {/* Subtitle + counter / lock badge — pierwsza linia wewnątrz karty */}
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <span className="text-[0.7rem] text-gray-500 truncate">
            {t.sectionSubtitle}
          </span>

          {!canUseFeature && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[0.6rem] font-semibold rounded flex-shrink-0 leading-tight">
              <Lock className="w-2.5 h-2.5 flex-shrink-0" />
              {t.lockedBadge}
            </span>
          )}

          {canUseFeature && limit !== Infinity && domains.length > 0 && (
            <span className="text-[0.7rem] text-gray-500 font-medium flex-shrink-0">
              {domains.length}/{limitText}
            </span>
          )}
        </div>

      {/* Wrapper blur for locked state */}
      <div className={`transition-all duration-200 ${
        canUseFeature ? '' : 'blur-[2px] opacity-50 pointer-events-none select-none'
      }`}>

        {/* Loading state — kompaktowy */}
        {isLoading && canUseFeature && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          </div>
        )}

        {/* Empty state — kompaktowy, jedna linijka + button inline */}
        {!isLoading && canUseFeature && domains.length === 0 && !showAddForm && (
          <div className="flex items-center justify-between gap-3 py-3 px-3 bg-gray-50 border border-gray-200 border-dashed rounded-lg">
            <div className="flex items-center gap-2 min-w-0">
              <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <p className="text-xs text-gray-600">{t.emptyHint}</p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors cursor-pointer flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              {t.addBtn}
            </button>
          </div>
        )}

        {/* Domain list */}
        {!isLoading && canUseFeature && domains.length > 0 && (
          <div className="space-y-2">
            {domains.map(dom => (
              <DomainRow
                key={dom.id}
                domain={dom}
                onShowInstructions={() => handleShowInstructions(dom.id)}
                onRefresh={() => handleRefresh(dom.id)}
                onDelete={() => setDeleteTarget(dom)}
                isRefreshing={refreshingId === dom.id}
                t={t}
              />
            ))}
          </div>
        )}

        {/* Add form (inline) */}
        {!isLoading && canUseFeature && showAddForm && (
          <div className={domains.length > 0 ? 'mt-2' : ''}>
            <AddDomainForm
              onSubmit={handleAdd}
              onCancel={() => { setShowAddForm(false); setConflictWarning(null); setSubmitError(null); }}
              conflictWarning={conflictWarning}
              errorOverride={submitError}
              isSubmitting={isSubmitting}
              t={t}
            />
          </div>
        )}

        {/* Add button (when list not empty and form not showing) */}
        {!isLoading && canUseFeature && domains.length > 0 && !showAddForm && (
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <button
              onClick={() => setShowAddForm(true)}
              disabled={isAtLimit}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white text-blue-700 text-xs font-medium border border-blue-200 rounded-md hover:bg-blue-50 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              title={isAtLimit ? t.errorLimit.replace('{current}', String(domains.length)).replace('{limit}', limitText) : undefined}
            >
              <Plus className="w-3.5 h-3.5" />
              {t.addBtn}
            </button>
            {isAtLimit && (
              <span className="text-[0.7rem] text-gray-500 inline-flex items-center gap-1">
                <Info className="w-3 h-3" />
                {t.errorLimitUpgrade}
              </span>
            )}
          </div>
        )}

      </div>{/* /wrapper blur */}

      {/* Locked CTA */}
      {!canUseFeature && (
        <div className="mt-3">
          <button
            onClick={() => (window as any).openUpgradeModal?.('upgrade')}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 text-white text-xs font-medium rounded-md hover:bg-amber-600 transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            {t.upgradeBtn}
          </button>
          <p className="text-[0.7rem] text-gray-500 mt-2 text-center">{t.lockedHint}</p>
        </div>
      )}

      {/* Confirm delete modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title={t.confirmDeleteTitle}
        message={t.confirmDeleteMsg.replace('{domain}', deleteTarget?.domain || '')}
        confirmLabel={t.confirmDeleteBtn}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        t={t}
      />

      {/* DNS instructions modal — opens for pending/failed domains
          and auto-opens after adding a new domain */}
      {(() => {
        const modalDomain = domains.find(d => d.id === instructionsModalDomainId) || null;
        return (
          <DnsInstructionsModal
            isOpen={!!modalDomain}
            domain={modalDomain}
            instructions={modalDomain ? instructionsMap[modalDomain.id] || null : null}
            isPolling={modalDomain ? (modalDomain.status === 'pending' || modalDomain.status === 'verifying') : false}
            onRefresh={() => modalDomain && handleRefresh(modalDomain.id)}
            onClose={() => setInstructionsModalDomainId(null)}
            isRefreshing={!!modalDomain && refreshingId === modalDomain.id}
            t={t}
          />
        );
      })()}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {toast.type === 'success'
              ? <CheckCircle className="w-4 h-4" />
              : <AlertCircle className="w-4 h-4" />}
            <span className="text-sm font-medium">{toast.text}</span>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}