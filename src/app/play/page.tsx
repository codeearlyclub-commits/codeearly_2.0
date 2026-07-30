/**
 * Join a quiz — the screen a child sees first.
 *
 * Big numeric input, no jargon, no account required. A six-digit code and a name
 * is the whole barrier, because the alternative is thirty children trying to
 * remember passwords while a lesson waits.
 */
import type { Metadata } from "next";

import { JoinQuiz } from "./JoinQuiz";

export const metadata: Metadata = {
  title: "Join a quiz",
  description: "Enter your room code to join a live CodeEarly quiz.",
};

export default function PlayPage() {
  return (
    <main className="play play--join">
      <h1>Join the quiz</h1>
      <p className="play__lead">Type the code on the screen.</p>
      <JoinQuiz />
    </main>
  );
}
