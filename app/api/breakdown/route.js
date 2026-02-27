import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(request) {
  try {
    const { phrase, translation } = await request.json();

    if (!phrase?.trim()) {
      return NextResponse.json({ error: "No phrase provided" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Given this Dutch phrase and its English translation, provide a word-by-word breakdown.

Dutch: "${phrase.trim()}"
English: "${translation}"

Return ONLY a JSON array where each element is an object with these fields:
- "dutch": the Dutch word
- "english": the closest English equivalent (1-2 words max)
- "pos": abbreviated part of speech (use exactly one of: PRON, VERB, NOUN, ADJ, ADV, ART, PREP, CONJ, NUM, PART, INT)

For separable verbs or multi-word units, keep them as individual words but note the connection in the english field.

Return ONLY the JSON array, no markdown, no backticks, no explanation. Example format:
[{"dutch":"Ik","english":"I","pos":"PRON"},{"dutch":"vind","english":"find/think","pos":"VERB"}]`,
        },
      ],
    });

    const text = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    try {
      const clean = text.replace(/```json|```/g, "").trim();
      const breakdown = JSON.parse(clean);
      if (Array.isArray(breakdown)) {
        return NextResponse.json({ breakdown });
      }
      return NextResponse.json({ error: "Invalid breakdown format" }, { status: 500 });
    } catch {
      return NextResponse.json({ error: "Failed to parse breakdown" }, { status: 500 });
    }
  } catch (err) {
    console.error("Breakdown error:", err);

    const status = err?.status || err?.statusCode || 500;
    let error = "Breakdown failed. Please try again.";

    if (status === 401) {
      error = "Invalid API key. Check your ANTHROPIC_API_KEY in Vercel environment variables.";
    } else if (status === 429) {
      error = "Rate limited — too many requests. Wait a moment and try again.";
    } else if (status === 529) {
      error = "Anthropic's API is temporarily overloaded. Try again in a minute.";
    }

    return NextResponse.json({ error }, { status });
  }
}
