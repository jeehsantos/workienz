import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="March 9, 2026">
      <p>
        At Workie ("we", "us", or "our"), we are committed to protecting your privacy and ensuring the security of your
        personal information in accordance with the New Zealand Privacy Act 2020 and its 13 Information Privacy
        Principles. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you
        use our platform.
      </p>

      <h2>1. Information We Collect and Why</h2>

      <h3>1.1 Personal Information You Provide</h3>
      <p>
        We collect information you provide directly to us. Below we explain each category and the specific purpose for
        collection:
      </p>
      <ul>
        <li>
          <strong>Name and email address</strong> — to create and manage your account, communicate with you, and verify
          your identity
        </li>
        <li>
          <strong>Phone number</strong> — to enable direct communication between employers and job seekers when mutually
          agreed
        </li>
        <li>
          <strong>Profile information (skills, work experience, availability, bio)</strong> — to match you with relevant
          job opportunities or suitable candidates
        </li>
        <li>
          <strong>Location data (region, city, suburb)</strong> — to show jobs near you and help employers find local
          workers
        </li>
        <li>
          <strong>IRD number</strong> (if provided, stored securely and encrypted) — to assist with employment tax
          obligations as required by New Zealand law
        </li>
        <li>
          <strong>Payment information</strong> — processed securely by our payment processor (Stripe) to complete
          transactions; we do not store credit card details
        </li>
        <li>
          <strong>Messages sent through our platform</strong> — to facilitate communication between employers and job
          seekers
        </li>
      </ul>

      <h3>1.2 Automatically Collected Information</h3>
      <p>When you access our platform, we automatically collect:</p>
      <ul>
        <li>
          <strong>Device information</strong> (browser type, operating system) — to ensure our platform works correctly
          on your device
        </li>
        <li>
          <strong>IP address and general location</strong> — for security purposes, fraud prevention, and analytics
        </li>
        <li>
          <strong>Usage data</strong> (pages visited, features used, time spent) — to improve our services and user
          experience
        </li>
        <li>
          <strong>Cookies and similar tracking technologies</strong> — see our <Link to="/cookies">Cookie Policy</Link>{" "}
          for details
        </li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Provide, maintain, and improve our services</li>
        <li>Connect job seekers with employers</li>
        <li>Process transactions and send related information</li>
        <li>Send notifications about job opportunities and applications</li>
        <li>Respond to your comments, questions, and support requests</li>
        <li>Monitor and analyse trends, usage, and activities</li>
        <li>Detect, investigate, and prevent fraudulent transactions</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2>3. Information Sharing</h2>
      <p>We may share your information in the following circumstances:</p>
      <ul>
        <li>
          <strong>With Employers/Job Seekers:</strong> Your profile information is shared with relevant parties to
          facilitate job connections
        </li>
        <li>
          <strong>Service Providers:</strong> We use third-party cloud infrastructure and payment processors to operate
          our platform. These providers are contractually required to protect your data.
        </li>
        <li>
          <strong>Legal Requirements:</strong> When required by law or to protect our rights
        </li>
        <li>
          <strong>Business Transfers:</strong> In connection with any merger or acquisition
        </li>
      </ul>

      <h2>4. International Data Transfers</h2>
      <p>
        Our platform uses cloud infrastructure and third-party services that may process and store data on servers
        located outside New Zealand, including in the United States, Australia, and other countries. These transfers are
        necessary to provide our services effectively.
      </p>
      <p>
        Where your personal information is transferred overseas, we take reasonable steps to ensure the recipient
        provides comparable privacy protections to those required under the New Zealand Privacy Act 2020. Our service
        providers are contractually bound to handle your data securely and only for the purposes we specify.
      </p>

      <h2>5. Data Security</h2>
      <p>
        We implement appropriate technical and organisational measures to protect your personal information, including
        encryption at rest and in transit (TLS 1.3), row-level security policies on our database, secure authentication,
        and access controls. However, no method of transmission over the Internet is 100% secure.
      </p>

      <h2>6. Your Rights</h2>
      <p>Under the New Zealand Privacy Act 2020, you have the right to:</p>
      <ul>
        <li>
          <strong>Access your personal information</strong> — you can request a copy of the data we hold about you
        </li>
        <li>
          <strong>Request correction</strong> of inaccurate information — you can update your profile directly or
          contact us
        </li>
        <li>
          <strong>Request deletion</strong> of your information — you can request account deletion via your{" "}
          <Link to="/settings">Settings</Link> page or by contacting us
        </li>
        <li>
          <strong>Withdraw consent</strong> for data processing
        </li>
        <li>
          <strong>Lodge a complaint</strong> with the Office of the Privacy Commissioner at{" "}
          <a href="https://www.privacy.org.nz" target="_blank" rel="noopener noreferrer">
            privacy.org.nz
          </a>
        </li>
      </ul>
      <p>
        To exercise any of these rights, please visit your <Link to="/settings">account settings</Link> or email us at{" "}
        <a href="mailto:hello@workie.co.nz">hello@workie.co.nz</a>. We will respond within 20 working days as required
        by the Privacy Act.
      </p>

      <h2>7. Data Retention</h2>
      <p>We retain your personal information according to the following schedule:</p>
      <ul>
        <li>
          <strong>Account and profile data</strong> — retained while your account is active; deleted upon account
          deletion request
        </li>
        <li>
          <strong>Messages and conversations</strong> — retained for 90 days after conversation closure, then
          permanently deleted
        </li>
        <li>
          <strong>Job applications</strong> — retained for 12 months after the job closes, then anonymised
        </li>
        <li>
          <strong>Payment records</strong> — retained for 7 years to comply with New Zealand tax obligations
        </li>
        <li>
          <strong>Usage analytics</strong> — retained in aggregated, non-identifiable form
        </li>
      </ul>
      <p>You may request early deletion of your data at any time, subject to legal retention requirements.</p>

      <h2>8. Notifiable Privacy Breaches</h2>
      <p>In the event of a privacy breach that is likely to cause serious harm, we will:</p>
      <ul>
        <li>
          Notify the Office of the Privacy Commissioner as soon as practicable, and no later than 72 hours after
          becoming aware of the breach
        </li>
        <li>
          Notify affected individuals as soon as practicable, providing details of the breach, what information was
          involved, and what steps they can take
        </li>
        <li>Take immediate steps to contain the breach and prevent further unauthorised access</li>
        <li>Document the breach and our response for review</li>
      </ul>

      <h2>9. Children's Privacy</h2>
      <p>
        Our services are not intended for individuals under 16 years of age. We do not knowingly collect personal
        information from children under 16.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the
        new policy on this page, updating the "Last updated" date, and where appropriate, sending you an email
        notification.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        If you have any questions about this Privacy Policy or wish to exercise your rights, please contact our Privacy
        Officer:
      </p>
      <ul>
        <li>
          Email: <a href="mailto:hello@workie.co.nz">hello@workie.co.nz</a>
        </li>
        <li>
          Contact form: <Link to="/contact">workie.co.nz/contact</Link>
        </li>
      </ul>
      <p>
        If you are not satisfied with our response, you may lodge a complaint with the Office of the Privacy
        Commissioner at{" "}
        <a href="https://www.privacy.org.nz" target="_blank" rel="noopener noreferrer">
          privacy.org.nz
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}
