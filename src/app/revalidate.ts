import { refresh, revalidatePath } from "next/cache";

export function revalidateWorkspace(conventionId?: number) {
  revalidatePath("/");
  revalidatePath("/lineups");
  revalidatePath("/calendar");
  if (conventionId != null && Number.isInteger(conventionId)) {
    revalidatePath(`/cons/${conventionId}`);
  }
  refresh();
}
