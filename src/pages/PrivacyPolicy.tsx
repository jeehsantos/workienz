import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="January 6, 2026">
      <p>
        At Workie ("we", "us", or "our"), we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
      </p>

      <h2>1. Information We Collect</h2>
      
      <h3>1.1 Personal Information</h3>
      <p>We collect information you provide directly to us, including:</p>
      <ul>
        <li>Name, email address, and phone number</li>
        <li>Profile information (skills, work experience, availability)</li>
        <li>Location data (region, city, suburb)</li>
        <li>IRD number (for tax purposes, stored securely)</li>
        <li>Payment information (processed securely via Stripe)</li>
        <li>Communications and messages sent through our platform</li>
      </ul>

      <h3>1.2 Automatically Collected Information</h3>
      <p>When you access our platform, we automatically collect:</p>
      <ul>
        <li>Device information (browser type, operating system)</li>
        <li>IP address and general location</li>
        <li>Usage data (pages visited, features used, time spent)</li>
        <li>Cookies and similar tracking technologies</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Provide, maintain, and improve our services</li>
        <li>Connect job seekers with employers</li>
        <li>Process transactions and send related information</li>
        <li>Send notifications about job opportunities and applications</li>
        <li>Respond to your comments, questions, and support requests</li>
        <li>Monitor and analyze trends, usage, and activities</li>
        <li>Detect, investigate, and prevent fraudulent transactions</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2>3. Information Sharing</h2>
      <p>We may share your information in the following circumstances:</p>
      <ul>
        <li><strong>With Employers/Job Seekers:</strong> Your profile information is shared with relevant parties to facilitate job connections</li>
        <li><strong>Service Providers:</strong> We use third-party services (Supabase, Stripe) to operate our platform</li>
        <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
        <li><strong>Business Transfers:</strong> In connection with any merger or acquisition</li>
      </ul>

      <h2>4. Data Security</h2>
      <p>
        We implement appropriate technical and organizational measures to protect your personal information, including encryption, secure servers, and access controls. However, no method of transmission over the Internet is 100% secure.
      </p>

      <h2>5. Your Rights</h2>
      <p>Under the New Zealand Privacy Act 2020, you have the right to:</p>
      <ul>
        <li>Access your personal information</li>
        <li>Request correction of inaccurate information</li>
        <li>Request deletion of your information</li>
        <li>Withdraw consent for data processing</li>
        <li>Lodge a complaint with the Privacy Commissioner</li>
      </ul>

      <h2>6. Data Retention</h2>
      <p>
        We retain your personal information for as long as your account is active or as needed to provide services. We may retain certain information for legitimate business purposes or as required by law.
      </p>

      <h2>7. Children's Privacy</h2>
      <p>
        Our services are not intended for individuals under 16 years of age. We do not knowingly collect personal information from children under 16.
      </p>

      <h2>8. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
      </p>

      <h2>9. Contact Us</h2>
      <p>
        If you have any questions about this Privacy Policy, please contact us at:
      </p>
      <ul>
        <li>Email: privacy@workie.co.nz</li>
        <li>Contact form: <Link to="/contact">workie.co.nz/contact</Link></li>
      </ul>
    </LegalPageLayout>
  );
}
