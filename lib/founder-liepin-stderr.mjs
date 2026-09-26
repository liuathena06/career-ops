const MAX_ERROR_TEXT = 1_500;

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Preserve a useful CLI error while removing credentials and authorization data. */
export function sanitizeLiepinCliStderr(stderr, { token } = {}) {
  if (typeof stderr !== 'string') return '';
  let message = stderr.trim();
  if (/\b401\b|unauthorized|credential[^\n]*(?:expired|invalid)/iu.test(message)) return 'Liepin credential error (401)';
  if (!message) return '';
  if (typeof token === 'string' && token) message = message.replace(new RegExp(escaped(token), 'g'), '[REDACTED]');
  message = message
    .replace(/(authorization\s*[:=]\s*)(?:bearer\s+)?[^\s,;}'"]+/giu, '$1[REDACTED]')
    .replace(/(bearer\s+)[^\s,;}'"]+/giu, '$1[REDACTED]')
    .replace(/((?:x-user-token|liepin_user_token|token)\s*[:=]\s*)[^\s,;}'"]+/giu, '$1[REDACTED]')
    .replace(/("(?:x-user-token|liepin_user_token|token)"\s*:\s*")[^"]*(")/giu, '$1[REDACTED]$2');
  return message.slice(0, MAX_ERROR_TEXT);
}
