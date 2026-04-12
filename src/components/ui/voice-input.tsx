"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RecordingState = "idle" | "recording" | "transcribing";

interface VoiceInputProps {
  /** Called with the transcribed text when Whisper returns. */
  onTranscript: (text: string) => void;
  /** Optional visual size. Matches shadcn Button sizes. Default "sm". */
  size?: "sm" | "icon";
  /** Disable the button (e.g., while parent is submitting). */
  disabled?: boolean;
  /** Optional label shown next to the icon. Hidden when size="icon". */
  label?: string;
}

/**
 * VoiceInput -- record-and-transcribe button.
 *
 * Uses the browser MediaRecorder API to capture audio, then POSTs the blob
 * to /api/transcribe which calls OpenAI Whisper. The returned text is
 * handed to `onTranscript`; the parent decides how to merge it into its
 * form field (append, replace, cursor-aware insert, etc).
 *
 * The component is deliberately unopinionated about destination so it can
 * serve contact notes, interaction summaries, and (later) Voice Memo Capture.
 */
export function VoiceInput({
  onTranscript,
  size = "sm",
  disabled = false,
  label,
}: VoiceInputProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop any live tracks on unmount so the mic LED turns off.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    if (state !== "idle") return;

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone not supported in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // Pick a MIME type the browser actually supports. Chrome and Edge
      // default to audio/webm;codecs=opus. Safari 14+ supports audio/mp4.
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Release the mic immediately so the indicator turns off.
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        if (blob.size === 0) {
          toast.error("No audio captured");
          setState("idle");
          return;
        }

        await transcribe(blob);
      };

      recorder.start();
      setState("recording");
    } catch (err) {
      console.error("mic permission denied", err);
      toast.error("Microphone permission denied");
      setState("idle");
    }
  }

  function stopRecording() {
    if (state !== "recording") return;
    mediaRecorderRef.current?.stop();
    setState("transcribing");
  }

  async function transcribe(blob: Blob) {
    try {
      const form = new FormData();
      // Whisper routes by file extension. webm -> audio/webm, m4a -> audio/mp4.
      const ext = blob.type.includes("mp4") ? "m4a" : "webm";
      form.append("audio", blob, `recording.${ext}`);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const { error } = await res
          .json()
          .catch(() => ({ error: "Transcription failed" }));
        throw new Error(error || "Transcription failed");
      }

      const { text } = (await res.json()) as { text: string };
      if (text && text.trim()) {
        onTranscript(text.trim());
      } else {
        toast.error("No speech detected");
      }
    } catch (err) {
      console.error("transcribe error", err);
      toast.error(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setState("idle");
    }
  }

  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";
  const busy = isTranscribing || disabled;

  return (
    <Button
      type="button"
      variant={isRecording ? "default" : "ghost"}
      size={size}
      disabled={busy}
      onClick={isRecording ? stopRecording : startRecording}
      className={cn(
        "gap-1.5",
        isRecording && "bg-red-500 hover:bg-red-600 text-white",
        size === "icon" && "h-8 w-8"
      )}
      aria-label={
        isRecording
          ? "Stop recording"
          : isTranscribing
          ? "Transcribing"
          : "Start voice input"
      }
      aria-pressed={isRecording}
    >
      {isTranscribing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isRecording ? (
        <Square className="h-3.5 w-3.5 fill-current" />
      ) : (
        <Mic className="h-3.5 w-3.5" />
      )}
      {label && size !== "icon" && (
        <span className="text-xs">
          {isRecording ? "Stop" : isTranscribing ? "Transcribing..." : label}
        </span>
      )}
    </Button>
  );
}
