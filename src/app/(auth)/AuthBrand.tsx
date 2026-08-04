import Link from "next/link";

/**
 * The wordmark on every sign-in door, and deliberately the only link in the
 * chrome. Someone on a sign-in page is doing one thing; a nav bar here is an
 * invitation to abandon it. This is still the way back out to the site.
 */
export function AuthBrand() {
  return (
    <Link href="/" className="auth__brand">
      Code<span>Early</span>
    </Link>
  );
}
