/**
 * Socket.io server — its own process, like the worker.
 *
 * WHY A SEPARATE PROCESS
 *
 * Next.js route handlers are request/response; they have nowhere to keep a
 * long-lived socket. Running the realtime layer separately also means a quiz
 * with 200 children in it cannot starve the web app of event-loop time, and
 * either can be restarted without dropping the other.
 *
 * The Redis adapter is what makes this horizontally scalable: rooms are shared
 * across instances, so a second container joins the same quiz rather than
 * hosting a parallel one. That is the capability V4 could not have — it was
 * capped at 100 concurrent Pusher connections, which is roughly two classrooms.
 *
 * AUTHENTICATION
 *
 * Players do not join over the socket. They join over HTTP first
 * (POST /api/quiz/join), which returns a participantId and, for guests, a
 * guestToken. The socket then authenticates with that pair. Keeping the write
 * on the HTTP path means the handshake is a pure check, and a flood of socket
 * connections cannot create participant rows.
 */
// Must come first: this process is not started by Next, so nothing else loads
// .env for it. Without this the env validation below fails at boot — which it
// correctly did the first time this file was run.
import "dotenv/config";

import { createServer } from "node:http";

import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import IORedis from "ioredis";

import "@/lib/env";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { isAppError } from "@/lib/errors";
import {
  rooms,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "@/realtime/events";
import {
  sessionState,
  startSession,
  nextQuestion,
  revealAnswer,
  endSession,
  submitAnswer,
  admitParticipant,
} from "@/server/quiz/session";

const PORT = Number(process.env.REALTIME_PORT || 3001);

const httpServer = createServer((_req, res) => {
  // A health endpoint so the container can be probed like any other service.
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", service: "realtime" }));
});

const io = new Server<ClientToServerEvents, ServerToClientEvents, never, SocketData>(
  httpServer,
  {
    // Same-origin in production (Caddy proxies /socket.io to this process), so
    // the permissive default is narrowed to the site itself.
    cors: { origin: process.env.APP_URL ?? "http://localhost:3000", credentials: true },
    // Children on school wifi drop packets constantly. A longer window means a
    // brief dropout resumes the same session rather than forcing a rejoin.
    pingTimeout: 25_000,
    pingInterval: 10_000,
  }
);

// ── Handshake ────────────────────────────────────────────────────────────────

io.use(async (socket, next) => {
  try {
    const { sessionId, participantId, guestToken, asHost } = socket.handshake.auth as {
      sessionId?: string;
      participantId?: string;
      guestToken?: string;
      asHost?: boolean;
    };

    if (!sessionId) return next(new Error("sessionId required"));

    const session = await prisma.quizSession.findUnique({
      where: { id: sessionId },
      include: { competition: { select: { organizationId: true } } },
    });
    if (!session) return next(new Error("quiz not found"));

    if (asHost) {
      // Host identity comes from the cookie, forwarded on the handshake.
      const result = await auth.api.getSession({
        headers: new Headers({ cookie: socket.handshake.headers.cookie ?? "" }),
      });
      const user = result?.user as { id?: string; role?: string } | undefined;
      if (!user?.id) return next(new Error("sign in to host"));

      // The host is whoever opened the room; platform admins may also take over
      // (a session whose host lost their laptop still needs finishing).
      const isHost = session.hostUserId === user.id || user.role === "admin";
      if (!isHost) return next(new Error("not the host of this quiz"));

      socket.data = {
        sessionId,
        organizationId: session.competition.organizationId,
        isHost: true,
      };
      return next();
    }

    if (!participantId) return next(new Error("participantId required"));

    const participant = await prisma.quizParticipant.findFirst({
      where: { id: participantId, sessionId },
    });
    if (!participant) return next(new Error("not in this quiz"));

    // A guest must present the token they were issued. Without this, knowing
    // someone's participantId would be enough to play as them.
    if (participant.guestToken && participant.guestToken !== guestToken) {
      return next(new Error("invalid guest token"));
    }

    socket.data = {
      sessionId,
      participantId,
      organizationId: session.competition.organizationId,
      isHost: false,
    };
    return next();
  } catch (err) {
    logger.error({ err }, "socket handshake failed");
    return next(new Error("could not join"));
  }
});

// ── Connection ───────────────────────────────────────────────────────────────

io.on("connection", async (socket) => {
  const { sessionId, isHost, participantId } = socket.data;

  await socket.join(rooms.session(sessionId));
  if (isHost) await socket.join(rooms.host(sessionId));

  // Send current state immediately. A client that connects mid-question needs
  // to know that, not wait for the next transition to find out.
  try {
    const state = await sessionState(sessionId);
    socket.emit("session:state", {
      phase: state.phase,
      playerCount: state.playerCount,
      maxPlayers: state.maxPlayers,
    });
    socket.emit("session:players", { players: state.leaderboard });
  } catch (err) {
    logger.warn({ err, sessionId }, "could not send initial state");
  }

  /** Announce the room's roster to everyone in it. */
  async function broadcastState() {
    const state = await sessionState(sessionId);
    io.to(rooms.session(sessionId)).emit("session:state", {
      phase: state.phase,
      playerCount: state.playerCount,
      maxPlayers: state.maxPlayers,
    });
    io.to(rooms.session(sessionId)).emit("session:players", {
      players: state.leaderboard,
    });
  }

  await broadcastState();

  /** Wrap a handler so a thrown AppError becomes an error event, not a crash. */
  function guard(fn: () => Promise<void>) {
    return () => {
      fn().catch((err) => {
        if (isAppError(err)) {
          socket.emit("error", { code: err.code, message: err.publicMessage });
        } else {
          logger.error({ err, sessionId }, "socket handler failed");
          socket.emit("error", { code: "INTERNAL", message: "Something went wrong." });
        }
      });
    };
  }

  function hostOnly(fn: () => Promise<void>) {
    return guard(async () => {
      // Re-checked per event, not just at handshake: a socket must not be able
      // to act as host because it once passed a check.
      if (!socket.data.isHost) {
        socket.emit("error", { code: "FORBIDDEN", message: "Only the host can do that." });
        return;
      }
      await fn();
    });
  }

  socket.on(
    "host:start",
    hostOnly(async () => {
      const result = await startSession(sessionId);
      if ("question" in result && result.question) {
        // correctAnswer is deliberately NOT included in this payload.
        io.to(rooms.session(sessionId)).emit("question:start", result.question);
      }
      await broadcastState();
    })
  );

  socket.on(
    "host:next",
    hostOnly(async () => {
      const result = await nextQuestion(sessionId);
      if ("question" in result && result.question) {
        io.to(rooms.session(sessionId)).emit("question:start", result.question);
      } else if ("result" in result) {
        const state = await sessionState(sessionId);
        io.to(rooms.session(sessionId)).emit("session:ended", {
          leaderboard: state.leaderboard,
        });
      }
      await broadcastState();
    })
  );

  socket.on(
    "host:reveal",
    hostOnly(async () => {
      const reveal = await revealAnswer(sessionId);
      io.to(rooms.session(sessionId)).emit("question:reveal", {
        questionId: reveal.questionId,
        correctAnswer: reveal.correctAnswer,
        tally: reveal.tally,
        leaderboard: reveal.leaderboard,
      });
      await broadcastState();
    })
  );

  socket.on(
    "host:end",
    hostOnly(async () => {
      await endSession(sessionId);
      const state = await sessionState(sessionId);
      io.to(rooms.session(sessionId)).emit("session:ended", {
        leaderboard: state.leaderboard,
      });
    })
  );

  socket.on("host:admit", (payload) =>
    hostOnly(async () => {
      const result = await admitParticipant(sessionId, payload.participantId, payload.approved);

      // Two distinct events rather than one with a union payload — a rejection
      // and an admission are different things and the client branches on them.
      if (result.removed) {
        io.to(rooms.session(sessionId)).emit("session:rejected", {
          reason: "The host did not let you in.",
        });
      } else {
        io.to(rooms.session(sessionId)).emit("session:admitted", {
          participantId: payload.participantId,
        });
      }

      await broadcastState();
    })()
  );

  socket.on("answer:submit", (payload) =>
    guard(async () => {
      if (!participantId) {
        socket.emit("error", { code: "FORBIDDEN", message: "Only players can answer." });
        return;
      }

      const { correct, points } = await submitAnswer(
        sessionId,
        participantId,
        payload.questionId,
        payload.selectedAnswer
      );

      // Told only to the answerer. Broadcasting correctness would leak the
      // answer to everyone still thinking.
      socket.emit("cheer", {
        message: correct ? `Correct! +${points}` : "Not this time — keep going!",
        participantId,
      });

      // The host sees the live count so they know when to reveal.
      const answered = await prisma.quizAnswer.count({
        where: { sessionId, questionId: payload.questionId },
      });
      io.to(rooms.host(sessionId)).emit("cheer", {
        message: `${answered} answered`,
      });
    })()
  );

  socket.on("disconnect", () => {
    // Nothing is deleted on disconnect. A dropped tablet must keep its seat and
    // score — that is what makes rejoining work.
    broadcastState().catch(() => {});
  });
});

// ── Boot ─────────────────────────────────────────────────────────────────────

async function main() {
  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  const pubClient = new IORedis(url);
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  httpServer.listen(PORT, () => {
    logger.info({ port: PORT }, "✅ CodeEarly realtime up (socket.io + redis adapter)");
  });
}

main().catch((err) => {
  logger.error({ err }, "realtime server failed to start");
  process.exit(1);
});
