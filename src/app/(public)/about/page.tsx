import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "CodeEarly Club teaches children to code with live classes, self-paced courses and holiday programs — building confidence, not just syntax.",
};

export default function AboutPage() {
  return (
    <>
      <section className="page-head">
        <div className="container">
          <h1>About CodeEarly Club</h1>
          <p>
            We teach children to build things with code — and to believe they
            can.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container prose">
          <h2>Why we exist</h2>
          <p>
            Most children meet technology only as consumers. They use apps,
            games and websites every day without ever glimpsing that someone
            built them — and that they could too. CodeEarly Club exists to
            close that gap early, while curiosity is still louder than
            self-doubt.
          </p>

          <h2>How we teach</h2>
          <p>
            Children learn by making something they actually want to exist. A
            game, a website about their favourite football team, an animation
            for a sibling. The syntax is the means; the thing they built and
            can show you is the point.
          </p>
          <p>
            Classes are small, taught live by real instructors, and paced so
            nobody is left behind or held back. Between classes, children work
            through self-paced courses in their own time — with their own
            sign-in, so learning does not depend on a parent being free.
          </p>

          <h2>Keeping children safe</h2>
          <p>
            Parents hold the account. Children get profiles, not logins with
            email addresses, and their sign-in reaches lessons and quizzes
            only — never billing details or anyone else&apos;s information. In
            live competitions there is no free-text chat, and every room is
            hosted by a verified adult.
          </p>

          <h2>Where we work</h2>
          <p>
            We run online classes for children anywhere, and in-person programs
            in Abuja. Our holiday bootcamps bring both together: live sessions
            during the week and a showcase at the end where every child
            presents what they built.
          </p>

          <p>
            <Link href="/programs" className="btn btn--primary">
              See upcoming programs
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
