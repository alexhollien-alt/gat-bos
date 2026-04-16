"use client";

import { useCallback, useRef, useState } from "react";

interface PreviewFrameProps {
  html: string;
}

export function PreviewFrame({ html }: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(1600);

  const handleLoad = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    const doc = frame.contentDocument;
    if (!doc) return;
    const measured = Math.max(
      doc.body?.scrollHeight ?? 0,
      doc.documentElement?.scrollHeight ?? 0,
    );
    if (measured > 0) setHeight(measured + 24);
  }, []);

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.06] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.75)] bg-[var(--rule-gray)]">
      <iframe
        ref={iframeRef}
        title="Weekly Edge email preview"
        srcDoc={html}
        sandbox="allow-same-origin"
        onLoad={handleLoad}
        className="block w-full"
        style={{ height: `${height}px`, border: 0 }}
      />
    </div>
  );
}
