const FALLBACK_ACCENT = "#b31a35";

const PALETTE_ACCENT: Record<string, string> = {
  "classic-estate": "#c6b79b",
  "desert-modern": "#c4956a",
  "contemporary-luxury": "#2c2c2c",
  "organic-luxury": "#8b7355",
  "editorial-luxury": "#b8965a",
  "luxury-dark": "#c6b79b",
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

export function getAgentAccent(palette: string | null | undefined): string {
  if (!palette) return FALLBACK_ACCENT;
  const key = normalize(palette);
  return PALETTE_ACCENT[key] ?? FALLBACK_ACCENT;
}

export const AGENT_ACCENT_FALLBACK = FALLBACK_ACCENT;
