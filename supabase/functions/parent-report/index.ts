import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

  if (request.method !== "GET" && request.method !== "POST") {
  return json({ error: "Method not allowed" }, 405);
}

try {
  const url = new URL(request.url);

  const body =
    request.method === "POST"
      ? await request.json().catch(() => null)
      : null;

  const childId =
    request.method === "GET"
      ? url.searchParams.get("child_id")
      : body?.child_id;

    if (!isUuid(childId)) {
      return json({ error: "有効な child_id が必要です" }, 400);
    }

   const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error("Supabase environment variables are missing");
}

if (!geminiApiKey) {
  throw new Error("Gemini API key is not configured");
}

// ログイン中ユーザーを確認する
const authorization = request.headers.get("Authorization");

if (!authorization) {
  return json({ error: "ログインが必要です" }, 401);
}

const accessToken = authorization.replace(/^Bearer\s+/i, "");

const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      Authorization: authorization,
    },
  },
});

const {
  data: { user },
  error: authError,
} = await authClient.auth.getUser(accessToken);

if (authError || !user) {
  return json({ error: "ログイン情報を確認できませんでした" }, 401);
}

// profiles から本人のroleと紐づく子どもを取得する
const { data: profile, error: profileError } = await authClient
  .from("profiles")
  .select("role, child_id")
  .eq("id", user.id)
  .single();

if (profileError || !profile) {
  return json({ error: "権限情報を確認できませんでした" }, 403);
}

if (profile.role !== "parent") {
  return json({ error: "保護者のみ利用できます" }, 403);
}

if (profile.child_id !== childId) {
  return json({ error: "この子どものレポートにはアクセスできません" }, 403);
}

// 本人確認が終わってから service_role を使う
const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 子ども情報
    const { data: child, error: childError } = await supabase
      .from("children")
      .select("id, name, grade")
      .eq("id", childId)
      .single();

    if (childError) throw childError;

// GETの場合は、保存済みの保護者レポート一覧を返す
if (request.method === "GET") {
  const { data: reports, error: reportsError } = await supabase
    .from("parent_reports")
    .select(
      "id, child_id, analysis_id, content, status, created_at, updated_at",
    )
    .eq("child_id", childId)
    .order("created_at", { ascending: false });

  if (reportsError) throw reportsError;

  const parsedReports = (reports ?? []).map((report) => {
    let parsedContent: unknown = report.content;

    try {
      parsedContent = JSON.parse(report.content);
    } catch {
      // JSONでなければ元の文字列をそのまま返す
    }

    return {
      ...report,
      content: parsedContent,
    };
  });

  return json({
    child,
    reports: parsedReports,
  });
}

    // 最新ミッション
    const { data: latestSession, error: sessionError } = await supabase
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
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (sessionError) throw sessionError;

    // 最新ミッションに紐づく情報
    const [
      { data: reflection, error: reflectionError },
      { data: facilitatorNote, error: noteError },
      { data: sessionFinding, error: findingError },
      { data: chats, error: chatsError },
    ] = await Promise.all([
      supabase
        .from("reflections")
        .select("content, created_at")
        .eq("session_id", latestSession.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("facilitator_notes")
        .select("content, created_at")
        .eq("session_id", latestSession.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("analyses")
        .select("id, content, created_at")
        .eq("session_id", latestSession.id)
        .eq("analysis_type", "session_finding")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("chat_messages")
        .select("role, content, created_at")
        .eq("session_id", latestSession.id)
        .order("created_at", { ascending: true })
        .limit(40),
    ]);

    if (reflectionError) throw reflectionError;
    if (noteError) throw noteError;
    if (findingError) throw findingError;
    if (chatsError) throw chatsError;

    // 最新の横断分析
    const { data: crossAnalysis, error: crossError } = await supabase
      .from("analyses")
      .select("id, content, created_at")
      .eq("child_id", childId)
      .eq("analysis_type", "cross_mission")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (crossError) throw crossError;

    if (!crossAnalysis) {
      return json(
        { error: "先に横断分析を生成してください" },
        400,
      );
    }

    const chatTranscript =
      chats
        ?.map(
          (message) =>
            `${message.role === "assistant" ? "AI" : "子ども"}: ${message.content}`,
        )
        .join("\n") ?? "";

    const prompt = `
あなたは、小学生の体験学習の記録を保護者にわかりやすく伝えるアシスタントです。

以下の情報をもとに、保護者向けの活動レポートを作ってください。

重要なルール：
- 出力は必ず自然な日本語のみを使用する
- 他言語の文字を混ぜない
- 子どもの性格、能力、才能、適職を断定しない
- 「○○タイプ」のような固定的なラベルを付けない
- 記録にないことを推測しない
- 良し悪しを評価しすぎない
- 実際の発言や行動を根拠にする
- 保護者が子どもと会話を広げられる表現にする
- ファシリテーター所感がない場合は、存在しない内容を作らない

次の形式のJSONのみを返してください。

{
  "title": "...",
  "current_activity": "...",
  "enjoyed_and_challenged": "...",
  "thinking_seen": "...",
  "facilitator_view": "...",
  "continuing_patterns": ["..."],
  "recent_changes": ["..."],
  "next_experiences": ["..."],
  "parent_child_conversation": ["..."],
  "summary": "..."
}

【子ども】
${JSON.stringify(child)}

【今回のミッション】
${JSON.stringify(latestSession)}

【AI壁打ち履歴】
${chatTranscript || "記録なし"}

【子どもの振り返り】
${reflection?.content ?? "記録なし"}

【今回の発見】
${sessionFinding?.content ?? "記録なし"}

【ファシリテーター所感】
${facilitatorNote?.content ?? "記録なし"}

【過去ミッション横断分析】
${crossAnalysis.content}
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
            maxOutputTokens: 1400,
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
        { error: "保護者向けレポートを生成できませんでした" },
        502,
      );
    }

    const geminiData = await geminiResponse.json();

    const resultText = geminiData.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!resultText) {
      return json(
        { error: "レポート結果を取得できませんでした" },
        502,
      );
    }

    let reportResult;

    try {
      reportResult = JSON.parse(resultText);
    } catch {
      console.error("Gemini JSON parse error", resultText);

      return json(
        { error: "レポート結果の形式が不正です" },
        502,
      );
    }

    // parent_reports に draft として保存
    const { data: savedReport, error: saveError } = await supabase
      .from("parent_reports")
      .insert({
        child_id: childId,
        analysis_id: crossAnalysis.id,
        content: JSON.stringify(reportResult),
        status: "draft",
      })
      .select()
      .single();

    if (saveError) throw saveError;

    return json({
      child,
      session_id: latestSession.id,
      report: reportResult,
      saved_report: savedReport,
    });
  } catch (error) {
    console.error(error);

    return json(
      { error: "保護者レポートの処理中にエラーが発生しました" },
      500,
    );
  }
});