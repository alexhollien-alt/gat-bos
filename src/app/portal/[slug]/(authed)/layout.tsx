import { notFound } from "next/navigation";
import {
  PortalSessionError,
  requirePortalSession,
} from "@/lib/auth/requirePortalSession";

export default async function PortalSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    await requirePortalSession(slug);
  } catch (err) {
    if (err instanceof PortalSessionError) {
      if (err.code === "agent_not_found") {
        notFound();
      }
      if (err.code === "email_mismatch") {
        return (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-10">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-100">
              Access denied
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Your session is signed in, but it is not authorized to view this
              portal. If you believe this is an error, contact Alex Hollien at
              Great American Title Agency.
            </p>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              Error 403 · session/slug mismatch
            </p>
          </div>
        );
      }
    }
    throw err;
  }

  return <>{children}</>;
}
