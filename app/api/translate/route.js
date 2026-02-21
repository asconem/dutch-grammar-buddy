import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(request) {
  try {
    const { phrase } = await request.json();

    if (!phrase?.trim()) {
      return NextResponse.json({ error: "No phrase provided" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Translate this Dutch phrase to English. Return ONLY the English translation, nothing else. No quotes, no explanation, no preamble.\n\nDutch: "${phrase.trim()}"`,
        },
      ],
    });

    const translation = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    return NextResponse.json({ translation });
  } catch (err) {
    console.error("Translation error:", err);

    const status = err?.status || err?.statusCode || 500;
    let error = "Translation failed. Please try again.";

    if (status === 401) {
      error = "Invalid API key. Check your ANTHROPIC_API_KEY in Vercel environment variables.";
    } else if (status === 403) {
      error = "API key doesn't have permission. Check your key at console.anthropic.com.";
    } else if (status === 429) {
      error = "Rate limited — too many requests. Wait a moment and try again.";
    } else if (status === 529) {
      error = "Anthropic's API is temporarily overloaded. Try again in a minute.";
    } else if (err?.error?.type === "insufficient_credits" || err?.message?.includes("credit")) {
      error = "API credits depleted. Top up at console.anthropic.com/settings/billing.";
    }

    return NextResponse.json({ error }, { status });
  }
}
