/**
 * Socket.io event contracts.
 *
 * Types only — no runtime dependency — so the server, the web client and the
 * Capacitor mobile client all compile against one definition of the protocol.
 * V4's quiz bugs (first-question race, unsynced countdowns, results leaking
 * across sessions) were all protocol ambiguities; naming every payload here is
 * how they stop being possible.
 *
 * Design rules baked into these shapes:
 *  • The server is authoritative. Clients never compute phase or score.
 *  • Timing is sent as an absolute server deadline, never a duration, so a
 *    client that reconnects mid-question lands on the correct remaining time
 *    instead of restarting the clock.
 *  • Nothing here carries a correct answer before the reveal.
 */

export type QuizPhase = "LOBBY" | "ACTIVE" | "REVEALED" | "ENDED";

/** Room naming — every room is session-scoped so results cannot cross sessions. */
export const rooms = {
  session: (sessionId: string) => `session:${sessionId}`,
  /** Host-only channel: admission requests, live answer counts. */
  host: (sessionId: string) => `session:${sessionId}:host`,
};

export type PublicParticipant = {
  participantId: string;
  displayName: string;
  score: number;
  rank: number | null;
};

/** A question as sent to players — correctAnswer is deliberately absent. */
export type QuestionForPlayers = {
  questionId: string;
  index: number;
  total: number;
  text: string;
  options: string[];
  /** Absolute epoch ms when answers close. Clients render `deadline - now`. */
  deadlineAt: number;
};

export type RevealPayload = {
  questionId: string;
  correctAnswer: string;
  /** How many players chose each option — the bar chart on the host screen. */
  tally: Record<string, number>;
  leaderboard: PublicParticipant[];
};

export interface ServerToClientEvents {
  "session:state": (payload: {
    phase: QuizPhase;
    playerCount: number;
    maxPlayers: number;
  }) => void;
  "session:players": (payload: { players: PublicParticipant[] }) => void;
  /** Emitted to the joining client only, after the host admits them. */
  "session:admitted": (payload: { participantId: string }) => void;
  "session:rejected": (payload: { reason: string }) => void;
  "question:start": (payload: QuestionForPlayers) => void;
  "question:reveal": (payload: RevealPayload) => void;
  "session:ended": (payload: { leaderboard: PublicParticipant[] }) => void;
  /** Motivational cheer shown to kids — carried forward from V4. */
  "cheer": (payload: { message: string; participantId?: string }) => void;
  "error": (payload: { code: string; message: string }) => void;
}

export interface ClientToServerEvents {
  /** Guests send guestToken; members send nothing and are read from the session. */
  "session:join": (payload: { sessionId: string; guestToken?: string }) => void;
  "answer:submit": (payload: {
    questionId: string;
    selectedAnswer: string;
  }) => void;
  /** Host-only. The server re-checks the role; the flag is not trusted. */
  "host:start": (payload: { sessionId: string }) => void;
  "host:next": (payload: { sessionId: string }) => void;
  "host:reveal": (payload: { sessionId: string }) => void;
  "host:end": (payload: { sessionId: string }) => void;
  "host:admit": (payload: { participantId: string; approved: boolean }) => void;
}

/** Attached to each socket after authentication. */
export interface SocketData {
  sessionId: string;
  participantId?: string;
  organizationId: string;
  isHost: boolean;
}
