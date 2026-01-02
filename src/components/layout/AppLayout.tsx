import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Menu, X, LogOut, LayoutDashboard, MessageCircle, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useAuthContext } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import workieLogo from "@/assets/workie-logo.png";

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
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [userFullName, setUserFullName] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Hide authenticated navigation on auth/recovery pages
  const isAuthFlowRoute = ["/auth", "/forgot-password", "/reset-password"].includes(location.pathname);

  // Single source of truth for auth state (prevents tab-switch refresh loops)
  const { user, roles, signOut } = useAuthContext();

  const { unreadCount, unreadConversations } = useUnreadMessages(user?.id);

  // Check if user can see messages (employee or contractor)
  const canSeeMessages = roles.includes("employee") || roles.includes("contractor");

  // Fetch profile name (deferred outside auth listener)
  useEffect(() => {
    let active = true;

    const fetchUserProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", userId)
          .single();

        if (error) return null;
        return data?.full_name || null;
      } catch {
        return null;
      }
    };

    if (!user?.id) {
      setUserFullName(null);
      return;
    }

    setTimeout(async () => {
      const fullName = await fetchUserProfile(user.id);
      if (active) setUserFullName(fullName);
    }, 0);

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleConversationClick = (conversationId: string) => {
    setMessagesOpen(false);
    navigate(`/messages/${conversationId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      {!isAuthFlowRoute && (
        <nav
          className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
            scrolled
              ? "bg-background/95 backdrop-blur-lg border-b border-border/50 shadow-soft"
              : "bg-background/80 backdrop-blur-sm border-b border-border/30"
          }`}
        >
          <div className="container-tight">
            <div className="flex items-center justify-between h-16 lg:h-20">
              {/* Logo */}
              <Link to="/" className="group">
                <img
                  src={workieLogo}
                  alt="Workie"
                  className="h-10 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                />
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

                    {/* Unread Messages Indicator with Popover */}
                    {canSeeMessages && (
                      <Popover open={messagesOpen} onOpenChange={setMessagesOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" className="font-medium relative">
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Messages
                            {unreadCount > 0 && (
                              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                                {unreadCount > 9 ? "9+" : unreadCount}
                              </span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-80 p-0">
                          <div className="p-3 border-b border-border/50">
                            <h4 className="font-semibold text-sm">Messages</h4>
                            {unreadCount > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {unreadCount} unread message{unreadCount !== 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                          <div className="max-h-80 overflow-y-auto">
                            {unreadConversations.length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No new messages</p>
                              </div>
                            ) : (
                              <div className="divide-y divide-border/50">
                                {unreadConversations.map((conv) => (
                                  <button
                                    key={conv.id}
                                    onClick={() => handleConversationClick(conv.id)}
                                    className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                                  >
                                    <div className="flex items-start gap-2">
                                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <User className="w-4 h-4 text-primary" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="font-medium text-sm truncate">
                                            {conv.otherPartyName}
                                          </p>
                                          <Badge
                                            variant="secondary"
                                            className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0"
                                          >
                                            {conv.unreadCount}
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-primary/80 truncate font-medium">
                                          Re: {conv.jobTitle}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                          {conv.lastMessagePreview}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                                          {formatDistanceToNow(new Date(conv.lastMessageAt), {
                                            addSuffix: true,
                                          })}
                                        </p>
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="p-2 border-t border-border/50">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-xs"
                              onClick={() => {
                                setMessagesOpen(false);
                                navigate("/dashboard");
                              }}
                            >
                              View all conversations
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}

                    {/* User Info Dropdown Style */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/50 border border-border/50">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-medium text-foreground leading-tight">
                          {userFullName || user.email?.split("@")[0]}
                        </span>
                        <div className="flex gap-1">
                          {roles.slice(0, 2).map((role) => (
                            <Badge
                              key={role}
                              variant="secondary"
                              className={`text-[10px] px-1.5 py-0 h-4 capitalize ${getRoleBadgeColor(
                                role
                              )}`}
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
      )}

      {/* Main content with top padding for fixed navbar */}
      <main className={isAuthFlowRoute ? "" : "pt-16 lg:pt-20"}>{children}</main>
    </div>
  );
}
