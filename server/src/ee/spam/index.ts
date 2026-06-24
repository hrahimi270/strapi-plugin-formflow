/* SPDX-License-Identifier: LicenseRef-StrapiForms-EE — Commercial. See LICENSE-EE. Not covered by MIT. */

/**
 * Cloudflare Turnstile / hCaptcha siteverify endpoints. Both speak the same
 * `secret` + `response` URL-encoded POST contract as Google reCAPTCHA.
 */
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const HCAPTCHA_VERIFY_URL = 'https://hcaptcha.com/siteverify';

/**
 * Shape of the Turnstile / hCaptcha siteverify response. Only `success` is read.
 */
interface SiteverifyResponse {
  success: boolean;
}

/**
 * Verify a Cloudflare Turnstile token with the siteverify endpoint.
 *
 * Mirrors the reCAPTCHA fetch pattern in spam-check.ts: URL-encoded POST with
 * `secret` + `response`, caller-supplied AbortSignal for the ~5s timeout.
 * Fails closed — returns false on any network/timeout/parse error.
 */
export async function verifyTurnstile(
  token: string,
  secretKey: string,
  signal: AbortSignal
): Promise<boolean> {
  try {
    const params = new URLSearchParams();
    params.append('secret', secretKey);
    params.append('response', token);

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal,
    });

    if (!response.ok) {
      return false;
    }

    const result = (await response.json()) as SiteverifyResponse;
    return result.success === true;
  } catch {
    return false;
  }
}

/**
 * Verify an hCaptcha token with the siteverify endpoint. Same contract and
 * fail-closed behaviour as {@link verifyTurnstile}.
 */
export async function verifyHcaptcha(
  token: string,
  secretKey: string,
  signal: AbortSignal
): Promise<boolean> {
  try {
    const params = new URLSearchParams();
    params.append('secret', secretKey);
    params.append('response', token);

    const response = await fetch(HCAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal,
    });

    if (!response.ok) {
      return false;
    }

    const result = (await response.json()) as SiteverifyResponse;
    return result.success === true;
  } catch {
    return false;
  }
}

/**
 * IP/country blocklist configuration stored under `settings.spam.ipBlocklist`.
 */
export interface IpBlocklistConfig {
  /** Exact IPv4/IPv6 addresses to block. */
  ips?: string[];
  /**
   * ISO-3166-1 alpha-2 codes to block. Matched case-insensitively against the
   * country resolved from a request header (e.g. `cf-ipcountry`) — no GeoIP DB.
   */
  countryCodes?: string[];
}

/**
 * Returns true when the submitter IP or country is blocked.
 *
 * Matches `ip` against `blocklist.ips` (trim + lowercase). When a `country` is
 * resolved from a request header by the caller, it is matched case-insensitively
 * against `blocklist.countryCodes`. A blocked IP OR a blocked country triggers
 * the block. An absent/empty country simply skips the country match (fall
 * through), so a request with no country header is never blocked on that basis.
 */
export function evaluateIpBlocklist(
  ip: string,
  blocklist: IpBlocklistConfig,
  country?: string
): boolean {
  const normalizedIp = ip.trim().toLowerCase();
  if (normalizedIp) {
    const ips = blocklist.ips ?? [];
    if (ips.some((entry) => entry.trim().toLowerCase() === normalizedIp)) {
      return true;
    }
  }

  const normalizedCountry = (country ?? '').trim().toLowerCase();
  if (normalizedCountry) {
    const countryCodes = blocklist.countryCodes ?? [];
    if (countryCodes.some((entry) => entry.trim().toLowerCase() === normalizedCountry)) {
      return true;
    }
  }

  return false;
}
