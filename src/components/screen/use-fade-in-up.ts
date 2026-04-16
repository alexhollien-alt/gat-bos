"use client";

import { useEffect, useRef, useState } from "react";

export type FadeInUpVariant = "showcase" | "workspace";

interface UseFadeInUpOptions {
  variant?: FadeInUpVariant;
  delayMs?: number;
  rootMargin?: string;
  threshold?: number;
  once?: boolean;
}

export function useFadeInUp<T extends HTMLElement = HTMLDivElement>({
  variant = "showcase",
  delayMs = 0,
  rootMargin = "0px 0px -10% 0px",
  threshold = 0.1,
  once = true,
}: UseFadeInUpOptions = {}) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { rootMargin, threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  const style = {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(16px)",
    transition:
      variant === "workspace"
        ? "opacity 200ms ease-out, transform 200ms ease-out"
        : `opacity 500ms cubic-bezier(0.16, 1, 0.3, 1) ${delayMs}ms, transform 500ms cubic-bezier(0.16, 1, 0.3, 1) ${delayMs}ms`,
  };

  return { ref, visible, style };
}
