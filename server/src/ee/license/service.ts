/* SPDX-License-Identifier: LicenseRef-StrapiForms-EE — Commercial. See LICENSE-EE. Not covered by MIT. */

import type { Core } from '@strapi/strapi';

import { FEATURE_TIER, TIER_RANK, type FeatureKey, type Tier } from '../feature-map';
import * as morClient from './mor-client';

const PLUGIN_CONFIG_ID = 'plugin::formflow';
const STORE_PARAMS = { type: 'plugin', name: 'formflow' } as const;
const CACHE_KEY = 'license-cache';
const INSTANCE_ID_KEY = 'license-instance-id';
const DEFAULT_GRACE_DAYS = 14;
const DAY_MS = 86_400_000;

/** Plugin license configuration block read from `strapi.config`. */
interface LicenseConfig {
  license?: {
    key?: string;
    graceDays?: number;
    provider?: string;
  };
}

/**
 * Persisted validation cache. `graceUntil` is computed at the moment of a
 * *successful* validation (lastValidatedAt + graceDays) so that a process
 * restart during an outage does not reset the connectivity grace window.
 */
export interface LicenseCache {
  tier: Tier;
  status: string;
  validUntil: Date | null;
  lastValidatedAt: Date;
  graceUntil: Date;
}

export type LicenseState = 'active' | 'grace' | 'expired' | 'free';

export interface LicenseSnapshot {
  tier: Tier; // effective (collapsed to 'free' when expired)
  state: LicenseState;
  graceUntil: Date | null;
  features: Record<FeatureKey, boolean>;
}

export interface LicenseService {
  init(): Promise<void>;
  destroy(): void;
  refresh(): Promise<void>;
  tier(): Tier;
  state(): LicenseState;
  can(feature: FeatureKey): boolean;
  snapshot(): LicenseSnapshot;
}

/**
 * EE license validation engine. Holds the in-memory entitlement state, drives
 * the validate→cache→grace state machine against the MoR adapter, and persists
 * the cache so grace survives restarts. Every public method is non-throwing so
 * plugin load and request handling are never blocked by licensing.
 */
export function createLicenseService(strapi: Core.Strapi): LicenseService {
  let _cache: LicenseCache | null = null;
  let _state: LicenseState = 'free';
  let _tier: Tier = 'free';
  let _refreshTimer: ReturnType<typeof setInterval> | null = null;
  let _instanceId: string | null = null;

  function readConfig(): LicenseConfig {
    return strapi.config.get(PLUGIN_CONFIG_ID, {}) as LicenseConfig;
  }

  function readLicenseKey(): string {
    return readConfig().license?.key ?? '';
  }

  /**
   * Resolve the configured MoR provider (env-driven via config), defaulting to
   * Lemon Squeezy for unset/unknown values. Threaded into every MoR call so the
   * adapter targets the right provider's endpoint + credential.
   */
  function readProvider(): morClient.MorProvider {
    return morClient.resolveProvider(readConfig().license?.provider);
  }

  function store() {
    return strapi.store(STORE_PARAMS);
  }

  async function persistCache(cache: LicenseCache): Promise<void> {
    await store().set({
      key: CACHE_KEY,
      value: {
        tier: cache.tier,
        status: cache.status,
        validUntil: cache.validUntil ? cache.validUntil.toISOString() : null,
        lastValidatedAt: cache.lastValidatedAt.toISOString(),
        graceUntil: cache.graceUntil.toISOString(),
      },
    });
  }

  function can(feature: FeatureKey): boolean {
    return TIER_RANK[_tier] >= TIER_RANK[FEATURE_TIER[feature]];
  }

  async function refresh(): Promise<void> {
    try {
      const licenseKey = readLicenseKey();
      if (!licenseKey) {
        _tier = 'free';
        _state = 'free';
        return;
      }

      const result = await morClient.validate({
        licenseKey,
        instanceId: _instanceId ?? undefined,
        provider: readProvider(),
      });

      // Connectivity / parse failure: fall back to the cached entitlement for the
      // duration of the grace window. Never overwrite the stored cache here so the
      // grace window keeps counting from the last successful validation.
      if (result.status === 'error') {
        const now = new Date();
        if (_cache !== null) {
          if (now <= _cache.graceUntil) {
            _tier = _cache.tier;
            _state = 'grace';
            strapi.log.info(
              '[FormFlow License] Validation unreachable — serving cached entitlement within grace period.'
            );
          } else {
            _tier = 'free';
            _state = 'expired';
            strapi.log.warn(
              '[FormFlow License] Validation unreachable and grace period elapsed — entitlements expired.'
            );
          }
        } else {
          _tier = 'free';
          _state = 'free';
          strapi.log.warn(
            '[FormFlow License] Validation unreachable and no prior cache — running as free tier.'
          );
        }
        return;
      }

      // Explicit revocation/expiry (refunded/disabled/expired/inactive): hard-expire
      // immediately, bypassing the connectivity grace window entirely.
      if (!result.valid) {
        _tier = 'free';
        _state = 'expired';
        const now = new Date();
        _cache = {
          tier: 'free',
          status: result.status,
          validUntil: result.validUntil,
          lastValidatedAt: now,
          graceUntil: now,
        };
        await persistCache(_cache);
        strapi.log.warn(
          '[FormFlow License] Key is revoked/expired — hard-expiring immediately, no grace period.'
        );
        return;
      }

      // Successful validation: refresh the cache, compute a fresh grace window, and
      // mark the license active.
      const now = new Date();
      const graceDays = readConfig().license?.graceDays ?? DEFAULT_GRACE_DAYS;
      _cache = {
        tier: result.tier,
        status: result.status,
        validUntil: result.validUntil,
        lastValidatedAt: now,
        graceUntil: new Date(now.getTime() + graceDays * DAY_MS),
      };
      await persistCache(_cache);
      _tier = result.tier;
      _state = 'active';
    } catch (error) {
      strapi.log.warn('[FormFlow License] Unexpected error during refresh:', error);
    }
  }

  async function init(): Promise<void> {
    try {
      const licenseKey = readLicenseKey();
      if (!licenseKey) {
        _tier = 'free';
        _state = 'free';
        return;
      }

      // Rehydrate the persisted cache so grace state survives a restart.
      try {
        const raw = (await store().get({ key: CACHE_KEY })) as Record<string, any> | null;
        if (raw) {
          _cache = {
            tier: raw.tier,
            status: raw.status,
            validUntil: raw.validUntil ? new Date(raw.validUntil) : null,
            lastValidatedAt: new Date(raw.lastValidatedAt),
            graceUntil: new Date(raw.graceUntil),
          };
        }

        const instanceId = (await store().get({ key: INSTANCE_ID_KEY })) as string | null;
        if (instanceId) {
          _instanceId = instanceId;
        }
      } catch (error) {
        strapi.log.warn('[FormFlow License] Failed to load persisted cache:', error);
      }

      // Apply the last-known entitlement SYNCHRONOUSLY from the rehydrated cache so
      // boot-time gate reads (e.g. bootstrap's retention cron and scheduled-export
      // rehydration, which run after this awaited init) see the real tier without
      // waiting for the async refresh below. Mirrors refresh()'s state machine:
      // within the grace window we serve the cached tier; once it has elapsed we
      // grant nothing. The async refresh() still runs and corrects/hard-expires
      // shortly after — it remains the authority.
      if (_cache !== null) {
        const now = new Date();
        if (now <= _cache.graceUntil) {
          _tier = _cache.tier;
          // 'active' while the license's own validity still holds; otherwise we are
          // running on connectivity grace. A hard-expired cache has tier 'free' and
          // graceUntil === lastValidatedAt, so it falls into the elapsed branch below.
          _state =
            _cache.validUntil === null || now <= _cache.validUntil ? 'active' : 'grace';
        } else {
          _tier = 'free';
          _state = 'expired';
        }
      }

      // Fire-and-forget the first validation so plugin load is never blocked.
      refresh().catch((err) =>
        strapi.log.warn('[FormFlow License] Initial validation failed:', err)
      );

      // Re-validate daily to pick up revocations and tier changes.
      _refreshTimer = setInterval(() => {
        refresh().catch((err) =>
          strapi.log.warn('[FormFlow License] Scheduled validation failed:', err)
        );
      }, DAY_MS);
    } catch (error) {
      strapi.log.warn('[FormFlow License] init failed:', error);
    }
  }

  function destroy(): void {
    if (_refreshTimer !== null) {
      clearInterval(_refreshTimer);
      _refreshTimer = null;
    }
  }

  function snapshot(): LicenseSnapshot {
    return {
      tier: _tier,
      state: _state,
      graceUntil: _cache?.graceUntil ?? null,
      features: Object.fromEntries(
        (Object.keys(FEATURE_TIER) as FeatureKey[]).map((f) => [f, can(f)])
      ) as Record<FeatureKey, boolean>,
    };
  }

  return {
    init,
    destroy,
    refresh,
    tier: () => _tier,
    state: () => _state,
    can,
    snapshot,
  };
}
