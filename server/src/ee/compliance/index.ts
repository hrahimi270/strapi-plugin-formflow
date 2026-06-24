/* SPDX-License-Identifier: LicenseRef-StrapiForms-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import type { Core } from '@strapi/strapi';

/**
 * Content type UID for form submissions.
 */
const SUBMISSION_CONTENT_TYPE_UID = 'plugin::formflow.form-submission';

/**
 * Mask an IP address for storage when IP anonymization is enabled.
 *
 * - IPv4 (e.g. `192.168.1.42`): the final octet is zeroed -> `192.168.1.0`.
 * - IPv6 (e.g. `2001:db8:85a3::8a2e:370:7334`): truncated to the /64 prefix
 *   (first four hextets), with the host bits zeroed -> `2001:db8:85a3:0::`.
 *
 * Anything that does not look like a recognizable IPv4/IPv6 address is returned
 * unchanged (callers only invoke this when anonymization is enabled, and an
 * unparseable value is better passed through than silently dropped).
 *
 * @param ip - Raw IP address string
 * @returns The anonymized IP address string
 */
export const anonymizeIpAddress = (ip: string): string => {
  if (!ip || typeof ip !== 'string') {
    return ip;
  }

  // IPv4-mapped IPv6 (e.g. ::ffff:192.168.1.42): anonymize the embedded IPv4.
  const mappedMatch = ip.match(/^(::ffff:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (mappedMatch) {
    return `${mappedMatch[1]}${anonymizeIpAddress(mappedMatch[2])}`;
  }

  // IPv4: zero the last octet.
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    const octets = ip.split('.');
    octets[3] = '0';
    return octets.join('.');
  }

  // IPv6: keep the /64 prefix (first four hextets), zero the host portion.
  if (ip.includes(':')) {
    // Expand any `::` so we can reliably take the first four hextets.
    const hasDoubleColon = ip.includes('::');
    let hextets = ip.split(':');

    if (hasDoubleColon) {
      const [head, tail] = ip.split('::');
      const headParts = head ? head.split(':') : [];
      const tailParts = tail ? tail.split(':') : [];
      const missing = 8 - headParts.length - tailParts.length;
      if (missing < 0) {
        // Malformed: leave untouched rather than corrupt it.
        return ip;
      }
      hextets = [...headParts, ...Array(missing).fill('0'), ...tailParts];
    }

    if (hextets.length < 4) {
      return ip;
    }

    const prefix = hextets.slice(0, 4).map((h) => h || '0');
    // `prefix::` denotes the /64 network with all host bits zeroed.
    return `${prefix.join(':')}::`;
  }

  return ip;
};

/**
 * Delete every submission older than `days` days (data-retention purge).
 *
 * Used by the daily retention cron job registered in bootstrap when the plugin
 * config `dataRetentionDays` is greater than 0. Submissions whose `createdAt`
 * predates `now - days` are removed in batches to avoid a single huge query
 * that could exhaust the DB connection pool. Deleting through the low-level
 * `strapi.db.query` (rather than the document service per-record) keeps the
 * purge efficient for large tables.
 *
 * A non-positive `days` is treated as a no-op (retention disabled) and returns
 * 0 without touching the database, so this is always safe to call.
 *
 * @param strapi - Strapi instance used for the DB query
 * @param days - Retention window in days; submissions older than this are purged
 * @returns The number of submissions deleted
 */
export const deleteOlderThan = async (strapi: Core.Strapi, days: number): Promise<number> => {
  if (typeof days !== 'number' || !Number.isFinite(days) || days <= 0) {
    return 0;
  }

  const BATCH_SIZE = 1000;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let totalDeleted = 0;
  let deleted: number;

  do {
    // Fetch up to BATCH_SIZE expired ids first, then delete them by id.
    const expired = (await strapi.db.query(SUBMISSION_CONTENT_TYPE_UID).findMany({
      select: ['id'],
      where: { created_at: { $lt: cutoff } },
      limit: BATCH_SIZE,
    })) as Array<{ id: number | string }>;

    const ids = expired.map((row) => row.id);
    deleted = ids.length;

    if (deleted > 0) {
      await strapi.db.query(SUBMISSION_CONTENT_TYPE_UID).deleteMany({
        where: { id: { $in: ids } },
      });
      totalDeleted += deleted;
    }

    // A full batch likely means more rows remain; a short batch means done.
  } while (deleted >= BATCH_SIZE);

  if (totalDeleted > 0) {
    strapi.log.info(
      `[FormFlow] Data retention: deleted ${totalDeleted} submission(s) older than ${days} day(s).`
    );
  }

  return totalDeleted;
};

/**
 * Result of a per-subject data export (GDPR right of access). `consents` is read
 * from each submission's `metadata.consents` array — there is no dedicated
 * `consents` column — and is `null` when the submission carries no consent record.
 */
export interface SubjectExportResult {
  submissions: Array<{
    documentId: string;
    createdAt: string;
    data: Record<string, unknown>;
    consents: unknown;
  }>;
  totalCount: number;
}

/**
 * Find every submission whose `data` JSON contains the given email anywhere
 * (GDPR right of access). Strapi has no JSON-key-agnostic operator, so we read
 * the submissions and match the email against the stringified `data` values in
 * JS — robust across DB backends (Postgres JSONB, SQLite/MySQL JSON-as-text).
 *
 * @param strapi - Strapi instance used for the DB query
 * @param email - The subject's email address to search for
 * @returns Matching submissions with their data, documentId, createdAt and consents
 */
export const findByEmail = async (
  strapi: Core.Strapi,
  email: string
): Promise<SubjectExportResult> => {
  const needle = (email ?? '').trim().toLowerCase();
  if (!needle) {
    return { submissions: [], totalCount: 0 };
  }

  const rows = (await strapi.db.query(SUBMISSION_CONTENT_TYPE_UID).findMany({
    select: ['documentId', 'createdAt', 'data', 'metadata'],
    orderBy: { createdAt: 'desc' },
  })) as Array<{
    documentId: string;
    createdAt: string;
    data: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  }>;

  const matched = rows.filter((row) => {
    const values = Object.values(row.data ?? {});
    return values.some(
      (value) => typeof value === 'string' && value.trim().toLowerCase() === needle
    );
  });

  const submissions = matched.map((row) => ({
    documentId: row.documentId,
    createdAt: row.createdAt,
    data: row.data ?? {},
    consents: row.metadata?.consents ?? null,
  }));

  return { submissions, totalCount: submissions.length };
};

/**
 * Delete every submission associated with the given email (GDPR right to
 * erasure). Looks the subject up via {@link findByEmail}, then deletes each
 * matching submission through the document service.
 *
 * @param strapi - Strapi instance
 * @param email - The subject's email address
 * @returns The number of submissions deleted
 */
export const deleteBySubject = async (
  strapi: Core.Strapi,
  email: string
): Promise<{ deleted: number }> => {
  const { submissions } = await findByEmail(strapi, email);

  let deleted = 0;
  for (const submission of submissions) {
    await strapi.documents(SUBMISSION_CONTENT_TYPE_UID).delete({
      documentId: submission.documentId,
    });
    deleted += 1;
  }

  return { deleted };
};

/**
 * Plugin store key holding the compliance audit log.
 */
const AUDIT_LOG_STORE_KEY = 'audit-log';

/**
 * Maximum number of audit entries kept in the store. Oldest entries are dropped
 * once the cap is exceeded.
 */
const AUDIT_LOG_MAX_ENTRIES = 1000;

/**
 * A single compliance audit log entry. Recorded for subject export/delete and
 * individual/bulk submission deletes — the four privacy-relevant destructive or
 * access operations. Not a general-purpose event log.
 */
export interface AuditEntry {
  action: 'subject.export' | 'subject.delete' | 'submission.delete' | 'submission.bulkDelete';
  /** Admin user email or 'system'. */
  actor: string;
  /** Email for subject ops; documentId for submission ops. */
  target: string;
  /** Number of affected records, for bulk operations. */
  count?: number;
  /** ISO timestamp. */
  timestamp: string;
}

/**
 * Append an entry to the compliance audit log (capped at the most recent
 * {@link AUDIT_LOG_MAX_ENTRIES}). Called fire-and-forget from controllers, so it
 * never throws: any failure is logged and swallowed.
 *
 * @param strapi - Strapi instance
 * @param entry - The audit entry to record
 */
export const appendAuditEntry = async (strapi: Core.Strapi, entry: AuditEntry): Promise<void> => {
  try {
    const store = strapi.store({ type: 'plugin', name: 'formflow' });
    const existing = ((await store.get({ key: AUDIT_LOG_STORE_KEY })) as AuditEntry[] | null) ?? [];

    const next = [...existing, entry];
    // Keep only the most recent entries, dropping the oldest on overflow.
    const capped = next.slice(Math.max(0, next.length - AUDIT_LOG_MAX_ENTRIES));

    await store.set({ key: AUDIT_LOG_STORE_KEY, value: capped });
  } catch (error) {
    strapi.log.error('[FormFlow] Failed to append audit log entry:', error);
  }
};

/**
 * Read the compliance audit log, most-recent first. Returns `[]` when the store
 * is empty or unavailable.
 *
 * @param strapi - Strapi instance
 * @returns The audit entries, most recent first
 */
export const getAuditLog = async (strapi: Core.Strapi): Promise<AuditEntry[]> => {
  try {
    const store = strapi.store({ type: 'plugin', name: 'formflow' });
    const entries = ((await store.get({ key: AUDIT_LOG_STORE_KEY })) as AuditEntry[] | null) ?? [];
    // Stored oldest-first; return most-recent-first for display.
    return [...entries].reverse();
  } catch (error) {
    strapi.log.error('[FormFlow] Failed to read audit log:', error);
    return [];
  }
};
