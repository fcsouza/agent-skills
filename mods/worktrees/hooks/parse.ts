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
