// Test support for US-007: workers that are scripted or that run the real
// worker logic in the same process.
import type {WorkerLike} from '../../src/plugin/compiler';
import {createWorkerCore} from '../../src/plugin/compiler/worker-core';

/** A worker whose answers are written by the test. */
export class ScriptedWorker implements WorkerLike {
  onmessage: ((event: {data: unknown}) => void) | null = null;
  onerror: ((event: {message?: string}) => void) | null = null;
  terminated = 0;
  readonly received: Record<string, unknown>[] = [];
  /** Called for every message the plugin posts; reply through `emit`. */
  constructor(
    private readonly script: (
      message: Record<string, unknown>,
      worker: ScriptedWorker,
    ) => void,
  ) {}
  postMessage(message: unknown): void {
    const record = message as Record<string, unknown>;
    this.received.push(record);
    queueMicrotask(() => this.script(record, this));
  }
  terminate(): void {
    this.terminated++;
  }
  emit(data: unknown): void {
    this.onmessage?.({data});
  }
  fail(message: string): void {
    this.onerror?.({message});
  }
}

/**
 * A worker that runs the real worker logic in this process: what the plugin
 * posts goes to `createWorkerCore`, what the core answers comes back through
 * `onmessage`. Used with the real Typst compiler in Node.
 */
export class LoopbackWorker implements WorkerLike {
  onmessage: ((event: {data: unknown}) => void) | null = null;
  onerror: ((event: {message?: string}) => void) | null = null;
  terminated = 0;
  private readonly core = createWorkerCore((message) => {
    // The real postMessage is asynchronous too.
    queueMicrotask(() => {
      if (this.terminated === 0) this.onmessage?.({data: message});
    });
  });
  postMessage(message: unknown): void {
    void this.core.handle(message).catch((error: unknown) => {
      this.onerror?.({message: String(error)});
    });
  }
  terminate(): void {
    this.terminated++;
  }
}
