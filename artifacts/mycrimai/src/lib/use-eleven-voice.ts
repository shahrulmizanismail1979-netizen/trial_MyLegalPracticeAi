import { useCallback, useEffect, useRef, useState } from "react";

export type ElevenVoiceRole = "judge" | "witness" | "counsel";

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

const STORAGE_KEY = "mycrimai.elevenEnabled";
const MAX_TTS_CHARS = 5000;

export interface ElevenVoiceOptions {
  role: ElevenVoiceRole;
  /** Persona key (e.g. judge type / witness type) used to pick a fitting voice. */
  persona?: string;
}

/**
 * Realistic ElevenLabs voice playback for the oral-practice simulators.
 * Synthesises assistant turns server-side (Advocate+ gated) and plays the audio.
 */
export function useElevenVoice({ role, persona }: ElevenVoiceOptions) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === "1";
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {}
  }, [enabled]);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      try {
        audioRef.current.pause();
      } catch {}
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    tokenRef.current++;
    cleanup();
    setIsSpeaking(false);
    setIsLoading(false);
  }, [cleanup]);

  const speak = useCallback(
    async (rawText: string) => {
      const text = stripMarkdown(rawText).slice(0, MAX_TTS_CHARS);
      if (!text) return;

      const myToken = ++tokenRef.current;
      cleanup();
      setIsLoading(true);

      try {
        const apiUrl = "/api/crim/voice/tts";
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, role, persona }),
          credentials: "include",
        });

        if (myToken !== tokenRef.current) return;
        if (!res.ok) {
          setIsLoading(false);
          return;
        }

        const blob = await res.blob();
        if (myToken !== tokenRef.current) return;

        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          if (myToken === tokenRef.current) {
            setIsSpeaking(false);
            cleanup();
          }
        };
        audio.onerror = () => {
          if (myToken === tokenRef.current) {
            setIsSpeaking(false);
            cleanup();
          }
        };
        setIsLoading(false);
        setIsSpeaking(true);
        await audio.play().catch(() => {
          if (myToken === tokenRef.current) {
            setIsSpeaking(false);
            cleanup();
          }
        });
      } catch {
        if (myToken === tokenRef.current) {
          setIsLoading(false);
          setIsSpeaking(false);
        }
      }
    },
    [role, persona, cleanup],
  );

  const speakIfEnabled = useCallback(
    (text: string) => {
      if (enabled) void speak(text);
    },
    [enabled, speak],
  );

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      if (prev) {
        tokenRef.current++;
        cleanup();
        setIsSpeaking(false);
        setIsLoading(false);
      }
      return !prev;
    });
  }, [cleanup]);

  useEffect(() => {
    return () => {
      tokenRef.current++;
      cleanup();
    };
  }, [cleanup]);

  return {
    enabled,
    toggleEnabled,
    speak,
    speakIfEnabled,
    stop,
    isSpeaking,
    isLoading,
  };
}
