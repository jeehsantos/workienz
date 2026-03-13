import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Nightly cleanup job: deletes any verification-temp files older than 7 days.
 * Also cleans up dangling pending requests older than 7 days.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString();

    // 1. Find stale pending/review_required requests older than 7 days
    const { data: staleRequests, error: fetchErr } = await supabase
      .from("user_work_verification_requests")
      .select("id, user_id, document_path, status")
      .in("status", ["pending", "review_required"])
      .lt("created_at", cutoff);

    if (fetchErr) {
      console.error("Error fetching stale requests:", fetchErr);
    }

    let filesDeleted = 0;
    let requestsUpdated = 0;

    if (staleRequests && staleRequests.length > 0) {
      // Collect unique file paths to delete
      const filePaths = staleRequests
        .map((r: { document_path: string }) => r.document_path)
        .filter(Boolean);

      if (filePaths.length > 0) {
        const { error: deleteErr } = await supabase.storage
          .from("verification-temp")
          .remove(filePaths);

        if (deleteErr) {
          console.error("Error deleting stale files:", deleteErr);
        } else {
          filesDeleted = filePaths.length;
        }
      }

      // Mark stale pending requests as rejected
      const staleIds = staleRequests.map((r: { id: string }) => r.id);
      const { error: updateErr } = await supabase
        .from("user_work_verification_requests")
        .update({
          status: "rejected",
          admin_review_notes: "Auto-rejected: exceeded 7-day review window",
          reviewed_at: new Date().toISOString(),
        })
        .in("id", staleIds);

      if (updateErr) {
        console.error("Error updating stale requests:", updateErr);
      } else {
        requestsUpdated = staleIds.length;
      }

      // Update corresponding employee profiles
      const userIds = [...new Set(staleRequests.map((r: { user_id: string }) => r.user_id))];
      for (const uid of userIds) {
        await supabase
          .from("employee_profiles")
          .update({
            work_verification_status: "rejected",
            verification_review_reason: "Verification timed out after 7 days",
          })
          .eq("user_id", uid);
      }
    }

    // 2. List all files in bucket and remove any older than 7 days
    // (catches orphaned files not linked to any request)
    const { data: bucketFiles } = await supabase.storage
      .from("verification-temp")
      .list("", { limit: 1000 });

    if (bucketFiles && bucketFiles.length > 0) {
      // List files in each user folder
      for (const folder of bucketFiles) {
        if (!folder.id) continue; // it's a folder
        const { data: userFiles } = await supabase.storage
          .from("verification-temp")
          .list(folder.name, { limit: 100 });

        if (userFiles) {
          const oldFiles = userFiles.filter((f) => {
            if (!f.created_at) return false;
            return new Date(f.created_at) < sevenDaysAgo;
          });

          if (oldFiles.length > 0) {
            const paths = oldFiles.map((f) => `${folder.name}/${f.name}`);
            await supabase.storage.from("verification-temp").remove(paths);
            filesDeleted += paths.length;
          }
        }
      }
    }

    console.log(
      `Cleanup complete: ${filesDeleted} files deleted, ${requestsUpdated} requests auto-rejected`
    );

    return new Response(
      JSON.stringify({
        success: true,
        files_deleted: filesDeleted,
        requests_updated: requestsUpdated,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("cleanup-verification-files error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
