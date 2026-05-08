"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

type DndTransform = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
};
function transformToCss(t: DndTransform | null): string | undefined {
  if (!t) return undefined;
  return `translate3d(${t.x}px, ${t.y}px, 0) scaleX(${t.scaleX}) scaleY(${t.scaleY})`;
}
import styles from "./styles.module.css";
import {
  useAddRunwayItem,
  useCallsLane,
  useListings,
  useMoments,
  useReorderRunwayItems,
  useResetRunway,
  useRunway,
  useSoftDeleteRunwayItem,
  useStatusBarStats,
  useToggleListingChecklist,
  useToggleRunwayItem,
  useUpdateRunwayItem,
  type RunwayDraft,
} from "./queries";
import type {
  Call,
  CallTier,
  Listing,
  Moment,
  RunwayItem,
  StatusBarStats,
} from "./fixtures";

const STATUSBAR_DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Phoenix",
});
const BRAND_DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Phoenix",
});

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

function StatusBar({ stats }: { stats: StatusBarStats | undefined }) {
  const now = useMemo(() => new Date(), []);
  const dateLong = STATUSBAR_DATE_FMT.format(now);
  const dateShort = BRAND_DATE_FMT.format(now);
  const v = (n: number | undefined) => (n == null ? "--" : String(n));
  const cold = stats?.coldTierA ?? 0;
  return (
    <div className={styles.statusbar}>
      <div className={styles.brandCell}>
        <div className={styles.brandMark}>GAT&middot;BOS</div>
        <div className={styles.brandSub}>Today &middot; {dateShort}</div>
      </div>
      <div className={styles.statusStats}>
        <div className={styles.stat}>
          <span className={styles.statLbl}>Yest. Calls</span>
          <span className={styles.statVal}>{v(stats?.yestCalls)}</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={styles.statLbl}>Files Closed</span>
          <span className={styles.statVal}>{v(stats?.filesClosed)}</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={styles.statLbl}>New Listings</span>
          <span className={styles.statVal}>{v(stats?.newListings)}</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={styles.statLbl}>Open Actions</span>
          <span className={styles.statVal}>{v(stats?.openActions)}</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={styles.statLbl}>Cold Tier-A</span>
          <span className={`${styles.statVal} ${cold > 0 ? styles.statValCold : ""}`}>{v(stats?.coldTierA)}</span>
        </div>
      </div>
      <div className={styles.statusRight}>
        <span className={styles.statusDate}>{dateLong}</span>
        <span className={styles.statusBrief}>Brief No. 117</span>
        <span className={styles.tempPill}>
          <span className={styles.tempDot} />
          <span className={styles.tempLbl}>Temp</span>
          <span className={styles.tempVal}>72</span>
        </span>
      </div>
    </div>
  );
}

const TIER_CLASS: Record<CallTier, string> = {
  overdue: styles.callRowOverdue,
  due: styles.callRowDue,
  up: styles.callRowUp,
};

const AVATAR_TIER_CLASS: Record<CallTier, string> = {
  overdue: styles.avatarOverdue,
  due: styles.avatarDue,
  up: "",
};

function CallRow({ p }: { p: Call }) {
  const initial = p.name.charAt(0);
  return (
    <div className={`${styles.callRow} ${TIER_CLASS[p.tier]}`}>
      <div className={`${styles.avatar} ${AVATAR_TIER_CLASS[p.tier]}`}>{initial}</div>
      <div className={styles.callBody}>
        <div className={styles.callName}>{p.name}</div>
        <div className={styles.callMeta}>
          <span>Last touch</span>
          <span className={styles.callMetaDot} />
          <span>{p.last}</span>
        </div>
        <div className={styles.callSuggest}>{p.suggest}</div>
      </div>
      <div className={styles.callActions}>
        <button type="button" className={styles.iconBtn} title="Log touch" aria-label="Log touch">
          <PenIcon />
        </button>
        <button type="button" className={styles.iconBtn} title="Queue call" aria-label="Queue call">
          <PhoneIcon />
        </button>
      </div>
    </div>
  );
}

function CallsLane() {
  const { data, isLoading, error } = useCallsLane();
  const calls = data?.calls;
  const totalQueued =
    (calls?.overdue.length ?? 0) +
    (calls?.due.length ?? 0) +
    (calls?.up.length ?? 0);

  return (
    <>
      <div className={styles.colHead}>
        <h2>Calls &amp; Follow-ups</h2>
        <span className={styles.colMeta}>
          {isLoading ? "loading..." : `${totalQueued} queued`}
        </span>
      </div>

      {error ? (
        <div className={styles.colMeta}>Failed to load calls.</div>
      ) : null}

      <div className={styles.tierGroup}>
        <div className={styles.tierHead}>
          <span className={`${styles.tierLabel} ${styles.tierLabelOverdue}`}>Overdue</span>
          <span className={styles.tierCount}>{calls?.overdue.length ?? 0}</span>
        </div>
        {calls?.overdue.length ? (
          calls.overdue.map((p, i) => <CallRow key={`overdue-${i}`} p={p} />)
        ) : !isLoading ? (
          <div className={styles.colMeta}>No overdue contacts.</div>
        ) : null}
      </div>

      <div className={styles.tierGroup}>
        <div className={styles.tierHead}>
          <span className={`${styles.tierLabel} ${styles.tierLabelDue}`}>Due Today</span>
          <span className={styles.tierCount}>{calls?.due.length ?? 0}</span>
        </div>
        {calls?.due.length ? (
          calls.due.map((p, i) => <CallRow key={`due-${i}`} p={p} />)
        ) : !isLoading ? (
          <div className={styles.colMeta}>Nothing due today.</div>
        ) : null}
      </div>

      <div className={styles.tierGroup}>
        <div className={styles.tierHead}>
          <span className={`${styles.tierLabel} ${styles.tierLabelUp}`}>Coming Up</span>
          <span className={styles.tierCount}>{calls?.up.length ?? 0}</span>
        </div>
        {calls?.up.length ? (
          calls.up.map((p, i) => <CallRow key={`up-${i}`} p={p} />)
        ) : !isLoading ? (
          <div className={styles.colMeta}>Nothing coming up.</div>
        ) : null}
      </div>
    </>
  );
}

function Avatar({ kind, who }: { kind: RunwayItem["kind"]; who: string }) {
  if (kind === "system") {
    return <div className={`${styles.ava} ${styles.avaSystem}`}>&middot;</div>;
  }
  return <div className={`${styles.ava} ${styles.avaTierA}`}>{who.charAt(0) || "?"}</div>;
}

function Priority({ level, tone }: { level: number; tone: RunwayItem["tone"] }) {
  return (
    <span className={styles.priority}>
      {[0, 1, 2].map((i) => (
        <i key={i} className={i < level ? (tone === "crimson" ? "on" : "warm") : ""} />
      ))}
    </span>
  );
}

type RunwayKind = RunwayItem["kind"];
const RUNWAY_KINDS: RunwayKind[] = ["system", "tier-a", "draft", "touchpoint"];

function RunwayEditor({
  item,
  onSave,
  onCancel,
}: {
  item: RunwayItem;
  onSave: (patch: { title: string; context: RunwayDraft }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item.what);
  const [who, setWho] = useState(item.who ?? "");
  const [kind, setKind] = useState<RunwayKind>(item.kind);
  const [priority, setPriority] = useState<0 | 1 | 2 | 3>(item.priority);
  const [tone, setTone] = useState<"gold" | "crimson">(item.tone);
  const [action, setAction] = useState(item.action ?? "Open");
  const [href, setHref] = useState(item.href ?? "");

  const submit = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      context: {
        title: title.trim(),
        who: who.trim() || undefined,
        kind,
        priority,
        tone,
        action: action.trim() || undefined,
        href: href.trim() || undefined,
      },
    });
  };

  return (
    <div className={styles.runwayEditor} onClick={(e) => e.stopPropagation()}>
      <div className={styles.runwayEditorRow}>
        <input
          className={styles.runwayEditInput}
          value={title}
          autoFocus
          placeholder="Title"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onCancel();
          }}
        />
        <input
          className={styles.runwayEditInput}
          value={who}
          placeholder="Who"
          onChange={(e) => setWho(e.target.value)}
        />
      </div>
      <div className={styles.runwayEditorRow}>
        <span className={styles.runwayEditLbl}>Priority</span>
        <div className={styles.priorityPills}>
          {[0, 1, 2, 3].map((p) => (
            <button
              key={p}
              type="button"
              className={`${styles.priorityPill} ${priority === p ? styles.priorityPillOn : ""}`}
              onClick={() => setPriority(p as 0 | 1 | 2 | 3)}
            >
              {p}
            </button>
          ))}
        </div>
        <span className={styles.runwayEditLbl}>Tone</span>
        <div className={styles.priorityPills}>
          <button
            type="button"
            className={`${styles.priorityPill} ${tone === "gold" ? styles.priorityPillOn : ""}`}
            onClick={() => setTone("gold")}
          >
            Gold
          </button>
          <button
            type="button"
            className={`${styles.priorityPill} ${tone === "crimson" ? styles.priorityPillOn : ""}`}
            onClick={() => setTone("crimson")}
          >
            Crimson
          </button>
        </div>
        <span className={styles.runwayEditLbl}>Kind</span>
        <select
          className={styles.runwayEditSelect}
          value={kind}
          onChange={(e) => setKind(e.target.value as RunwayKind)}
        >
          {RUNWAY_KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>
      <div className={styles.runwayEditorRow}>
        <input
          className={styles.runwayEditInput}
          value={action}
          placeholder="Action label (e.g. Open)"
          onChange={(e) => setAction(e.target.value)}
        />
        <input
          className={styles.runwayEditInput}
          value={href}
          placeholder="Link href (optional)"
          onChange={(e) => setHref(e.target.value)}
        />
      </div>
      <div className={styles.runwayEditorActions}>
        <button type="button" className={styles.btnMini} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGold}`}
          onClick={submit}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function RunwayRow({
  idx,
  item,
  done,
  onToggle,
  onEdit,
  onDelete,
  isEditing,
  onSaveEdit,
  onCancelEdit,
}: {
  idx: number;
  item: RunwayItem;
  done: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
  onSaveEdit: (patch: { title: string; context: RunwayDraft }) => void;
  onCancelEdit: () => void;
}) {
  const sortable = useSortable({ id: item.id ?? `tmp-${idx}` });
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortable;

  const style = {
    transform: transformToCss(transform as DndTransform | null),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  } as const;

  const rowClass = [
    styles.runwayRow,
    done ? styles.runwayRowDone : "",
    item.tone === "crimson" ? styles.runwayRowHot : "",
    isEditing ? styles.runwayRowEditing : "",
  ]
    .filter(Boolean)
    .join(" ");
  const btnClass = `${styles.btn} ${item.tone === "crimson" ? styles.btnCrimson : styles.btnGold}`;

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className={rowClass}>
        <RunwayEditor
          item={item}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={rowClass}
      onClick={onToggle}
      role="button"
      tabIndex={0}
    >
      <button
        type="button"
        className={styles.runwayDragHandle}
        title="Drag to reorder"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripIcon />
      </button>
      <span className={styles.runwayNum}>{String(idx + 1).padStart(2, "0")}</span>
      <span className={styles.check} />
      <div className={styles.who}>
        <Avatar kind={item.kind} who={item.who} />
        <span className={styles.whoName}>{item.who}</span>
      </div>
      <div className={styles.what}>{item.what}</div>
      <Priority level={item.priority} tone={item.tone} />
      {item.href ? (
        <Link
          href={item.href}
          className={btnClass}
          onClick={(e) => e.stopPropagation()}
        >
          {item.action}&nbsp;&rarr;
        </Link>
      ) : (
        <button
          type="button"
          className={btnClass}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {item.action}&nbsp;&rarr;
        </button>
      )}
      <div className={styles.runwayRowActions}>
        <button
          type="button"
          className={styles.iconBtn}
          title="Edit"
          aria-label="Edit item"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <PenIcon />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          title="Delete"
          aria-label="Delete item"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function AddRunwayRow({ onAdd }: { onAdd: (draft: RunwayDraft) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [who, setWho] = useState("");
  const [kind, setKind] = useState<RunwayKind>("tier-a");
  const [priority, setPriority] = useState<0 | 1 | 2 | 3>(1);
  const [tone, setTone] = useState<"gold" | "crimson">("gold");
  const [action, setAction] = useState("Open");
  const [href, setHref] = useState("");

  const reset = () => {
    setTitle("");
    setWho("");
    setKind("tier-a");
    setPriority(1);
    setTone("gold");
    setAction("Open");
    setHref("");
  };

  const submit = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      who: who.trim() || undefined,
      kind,
      priority,
      tone,
      action: action.trim() || undefined,
      href: href.trim() || undefined,
    });
    reset();
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        className={styles.addRunwayRow}
        onClick={() => setOpen(true)}
      >
        + Add item
      </button>
    );
  }

  return (
    <div className={styles.runwayEditor}>
      <div className={styles.runwayEditorRow}>
        <input
          className={styles.runwayEditInput}
          value={title}
          autoFocus
          placeholder="Title"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") {
              reset();
              setOpen(false);
            }
          }}
        />
        <input
          className={styles.runwayEditInput}
          value={who}
          placeholder="Who"
          onChange={(e) => setWho(e.target.value)}
        />
      </div>
      <div className={styles.runwayEditorRow}>
        <span className={styles.runwayEditLbl}>Priority</span>
        <div className={styles.priorityPills}>
          {[0, 1, 2, 3].map((p) => (
            <button
              key={p}
              type="button"
              className={`${styles.priorityPill} ${priority === p ? styles.priorityPillOn : ""}`}
              onClick={() => setPriority(p as 0 | 1 | 2 | 3)}
            >
              {p}
            </button>
          ))}
        </div>
        <span className={styles.runwayEditLbl}>Tone</span>
        <div className={styles.priorityPills}>
          <button
            type="button"
            className={`${styles.priorityPill} ${tone === "gold" ? styles.priorityPillOn : ""}`}
            onClick={() => setTone("gold")}
          >
            Gold
          </button>
          <button
            type="button"
            className={`${styles.priorityPill} ${tone === "crimson" ? styles.priorityPillOn : ""}`}
            onClick={() => setTone("crimson")}
          >
            Crimson
          </button>
        </div>
        <span className={styles.runwayEditLbl}>Kind</span>
        <select
          className={styles.runwayEditSelect}
          value={kind}
          onChange={(e) => setKind(e.target.value as RunwayKind)}
        >
          {RUNWAY_KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>
      <div className={styles.runwayEditorRow}>
        <input
          className={styles.runwayEditInput}
          value={action}
          placeholder="Action label (e.g. Open)"
          onChange={(e) => setAction(e.target.value)}
        />
        <input
          className={styles.runwayEditInput}
          value={href}
          placeholder="Link href (optional)"
          onChange={(e) => setHref(e.target.value)}
        />
      </div>
      <div className={styles.runwayEditorActions}>
        <button
          type="button"
          className={styles.btnMini}
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGold}`}
          onClick={submit}
          disabled={!title.trim()}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function Runway({
  items,
  onToggle,
  onReset,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  loading,
}: {
  items: RunwayItem[];
  onToggle: (item: RunwayItem) => void;
  onReset: () => void;
  onAdd: (draft: RunwayDraft) => void;
  onEdit: (id: string, patch: { title: string; context: RunwayDraft }) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  loading: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const ids = items.map((it) => it.id ?? "").filter(Boolean);
  const clearedCount = items.filter((i) => !!i.completed_at).length;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    onReorder(next);
  };

  return (
    <div>
      <div className={styles.colHead} style={{ marginBottom: 12 }}>
        <h2>Priority Runway</h2>
        <span className={styles.colMeta}>
          {loading ? (
            "loading..."
          ) : (
            <>
              <b>{clearedCount}</b>
              &thinsp;/&thinsp;{items.length} cleared
            </>
          )}
        </span>
      </div>
      <div className={styles.runway}>
        {items.length === 0 && !loading ? (
          <div className={styles.colMeta}>Inbox empty. Nothing on the runway.</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={ids}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item, i) => (
                <RunwayRow
                  key={item.id ?? `${item.kind}-${i}-${item.who}`}
                  idx={i}
                  item={item}
                  done={!!item.completed_at}
                  onToggle={() => onToggle(item)}
                  onEdit={() => item.id && setEditingId(item.id)}
                  onDelete={() => item.id && onDelete(item.id)}
                  isEditing={!!item.id && editingId === item.id}
                  onSaveEdit={(patch) => {
                    if (item.id) onEdit(item.id, patch);
                    setEditingId(null);
                  }}
                  onCancelEdit={() => setEditingId(null)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
        <AddRunwayRow onAdd={onAdd} />
        <div className={styles.runwayFoot}>
          <span>Top-down. Light to heavy. Work in order.</span>
          <button type="button" className={styles.btnMini} onClick={onReset}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function ListingCard({
  card,
  onToggle,
}: {
  card: Listing;
  onToggle: (idx: number) => void;
}) {
  const allDone = card.done.every(Boolean);
  const cardClass = [
    styles.listingCard,
    allDone ? styles.listingCardComplete : "",
  ]
    .filter(Boolean)
    .join(" ");
  const avaClass = `${styles.lcAva} ${card.tier === "B" ? styles.lcAvaTierB : ""}`;
  const tagClass = `${styles.tierTag} ${card.tier === "B" ? styles.tierTagB : ""}`;
  return (
    <div className={cardClass}>
      <div className={styles.lcHead}>
        <div className={avaClass}>{card.agent.charAt(0) || "?"}</div>
        <div className={styles.lcName}>{card.agent}</div>
        <div className={tagClass}>Tier {card.tier}</div>
      </div>
      <div className={styles.lcProperty}>
        <div className={styles.lcAddr}>{card.addr}</div>
        <div className={styles.lcDays}>
          live <span className={styles.lcDaysNum}>{card.days}</span> day{card.days === 1 ? "" : "s"}
        </div>
      </div>
      <div className={styles.checklist}>
        {card.items.map((label, i) => {
          const itemClass = `${styles.checkItem} ${card.done[i] ? styles.checkItemOn : ""}`;
          return (
            <button type="button" key={i} className={itemClass} onClick={() => onToggle(i)}>
              <span className={styles.checkBox} />
              <span className={styles.checkLabel}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListingActivity({
  listings,
  onToggle,
  loading,
}: {
  listings: Listing[];
  onToggle: (card: Listing, idx: number) => void;
  loading: boolean;
}) {
  const visibleCount = listings.filter((l) => !l.done.every(Boolean)).length;
  return (
    <div>
      <div className={styles.colHead} style={{ marginBottom: 12 }}>
        <h2>Listing Activity</h2>
        <span className={styles.colMeta}>
          {loading
            ? "loading..."
            : `${visibleCount} open · ${listings.length - visibleCount} complete`}
        </span>
      </div>
      <div className={styles.listingGrid}>
        {listings.length === 0 && !loading ? (
          <div className={styles.colMeta}>No active listings.</div>
        ) : (
          listings.map((card, ci) => (
            <ListingCard
              key={card.listing_id ?? ci}
              card={card}
              onToggle={(idx) => onToggle(card, idx)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function GCalendar() {
  const src =
    "https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FPhoenix&mode=AGENDA&showTitle=0&showNav=0&showDate=0&showPrint=0&showTabs=0&showCalendars=0&showTz=0&hl=en";
  return (
    <div className={styles.gcalWrap}>
      <div className={styles.gcalHead}>
        <div className={styles.gcalHeadL}>
          <span className={styles.liveDot} />
          <span className={styles.gcalTitle}>Calendar</span>
        </div>
        <span className={`${styles.eyebrow} ${styles.eyebrowLive}`}>Live</span>
      </div>
      <div className={styles.gcalFrameWrap}>
        <iframe src={src} title="Google Calendar" loading="lazy" />
        <div className={styles.gcalFallback} />
      </div>
    </div>
  );
}

function Moments({ moments, loading }: { moments: Moment[]; loading: boolean }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.eyebrow}>Recent Moments</span>
        <button type="button" className={styles.btnMini}>
          + Log
        </button>
      </div>
      <div className={styles.momentsList}>
        {loading ? (
          <div className={styles.colMeta}>loading...</div>
        ) : moments.length === 0 ? (
          <div className={styles.colMeta}>No recent activity.</div>
        ) : (
          moments.map((m, i) => (
            <div key={i} className={styles.moment}>
              <span className={styles.momentBadge}>{m.kind}</span>
              <span className={styles.momentBody}>
                <span className={styles.momentMeta}>
                  {m.meta} &middot; <b>{m.who}</b>
                </span>
                <span className={styles.momentWhat}>{m.what}</span>
              </span>
              <span className={styles.momentWhen}>{m.when}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function TodayV2Client() {
  const stats = useStatusBarStats();
  const runway = useRunway();
  const listingsQ = useListings();
  const moments = useMoments();
  const toggleRunway = useToggleRunwayItem();
  const resetRunway = useResetRunway();
  const addRunway = useAddRunwayItem();
  const updateRunway = useUpdateRunwayItem();
  const deleteRunway = useSoftDeleteRunwayItem();
  const reorderRunway = useReorderRunwayItems();
  const toggleChecklist = useToggleListingChecklist();

  const onToggleRunway = (item: RunwayItem) => {
    if (!item.id) return;
    toggleRunway.mutate({ id: item.id, done: !item.completed_at });
  };

  const onToggleChecklist = (card: Listing, idx: number) => {
    if (!card.listing_id) return;
    const next = !card.done[idx];
    toggleChecklist.mutate({ listing_id: card.listing_id, idx, next });
  };

  return (
    <div className={styles.app}>
      <StatusBar stats={stats.data} />
      <div className={styles.cols}>
        <aside className={styles.col}>
          <CallsLane />
        </aside>
        <main className={styles.col}>
          <Runway
            items={runway.data ?? []}
            onToggle={onToggleRunway}
            onReset={() => resetRunway.mutate()}
            onAdd={(draft) => addRunway.mutate(draft)}
            onEdit={(id, patch) =>
              updateRunway.mutate({
                id,
                patch: {
                  title: patch.title,
                  context: {
                    who: patch.context.who,
                    kind: patch.context.kind,
                    priority: patch.context.priority,
                    tone: patch.context.tone,
                    action: patch.context.action,
                    href: patch.context.href,
                  },
                },
              })
            }
            onDelete={(id) => deleteRunway.mutate({ id })}
            onReorder={(orderedIds) => reorderRunway.mutate({ orderedIds })}
            loading={runway.isLoading}
          />
          <ListingActivity
            listings={listingsQ.data ?? []}
            onToggle={onToggleChecklist}
            loading={listingsQ.isLoading}
          />
        </main>
        <aside className={styles.col}>
          <GCalendar />
          <Moments moments={moments.data ?? []} loading={moments.isLoading} />
        </aside>
      </div>
    </div>
  );
}
