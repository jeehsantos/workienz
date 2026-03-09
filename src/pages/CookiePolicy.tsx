import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { Link } from "react-router-dom";

export default function CookiePolicy() {
  return (
    <LegalPageLayout title="Cookie Policy" lastUpdated="January 6, 2026">
      <p>
        This Cookie Policy explains how Workie ("we", "us", or "our") uses cookies and similar technologies when you visit our platform. By using Workie, you consent to the use of cookies as described in this policy.
      </p>

      <h2>1. What Are Cookies?</h2>
      <p>
        Cookies are small text files that are stored on your device when you visit a website. They help websites remember your preferences, understand how you use the site, and improve your experience.
      </p>

      <h2>2. Types of Cookies We Use</h2>
      
      <h3>2.1 Essential Cookies</h3>
      <p>
        These cookies are necessary for the platform to function properly. They enable core features like:
      </p>
      <ul>
        <li>User authentication and session management</li>
        <li>Security features and fraud prevention</li>
        <li>Load balancing and server optimization</li>
      </ul>
      <p><strong>Provider:</strong> Cloud authentication provider, Workie</p>

      <h3>2.2 Functional Cookies</h3>
      <p>
        These cookies remember your preferences and choices to provide a more personalized experience:
      </p>
      <ul>
        <li>Language and region preferences</li>
        <li>Theme settings (light/dark mode)</li>
        <li>Recently viewed jobs or profiles</li>
      </ul>

      <h3>2.3 Analytics Cookies</h3>
      <p>
        We use analytics cookies to understand how visitors interact with our platform:
      </p>
      <ul>
        <li>Pages visited and time spent</li>
        <li>Features used and user flows</li>
        <li>Error tracking and performance monitoring</li>
      </ul>
      <p><strong>Provider:</strong> Vercel Analytics (privacy-focused, no personal data collection)</p>

      <h3>2.4 Payment Cookies</h3>
      <p>
        When you make a payment, our payment processor uses cookies to:
      </p>
      <ul>
        <li>Process transactions securely</li>
        <li>Prevent fraud</li>
        <li>Remember payment preferences</li>
      </ul>
      <p><strong>Provider:</strong> Stripe</p>

      <h2>3. Third-Party Cookies</h2>
      <p>We use the following third-party services that may set cookies:</p>
      
      <table className="w-full border-collapse my-6">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 font-semibold">Service</th>
            <th className="text-left py-3 px-4 font-semibold">Purpose</th>
            <th className="text-left py-3 px-4 font-semibold">Privacy Policy</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border/50">
            <td className="py-3 px-4">Cloud Authentication Provider</td>
            <td className="py-3 px-4">Authentication & Database</td>
            <td className="py-3 px-4">Available on request</td>
          </tr>
          <tr className="border-b border-border/50">
            <td className="py-3 px-4">Stripe</td>
            <td className="py-3 px-4">Payment Processing</td>
            <td className="py-3 px-4"><a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">View Policy</a></td>
          </tr>
          <tr className="border-b border-border/50">
            <td className="py-3 px-4">Vercel</td>
            <td className="py-3 px-4">Hosting & Analytics</td>
            <td className="py-3 px-4"><a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">View Policy</a></td>
          </tr>
        </tbody>
      </table>

      <h2>4. Cookie Duration</h2>
      <ul>
        <li><strong>Session Cookies:</strong> Deleted when you close your browser</li>
        <li><strong>Persistent Cookies:</strong> Remain on your device for a set period (typically 30 days to 1 year)</li>
      </ul>

      <h2>5. Managing Cookies</h2>
      <p>You can control cookies through your browser settings:</p>
      <ul>
        <li><strong>Chrome:</strong> Settings → Privacy and Security → Cookies</li>
        <li><strong>Firefox:</strong> Settings → Privacy & Security → Cookies</li>
        <li><strong>Safari:</strong> Preferences → Privacy → Cookies</li>
        <li><strong>Edge:</strong> Settings → Cookies and Site Permissions</li>
      </ul>
      <p>
        Note: Blocking essential cookies may prevent you from using certain features of Workie, including logging in and making payments.
      </p>

      <h2>6. Do Not Track</h2>
      <p>
        Some browsers have a "Do Not Track" feature. We currently do not respond to DNT signals, but we limit tracking to essential analytics only.
      </p>

      <h2>7. Updates to This Policy</h2>
      <p>
        We may update this Cookie Policy from time to time. Changes will be posted on this page with an updated "Last updated" date.
      </p>

      <h2>8. Contact Us</h2>
      <p>
        If you have questions about our use of cookies, please contact us:
      </p>
      <ul>
        <li>Email: privacy@workie.co.nz</li>
        <li>Contact form: <Link to="/contact">workie.co.nz/contact</Link></li>
      </ul>

      <h2>9. Related Policies</h2>
      <ul>
        <li><Link to="/privacy">Privacy Policy</Link></li>
        <li><Link to="/terms">Terms of Service</Link></li>
      </ul>
    </LegalPageLayout>
  );
}
