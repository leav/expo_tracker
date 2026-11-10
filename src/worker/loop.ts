import { openDatabase } from "../db";

const globalForWorker = globalThis as unknown as {
  workerStarted?: boolean;
};

const tickMs = 60_000;

export function startWorker(options?: { keepAlive?: boolean }) {
  if (globalForWorker.workerStarted) return;
  globalForWorker.workerStarted = true;

  openDatabase();
  console.log("worker: started; no detectors configured");

  const timer = setInterval(tick, tickMs);
  if (!options?.keepAlive) timer.unref();
}

function tick() {
  // Detectors arrive in later milestones. A detector whose credentials are
  // missing no-ops. M5.1 has none.
}
