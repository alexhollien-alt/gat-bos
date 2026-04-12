import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

// Node runtime, not edge -- the OpenAI SDK file upload needs Node streams.
export const runtime = "nodejs";

// Whisper caps at 25 MB per request.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * POST /api/transcribe
 *
 * Accepts multipart/form-data with an `audio` field (Blob/File), sends it
 * to OpenAI Whisper, and returns { text }.
 *
 * Auth: middleware.ts skips /api/* to let /api/intake stay public, so this
 * route verifies the session cookie manually. Unauthenticated callers get
 * 401 before any OpenAI cost is incurred.
 */
export async function POST(request: NextRequest) {
  // Session auth -- browser has the cookie, server verifies.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Server misconfigured: OPENAI_API_KEY not set" },
      { status: 500 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const audio = form.get("audio");
  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "Missing audio field" },
      { status: 400 }
    );
  }

  if (audio.size === 0) {
    return NextResponse.json(
      { error: "Empty audio file" },
      { status: 400 }
    );
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Audio file too large (25 MB max)" },
      { status: 413 }
    );
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // `form.get("audio")` in Next.js returns a web File on the server. The
    // OpenAI SDK accepts it directly. Whisper routes by filename extension,
    // which the browser sets when we construct FormData.
    const transcription = await openai.audio.transcriptions.create({
      file: audio as File,
      model: "whisper-1",
      // Let Whisper auto-detect language. Alex speaks English but future
      // use cases may include Spanish property tours.
      response_format: "json",
    });

    return NextResponse.json({
      text: transcription.text,
    });
  } catch (err) {
    console.error("whisper error", err);
    const message =
      err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
