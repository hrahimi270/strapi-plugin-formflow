import type { Core } from '@strapi/strapi';
import { createHash } from 'node:crypto';

import { version as PLUGIN_VERSION } from '../../../package.json';

/**
 * Anonymous, opt-out usage telemetry.
 *
 * Sends two event types to a FormFlow-owned Cloudflare Worker, which forwards
 * them to analytics (PostHog). The Worker URL is the ONLY endpoint the plugin
 * knows — the analytics credentials live as Worker secrets, so the backend can
 * be rotated or swapped without republishing the plugin.
 *
 * Privacy:
 * - No PII is ever sent. The `distinct_id` is a SHA-256 hash of the Strapi
 *   project UUID (a random value), so installs can be counted without exposing
 *   the raw project id.
 * - Telemetry is fully opt-out and mirrors Strapi's own opt-out exactly: if the
 *   host disabled Strapi telemetry (no `uuid`, `STRAPI_TELEMETRY_DISABLED`, or
 *   `strapi.telemetryDisabled` in package.json), this stays silent too. A
 *   dedicated `FORMFLOW_TELEMETRY_DISABLED` env var disables only this.
 * - Every send is fire-and-forget with a short timeout and never throws, so a
 *   slow or unreachable endpoint can never affect plugin boot or requests.
 */

/** FormFlow-owned ingestion Worker. Hardcoded by design (see module docs). */
const TELEMETRY_ENDPOINT = 'https://formflow-telemetry.lo-agency.workers.dev';

/** Abort a single ping attempt if the endpoint doesn't respond quickly. */
const REQUEST_TIMEOUT_MS = 3000;

/**
 * Retry transient send failures. The very first outbound request from a fresh
 * Node process (cold DNS/TLS/worker) can fail where the next succeeds, so a
 * couple of retries materially improve delivery of the one-shot install event.
 */
const MAX_SEND_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Minimum gap between boot-triggered heartbeats. Prevents dev restarts from
 * sending a heartbeat on every reload while still capturing active installs.
 */
const HEARTBEAT_THROTTLE_MS = 20 * 60 * 60 * 1000; // 20 hours

/** Plugin store keys (namespaced under the `formflow` plugin store). */
const STORE_INSTALLED_KEY = 'telemetry-installed-sent';
const STORE_LAST_HEARTBEAT_KEY = 'telemetry-last-heartbeat';

/** The two event names the ingestion Worker accepts. */
type TelemetryEvent = 'plugin_installed' | 'plugin_heartbeat';

/** Non-PII properties attached to every event. */
export interface TelemetryProperties {
  plugin_version: string;
  strapi_version: string;
  node_version: string;
  license_tier: string;
  forms_count: number;
}

export interface TelemetryService {
  /**
   * Called on bootstrap. Sends a one-time `plugin_installed` event (first boot
   * ever, persisted via the plugin store) and a throttled `plugin_heartbeat`.
   * Resolves immediately on opt-out and never throws.
   */
  init(): Promise<void>;
  /** Send a `plugin_heartbeat` now. Used by the daily cron. No-op on opt-out. */
  heartbeat(): Promise<void>;
  /** Whether telemetry is currently allowed to send. */
  isEnabled(): boolean;
}

/**
 * Matches Strapi's own telemetry `isTruthy` (core `metrics/is-truthy.ts`):
 * accepts `true`, `1`, and case-insensitive `'true'`/`'1'`. Kept in parity so a
 * value that disables Strapi telemetry disables ours identically.
 */
const isTruthy = (value: unknown): boolean =>
  value === true || value === 1 || ['true', '1'].includes(String(value).toLowerCase());

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const telemetryService = ({ strapi }: { strapi: Core.Strapi }): TelemetryService => {
  const store = () => strapi.store({ type: 'plugin', name: 'formflow' });

  /**
   * Mirror Strapi's own telemetry opt-out verbatim. From core
   * `services/metrics/index.ts`:
   *   isDisabled = !uuid
   *     || isTruthy(process.env.STRAPI_TELEMETRY_DISABLED)
   *     || isTruthy(config.get('packageJsonStrapi.telemetryDisabled'))
   * plus a FormFlow-specific switch. Anyone who disabled Strapi telemetry (no
   * uuid, env var, or `strapi.telemetryDisabled` in package.json) disables ours.
   */
  const isEnabled = (): boolean => {
    if (!strapi.config.get('uuid')) return false;
    if (isTruthy(process.env.FORMFLOW_TELEMETRY_DISABLED)) return false;
    if (isTruthy(process.env.STRAPI_TELEMETRY_DISABLED)) return false;
    if (isTruthy(strapi.config.get('packageJsonStrapi.telemetryDisabled'))) return false;
    return true;
  };

  /** SHA-256 of the project UUID — a stable, anonymous install identifier. */
  const distinctId = (): string =>
    createHash('sha256')
      .update(String(strapi.config.get('uuid') ?? ''))
      .digest('hex');

  const buildProperties = async (): Promise<TelemetryProperties> => {
    let licenseTier = 'free';
    try {
      licenseTier = strapi.plugin('formflow').service('license').tier();
    } catch {
      // License service unavailable (e.g. stripped MIT fork) — default to free.
    }

    let formsCount = 0;
    try {
      formsCount = await strapi.documents('plugin::formflow.form').count({});
    } catch {
      // Count is best-effort; never block a ping on it.
    }

    return {
      plugin_version: PLUGIN_VERSION,
      strapi_version: String(strapi.config.get('info.strapi') ?? 'unknown'),
      node_version: process.versions.node,
      license_tier: licenseTier,
      forms_count: formsCount,
    };
  };

  /**
   * POST a single event. Returns true only when the endpoint confirms receipt
   * (2xx). Never throws. Retries network errors a few times (handles the cold
   * first-request failure); does not retry an explicit non-2xx rejection.
   */
  const send = async (event: TelemetryEvent, properties: TelemetryProperties): Promise<boolean> => {
    const body = JSON.stringify({ event, distinct_id: distinctId(), properties });

    for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(TELEMETRY_ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          signal: controller.signal,
        });
        // Explicit rejection (e.g. malformed payload): retrying won't help.
        if (!res.ok) {
          strapi.log.debug(`[FormFlow] Telemetry ${event} rejected: ${res.status}`);
          return false;
        }
        return true;
      } catch (error) {
        strapi.log.debug(
          `[FormFlow] Telemetry ${event} attempt ${attempt}/${MAX_SEND_ATTEMPTS} failed (non-fatal): ${error}`
        );
      } finally {
        clearTimeout(timer);
      }
      if (attempt < MAX_SEND_ATTEMPTS) await delay(RETRY_DELAY_MS);
    }
    return false;
  };

  const heartbeat = async (): Promise<void> => {
    if (!isEnabled()) return;
    // Only record the timestamp on confirmed delivery, so a failed heartbeat is
    // retried on the next boot instead of being throttled away.
    if (await send('plugin_heartbeat', await buildProperties())) {
      try {
        await store().set({ key: STORE_LAST_HEARTBEAT_KEY, value: Date.now() });
      } catch {
        // Throttle bookkeeping is best-effort.
      }
    }
  };

  const init = async (): Promise<void> => {
    if (!isEnabled()) {
      strapi.log.debug('[FormFlow] Telemetry disabled; skipping.');
      return;
    }

    const s = store();

    // One-time install event. The "sent" flag is persisted ONLY after confirmed
    // delivery, so a failed first attempt is retried on a later boot rather than
    // being lost forever.
    try {
      const alreadySent = await s.get({ key: STORE_INSTALLED_KEY });
      if (!alreadySent && (await send('plugin_installed', await buildProperties()))) {
        await s.set({ key: STORE_INSTALLED_KEY, value: true });
      }
    } catch (error) {
      strapi.log.debug(`[FormFlow] Telemetry install event failed (non-fatal): ${error}`);
    }

    // Throttled boot heartbeat so short-lived/dev restarts don't spam.
    try {
      const last = Number(await s.get({ key: STORE_LAST_HEARTBEAT_KEY })) || 0;
      if (Date.now() - last > HEARTBEAT_THROTTLE_MS) {
        await heartbeat();
      }
    } catch (error) {
      strapi.log.debug(`[FormFlow] Telemetry boot heartbeat failed (non-fatal): ${error}`);
    }
  };

  return { init, heartbeat, isEnabled };
};

export default telemetryService;
