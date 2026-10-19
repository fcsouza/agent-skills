export type Worktree = { path: string; branch: string; changes: number };

/** Parses `git worktree list --porcelain`. Detached heads show their short commit. */
export function parseWorktrees(porcelain: string): Omit<Worktree, 'changes'>[] {
  const trees: Omit<Worktree, 'changes'>[] = [];
  for (const block of porcelain.split('\n\n')) {
    const lines = block.split('\n');
    const path = lines.find(line => line.startsWith('worktree '))?.slice('worktree '.length);
    if (path === undefined || lines.includes('bare')) {
      continue;
    }
    const branch = lines.find(line => line.startsWith('branch '))?.slice('branch refs/heads/'.length);
    const head = lines.find(line => line.startsWith('HEAD '))?.slice('HEAD '.length, 'HEAD '.length + 7);
    trees.push({ path, branch: branch ?? `(${head ?? 'detached'})` });
  }
  return trees;
}

/** Lines of `git status --porcelain`: one per changed or untracked file. */
export const countChanges = (porcelain: string): number => porcelain.split('\n').filter(line => line.trim() !== '').length;

/** Shortens a long name in the middle so both ends stay readable: feature/rob…ch-319677 */
export function shorten(name: string, max: number): string {
  if (name.length <= max) return name;
  const keep = max - 1;
  const head = Math.ceil(keep / 2);
  return `${name.slice(0, head)}…${name.slice(name.length - (keep - head))}`;
}
