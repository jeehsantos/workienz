import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ScrollToTop } from "@/components/ScrollToTop";
import { Loader2 } from "lucide-react";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";

// Lazy load all route components for code splitting
const Index = lazy(() => import("./pages/Index"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PostJob = lazy(() => import("./pages/contractor/PostJob"));
const EditJob = lazy(() => import("./pages/contractor/EditJob"));
const MyJobs = lazy(() => import("./pages/contractor/MyJobs"));
const ContractorJobDetail = lazy(() => import("./pages/contractor/ContractorJobDetail"));
const SearchWorkers = lazy(() => import("./pages/contractor/SearchWorkers"));
const ContractorProfile = lazy(() => import("./pages/contractor/ContractorProfile"));
const VerifyCompany = lazy(() => import("./pages/contractor/VerifyCompany"));
const JobApplicants = lazy(() => import("./pages/contractor/JobApplicants"));
const TalentPool = lazy(() => import("./pages/contractor/TalentPool"));
const JobSearch = lazy(() => import("./pages/employee/JobSearch"));
const MyPools = lazy(() => import("./pages/employee/MyPools"));
const MyShifts = lazy(() => import("./pages/employee/MyShifts"));
const VerifyWorkRights = lazy(() => import("./pages/employee/VerifyWorkRights"));
const EmployeeProfile = lazy(() => import("./pages/employee/EmployeeProfile"));
const ViewProfile = lazy(() => import("./pages/employee/ViewProfile"));
const Articles = lazy(() => import("./pages/employee/Articles"));
const ArticleDetail = lazy(() => import("./pages/ArticleDetail"));
const JobDetail = lazy(() => import("./pages/JobDetail"));
const NewArticle = lazy(() => import("./pages/writer/NewArticle"));
const MyArticles = lazy(() => import("./pages/writer/MyArticles"));
const EditArticle = lazy(() => import("./pages/writer/EditArticle"));
const NewGuideArticle = lazy(() => import("./pages/writer/NewGuideArticle"));
const WorkerProfile = lazy(() => import("./pages/WorkerProfile"));
const Conversation = lazy(() => import("./pages/Conversation"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminPartners = lazy(() => import("./pages/admin/AdminPartners"));
const AdminArticleManagement = lazy(() => import("./pages/admin/AdminArticleManagement"));
const AdminContentStructure = lazy(() => import("./pages/admin/AdminContentStructure"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const GuideHub = lazy(() => import("./pages/content/GuideHub"));
const Contact = lazy(() => import("./pages/Contact"));
const About = lazy(() => import("./pages/About"));
const Checkout = lazy(() => import("./pages/Checkout"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const Subscription = lazy(() => import("./pages/Subscription"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Settings = lazy(() => import("./pages/Settings"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/jobs" element={<JobSearch />} />
                <Route path="/jobs/:id" element={<JobDetail />} />
                <Route path="/articles" element={<Articles />} />
                <Route path="/articles/:slug" element={<ArticleDetail />} />
                <Route path="/contractor/post-job" element={<PostJob />} />
                <Route path="/contractor/jobs" element={<MyJobs />} />
                <Route path="/contractor/jobs/:jobId" element={<ContractorJobDetail />} />
                <Route path="/contractor/jobs/:jobId/edit" element={<EditJob />} />
                <Route path="/contractor/jobs/:jobId/applicants" element={<JobApplicants />} />
                <Route path="/contractor/talent-pool" element={<TalentPool />} />
                <Route path="/contractor/profile" element={<ContractorProfile />} />
                <Route path="/contractor/verify" element={<VerifyCompany />} />
                <Route path="/contractor/search-workers" element={<SearchWorkers />} />
                <Route path="/employee/profile" element={<EmployeeProfile />} />
                <Route path="/employee/view-profile" element={<ViewProfile />} />
                <Route path="/employee/pools" element={<MyPools />} />
                <Route path="/employee/shifts" element={<MyShifts />} />
                <Route path="/employee/verify" element={<VerifyWorkRights />} />
                <Route path="/employee/profile" element={<EmployeeProfile />} />
                <Route path="/employee/view-profile" element={<ViewProfile />} />
                <Route path="/workers/:id" element={<WorkerProfile />} />
                <Route path="/messages/:id" element={<Conversation />} />
                <Route path="/writer/new-article" element={<NewArticle />} />
                <Route path="/writer/new-guide" element={<NewGuideArticle />} />
                <Route path="/writer/articles" element={<MyArticles />} />
                <Route path="/writer/articles/:id/edit" element={<EditArticle />} />
                <Route path="/guide" element={<GuideHub />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/partners" element={<AdminPartners />} />
                <Route path="/admin/articles" element={<AdminArticleManagement />} />
                <Route path="/admin/categories" element={<AdminArticleManagement />} />
                <Route path="/admin/content-structure" element={<AdminContentStructure />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/about" element={<About />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/checkout/success" element={<CheckoutSuccess />} />
                <Route path="/subscription" element={<Subscription />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/cookies" element={<CookiePolicy />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/settings" element={<Settings />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AppLayout>
        </AuthProvider>
        <CookieConsentBanner />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
