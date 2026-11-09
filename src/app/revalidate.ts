import { refresh, revalidatePath } from "next/cache";

export function revalidateWorkspace(conventionId?: number) {
  revalidatePath("/");
  revalidatePath("/lineups");
  revalidatePath("/calendar");
  revalidatePath("/settings");
  if (conventionId != null && Number.isInteger(conventionId)) {
    revalidatePath(`/cons/${conventionId}`);
  }
  refresh();
}
