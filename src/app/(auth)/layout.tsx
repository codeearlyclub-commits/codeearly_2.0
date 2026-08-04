/**
 * Sign-in shell.
 *
 * Its only job is to load the stylesheet every door shares. The doors render
 * their own backgrounds — the child's is purple, staff is navy — so there is no
 * common wrapper element to put here.
 */
import "@/styles/auth.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
