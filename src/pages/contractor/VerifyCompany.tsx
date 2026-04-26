import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { ContractorVerificationFlow } from "@/components/contractor/ContractorVerificationFlow";

export default function VerifyCompany() {
  const navigate = useNavigate();
  const { user, isLoading, isContractor } = useAuthContext();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!isContractor()) {
      navigate("/dashboard");
    }
  }, [user, isLoading, isContractor, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container-tight py-8 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 font-display">Company Verification</h1>
          <p className="text-muted-foreground">
            Verify your business with the NZ Business Number (NZBN) to start posting jobs on Workie.
          </p>
        </div>
        <ContractorVerificationFlow />
      </div>
    </div>
  );
}
