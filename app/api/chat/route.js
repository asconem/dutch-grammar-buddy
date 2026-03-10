import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a Dutch language grammar tutor helping an English speaker who is learning Dutch via Duolingo. You explain grammar rules, word choice, sentence structure, and usage patterns clearly and practically.

Guidelines:
- Explain grammar rules clearly and concisely, using the specific phrase as your example
- Compare/contrast with English grammar when helpful
- When explaining word choice (e.g. "zitten" vs "liggen"), give additional example sentences with translations
- Use simple terminology — avoid heavy linguistic jargon unless asked
- If asked about something unrelated to the phrase, gently redirect
- Keep explanations focused and practical, not academic
- Use **bold** for Dutch words being discussed and *italics* for English translations
- Be encouraging — Dutch grammar is genuinely tricky for English speakers
- Keep responses concise. Don't over-explain unless the user asks for more detail.`;

export async function POST(request) {
  try {
    const { dutchPhrase, translation, messages } = await request.json();

    if (!dutchPhrase?.trim() || !messages?.length) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Build the API messages with context baked into the first user message
    const contextPrefix = `[Context — Dutch phrase: "${dutchPhrase.trim()}" | English translation: "${translation}"]\n\n`;

    const apiMessages = messages.map((msg, i) => ({
      role: msg.role,
      content: i === 0 && msg.role === "user" ? contextPrefix + msg.content : msg.content,
    }));

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    });

    const response = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    return NextResponse.json({ response });
  } catch (err) {
    console.error("Chat error:", err);

    const status = err?.status || err?.statusCode || 500;
    let error = "Chat failed. Please try again.";

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
