import { useEffect, useState } from "react";

export function useCountUp(value: number, duration = 650): number {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const start = performance.now();
    const from = display;
    const change = value - from;
    let frame = 0;

    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + change * eased));
      if (progress < 1) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
    // display is intentionally captured as the animation start value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return display;
}
