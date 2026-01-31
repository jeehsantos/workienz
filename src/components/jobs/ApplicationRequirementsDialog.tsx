import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  CheckCircle2, 
  XCircle, 
  Car, 
  Dumbbell, 
  Clock, 
  Shield, 
  Loader2,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

interface Requirement {
  type: string;
  label: string;
  met: boolean;
  reason?: string;
}

interface ApplicationRequirementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  onProceed: () => void;
}

export function ApplicationRequirementsDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  onProceed,
}: ApplicationRequirementsDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [isAllowed, setIsAllowed] = useState(true);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [userResponses, setUserResponses] = useState<Record<number, boolean>>({});
  const [rejectedStep, setRejectedStep] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && jobId) {
      validateRequirements();
      // Reset state when dialog opens
      setCurrentStep(0);
      setUserResponses({});
      setRejectedStep(null);
      setIsSubmitting(false);
    }
  }, [open, jobId]);

  const validateRequirements = async () => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke("validate-job-requirements", {
        body: { job_id: jobId },
      });

      if (response.error) {
        console.error("Validation error:", response.error);
        // If validation fails, allow them to proceed (backend will do final check)
        setRequirements([]);
        setIsAllowed(true);
        setIsLoading(false);
        return;
      }

      const data = response.data;
      setRequirements(data.requirements || []);
      setIsAllowed(data.allowed);
      setBlockedReason(data.blocked_reason || null);
    } catch (error) {
      console.error("Error validating requirements:", error);
      // On error, allow them to proceed
      setRequirements([]);
      setIsAllowed(true);
    } finally {
      setIsLoading(false);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "physical":
        return <Dumbbell className="w-5 h-5" />;
      case "logistical":
        return <Car className="w-5 h-5" />;
      case "skills":
        return <Shield className="w-5 h-5" />;
      case "visa_status":
        return <Shield className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const totalSteps = requirements.length;
  const currentRequirement = requirements[currentStep];
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 100;

  const handleResponse = (meetsRequirement: boolean) => {
    // Prevent double-clicks when submitting
    if (isSubmitting) return;
    
    setUserResponses(prev => ({ ...prev, [currentStep]: meetsRequirement }));
    
    if (!meetsRequirement) {
      // User said "No" - they don't meet this requirement
      setRejectedStep(currentStep);
    } else {
      // User said "Yes" - move to next step or complete
      if (currentStep < totalSteps - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        // All requirements confirmed - proceed with application
        // Mark as submitting to prevent duplicate calls
        setIsSubmitting(true);
        onProceed();
        onOpenChange(false);
      }
    }
  };

  const handleBack = () => {
    if (rejectedStep !== null) {
      // Going back from rejection screen
      setRejectedStep(null);
    } else if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Checking eligibility...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // No requirements to check - proceed directly
  if (requirements.length === 0 && !blockedReason) {
    onProceed();
    onOpenChange(false);
    return null;
  }

  // Blocked by visa or other critical issue
  if (blockedReason) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Unable to Apply</DialogTitle>
            <DialogDescription>
              Application for <span className="font-medium">{jobTitle}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <Card className="p-6 bg-destructive/10 border-destructive/20">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-full bg-destructive/20">
                  <XCircle className="w-6 h-6 text-destructive" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-destructive mb-2">Application Blocked</h3>
                  <p className="text-sm text-muted-foreground">{blockedReason}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // User rejected a requirement
  if (rejectedStep !== null) {
    const rejectedRequirement = requirements[rejectedStep];
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Application Cannot Proceed</DialogTitle>
            <DialogDescription>
              Unfortunately, you don't meet the requirements for <span className="font-medium">{jobTitle}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <Card className="p-6 bg-destructive/10 border-destructive/20">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-full bg-destructive/20">
                  <XCircle className="w-6 h-6 text-destructive" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-destructive mb-2">Requirement Not Met</h3>
                  <p className="text-sm font-medium mb-1">{rejectedRequirement?.label}</p>
                  <p className="text-sm text-muted-foreground">
                    This role requires candidates who meet all listed requirements. 
                    We encourage you to explore other opportunities that may be a better fit for your profile.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Go Back
            </Button>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Normal requirement step
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Eligibility Check</DialogTitle>
          <DialogDescription>
            Please confirm you meet the requirements for <span className="font-medium">{jobTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="h-2 mb-4" />
        
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Question {currentStep + 1} of {totalSteps}
          </p>
          
          <Card className="p-6 bg-muted/30 border-border">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                {getIconForType(currentRequirement?.type || "")}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Do you meet this requirement?</h3>
                <p className="text-base mb-1">{currentRequirement?.label}</p>
                {currentRequirement?.reason && (
                  <p className="text-sm text-muted-foreground">{currentRequirement.reason}</p>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          {currentStep > 0 ? (
            <Button variant="ghost" onClick={handleBack} className="order-2 sm:order-1">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          ) : (
            <div className="hidden sm:block" />
          )}
          
          <div className="flex gap-2 order-1 sm:order-2">
            <Button 
              variant="outline" 
              onClick={() => handleResponse(false)}
              className="flex-1 sm:flex-none border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={isSubmitting}
            >
              <XCircle className="w-4 h-4 mr-2" />
              No
            </Button>
            <Button 
              onClick={() => handleResponse(true)}
              className="flex-1 sm:flex-none"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              {isSubmitting ? "Submitting..." : "Yes"}
              {!isSubmitting && currentStep === totalSteps - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
