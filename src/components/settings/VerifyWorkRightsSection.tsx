import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useWorkVerification, type DeclaredWorkStatus, type VerificationStatus } from "@/hooks/useWorkVerification";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Upload,
  ShieldCheck,
  ShieldAlert,
  Clock,
  XCircle,
  AlertTriangle,
  FileText,
  X,
  Info,
} from "lucide-react";
import { format } from "date-fns";

const WORK_STATUS_OPTIONS: { value: DeclaredWorkStatus; label: string }[] = [
  { value: "nz_citizen", label: "NZ Citizen" },
  { value: "resident", label: "NZ Resident" },
  { value: "work_visa", label: "Work Visa Holder" },
  { value: "student_visa", label: "Student Visa Holder" },
];

const STATUS_CONFIG: Record<VerificationStatus, { icon: typeof ShieldCheck; label: string; color: string; description: string }> = {
  unverified: {
    icon: ShieldAlert,
    label: "Not Verified",
    color: "bg-muted text-muted-foreground",
    description: "You must verify your work rights before applying to jobs.",
  },
  pending: {
    icon: Clock,
    label: "Pending Verification",
    color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    description: "Your documents are being processed. This usually takes a few minutes.",
  },
  verified: {
    icon: ShieldCheck,
    label: "Verified",
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    description: "Your work rights have been verified. You can apply to jobs.",
  },
  review_required: {
    icon: AlertTriangle,
    label: "Under Review",
    color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    description: "Your documents require manual review by our team. We'll notify you once reviewed.",
  },
  rejected: {
    icon: XCircle,
    label: "Rejected",
    color: "bg-destructive/10 text-destructive border-destructive/20",
    description: "Your verification was rejected. Please review the reason below and try again with valid documents.",
  },
  suspended: {
    icon: ShieldAlert,
    label: "Account Suspended",
    color: "bg-destructive/10 text-destructive border-destructive/20",
    description: "Your account has been suspended due to a verification concern. You cannot apply for jobs while suspended. If you believe this is an error, please contact support.",
  },
};

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function VerifyWorkRightsSection() {
  const { user } = useAuthContext();
  const {
    verificationState,
    latestRequest,
    isLoading,
    isSubmitting,
    fetchVerificationStatus,
    submitVerification,
  } = useWorkVerification(user?.id);

  const [declaredStatus, setDeclaredStatus] = useState<DeclaredWorkStatus | "">("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) fetchVerificationStatus();
  }, [user, fetchVerificationStatus]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);
    if (!file) { setSelectedFile(null); return; }
    if (!ACCEPTED_TYPES.includes(file.type)) { setFileError("Only PDF, JPG, and PNG files are accepted."); setSelectedFile(null); return; }
    if (file.size > MAX_FILE_SIZE) { setFileError("File must be smaller than 5MB."); setSelectedFile(null); return; }
    setSelectedFile(file);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!declaredStatus || !selectedFile || !declarationChecked) return;
    await submitVerification(declaredStatus, selectedFile);
    setDeclaredStatus("");
    setSelectedFile(null);
    setDeclarationChecked(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [declaredStatus, selectedFile, declarationChecked, submitVerification]);

  const canSubmit = declaredStatus && selectedFile && declarationChecked && !isSubmitting;
  const isExpiringSoon = verificationState.status === "verified" && verificationState.expiryDate &&
    new Date(verificationState.expiryDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
  const canResubmit = verificationState.status === "unverified" || verificationState.status === "rejected" || isExpiringSoon;
  const statusConfig = STATUS_CONFIG[verificationState.status];
  const StatusIcon = statusConfig.icon;

  if (isLoading) {
    return <Loader2 className="w-6 h-6 animate-spin text-primary" />;
  }

  return (
    <div className="space-y-6">
      {/* Current Status Banner */}
      <div className={`rounded-xl border p-5 ${statusConfig.color}`}>
        <div className="flex items-start gap-3">
          <StatusIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{statusConfig.label}</h3>
              {verificationState.type && (
                <Badge variant="outline" className="text-xs">
                  {WORK_STATUS_OPTIONS.find(o => o.value === verificationState.type)?.label || verificationState.type}
                </Badge>
              )}
            </div>
            <p className="text-sm opacity-90">{statusConfig.description}</p>
            {(verificationState.status === "rejected" || verificationState.status === "suspended") && verificationState.reviewReason && (
              <p className="text-sm mt-2 font-medium">Reason: {verificationState.reviewReason}</p>
            )}
            {verificationState.status === "verified" && verificationState.verificationDate && (
              <p className="text-sm opacity-75">
                Verified on {format(new Date(verificationState.verificationDate), "dd MMM yyyy")}
                {verificationState.expiryDate && (
                  <> · Expires {format(new Date(verificationState.expiryDate), "dd MMM yyyy")}</>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Submission Form */}
      {canResubmit && (
        <div className="space-y-5">
          <h3 className="font-semibold font-display">Submit Verification</h3>

          <div className="space-y-2">
            <Label htmlFor="work-status">Your Work Rights Status *</Label>
            <Select value={declaredStatus} onValueChange={(v) => setDeclaredStatus(v as DeclaredWorkStatus)}>
              <SelectTrigger id="work-status">
                <SelectValue placeholder="Select your work rights status" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                {WORK_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Upload Document *</Label>
            <p className="text-xs text-muted-foreground">
              Upload your passport, visa document, or NZ ID. Accepted: PDF, JPG, PNG (max 5MB).
              <br />
              <strong>Important:</strong> The name on the document must match your profile name.
            </p>
            <div className="relative">
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" id="verification-file" />
              {selectedFile ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label htmlFor="verification-file" className="flex flex-col items-center justify-center gap-2 p-8 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to upload your document</span>
                </label>
              )}
            </div>
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/20">
            <Checkbox id="declaration" checked={declarationChecked} onCheckedChange={(checked) => setDeclarationChecked(checked === true)} className="mt-0.5" />
            <label htmlFor="declaration" className="text-sm leading-relaxed cursor-pointer">
              I confirm that the information and documents I provide are true, accurate, and belong
              to me. I understand that submitting false, misleading, or fraudulent information may
              result in my account being <strong>suspended or permanently banned</strong> from Workie.
            </label>
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full" size="lg">
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
            ) : (
              <><ShieldCheck className="w-4 h-4 mr-2" />Submit Verification</>
            )}
          </Button>
        </div>
      )}

      {/* Previous Request Info */}
      {latestRequest && (
        <div className="rounded-lg border border-border/50 p-4">
          <h3 className="font-semibold text-sm text-muted-foreground mb-3">Latest Verification Request</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Declared Status:</span>{" "}
              <span className="font-medium">{WORK_STATUS_OPTIONS.find(o => o.value === latestRequest.declared_status)?.label}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Submitted:</span>{" "}
              <span className="font-medium">{format(new Date(latestRequest.created_at), "dd MMM yyyy HH:mm")}</span>
            </div>
            {latestRequest.ai_confidence !== null && (
              <div>
                <span className="text-muted-foreground">AI Confidence:</span>{" "}
                <span className="font-medium">{Math.round(latestRequest.ai_confidence * 100)}%</span>
              </div>
            )}
            {latestRequest.reviewed_at && (
              <div>
                <span className="text-muted-foreground">Reviewed:</span>{" "}
                <span className="font-medium">{format(new Date(latestRequest.reviewed_at), "dd MMM yyyy HH:mm")}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
