import { AccentRule, ShowcaseBackdrop } from "@/components/screen";

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "var(--surface-base)" }}>
      <ShowcaseBackdrop image="/az-sunset.jpg" imageOpacity={0.08} imagePosition="center 30%" overlayOpacity={0.7}>
        <div className="relative max-w-5xl mx-auto px-6 sm:px-8">
          <div className="flex items-center py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/gat-logo-white.png"
              alt="Great American Title Agency"
              className="h-7 sm:h-9 w-auto opacity-50"
            />
          </div>
          <div className="h-[1px] bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-transparent" />
        </div>
        <AccentRule variant="primary" />
      </ShowcaseBackdrop>

      <main className="relative" style={{ color: "var(--surface-muted)" }}>
        {children}
      </main>

      <footer className="relative pb-10 pt-12 text-center">
        <div className="max-w-5xl mx-auto px-6 sm:px-8">
          <div className="h-[1px] bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent mb-6" />
          <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.15em] uppercase">
            Title &amp; Escrow Services Provided by Great American Title Agency
          </p>
        </div>
      </footer>
    </div>
  );
}
