/**
 * Terms of use.
 *
 * Like the privacy policy, written from what the system actually does. Anything
 * commercial the business has not decided is marked [CONFIRM] rather than
 * invented — a refund policy nobody agreed to is worse than none, because
 * customers will hold you to it.
 *
 * NOT LEGAL ADVICE. Needs a lawyer's review before launch.
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms you agree to when using CodeEarly Club.",
};

const UPDATED = "31 July 2026";

export default function TermsPage() {
  return (
    <>
      <section className="x-head">
        <div className="x-wrap">
          <h1>Terms of Use</h1>
          <p>The agreement between you and CodeEarly Club. Last updated {UPDATED}.</p>
        </div>
      </section>

      <section className="x-sec">
        <div className="x-wrap x-prose">
          <h2>Who can hold an account</h2>
          <p>
            Accounts are held by a parent or guardian aged 18 or over. Children do
            not hold accounts with us — they have profiles under yours, and any
            sign-in you give them is yours to grant, change or withdraw.
          </p>
          <p>
            By adding a child you confirm you are their parent or legal guardian,
            or that you have that person&apos;s permission.
          </p>

          <h2>Your account</h2>
          <p>
            Keep your password to yourself, and treat your child&apos;s code and PIN
            the same way. If you think someone else has them, change them from your
            portal — issuing a new code immediately invalidates the old one and
            signs out any device using it.
          </p>
          <p>
            You are responsible for what happens under your account, including your
            child&apos;s activity.
          </p>

          <h2>Paying for courses and programs</h2>
          <p>
            Prices are shown before you pay and are charged in Nigerian Naira
            through Paystack. You get access once the payment is confirmed by
            Paystack, not before.
          </p>
          <p>
            Memberships run for the period you paid for. If a membership lapses,
            your child keeps everything already completed and their records remain
            visible — they simply cannot start new members-only material until it is
            renewed.
          </p>
          <p className="x-note">
            [CONFIRM] Refund and cancellation policy: how long after purchase a
            refund can be requested, what happens if a program is cancelled by us,
            and whether part-attended programs are refundable pro rata.
          </p>

          <h2>Programs and live classes</h2>
          <p>
            Program places are limited and allocated when payment completes. If we
            cancel a program, we will contact you and refund it. If your child
            cannot attend, tell us as early as you can so the place can go to
            another family.
          </p>

          <h2>Using the service properly</h2>
          <p>Please do not:</p>
          <ul className="x-tags" style={{ display: "block" }}>
            <li style={{ display: "inline-block" }}>share your account with other families</li>{" "}
            <li style={{ display: "inline-block" }}>copy or redistribute course material</li>{" "}
            <li style={{ display: "inline-block" }}>disrupt live quizzes or classes</li>{" "}
            <li style={{ display: "inline-block" }}>attempt to access another family&apos;s data</li>
          </ul>
          <p>
            In live quizzes, display names must be appropriate for a room full of
            children. We may remove a participant whose behaviour affects others,
            and we may suspend an account for serious or repeated breaches.
          </p>

          <h2>Course material</h2>
          <p>
            Lessons, videos and materials belong to CodeEarly Club and are licensed
            to you for your own child&apos;s learning. What your child creates in a
            lesson belongs to your child.
          </p>
          <p>
            We may feature a child&apos;s project in our showcase only with your
            explicit permission, and we will use a first name only.
          </p>

          <h2>Availability</h2>
          <p>
            We aim to keep the service running but cannot promise it will never be
            unavailable. Live sessions occasionally need rescheduling; we will tell
            you when that happens.
          </p>

          <h2>Ending the agreement</h2>
          <p>
            You can close your account at any time by contacting us. We may suspend
            or close an account that breaches these terms, and we will explain why.
            Ending the agreement does not affect anything already paid for and
            delivered.
          </p>

          <h2>Liability</h2>
          <p>
            We provide the service with reasonable skill and care. Nothing here
            limits liability where the law does not permit it, including for death
            or personal injury caused by negligence.
          </p>
          <p className="x-note">
            [CONFIRM] Any liability cap, and the governing law and jurisdiction
            clause — normally the courts of Nigeria.
          </p>

          <h2>Changes</h2>
          <p>
            If we change these terms in a way that materially affects you, we will
            email account holders rather than only updating this page.
          </p>

          <p>
            <Link className="btn-navy" href="/contact">
              Ask us about these terms →
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
