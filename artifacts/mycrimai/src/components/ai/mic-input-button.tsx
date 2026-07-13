import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useVoice } from "@/lib/use-voice";

type VoiceApi = ReturnType<typeof useVoice>;

interface Props {
  voice: VoiceApi;
  onTranscript: (text: string) => void;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "destructive";
}

export function MicInputButton({ voice, onTranscript, size = "icon", variant = "outline" }: Props) {
  if (!voice.supported.stt) return null;
  return (
    <Button
      type="button"
      size={size}
      variant={voice.isListening ? "destructive" : variant}
      onClick={() => {
        if (voice.isListening) voice.stopListening();
        else voice.startListening(onTranscript);
      }}
      title={voice.isListening ? "Stop listening" : "Speak your input"}
    >
      {voice.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}
