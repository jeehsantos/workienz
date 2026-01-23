import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Crown, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SubscriberFeatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  featureDescription: string;
}

export function SubscriberFeatureDialog({
  open,
  onOpenChange,
  featureName,
  featureDescription,
}: SubscriberFeatureDialogProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate("/pricing");
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Subscriber Feature
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-3">
            <p className="font-medium text-foreground">{featureName}</p>
            <p>{featureDescription}</p>
            <div className="flex items-center justify-center gap-2 text-primary pt-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Upgrade to unlock this feature</span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="w-full sm:w-auto">Maybe Later</AlertDialogCancel>
          <AlertDialogAction onClick={handleUpgrade} className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
            View Plans
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
