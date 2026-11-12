import { loadSqlJsNode } from "./engine-node";
import { createWorkspace, type Workspace } from "./workspace";

export async function openMemoryDatabase(): Promise<Workspace> {
  return createWorkspace(await loadSqlJsNode());
}
