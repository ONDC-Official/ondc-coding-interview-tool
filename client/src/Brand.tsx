// ONDC brand lockup: the official ONDC registered logo + the product name.
//
// The logo is the official asset (bundled at src/assets/ondc-logo.svg). It
// already carries the "ONDC" wordmark, tagline and ® mark, so we don't repeat a
// wordmark in markup. The logo sits on a light chip (.brand-logo) so its dark
// tagline / ® stay legible on the dark theme as well as the light one.
import logoUrl from './assets/ondc-logo.svg';

interface BrandProps {
  // Logo height in px. Width scales with the logo's aspect ratio.
  size?: number;
  subtitle?: string;
  stacked?: boolean;
}

export function Brand({
  size = 30,
  subtitle = 'Coding Interview',
  stacked = false,
}: BrandProps) {
  return (
    <span className={`brand-lockup${stacked ? ' stacked' : ''}`}>
      <img className="brand-logo" src={logoUrl} alt="ONDC" height={size} />
      {subtitle ? <span className="brand-sub">{subtitle}</span> : null}
    </span>
  );
}
