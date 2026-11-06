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
