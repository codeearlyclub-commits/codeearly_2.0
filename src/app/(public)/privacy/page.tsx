/**
 * Privacy policy.
 *
 * Written from what the system ACTUALLY does, not from a template — every claim
 * here corresponds to something in the codebase, and where it does not, the text
 * says so rather than promising it.
 *
 * NOT LEGAL ADVICE. Nigeria's NDPR applies, and if CodeEarly enrols children
 * outside Nigeria then GDPR (including the child-consent provisions) and COPPA
 * may too. This needs a lawyer's review before launch, and the items marked
 * [CONFIRM] need real answers from the business.
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How CodeEarly Club collects, uses and protects information — including children's data.",
};

const UPDATED = "31 July 2026";

export default function PrivacyPage() {
  return (
    <>
      <section className="x-head">
        <div className="x-wrap">
          <h1>Privacy Policy</h1>
          <p>
            How we handle your information, and your child&apos;s. Last updated{" "}
            {UPDATED}.
          </p>
        </div>
      </section>

      <section className="x-sec">
        <div className="x-wrap x-prose">
          <h2>The short version</h2>
          <p>
            Parents hold the account. We collect the least we can to run lessons,
            take payment and tell you how your child is getting on. We do not sell
            data, we do not advertise to children, and we do not run third-party
            analytics or tracking on any page a child uses.
          </p>

          <h2>Who we are</h2>
          <p>
            CodeEarly Club, a coding club for children. For any question about
            this policy or your data, email{" "}
            <a href="mailto:info@codeearly.com">info@codeearly.com</a>.
          </p>
          <p className="x-note">
            [CONFIRM] Registered company name, registration number and business
            address, and the named contact responsible for data protection.
          </p>

          <h2>What we collect</h2>
          <p>
            <b>From the parent:</b> your name, email address, and phone number if
            you give one. Your password is stored only as a cryptographic hash —
            we cannot read it, and neither can anyone who obtains the database.
          </p>
          <p>
            <b>About your child:</b> their first name (or whatever name you enter),
            date of birth and gender if you provide them, and a membership ID we
            generate. <b>We do not collect an email address or a phone number for
            any child.</b>
          </p>
          <p>
            <b>As they learn:</b> which lessons they opened and completed, how long
            they were actively reading, quiz answers and scores, and courses or
            programs they joined. This is what report cards and certificates are
            built from.
          </p>
          <p>
            <b>Payments:</b> handled by Paystack. Card details are entered on
            Paystack&apos;s systems and never reach ours — we store only the amount,
            a transaction reference and whether it succeeded.
          </p>

          <h2>Children&apos;s sign-in</h2>
          <p>
            If you choose to give your child their own access, they receive a short
            code and a 4-digit PIN that you can change or switch off at any time.
            That sign-in reaches lessons and quizzes only. It cannot see billing,
            your account details, or anything belonging to a sibling.
          </p>

          <h2>What we do not do</h2>
          <p>
            We do not sell or rent personal data. We do not show advertising. We do
            not place third-party analytics, advertising or social media tracking
            on pages children use — this is a deliberate technical decision, not
            only a policy one. We do not ask children for personal information
            beyond the display name they play quizzes under, which is filtered.
          </p>

          <h2>Who else processes data for us</h2>
          <p>
            We use a small number of providers to run the service, each handling
            only what their job requires:
          </p>
          <ul className="x-tags" style={{ display: "block" }}>
            <li style={{ display: "inline-block" }}>Paystack — payments</li>{" "}
            <li style={{ display: "inline-block" }}>Resend — email delivery</li>{" "}
            <li style={{ display: "inline-block" }}>Cloudflare — hosting and security</li>
          </ul>
          <p className="x-note">
            [CONFIRM] Add the hosting provider and region once deployment is
            settled, and any file-storage provider once configured.
          </p>

          <h2>How long we keep it</h2>
          <p>
            While your account is open, and for as long as we are legally required
            to keep financial records afterwards. Payment and invoice records are
            kept for accounting purposes even after an account closes. Certificates
            remain verifiable after issue, because a school may check one years
            later — a certificate that stopped verifying would be worthless.
          </p>
          <p className="x-note">[CONFIRM] The exact retention period for accounting records.</p>

          <h2>Your rights</h2>
          <p>
            You can ask us for a copy of the information we hold about you and your
            child, ask us to correct it, or ask us to delete the account. Email{" "}
            <a href="mailto:info@codeearly.com">info@codeearly.com</a> and we will
            respond within 30 days. Deleting an account removes the profiles and
            learning history; financial records and issued certificates are
            retained as described above.
          </p>

          <h2>Security</h2>
          <p>
            Traffic is encrypted in transit. Passwords are hashed, and children&apos;s
            PINs are hashed with a deliberate lockout after repeated wrong attempts.
            Access to production data is limited to staff who need it, and staff
            access to a family&apos;s account is recorded.
          </p>
          <p>
            No system is perfectly secure. If a breach ever affects your data, we
            will tell you and the relevant authority promptly rather than quietly.
          </p>

          <h2>Changes</h2>
          <p>
            If we change this policy in a way that materially affects you, we will
            email account holders rather than only updating this page.
          </p>

          <p>
            <Link className="btn-navy" href="/contact">
              Ask us about privacy →
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
