import { Toaster } from "@/components/ui/sonner";
import { AccentRule, Eyebrow, ShowcaseBackdrop, StatRail } from "@/components/screen";

export const metadata = {
  title: "Your Marketing Advantage -- Alex Hollien | Great American Title",
  description: "Full-service marketing, data, and transaction support for Arizona real estate agents",
};

const HERO_STATS = [
  { stat: "50+", label: "Agent Partners" },
  { stat: "2+", label: "Years in Title" },
  { stat: "11", label: "Offices Valley-Wide" },
  { stat: "#1", label: "Ranked 17 Years" },
];

export default function IntakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "var(--surface-base)" }}>
      {/* Header */}
      <ShowcaseBackdrop image="/az-sunset.jpg" imageOpacity={0.12} imagePosition="center 30%" overlayOpacity={0.6}>
        <div className="relative max-w-5xl mx-auto px-6 sm:px-8">
          {/* Top bar: GAT logo */}
          <div className="flex items-center py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/gat-logo-white.png"
              alt="Great American Title Agency"
              className="h-7 sm:h-9 w-auto opacity-50"
            />
          </div>

          <div className="h-[1px] bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-transparent" />

          {/* Hero: Alex hero image left, tagline right -- matched height */}
          <div className="flex flex-col sm:flex-row items-stretch gap-0 py-6 sm:py-8">
            {/* Left: Hero headshot */}
            <div className="flex-shrink-0 w-full sm:w-[200px] relative">
              <div className="h-[240px] sm:h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/alex-hero.jpg"
                  alt="Alex Hollien"
                  className="h-full w-full object-cover object-top headshot-mask-hero"
                />
              </div>
            </div>

            {/* Right: positioning text -- fills to match image height */}
            <div className="flex-1 flex flex-col justify-center sm:pl-8 pt-6 sm:pt-0">
              <div className="mb-4">
                <Eyebrow tone="crimson" className="text-[10px] tracking-[0.3em] opacity-80">
                  Built For Agents
                </Eyebrow>
              </div>
              <h1 className="font-display text-[28px] sm:text-[38px] text-white leading-[1.08] mb-4 tracking-[-0.02em]">
                Behind every great agent
                <br className="hidden sm:block" />
                is the team behind them
              </h1>
              <p className="font-sans text-[13px] sm:text-[14px] text-white/25 leading-[1.8] max-w-md mb-6">
                Full-service design, print production, data tools, and
                hands-on transaction support -- all included when you
                close with Great American Title.
              </p>

              {/* Name + contact */}
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="font-display text-[18px] sm:text-[20px] text-white leading-tight tracking-[-0.01em]">
                    Alex Hollien
                  </h2>
                  <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-[color:var(--accent-red)]/50 font-semibold mt-0.5">
                    Title Sales Executive &nbsp;&bull;&nbsp; Phoenix Valley
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 ml-auto">
                  <a
                    href="tel:+14802042983"
                    className="font-sans text-[10px] text-white/20 hover:text-white/50 transition-colors"
                  >
                    (480) 204-2983
                  </a>
                  <span className="text-white/8 text-[8px]">&bull;</span>
                  <a
                    href="mailto:alex@alexhollienco.com"
                    className="font-sans text-[10px] text-white/20 hover:text-white/50 transition-colors"
                  >
                    alex@alexhollienco.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Stats bar -- underneath hero */}
          <StatRail items={HERO_STATS} size="md" />
        </div>

        {/* Bottom accent bar */}
        <AccentRule variant="primary" />
      </ShowcaseBackdrop>

      {/* Content */}
      <main className="relative max-w-5xl mx-auto px-6 sm:px-8 py-10 sm:py-14" style={{ color: "var(--surface-muted)" }}>
        {children}
      </main>

      {/* Footer */}
      <footer className="relative pb-10 text-center">
        <div className="max-w-5xl mx-auto px-6 sm:px-8">
          <div className="h-[1px] bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent mb-6" />
          <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.15em] uppercase">
            Title &amp; Escrow Services Provided by Great American Title Agency
          </p>
        </div>
      </footer>

      <Toaster position="bottom-right" />
    </div>
  );
}
