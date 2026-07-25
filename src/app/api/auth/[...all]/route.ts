import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Better Auth mounts all its endpoints (sign-up, sign-in, verify, session,
// token issuance for mobile, etc.) under /api/auth/*.
export const { GET, POST } = toNextJsHandler(auth);
