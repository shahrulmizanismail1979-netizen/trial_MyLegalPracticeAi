import { Volume2, VolumeX, Square, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useVoice } from "@/lib/use-voice";

type VoiceApi = ReturnType<typeof useVoice>;

interface Props {
  voice: VoiceApi;
  responseText?: string;
  compact?: boolean;
}

export function VoiceControls({ voice, responseText, compact = false }: Props) {
  if (!voice.supported.tts) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {!compact && voice.voices.length > 0 && (
        <Select
          value={voice.selectedVoiceURI || "__auto__"}
          onValueChange={(v) => voice.setSelectedVoiceURI(v === "__auto__" ? "" : v)}
        >
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue placeholder="Auto voice" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__auto__">Auto voice</SelectItem>
            {voice.voices
              .filter((v) => v.lang.toLowerCase().startsWith("en"))
              .map((v) => (
                <SelectItem key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      )}

      {responseText && !voice.isSpeaking && (
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => voice.speakForce(responseText)}
          title="Play AI response aloud"
        >
          <Play className="h-3.5 w-3.5 mr-1" /> Play
        </Button>
      )}

      {voice.isSpeaking && (
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={voice.stopSpeaking}
          title="Stop speaking"
        >
          <Square className="h-3.5 w-3.5 mr-1" /> Stop
        </Button>
      )}

      <Button
        size="sm"
        variant="outline"
        className="h-8"
        onClick={voice.toggleVoice}
        title={voice.voiceEnabled ? "Mute auto-speak" : "Unmute auto-speak"}
      >
        {voice.voiceEnabled ? (
          <Volume2 className="h-3.5 w-3.5" />
        ) : (
          <VolumeX className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
