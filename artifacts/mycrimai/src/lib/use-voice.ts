import { useCallback, useEffect, useRef, useState } from "react";

type AnyWindow = typeof window & {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
};

function getSpeechRecognitionCtor(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as AnyWindow;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

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

export interface VoiceOptions {
  voiceLang?: string;
  rate?: number;
  pitch?: number;
}

export function useVoice(opts: VoiceOptions = {}) {
  const { voiceLang = "en-GB", rate = 1.0, pitch = 1.0 } = opts;
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("mycrimai.voiceEnabled");
    return v === null ? true : v === "1";
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState({ tts: false, stt: false });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("mycrimai.voiceURI") || "";
  });

  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");
  const onTranscriptRef = useRef<((text: string) => void) | null>(null);
  const speakTokenRef = useRef(0);
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hard-split a string into chunks no longer than `max` chars, preferring whitespace boundaries
  const hardChunk = (text: string, max: number): string[] => {
    const out: string[] = [];
    let s = text.trim();
    while (s.length > max) {
      let cut = s.lastIndexOf(" ", max);
      if (cut < Math.floor(max * 0.5)) cut = max; // no convenient space — hard cut
      out.push(s.slice(0, cut).trim());
      s = s.slice(cut).trim();
    }
    if (s) out.push(s);
    return out;
  };

  // Detect support + load voices
  useEffect(() => {
    const tts = typeof window !== "undefined" && "speechSynthesis" in window;
    const stt = !!getSpeechRecognitionCtor();
    setSupported({ tts, stt });
    if (!tts) return;
    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Persist preferences
  useEffect(() => {
    try { localStorage.setItem("mycrimai.voiceEnabled", voiceEnabled ? "1" : "0"); } catch {}
  }, [voiceEnabled]);
  useEffect(() => {
    try { localStorage.setItem("mycrimai.voiceURI", selectedVoiceURI); } catch {}
  }, [selectedVoiceURI]);

  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!voices.length) return null;
    if (selectedVoiceURI) {
      const v = voices.find((x) => x.voiceURI === selectedVoiceURI);
      if (v) return v;
    }
    const lang = voiceLang.toLowerCase();
    return (
      voices.find((v) => v.lang.toLowerCase() === lang) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(lang.split("-")[0])) ||
      voices.find((v) => v.default) ||
      voices[0]
    );
  }, [voices, selectedVoiceURI, voiceLang]);

  const speakForce = useCallback((text: string) => {
    if (!supported.tts || !text) return;
    try {
      const synth = window.speechSynthesis;
      // Invalidate any in-flight schedule and stop current speech
      const myToken = ++speakTokenRef.current;
      if (speakTimerRef.current) {
        clearTimeout(speakTimerRef.current);
        speakTimerRef.current = null;
      }
      synth.cancel();

      const clean = stripMarkdown(text);
      if (!clean) return;
      const MAX = 180;
      // Sentence-group up to MAX, then hard-split anything that's still too long
      const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
      const grouped: string[] = [];
      let buf = "";
      for (const s of sentences) {
        const candidate = (buf + " " + s).trim();
        if (candidate.length > MAX) {
          if (buf) grouped.push(buf.trim());
          buf = s.trim();
        } else {
          buf = candidate;
        }
      }
      if (buf) grouped.push(buf.trim());
      const chunks: string[] = grouped.flatMap((g) => (g.length > MAX ? hardChunk(g, MAX) : [g]));

      const v = pickVoice();
      let i = 0;
      const speakNext = () => {
        if (myToken !== speakTokenRef.current) return; // a newer call superseded this one
        if (i >= chunks.length) {
          setIsSpeaking(false);
          return;
        }
        const u = new SpeechSynthesisUtterance(chunks[i++]);
        if (v) u.voice = v;
        u.lang = v?.lang || voiceLang;
        u.rate = rate;
        u.pitch = pitch;
        u.onend = () => {
          if (myToken === speakTokenRef.current) speakNext();
        };
        u.onerror = () => {
          if (myToken === speakTokenRef.current) setIsSpeaking(false);
        };
        try { synth.resume(); } catch {}
        synth.speak(u);
      };
      setIsSpeaking(true);
      // Small delay avoids Chrome cancel-then-speak race
      speakTimerRef.current = setTimeout(() => {
        speakTimerRef.current = null;
        speakNext();
      }, 60);
    } catch {
      setIsSpeaking(false);
    }
  }, [supported.tts, pickVoice, voiceLang, rate, pitch]);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled) return;
    speakForce(text);
  }, [voiceEnabled, speakForce]);

  const stopSpeaking = useCallback(() => {
    if (!supported.tts) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [supported.tts]);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((v) => {
      if (v && supported.tts) window.speechSynthesis.cancel();
      return !v;
    });
  }, [supported.tts]);

  const startListening = useCallback((onTranscript: (text: string) => void) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    onTranscriptRef.current = onTranscript;
    finalTranscriptRef.current = "";
    setInterim("");
    const rec = new Ctor();
    rec.lang = voiceLang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalTranscriptRef.current += t;
        } else {
          interimText += t;
        }
      }
      setInterim(interimText);
    };
    rec.onerror = () => { setIsListening(false); };
    rec.onend = () => {
      setIsListening(false);
      const finalText = finalTranscriptRef.current.trim();
      if (finalText && onTranscriptRef.current) onTranscriptRef.current(finalText);
      setInterim("");
    };
    recognitionRef.current = rec;
    setIsListening(true);
    rec.start();
  }, [voiceLang]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
  }, []);

  // Cancel speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  return {
    supported,
    voices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    voiceEnabled,
    toggleVoice,
    speak,
    speakForce,
    stopSpeaking,
    isSpeaking,
    isListening,
    startListening,
    stopListening,
    interim,
  };
}
