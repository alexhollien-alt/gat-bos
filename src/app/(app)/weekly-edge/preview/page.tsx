import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  AccentRule,
  EditorialHero,
  PageHeader,
  SectionShell,
  type StatRailItem,
} from "@/components/screen";
import { PreviewFrame } from "./preview-frame";

export const dynamic = "force-dynamic";

const WEEKLY_EDGE_DIR =
  "/Users/alex/Documents/Alex Hub/Alex Hollien CRM Build/Email Templates/Weekly Edge";

interface Issue {
  filename: string;
  isoDate: string;
  html: string;
  mtime: Date;
}

async function loadCurrentIssue(): Promise<Issue | null> {
  try {
    const files = await readdir(WEEKLY_EDGE_DIR);
    const issues = files
      .filter((f) => /^the-weekly-edge-\d{4}-\d{2}-\d{2}\.html$/.test(f))
      .sort()
      .reverse();
    if (issues.length === 0) return null;
    const filename = issues[0];
    const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
    if (!match) return null;
    const filepath = path.join(WEEKLY_EDGE_DIR, filename);
    const html = await readFile(filepath, "utf8");
    const st = await stat(filepath);
    return { filename, isoDate: match[1], html, mtime: st.mtime };
  } catch {
    return null;
  }
}

function parseStats(html: string) {
  const bodyText = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = bodyText.split(" ").filter((w) => /[a-z0-9]/i.test(w)).length;
  const imageCount = (html.match(/<img\b[^>]*>/gi) ?? []).length;
  return { wordCount, imageCount };
}

function formatLongDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthDay(isoDate: string) {
  const [, m, d] = isoDate.split("-");
  return `${m}/${d}`;
}

function formatRelative(date: Date) {
  const deltaMs = Date.now() - date.getTime();
  const minutes = Math.round(deltaMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default async function WeeklyEdgePreviewPage() {
  const issue = await loadCurrentIssue();

  if (!issue) {
    return (
      <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0 max-w-4xl mx-0">
        <PageHeader
          eyebrow="This week"
          title="The Weekly Edge"
          subhead="No issue file found. Generate this week's Weekly Edge first — then refresh."
        />
        <AccentRule variant="hairline" className="mt-6" />
      </SectionShell>
    );
  }

  const stats = parseStats(issue.html);
  const longDate = formatLongDate(issue.isoDate);
  const monthDay = formatMonthDay(issue.isoDate);

  const statItems: StatRailItem[] = [
    { stat: monthDay, label: "Issue" },
    { stat: stats.imageCount.toString(), label: "Images" },
    { stat: stats.wordCount.toLocaleString(), label: "Words" },
    { stat: formatRelative(issue.mtime), label: "Saved" },
  ];

  return (
    <>
      <div className="-mx-6 -mt-6 mb-10">
        <EditorialHero
          eyebrow="This week"
          title="The Weekly Edge"
          subhead={longDate}
          stats={statItems}
        />
      </div>

      <div className="mx-auto max-w-[720px]">
        <PreviewFrame html={issue.html} />
        <p className="mt-4 text-center font-mono uppercase text-micro tracking-label text-muted-foreground">
          Source · {issue.filename}
        </p>
      </div>
    </>
  );
}
