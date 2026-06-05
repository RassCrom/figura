import { useCallback, useEffect, useRef } from "react";

import { useSettingsStore } from "../stores/useSettingsStore";

type SoundId = "tick" | "wrong" | "correct" | "menu-ambient" | "round-tension" | "reveal-flourish";

export function useSoundManager() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const loopsRef = useRef<Map<SoundId, OscillatorNode>>(new Map());
  const musicVol = useSettingsStore((state) => state.musicVol);
  const sfxVol = useSettingsStore((state) => state.sfxVol);

  const getContext = useCallback(() => {
    audioContextRef.current ??= new AudioContext();
    return audioContextRef.current;
  }, []);

  const play = useCallback(
    (id: SoundId) => {
      const context = getContext();
      // Resume the context if it was auto-suspended (common on mobile Safari
      // and any browser where the context was created before a user gesture).
      if (context.state === "suspended") {
        void context.resume();
      }
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const isMusic = id.includes("ambient") || id.includes("tension");
      const volume = (isMusic ? musicVol : sfxVol) / 100;
      const frequency = id === "wrong" ? 150 : id === "correct" || id === "reveal-flourish" ? 540 : 330;

      oscillator.type = id === "wrong" ? "sawtooth" : "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.12), context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.2);
    },
    [getContext, musicVol, sfxVol],
  );

  const playLoop = useCallback(
    (id: SoundId) => {
      if (loopsRef.current.has(id) || musicVol === 0) {
        return;
      }
      const context = getContext();
      if (context.state === "suspended") {
        void context.resume();
      }
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = id === "round-tension" ? 82 : 64;
      gain.gain.value = (musicVol / 100) * 0.025;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      loopsRef.current.set(id, oscillator);
    },
    [getContext, musicVol],
  );

  const stopLoop = useCallback((id: SoundId) => {
    const loop = loopsRef.current.get(id);
    if (!loop) {
      return;
    }
    loop.stop();
    loopsRef.current.delete(id);
  }, []);

  const crossfadeTo = useCallback(
    (id: SoundId) => {
      loopsRef.current.forEach((_, key) => stopLoop(key));
      playLoop(id);
    },
    [playLoop, stopLoop],
  );

  useEffect(() => {
    return () => {
      loopsRef.current.forEach((loop) => loop.stop());
      loopsRef.current.clear();
      void audioContextRef.current?.close();
    };
  }, []);

  return { play, playLoop, stopLoop, crossfadeTo };
}
