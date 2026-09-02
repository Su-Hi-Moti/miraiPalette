import { createClient } from "@supabase/supabase-js";

const SYSTEM_INSTRUCTION = `あなたは子どもの体験を、本人が次の一歩につなげられるよう整理する対話相手です。
会話履歴と振り返りから「今回の発見」を日本語で2〜3文にまとめてください。

ルール：
- 子ども本人に語りかける、やさしい言葉を使う
- 具体的な発言や試したことを根拠にする
- 良し悪しを評価せず、本人の気づきとして表現する
- 「分析型」「リーダータイプ」など性格や能力を断定するラベルを使わない
- 大げさに一般化せず、今回の体験で見えたことだけを書く
- 最後に、次に試せそうな小さな一歩を1つ添える`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const isUuid = (value: unknown): value is string => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const getSupabase = (request: Request) => {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) throw new Error("Supabase environment variables are missing");
  return createClient(url, anonKey, {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
  });
};

const parseReflection = (content: string) => {
  try { return JSON.parse(content); } catch { return { enjoyed: content, difficult: "", next: "" }; }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = getSupabase(request);
    const url = new URL(request.url);
    const requestBody = request.method === "POST" ? await request.json().catch(() => null) : null;
    const sessionId = request.method === "GET" ? url.searchParams.get("session_id") : requestBody?.session_id;
    if (!isUuid(sessionId)) return json({ error: "有効な session_id が必要です" }, 400);

    if (request.method === "GET") {
      const [{ data: reflection, error: reflectionError }, { data: finding, error: findingError }] = await Promise.all([
        supabase.from("reflections").select("id, session_id, content, created_at, updated_at").eq("session_id", sessionId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("analyses").select("id, session_id, content, created_at").eq("session_id", sessionId).eq("analysis_type", "session_finding").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (reflectionError) throw reflectionError;
      if (findingError) throw findingError;
      return json({ session_id: sessionId, reflection: reflection ? { ...reflection, answers: parseReflection(reflection.content) } : null, finding });
    }

    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const reflection = requestBody?.reflection;
    const answers = {
      enjoyed: typeof reflection?.enjoyed === "string" ? reflection.enjoyed.trim() : "",
      difficult: typeof reflection?.difficult === "string" ? reflection.difficult.trim() : "",
      next: typeof reflection?.next === "string" ? reflection.next.trim() : "",
    };
    if (!answers.enjoyed || !answers.difficult || !answers.next) {
      return json({ error: "3つの振り返りをすべて入力してください" }, 400);
    }
    if (Object.values(answers).some((answer) => answer.length > 1000)) {
      return json({ error: "各回答は1000文字以内で入力してください" }, 400);
    }

    const [{ data: session, error: sessionError }, { data: chat, error: chatError }, { data: existingReflection, error: existingReflectionError }] = await Promise.all([
      supabase.from("mission_sessions").select("id, child_id, mission_id").eq("id", sessionId).single(),
      supabase.from("chat_messages").select("role, content, created_at").eq("session_id", sessionId).order("created_at", { ascending: true }).limit(40),
      supabase.from("reflections").select("id").eq("session_id", sessionId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (sessionError) throw sessionError;
    if (chatError) throw chatError;
    if (existingReflectionError) throw existingReflectionError;

    const reflectionContent = JSON.stringify(answers);
    const reflectionQuery = existingReflection
      ? supabase.from("reflections").update({ content: reflectionContent, updated_at: new Date().toISOString() }).eq("id", existingReflection.id)
      : supabase.from("reflections").insert({ session_id: sessionId, content: reflectionContent });
    const { data: savedReflection, error: saveReflectionError } = await reflectionQuery
      .select("id, session_id, content, created_at, updated_at").single();
    if (saveReflectionError) throw saveReflectionError;

    const transcript = (chat ?? []).map((item) => `${item.role === "assistant" ? "AI" : "子ども"}: ${item.content}`).join("\n");
    const prompt = `【AIとの会話】\n${transcript || "会話記録なし"}\n\n【振り返り】\n楽しかったこと: ${answers.enjoyed}\n難しかったこと: ${answers.difficult}\n次に試したいこと: ${answers.next}`;
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "Gemini API key is not configured" }, 500);
    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 300, thinkingConfig: { thinkingLevel: "minimal" } },
      }),
    });
    if (!geminiResponse.ok) {
      console.error("Gemini API error", geminiResponse.status, await geminiResponse.text());
      return json({ error: "今回の発見を生成できませんでした", reflection: savedReflection }, 502);
    }
    const geminiData = await geminiResponse.json();
    const findingText = geminiData.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("").trim();
    if (!findingText) return json({ error: "今回の発見を生成できませんでした", reflection: savedReflection }, 502);

    const { data: existingFinding, error: existingFindingError } = await supabase.from("analyses").select("id").eq("session_id", sessionId).eq("analysis_type", "session_finding").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existingFindingError) throw existingFindingError;
    const findingQuery = existingFinding
      ? supabase.from("analyses").update({ content: findingText }).eq("id", existingFinding.id)
      : supabase.from("analyses").insert({ child_id: session.child_id, session_id: sessionId, analysis_type: "session_finding", content: findingText });
    const { data: savedFinding, error: saveFindingError } = await findingQuery.select("id, session_id, content, created_at").single();
    if (saveFindingError) throw saveFindingError;

    return json({ session_id: sessionId, reflection: { ...savedReflection, answers }, finding: savedFinding });
  } catch (error) {
    console.error(error);
    return json({ error: "処理中にエラーが発生しました" }, 500);
  }
});
