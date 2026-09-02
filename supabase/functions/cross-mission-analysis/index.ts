import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await request.json().catch(() => null);
    const childId = body?.child_id;

    if (!isUuid(childId)) {
      return json({ error: "有効な child_id が必要です" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase environment variables are missing");
    }

    if (!geminiApiKey) {
      throw new Error("Gemini API key is not configured");
    }

    // Edge Function内だけでservice_roleを使用する。
    // ブラウザには絶対に渡さない。
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 子どもの基本情報
    const { data: child, error: childError } = await supabase
      .from("children")
      .select("id, name, grade")
      .eq("id", childId)
      .single();

    if (childError) throw childError;

    // 過去のミッション履歴
    const { data: sessions, error: sessionsError } = await supabase
      .from("mission_sessions")
      .select(`
        id,
        status,
        started_at,
        completed_at,
        missions (
          id,
          title,
          theme,
          description
        )
      `)
      .eq("child_id", childId)
      .order("started_at", { ascending: true });

    if (sessionsError) throw sessionsError;

    if (!sessions || sessions.length === 0) {
      return json({ error: "分析できるミッション履歴がありません" }, 400);
    }

    const sessionIds = sessions.map((session) => session.id);

    // AI壁打ち履歴
    const { data: chats, error: chatsError } = await supabase
      .from("chat_messages")
      .select("session_id, role, content, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true });

    if (chatsError) throw chatsError;

    // 振り返り
    const { data: reflections, error: reflectionsError } = await supabase
      .from("reflections")
      .select("session_id, content, created_at")
      .in("session_id", sessionIds);

    if (reflectionsError) throw reflectionsError;

    // ファシリテーターメモ
    const { data: notes, error: notesError } = await supabase
      .from("facilitator_notes")
      .select("session_id, content, created_at")
      .in("session_id", sessionIds);

    if (notesError) throw notesError;

    // 過去の「今回の発見」
    const { data: findings, error: findingsError } = await supabase
      .from("analyses")
      .select("session_id, content, created_at")
      .eq("child_id", childId)
      .eq("analysis_type", "session_finding")
      .in("session_id", sessionIds);

    if (findingsError) throw findingsError;

    // Geminiへ渡しやすい形に整理
    const history = sessions.map((session) => ({
      session_id: session.id,
      mission: session.missions,
      started_at: session.started_at,

      chat_history:
        chats?.filter((chat) => chat.session_id === session.id) ?? [],

      reflection:
        reflections?.find(
          (reflection) => reflection.session_id === session.id,
        )?.content ?? null,

      facilitator_note:
        notes?.find((note) => note.session_id === session.id)?.content ?? null,

      session_finding:
        findings?.find((finding) => finding.session_id === session.id)
          ?.content ?? null,
    }));

    const prompt = `
あなたは、小学生の体験学習の記録を整理するアシスタントです。

以下は、同じ子どもの複数回のミッション記録です。

重要なルール：
- 性格や才能、適職を断定しない
- 「○○タイプ」のような固定ラベルを付けない
- 記録にないことを推測しすぎない
- 過去の具体的な発言や行動を根拠にする
- 現時点で見えている傾向・変化として表現する
- 子どもの可能性を狭めない

次の5項目を日本語で整理してください。

1. 繰り返し現れている興味
2. 継続して楽しんでいる活動
3. 新しく見え始めた変化
4. 次に試すとよい体験
5. 根拠となる過去の記録

JSONのみを返してください。

形式：
{
  "recurring_interests": ["..."],
  "enjoyed_activities": ["..."],
  "changes": ["..."],
  "next_experiences": ["..."],
  "evidence": [
    {
      "mission": "...",
      "evidence": "..."
    }
  ]
}

子ども：
${JSON.stringify(child)}

ミッション履歴：
${JSON.stringify(history)}
`;

    const model =
      Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
            thinkingConfig: {
              thinkingLevel: "minimal",
            },
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      console.error(
        "Gemini API error",
        geminiResponse.status,
        await geminiResponse.text(),
      );

      return json(
        { error: "横断分析を生成できませんでした" },
        502,
      );
    }

    const geminiData = await geminiResponse.json();

    const resultText = geminiData.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!resultText) {
      return json({ error: "分析結果を取得できませんでした" }, 502);
    }

    let analysisResult;

    try {
      analysisResult = JSON.parse(resultText);
    } catch {
      console.error("Gemini JSON parse error", resultText);
      return json({ error: "分析結果の形式が不正です" }, 502);
    }

    // 横断分析をDBへ保存
    const { data: savedAnalysis, error: saveError } = await supabase
      .from("analyses")
      .insert({
        child_id: childId,
        session_id: null,
        analysis_type: "cross_mission",
        content: JSON.stringify(analysisResult),
      })
      .select("id, child_id, analysis_type, content, created_at")
      .single();

    if (saveError) throw saveError;

    return json({
      child,
      mission_count: sessions.length,
      analysis: analysisResult,
      saved_analysis: savedAnalysis,
    });
  } catch (error) {
    console.error(error);

    return json(
      { error: "横断分析の処理中にエラーが発生しました" },
      500,
    );
  }
});