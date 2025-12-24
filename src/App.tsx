import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Pricing from "./pages/Pricing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import PostJob from "./pages/contractor/PostJob";
import MyJobs from "./pages/contractor/MyJobs";
import SearchWorkers from "./pages/contractor/SearchWorkers";
import ContractorProfile from "./pages/contractor/ContractorProfile";
import JobApplicants from "./pages/contractor/JobApplicants";
import JobSearch from "./pages/employee/JobSearch";
import EmployeeProfile from "./pages/employee/EmployeeProfile";
import Articles from "./pages/employee/Articles";
import JobDetail from "./pages/JobDetail";
import NewArticle from "./pages/writer/NewArticle";
import MyArticles from "./pages/writer/MyArticles";
import WorkerProfile from "./pages/WorkerProfile";
import Conversation from "./pages/Conversation";
import AdminDashboard from "./pages/admin/AdminDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/jobs" element={<JobSearch />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/articles" element={<Articles />} />
            <Route path="/contractor/post-job" element={<PostJob />} />
            <Route path="/contractor/jobs" element={<MyJobs />} />
            <Route path="/contractor/jobs/:jobId/applicants" element={<JobApplicants />} />
            <Route path="/contractor/profile" element={<ContractorProfile />} />
            <Route path="/contractor/search-workers" element={<SearchWorkers />} />
            <Route path="/employee/profile" element={<EmployeeProfile />} />
            <Route path="/workers/:id" element={<WorkerProfile />} />
            <Route path="/messages/:id" element={<Conversation />} />
            <Route path="/writer/new-article" element={<NewArticle />} />
            <Route path="/writer/articles" element={<MyArticles />} />
            <Route path="/admin" element={<AdminDashboard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
