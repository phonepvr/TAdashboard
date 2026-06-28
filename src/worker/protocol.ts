/** Message protocol shared between the main thread and the parse/normalize worker. */
import type {
  MappingConfig,
  NormalizeResult,
  ParsedTable,
  RawRow,
  TableProfile,
} from '../domain/types';

export type WorkerRequest =
  | { type: 'parseFile'; file: File }
  | { type: 'loadTable'; table: ParsedTable }
  | { type: 'normalize'; mapping: MappingConfig; todayMs?: number }
  | { type: 'getRawRows'; indices: number[] };

export type WorkerResponse =
  | { type: 'progress'; phase: string; pct: number }
  | { type: 'parsed'; profile: TableProfile }
  | { type: 'normalized'; result: NormalizeResult }
  | { type: 'rawRows'; rows: { i: number; cells: RawRow }[] }
  | { type: 'error'; message: string };
