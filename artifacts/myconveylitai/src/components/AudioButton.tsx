import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { Volume2, Loader2, Lock, Pause, Play } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { narrate } from '@/lib/subscription';
import { hasTier, AUDIO_MIN_TIER } from '@/lib/tier';
import { useToast } from '@/hooks/use-toast';

interface AudioButtonProps {
  text: string;
  label?: string;
  className?: string;
}

/**
 * Firm-tier AI audio narration. For users below Firm it renders a lock that
 * routes to the pricing page; for Firm/grandfathered users it streams ElevenLabs
 * audio and plays it inline.
 */
export function AudioButton({ text, label = 'Listen', className = '' }: AudioButtonProps) {
  const { currentUser } = useApp();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const entitled = hasTier(currentUser?.tier, AUDIO_MIN_TIER);

  const base =
    'inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all border';

  if (!entitled) {
    return (
      <button
        type="button"
        onClick={() => navigate('/pricing')}
        title="Audio narration is a Firm-tier feature"
        data-testid="button-audio-locked"
        className={`${base} bg-gold-900 text-slate-500 border-gold-800 hover:text-amber-400 hover:border-amber-500/30 ${className}`}
      >
        <Lock className="w-4 h-4" />
        <span>Listen (Firm)</span>
      </button>
    );
  }

  const stop = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const handleClick = async () => {
    if (playing) {
      stop();
      return;
    }
    if (audioRef.current && urlRef.current) {
      audioRef.current.play();
      setPlaying(true);
      return;
    }
    const clip = (text ?? '').trim();
    if (!clip) {
      toast({ variant: 'destructive', title: 'Nothing to narrate', description: 'No text available.' });
      return;
    }
    setLoading(true);
    try {
      const url = await narrate(clip);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onpause = () => setPlaying(false);
      await audio.play();
      setPlaying(true);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Narration failed',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      data-testid="button-audio"
      className={`${base} bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : playing ? (
        <Pause className="w-4 h-4" />
      ) : audioRef.current ? (
        <Play className="w-4 h-4" />
      ) : (
        <Volume2 className="w-4 h-4" />
      )}
      <span>{loading ? 'Generating…' : playing ? 'Pause' : label}</span>
    </button>
  );
}
