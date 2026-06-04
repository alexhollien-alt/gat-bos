// src/lib/open-house/slug.ts
// Landing-page slug generation for an open house blast.

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

// Builds a readable, unique-ish slug: city-street-<short id>.
// A DB unique index on open_house_blasts.slug is the final guard; the random
// suffix makes a collision practically impossible.
export function buildBlastSlug(address: string, city: string): string {
  const base = [slugify(city), slugify(address)].filter(Boolean).join("-").slice(0, 56);
  const suffix = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`)
    .replace(/-/g, "")
    .slice(0, 6);
  return `${base || "open-house"}-${suffix}`;
}
