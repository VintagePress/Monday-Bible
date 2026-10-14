// Bible bot - Vercel serverless function.
// Reads the live Bible (index.html on the same site), and asks Gemini to answer
// a CSM's question using ONLY that content. The API key stays on the server.

const MODELS = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.5-flash"].filter(Boolean);
const CACHE_MS = 5 * 60 * 1000;
let cache = { at: 0, sections: null };

// ---------- Load the Bible and split it into sections ----------
function clean(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(li|p|tr|h3|h4|div)[^>]*>/gi, "\n")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

async function loadBible(origin) {
  if (cache.sections && Date.now() - cache.at < CACHE_MS) return cache.sections;
  const html = await (await fetch(origin + "/index.html")).text();

  const sections = [];
  const partRe = /<div class="part" id="(part-\d)">([\s\S]*?)(?=<div class="part" id="part-\d">|<\/article>)/g;
  let part;
  while ((part = partRe.exec(html))) {
    const partTitle = clean((part[2].match(/<h2>([\s\S]*?)<\/h2>/) || [])[1] || "");
    const topicRe = /<section class="topic" id="([^"]+)">([\s\S]*?)<\/section>/g;
    let t;
    while ((t = topicRe.exec(part[2]))) {
      const title = clean((t[2].match(/<h3>([\s\S]*?)<\/h3>/) || [])[1] || "");
      const owner = (t[2].match(/Owner: ([^·<]+)/) || [])[1];
      sections.push({ id: t[1], part: partTitle, title, owner: owner ? owner.trim() : "", text: clean(t[2]) });
    }
  }
  cache = { at: Date.now(), sections };
  return sections;
}

// ---------- Prompt ----------
const RULES = `You are the "Bible bot" - an internal assistant for monday.com Customer Success Managers (CSMs).
A CSM tells you what a client said (usually an objection about adopting monday AI) or asks a question.
Answer ONLY using the Bible sections provided below. Never use outside knowledge or make up facts, numbers, settings or features.

Classify the objection into one of the Bible's four parts:
- Information Gaps: the client asks a question that has a factual answer.
- Control: the client wants to move forward but in a controlled way (limits, permissions, kill switch, logs, small start).
- Trust: the client needs proof it works and is worth it.
- Readiness: it's not the right time (budget, migration, bandwidth, job fears).

Write for a CSM who needs to respond to a client:
- "answer": what the CSM can say to the client, 2-4 short sentences, plain and confident, no hype.
- "ask_next": one question the CSM should ask the client to move forward.
- "details": up to 3 short facts or tips from the Bible the CSM should know (can be empty).
- "section_ids": the ids of the 1-3 Bible sections you used, most relevant first.
- "confident": false if the Bible doesn't clearly cover the question, or the relevant section is marked "Needs owner review" or "Product gap" for the specific point asked. When false, say clearly in "answer" what isn't covered, and don't guess.
- "owner": the owner of the main section used (e.g. Security, Finance, Product).
If a section is marked Draft, you can use it, but don't present it as official policy.
Never include commercial promises (discounts, free credits).`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    type: { type: "STRING", enum: ["Information Gaps", "Control", "Trust", "Readiness", "Not covered"] },
    answer: { type: "STRING" },
    ask_next: { type: "STRING" },
    details: { type: "ARRAY", items: { type: "STRING" } },
    section_ids: { type: "ARRAY", items: { type: "STRING" } },
    confident: { type: "BOOLEAN" },
    owner: { type: "STRING" }
  },
  required: ["type", "answer", "ask_next", "details", "section_ids", "confident", "owner"]
};

async function askGemini(prompt) {
  let lastError;
  for (const model of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: SCHEMA }
      })
    });
    if (r.status === 404) { lastError = `Model ${model} not found`; continue; }
    const data = await r.json();
    if (!r.ok) throw new Error((data.error && data.error.message) || `Gemini error ${r.status}`);
    const text = (((data.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text).join("") || "";
    return { model, result: JSON.parse(text) };
  }
  throw new Error(lastError || "No Gemini model available");
}

// ---------- Handler ----------
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "The GEMINI_API_KEY setting is missing in Vercel." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const message = String(body.message || "").trim().slice(0, 1500);
  if (!message) return res.status(400).json({ error: "Empty message" });
  const history = Array.isArray(body.history) ? body.history.slice(-4) : [];

  try {
    const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
    const sections = await loadBible(origin);
    const bible = sections.map(s => `### [${s.id}] ${s.part} > ${s.title}\n${s.text}`).join("\n\n");
    const convo = history.map(h => `CSM: ${String(h.q).slice(0, 500)}\nBot: ${String(h.a).slice(0, 500)}`).join("\n");

    const prompt = `${RULES}\n\n=== THE BIBLE ===\n${bible}\n=== END OF BIBLE ===\n\n` +
      (convo ? `Earlier in this conversation:\n${convo}\n\n` : "") +
      `CSM's message:\n"""${message}"""`;

    const { model, result } = await askGemini(prompt);

    // Keep only section ids that really exist, and attach their titles for the links
    const byId = Object.fromEntries(sections.map(s => [s.id, s]));
    result.sources = (result.section_ids || []).filter(id => byId[id]).map(id => ({ id, title: byId[id].title, part: byId[id].part }));
    delete result.section_ids;
    if (!result.sources.length) result.confident = false;

    res.status(200).json({ ...result, model });
  } catch (e) {
    res.status(500).json({ error: e.message || "Something went wrong" });
  }
};
