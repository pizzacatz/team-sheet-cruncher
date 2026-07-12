import species from './regulation-mb/species.json'
import moves from './regulation-mb/moves.json'
import abilities from './regulation-mb/abilities.json'
import items from './regulation-mb/items.json'
import statAlignments from './regulation-mb/stat-alignments.json'

/**
 * Slug-id → display-name registry, built from the regulation data snapshot
 * bundled under ./regulation-mb (copied from Team Sheet Builder — see the
 * README there). TSBv1 slug ids are self-describing, so when a snapshot is
 * missing or stale we fall back to prettifying the slug instead of failing.
 */

interface DataRecord {
  id: string
  displayName: string
}

export type Category = 'species' | 'move' | 'ability' | 'item' | 'statAlignment'

const maps: Record<Category, Map<string, string>> = {
  species: toMap(species),
  move: toMap(moves),
  ability: toMap(abilities),
  item: toMap(items),
  statAlignment: toMap(statAlignments),
}

function toMap(records: DataRecord[]): Map<string, string> {
  return new Map(records.map((r) => [r.id, r.displayName]))
}

/** True when a real data snapshot is bundled for this category. */
export function hasSnapshot(category: Category): boolean {
  return maps[category].size > 0
}

/** `fake-out` → `Fake Out` — used when a slug isn't in the snapshot. */
export function prettifySlug(slug: string): string {
  return slug
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

export interface ResolvedName {
  name: string
  /** Slug wasn't found in a bundled (non-empty) snapshot — data may be stale. */
  unknown: boolean
}

/** Resolve a slug id to a display name; empty slug resolves to empty name. */
export function resolveName(category: Category, slug: string): ResolvedName {
  if (slug === '') return { name: '', unknown: false }
  const known = maps[category].get(slug)
  if (known !== undefined) return { name: known, unknown: false }
  return { name: prettifySlug(slug), unknown: hasSnapshot(category) }
}
