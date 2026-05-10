import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { Link } from "react-router-dom";

export default function TermsOfService() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="January 6, 2026">
      <p>
        Welcome to Workie. These Terms of Service ("Terms") govern your use of our platform and services. By accessing
        or using Workie, you agree to be bound by these Terms.
      </p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By creating an account or using our services, you confirm that you are at least 16 years old and have the legal
        capacity to enter into these Terms. If you are using Workie on behalf of an organization, you represent that you
        have authority to bind that organization.
      </p>

      <h2>2. Description of Services</h2>
      <p>Workie provides a platform that connects:</p>
      <ul>
        <li>
          <strong>Job Seekers ("Workies"):</strong> Individuals looking for operational and non-specialised work
          opportunities
        </li>
        <li>
          <strong>Employers ("Workie-Makers"):</strong> Businesses and contractors seeking to hire workers
        </li>
      </ul>
      <p>We facilitate connections but are not a party to any employment relationship between users.</p>

      <h2>3. User Accounts</h2>
      <h3>3.1 Account Creation</h3>
      <p>
        You must provide accurate, complete information when creating an account. You are responsible for maintaining
        the confidentiality of your account credentials.
      </p>

      <h3>3.2 Account Types</h3>
      <ul>
        <li>
          <strong>Employee Account:</strong> For individuals seeking work opportunities
        </li>
        <li>
          <strong>Contractor Account:</strong> For businesses posting job listings
        </li>
      </ul>

      <h3>3.3 Account Termination</h3>
      <p>
        We reserve the right to suspend or terminate accounts that violate these Terms or engage in fraudulent activity.
      </p>

      <h2>4. User Conduct</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Provide false or misleading information</li>
        <li>Harass, abuse, or harm other users</li>
        <li>Post discriminatory or offensive content</li>
        <li>Use the platform for illegal purposes</li>
        <li>Attempt to circumvent our security measures</li>
        <li>Scrape or collect user data without permission</li>
        <li>Post job listings that violate employment laws</li>
      </ul>

      <h2>5. Job Listings and Applications</h2>
      <h3>5.1 For Employers</h3>
      <ul>
        <li>Job listings must be accurate and comply with NZ employment law</li>
        <li>Wages must meet or exceed the minimum wage ($23.95/hour as of 2026)</li>
        <li>You are responsible for verifying applicant eligibility to work</li>
        <li>Discrimination based on protected characteristics is prohibited</li>
      </ul>

      <h3>5.2 For Job Seekers</h3>
      <ul>
        <li>Profile information must be accurate and up-to-date</li>
        <li>You must have legal authorization to work in New Zealand</li>
        <li>Application limits apply based on your subscription tier</li>
      </ul>

      <h2>6. Payments and Subscriptions</h2>
      <h3>6.1 Pricing</h3>
      <p>All prices are displayed in New Zealand Dollars (NZD). GST is added at checkout where applicable.</p>

      <h3>6.2 Subscription Terms</h3>
      <ul>
        <li>Subscriptions auto-renew unless cancelled</li>
        <li>You can cancel at any time; access continues until the end of the billing period</li>
        <li>Refunds are available within 7 days of purchase for subscriptions</li>
      </ul>

      <h3>6.3 Payment Processing</h3>
      <p>Payments are processed securely through Stripe. We do not store your full payment card details.</p>

      <h2>7. Intellectual Property</h2>
      <p>
        All content, features, and functionality of Workie are owned by us and protected by intellectual property laws.
        You may not copy, modify, or distribute our content without permission.
      </p>

      <h2>8. Limitation of Liability</h2>
      <p>Workie is provided "as is" without warranties of any kind. We are not liable for:</p>
      <ul>
        <li>The conduct of users on or off the platform</li>
        <li>Employment decisions made by employers</li>
        <li>Disputes between employers and job seekers</li>
        <li>Loss of data or service interruptions</li>
        <li>Indirect, incidental, or consequential damages</li>
      </ul>

      <h2>9. Indemnification</h2>
      <p>
        You agree to indemnify and hold Workie harmless from any claims, damages, or expenses arising from your use of
        the platform or violation of these Terms.
      </p>

      <h2>10. Dispute Resolution</h2>
      <p>
        These Terms are governed by New Zealand law. Any disputes will be resolved through the New Zealand courts,
        unless we agree to alternative dispute resolution.
      </p>

      <h2>11. Changes to Terms</h2>
      <p>
        We may modify these Terms at any time. Continued use of Workie after changes constitutes acceptance of the new
        Terms.
      </p>

      <h2>12. Contact</h2>
      <p>For questions about these Terms, please contact us:</p>
      <ul>
        <li>Email: hello@workie.co.nz</li>
        <li>
          Contact form: <Link to="/contact">workie.co.nz/contact</Link>
        </li>
      </ul>
    </LegalPageLayout>
  );
}
