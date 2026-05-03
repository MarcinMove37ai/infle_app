// src/lib/cloudflare.ts

/**
 * Cloudflare API client for Custom Hostnames management.
 * Used for SaaS multi-tenant custom domain support.
 *
 * Endpoint reference:
 * https://developers.cloudflare.com/api/operations/custom-hostname-for-a-zone-list-custom-hostnames
 */

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

// ---------- Types ----------

export type CFOwnershipVerification = {
  type: 'txt' | 'http';
  name: string;
  value: string;
};

export type CFSslStatus =
  | 'initializing'
  | 'pending_validation'
  | 'pending_issuance'
  | 'pending_deployment'
  | 'active'
  | 'pending_deletion'
  | 'deleted'
  | 'expired'
  | 'deactivated'
  | 'failed';

export type CFCustomHostnameStatus =
  | 'active'
  | 'pending'
  | 'active_redeploying'
  | 'moved'
  | 'pending_deletion'
  | 'pending_blocked'
  | 'pending_migration'
  | 'pending_provisioned'
  | 'test_pending'
  | 'test_active'
  | 'test_active_apex'
  | 'test_blocked'
  | 'test_failed'
  | 'provisioned'
  | 'blocked';

export type CFCustomHostname = {
  id: string;
  hostname: string;
  status: CFCustomHostnameStatus;
  ssl: {
    id?: string;
    status: CFSslStatus;
    method: 'http' | 'txt' | 'email';
    type: 'dv';
    validation_errors?: Array<{ message: string }>;
    validation_records?: Array<{
      txt_name?: string;
      txt_value?: string;
      http_url?: string;
      http_body?: string;
    }>;
  };
  ownership_verification?: CFOwnershipVerification;
  ownership_verification_http?: {
    http_url: string;
    http_body: string;
  };
  verification_errors?: string[];
  created_at?: string;
};

type CFResponse<T> = {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: Array<{ code: number; message: string }>;
  result: T;
};

// ---------- Internal: fetch wrapper ----------

function getCredentials() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;

  if (!token) {
    throw new Error('CLOUDFLARE_API_TOKEN env variable is not set');
  }
  if (!zoneId) {
    throw new Error('CLOUDFLARE_ZONE_ID env variable is not set');
  }

  return { token, zoneId };
}

async function cfFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const { token } = getCredentials();

  const res = await fetch(`${CF_API_BASE}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const data = (await res.json()) as CFResponse<T>;

  if (!data.success) {
    const message =
      data.errors?.map(e => `[${e.code}] ${e.message}`).join('; ') ||
      `Cloudflare API error (HTTP ${res.status})`;
    throw new Error(`Cloudflare API: ${message}`);
  }

  return data.result;
}

// ---------- Public functions ----------

/**
 * Create a new custom hostname (i.e. register customer's domain in Cloudflare for SaaS).
 *
 * Cloudflare will:
 *  - reserve the hostname,
 *  - issue DCV instructions (TXT record customer must add),
 *  - automatically provision Let's Encrypt cert once DCV passes.
 *
 * @param hostname - customer's domain, e.g. "landing.example.com"
 * @returns CF response with id, ssl status, and ownership_verification (TXT record to display to user)
 */
export async function createCustomHostname(
  hostname: string
): Promise<CFCustomHostname> {
  const { zoneId } = getCredentials();

  // Custom origin server — KRYTYCZNE dla architektury Railway.
  // Bez tego CF for SaaS forwarduje request do origin z oryginalnym Host headerem
  // klienta (np. "lp.legalgpt.pl"), a Railway zwraca 404 bo ten hostname nie jest
  // w jego liście custom domains.
  //
  // Z tym ustawieniem:
  //  - CF nadpisuje Host header na "connect.inflee.app" (Railway rozpoznaje, akceptuje)
  //  - CF dodaje "CF-Custom-Hostname" header z oryginalną domeną klienta
  //  - Middleware odczytuje oryginalny host z "cf-custom-hostname" zamiast "host"
  const customOriginServer = process.env.CUSTOM_DOMAIN_CNAME_TARGET || 'connect.inflee.app';

  return cfFetch<CFCustomHostname>(
    `/zones/${zoneId}/custom_hostnames`,
    {
      method: 'POST',
      body: JSON.stringify({
        hostname,
        // Override Host header forwarded to origin — Railway musi widzieć znany hostname.
        // SNI nie ustawiamy explicit — to feature Enterprise. CF domyślnie użyje
        // custom_origin_server jako SNI (Railway akceptuje cert dla connect.inflee.app).
        custom_origin_server: customOriginServer,
        ssl: {
          method: 'txt',
          type: 'dv',
          settings: {
            min_tls_version: '1.2',
          },
        },
      }),
    }
  );
}

/**
 * Get current state of a custom hostname (poll for status changes).
 *
 * Use this to check whether SSL has been issued (ssl.status === 'active')
 * and whether the hostname is fully active (status === 'active').
 *
 * @param customHostnameId - id returned by createCustomHostname
 */
export async function getCustomHostname(
  customHostnameId: string
): Promise<CFCustomHostname> {
  const { zoneId } = getCredentials();

  return cfFetch<CFCustomHostname>(
    `/zones/${zoneId}/custom_hostnames/${customHostnameId}`,
    { method: 'GET' }
  );
}

/**
 * Update custom_origin_server / custom_origin_sni for an existing custom hostname.
 *
 * Used to backfill `custom_origin_server` config dla domen utworzonych zanim
 * dodaliśmy ten parametr do `createCustomHostname`. PATCH nie wymaga
 * re-walidacji SSL ani DNS — domena pozostaje 'active'.
 *
 * Bez `custom_origin_server` CF for SaaS forwarduje request do origin
 * z oryginalnym Host headerem klienta — Railway zwraca 404. Z tym ustawionym,
 * CF nadpisuje Host na `connect.inflee.app` (Railway akceptuje) a oryginalny
 * hostname wysyła w nagłówku `CF-Custom-Hostname`.
 *
 * @param customHostnameId - id istniejącego custom hostname w CF
 * @param originServer - hostname Railway origin (default: connect.inflee.app)
 */
export async function updateCustomHostnameOrigin(
  customHostnameId: string,
  originServer?: string
): Promise<CFCustomHostname> {
  const { zoneId } = getCredentials();
  const customOriginServer = originServer || process.env.CUSTOM_DOMAIN_CNAME_TARGET || 'connect.inflee.app';

  return cfFetch<CFCustomHostname>(
    `/zones/${zoneId}/custom_hostnames/${customHostnameId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        // Tylko custom_origin_server — custom_origin_sni jest Enterprise-only
        custom_origin_server: customOriginServer,
      }),
    }
  );
}

/**
 * Delete a custom hostname from Cloudflare for SaaS.
 *
 * Required when user removes domain from their account, otherwise the same
 * hostname cannot be re-registered by another user.
 *
 * @param customHostnameId - id of the hostname to remove
 */
export async function deleteCustomHostname(
  customHostnameId: string
): Promise<{ id: string }> {
  const { zoneId } = getCredentials();

  return cfFetch<{ id: string }>(
    `/zones/${zoneId}/custom_hostnames/${customHostnameId}`,
    { method: 'DELETE' }
  );
}

/**
 * List all custom hostnames in our zone (for debugging / admin views).
 *
 * @param page - pagination, default 1
 * @param perPage - default 20, max 50
 */
export async function listCustomHostnames(
  page = 1,
  perPage = 20
): Promise<CFCustomHostname[]> {
  const { zoneId } = getCredentials();

  return cfFetch<CFCustomHostname[]>(
    `/zones/${zoneId}/custom_hostnames?page=${page}&per_page=${perPage}`,
    { method: 'GET' }
  );
}