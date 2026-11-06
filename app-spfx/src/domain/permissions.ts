/* Who can do what. A grant gives one person one capability, for one project (or all projects),
   and for one folder (or the whole project). Pure: no SharePoint, no UI. */

export const CAPS = ['edit_any', 'remove', 'projects', 'permissions'] as const;
export type Cap = typeof CAPS[number];

export const CAP_LABEL: Record<Cap, string> = {
  edit_any: 'Upload to any document, not only their own',
  remove: 'Remove and restore documents',
  projects: 'Change projects, folders and templates',
  permissions: 'Manage who can do what (admin)',
};

/* Every member can add documents and revisions. The grants here control the rest. Starting sets. Applying a preset adds these grants; it does not remove others. */
export const PRESETS: Record<string, Cap[]> = {
  'Member': [],
  'Records Lead': ['edit_any', 'remove', 'projects'],
  'Admin': ['edit_any', 'remove', 'projects', 'permissions'],
};

export const ALL_PROJECTS = '*';

export interface Grant { id: number; user: string; project: string; folder: string; cap: Cap }
export interface Me { name: string; grants: Grant[] }

/* Folder '' matches the whole project. Folder 'A/B' also matches 'A/B/C'. */
export function folderMatches(grantFolder: string, folder: string): boolean {
  if (!grantFolder) return true;
  return folder === grantFolder || folder.startsWith(grantFolder + '/');
}

/* Project '' or '*' in a check means "any project". A grant for '*' covers every project. */
export function allowed(grants: Grant[], user: string, cap: Cap, project = ALL_PROJECTS, folder = ''): boolean {
  return grants.some(g =>
    g.user === user && g.cap === cap &&
    (g.project === ALL_PROJECTS || project === ALL_PROJECTS || g.project === project) &&
    folderMatches(g.folder, folder));
}

export function can(me: Me, cap: Cap, project = ALL_PROJECTS, folder = ''): boolean {
  return allowed(me.grants, me.name, cap, project, folder);
}

/* Grants to add when a preset is applied to one person, project and folder. */
export function presetGrants(preset: string, user: string, project: string, folder: string): Array<Omit<Grant, 'id'>> {
  return (PRESETS[preset] || []).map(cap => ({ user, project, folder, cap }));
}

export function grantErrors(g: { user: string; project: string; folder: string; cap: string }, existing: Grant[]): string | null {
  if (!g.user.trim()) return 'Choose a person.';
  if (!(CAPS as readonly string[]).includes(g.cap)) return 'Choose a permission.';
  if (existing.some(x => x.user === g.user && x.cap === g.cap && x.project === g.project && x.folder === g.folder)) return 'That person already has this permission here.';
  return null;
}

/* Bootstrap: if no grants exist yet, the Records Lead group gets the Admin preset in memory.
   Keeps a fresh site usable before anyone has set up grants. */
export function bootstrapGrants(groupMembers: string[], hasAnyGrants: boolean): Grant[] {
  if (hasAnyGrants) return [];
  return groupMembers.flatMap((user, i) => presetGrants('Admin', user, ALL_PROJECTS, '').map((g, j) => ({ ...g, id: -(i * 10 + j + 1) })));
}
