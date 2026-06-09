"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_RECORD_MS = 90_000;
const MIN_BLOB_BYTES = 200;

export type VoiceDictationState = "idle" | "listening" | "transcribing";

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useVoiceDictation({
  projectId,
  onTranscript,
  onError,
  disabled = false,
}: {
  projectId?: string;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<VoiceDictationState>("idle");
  /** False on server + first client paint — avoids hydration mismatch. */
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia)
    );
  }, []);

  const cleanupStream = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => () => cleanupStream(), [cleanupStream]);

  const fail = useCallback(
    (message: string) => {
      setError(message);
      onError?.(message);
      setState("idle");
      cleanupStream();
    },
    [cleanupStream, onError]
  );

  const transcribeBlob = useCallback(
    async (blob: Blob) => {
      if (blob.size < MIN_BLOB_BYTES) {
        fail("Didn't catch that — try again.");
        return;
      }
      setState("transcribing");
      setError(null);
      try {
        const dataUrl = await blobToDataUrl(blob);
        const base64 = dataUrl.split(",")[1];
        const res = await fetch("/api/ai/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64: base64,
            audioMimeType: blob.type || "audio/webm",
            projectId,
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          text?: string;
          message?: string;
        } | null;

        if (!res.ok || !data?.ok || !data.text?.trim()) {
          fail(data?.message ?? "Couldn't transcribe — try again.");
          return;
        }
        onTranscript(data.text.trim());
        setState("idle");
      } catch {
        fail("Something went wrong — try again.");
      }
    },
    [fail, onTranscript, projectId]
  );

  const stopListening = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") {
      cleanupStream();
      setState((s) => (s === "listening" ? "idle" : s));
      return;
    }
    recorder.stop();
  }, [cleanupStream]);

  const startListening = useCallback(async () => {
    if (disabled || state === "transcribing" || !supported) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const mime = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        cleanupStream();
        void transcribeBlob(blob);
      };

      recorder.start();
      setState("listening");
      stopTimerRef.current = setTimeout(() => stopListening(), MAX_RECORD_MS);
    } catch {
      fail("Microphone access blocked. Allow mic in your browser.");
    }
  }, [cleanupStream, disabled, fail, state, stopListening, supported, transcribeBlob]);

  const toggle = useCallback(() => {
    if (state === "listening") stopListening();
    else void startListening();
  }, [startListening, state, stopListening]);

  const statusLabel =
    state === "listening"
      ? "Listening… tap mic to stop"
      : state === "transcribing"
        ? "Transcribing…"
        : null;

  return {
    state,
    error,
    statusLabel,
    supported,
    listening: state === "listening",
    transcribing: state === "transcribing",
    toggle,
    stop: stopListening,
  };
}
