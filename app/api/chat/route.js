export const runtime = "edge";

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
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const contextPrefix = `[Context — Dutch phrase: "${dutchPhrase.trim()}" | English translation: "${translation}"]\n\n`;

    const apiMessages = messages.map((msg, i) => ({
      role: msg.role,
      content: i === 0 && msg.role === "user" ? contextPrefix + msg.content : msg.content,
    }));

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        stream: true,
        system: SYSTEM_PROMPT,
        messages: apiMessages,
      }),
    });

    if (!anthropicRes.ok) {
      const status = anthropicRes.status;
      return Response.json(
        { error: getErrorMessage(status) },
        { status }
      );
    }

    // Parse SSE stream from Anthropic, extract text deltas, forward as plain text
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readable = new ReadableStream({
      async start(controller) {
        const reader = anthropicRes.body.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop(); // keep incomplete line in buffer

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const event = JSON.parse(data);
                if (
                  event.type === "content_block_delta" &&
                  event.delta?.type === "text_delta"
                ) {
                  controller.enqueue(encoder.encode(event.delta.text));
                }
              } catch {
                // skip malformed JSON lines
              }
            }
          }
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(`\n[ERROR]Chat failed. Please try again.`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Chat error:", err);
    return Response.json(
      { error: "Chat failed. Please try again." },
      { status: 500 }
    );
  }
}

function getErrorMessage(status) {
  if (status === 401)
    return "Invalid API key. Check your ANTHROPIC_API_KEY in Vercel environment variables.";
  if (status === 403)
    return "API key doesn't have permission. Check your key at console.anthropic.com.";
  if (status === 429)
    return "Rate limited — too many requests. Wait a moment and try again.";
  if (status === 529)
    return "Anthropic's API is temporarily overloaded. Try again in a minute.";
  return "Chat failed. Please try again.";
}
