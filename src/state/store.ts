/**
 * Application store (Zustand). Owns the dataset lifecycle, mapping config,
 * normalized result + DQ, and the local-only privacy preferences.
 */
import { create } from 'zustand';
import type {
  LogicalRole,
  MappingConfig,
  NormalizeResult,
  RawRow,
  TableProfile,
} from '../domain/types';
import type { FilterContext } from '../domain/metrics';
import { buildDefaultMapping, suggestStageOrder } from '../domain/mapping';
import { MAPPING_VERSION } from '../domain/mapping';
import { generateDemoTable } from '../domain/demo';
import { getWorkerClient } from './workerClient';
import {
  clearAllData,
  clearDataset,
  DEFAULT_PREFS,
  loadMapping,
  loadPrefs,
  type PrivacyPrefs,
  saveMapping,
  savePrefs,
} from './persistence';

export type Status = 'idle' | 'parsing' | 'mapping' | 'normalizing' | 'ready' | 'error';

/** Filter keys that hold a string[] of allowed values (excludes the numeric period bounds). */
export type SlicerFilterKey =
  | 'calendarYear'
  | 'businessUnit'
  | 'function'
  | 'hrHead'
  | 'level'
  | 'recruiter'
  | 'source'
  | 'demandType'
  | 'location';

export type AppView = 'exec' | 'review' | 'metrics' | 'dq';

interface Progress {
  phase: string;
  pct: number;
}

interface StoreState {
  status: Status;
  progress: Progress | null;
  error: string | null;
  profile: TableProfile | null;
  mapping: MappingConfig | null;
  result: NormalizeResult | null;
  isDemo: boolean;
  prefs: PrivacyPrefs;
  initialized: boolean;
  filters: FilterContext;
  activeView: AppView;

  init: () => Promise<void>;
  loadFile: (file: File) => Promise<void>;
  loadDemo: () => Promise<void>;
  setRoleHeader: (role: LogicalRole, header: string | null) => void;
  setStageOrder: (order: string[]) => void;
  setValueOverride: (role: LogicalRole, token: string, canonical: string) => void;
  confirmMapping: () => Promise<void>;
  backToMapping: () => void;
  newSession: () => void;
  setFilter: (role: SlicerFilterKey, values: string[]) => void;
  clearFilters: () => void;
  setActiveView: (view: AppView) => void;
  getRawRows: (indices: number[]) => Promise<{ i: number; cells: RawRow }[]>;
  setPref: <K extends keyof PrivacyPrefs>(key: K, value: PrivacyPrefs[K]) => Promise<void>;
  clearAll: () => Promise<void>;
}

function stageValuesFromProfile(profile: TableProfile, mapping: MappingConfig): string[] {
  const header = mapping.roleToHeader.stage;
  if (!header) return [];
  const col = profile.columns.find((c) => c.header === header);
  return col?.sampleValues ?? [];
}

export const useStore = create<StoreState>()((set, get) => ({
  status: 'idle',
  progress: null,
  error: null,
  profile: null,
  mapping: null,
  result: null,
  isDemo: false,
  prefs: { ...DEFAULT_PREFS },
  initialized: false,
  filters: {},
  activeView: 'exec',

  init: async () => {
    if (get().initialized) return;
    const [prefs, mapping] = await Promise.all([loadPrefs(), loadMapping()]);
    set({ prefs, mapping, initialized: true });
  },

  loadFile: async (file) => {
    set({ status: 'parsing', error: null, progress: { phase: 'reading', pct: 0 }, result: null });
    try {
      const client = getWorkerClient();
      const profile = await client.parseFile(file, (p) => set({ progress: p }));
      finishParse(set, get, profile, false);
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e), progress: null });
    }
  },

  loadDemo: async () => {
    set({ status: 'parsing', error: null, progress: { phase: 'generating', pct: 0 }, result: null });
    try {
      const table = generateDemoTable();
      const client = getWorkerClient();
      const profile = await client.loadTable(table, (p) => set({ progress: p }));
      finishParse(set, get, profile, true);
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e), progress: null });
    }
  },

  setRoleHeader: (role, header) => {
    const mapping = get().mapping;
    if (!mapping) return;
    set({
      mapping: {
        ...mapping,
        roleToHeader: { ...mapping.roleToHeader, [role]: header },
        updatedAt: Date.now(),
      },
    });
  },

  setStageOrder: (order) => {
    const mapping = get().mapping;
    if (!mapping) return;
    set({ mapping: { ...mapping, stageOrder: order, updatedAt: Date.now() } });
  },

  setValueOverride: (role, token, canonical) => {
    const mapping = get().mapping;
    if (!mapping) return;
    const roleOverrides = { ...(mapping.valueOverrides[role] ?? {}), [token.toLowerCase()]: canonical };
    set({
      mapping: {
        ...mapping,
        valueOverrides: { ...mapping.valueOverrides, [role]: roleOverrides },
        updatedAt: Date.now(),
      },
    });
  },

  confirmMapping: async () => {
    const { mapping, prefs } = get();
    if (!mapping) return;
    set({ status: 'normalizing', progress: { phase: 'normalizing', pct: 0 }, error: null });
    try {
      await saveMapping(mapping, prefs.sessionOnly);
      const client = getWorkerClient();
      const result = await client.normalize(mapping, undefined, (p) => set({ progress: p }));
      set({ status: 'ready', result, progress: null });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e), progress: null });
    }
  },

  backToMapping: () => set({ status: 'mapping' }),

  newSession: () =>
    set({ status: 'idle', profile: null, result: null, progress: null, error: null, filters: {} }),

  setFilter: (role, values) => {
    const filters = { ...get().filters };
    if (values.length === 0) delete filters[role];
    else filters[role] = values;
    set({ filters });
  },
  clearFilters: () => set({ filters: {} }),
  setActiveView: (view) => set({ activeView: view }),
  getRawRows: (indices) => getWorkerClient().getRawRows(indices),

  setPref: async (key, value) => {
    const prefs = { ...get().prefs, [key]: value };
    set({ prefs });
    if (prefs.sessionOnly) {
      // entering session-only: stop persisting (and forget any cached dataset).
      await clearDataset();
    } else {
      await savePrefs(prefs);
    }
  },

  clearAll: async () => {
    await clearAllData();
    set({
      status: 'idle',
      progress: null,
      error: null,
      profile: null,
      mapping: null,
      result: null,
      isDemo: false,
      prefs: { ...DEFAULT_PREFS },
    });
  },
}));

function finishParse(
  set: (partial: Partial<StoreState>) => void,
  get: () => StoreState,
  profile: TableProfile,
  isDemo: boolean,
) {
  const existing = get().mapping;
  const headerSet = new Set(profile.headers);
  // Reuse a saved mapping only if its headers still exist in this file; else auto-map.
  const reusable =
    existing &&
    existing.version === MAPPING_VERSION &&
    Object.values(existing.roleToHeader).every((h) => !h || headerSet.has(h));
  let mapping = reusable ? existing! : buildDefaultMapping(profile.headers, Date.now());
  if (!mapping.stageOrder || mapping.stageOrder.length === 0) {
    mapping = { ...mapping, stageOrder: suggestStageOrder(stageValuesFromProfile(profile, mapping)) };
  }
  set({ status: 'mapping', profile, mapping, isDemo, progress: null });
}
