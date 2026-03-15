import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface VerificationInput {
  user_id: string;
  declared_status: string;
  document_path: string;
}

interface ExtractionResult {
  name: string | null;
  date_of_birth: string | null;
  document_type: string | null;
  expiry_date: string | null;
  expiry_date_source: "explicit_expiry" | "issued_or_start_date" | "unknown";
  expiry_evidence_text: string | null;
  no_expiry_indefinite: boolean;
  visa_type: string | null;
  work_conditions: string | null;
  issuing_country: string | null;
  is_readable: boolean;
  confidence: number; // 0-1
  raw_text_snippet: string | null;
}

type VerificationDecision = "verified" | "review_required" | "rejected";

interface DecisionResult {
  decision: VerificationDecision;
  reasons: string[];
  confidence: number;
  expiry_date: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Download file from verification-temp bucket as base64 */
async function downloadDocument(
  supabase: ReturnType<typeof createClient>,
  path: string
): Promise<{ base64: string; mimeType: string } | null> {
  const { data, error } = await supabase.storage
    .from("verification-temp")
    .download(path);

  if (error || !data) {
    console.error("Download error:", error);
    return null;
  }

  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  };

  const arrayBuf = await data.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  return { base64, mimeType: mimeMap[ext] || "application/octet-stream" };
}

/** Use Lovable AI (Gemini vision) to extract document fields */
async function extractDocumentFields(
  fileData: { base64: string; mimeType: string },
  declaredStatus: string
): Promise<ExtractionResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return fallbackExtraction();
  }

  const systemPrompt = `You are a document verification assistant for a New Zealand employment platform.
Analyze the uploaded identity/visa document and extract structured information.
You MUST call the extract_document_fields function with your findings.
Critical date rules:
- Only set expiry_date when the document EXPLICITLY labels a date as expiry (e.g. "expiry", "expires", "valid until", "must arrive before").
- Do NOT treat issue/start/approval/grant dates as expiry.
- If the document indicates indefinite/permanent stay rights and no explicit expiry, set expiry_date to null and no_expiry_indefinite to true.
- Set expiry_date_source to "explicit_expiry", "issued_or_start_date", or "unknown".
Be honest about confidence — if the document is blurry, partially visible, or unreadable, set is_readable to false and confidence low.
Country identification:
- Identify the issuing country of the document. Look for country names, government logos, coat of arms, or immigration authority names.
- For NZ documents, the issuing country should be "New Zealand".
- This platform only accepts documents issued by New Zealand.`;

  const userPrompt = `The user declared their work status as: "${declaredStatus}".
Please analyze this document and extract all relevant information.
Look for: full name, date of birth, document type (passport, visa, national ID, driver licence), expiry date, visa type, any work condition text, and whether rights are indefinite/permanent.
Important: many NZ visa letters include issue/start dates. Do not classify those as expiry unless explicitly labeled as expiry.`;

  try {
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${fileData.mimeType};base64,${fileData.base64}`,
                  },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_document_fields",
                description:
                  "Extract structured data from an identity or visa document.",
                parameters: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description:
                        "Full name as it appears on the document, or null if unreadable",
                    },
                    date_of_birth: {
                      type: "string",
                      description:
                        "Date of birth in ISO 8601 format (YYYY-MM-DD) if visible on the document, else null",
                    },
                    document_type: {
                      type: "string",
                      enum: [
                        "passport",
                        "visa",
                        "national_id",
                        "driver_licence",
                        "birth_certificate",
                        "other",
                        "unreadable",
                      ],
                      description: "The type of document",
                    },
                    expiry_date: {
                      type: "string",
                      description:
                        "Expiry date in ISO 8601 format (YYYY-MM-DD), only when explicitly labeled as expiry; otherwise null",
                    },
                    expiry_date_source: {
                      type: "string",
                      enum: ["explicit_expiry", "issued_or_start_date", "unknown"],
                      description:
                        "How the date was identified. Use explicit_expiry only when clearly labeled as expiry.",
                    },
                    expiry_evidence_text: {
                      type: "string",
                      description:
                        "Short phrase around the expiry date label/value (e.g. 'Visa expires: 2027-01-03'), else null",
                    },
                    no_expiry_indefinite: {
                      type: "boolean",
                      description:
                        "True if document text indicates indefinite/permanent rights with no explicit expiry",
                    },
                    visa_type: {
                      type: "string",
                      description:
                        "Visa category/type if this is a visa document, else null",
                    },
                    work_conditions: {
                      type: "string",
                      description:
                        "Any work condition text found on the document, else null",
                    },
                    is_readable: {
                      type: "boolean",
                      description:
                        "Whether the document is clear enough to extract meaningful information",
                    },
                    confidence: {
                      type: "number",
                      description:
                        "Confidence score 0.0 to 1.0 for the overall extraction quality",
                    },
                    raw_text_snippet: {
                      type: "string",
                      description:
                        "A brief snippet of text visible on the document for audit purposes",
                    },
                    issuing_country: {
                      type: "string",
                      description:
                        "The country that issued this document (e.g. 'New Zealand', 'Australia', 'United Kingdom'). Identify from government logos, coat of arms, immigration authority names, or country names on the document.",
                    },
                  },
                  required: [
                    "document_type",
                    "is_readable",
                    "confidence",
                    "issuing_country",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_document_fields" },
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return fallbackExtraction();
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in response");
      return fallbackExtraction();
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return {
      name: parsed.name || null,
      date_of_birth: parsed.date_of_birth || null,
      document_type: parsed.document_type || null,
      expiry_date: parsed.expiry_date || null,
      expiry_date_source: parsed.expiry_date_source || "unknown",
      expiry_evidence_text: parsed.expiry_evidence_text || null,
      no_expiry_indefinite: parsed.no_expiry_indefinite ?? false,
      visa_type: parsed.visa_type || null,
      work_conditions: parsed.work_conditions || null,
      issuing_country: parsed.issuing_country || null,
      is_readable: parsed.is_readable ?? false,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      raw_text_snippet: parsed.raw_text_snippet || null,
    };
  } catch (err) {
    console.error("Extraction error:", err);
    return fallbackExtraction();
  }
}

function fallbackExtraction(): ExtractionResult {
  return {
    name: null,
    date_of_birth: null,
    document_type: null,
    expiry_date: null,
    expiry_date_source: "unknown",
    expiry_evidence_text: null,
    no_expiry_indefinite: false,
    visa_type: null,
    work_conditions: null,
    issuing_country: null,
    is_readable: false,
    confidence: 0,
    raw_text_snippet: "AI extraction failed - sending to manual review",
  };
}

/**
 * If AI extraction completely fails, route to manual review instead of auto-rejecting.
 */
function makeFallbackDecision(): DecisionResult {
  return {
    decision: "review_required",
    reasons: ["AI extraction failed; document sent for manual review"],
    confidence: 0,
    expiry_date: null,
  };
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hasIndefiniteRightsLanguage(extraction: ExtractionResult): boolean {
  const text = `${extraction.work_conditions ?? ""} ${extraction.raw_text_snippet ?? ""} ${extraction.visa_type ?? ""}`.toLowerCase();
  return /(indefinite|permanent resident|permanent visa|no expiry|no expiration|stay in new zealand indefinitely)/.test(text);
}

// ─── Step 7: Automated Decision Logic ────────────────────────────────────────

function makeDecision(
  extraction: ExtractionResult,
  declaredStatus: string,
  profileFullName: string | null,
  profileDateOfBirth: string | null
): DecisionResult {
  const reasons: string[] = [];
  let decision: VerificationDecision = "verified";

  // 1. Document readability
  if (!extraction.is_readable) {
    reasons.push("Document is not readable or is too blurry");
    return { decision: "review_required", reasons, confidence: extraction.confidence, expiry_date: null };
  }

  // 2. Low confidence → review
  if (extraction.confidence < 0.5) {
    reasons.push(`Low extraction confidence: ${(extraction.confidence * 100).toFixed(0)}%`);
    decision = "review_required";
  }

  // 3. Expiry check (only reject when expiry is explicitly identified)
  if (extraction.expiry_date) {
    const expiry = parseIsoDate(extraction.expiry_date);
    if (!expiry) {
      reasons.push("Document date format could not be validated; sent for manual review");
      decision = "review_required";
    } else {
      const now = new Date();
      const hasIndefinite = extraction.no_expiry_indefinite || hasIndefiniteRightsLanguage(extraction);
      const source = extraction.expiry_date_source ?? "unknown";

      if (expiry < now) {
        if (source === "explicit_expiry" && !hasIndefinite) {
          reasons.push(`Document expired on ${extraction.expiry_date}`);
          return { decision: "rejected", reasons, confidence: extraction.confidence, expiry_date: extraction.expiry_date };
        }

        if (hasIndefinite) {
          console.log(
            `Ignoring date ${extraction.expiry_date} because document indicates indefinite/permanent rights and no clear expiry.`
          );
        } else {
          reasons.push(
            `Date ${extraction.expiry_date} was not clearly labeled as expiry (source: ${source}); sent for manual review`
          );
          decision = "review_required";
        }
      }
    }
  }

  // 4. Issuing country validation (must be New Zealand)
  if (extraction.issuing_country) {
    const country = extraction.issuing_country.toLowerCase().trim();
    const isNZ = country === "new zealand" || country === "nz" || country === "aotearoa";
    if (!isNZ) {
      reasons.push(
        `This document was issued by ${extraction.issuing_country}, not New Zealand. Only NZ-issued documents are accepted.`
      );
      if (extraction.confidence > 0.7) {
        return { decision: "rejected", reasons, confidence: extraction.confidence, expiry_date: null };
      } else {
        decision = "review_required";
      }
    }
  }

  // 5. Document type vs declared status matching
  const typeMatchMap: Record<string, string[]> = {
    nz_citizen: ["passport", "birth_certificate", "national_id"],
    resident: ["passport", "visa", "national_id"],
    work_visa: ["visa", "passport"],
    student_visa: ["visa", "passport"],
  };

  const expectedTypes = typeMatchMap[declaredStatus] || [];
  if (extraction.document_type && extraction.document_type !== "unreadable") {
    if (!expectedTypes.includes(extraction.document_type)) {
      reasons.push(
        `Document type "${extraction.document_type}" does not match declared status "${declaredStatus}"`
      );
      // Strong mismatch → rejected; borderline → review
      if (extraction.confidence > 0.7) {
        decision = "rejected";
      } else {
        decision = decision === "verified" ? "review_required" : decision;
      }
    }
  } else if (extraction.document_type === "unreadable") {
    reasons.push("Document type could not be determined");
    decision = "review_required";
  }

  // 5. Name matching (fuzzy)
  if (profileFullName && extraction.name) {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, "").trim();
    const profileNorm = normalize(profileFullName);
    const docNorm = normalize(extraction.name);

    if (profileNorm && docNorm) {
      const profileParts = profileNorm.split(/\s+/);
      const docParts = docNorm.split(/\s+/);
      const matchingParts = profileParts.filter((p) =>
        docParts.some((d) => d === p || d.includes(p) || p.includes(d))
      );

      const matchRatio = matchingParts.length / Math.max(profileParts.length, 1);
      if (matchRatio < 0.3) {
        reasons.push(`Name mismatch: profile="${profileFullName}", document="${extraction.name}"`);
        if (extraction.confidence > 0.7) {
          decision = "rejected";
        } else {
          decision = decision === "verified" ? "review_required" : decision;
        }
      } else if (matchRatio < 0.7) {
        reasons.push(`Partial name match: profile="${profileFullName}", document="${extraction.name}"`);
        decision = decision === "verified" ? "review_required" : decision;
      }
    }
  } else if (!extraction.name) {
    reasons.push("Could not extract name from document");
    decision = decision === "verified" ? "review_required" : decision;
  }

  // 5b. Date of birth check
  if (profileDateOfBirth && extraction.date_of_birth) {
    const profileDob = profileDateOfBirth.replace(/[^0-9-]/g, "");
    const docDob = extraction.date_of_birth.replace(/[^0-9-]/g, "");
    if (profileDob && docDob && profileDob !== docDob) {
      reasons.push(
        `Date of birth mismatch: profile="${profileDateOfBirth}", document="${extraction.date_of_birth}". Please update your profile if incorrect.`
      );
      if (extraction.confidence > 0.7) {
        decision = "rejected";
      } else {
        decision = decision === "verified" ? "review_required" : decision;
      }
    }
  }

  if (
    (declaredStatus === "work_visa" || declaredStatus === "student_visa") &&
    !extraction.visa_type
  ) {
    reasons.push("No visa type information found on document");
    decision = decision === "verified" ? "review_required" : decision;
  }

  if (decision === "verified" && reasons.length === 0) {
    reasons.push("All checks passed");
  }

  return {
    decision,
    reasons,
    confidence: extraction.confidence,
    expiry_date: extraction.expiry_date || null,
  };
}

// ─── Step 8: File Deletion ───────────────────────────────────────────────────

async function deleteVerificationFile(
  supabase: ReturnType<typeof createClient>,
  path: string
): Promise<void> {
  const { error } = await supabase.storage
    .from("verification-temp")
    .remove([path]);
  if (error) {
    console.error("Failed to delete verification file:", path, error);
  } else {
    console.log("Deleted verification file:", path);
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, declared_status, document_path } =
      (await req.json()) as VerificationInput;

    if (!user_id || !declared_status || !document_path) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate declared_status
    const validStatuses = ["nz_citizen", "resident", "work_visa", "student_visa"];
    if (!validStatuses.includes(declared_status)) {
      return new Response(
        JSON.stringify({ error: "Invalid declared_status" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get user profile name and DOB for matching
    const [{ data: profile }, { data: empProfile }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("user_id", user_id).maybeSingle(),
      supabase.from("employee_profiles").select("date_of_birth").eq("user_id", user_id).maybeSingle(),
    ]);

    const fullName = profile?.full_name || null;
    const dateOfBirth = empProfile?.date_of_birth || null;

    // 2. Download document
    const fileData = await downloadDocument(supabase, document_path);
    if (!fileData) {
      // Update request status to rejected, clean up
      await supabase
        .from("user_work_verification_requests")
        .update({
          status: "rejected",
          extracted_data: { error: "Could not download document" },
          reviewed_at: new Date().toISOString(),
        })
        .eq("user_id", user_id)
        .eq("document_path", document_path);

      await supabase
        .from("employee_profiles")
        .update({ work_verification_status: "rejected" })
        .eq("user_id", user_id);

      await deleteVerificationFile(supabase, document_path);

      return new Response(
        JSON.stringify({ error: "Could not download document", decision: "rejected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Extract document fields via AI
    const extraction = await extractDocumentFields(fileData, declared_status);
    console.log("Extraction result:", JSON.stringify(extraction));

    // 4. Make rule-based decision (use fallback if AI completely failed)
    const result = extraction.confidence === 0 && !extraction.is_readable
      ? makeFallbackDecision()
      : makeDecision(extraction, declared_status, fullName, dateOfBirth);
    console.log("Decision:", JSON.stringify(result));

    // 5. Update verification request
    await supabase
      .from("user_work_verification_requests")
      .update({
        status: result.decision,
        ai_confidence: result.confidence,
        extracted_data: {
          name: extraction.name,
          document_type: extraction.document_type,
          date_of_birth: extraction.date_of_birth,
          expiry_date: extraction.expiry_date,
          expiry_date_source: extraction.expiry_date_source,
          expiry_evidence_text: extraction.expiry_evidence_text,
          no_expiry_indefinite: extraction.no_expiry_indefinite,
          visa_type: extraction.visa_type,
          work_conditions: extraction.work_conditions,
          is_readable: extraction.is_readable,
          raw_text_snippet: extraction.raw_text_snippet,
          decision_reasons: result.reasons,
        },
        reviewed_at:
          result.decision !== "review_required"
            ? new Date().toISOString()
            : null,
      })
      .eq("user_id", user_id)
      .eq("document_path", document_path);

    // 6. Update employee profile
    const profileUpdate: Record<string, unknown> = {
      work_verification_status: result.decision,
      work_verification_type: declared_status,
    };

    if (result.decision === "verified") {
      profileUpdate.work_verification_date = new Date().toISOString();
      if (result.expiry_date) {
        profileUpdate.work_verification_expiry_date = result.expiry_date;
      }
    }

    if (result.decision === "review_required" || result.decision === "rejected") {
      profileUpdate.verification_review_reason = result.reasons.join("; ");
    }

    await supabase
      .from("employee_profiles")
      .update(profileUpdate)
      .eq("user_id", user_id);

    // 7. File deletion policy (Step 8)
    if (result.decision === "verified" || result.decision === "rejected") {
      // Delete immediately
      await deleteVerificationFile(supabase, document_path);
    }
    // review_required → keep file for admin review

    // 8. Notifications
    if (result.decision === "review_required") {
      // Notify admins
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        const notifications = admins.map((admin: { user_id: string }) => ({
          user_id: admin.user_id,
          type: "verification_review",
          title: "Verification Review Needed",
          message: `A work rights verification requires manual review.`,
          action_url: "/admin/settings",
          metadata: { verification_user_id: user_id, declared_status },
        }));

        await supabase.from("notifications").insert(notifications);
      }
    }

    // Notify user of result
    const userMessages: Record<string, { title: string; message: string }> = {
      verified: {
        title: "Work Rights Verified",
        message: "Your work rights have been verified. You can now apply to jobs!",
      },
      review_required: {
        title: "Verification Under Review",
        message:
          "Your documents require additional review. We'll notify you once completed.",
      },
      rejected: {
        title: "Verification Unsuccessful",
        message:
          "Your verification was unsuccessful. Please check your documents and try again.",
      },
    };

    const msg = userMessages[result.decision];
    await supabase.from("notifications").insert({
      user_id,
      type: "verification_result",
      title: msg.title,
      message: msg.message,
      action_url: "/settings?section=verification",
    });

    return new Response(
      JSON.stringify({
        decision: result.decision,
        reasons: result.reasons,
        confidence: result.confidence,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("process-work-verification error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

