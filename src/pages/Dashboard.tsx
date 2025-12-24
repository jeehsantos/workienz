import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, User, Briefcase, FileText, Settings, Users, MessageCircle } from "lucide-react";
import MyConversations from "@/components/dashboard/MyConversations";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, roles, isLoading, signOut, isAdmin, isContractor, isEmployee, isWriter } = useAuthContext();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-destructive/10 text-destructive";
      case "contractor":
        return "bg-accent/20 text-accent-foreground";
      case "employee":
        return "bg-primary/10 text-primary";
      case "writer":
        return "bg-secondary text-secondary-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container-tight flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg font-display">K</span>
            </div>
            <span className="text-xl font-bold font-display">Kiwi Hunters</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user.email}</p>
              <div className="flex gap-1 justify-end">
                {roles.map((role) => (
                  <span
                    key={role}
                    className={`text-xs px-2 py-0.5 rounded-full capitalize ${getRoleBadgeColor(role)}`}
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="container-tight py-8">
        <h1 className="text-3xl font-bold mb-2 font-display">Dashboard</h1>
        <p className="text-muted-foreground mb-8">
          Welcome back! Here's what you can do today.
        </p>

        {/* Quick actions grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Profile Card - Employee */}
          {isEmployee() && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <User className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">My Profile</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Set up your profile so contractors can find you.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/employee/profile">Edit Profile</Link>
              </Button>
            </div>
          )}

          {/* Profile Card - Contractor */}
          {isContractor() && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
                <User className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Company Profile</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Update your company information.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/contractor/profile">Edit Profile</Link>
              </Button>
            </div>
          )}

          {/* Contractor: Post Jobs */}
          {isContractor() && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
                <Briefcase className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Post a Job</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Create a new job posting to find workers.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/contractor/post-job">Post Job</Link>
              </Button>
            </div>
          )}

          {/* Contractor: My Jobs */}
          {isContractor() && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">My Jobs</h3>
              <p className="text-muted-foreground text-sm mb-4">
                View and manage your job postings.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/contractor/jobs">View Jobs</Link>
              </Button>
            </div>
          )}

          {/* Contractor-specific: Find Workers */}
          {isContractor() && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Find Workers</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Search through verified workers and fill positions quickly.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/contractor/search-workers">Browse Workers</Link>
              </Button>
            </div>
          )}

          {/* Employee-specific */}
          {isEmployee() && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Briefcase className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Find Jobs</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Browse available positions and apply for jobs.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/jobs">Browse Jobs</Link>
              </Button>
            </div>
          )}

          {/* Writer-specific */}
          {isWriter() && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-secondary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Write Article</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Create educational content for employees.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/writer/new-article">Write Article</Link>
              </Button>
            </div>
          )}

          {/* Writer: My Articles */}
          {isWriter() && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-secondary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">My Articles</h3>
              <p className="text-muted-foreground text-sm mb-4">
                View and manage your published articles.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/writer/articles">View Articles</Link>
              </Button>
            </div>
          )}

          {/* Admin-specific */}
          {isAdmin() && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center mb-4">
                <Settings className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Admin Dashboard</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Manage users, contractors, jobs, and subscriptions.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin">Open Admin</Link>
              </Button>
            </div>
          )}

          {/* Articles (for employees) */}
          {isEmployee() && (
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-secondary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Learning Center</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Access articles and guides to boost your career.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/articles">Browse Articles</Link>
              </Button>
            </div>
          )}
        </div>

        {/* My Conversations Section - for employees and contractors */}
        {(isEmployee() || isContractor()) && user && (
          <div className="mt-8">
            <div className="bg-card rounded-xl p-6 shadow-soft border border-border/50">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold font-display">My Conversations</h2>
              </div>
              <MyConversations userId={user.id} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
