export default async function handler(req: any, res: any) {
  try {
    const id = req.query?.id;

    if (!id || typeof id !== "string") {
      res.status(400).setHeader("Content-Type", "text/html; charset=utf-8").send("Missing job id");
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

    if (!supabaseUrl) {
      res.status(500).setHeader("Content-Type", "text/html; charset=utf-8").send("SUPABASE_URL is not configured");
      return;
    }

    const shareJobUrl = `${supabaseUrl}/functions/v1/share-job?id=${encodeURIComponent(id)}`;
    const response = await fetch(shareJobUrl, {
      headers: {
        "User-Agent": req.headers["user-agent"] || "workie-share-proxy",
        "Accept": req.headers.accept || "text/html",
      },
    });

    const body = await response.text();

    res.status(response.status);

    const contentType = response.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    const cacheControl = response.headers.get("cache-control");
    if (cacheControl) {
      res.setHeader("Cache-Control", cacheControl);
    }

    res.send(body);
  } catch (_error) {
    res.status(500).setHeader("Content-Type", "text/html; charset=utf-8").send("Internal proxy error");
  }
}
