import { cn } from "@/lib/utils";
import type { ReactNode, CSSProperties } from "react";

interface ShowcaseBackdropProps {
  image?: string;
  imageOpacity?: number;
  imagePosition?: string;
  accents?: boolean;
  noise?: boolean;
  baseGradient?: string;
  overlayOpacity?: number;
  className?: string;
  children?: ReactNode;
}

const NOISE_SVG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function ShowcaseBackdrop({
  image,
  imageOpacity = 0.12,
  imagePosition = "center 30%",
  accents = true,
  noise = true,
  baseGradient = "linear-gradient(160deg, var(--surface-base) 0%, var(--surface-raised) 40%, var(--surface-base) 100%)",
  overlayOpacity = 0.6,
  className,
  children,
}: ShowcaseBackdropProps) {
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: baseGradient }}>
      {image ? (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: imageOpacity,
            backgroundImage: `url('${image}')`,
            backgroundSize: "cover",
            backgroundPosition: imagePosition,
          }}
        />
      ) : null}
      {image && overlayOpacity > 0 ? (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
        />
      ) : null}
      {accents ? (
        <div
          className="absolute inset-0 pointer-events-none"
          style={
            {
              backgroundImage: `
                radial-gradient(ellipse at 90% 10%, rgba(230,53,80,0.16) 0%, transparent 50%),
                radial-gradient(ellipse at 5% 95%, rgba(37,99,235,0.10) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.012) 0%, transparent 70%)
              `,
            } as CSSProperties
          }
        />
      ) : null}
      {noise ? (
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{ backgroundImage: NOISE_SVG }}
        />
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}
