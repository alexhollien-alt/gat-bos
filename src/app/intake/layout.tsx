import { Toaster } from "@/components/ui/sonner";

export const metadata = {
  title: "Your Marketing Advantage -- Alex Hollien | Great American Title",
  description: "Full-service marketing, data, and transaction support for Arizona real estate agents",
};

export default function IntakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen relative bg-[#faf9f7]">
      {/* Google Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Montserrat:wght@300;400;500;600;700&display=swap"
      />

      {/* Self Deception font for signature */}
      <style>{`
        @font-face {
          font-family: 'Self Deception';
          src: url('/fonts/SelfDeception.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
      `}</style>

      {/* Header */}
      <header
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0c0c0c 0%, #141414 40%, #0e0e0e 100%)" }}
      >
        {/* Arizona sunset mid-layer */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.12]"
          style={{
            backgroundImage: "url('/az-sunset.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
          }}
        />
        {/* Dark overlay to keep text legible */}
        <div className="absolute inset-0 pointer-events-none bg-black/60" />
        {/* Rich layered gradients */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 90% 10%, rgba(179,26,53,0.16) 0%, transparent 50%),
              radial-gradient(ellipse at 5% 95%, rgba(0,48,135,0.14) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.012) 0%, transparent 70%)
            `,
          }}
        />
        {/* Noise */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

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
              <div className="h-[240px] sm:h-full rounded-2xl overflow-hidden ring-1 ring-white/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/alex-hero.jpg"
                  alt="Alex Hollien"
                  className="h-full w-full object-cover object-top"
                />
              </div>
            </div>

            {/* Right: positioning text -- fills to match image height */}
            <div className="flex-1 flex flex-col justify-center sm:pl-8 pt-6 sm:pt-0">
              <p
                className="text-[10px] uppercase tracking-[0.3em] text-[#b31a35] font-semibold mb-4 opacity-80"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                Built For Agents
              </p>
              <h1
                className="text-[28px] sm:text-[38px] text-white leading-[1.08] mb-4 tracking-[-0.02em]"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Behind every great agent
                <br className="hidden sm:block" />
                is the team behind them
              </h1>
              <p
                className="text-[13px] sm:text-[14px] text-white/25 leading-[1.8] max-w-md mb-6"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                Full-service design, print production, data tools, and
                hands-on transaction support -- all included when you
                close with Great American Title.
              </p>

              {/* Name + contact */}
              <div className="flex items-center gap-4">
                <div>
                  <h2
                    className="text-[18px] sm:text-[20px] text-white leading-tight tracking-[-0.01em]"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Alex Hollien
                  </h2>
                  <p
                    className="text-[8px] uppercase tracking-[0.2em] text-[#b31a35]/50 font-semibold mt-0.5"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    Title Sales Executive &nbsp;&bull;&nbsp; Phoenix Valley
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 ml-auto">
                  <a
                    href="tel:+14802042983"
                    className="text-[10px] text-white/20 hover:text-white/50 transition-colors"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    (480) 204-2983
                  </a>
                  <span className="text-white/8 text-[8px]">&bull;</span>
                  <a
                    href="mailto:alex@alexhollienco.com"
                    className="text-[10px] text-white/20 hover:text-white/50 transition-colors"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    alex@alexhollienco.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Stats bar -- underneath hero */}
          <div className="flex items-center justify-center gap-8 sm:gap-14 py-5 border-t border-white/[0.06]">
            {[
              { stat: "50+", label: "Agent Partners" },
              { stat: "2+", label: "Years in Title" },
              { stat: "11", label: "Offices Valley-Wide" },
              { stat: "#1", label: "Ranked 17 Years" },
            ].map((item) => (
              <div key={item.label} className="flex items-baseline gap-1.5 text-center">
                <span
                  className="text-[20px] sm:text-[24px] text-white/80 leading-none tracking-[-0.02em]"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {item.stat}
                </span>
                <span
                  className="text-[8px] sm:text-[9px] text-white/30 uppercase tracking-[0.12em] font-medium"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom accent bar */}
        <div
          className="h-[3px]"
          style={{ background: "linear-gradient(90deg, #b31a35 0%, #b31a35 30%, #003087 100%)" }}
        />
      </header>

      {/* Content */}
      <main className="relative max-w-5xl mx-auto px-6 sm:px-8 py-10 sm:py-14">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative pb-10 text-center">
        <div className="max-w-5xl mx-auto px-6 sm:px-8">
          <div className="h-[1px] bg-gradient-to-r from-transparent via-[#ddd8d0] to-transparent mb-6" />
          <p
            className="text-[10px] text-[#999] tracking-[0.15em] uppercase"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Title & Escrow Services Provided by Great American Title Agency
          </p>
        </div>
      </footer>

      <Toaster position="bottom-right" />

      <style>{`
        @keyframes intake-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .intake-animate-in {
          animation: intake-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
