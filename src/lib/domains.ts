// src/lib/domains.ts

/**
 * Helpers for custom domain feature:
 *  - canUseCustomDomain: plan/role gate
 *  - getPublicPageUrl: builds full public URL for an ebook landing page,
 *    using user's primary custom domain if available, fallback otherwise
 *  - validateDomainInput: sanitizes & validates domain string from user input
 */

import type { Role } from '@prisma/client';

// ---------- Plan gating ----------

/**
 * Roles allowed to configure a custom domain.
 * Aligned with Inflee plan tiers — Creator and above.
 */
export const ROLES_WITH_CUSTOM_DOMAIN: Role[] = [
  'creator',
  'unlimited',
  'GOD',
];

export function canUseCustomDomain(role: Role | null | undefined): boolean {
  if (!role) return false;
  return ROLES_WITH_CUSTOM_DOMAIN.includes(role);
}

// ---------- Public URL generator ----------

type PageUrlInput = {
  /** page.url from DB — relative path like "/ebookpage/by-author/title-abc123" */
  pageUrl: string | null;
};

type CustomDomainInput = {
  domain: string;
  status: string; // DomainStatus enum value, but typed loosely to avoid Prisma import collision
};

type UserUrlInput = {
  primaryDomain?: CustomDomainInput | null;
};

/**
 * Build the full public URL for a landing page.
 *
 * Priority:
 *   1. User's primary custom domain (if status === 'active')
 *      → "https://landing.example.com/<last-segment-of-page.url>"
 *   2. Fallback to APP_HOST
 *      → "https://app.inflee.app<page.url>"
 *
 * IMPORTANT: This function is the single source of truth for public URLs.
 * Use it everywhere a public link is shown to user (publish screen, share buttons, lead emails).
 */
export function getPublicPageUrl(
  page: PageUrlInput,
  user: UserUrlInput
): string {
  const appHost = process.env.APP_HOST || 'app.inflee.app';

  if (!page.pageUrl) {
    // Page has no URL set yet (unpublished draft) — return placeholder
    return `https://${appHost}`;
  }

  const primary = user.primaryDomain;
  const isPrimaryActive = primary && primary.status === 'active';

  if (isPrimaryActive && primary) {
    // Custom domain: take ONLY the last path segment as slug
    // e.g. "/ebookpage/by-john/dieta-keto-5d2" → "dieta-keto-5d2"
    const segments = page.pageUrl.split('/').filter(Boolean);
    const slug = segments[segments.length - 1] ?? '';
    return `https://${primary.domain}/${slug}`;
  }

  // Fallback: app.inflee.app + full path
  const path = page.pageUrl.startsWith('/') ? page.pageUrl : `/${page.pageUrl}`;
  return `https://${appHost}${path}`;
}

// ---------- Domain input validation ----------

export type DomainValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

/**
 * Validate and normalize domain string from user input.
 *
 * Accepts:
 *   - "landing.example.com"
 *   - "https://landing.example.com"
 *   - "LANDING.EXAMPLE.COM/"
 * Rejects:
 *   - empty / whitespace-only
 *   - apex domains under inflee.app (reserved)
 *   - syntactically invalid hostnames
 *   - apex (root) domains (we only support subdomains for now,
 *     as Cloudflare for SaaS on non-Enterprise doesn't support apex)
 */
export function validateDomainInput(raw: string): DomainValidationResult {
  if (!raw || typeof raw !== 'string') {
    return { ok: false, error: 'invalid_domain' };
  }

  // Strip protocol, trailing slash, leading/trailing whitespace
  const normalized = raw
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/^www\./, ''); // drop www. prefix to prevent www.foo.com vs foo.com confusion

  // Hostname regex: labels of 1-63 chars, separated by dots, TLD min 2 chars
  // RFC 1035 / 1123 compliant
  const hostnameRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
  if (!hostnameRegex.test(normalized)) {
    return { ok: false, error: 'invalid_domain' };
  }

  // Block reserved domains
  if (normalized === 'inflee.app' || normalized.endsWith('.inflee.app')) {
    return { ok: false, error: 'reserved_domain' };
  }

  // Apex check: subdomain has at least 3 labels (sub.domain.tld),
  // apex has exactly 2 (domain.tld). We allow apex for now — most
  // registrars support CNAME flattening / ALIAS — but flag it for
  // potential UX warning in UI.
  // (No hard rejection here; let CF return error if it cannot issue cert.)

  return { ok: true, normalized };
}