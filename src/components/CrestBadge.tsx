// A club crest image with a graceful fallback: if the crest is missing or fails
// to load, render a colored monogram badge so the UI never shows a broken image.

import { useState } from 'react';
import type { Club } from '../data/types.ts';
import { crestSrc } from '../data/lookups.ts';

interface Props {
  club: Club | undefined;
  size?: number;
}

export function CrestBadge({ club, size = 22 }: Props) {
  const [failed, setFailed] = useState(false);
  const src = club ? crestSrc(club.crest) : null;

  if (club && src && !failed) {
    return (
      <img
        className="crest"
        src={src}
        alt={`${club.name} crest`}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className="crest crest-mono"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: club?.primaryColor ?? '#8892a6',
        color: club?.secondaryColor ?? '#ffffff',
        fontSize: size * 0.4,
      }}
    >
      {club?.shortCode?.slice(0, 3) ?? '?'}
    </span>
  );
}
