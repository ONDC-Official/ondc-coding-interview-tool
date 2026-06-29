// ONDC brand mark + wordmark.
//
// The glyph is a small "open network" motif (connected nodes) that nods to
// ONDC = Open Network for Digital Commerce. It is an original, on-theme mark;
// swap in the official ONDC logo asset here if you have it.

export function OndcMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ondc-g" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1c75bc" />
          <stop offset="1" stopColor="#00b3c7" />
        </linearGradient>
      </defs>
      {/* links */}
      <g stroke="url(#ondc-g)" strokeWidth="1.8" strokeLinecap="round">
        <line x1="16" y1="6" x2="6" y2="22" />
        <line x1="16" y1="6" x2="26" y2="22" />
        <line x1="6" y1="22" x2="26" y2="22" />
        <line x1="16" y1="6" x2="16" y2="18" />
        <line x1="16" y1="18" x2="6" y2="22" />
        <line x1="16" y1="18" x2="26" y2="22" />
      </g>
      {/* nodes */}
      <g fill="#0d1117" stroke="url(#ondc-g)" strokeWidth="1.8">
        <circle cx="16" cy="6" r="3.4" />
        <circle cx="6" cy="22" r="3.4" />
        <circle cx="26" cy="22" r="3.4" />
        <circle cx="16" cy="18" r="3.2" />
      </g>
    </svg>
  );
}

interface BrandProps {
  size?: number;
  subtitle?: string;
  stacked?: boolean;
}

// Full lockup: mark + "ONDC" wordmark + product name.
export function Brand({ size = 30, subtitle = 'Coding Interview', stacked = false }: BrandProps) {
  return (
    <span className={`brand-lockup${stacked ? ' stacked' : ''}`}>
      <OndcMark size={size} />
      <span className="brand-text">
        <span className="brand-wordmark">ONDC</span>
        <span className="brand-sub">{subtitle}</span>
      </span>
    </span>
  );
}
