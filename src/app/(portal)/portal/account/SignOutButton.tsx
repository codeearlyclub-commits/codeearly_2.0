"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        // Better Auth revokes the session server-side, which with Redis
        // secondary storage means every container sees it immediately.
        await signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
