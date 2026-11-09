import { openDatabase } from "../db";
import { processCalendarSync } from "./calendar";

const globalForWorker = globalThis as unknown as {
  workerStarted?: boolean;
  calendarSyncRunning?: boolean;
};

const tickMs = 60_000;

export function startWorker(options?: { keepAlive?: boolean }) {
  if (globalForWorker.workerStarted) return;
  globalForWorker.workerStarted = true;

  openDatabase();
  console.log("worker: started; retrying Calendar synchronization");

  const timer = setInterval(() => {
    kickCalendarSync();
  }, tickMs);
  if (!options?.keepAlive) timer.unref();
  kickCalendarSync();
}

export function kickCalendarSync() {
  if (globalForWorker.calendarSyncRunning) return;
  globalForWorker.calendarSyncRunning = true;
  void processCalendarSync(openDatabase())
    .catch((error) => {
      console.error("worker: calendar sync failed", error);
    })
    .finally(() => {
      globalForWorker.calendarSyncRunning = false;
    });
}
