// Which shell commands write to a database, and whether that database is local. Pure, so the tests call it directly.

export type Risk = { kind: 'sql-write' | 'sql-file' | 'migration'; label: string };

const PSQL = /(^|[\s/;&|(])psql(\s|$)/;
const WRITE_SQL =
  /\b(insert\s+into|update\s+\w|delete\s+from|drop\s+(table|schema|database|index|view|column|type)|truncate\b|alter\s+(table|schema|database|type)|create\s+(table|schema|database|index|unique|type)|grant\b|revoke\b)/i;
const SQL_FILE = /\s(-f|--file)(\s|=)|<\s*\S+\.sql\b|<<\s*['"]?\w+/;
const MIGRATION = /\b(drizzle-kit\s+(push|migrate|drop)|bun\s+run\s+(db:)?(push|migrate)\b|bun\s+run\s+db:(reset|seed)\b)/;

export function classify(command: string): Risk | null {
  if (MIGRATION.test(command)) {
    return { kind: 'migration', label: 'schema migration' };
  }
  if (!PSQL.test(command)) {
    return null;
  }
  const write = WRITE_SQL.exec(command);
  if (write !== null) {
    return { kind: 'sql-write', label: write[0].replace(/\s+/g, ' ').toUpperCase() };
  }
  if (SQL_FILE.test(command)) {
    return { kind: 'sql-file', label: 'SQL from a file or heredoc' };
  }
  return null;
}

// A host with no dot (`db`, `postgres`) is a Docker Compose service name: a managed database always has a domain.
const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0|host\.docker\.internal|[\w-]+\.localhost|[a-z][\w-]*)$/i;

export const isLocalHost = (host: string): boolean => LOCAL_HOST.test(host);

/** Database hosts named in a command: postgres URLs, psql -h/--host, PGHOST=. */
export function hostsIn(command: string): string[] {
  const hosts: string[] = [];
  for (const match of command.matchAll(/postgres(?:ql)?:\/\/(?:[^@\s/'"]*@)?(\[[^\]]+\]|[^:/\s?'"]+)/g)) hosts.push(match[1] ?? '');
  for (const match of command.matchAll(/(?:\s-h\s*|--host[=\s])['"]?([\w.:-]+)/g)) hosts.push(match[1] ?? '');
  for (const match of command.matchAll(/\bPGHOST=['"]?([\w.:-]+)/g)) hosts.push(match[1] ?? '');
  return hosts.filter(host => host !== '');
}

/** The host in a DATABASE_URL line of a .env file, if any. */
export function envDatabaseHost(envFile: string): string | undefined {
  const line = envFile.split('\n').find(row => /^\s*(export\s+)?DATABASE_URL\s*=/.test(row));
  return line === undefined ? undefined : hostsIn(line)[0];
}

/** A command for display, with any URL password hidden. */
export const maskSecrets = (command: string): string =>
  command.replace(/(postgres(?:ql)?:\/\/[^:@\s/]+):[^@\s]+@/g, '$1:***@').replace(/\bPGPASSWORD=\S+/g, 'PGPASSWORD=***');
