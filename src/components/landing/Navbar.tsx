import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import workieLogo from "@/assets/workie-logo.png";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled 
        ? "bg-background/95 backdrop-blur-lg border-b border-border/50 shadow-soft" 
        : "bg-transparent"
    }`}>
      <div className="container-tight">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link to="/" className="group">
            <img 
              src={workieLogo} 
              alt="Workie" 
              className="h-[25px] w-[195px] object-contain group-hover:scale-105 transition-transform duration-300" 
            />
          </Link>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <>
                <Button variant="ghost" asChild className="font-medium">
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleSignOut}
                  className="rounded-xl hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild className="font-medium">
                  <Link to="/auth">Sign In</Link>
                </Button>
                <Button variant="hero" asChild className="rounded-xl shadow-soft hover:shadow-medium">
                  <Link to="/auth?mode=signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 rounded-xl hover:bg-muted transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <X className="w-6 h-6 text-foreground" />
            ) : (
              <Menu className="w-6 h-6 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="lg:hidden py-4 border-t border-border/50 animate-fade-in bg-background/95 backdrop-blur-lg rounded-b-2xl">
            <div className="flex flex-col gap-3">
              {user ? (
                <>
                  <Button variant="outline" asChild className="rounded-xl">
                    <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                      Dashboard
                    </Link>
                  </Button>
                  <Button variant="ghost" onClick={handleSignOut} className="rounded-xl">
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" asChild className="rounded-xl">
                    <Link to="/auth" onClick={() => setIsOpen(false)}>
                      Sign In
                    </Link>
                  </Button>
                  <Button variant="hero" asChild className="rounded-xl">
                    <Link to="/auth?mode=signup" onClick={() => setIsOpen(false)}>
                      Get Started
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
