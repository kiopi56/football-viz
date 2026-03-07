/**
 * supabase/functions/ai-analysis/index.ts
 *
 * Supabase Edge Function — Anthropic Claude API プロキシ
 *
 * フロントエンドから { prompt } を受け取り、Claude を呼び出して
 * { text } を返す。ANTHROPIC_API_KEY は Supabase Secrets で管理。
 *
 * Secrets 設定:
 *   supabase secrets set ANTHROPIC_API_KEY=<your-key>
 *
 * デプロイ:
 *   supabase functions deploy ai-analysis --no-verify-jwt
 */

const ANTHROPIC_URL     = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL             = "claude-haiku-4-5-20251001";
const MAX_TOKENS        = 1024;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt (string) is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const claudeRes = await fetch(ANTHROPIC_URL, {
      method:  "POST",
      headers: {
        "Content-Type":    "application/json",
        "x-api-key":       apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      const msg = (err as { error?: { message?: string } })?.error?.message
                  ?? `Anthropic API HTTP ${claudeRes.status}`;
      return new Response(JSON.stringify({ error: msg }), {
        status: claudeRes.status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const claudeJson = await claudeRes.json();
    const text: string =
      (claudeJson as { content?: { type: string; text: string }[] })
        ?.content?.[0]?.text ?? "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
