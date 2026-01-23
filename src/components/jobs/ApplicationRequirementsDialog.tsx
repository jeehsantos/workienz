import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle, 
  Car, 
  Dumbbell, 
  Clock, 
  Shield, 
  Loader2,
  AlertTriangle,
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

  useEffect(() => {
    if (open && jobId) {
      validateRequirements();
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

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final step - check if allowed
      if (isAllowed) {
        onProceed();
        onOpenChange(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const allRequirementsMet = requirements.every(r => r.met);
  const hasUnmetRequirements = requirements.some(r => !r.met);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Checking your eligibility...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // No requirements to check - proceed directly
  if (requirements.length === 0) {
    onProceed();
    onOpenChange(false);
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Application Check</DialogTitle>
          <DialogDescription>
            Let's make sure you're a good fit for <span className="font-medium">{jobTitle}</span>
          </DialogDescription>
        </DialogHeader>

        {blockedReason ? (
          <div className="py-6">
            <Card className="p-6 bg-destructive/10 border-destructive/20">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-full bg-destructive/20">
                  <XCircle className="w-6 h-6 text-destructive" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-destructive mb-2">Unable to Apply</h3>
                  <p className="text-sm text-muted-foreground">{blockedReason}</p>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <>
            <Progress value={progress} className="h-2 mb-4" />
            
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Step {currentStep + 1} of {totalSteps}
              </p>
              
              <Card className={`p-6 transition-colors ${
                currentRequirement?.met 
                  ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900" 
                  : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-full ${
                    currentRequirement?.met 
                      ? "bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400" 
                      : "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400"
                  }`}>
                    {currentRequirement?.met 
                      ? <CheckCircle2 className="w-6 h-6" />
                      : getIconForType(currentRequirement?.type || "")}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{currentRequirement?.label}</h3>
                    {currentRequirement?.reason && (
                      <p className="text-sm text-muted-foreground">{currentRequirement.reason}</p>
                    )}
                    <Badge 
                      variant={currentRequirement?.met ? "default" : "secondary"} 
                      className="mt-3"
                    >
                      {currentRequirement?.met ? "You meet this requirement" : "Review your profile"}
                    </Badge>
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {blockedReason ? (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Close
            </Button>
          ) : (
            <>
              {currentStep > 0 && (
                <Button variant="outline" onClick={handleBack} className="w-full sm:w-auto">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              
              {currentStep === totalSteps - 1 ? (
                hasUnmetRequirements ? (
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center gap-2 text-amber-600 text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Some requirements are not met</span>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => onOpenChange(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleNext}
                        className="flex-1"
                        disabled={!isAllowed}
                      >
                        Apply Anyway
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={handleNext} className="w-full sm:w-auto">
                    Continue to Application
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )
              ) : (
                <Button onClick={handleNext} className="w-full sm:w-auto">
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
