import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const COOKIE_CONSENT_KEY = "cookie_consent";

type ConsentValue = "all" | "essential";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleConsent = (value: ConsentValue) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-xl rounded-xl border bg-card p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-3 flex-1">
            <p className="text-sm text-foreground leading-relaxed">
              We use cookies to keep you signed in and improve your experience. You can read more in our{" "}
              <Link to="/cookies" className="text-primary hover:underline font-medium">
                Cookie Policy
              </Link>.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => handleConsent("all")}>
                Accept All
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleConsent("essential")}>
                Essential Only
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
