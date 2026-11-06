/* Folder paths as a tree. Pure: paths in, nodes out. */

export interface FolderNode { name: string; path: string; depth: number; children: FolderNode[] }

/* Builds the tree from flat paths. Parents appear even if only their children are listed. Order is alphabetical. */
export function folderTree(paths: string[]): FolderNode[] {
  const root: FolderNode = { name: '', path: '', depth: -1, children: [] };
  for (const p of paths) {
    let node = root;
    const segs = p.split('/');
    segs.forEach((seg, i) => {
      const path = segs.slice(0, i + 1).join('/');
      let child = node.children.find(c => c.name === seg);
      if (!child) { child = { name: seg, path, depth: i, children: [] }; node.children.push(child); }
      node = child;
    });
  }
  const sort = (n: FolderNode) => { n.children.sort((a, b) => a.name.localeCompare(b.name)); n.children.forEach(sort); };
  sort(root);
  return root.children;
}

/* A folder and everything under it. */
export function subtreePaths(paths: string[], path: string): string[] {
  return paths.filter(p => p === path || p.startsWith(path + '/'));
}

/* Number of levels in a path. "A/B" is 2. */
export function levelOf(path: string): number {
  return path ? path.split('/').length : 0;
}

/* What restoring one removed folder brings back: itself, anything removed under it, and any removed parents it needs. */
export function restorePlan(removed: string[], path: string): string[] {
  const parts = path.split('/');
  const ancestors = parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'));
  return removed.filter(r => r === path || r.startsWith(path + '/') || ancestors.includes(r));
}

/* A folder rename: the folder at "from" becomes "to", and everything under it moves with it. */
export interface Rename { from: string; to: string }

/* Where a path ends up after a list of renames, applied in order. */
export function applyRenames(path: string, renames: Rename[]): string {
  let p = path;
  for (const r of renames) {
    if (p === r.from || p.startsWith(r.from + '/')) p = r.to + p.slice(r.from.length);
  }
  return p;
}

/* The same folder with a new last name. "A/B" renamed to "C" gives "A/C". */
export function renamedPath(path: string, newName: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? newName : `${path.slice(0, i)}/${newName}`;
}
