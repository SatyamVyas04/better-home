import { memo } from "react";
import type { BrailleSpinnerName } from "unicode-animations";
import { useUnicodeSpinnerFrame } from "@/hooks/use-unicode-spinner-frame";

interface UnicodeSpinnerProps {
  className?: string;
  isActive?: boolean;
  name: BrailleSpinnerName;
  speed?: number;
}

/**
 * Renders an animated unicode spinner.
 */
export const UnicodeSpinner = memo(function UnicodeSpinner({
  className,
  isActive = true,
  name,
  speed = 1,
}: UnicodeSpinnerProps) {
  const frame = useUnicodeSpinnerFrame(name, speed, isActive);

  return (
    <span aria-hidden="true" className={className}>
      {frame}
    </span>
  );
});
