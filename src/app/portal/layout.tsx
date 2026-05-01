import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Portal · Great American Title Agency",
  description:
    "Agent partner portal for marketing requests, events, and messages.",
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-display text-lg font-semibold tracking-tight text-zinc-100">
            Partner Portal
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Great American Title
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {children}
      </main>

      <footer className="border-t border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>GAT Partner Portal</span>
          <span>Powered by Great American Title Agency</span>
        </div>
      </footer>
    </div>
  );
}
