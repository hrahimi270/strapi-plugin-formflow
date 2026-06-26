/**
 * Opt-out regression test for telemetry.
 *
 * Telemetry MUST stay silent whenever the host has opted out — no project
 * `uuid`, `STRAPI_TELEMETRY_DISABLED`, or `strapi.telemetryDisabled` in
 * package.json — or when the FormFlow-specific `FORMFLOW_TELEMETRY_DISABLED`
 * switch is set. It must also send the raw project UUID to nobody (only a hash)
 * and never re-send the one-time install event.
 *
 * Run via: npm run test:unit:telemetry
 *
 * Plain Node assert script (mirrors server/src/ee/license/__tests__): it throws
 * on failure and exits cleanly on success.
 */

import assert from 'node:assert/strict';
import telemetryService from '../telemetry';

interface FetchCall {
  url: string;
  body: { event: string; distinct_id: string; properties: Record<string, unknown> };
}

/** Replace global fetch with a spy that records each ping. */
function installFetchSpy(): FetchCall[] {
  const calls: FetchCall[] = [];
  (globalThis as { fetch: unknown }).fetch = async (_url: string, init?: { body?: string }) => {
    calls.push({ url: _url, body: init?.body ? JSON.parse(init.body) : undefined });
    return { ok: true, status: 202, async text() { return ''; } };
  };
  return calls;
}

/** Minimal strapi stub with an in-memory plugin store. */
function makeStrapi(configOverrides: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>();
  const config: Record<string, unknown> = {
    uuid: 'project-uuid-abc',
    'info.strapi': '5.4.0',
    ...configOverrides,
  };
  const strapi = {
    config: { get: (key: string) => config[key] },
    store: () => ({
      async get({ key }: { key: string }) {
        return store.has(key) ? store.get(key) : null;
      },
      async set({ key, value }: { key: string; value: unknown }) {
        store.set(key, value);
      },
    }),
    plugin: () => ({ service: () => ({ tier: () => 'free' }) }),
    documents: () => ({ count: async () => 3 }),
    log: { debug() {} },
  } as unknown as Parameters<typeof telemetryService>[0]['strapi'];
  return { strapi, store };
}

(async () => {
  const origFormflow = process.env.FORMFLOW_TELEMETRY_DISABLED;
  const origStrapi = process.env.STRAPI_TELEMETRY_DISABLED;
  delete process.env.FORMFLOW_TELEMETRY_DISABLED;
  delete process.env.STRAPI_TELEMETRY_DISABLED;

  // 1. Enabled by default (uuid present, no opt-out).
  {
    const { strapi } = makeStrapi();
    assert.strictEqual(
      telemetryService({ strapi }).isEnabled(),
      true,
      'enabled when uuid is set and nothing opts out'
    );
  }

  // 2. Disabled when the project uuid is absent (mirrors Strapi's own opt-out).
  {
    const { strapi } = makeStrapi({ uuid: undefined });
    assert.strictEqual(
      telemetryService({ strapi }).isEnabled(),
      false,
      'disabled when uuid is missing'
    );
  }

  // 3. Disabled by package.json `strapi.telemetryDisabled`.
  {
    const { strapi } = makeStrapi({ 'packageJsonStrapi.telemetryDisabled': true });
    assert.strictEqual(
      telemetryService({ strapi }).isEnabled(),
      false,
      'disabled by packageJsonStrapi.telemetryDisabled'
    );
  }

  // 4. Disabled by STRAPI_TELEMETRY_DISABLED.
  {
    process.env.STRAPI_TELEMETRY_DISABLED = 'true';
    const { strapi } = makeStrapi();
    assert.strictEqual(
      telemetryService({ strapi }).isEnabled(),
      false,
      'disabled by STRAPI_TELEMETRY_DISABLED'
    );
    delete process.env.STRAPI_TELEMETRY_DISABLED;
  }

  // 5. Disabled by FORMFLOW_TELEMETRY_DISABLED.
  {
    process.env.FORMFLOW_TELEMETRY_DISABLED = '1';
    const { strapi } = makeStrapi();
    assert.strictEqual(
      telemetryService({ strapi }).isEnabled(),
      false,
      'disabled by FORMFLOW_TELEMETRY_DISABLED'
    );
    delete process.env.FORMFLOW_TELEMETRY_DISABLED;
  }

  // 6. init() performs no network call when disabled.
  {
    const calls = installFetchSpy();
    const { strapi } = makeStrapi({ uuid: undefined });
    await telemetryService({ strapi }).init();
    assert.strictEqual(calls.length, 0, 'no network when disabled');
  }

  // 7. Fresh install sends install + heartbeat with an anonymized id.
  {
    const calls = installFetchSpy();
    const { strapi } = makeStrapi();
    await telemetryService({ strapi }).init();
    assert.strictEqual(calls.length, 2, 'fresh install sends install + heartbeat');
    assert.strictEqual(calls[0].body.event, 'plugin_installed', 'first event is plugin_installed');
    assert.strictEqual(calls[1].body.event, 'plugin_heartbeat', 'second event is plugin_heartbeat');
    assert.match(calls[0].body.distinct_id, /^[a-f0-9]{64}$/, 'distinct_id is a sha-256 hex');
    assert.notStrictEqual(
      calls[0].body.distinct_id,
      'project-uuid-abc',
      'the raw project uuid is never sent'
    );
    assert.strictEqual(calls[0].body.properties.forms_count, 3, 'forms_count is included');
  }

  // 8. A second boot is throttled/deduped — already installed + recent heartbeat.
  {
    const calls = installFetchSpy();
    const { strapi, store } = makeStrapi();
    store.set('telemetry-installed-sent', true);
    store.set('telemetry-last-heartbeat', Date.now());
    await telemetryService({ strapi }).init();
    assert.strictEqual(calls.length, 0, 'no resend when already installed and recently beat');
  }

  if (origFormflow !== undefined) process.env.FORMFLOW_TELEMETRY_DISABLED = origFormflow;
  if (origStrapi !== undefined) process.env.STRAPI_TELEMETRY_DISABLED = origStrapi;

  console.log('All telemetry opt-out assertions passed.');
})();
