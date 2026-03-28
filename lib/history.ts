export type HistoryType = 'dna' | 'brief' | 'trends'

export interface HistoryItem {
  id: string           // "local_xxx" for localStorage, stringified number for DB
  type: HistoryType
  title: string        // e.g. "Bloom Nutrition · 10 Variations"
  metadata: Record<string, unknown>  // extra context chips shown in the card
  output: string       // full AI-generated text
  created_at: string   // ISO string
}

export type HistoryListItem = Omit<HistoryItem, 'output'>

const MAX_ITEMS = 30
const MAX_OUTPUT_BYTES = 300 * 1024 // 300KB

function storageKey(type: HistoryType): string {
  return `hookd_history_${type}`
}

export function makeLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function getLocalHistory(type: HistoryType): HistoryListItem[] {
  try {
    const raw = localStorage.getItem(storageKey(type))
    if (!raw) return []
    const items: HistoryItem[] = JSON.parse(raw)
    return items
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, MAX_ITEMS)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ output: _output, ...rest }) => rest)
  } catch {
    return []
  }
}

export function getLocalHistoryItem(type: HistoryType, id: string): HistoryItem | null {
  try {
    const raw = localStorage.getItem(storageKey(type))
    if (!raw) return null
    const items: HistoryItem[] = JSON.parse(raw)
    return items.find(i => i.id === id) ?? null
  } catch {
    return null
  }
}

export function saveToLocalHistory(item: HistoryItem): void {
  try {
    if (new Blob([item.output]).size > MAX_OUTPUT_BYTES) return
    const raw = localStorage.getItem(storageKey(item.type))
    const items: HistoryItem[] = raw ? JSON.parse(raw) : []
    const filtered = items.filter(i => i.id !== item.id)
    filtered.unshift(item)
    filtered.splice(MAX_ITEMS)
    localStorage.setItem(storageKey(item.type), JSON.stringify(filtered))
  } catch {
    // silently skip if localStorage is unavailable or quota exceeded
  }
}

export function deleteFromLocalHistory(type: HistoryType, id: string): void {
  try {
    const raw = localStorage.getItem(storageKey(type))
    if (!raw) return
    const items: HistoryItem[] = JSON.parse(raw)
    localStorage.setItem(storageKey(type), JSON.stringify(items.filter(i => i.id !== id)))
  } catch {
    // silently skip
  }
}
