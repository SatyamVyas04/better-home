function parseVersionSegments(version: string): number[] {
  return version
    .split(".")
    .map((segment) => {
      const parsedSegment = Number.parseInt(segment, 10);
      return Number.isFinite(parsedSegment) ? parsedSegment : 0;
    })
    .slice(0, 3);
}

export function compareAppVersions(
  leftVersion: string,
  rightVersion: string
): number {
  const leftSegments = parseVersionSegments(leftVersion);
  const rightSegments = parseVersionSegments(rightVersion);
  const maxLength = Math.max(leftSegments.length, rightSegments.length, 3);

  for (let index = 0; index < maxLength; index += 1) {
    const leftSegment = leftSegments[index] ?? 0;
    const rightSegment = rightSegments[index] ?? 0;

    if (leftSegment === rightSegment) {
      continue;
    }

    return leftSegment > rightSegment ? 1 : -1;
  }

  return 0;
}
