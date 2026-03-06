/**
 * supabase/functions/ai-analysis/index.ts
 *
 * Supabase Edge Function — Gemini API プロキシ
 *
 * フロントエンドから { prompt } を受け取り、Gemini 2.0 Flash を呼び出して
 * { text } を返す。GEMINI_API_KEY は Supabase Secrets に保存し、
 * フロントエンドのバンドルには含まれない。
 *
 * Secrets 設定手順:
 *   supabase secrets set GEMINI_API_KEY=<your-key>
 *   または Supabase ダッシュボード → Project Settings → Edge Functions → Secrets
 *
 * デプロイ:
 *   supabase functions deploy ai-analysis --no-verify-jwt
 */

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not configured" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      const msg = (err as { error?: { message?: string } })?.error?.message
                  ?? `Gemini API HTTP ${geminiRes.status}`;
      return new Response(JSON.stringify({ error: msg }), {
        status: geminiRes.status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const geminiJson = await geminiRes.json();
    const text: string =
      (geminiJson as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
        ?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

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
