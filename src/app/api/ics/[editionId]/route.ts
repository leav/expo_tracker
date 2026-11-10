import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { openDatabase } from "../../../../db";
import { conventions, editions } from "../../../../db/schema";
import { isReminderKind } from "../../../../domain/calendarEvent";
import { icsFilename, icsForReminder } from "../../../../domain/ics";

export async function GET(request: Request, context: { params: Promise<{ editionId: string }> }) {
  const { editionId: rawId } = await context.params;
  const editionId = Number(rawId);
  const kind = new URL(request.url).searchParams.get("kind") ?? "";
  if (!Number.isInteger(editionId) || !isReminderKind(kind)) {
    return new NextResponse(null, { status: 404 });
  }

  const db = openDatabase();
  const row = db
    .select({
      editionId: editions.id,
      cycleLabel: editions.cycleLabel,
      startDate: editions.startDate,
      applicationStartDate: editions.applicationStartDate,
      conventionName: conventions.displayName,
    })
    .from(editions)
    .innerJoin(conventions, eq(editions.conventionId, conventions.id))
    .where(eq(editions.id, editionId))
    .get();
  if (!row) return new NextResponse(null, { status: 404 });

  const date = kind === "start" ? row.startDate : row.applicationStartDate;
  const body = icsForReminder({
    kind,
    conventionName: row.conventionName,
    cycleLabel: row.cycleLabel,
    date,
    editionId: row.editionId,
  });
  if (!body) return new NextResponse(null, { status: 404 });

  const filename = icsFilename({
    kind,
    conventionName: row.conventionName,
    cycleLabel: row.cycleLabel,
  });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
