import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WORKIE_DOMAIN = "https://www.workie.co.nz";
const OG_IMAGE_URL = `${WORKIE_DOMAIN}/social/og.png`;

const CRAWLER_PATTERNS = [
  "facebookexternalhit",
  "facebot",
  "whatsapp",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "telegrambot",
  "discordbot",
  "pinterest",
  "applebot",
  "redditbot",
  "skypeuripreview",
  "vkshare",
  "bot",
  "crawler",
  "spider",
];

function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some((pattern) => ua.includes(pattern));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateTitle(
  jobTitle: string,
  suburb: string | null,
  city: string | null
): string {
  const s = suburb?.trim();
  const c = city?.trim();
  if (s && c) return `${jobTitle} in ${s}, ${c} - Workie`;
  if (c) return `${jobTitle} in ${c} - Workie`;
  return `${jobTitle} - Workie`;
}

function generateHtml(
  title: string,
  description: string,
  imageUrl: string,
  url: string,
  isBot: boolean
): string {
  const redirectTag = isBot
    ? ""
    : `<meta http-equiv="refresh" content="0;url=${escapeHtml(url)}">`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(url)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:site_name" content="Workie">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
  ${redirectTag}
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#f5f7fa 0%,#c3cfe2 100%)}
    .c{text-align:center;padding:2rem}
    .l{width:40px;height:40px;border:3px solid #e5e7eb;border-top:3px solid #3b82f6;border-radius:50%;animation:s 1s linear infinite;margin:0 auto 1rem}
    @keyframes s{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
    p{color:#6b7280;margin:0}a{color:#3b82f6;text-decoration:none}a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <div class="c">
    <div class="l"></div>
    <p>Redirecting to Workie...</p>
    <p style="margin-top:.5rem;font-size:.875rem"><a href="${escapeHtml(url)}">Click here if you're not redirected</a></p>
  </div>
</body>
</html>`;
}

function generateErrorHtml(title: string, message: string): string {
  const homeUrl = `${WORKIE_DOMAIN}/jobs`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Workie</title>
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)} - Workie">
  <meta property="og:description" content="${escapeHtml(message)}">
  <meta property="og:image" content="${OG_IMAGE_URL}">
  <meta property="og:url" content="${homeUrl}">
  <link rel="canonical" href="${homeUrl}">
  <meta http-equiv="refresh" content="3;url=${homeUrl}">
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#f5f7fa 0%,#c3cfe2 100%)}
    .c{text-align:center;padding:2rem}h1{color:#1f2937;margin-bottom:.5rem}p{color:#6b7280;margin:0}a{color:#3b82f6}
  </style>
</head>
<body>
  <div class="c">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <p style="margin-top:1rem"><a href="${homeUrl}">Browse all jobs</a></p>
  </div>
</body>
</html>`;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("id");
    const userAgent = req.headers.get("user-agent");
    const isBot = isCrawler(userAgent);

    console.log(
      `[share-job] UA: ${userAgent} | isBot: ${isBot} | jobId: ${jobId}`
    );

    if (!jobId) {
      return new Response(
        generateErrorHtml("Job not found", "No job ID provided."),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: job, error } = await supabase
      .from("jobs")
      .select("id, title, location_city, location_suburb")
      .eq("id", jobId)
      .eq("status", "published")
      .single();

    if (error || !job) {
      console.error("[share-job] Job fetch error:", error);
      return new Response(
        generateErrorHtml(
          "Job not found",
          "This job posting doesn't exist or is no longer available."
        ),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    const ogTitle = generateTitle(
      job.title,
      job.location_suburb,
      job.location_city
    );
    const ogDescription = "View this job opportunity and apply on Workie.";
    const jobUrl = `${WORKIE_DOMAIN}/jobs/${job.id}`;

    const html = generateHtml(ogTitle, ogDescription, OG_IMAGE_URL, jobUrl, isBot);

    console.log(
      `[share-job] Serving HTML for job ${job.id} | isBot: ${isBot} | title: ${ogTitle}`
    );

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Bot-Detected": String(isBot),
      },
    });
  } catch (err) {
    console.error("[share-job] Unexpected error:", err);
    return new Response(
      generateErrorHtml("Error", "An unexpected error occurred."),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
});
