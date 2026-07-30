"use client";

/**
 * Typed Socket.io client for the quiz.
 *
 * Shared by the host console and the player screen so both compile against the
 * same protocol definition — the contracts in src/realtime/events.ts. A mismatch
 * becomes a type error instead of a quiz that silently does nothing in front of
 * a room.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  QuestionForPlayers,
  RevealPayload,
  PublicParticipant,
  QuizPhase,
} from "@/realtime/events";

export type QuizSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Send an event to the server, fully typed against the protocol.
 *
 * The hook exposes this rather than the socket itself. Consumers only ever need
 * to send, and keeping the socket out of the returned value means it can live in
 * a ref — which is correct, since a socket instance is not render state and
 * setting it during an effect only triggers a pointless extra render.
 */
export type QuizEmit = <E extends keyof ClientToServerEvents>(
  event: E,
  ...args: Parameters<ClientToServerEvents[E]>
) => void;

export type QuizConnection = {
  emit: QuizEmit;
  connected: boolean;
  /** null while the socket is fine; a message when it is not. */
  problem: string | null;
  phase: QuizPhase;
  playerCount: number;
  maxPlayers: number;
  players: PublicParticipant[];
  question: QuestionForPlayers | null;
  reveal: RevealPayload | null;
  finalLeaderboard: PublicParticipant[] | null;
  /** Transient encouragement shown to the player who just answered. */
  cheer: string | null;
};

export type UseQuizOptions = {
  sessionId: string;
  asHost?: boolean;
  participantId?: string;
  guestToken?: string;
};

/**
 * Connect to a quiz room and track its state.
 *
 * All state here is a mirror of what the server said. Nothing is computed
 * locally — no local countdown that could drift, no locally guessed phase. The
 * one thing the client derives is how many seconds remain, and it derives that
 * from the server's absolute deadline.
 */
export function useQuiz(options: UseQuizOptions): QuizConnection {
  const { sessionId, asHost, participantId, guestToken } = options;

  // A ref, because the socket is never read during render — only inside `emit`,
  // which is a callback. Everything the UI renders comes from the state below,
  // all of it set by server events.
  const socketRef = useRef<QuizSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [phase, setPhase] = useState<QuizPhase>("LOBBY");
  const [playerCount, setPlayerCount] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(0);
  const [players, setPlayers] = useState<PublicParticipant[]>([]);
  const [question, setQuestion] = useState<QuestionForPlayers | null>(null);
  const [reveal, setReveal] = useState<RevealPayload | null>(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState<PublicParticipant[] | null>(null);
  const [cheer, setCheer] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    // Empty means same-origin, which is right in production behind Caddy.
    const url = process.env.NEXT_PUBLIC_REALTIME_URL || undefined;
    const socket: QuizSocket = io(url, {
      auth: { sessionId, asHost: Boolean(asHost), participantId, guestToken },
      transports: ["websocket", "polling"],
      // Children on school wifi drop constantly; reconnect quietly and keep
      // trying rather than showing an error on the first blip.
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setProblem(null);
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("connect_error", (err) => {
      setConnected(false);
      // The handshake rejects with a real reason ("not the host of this quiz"),
      // which is far more useful to show than "connection failed".
      setProblem(err.message || "Could not join the quiz.");
    });

    socket.on("session:state", (payload) => {
      setPhase(payload.phase);
      setPlayerCount(payload.playerCount);
      setMaxPlayers(payload.maxPlayers);
    });

    socket.on("session:players", (payload) => setPlayers(payload.players));

    socket.on("question:start", (payload) => {
      // Clear the previous reveal so a stale answer cannot linger on screen
      // while the next question is being read out.
      setReveal(null);
      setCheer(null);
      setQuestion(payload);
      setPhase("ACTIVE");
    });

    socket.on("question:reveal", (payload) => {
      setReveal(payload);
      setPhase("REVEALED");
    });

    socket.on("session:ended", (payload) => {
      setFinalLeaderboard(payload.leaderboard);
      setPhase("ENDED");
      setQuestion(null);
    });

    socket.on("cheer", (payload) => setCheer(payload.message));

    socket.on("error", (payload) => setProblem(payload.message));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, asHost, participantId, guestToken]);

  const emit = useCallback<QuizEmit>((event, ...args) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  return {
    emit,
    connected,
    problem,
    phase,
    playerCount,
    maxPlayers,
    players,
    question,
    reveal,
    finalLeaderboard,
    cheer,
  };
}

/**
 * Seconds remaining, derived from the server's absolute deadline.
 *
 * Ticks locally for smoothness but is always anchored to the server's instant,
 * so a slow tab or a reconnect corrects itself on the next tick instead of
 * drifting further — the V4 countdown bug made structurally impossible.
 */
export function useCountdown(deadlineAt: number | null): number | null {
  // A ticking clock rather than a stored countdown. The remaining time is
  // DERIVED during render from the server's deadline, so there is no second
  // copy of the truth to drift, and no synchronous setState in an effect to
  // seed it.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadlineAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadlineAt]);

  if (deadlineAt === null) return null;
  return Math.max(0, Math.ceil((deadlineAt - now) / 1000));
}
