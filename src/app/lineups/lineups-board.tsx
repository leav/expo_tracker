"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { cn } from "cn";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode } from "react";
import { moveLineupEditionAction } from "../actions";
import { ConventionTitle } from "../../components/convention-title";
import { InterestHearts } from "../../components/interest-hearts";
import {
  applyLineupMove,
  canMoveLineupStatus,
  type LineupBoard,
  type LineupItem,
} from "../../domain/lineupBoard";
import { isStatus, statusLabels, type LineupStatus, type Status } from "../../domain/status";

function subscribeClientReady() {
  return () => {};
}

const collisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  const intersections = rectIntersection(args);
  if (intersections.length > 0) return intersections;
  return closestCenter(args);
};

const keyboardCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates }) => {
  switch (event.code) {
    case "ArrowRight":
      return { ...currentCoordinates, x: currentCoordinates.x + 280 };
    case "ArrowLeft":
      return { ...currentCoordinates, x: currentCoordinates.x - 280 };
    case "ArrowDown":
      return { ...currentCoordinates, y: currentCoordinates.y + 160 };
    case "ArrowUp":
      return { ...currentCoordinates, y: currentCoordinates.y - 160 };
    default:
      return undefined;
  }
};

function dropStatus(id: UniqueIdentifier | undefined | null): Status | null {
  if (id == null) return null;
  const value = String(id);
  const status = value.startsWith("column:")
    ? value.slice("column:".length)
    : value.startsWith("terminal:")
      ? value.slice("terminal:".length)
      : null;
  return status && isStatus(status) ? status : null;
}

function editionDragId(editionId: number) {
  return `edition:${editionId}`;
}

function columnDropId(status: LineupStatus) {
  return `column:${status}`;
}

function boardFingerprint(board: LineupBoard): string {
  return board.columns
    .flatMap((column) =>
      column.items.map(
        (item) =>
          [
            item.editionId,
            item.status,
            item.conventionName,
            item.cycleLabel,
            item.dateLabel,
            item.relativeLabel ?? "",
            item.locationLabel ?? "",
            item.interest,
            item.website ?? "",
          ].join("\u001f"),
      ),
    )
    .join("\u001e");
}

export function LineupsBoard({ board: initialBoard, today }: { board: LineupBoard; today: string }) {
  const [board, setBoard] = useState(initialBoard);
  const [appliedFingerprint, setAppliedFingerprint] = useState(() => boardFingerprint(initialBoard));
  const [activeItem, setActiveItem] = useState<LineupItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const incomingFingerprint = boardFingerprint(initialBoard);
  if (incomingFingerprint !== appliedFingerprint) {
    setAppliedFingerprint(incomingFingerprint);
    setBoard(initialBoard);
    setError(null);
  }
  const dndReady = useSyncExternalStore(subscribeClientReady, () => true, () => false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );
  const itemsById = useMemo(() => {
    const map = new Map<number, LineupItem>();
    for (const column of board.columns) {
      for (const item of column.items) map.set(item.editionId, item);
    }
    return map;
  }, [board]);

  function handleDragStart(event: DragStartEvent) {
    const item = event.active.data.current?.item as LineupItem | undefined;
    setActiveItem(item ?? itemsById.get(Number(String(event.active.id).slice("edition:".length))) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const item = activeItem ?? (event.active.data.current?.item as LineupItem | undefined);
    const toStatus = dropStatus(event.over?.id);
    setActiveItem(null);
    if (!item || !toStatus || saving) return;
    if (!canMoveLineupStatus(item.status, toStatus)) return;

    const previous = board;
    setError(null);
    setSaving(true);
    setBoard(applyLineupMove(board, item.editionId, toStatus, today));
    try {
      const result = await moveLineupEditionAction(item.editionId, toStatus);
      if (!result.ok) {
        setBoard(previous);
        setError(result.error);
        return;
      }
      setBoard(result.board);
      setAnnouncement(`Moved ${item.conventionName} ${item.cycleLabel} to ${statusLabels[toStatus]}.`);
    } catch (cause) {
      setBoard(previous);
      setError(cause instanceof Error ? cause.message : "Could not move that edition.");
    } finally {
      setSaving(false);
    }
  }

  const showTerminal = activeItem?.status === "approved";

  return (
    <div className="grid gap-4">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{error}</p>
      ) : null}
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
      {dndReady ? (
        <DndContext
          id="lineups-board"
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragCancel={() => setActiveItem(null)}
          onDragEnd={handleDragEnd}
        >
          <BoardColumns board={board} saving={saving} showTerminal={showTerminal} interactive />
          {showTerminal ? (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-4 backdrop-blur">
              <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-3">
                <TerminalDrop status="attended" />
                <TerminalDrop status="withdrawn" />
              </div>
            </div>
          ) : null}
          <DragOverlay>
            {activeItem ? (
              <LineupCardFace
                item={activeItem}
                detailHref={`/cons/${activeItem.conventionId}#edition-${activeItem.editionId}`}
                className="rounded-lg border bg-card p-3 shadow-lg"
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <BoardColumns board={board} saving={saving} showTerminal={false} interactive={false} />
      )}
    </div>
  );
}

function BoardColumns({
  board,
  saving,
  showTerminal,
  interactive,
}: {
  board: LineupBoard;
  saving: boolean;
  showTerminal: boolean;
  interactive: boolean;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
      <div className={cn("flex min-w-[80rem] gap-3", showTerminal ? "pb-36" : "pb-1")}>
        {board.columns.map((column) =>
          interactive ? (
            <DroppableColumn
              key={column.status}
              status={column.status}
              label={column.label}
              items={column.items}
              saving={saving}
              emphasized={column.status === "open"}
            />
          ) : (
            <ColumnShell
              key={column.status}
              label={column.label}
              count={column.items.length}
              emphasized={column.status === "open"}
            >
              {column.items.map((item) => (
                <LineupCardLayout key={item.editionId} item={item} />
              ))}
            </ColumnShell>
          ),
        )}
      </div>
    </div>
  );
}

function columnClass(emphasized: boolean, isOver: boolean) {
  return cn(
    "flex min-h-[24rem] min-w-64 flex-1 flex-col gap-2 rounded-xl border p-3",
    emphasized ? "border-foreground/40 bg-card" : "border-border bg-muted/20",
    isOver ? "ring-2 ring-foreground/40" : "",
  );
}

function ColumnShell({
  label,
  count,
  emphasized,
  isOver = false,
  columnRef,
  children,
}: {
  label: string;
  count: number;
  emphasized: boolean;
  isOver?: boolean;
  columnRef?: (node: HTMLElement | null) => void;
  children: ReactNode;
}) {
  return (
    <section ref={columnRef} className={columnClass(emphasized, isOver)}>
      <header className="flex items-baseline justify-between gap-2">
        <h2 className={emphasized ? "text-sm font-semibold" : "text-sm font-medium text-muted-foreground"}>{label}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
      </header>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function DroppableColumn({
  status,
  label,
  items,
  saving,
  emphasized,
}: {
  status: LineupStatus;
  label: string;
  items: LineupItem[];
  saving: boolean;
  emphasized: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnDropId(status),
    data: { status },
  });

  return (
    <ColumnShell
      label={label}
      count={items.length}
      emphasized={emphasized}
      isOver={isOver}
      columnRef={setNodeRef}
    >
      {items.map((item) => (
        <DraggableLineupCard key={item.editionId} item={item} disabled={saving} />
      ))}
    </ColumnShell>
  );
}

function LineupCardLayout({
  item,
  cardRef,
  isDragging = false,
  handleProps,
}: {
  item: LineupItem;
  cardRef?: (node: HTMLElement | null) => void;
  isDragging?: boolean;
  handleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  const detailHref = `/cons/${item.conventionId}#edition-${item.editionId}`;
  return (
    <article ref={cardRef} className={cn("flex gap-1 rounded-lg border bg-card p-2", isDragging ? "opacity-40" : "")}>
      <button
        type="button"
        className="mt-0.5 cursor-grab rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
        aria-label={`Move ${item.conventionName} ${item.cycleLabel}`}
        {...handleProps}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <LineupCardFace item={item} detailHref={detailHref} />
      </div>
    </article>
  );
}

function DraggableLineupCard({ item, disabled }: { item: LineupItem; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: editionDragId(item.editionId),
    data: { item },
    disabled,
  });

  return (
    <LineupCardLayout
      item={item}
      cardRef={setNodeRef}
      isDragging={isDragging}
      handleProps={{ disabled, ...listeners, ...attributes }}
    />
  );
}

function LineupCardFace({
  item,
  detailHref,
  className,
}: {
  item: LineupItem;
  detailHref: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1", className)}>
      <ConventionTitle name={item.conventionName} website={item.website} fallbackHref={detailHref}>
        {" "}
        <Link href={detailHref} className="font-medium leading-tight hover:underline">
          {item.cycleLabel}
        </Link>
      </ConventionTitle>
      <Link href={detailHref} className="grid gap-1">
        <InterestHearts score={item.interest} />
        <span
          className={
            item.actionDate == null
              ? "text-sm text-muted-foreground"
              : item.estimated
                ? "text-sm font-medium italic"
                : "text-sm font-medium"
          }
        >
          {item.dateLabel}
        </span>
        {item.relativeLabel ? <span className="text-xs text-muted-foreground">{item.relativeLabel}</span> : null}
        {item.locationLabel ? (
          <span className="text-xs text-muted-foreground">{item.locationLabel}</span>
        ) : null}
      </Link>
    </div>
  );
}

function TerminalDrop({ status }: { status: "attended" | "withdrawn" }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `terminal:${status}`,
    data: { status },
  });
  const attended = status === "attended";
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-24 items-center justify-center rounded-xl border-2 border-dashed text-lg font-medium",
        attended
          ? "border-emerald-700/40 bg-emerald-50 text-emerald-950"
          : "border-destructive/40 bg-destructive/10 text-destructive",
        isOver ? "ring-2 ring-foreground" : "",
      )}
    >
      {statusLabels[status]}
    </div>
  );
}
