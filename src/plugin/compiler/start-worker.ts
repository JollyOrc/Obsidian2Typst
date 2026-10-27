// US-007 AC-3, AC-12: starts the compiler worker from the code that is
// embedded in main.js (a Blob URL; the plugin folder holds no worker file).
import workerSource from 'embedded:worker-source';
import type {WorkerLike} from './index';

/** Starts one compiler worker. */
export function startWorker(): WorkerLike {
  const url = URL.createObjectURL(
    new Blob([workerSource], {type: 'text/javascript'}),
  );
  const worker = new Worker(url);
  // The worker has its code now; the address is not needed any more.
  URL.revokeObjectURL(url);
  const like: WorkerLike = {
    postMessage: (message, transfer = []) =>
      worker.postMessage(message, transfer),
    terminate: () => worker.terminate(),
    onmessage: null,
    onerror: null,
  };
  worker.onmessage = (event: MessageEvent) =>
    like.onmessage?.({data: event.data});
  worker.onerror = (event: ErrorEvent) =>
    like.onerror?.({message: event.message});
  return like;
}
