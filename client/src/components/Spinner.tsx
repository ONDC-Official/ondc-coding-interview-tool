import type { CSSProperties } from 'react';

// Indeterminate loading ring. Sized via the `--spinner-size` custom property
// (default in components.css); animation is the shared `spin` keyframe.
interface Props {
  size?: number;
}

export function Spinner({ size = 42 }: Props) {
  return (
    <div
      className="spinner"
      style={{ '--spinner-size': `${size}px` } as CSSProperties}
      role="status"
      aria-label="Loading"
    />
  );
}
