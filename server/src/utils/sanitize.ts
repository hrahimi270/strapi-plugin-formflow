/**
 * Sanitization utilities for form submission data.
 *
 * IMPORTANT - ESCAPE-ON-OUTPUT MODEL:
 * This plugin stores RAW (but cleaned) user input. Values are trimmed and
 * stripped of null bytes / control characters, then coerced to their expected
 * type. They are NOT HTML-entity-escaped on the way in.
 *
 * Escaping is the responsibility of each OUTPUT boundary:
 *   - Email HTML rendering must call `escapeHtml` on every interpolated value.
 *   - CSV export must escape via its own CSV-escaping routine.
 *   - Any admin UI rendering must rely on React's automatic escaping.
 *
 * `escapeHtml` lives here (rather than only in the validation service) so those
 * output boundaries can import it directly without depending on the validation
 * service instance.
 */

/**
 * Escape HTML entities to prevent XSS when interpolating a value into HTML.
 *
 * Use this at OUTPUT boundaries (e.g. building email HTML). Stored values are
 * intentionally left un-escaped under the escape-on-output model.
 *
 * @param str - String to escape
 * @returns HTML-escaped string
 */
export const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * Strip null bytes and ASCII control characters (except common whitespace:
 * tab \t, newline \n, carriage return \r) from a string. This removes bytes
 * that could corrupt storage or downstream parsers without altering legitimate
 * textual content.
 *
 * @param str - String to clean
 * @returns String with control characters removed
 */
export const stripControlChars = (str: string): string =>
  // eslint-disable-next-line no-control-regex
  str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

/**
 * Clean a string value for raw storage: strip control characters then trim
 * surrounding whitespace. Does NOT HTML-escape (escape-on-output model).
 *
 * @param value - Value to clean (coerced to string if not already)
 * @returns Cleaned string
 */
export const cleanString = (value: unknown): string =>
  stripControlChars(typeof value === 'string' ? value : String(value)).trim();

/**
 * Coerce a value to a number. Returns 0 for values that are not finite numbers,
 * preserving the prior behaviour of the sanitizer.
 *
 * @param value - Value to coerce
 * @returns Numeric value, or 0 when not parseable
 */
export const coerceNumber = (value: unknown): number => {
  const numValue = Number(value);
  return Number.isNaN(numValue) ? 0 : numValue;
};

/**
 * Coerce a value to a boolean, accepting the common string/number truthy and
 * falsy representations used by HTML form inputs.
 *
 * @param value - Value to coerce
 * @returns Boolean value
 */
export const coerceBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1) return true;
  if (value === 'false' || value === 0) return false;
  return Boolean(value);
};
