/* SPDX-License-Identifier: LicenseRef-StrapiForms-EE — Commercial. See LICENSE-EE. Not covered by MIT. */

/**
 * Phase-0 regression test: submissions persist with STRAPI_FORMS_LICENSE_KEY unset.
 *
 * Run via: npm run test:unit
 *
 * This is a plain async script using Node's built-in assert module only.
 * It throws on failure and exits cleanly on success.
 */

import assert from 'node:assert/strict';
import licenseService from '../../../services/license';
import { FEATURE_TIER } from '../../feature-map';
import submissionService from '../../../services/submission';

(async () => {

// ── 1. License wrapper in free state ─────────────────────────────────────────

// Construct the wrapper without calling init() so no EE module is loaded and
// no network call is attempted. The EE dynamic import will fail to find a
// module (or resolve null) — either way the wrapper degrades to 'free'.
//
// We pass a minimal strapi stub; the license wrapper only needs the strapi
// reference passed through to the EE factory (which we never reach here).
const fakeStrapi = {} as any;

const license = licenseService({ strapi: fakeStrapi });

assert.strictEqual(license.state(), 'free', 'state() must return "free" when no key is set');

// ── 2. can() returns false for every feature ──────────────────────────────────

for (const feature of Object.keys(FEATURE_TIER) as Array<keyof typeof FEATURE_TIER>) {
  assert.strictEqual(
    license.can(feature),
    false,
    `can('${feature}') must return false in free state`
  );
}

// ── 3. Submission persists end-to-end even when can() is always false ─────────

const createdRows: unknown[] = [];

const mockStrapi: any = {
  plugin(name: string) {
    if (name === 'formflow') {
      return {
        service(serviceName: string) {
          if (serviceName === 'form') {
            return {
              async findBySlug(_slug: string) {
                return {
                  documentId: 'form-doc-1',
                  isActive: true,
                  title: 'Test Form',
                  slug: 'test',
                  fields: [
                    {
                      name: 'email',
                      label: 'Email',
                      type: 'email',
                      required: false,
                    },
                  ],
                  settings: {},
                  successMessage: 'Thanks',
                  updatedAt: new Date().toISOString(),
                };
              },
              async incrementSubmissionCount(_documentId: string) {
                // no-op
              },
            };
          }
          if (serviceName === 'validation') {
            return {
              validate(_fields: unknown, _data: unknown) {
                return { errors: {} };
              },
              validateFiles(_fields: unknown, _files: unknown, _data: unknown) {
                return { errors: {} };
              },
              sanitize(_fields: unknown, data: unknown) {
                return data;
              },
            };
          }
          if (serviceName === 'email') {
            return {
              async sendSubmissionNotification() {
                // no-op
              },
            };
          }
          if (serviceName === 'license') {
            return {
              can(_feature: string) {
                return false;
              },
            };
          }
          if (serviceName === 'analytics') {
            return {
              recordEvent(_formId: string, _event: string, _stepId?: string) {
                // no-op
              },
            };
          }
          throw new Error(`Unknown service: ${serviceName}`);
        },
      };
    }
    if (name === 'upload') {
      // submit() -> processFileUploads() resolves the core upload plugin's
      // `upload` service up front, before the file-field loop. This form has no
      // file fields, so `upload()` is never invoked; the lookup just needs to
      // resolve without throwing.
      return {
        service(serviceName: string) {
          if (serviceName === 'upload') {
            return {
              async upload(_args: unknown) {
                return [];
              },
            };
          }
          throw new Error(`Unknown service: ${serviceName}`);
        },
      };
    }
    throw new Error(`Unknown plugin: ${name}`);
  },
  documents(uid: string) {
    if (uid === 'plugin::formflow.form-submission') {
      return {
        async create(args: unknown) {
          createdRows.push(args);
          return {
            documentId: 'sub-doc-1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        },
      };
    }
    throw new Error(`Unknown content type UID: ${uid}`);
  },
  config: {
    get(_key: string, defaultVal: unknown) {
      return defaultVal ?? {};
    },
  },
  log: {
    error(..._args: unknown[]) {
      // no-op
    },
  },
};

const service = submissionService({ strapi: mockStrapi });

await service.submit(
  'test',
  { email: 'a@b.com' },
  { ipAddress: '1.2.3.4', submittedAt: new Date().toISOString() }
);

assert.strictEqual(createdRows.length, 1, 'A submission row must be created even in free state');

// ── 4. triggerPostSubmissionHooks with email notification does not throw ───────

const formWithNotification: any = {
  documentId: 'form-doc-1',
  isActive: true,
  title: 'Test Form',
  slug: 'test',
  fields: [{ name: 'email', label: 'Email', type: 'email', required: false }],
  settings: {
    emailNotifications: [
      {
        enabled: true,
        to: ['admin@example.com'],
      },
    ],
  },
  successMessage: 'Thanks',
  updatedAt: new Date().toISOString(),
};

const fakeSubmission: any = {
  documentId: 'sub-doc-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ipAddress: '1.2.3.4',
  status: 'new',
};

await service.triggerPostSubmissionHooks(formWithNotification, fakeSubmission, {
  email: 'a@b.com',
});

// If we reach here without throwing, assertion #4 passes.
  console.log('All assertions passed: submissions persist with no license key.');
})();
