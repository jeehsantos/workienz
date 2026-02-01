import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, KeyRound } from "lucide-react";
import workieLogo from "@/assets/workie-logo.png";

interface TwoFactorVerifyProps {
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TwoFactorVerify({ userId, onSuccess, onCancel }: TwoFactorVerifyProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  const handleVerify = async () => {
    if (!code.trim()) {
      toast({
        title: "Code required",
        description: "Please enter your authentication code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-2fa-code", {
        body: { code: code.trim(), userId },
      });

      if (error) throw error;

      if (data.verified) {
        if (data.usedBackupCode) {
          toast({
            title: "Backup code used",
            description: `You have ${data.remainingBackupCodes} backup codes remaining.`,
          });
        }
        onSuccess();
      } else {
        toast({
          title: "Invalid code",
          description: "The code you entered is incorrect. Please try again.",
          variant: "destructive",
        });
        setCode("");
      }
    } catch (error: any) {
      console.error("Error verifying 2FA code:", error);
      toast({
        title: "Verification failed",
        description: error.message || "Failed to verify code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleVerify();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card rounded-2xl shadow-medium p-8 border border-border/50">
        <div className="flex items-center justify-center mb-6">
          <img src={workieLogo} alt="Workie" className="h-[25px] w-[195px] object-contain" width={195} height={25} />
        </div>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2 font-display">Two-Factor Authentication</h1>
          <p className="text-muted-foreground">
            {useBackupCode ? "Enter one of your backup codes" : "Enter the 6-digit code from your authenticator app"}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="code">{useBackupCode ? "Backup Code" : "Authentication Code"}</Label>
            <Input
              id="code"
              type="text"
              inputMode={useBackupCode ? "text" : "numeric"}
              pattern={useBackupCode ? undefined : "[0-9]*"}
              maxLength={useBackupCode ? 9 : 6}
              placeholder={useBackupCode ? "XXXX-XXXX" : "000000"}
              value={code}
              onChange={(e) =>
                setCode(useBackupCode ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ""))
              }
              onKeyDown={handleKeyDown}
              className="mt-1.5 text-center text-lg tracking-widest font-mono"
              autoFocus
            />
          </div>

          <Button onClick={handleVerify} disabled={isLoading} className="w-full" variant="hero" size="lg">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify"
            )}
          </Button>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setUseBackupCode(!useBackupCode);
                setCode("");
              }}
              className="text-sm text-primary hover:underline font-medium flex items-center justify-center gap-1"
            >
              <KeyRound className="w-4 h-4" />
              {useBackupCode ? "Use authenticator app instead" : "Use a backup code"}
            </button>

            <button type="button" onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">
              Cancel and sign in with a different account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
