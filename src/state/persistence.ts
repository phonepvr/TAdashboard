/**
 * Local-only persistence (§1.1). Everything lives in IndexedDB on the user's own
 * device and is NEVER transmitted. The mapping config contains no PII (header
 * names + canonical choices). The parsed dataset is cached ONLY when the user
 * opts in and is not in session-only mode. "Clear all data" wipes everything.
 */
import { openDB, deleteDB, type IDBPDatabase } from 'idb';
import type { MappingConfig, ParsedTable } from '../domain/types';

const DB_NAME = 'tadashboard';
const DB_VERSION = 1;
const KV = 'kv';
const DATASET = 'dataset';

export interface PrivacyPrefs {
  /** memory-only: nothing is persisted; discarded on tab close. */
  sessionOnly: boolean;
  /** opt-in to caching the parsed dataset on this device. */
  cacheDataset: boolean;
  /** reveal PII locally (off => masked everywhere). */
  privateDrillDown: boolean;
}

export const DEFAULT_PREFS: PrivacyPrefs = {
  sessionOnly: false,
  cacheDataset: false,
  privateDrillDown: false,
};

let dbPromise: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(KV)) d.createObjectStore(KV);
        if (!d.objectStoreNames.contains(DATASET)) d.createObjectStore(DATASET);
      },
    });
  }
  return dbPromise;
}

export async function loadPrefs(): Promise<PrivacyPrefs> {
  try {
    const v = (await (await db()).get(KV, 'prefs')) as PrivacyPrefs | undefined;
    return { ...DEFAULT_PREFS, ...(v ?? {}) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function savePrefs(prefs: PrivacyPrefs): Promise<void> {
  if (prefs.sessionOnly) return; // session-only: persist nothing
  await (await db()).put(KV, prefs, 'prefs');
}

export async function loadMapping(): Promise<MappingConfig | null> {
  try {
    return ((await (await db()).get(KV, 'mapping')) as MappingConfig | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function saveMapping(mapping: MappingConfig, sessionOnly: boolean): Promise<void> {
  if (sessionOnly) return;
  await (await db()).put(KV, mapping, 'mapping');
}

export async function loadDataset(): Promise<ParsedTable | null> {
  try {
    return ((await (await db()).get(DATASET, 'current')) as ParsedTable | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function saveDataset(table: ParsedTable, prefs: PrivacyPrefs): Promise<void> {
  if (prefs.sessionOnly || !prefs.cacheDataset || table.isDemo) return;
  await (await db()).put(DATASET, table, 'current');
}

export async function clearDataset(): Promise<void> {
  try {
    await (await db()).delete(DATASET, 'current');
  } catch {
    /* ignore */
  }
}

/** Nuke ALL in-browser storage for this origin (the shared-computer escape hatch). */
export async function clearAllData(): Promise<void> {
  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      /* ignore */
    }
    dbPromise = null;
  }
  await deleteDB(DB_NAME);
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
}
