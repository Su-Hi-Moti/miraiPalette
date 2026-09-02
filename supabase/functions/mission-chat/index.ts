import { createClient } from "@supabase/supabase-js";

const SYSTEM_INSTRUCTION = `あなたは子どもの考えを整理する対話相手です。
答えをすぐに教えるのではなく、子どもの考えを引き出してください。

ルール：
- やさしい日本語を使う
- 回答は短くする
- 一度に質問するのは1つだけ
- 子どもの発言を否定しない
- 完成した答えを代わりに作らない
- 考えを整理したり、具体例を尋ねたりする`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const createSupabaseClient = (request: Request) => {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) throw new Error("Supabase environment variables are missing");

  return createClient(url, anonKey, {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
  });
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createSupabaseClient(request);

    if (request.method === "GET") {
      const sessionId = new URL(request.url).searchParams.get("session_id");
      if (!isUuid(sessionId)) return json({ error: "有効な session_id が必要です" }, 400);

      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, session_id, role, content, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json({ session_id: sessionId, messages: data });
    }

    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const body = await request.json().catch(() => null);
    const sessionId = body?.session_id;
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!isUuid(sessionId)) return json({ error: "有効な session_id が必要です" }, 400);
    if (!message || message.length > 2000) {
      return json({ error: "message は1〜2000文字で指定してください" }, 400);
    }

    const { error: userInsertError } = await supabase
      .from("chat_messages")
      .insert({ session_id: sessionId, role: "user", content: message });
    if (userInsertError) throw userInsertError;

    const { data: history, error: historyError } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (historyError) throw historyError;

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "Gemini API key is not configured" }, 500);

    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash-lite";
    // Geminiの会話形式に合わせ、連続する同一roleは1つのContentにまとめる。
    // 前回のAPI失敗でuser発言だけが残った場合も、次の呼び出しを壊さない。
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
    for (const item of [...(history ?? [])].reverse()) {
      const role = item.role === "assistant" ? "model" : "user";
      const last = contents.at(-1);
      if (last?.role === role) {
        last.parts.push({ text: item.content });
      } else {
        contents.push({ role, parts: [{ text: item.content }] });
      }
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents,
          generationConfig: {
            maxOutputTokens: 200,
  	      thinkingConfig: { thinkingLevel: "minimal" },
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      console.error("Gemini API error", geminiResponse.status, await geminiResponse.text());
      return json({ error: "AIから回答を取得できませんでした" }, 502);
    }

    const geminiData = await geminiResponse.json();
    const reply = geminiData.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();
    if (!reply) return json({ error: "AIから回答を取得できませんでした" }, 502);

    const { data: savedReply, error: assistantInsertError } = await supabase
      .from("chat_messages")
      .insert({ session_id: sessionId, role: "assistant", content: reply })
      .select("id, session_id, role, content, created_at")
      .single();
    if (assistantInsertError) throw assistantInsertError;

    return json({ session_id: sessionId, message: reply, chat_message: savedReply });
  } catch (error) {
    console.error(error);
    return json({ error: "処理中にエラーが発生しました" }, 500);
  }
});
