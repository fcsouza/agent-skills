// What a pino transport looks like in source, and what counts as keeping it to development.

// pino.transport({...}) or a transport option with a worker target: pino({ transport: { target: ... } }).
const TRANSPORT = /pino\s*\.\s*transport\s*\(|transport\s*:\s*\{[^}]*\btargets?\s*:/s;

// The guard the rule allows: a transport only on the unbundled development path.
const DEV_GUARD = /isDevelopment\s*\(|NODE_ENV\s*[!=]==?\s*['"](development|production)['"]|import\.meta\.env\.DEV|Bun\.env\.NODE_ENV/;

/** The text an edit puts into a file. */
export function addedText(input: { content?: unknown; new_string?: unknown; edits?: unknown }): string {
  if (typeof input.content === 'string') return input.content;
  if (typeof input.new_string === 'string') return input.new_string;
  if (Array.isArray(input.edits)) {
    return input.edits
      .map(edit =>
        edit !== null && typeof edit === 'object' && typeof (edit as { new_string?: unknown }).new_string === 'string'
          ? (edit as { new_string: string }).new_string
          : '',
      )
      .join('\n');
  }
  return '';
}

/** True when the added text brings in a pino transport with no development-only guard beside it. */
export const addsUnguardedTransport = (text: string): boolean => TRANSPORT.test(text) && !DEV_GUARD.test(text);

/** True when a file already keeps something behind a development check. */
export const hasDevGuard = (text: string): boolean => DEV_GUARD.test(text);
