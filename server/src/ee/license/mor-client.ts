/* SPDX-License-Identifier: LicenseRef-StrapiForms-EE — Commercial. See LICENSE-EE. Not covered by MIT. */

import type { Tier } from '../feature-map';

/**
 * Merchant-of-Record (MoR) provider abstraction. Lemon Squeezy is the primary
 * provider; Polar is a drop-in fallback that exposes the same license
 * activate/validate/deactivate endpoints. This file is the SOLE place where the
 * provider switch and the HTTP details live — the license service is provider
 * agnostic.
 */
export type MorProvider = 'lemonsqueezy' | 'polar';

export const DEFAULT_PROVIDER: MorProvider = 'lemonsqueezy';

/**
 * Resolve a raw value to a known MoR provider, falling back to the default for
 * unset/unknown values. The single source of truth for what counts as a valid
 * provider — config/service validation can delegate here.
 */
export function resolveProvider(value: string | null | undefined): MorProvider {
  return value === 'polar' || value === 'lemonsqueezy' ? value : DEFAULT_PROVIDER;
}

/** Abort the MoR request if the provider does not respond in time. */
const MOR_TIMEOUT_MS = 5000;

const ENDPOINTS: Record<MorProvider, string> = {
  lemonsqueezy: 'https://api.lemonsqueezy.com/v1/licenses',
  polar: 'https://api.polar.sh/v1/licenses',
};

/**
 * Resolve the Bearer credential for a provider from the environment. Each MoR
 * authenticates with its own API token; this is the only place that knowledge
 * lives so swapping providers is one env var.
 *
 * The license endpoints (activate/validate/deactivate) are designed to be called
 * from a customer's app with only their license key — they do NOT require the
 * seller's store API key (verified empirically against Lemon Squeezy). So the
 * token is optional: when unset we omit the Authorization header entirely rather
 * than sending an empty `Bearer ` that some providers reject. The token is the
 * SELLER's secret and end users must never need it.
 */
function authToken(provider: MorProvider): string {
  switch (provider) {
    case 'polar':
      return process.env.POLAR_ACCESS_TOKEN ?? process.env.POLAR_API_KEY ?? '';
    case 'lemonsqueezy':
    default:
      return process.env.LEMON_SQUEEZY_API_KEY ?? '';
  }
}

export interface MorActivateParams {
  licenseKey: string;
  instanceName: string;
  provider?: MorProvider;
}

export interface MorActivateResult {
  instanceId: string;
  tier: Tier;
  validUntil: Date | null;
}

export interface MorValidateParams {
  licenseKey: string;
  instanceId?: string;
  provider?: MorProvider;
}

export interface MorValidateResult {
  valid: boolean;
  tier: Tier;
  validUntil: Date | null;
  status: string;
}

export interface MorDeactivateParams {
  licenseKey: string;
  instanceId: string;
  provider?: MorProvider;
}

/**
 * Map a provider variant name/id to a plugin tier. Never trust a client-supplied
 * tier — the tier is derived purely from the purchased variant string returned
 * by the MoR. `business` wins over `pro` when both substrings are present.
 */
function mapTier(variant: string | null | undefined): Tier {
  const v = (variant ?? '').toLowerCase();
  if (v.includes('business')) return 'business';
  if (v.includes('pro')) return 'pro';
  return 'free';
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * POST JSON to a MoR endpoint with a hard abort timeout. Returns the parsed JSON
 * body or `null` on any failure (network, abort, non-2xx, parse). Never throws.
 */
async function morFetch(
  provider: MorProvider,
  url: string,
  body: Record<string, unknown>
): Promise<any | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MOR_TIMEOUT_MS);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  // Only attach the seller token when one is configured — license endpoints work
  // for customers who supply only their license key (see authToken docblock).
  const token = authToken(provider);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[FormFlow License] MoR request to ${url} returned HTTP ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[FormFlow License] MoR request to ${url} failed:`, error);
    return null;
  }
}

/**
 * Activate a license key against the MoR, binding it to an instance name. Returns
 * the new instance id and resolved tier, or `null` on any failure.
 */
export async function activate(params: MorActivateParams): Promise<MorActivateResult | null> {
  const provider = params.provider ?? DEFAULT_PROVIDER;
  const base = ENDPOINTS[provider];

  const json = await morFetch(provider, `${base}/activate`, {
    license_key: params.licenseKey,
    instance_name: params.instanceName,
  });

  if (!json || json.activated !== true || !json.instance?.id) {
    return null;
  }

  return {
    instanceId: String(json.instance.id),
    tier: mapTier(json.meta?.variant_name),
    validUntil: parseDate(json.license_key?.expires_at),
  };
}

/**
 * Validate a license key (optionally against a known instance id). Never throws:
 * any network/parse/non-2xx failure resolves to a typed failure result with
 * `status: 'error'` so the caller can distinguish connectivity loss from an
 * explicit revocation (`valid: false`).
 */
export async function validate(params: MorValidateParams): Promise<MorValidateResult> {
  const provider = params.provider ?? DEFAULT_PROVIDER;
  const base = ENDPOINTS[provider];

  const body: Record<string, unknown> = { license_key: params.licenseKey };
  if (params.instanceId) {
    body.instance_id = params.instanceId;
  }

  const json = await morFetch(provider, `${base}/validate`, body);

  if (!json) {
    return { valid: false, tier: 'free', validUntil: null, status: 'error' };
  }

  const status = String(json.license_key?.status ?? 'unknown');
  const valid = json.valid === true && status === 'active';

  return {
    valid,
    tier: mapTier(json.meta?.variant_name),
    validUntil: parseDate(json.license_key?.expires_at),
    status,
  };
}

/**
 * Deactivate a license instance. Fire-and-forget: errors are logged, never
 * thrown, and there is no meaningful result for the caller to act on.
 */
export async function deactivate(params: MorDeactivateParams): Promise<void> {
  const provider = params.provider ?? DEFAULT_PROVIDER;
  const base = ENDPOINTS[provider];

  await morFetch(provider, `${base}/deactivate`, {
    license_key: params.licenseKey,
    instance_id: params.instanceId,
  });
}
