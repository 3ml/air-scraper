/**
 * Redaction of sensitive task input fields.
 *
 * Task `inputData` is stored in the DB in cleartext (the worker needs the real
 * credentials to run the scrape), but it must NEVER be returned in an API
 * response, callback payload, or log line. Returning credentials of any kind is
 * an antipattern. Always pass raw `inputData` through `redactInputData()` before
 * it crosses an output boundary.
 */

// Sensitive input field names, matched case-insensitively. Any matching key
// (and its whole value) is dropped from the output copy.
const SENSITIVE_KEYS = new Set([
  'credentials',
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'accesstoken',
  'username',
]);

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) continue; // drop entirely
      out[key] = redactValue(val);
    }
    return out;
  }
  return value;
}

/**
 * Returns a deep copy of task `inputData` with all sensitive fields
 * (credentials, passwords, tokens, usernames) removed. Non-sensitive fields
 * (e.g. `vikeyId`, `url`) are preserved.
 */
export function redactInputData(input: Record<string, unknown>): Record<string, unknown> {
  return redactValue(input) as Record<string, unknown>;
}
