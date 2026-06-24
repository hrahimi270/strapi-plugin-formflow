/* SPDX-License-Identifier: LicenseRef-StrapiForms-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import type { Core } from '@strapi/strapi';

/**
 * Pre-built integration configs. Each is a discriminated union member keyed by
 * `type`. All are stored verbatim in the form's `settings.integrations` JSON
 * blob (no server-side validation — see T25 out-of-scope).
 *
 * All interfaces below are EXPORTED so the generated `.d.ts` for this module
 * does not reference private names (CLAUDE.md TS4082 rule): they appear in the
 * `IntegrationConfig` union used in `dispatch`'s signature.
 */
export interface SlackIntegrationConfig {
  type: 'slack';
  enabled: boolean;
  webhookUrl: string;
  includeData?: boolean;
}

export interface GoogleSheetsIntegrationConfig {
  type: 'google_sheets';
  enabled: boolean;
  deploymentId: string;
  sheetId?: string;
}

export interface MailchimpIntegrationConfig {
  type: 'mailchimp';
  enabled: boolean;
  apiKey: string;
  serverPrefix: string;
  listId: string;
  emailField: string;
}

export interface HubSpotIntegrationConfig {
  type: 'hubspot';
  enabled: boolean;
  portalId: string;
  formGuid: string;
}

export interface NotionIntegrationConfig {
  type: 'notion';
  enabled: boolean;
  integrationToken: string;
  databaseId: string;
  /**
   * Optional form-field name whose submitted value becomes the created page's
   * title. When unset, the sender falls back to the first submitted field value
   * and finally to a synthesized "Submission <id>" label so the page always has
   * a non-empty title (Notion requires the title property to be populated).
   */
  titleField?: string;
}

export interface ZapierIntegrationConfig {
  type: 'zapier';
  enabled: boolean;
  webhookUrl: string;
}

export interface MakeIntegrationConfig {
  type: 'make';
  enabled: boolean;
  webhookUrl: string;
}

export type IntegrationConfig =
  | SlackIntegrationConfig
  | GoogleSheetsIntegrationConfig
  | MailchimpIntegrationConfig
  | HubSpotIntegrationConfig
  | NotionIntegrationConfig
  | ZapierIntegrationConfig
  | MakeIntegrationConfig;

/**
 * Form context passed to every sender.
 */
export interface IntegrationFormContext {
  documentId: string;
  title: string;
  slug: string;
}

/**
 * Submission context passed to every sender.
 */
export interface IntegrationSubmissionContext {
  documentId: string;
  status: string;
  createdAt: string;
}

/**
 * Public surface of the integrations service.
 */
export interface IntegrationsService {
  dispatch(
    integrations: IntegrationConfig[],
    event: 'submission.created',
    formContext: IntegrationFormContext,
    submissionContext: IntegrationSubmissionContext,
    data: Record<string, unknown>
  ): void;
}

/**
 * Per-request timeout for every integration HTTP call. Mirrors the
 * AbortController pattern used by spam-check.ts / the webhook engine so a hung
 * endpoint can never stall the (already-detached) dispatch.
 */
const INTEGRATION_TIMEOUT_MS = 10000;

/** Pinned Notion API version sent on every Notion request. */
const NOTION_VERSION = '2022-06-28';

/**
 * Resolve the title content for a Notion page: configured `titleField` →
 * first submitted field value → synthesized "Submission <id>". Always returns
 * a non-empty string so the created page's title property is never blank.
 */
export const resolveNotionTitle = (
  config: NotionIntegrationConfig,
  submission: IntegrationSubmissionContext,
  data: Record<string, unknown>
): string => {
  const stringify = (value: unknown): string => (value == null ? '' : String(value).trim());

  if (config.titleField) {
    const configured = stringify(data[config.titleField]);
    if (configured !== '') {
      return configured;
    }
  }

  for (const value of Object.values(data)) {
    const candidate = stringify(value);
    if (candidate !== '') {
      return candidate;
    }
  }

  return `Submission ${submission.documentId}`;
};

/**
 * Build the Notion property payload for a single submitted value according to
 * the database column's declared `type`. Returns `undefined` when the value
 * should be skipped (e.g. an empty select). Unknown/unsupported types fall back
 * to `rich_text` (the original safe behaviour).
 */
export const buildNotionProperty = (
  type: string | undefined,
  value: unknown
): Record<string, unknown> | undefined => {
  const asString = value == null ? '' : String(value);

  switch (type) {
    case 'rich_text':
      return { rich_text: [{ text: { content: asString } }] };

    case 'number': {
      if (value == null || asString.trim() === '') {
        return { number: null };
      }
      const parsed = Number(value);
      return { number: Number.isFinite(parsed) ? parsed : null };
    }

    case 'select': {
      const name = asString.trim();
      return name === '' ? undefined : { select: { name } };
    }

    case 'multi_select': {
      const names = (Array.isArray(value) ? value.map((v) => String(v)) : asString.split(','))
        .map((v) => v.trim())
        .filter((v) => v !== '');
      return { multi_select: names.map((name) => ({ name })) };
    }

    case 'date': {
      const iso = toIsoDate(value);
      return iso == null ? undefined : { date: { start: iso } };
    }

    case 'checkbox':
      return { checkbox: toBoolean(value) };

    case 'email': {
      const email = asString.trim();
      return email === '' ? undefined : { email };
    }

    case 'phone_number': {
      const phone = asString.trim();
      return phone === '' ? undefined : { phone_number: phone };
    }

    case 'url': {
      const url = asString.trim();
      return url === '' ? undefined : { url };
    }

    default:
      // Unknown/unsupported column type → rich_text fallback.
      return { rich_text: [{ text: { content: asString } }] };
  }
};

/** Parse a submitted value into an ISO date string, or `null` if unparseable. */
const toIsoDate = (value: unknown): string | null => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Coerce a submitted value into a boolean for a Notion checkbox column. */
const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
};

/**
 * Pre-built integration dispatcher (Pro).
 *
 * `dispatch` is fire-and-forget: it inspects each ENABLED `IntegrationConfig`,
 * routes on `type`, and kicks off a single `fetch` per integration as a
 * floating promise. It never awaits a sender and never throws — every failure
 * is swallowed with a `strapi.log.warn`. This is a simpler, fixed-shape sibling
 * of the generic webhook engine; it deliberately has no retries, queue, or
 * persistence (see T25 out-of-scope).
 */
export const integrationsServiceFactory = (strapi: Core.Strapi): IntegrationsService => {
  /**
   * POST JSON to `url` with the shared timeout. Returns the response so a
   * sender can branch on `response.ok`; rejects on network error/timeout.
   */
  const postJson = async (
    url: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), INTEGRATION_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  /**
   * GET `url` with the shared timeout. Returns the response so a caller can
   * branch on `response.ok`; rejects on network error/timeout.
   */
  const getJson = async (url: string, headers?: Record<string, string>): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), INTEGRATION_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method: 'GET',
        headers: { ...headers },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  /**
   * Wrap a sender's promise so a rejection (or non-2xx, when the sender opts to
   * surface it) is logged and never escapes the floating dispatch.
   */
  const swallow = (type: string, promise: Promise<unknown>): void => {
    void promise.catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      strapi.log.warn(`[FormFlow Integrations] ${type} dispatch failed: ${message}`);
    });
  };

  // --- Senders (one per integration type) -------------------------------

  const sendSlack = async (
    config: SlackIntegrationConfig,
    form: IntegrationFormContext,
    submission: IntegrationSubmissionContext,
    data: Record<string, unknown>
  ): Promise<void> => {
    const text = `New submission for «${form.title}»: ${submission.documentId}`;
    const body: Record<string, unknown> = config.includeData
      ? {
          text,
          blocks: [
            { type: 'section', text: { type: 'mrkdwn', text } },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: `\`\`\`${JSON.stringify(data, null, 2)}\`\`\`` },
            },
          ],
        }
      : { text };
    await postJson(config.webhookUrl, body);
  };

  const sendGoogleSheets = async (
    config: GoogleSheetsIntegrationConfig,
    data: Record<string, unknown>
  ): Promise<void> => {
    const url = `https://script.google.com/macros/s/${config.deploymentId}/exec`;
    await postJson(url, { sheetId: config.sheetId, rowData: data });
  };

  const sendMailchimp = async (
    config: MailchimpIntegrationConfig,
    data: Record<string, unknown>
  ): Promise<void> => {
    const email = data[config.emailField];
    // Only subscribe when the configured email field carries a usable address.
    if (typeof email !== 'string' || email.trim() === '') {
      return;
    }
    const url = `https://${config.serverPrefix}.api.mailchimp.com/3.0/lists/${config.listId}/members`;
    const auth = Buffer.from(`apikey:${config.apiKey}`).toString('base64');
    await postJson(
      url,
      {
        email_address: email,
        status: 'subscribed',
        merge_fields: {},
      },
      { Authorization: `Basic ${auth}` }
    );
  };

  const sendHubSpot = async (
    config: HubSpotIntegrationConfig,
    data: Record<string, unknown>
  ): Promise<void> => {
    const url = `https://api.hsforms.com/submissions/v3/integration/submit/${config.portalId}/${config.formGuid}`;
    const fields = Object.entries(data).map(([name, value]) => ({
      name,
      value: value == null ? '' : String(value),
    }));
    await postJson(url, { fields });
  };

  const sendNotion = async (
    config: NotionIntegrationConfig,
    submission: IntegrationSubmissionContext,
    data: Record<string, unknown>
  ): Promise<void> => {
    const notionHeaders = {
      Authorization: `Bearer ${config.integrationToken}`,
      'Notion-Version': NOTION_VERSION,
    };

    // Fetch the target database schema so each value is mapped to its declared
    // column type and the required title property can be located. A single
    // per-dispatch GET is acceptable (see task out-of-scope: no schema cache).
    const schemaResponse = await getJson(
      `https://api.notion.com/v1/databases/${config.databaseId}`,
      notionHeaders
    );
    if (!schemaResponse.ok) {
      const detail = await schemaResponse.text().catch(() => '');
      strapi.log.warn(
        `[FormFlow Integrations] notion: failed to fetch schema for database "${config.databaseId}" ` +
          `(HTTP ${schemaResponse.status})${detail ? `: ${detail}` : ''}. No page created.`
      );
      return;
    }

    const schema = (await schemaResponse.json()) as {
      properties?: Record<string, { type?: string }>;
    };
    const dbProperties = schema.properties ?? {};

    // Locate the database's title property (every Notion DB has exactly one).
    const titlePropertyName = Object.keys(dbProperties).find(
      (name) => dbProperties[name]?.type === 'title'
    );
    if (!titlePropertyName) {
      strapi.log.warn(
        `[FormFlow Integrations] notion: database "${config.databaseId}" has no title property; ` +
          `cannot create a page. No page created.`
      );
      return;
    }

    // Resolve the page title: configured field → first submitted value →
    // synthesized label. The page must always carry a non-empty title.
    const titleContent = resolveNotionTitle(config, submission, data);

    const properties: Record<string, unknown> = {
      [titlePropertyName]: { title: [{ text: { content: titleContent } }] },
    };

    // Map each submitted field that matches a database column to its declared
    // Notion type. The title column is handled above; never also write it as
    // rich_text. Fields with no matching column are skipped.
    for (const [name, value] of Object.entries(data)) {
      if (name === titlePropertyName) {
        continue;
      }
      const property = dbProperties[name];
      if (!property) {
        continue;
      }
      const payload = buildNotionProperty(property.type, value);
      if (payload !== undefined) {
        properties[name] = payload;
      }
    }

    const response = await postJson(
      'https://api.notion.com/v1/pages',
      { parent: { database_id: config.databaseId }, properties },
      notionHeaders
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`pages.create returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }
  };

  const sendGenericWebhook = async (
    webhookUrl: string,
    form: IntegrationFormContext,
    submission: IntegrationSubmissionContext,
    data: Record<string, unknown>
  ): Promise<void> => {
    await postJson(webhookUrl, { form, submission, data });
  };

  return {
    dispatch(
      integrations: IntegrationConfig[],
      _event: 'submission.created',
      formContext: IntegrationFormContext,
      submissionContext: IntegrationSubmissionContext,
      data: Record<string, unknown>
    ): void {
      for (const config of integrations) {
        if (!config.enabled) {
          continue;
        }

        switch (config.type) {
          case 'slack':
            swallow('slack', sendSlack(config, formContext, submissionContext, data));
            break;
          case 'google_sheets':
            swallow('google_sheets', sendGoogleSheets(config, data));
            break;
          case 'mailchimp':
            swallow('mailchimp', sendMailchimp(config, data));
            break;
          case 'hubspot':
            swallow('hubspot', sendHubSpot(config, data));
            break;
          case 'notion':
            swallow('notion', sendNotion(config, submissionContext, data));
            break;
          case 'zapier':
            swallow(
              'zapier',
              sendGenericWebhook(config.webhookUrl, formContext, submissionContext, data)
            );
            break;
          case 'make':
            swallow(
              'make',
              sendGenericWebhook(config.webhookUrl, formContext, submissionContext, data)
            );
            break;
          default: {
            // Exhaustiveness guard: once all 7 union members are handled, `config`
            // narrows to `never` here, so adding a new `IntegrationConfig` member
            // without a case above is a compile-time error. At runtime an unknown
            // `type` (from a malformed config) is logged and skipped silently.
            const exhaustive: never = config;
            const unknownConfig = exhaustive as { type?: string };
            strapi.log.warn(
              `[FormFlow Integrations] Unknown integration type "${unknownConfig.type}"; skipped`
            );
          }
        }
      }
    },
  };
};

export default integrationsServiceFactory;
