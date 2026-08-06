import { Logo } from "@/components/brand/Logo";

/**
 * The logo on every sign-in door, and deliberately the only link in the chrome.
 * Someone on a sign-in page is doing one thing; a nav bar here is an invitation
 * to abandon it. This is still the way back out to the site.
 */
export function AuthBrand({ onDark = false }: { onDark?: boolean }) {
  return <Logo height={40} onDark={onDark} className="auth__brand" priority />;
}
