// Brand lockup: the official ONDC logo + the "Live Coder" product wordmark.
//
// The logo is the official asset (bundled at src/assets/ondc.png), a transparent
// PNG that reads on both themes, so it sits with no background chip. The
// "Live Coder" product name and an optional uppercase sub-label render alongside.
import logoUrl from '../assets/ondc.png';

interface BrandProps {
  // Logo height in px. Width scales with the logo's aspect ratio.
  size?: number;
  // Product wordmark. Pass null/'' to render the logo alone.
  name?: string | null;
  // Small uppercase mono label under (stacked) or beside the name.
  subtitle?: string;
  // Vertical layout for the login / join hero; horizontal otherwise.
  stacked?: boolean;
}

export function Brand({
  size = 28,
  name = 'Live Coder',
  subtitle,
  stacked = false,
}: BrandProps) {
  return (
    <span className={`brand${stacked ? ' brand-stacked' : ''}`}>
      <img className="brand-logo" src={logoUrl} alt="ONDC" height={size} />
      {(name || subtitle) && (
        <span className="brand-text">
          {name && <span className="brand-name">{name}</span>}
          {subtitle && <span className="brand-sub">{subtitle}</span>}
        </span>
      )}
    </span>
  );
}
