import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * Hook for ElevenLabs read-aloud playback (Firm tier only). Manages a single
 * audio element, fetches synthesized speech from the backend, and exposes
 * loading / playing state plus play/stop controls.
 */
export function useTts() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setIsPlaying(false);
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  const play = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      stop();
      setError(null);
      setIsLoading(true);
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`${API_BASE}/api/corp/legal/tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ text: text.slice(0, 5000) }),
        });
        if (!res.ok) {
          let msg = "Voice playback unavailable.";
          try {
            const data = await res.json();
            if (data?.error) msg = data.error;
          } catch { /* non-JSON error */ }
          throw new Error(msg);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          cleanup();
        };
        audio.onerror = () => {
          setIsPlaying(false);
          setError("Playback failed.");
          cleanup();
        };
        await audio.play();
        setIsPlaying(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Voice playback failed.");
      } finally {
        setIsLoading(false);
      }
    },
    [stop, cleanup],
  );

  return { play, stop, isLoading, isPlaying, error };
}
