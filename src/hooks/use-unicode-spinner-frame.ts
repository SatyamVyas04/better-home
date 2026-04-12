import { useEffect, useState } from "react";
import spinners, { type BrailleSpinnerName } from "unicode-animations";

export function useUnicodeSpinnerFrame(
  name: BrailleSpinnerName,
  speed = 1
): string {
  const spinner = spinners[name];
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    setFrameIndex(0);

    const frameInterval = Math.max(16, Math.round(spinner.interval / speed));
    const timer = window.setInterval(() => {
      setFrameIndex((previousFrame) => {
        return (previousFrame + 1) % spinner.frames.length;
      });
    }, frameInterval);

    return () => {
      window.clearInterval(timer);
    };
  }, [speed, spinner]);

  return spinner.frames[frameIndex] ?? spinner.frames[0] ?? "";
}
