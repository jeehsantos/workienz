import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, X, LogOut, LayoutDashboard, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import linkoLogo from "@/assets/linko-logo-new.png";

type AppRole = "admin" | "contractor" | "employee" | "writer";

interface AppLayoutProps {
  children: React.ReactNode;
}

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case "admin":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "contractor":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "employee":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "writer":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export function AppLayout({ children }: AppLayoutProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [userFullName, setUserFullName] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const { unreadCount } = useUnreadMessages(user?.id);

  // Check if user can see messages (employee or contractor)
  const canSeeMessages = roles.includes("employee") || roles.includes("contractor");

  useEffect(() => {
    const fetchUserRoles = async (userId: string) => {
      try {
        const { data, error } = await supabase.rpc("get_user_roles", {
          _user_id: userId,
        });
        if (error) {
          console.error("Error fetching roles:", error);
          return [];
        }
        return (data as AppRole[]) || [];
      } catch (error) {
        console.error("Error fetching roles:", error);
        return [];
      }
    };

    const fetchUserProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", userId)
          .single();
        if (error) {
          console.error("Error fetching profile:", error);
          return null;
        }
        return data?.full_name || null;
      } catch (error) {
        console.error("Error fetching profile:", error);
        return null;
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const [fetchedRoles, fullName] = await Promise.all([
          fetchUserRoles(session.user.id),
          fetchUserProfile(session.user.id)
        ]);
        setRoles(fetchedRoles);
        setUserFullName(fullName);
      } else {
        setRoles([]);
        setUserFullName(null);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const [fetchedRoles, fullName] = await Promise.all([
          fetchUserRoles(session.user.id),
          fetchUserProfile(session.user.id)
        ]);
        setRoles(fetchedRoles);
        setUserFullName(fullName);
      }
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
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? "bg-background/95 backdrop-blur-lg border-b border-border/50 shadow-soft" 
          : "bg-background/80 backdrop-blur-sm border-b border-border/30"
      }`}>
        <div className="container-tight">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="relative">
                <img 
                  src={linkoLogo} 
                  alt="Linko" 
                  className="w-10 h-10 rounded-xl shadow-soft group-hover:scale-105 transition-transform duration-300" 
                />
              </div>
              <span className="text-xl font-bold font-display text-foreground tracking-tight">
                Linko
              </span>
            </Link>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-2">
              {user ? (
                <>
                  <Button variant="ghost" asChild className="font-medium">
                    <Link to="/dashboard">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </Link>
                  </Button>
                  
                  {/* Unread Messages Indicator */}
                  {canSeeMessages && (
                    <Button variant="ghost" asChild className="font-medium relative">
                      <Link to="/dashboard">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Messages
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        )}
                      </Link>
                    </Button>
                  )}
                  
                  {/* User Info Dropdown Style */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/50 border border-border/50">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-medium text-foreground leading-tight">
                        {userFullName || user.email?.split('@')[0]}
                      </span>
                      <div className="flex gap-1">
                        {roles.slice(0, 2).map((role) => (
                          <Badge 
                            key={role} 
                            variant="secondary" 
                            className={`text-[10px] px-1.5 py-0 h-4 capitalize ${getRoleBadgeColor(role)}`}
                          >
                            {role}
                          </Badge>
                        ))}
                        {roles.length > 2 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            +{roles.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleSignOut}
                    className="rounded-xl hover:bg-destructive/10 hover:text-destructive h-9 w-9"
                    title="Sign Out"
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
                    {/* Mobile User Info */}
                    <div className="flex flex-col items-center pb-3 border-b border-border/30">
                      <span className="text-sm font-medium text-foreground">
                        {userFullName || user.email}
                      </span>
                      <div className="flex gap-1 mt-1">
                        {roles.map((role) => (
                          <Badge 
                            key={role} 
                            variant="secondary" 
                            className={`text-xs capitalize ${getRoleBadgeColor(role)}`}
                          >
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
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

      {/* Main content with top padding for fixed navbar */}
      <main className="pt-16 lg:pt-20">
        {children}
      </main>
    </div>
  );
}
