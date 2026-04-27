"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./styles.module.css";
import {
  useCallsLane,
  useListings,
  useMoments,
  useRunway,
  useStatusBarStats,
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

function RunwayRow({
  idx,
  item,
  done,
  onToggle,
}: {
  idx: number;
  item: RunwayItem;
  done: boolean;
  onToggle: () => void;
}) {
  const rowClass = [
    styles.runwayRow,
    done ? styles.runwayRowDone : "",
    item.tone === "crimson" ? styles.runwayRowHot : "",
  ]
    .filter(Boolean)
    .join(" ");
  const btnClass = `${styles.btn} ${item.tone === "crimson" ? styles.btnCrimson : styles.btnGold}`;
  return (
    <div className={rowClass} onClick={onToggle} role="button" tabIndex={0}>
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
    </div>
  );
}

function Runway({
  items,
  doneSet,
  onToggle,
  onReset,
  loading,
}: {
  items: RunwayItem[];
  doneSet: Set<number>;
  onToggle: (i: number) => void;
  onReset: () => void;
  loading: boolean;
}) {
  return (
    <div>
      <div className={styles.colHead} style={{ marginBottom: 12 }}>
        <h2>Priority Runway</h2>
        <span className={styles.colMeta}>
          {loading ? (
            "loading..."
          ) : (
            <>
              <b>{doneSet.size}</b>
              &thinsp;/&thinsp;{items.length} cleared
            </>
          )}
        </span>
      </div>
      <div className={styles.runway}>
        {items.length === 0 && !loading ? (
          <div className={styles.colMeta}>Inbox empty. Nothing on the runway.</div>
        ) : (
          items.map((item, i) => (
            <RunwayRow
              key={`${item.kind}-${i}-${item.who}`}
              idx={i}
              item={item}
              done={doneSet.has(i)}
              onToggle={() => onToggle(i)}
            />
          ))
        )}
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
  setListings,
  loading,
}: {
  listings: Listing[];
  setListings: React.Dispatch<React.SetStateAction<Listing[]>>;
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
              key={ci}
              card={card}
              onToggle={(idx) =>
                setListings((prev) =>
                  prev.map((c, j) => {
                    if (j !== ci) return c;
                    const next = c.done.slice();
                    next[idx] = !next[idx];
                    return { ...c, done: next };
                  })
                )
              }
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
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set());
  const [overrideListings, setOverrideListings] = useState<Listing[] | null>(null);

  // Live data
  const stats = useStatusBarStats();
  const runway = useRunway();
  const listingsQ = useListings();
  const moments = useMoments();

  // Local-only listing checklist mutations until Phase 3 lands.
  // useState owns the working copy once user toggles anything; otherwise mirror live data.
  const liveListings = listingsQ.data ?? [];
  const listings = overrideListings ?? liveListings;
  const setListings: React.Dispatch<React.SetStateAction<Listing[]>> = (next) => {
    setOverrideListings((prev) => {
      const base = prev ?? liveListings;
      return typeof next === "function" ? (next as (p: Listing[]) => Listing[])(base) : next;
    });
  };

  const onToggleRunway = (i: number) => {
    setDoneSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
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
            doneSet={doneSet}
            onToggle={onToggleRunway}
            onReset={() => setDoneSet(new Set())}
            loading={runway.isLoading}
          />
          <ListingActivity
            listings={listings}
            setListings={setListings}
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
