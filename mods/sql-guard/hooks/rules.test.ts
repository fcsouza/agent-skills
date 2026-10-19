import { describe, expect, test } from 'claude-code/testing';

import { classify, envDatabaseHost, hostsIn, isLocalHost, maskSecrets } from './rules';

describe('rules', () => {
  test('classify finds writes, SQL files and migrations; reads pass', () => {
    expect(classify('psql "$DATABASE_URL" -c "DELETE FROM users WHERE id = 1"')?.kind).toBe('sql-write');
    expect(classify('psql -h db.example.com -c "drop table x"')?.label).toBe('DROP TABLE');
    expect(classify('psql $URL -f migrate.sql')?.kind).toBe('sql-file');
    expect(classify('bunx drizzle-kit push')?.kind).toBe('migration');
    expect(classify('bun run db:migrate')?.kind).toBe('migration');
    expect(classify('psql $URL -c "select count(*) from users"')).toBeNull();
    expect(classify('grep -r "DELETE FROM" src')).toBeNull();
  });

  test('hostsIn reads URLs, -h and PGHOST', () => {
    expect(hostsIn('psql postgres://app:pw@db.prod.io:5432/app -c "x"')).toEqual(['db.prod.io']);
    expect(hostsIn('psql -h localhost -U me')).toEqual(['localhost']);
    expect(hostsIn('PGHOST=10.0.0.5 psql -c "x"')).toEqual(['10.0.0.5']);
  });

  test('isLocalHost and envDatabaseHost', () => {
    expect(isLocalHost('localhost')).toBe(true);
    expect(isLocalHost('127.0.0.1')).toBe(true);
    expect(isLocalHost('db.prod.io')).toBe(false);
    expect(isLocalHost('db')).toBe(true);
    expect(isLocalHost('10.0.0.5')).toBe(false);
    expect(envDatabaseHost('FOO=1\nDATABASE_URL="postgresql://u:p@ep-cool.neon.tech/db"\n')).toBe('ep-cool.neon.tech');
    expect(envDatabaseHost('FOO=1')).toBeUndefined();
  });

  test('maskSecrets hides URL passwords and PGPASSWORD', () => {
    expect(maskSecrets('PGPASSWORD=hunter2 psql postgres://app:hunter2@db/app')).toBe('PGPASSWORD=*** psql postgres://app:***@db/app');
  });
});
