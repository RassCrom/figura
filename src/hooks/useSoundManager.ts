import { useCallback, useEffect, useRef } from "react";

import { useSettingsStore } from "../stores/useSettingsStore";

type SoundId = "tick" | "wrong" | "correct" | "menu-ambient" | "round-tension" | "reveal-flourish";
type MusicId = Extract<SoundId, "menu-ambient" | "round-tension">;

const MUSIC_TRACKS: Record<MusicId, string> = {
  "menu-ambient": `${import.meta.env.BASE_URL}audio/Where_the_Stone_Sleeps-main_music.mp3`,
  "round-tension": `${import.meta.env.BASE_URL}audio/A_Sweet_Reset-map_msuic.mp3`,
};

const SOUND_NOTES: Record<Exclude<SoundId, MusicId>, number[]> = {
  tick: [440],
  wrong: [180, 135],
  correct: [440, 660, 880],
  "reveal-flourish": [330, 494, 659, 988],
};

export function useSoundManager() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicIdRef = useRef<MusicId | null>(null);
  const musicVol = useSettingsStore((state) => state.musicVol);
  const sfxVol = useSettingsStore((state) => state.sfxVol);

  const getContext = useCallback(() => {
    audioContextRef.current ??= new AudioContext();
    return audioContextRef.current;
  }, []);

  const getMusic = useCallback((id: MusicId) => {
    if (!musicRef.current) {
      const audio = new Audio(MUSIC_TRACKS[id]);
      audio.loop = true;
      audio.preload = "auto";
      musicRef.current = audio;
    }
    if (!musicRef.current.src.endsWith(MUSIC_TRACKS[id])) {
      musicRef.current.src = MUSIC_TRACKS[id];
      musicRef.current.load();
    }
    return musicRef.current;
  }, []);

  const play = useCallback(
    (id: SoundId) => {
      if (id === "menu-ambient" || id === "round-tension") return;
      const context = getContext();
      if (context.state === "suspended") void context.resume();
      const notes = SOUND_NOTES[id];
      const volume = sfxVol / 100;
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + index * 0.055;
        const duration = id === "wrong" ? 0.22 : id === "tick" ? 0.08 : 0.3;
        oscillator.type = id === "wrong" ? "sawtooth" : id === "tick" ? "square" : "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.1), start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
      });
    },
    [getContext, sfxVol],
  );

  const playLoop = useCallback(
    (id: SoundId) => {
      if (id !== "menu-ambient" && id !== "round-tension") return;
      const music = getMusic(id);
      musicIdRef.current = id;
      music.playbackRate = 1;
      music.volume = (musicVol / 100) * (id === "round-tension" ? 0.58 : 0.42);
      if (musicVol > 0) void music.play().catch(() => undefined);
    },
    [getMusic, musicVol],
  );

  const stopLoop = useCallback(
    (id: SoundId) => {
      if (musicIdRef.current !== id) return;
      const music = getMusic(id as MusicId);
      music.pause();
      musicIdRef.current = null;
    },
    [getMusic],
  );

  const crossfadeTo = useCallback(
    (id: SoundId) => {
      if (id === "menu-ambient" || id === "round-tension") {
        playLoop(id);
        return;
      }
      play(id);
    },
    [play, playLoop],
  );

  useEffect(() => {
    const id = musicIdRef.current;
    if (!id) return;
    const music = getMusic(id);
    music.volume = (musicVol / 100) * (id === "round-tension" ? 0.58 : 0.42);
    if (musicVol === 0) music.pause();
  }, [getMusic, musicVol]);

  useEffect(
    () => () => {
      musicRef.current?.pause();
      musicRef.current = null;
      void audioContextRef.current?.close();
    },
    [],
  );

  return { play, playLoop, stopLoop, crossfadeTo };
}
