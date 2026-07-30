/**
 * Open a room: POST /api/admin/competitions/:id/session
 *
 * Returns the sessionId and, for guest-playable quizzes, the join code to put on
 * the projector. Creating the room is an HTTP action rather than a socket event
 * so it is idempotent-ish, auditable, and works before any socket connects.
 */
import { apiHandler } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { createSession } from "@/server/quiz/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = apiHandler<Ctx>(async (req, ctx) => {
  const admin = await requireAdmin(req);
  const { id } = await ctx.params;

  const session = await createSession(id, admin.userId);

  return {
    sessionId: session.id,
    joinCode: session.joinCode,
    maxPlayers: session.maxPlayers,
  };
});
