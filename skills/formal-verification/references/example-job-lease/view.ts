// Reader's words for the JobLease model. Used by scripts/dot-to-mermaid.ts.
type Vars = Record<string, string>;

const commits = (v: Vars) => (v.committed === '{}' ? 0 : v.committed.split(',').length);
const staleHolder = (v: Vars) =>
  [...v.held.matchAll(/:> (\d+)/g)].some((m) => m[1] !== '0' && m[1] !== v.token);

export const state = (v: Vars) => {
  if (commits(v) > 1) return 'Committed twice';
  if (commits(v) === 1) return staleHolder(v) ? 'Committed, an old holder still working' : 'Committed';
  if (v.token === '0') return 'Free';
  if (v.lease === 'NoOne') return 'Lease lapsed, holder still working';
  return staleHolder(v) ? 'Held again, old holder still working' : 'Held';
};

export const step = (action: string) =>
  ({
    Acquire: 'a worker takes the lease',
    Expire: 'the lease expires',
    Commit: 'a worker commits',
  })[action] ?? null;

export const breaks = (v: Vars) =>
  commits(v) > 1 ? 'a job commits its result at most once' : null;
