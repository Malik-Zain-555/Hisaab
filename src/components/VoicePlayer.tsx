import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';

interface VoicePlayerProps {
  audioUrl: string;
  duration?: number;
  isMe?: boolean;
  isViolet?: boolean;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({
  audioUrl,
  duration = 0,
  isMe = false,
  isViolet = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Deterministic 28-bar waveform from audioUrl
  const bars = useMemo(() => {
    const count = 28;
    const heights: number[] = [];
    let seed = 0;
    for (let i = 0; i < Math.min(audioUrl.length, 120); i++) {
      seed = (seed * 31 + audioUrl.charCodeAt(i)) % 1000;
    }
    for (let i = 0; i < count; i++) {
      const val = Math.abs(Math.sin(seed + i * 0.65) * 0.68 + Math.cos(i * 1.15) * 0.32);
      heights.push(Math.max(22, Math.min(100, Math.round(val * 100))));
    }
    return heights;
  }, [audioUrl]);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const updateProgress = () => {
      if (audioRef.current && !audioRef.current.paused) {
        setCurrentTime(audioRef.current.currentTime);
        rafRef.current = requestAnimationFrame(updateProgress);
      }
    };

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(updateProgress);
    };

    const handlePause = () => {
      setIsPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.playbackRate = playbackRate;
      audio.play().catch((err) => {
        console.warn('Audio playback error:', err);
      });
    }
  };

  const toggleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextRate: 1 | 1.5 | 2 = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleSeek = (index: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const effectiveDur = totalDuration > 0 ? totalDuration : duration || 1;
    const targetTime = ((index + 0.5) / bars.length) * effectiveDur;
    if (isFinite(targetTime)) {
      audio.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const formatTime = (sec: number) => {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const effectiveDuration = totalDuration > 0 ? totalDuration : duration || 1;
  const progressRatio = Math.min(1, Math.max(0, currentTime / effectiveDuration));
  const filledBarsCount = isPlaying || currentTime > 0 ? Math.ceil(progressRatio * bars.length) : 0;

  return (
    <div className="flex items-center gap-2.5 min-w-[220px] sm:min-w-[250px] max-w-[300px] py-1 select-none">
      {/* Play / Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-sm ${
          isMe
            ? 'bg-[var(--em)] text-[#04140a]'
            : isViolet
            ? 'bg-[var(--vi)] text-white'
            : 'bg-white/15 text-[var(--tx)] hover:bg-white/25'
        }`}
        aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform + Timer */}
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div
          className="flex items-center gap-[3px] h-7 cursor-pointer"
          title="Click waveform to seek"
        >
          {bars.map((height, idx) => {
            const isFilled = idx < filledBarsCount;
            return (
              <div
                key={idx}
                onClick={() => handleSeek(idx)}
                style={{ height: `${height}%` }}
                className={`flex-1 min-w-[2.5px] rounded-full transition-colors duration-100 ${
                  isFilled
                    ? isMe
                      ? 'bg-[var(--em)] shadow-[0_0_6px_rgba(46,242,160,0.6)]'
                      : isViolet
                      ? 'bg-[#B49BFF] shadow-[0_0_6px_rgba(124,92,255,0.6)]'
                      : 'bg-[var(--em)]'
                    : 'bg-white/22 hover:bg-white/35'
                }`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] font-bold num text-[var(--mu)]">
          <span>
            {isPlaying || currentTime > 0
              ? formatTime(currentTime)
              : formatTime(effectiveDuration)}
          </span>

          <button
            type="button"
            onClick={toggleSpeed}
            className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-white/12 text-[var(--tx)] hover:bg-white/20 transition cursor-pointer"
            title="Playback speed"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};
