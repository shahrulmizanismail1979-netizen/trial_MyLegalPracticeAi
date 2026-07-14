// Text-to-Speech utilities using Web Speech API

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speak(text: string, onEnd?: () => void): void {
  if (!window.speechSynthesis) return;
  stop();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-GB'; // British English — closest available to Malaysian English
  utterance.rate = 0.88;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  if (onEnd) utterance.onend = onEnd;
  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function stop(): void {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
}

export function isSpeaking(): boolean {
  return window.speechSynthesis?.speaking ?? false;
}

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// Strip markdown syntax for cleaner TTS reading
export function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '')      // headers
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1')   // italic
    .replace(/`(.+?)`/g, '$1')     // inline code
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links
    .replace(/^\s*[-*+]\s/gm, '')  // bullet points
    .replace(/^\s*\d+\.\s/gm, '')  // numbered lists
    .trim();
}
