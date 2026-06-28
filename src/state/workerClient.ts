/**
 * Promise-based wrapper around the parse/normalize Web Worker. Requests are
 * serialized (one in-flight at a time, matching the UI flow); progress events
 * are forwarded to an optional callback.
 */
import type { MappingConfig, NormalizeResult, ParsedTable, RawRow, TableProfile } from '../domain/types';
import type { WorkerRequest, WorkerResponse } from '../worker/protocol';

export type ProgressCb = (p: { phase: string; pct: number }) => void;

type Terminal = 'parsed' | 'normalized' | 'rawRows';
interface Pending {
  expect: Terminal;
  resolve: (m: WorkerResponse) => void;
  reject: (e: Error) => void;
  onProgress?: ProgressCb;
}

export class WorkerClient {
  private worker: Worker;
  private queue: { req: WorkerRequest; pending: Pending }[] = [];
  private active: Pending | null = null;

  constructor() {
    this.worker = new Worker(new URL('../worker/parse.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.onMessage(e.data);
    this.worker.onerror = (e) => {
      const err = new Error(e.message || 'Worker error');
      this.active?.reject(err);
      this.active = null;
      this.pump();
    };
  }

  private onMessage(m: WorkerResponse) {
    if (m.type === 'progress') {
      this.active?.onProgress?.({ phase: m.phase, pct: m.pct });
      return;
    }
    if (!this.active) return;
    if (m.type === 'error') {
      const p = this.active;
      this.active = null;
      p.reject(new Error(m.message));
      this.pump();
      return;
    }
    if (m.type === this.active.expect) {
      const p = this.active;
      this.active = null;
      p.resolve(m);
      this.pump();
    }
  }

  private pump() {
    if (this.active || this.queue.length === 0) return;
    const next = this.queue.shift()!;
    this.active = next.pending;
    this.worker.postMessage(next.req);
  }

  private send(req: WorkerRequest, expect: Terminal, onProgress?: ProgressCb): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      this.queue.push({ req, pending: { expect, resolve, reject, onProgress } });
      this.pump();
    });
  }

  async parseFile(file: File, onProgress?: ProgressCb): Promise<TableProfile> {
    const m = await this.send({ type: 'parseFile', file }, 'parsed', onProgress);
    if (m.type !== 'parsed') throw new Error('Unexpected response');
    return m.profile;
  }

  async loadTable(table: ParsedTable, onProgress?: ProgressCb): Promise<TableProfile> {
    const m = await this.send({ type: 'loadTable', table }, 'parsed', onProgress);
    if (m.type !== 'parsed') throw new Error('Unexpected response');
    return m.profile;
  }

  async normalize(mapping: MappingConfig, todayMs?: number, onProgress?: ProgressCb): Promise<NormalizeResult> {
    const m = await this.send({ type: 'normalize', mapping, todayMs }, 'normalized', onProgress);
    if (m.type !== 'normalized') throw new Error('Unexpected response');
    return m.result;
  }

  async getRawRows(indices: number[]): Promise<{ i: number; cells: RawRow }[]> {
    const m = await this.send({ type: 'getRawRows', indices }, 'rawRows');
    if (m.type !== 'rawRows') throw new Error('Unexpected response');
    return m.rows;
  }
}

let singleton: WorkerClient | null = null;
export function getWorkerClient(): WorkerClient {
  if (!singleton) singleton = new WorkerClient();
  return singleton;
}
