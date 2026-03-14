import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  AlertTriangle,
  FileText,
  User,
  Shield,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface VerificationRequest {
  id: string;
  user_id: string;
  declared_status: string;
  document_path: string;
  extracted_data: Record<string, unknown> | null;
  ai_confidence: number | null;
  status: string;
  admin_review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  // Joined
  profile_name?: string;
  profile_email?: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  review_required: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  verified: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  suspended: "bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-200",
};

const declaredStatusLabels: Record<string, string> = {
  nz_citizen: "NZ Citizen",
  resident: "NZ Resident",
  work_visa: "Work Visa Holder",
  student_visa: "Student Visa Holder",
};

export default function AdminVerificationReview() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState<"review_required" | "pending" | "all">("review_required");

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    let query = supabase
      .from("user_work_verification_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (filter === "review_required") {
      query = query.eq("status", "review_required");
    } else if (filter === "pending") {
      query = query.eq("status", "pending");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching verification requests:", error);
      setIsLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setRequests([]);
      setIsLoading(false);
      return;
    }

    // Fetch profile names for each user
    const userIds = [...new Set(data.map((r) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);

    const profileMap = new Map<string, { name: string; email: string }>();
    profiles?.forEach((p) => {
      profileMap.set(p.user_id, {
        name: p.full_name || "Unknown",
        email: p.email,
      });
    });

    const enriched: VerificationRequest[] = data.map((r) => ({
      ...r,
      extracted_data: r.extracted_data as Record<string, unknown> | null,
      profile_name: profileMap.get(r.user_id)?.name,
      profile_email: profileMap.get(r.user_id)?.email,
    }));

    setRequests(enriched);
    setIsLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openReview = useCallback(async (request: VerificationRequest) => {
    setSelectedRequest(request);
    setAdminNotes(request.admin_review_notes || "");
    setDocumentUrl(null);

    // Try to generate a signed URL for the document
    if (request.status === "review_required" || request.status === "pending") {
      const { data } = await supabase.storage
        .from("verification-temp")
        .createSignedUrl(request.document_path, 600); // 10 min

      if (data?.signedUrl) {
        setDocumentUrl(data.signedUrl);
      }
    }
  }, []);

  const handleDecision = useCallback(
    async (decision: "verified" | "rejected" | "suspended") => {
      if (!selectedRequest) return;
      setIsProcessing(true);

      try {
        // 1. Update verification request
        const { error: reqErr } = await supabase
          .from("user_work_verification_requests")
          .update({
            status: decision,
            admin_review_notes: adminNotes || null,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", selectedRequest.id);

        if (reqErr) throw reqErr;

        // 2. Update employee profile
        const profileUpdate: Record<string, unknown> = {
          work_verification_status: decision,
        };

        if (decision === "verified") {
          profileUpdate.work_verification_date = new Date().toISOString();
          const extractedExpiry = selectedRequest.extracted_data?.expiry_date;
          if (extractedExpiry) {
            profileUpdate.work_verification_expiry_date = extractedExpiry;
          }
          profileUpdate.verification_review_reason = null;
        }

        if (decision === "rejected") {
          profileUpdate.verification_review_reason =
            adminNotes || "Rejected by admin review";
        }

        if (decision === "suspended") {
          profileUpdate.verification_review_reason =
            adminNotes || "Account suspended due to fraud concerns";
        }

        const { error: profErr } = await supabase
          .from("employee_profiles")
          .update(profileUpdate)
          .eq("user_id", selectedRequest.user_id);

        if (profErr) throw profErr;

        // 3. Delete the uploaded file
        await supabase.storage
          .from("verification-temp")
          .remove([selectedRequest.document_path]);

        // 4. Notify user
        const notifMsg =
          decision === "verified"
            ? {
                title: "Work Rights Verified",
                message:
                  "Your work rights have been verified by our team. You can now apply to jobs!",
              }
            : decision === "suspended"
            ? {
                title: "Account Suspended",
                message: adminNotes
                  ? `Your account has been suspended: ${adminNotes}`
                  : "Your account has been suspended due to verification concerns. Please contact support.",
              }
            : {
                title: "Verification Unsuccessful",
                message: adminNotes
                  ? `Your verification was not approved: ${adminNotes}`
                  : "Your verification was not approved. Please submit new documents.",
              };

        await supabase.from("notifications").insert({
          user_id: selectedRequest.user_id,
          type: "verification_result",
          title: notifMsg.title,
          message: notifMsg.message,
          action_url: "/employee/verify",
        });

        toast({
          title: `Verification ${decision === "verified" ? "Approved" : "Rejected"}`,
          description: `User verification has been ${decision}.`,
        });

        setSelectedRequest(null);
        fetchRequests();
      } catch (err: any) {
        console.error("Admin review error:", err);
        toast({
          title: "Error",
          description: err.message || "Failed to process review",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedRequest, adminNotes, toast, fetchRequests]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Verification Requests</h2>
        </div>
        <div className="flex gap-2">
          {(["review_required", "pending", "all"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f === "review_required"
                ? "Needs Review"
                : f === "pending"
                ? "Pending"
                : "All"}
            </Button>
          ))}
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No verification requests found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card key={req.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {req.profile_name || "Unknown User"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {req.profile_email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant="outline">
                      {declaredStatusLabels[req.declared_status] || req.declared_status}
                    </Badge>
                    <Badge className={statusColors[req.status] || ""}>
                      {req.status.replace("_", " ")}
                    </Badge>
                    {req.ai_confidence !== null && (
                      <span className="text-xs text-muted-foreground">
                        {(req.ai_confidence * 100).toFixed(0)}% conf.
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openReview(req)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Review
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Verification Review
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-5">
              {/* User Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">User:</span>
                  <p className="font-medium">{selectedRequest.profile_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium">{selectedRequest.profile_email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Declared Status:</span>
                  <p className="font-medium">
                    {declaredStatusLabels[selectedRequest.declared_status] ||
                      selectedRequest.declared_status}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">AI Confidence:</span>
                  <p className="font-medium">
                    {selectedRequest.ai_confidence !== null
                      ? `${(selectedRequest.ai_confidence * 100).toFixed(0)}%`
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Submitted:</span>
                  <p className="font-medium">
                    {new Date(selectedRequest.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Status:</span>
                  <Badge className={statusColors[selectedRequest.status] || ""}>
                    {selectedRequest.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>

              {/* Extracted Data */}
              {selectedRequest.extracted_data && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      AI Extraction Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 space-y-2 text-sm">
                    {Object.entries(selectedRequest.extracted_data).map(
                      ([key, value]) => {
                        if (key === "decision_reasons" && Array.isArray(value)) {
                          return (
                            <div key={key}>
                              <span className="text-muted-foreground capitalize">
                                Decision Reasons:
                              </span>
                              <ul className="list-disc list-inside mt-1 space-y-1">
                                {value.map((reason, i) => (
                                  <li key={i} className="text-foreground">
                                    {String(reason)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        }
                        return (
                          <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground capitalize">
                              {key.replace(/_/g, " ")}:
                            </span>
                            <span className="font-medium text-right max-w-[60%] truncate">
                              {value === null ? "—" : String(value)}
                            </span>
                          </div>
                        );
                      }
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Document Preview */}
              {documentUrl ? (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Uploaded Document</Label>
                  {selectedRequest.document_path.endsWith(".pdf") ? (
                    <div className="border rounded-lg overflow-hidden">
                      <iframe
                        src={documentUrl}
                        className="w-full h-[400px]"
                        title="Document preview"
                      />
                    </div>
                  ) : (
                    <img
                      src={documentUrl}
                      alt="Uploaded verification document"
                      className="max-w-full rounded-lg border max-h-[400px] object-contain"
                    />
                  )}
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline"
                  >
                    Open in new tab
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4" />
                  <span>
                    {selectedRequest.status === "verified" ||
                    selectedRequest.status === "rejected"
                      ? "Document has been deleted per privacy policy."
                      : "Could not load document preview."}
                  </span>
                </div>
              )}

              {/* Admin Notes */}
              <div className="space-y-2">
                <Label htmlFor="admin-notes">Admin Notes</Label>
                <Textarea
                  id="admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about your review decision..."
                  rows={3}
                />
              </div>

              {/* Actions */}
              {(selectedRequest.status === "review_required" ||
                selectedRequest.status === "pending") && (
                <DialogFooter className="gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive/10"
                    onClick={() => handleDecision("suspended")}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Shield className="w-4 h-4 mr-2" />
                    )}
                    Suspend (Fraud)
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDecision("rejected")}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-2" />
                    )}
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleDecision("verified")}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Approve
                  </Button>
                </DialogFooter>
              )}
              {selectedRequest.status === "verified" && (
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive/10"
                    onClick={() => handleDecision("suspended")}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Shield className="w-4 h-4 mr-2" />
                    )}
                    Suspend User
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
