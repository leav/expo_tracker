"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loadSqlJsBrowser } from "../db/engine-browser";
import { copySqliteBytes, idbGet, idbSet } from "../db/idb";
import { createWorkspace, isSqliteBytes, type Workspace } from "../db/workspace";
import type { TrackerDb } from "../domain/db";

type ReadyWorkspace = {
  status: "ready";
  db: TrackerDb;
  persist: () => Promise<void>;
  revision: number;
  persistOk: boolean;
  exportBytes: () => Uint8Array;
  replaceWorkspace: (bytes: Uint8Array) => Promise<void>;
};

type WorkspaceState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | ReadyWorkspace;

const WorkspaceContext = createContext<WorkspaceState>({ status: "loading" });

export function useWorkspaceState() {
  return useContext(WorkspaceContext);
}

export function useReadyWorkspace(): ReadyWorkspace | null {
  const state = useWorkspaceState();
  return state.status === "ready" ? state : null;
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>({ status: "loading" });
  const workspaceRef = useRef<Workspace | null>(null);
  const sqlRef = useRef<Awaited<ReturnType<typeof loadSqlJsBrowser>> | null>(null);
  const persistOkRef = useRef(true);

  const persist = useCallback(async () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    try {
      await idbSet(copySqliteBytes(workspace.sqlite.export()));
      persistOkRef.current = true;
    } catch {
      persistOkRef.current = false;
      setState((current) => (current.status === "ready" ? { ...current, persistOk: false } : current));
    }
  }, []);

  const boot = useCallback(async () => {
    try {
      const SQL = await loadSqlJsBrowser();
      sqlRef.current = SQL;
      let bytes: Uint8Array | undefined;
      try {
        bytes = await idbGet();
      } catch {
        persistOkRef.current = false;
      }
      if (bytes && !isSqliteBytes(bytes)) {
        setState({ status: "error", message: "The saved workspace is not a SQLite file." });
        return;
      }
      const workspace = createWorkspace(SQL, bytes);
      workspaceRef.current = workspace;
      setState({
        status: "ready",
        db: workspace.db,
        persist,
        revision: 0,
        persistOk: persistOkRef.current,
        exportBytes: () => copySqliteBytes(workspace.sqlite.export()),
        replaceWorkspace: async () => undefined,
      });
    } catch (cause) {
      setState({
        status: "error",
        message: cause instanceof Error ? cause.message : "Could not open the workspace.",
      });
    }
  }, [persist]);

  const replaceWorkspace = useCallback(
    async (bytes: Uint8Array) => {
      const SQL = sqlRef.current;
      if (!SQL) throw new Error("The workspace engine is not ready.");
      if (!isSqliteBytes(bytes)) throw new Error("That file is not a SQLite database.");
      workspaceRef.current?.sqlite.close();
      const workspace = createWorkspace(SQL, bytes);
      workspaceRef.current = workspace;
      persistOkRef.current = true;
      await persist();
      setState({
        status: "ready",
        db: workspace.db,
        persist,
        revision: Date.now(),
        persistOk: persistOkRef.current,
        exportBytes: () => copySqliteBytes(workspace.sqlite.export()),
        replaceWorkspace: async () => undefined,
      });
    },
    [persist],
  );

  useEffect(() => {
    void boot();
    return () => {
      workspaceRef.current?.sqlite.close();
      workspaceRef.current = null;
    };
  }, [boot]);

  useEffect(() => {
    function onPageHide() {
      void persist();
    }
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [persist]);

  const value = useMemo<WorkspaceState>(() => {
    if (state.status !== "ready") return state;
    return {
      ...state,
      persist: async () => {
        setState((current) =>
          current.status === "ready" ? { ...current, revision: current.revision + 1 } : current,
        );
        await persist();
        setState((current) =>
          current.status === "ready" ? { ...current, persistOk: persistOkRef.current } : current,
        );
      },
      replaceWorkspace,
      exportBytes: () => {
        const workspace = workspaceRef.current;
        if (!workspace) throw new Error("The workspace is not ready.");
        return copySqliteBytes(workspace.sqlite.export());
      },
    };
  }, [persist, replaceWorkspace, state]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function PersistBanner() {
  const workspace = useReadyWorkspace();
  if (!workspace || workspace.persistOk) return null;
  return (
    <p className="border-b bg-destructive/10 px-4 py-2 text-center text-sm text-destructive sm:px-6">
      This browser blocked saving. Export a backup from Data before you close the tab.
    </p>
  );
}

export function WorkspaceReady({ children }: { children: ReactNode }) {
  const state = useWorkspaceState();
  if (state.status === "loading") {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
        Loading workspace…
      </main>
    );
  }
  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{state.message}</p>
      </main>
    );
  }
  return children;
}
