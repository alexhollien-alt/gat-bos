import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { AccentRule } from "./accent-rule";
import { Eyebrow, type EyebrowTone } from "./eyebrow";
import { ShowcaseBackdrop } from "./showcase-backdrop";
import { StatRail, type StatRailItem } from "./stat-rail";

interface EditorialHeroImage {
  src: string;
  alt: string;
  className?: string;
}

interface EditorialHeroProps {
  image?: EditorialHeroImage;
  eyebrow?: ReactNode;
  eyebrowTone?: EyebrowTone;
  title: ReactNode;
  subhead?: ReactNode;
  right?: ReactNode;
  stats?: StatRailItem[];
  accentRule?: boolean;
  backdropImage?: string;
  topSlot?: ReactNode;
  meta?: ReactNode;
  className?: string;
  containerClassName?: string;
  children?: ReactNode;
}

export function EditorialHero({
  image,
  eyebrow,
  eyebrowTone = "crimson",
  title,
  subhead,
  right,
  stats,
  accentRule = true,
  backdropImage,
  topSlot,
  meta,
  className,
  containerClassName,
  children,
}: EditorialHeroProps) {
  return (
    <ShowcaseBackdrop image={backdropImage} className={className}>
      <div className={cn("relative max-w-5xl mx-auto px-6 sm:px-8", containerClassName)}>
        {topSlot ? (
          <>
            <div className="flex items-center py-4">{topSlot}</div>
            <div className="h-px bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-transparent" />
          </>
        ) : null}

        <div className="flex flex-col sm:flex-row items-stretch gap-0 py-6 sm:py-8">
          {image ? (
            <div className="flex-shrink-0 w-full sm:w-[200px] relative">
              <div className="h-[240px] sm:h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.src}
                  alt={image.alt}
                  className={cn("h-full w-full object-cover object-top headshot-mask-hero", image.className)}
                />
              </div>
            </div>
          ) : null}

          <div className={cn("flex-1 flex flex-col justify-center pt-6 sm:pt-0", image && "sm:pl-8")}>
            {eyebrow ? (
              <div className="mb-4 opacity-80">
                <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow>
              </div>
            ) : null}
            <h1 className="font-display text-[28px] sm:text-[38px] text-white leading-[1.08] mb-4 tracking-[-0.02em]">
              {title}
            </h1>
            {subhead ? (
              <p className="font-sans text-[13px] sm:text-[14px] text-white/25 leading-[1.8] max-w-md mb-6">
                {subhead}
              </p>
            ) : null}
            {meta ? <div className="flex items-center gap-4">{meta}</div> : null}
            {right ? <div className="mt-6">{right}</div> : null}
          </div>
        </div>

        {stats ? <StatRail items={stats} /> : null}
        {children}
      </div>

      {accentRule ? <AccentRule variant="primary" /> : null}
    </ShowcaseBackdrop>
  );
}
