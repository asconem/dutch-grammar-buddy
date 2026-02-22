import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(request) {
  try {
    const { image, mediaType } = await request.json();

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/png",
                data: image,
              },
            },
            {
              type: "text",
              text: `This is a screenshot from Duolingo or a similar language learning app. Extract ALL Dutch phrases/sentences visible in the screenshot. Return each Dutch phrase on its own line, nothing else — no quotes, no explanation, no English text, no UI labels, no numbering, no bullet points. Just the raw Dutch phrases, one per line. If you cannot find any Dutch text, respond with exactly: NO_DUTCH_FOUND`,
            },
          ],
        },
      ],
    });

    const extracted = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    if (extracted === "NO_DUTCH_FOUND") {
      return NextResponse.json(
        { error: "Couldn't find any Dutch text in this screenshot. Try a clearer capture." },
        { status: 400 }
      );
    }

    const phrases = extracted
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return NextResponse.json({ phrases });
  } catch (err) {
    console.error("Screenshot parse error:", err);

    const status = err?.status || err?.statusCode || 500;
    let error = "Failed to parse screenshot. Please try again.";

    if (status === 401) {
      error = "Invalid API key. Check your ANTHROPIC_API_KEY in Vercel environment variables.";
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
