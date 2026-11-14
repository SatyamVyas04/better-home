import { useEffect, useState } from "react";
import spinners, { type BrailleSpinnerName } from "unicode-animations";

export function useUnicodeSpinnerFrame(
  name: BrailleSpinnerName,
  speed = 1,
  isActive = true
): string {
  const spinner = spinners[name];
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    setFrameIndex(0);

    if (!isActive) {
      return;
    }

    const frameInterval = Math.max(16, Math.round(spinner.interval / speed));
    let timer = 0;

    const stopTimer = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    };

    const startTimer = () => {
      stopTimer();
      timer = window.setInterval(() => {
        setFrameIndex(
          (previousFrame) => (previousFrame + 1) % spinner.frames.length
        );
      }, frameInterval);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopTimer();
        return;
      }

      startTimer();
    };

    startTimer();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isActive, speed, spinner]);

  return spinner.frames[frameIndex] ?? spinner.frames[0] ?? "";
}
