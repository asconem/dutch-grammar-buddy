import { NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

export async function POST(request) {
  try {
    const { text } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: text.trim() },
        voice: { languageCode: "nl-NL", name: "nl-NL-Wavenet-A" },
        audioConfig: { audioEncoding: "MP3" },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("Google TTS error:", err);

      if (response.status === 403) {
        return NextResponse.json(
          { error: "Google TTS API not enabled or key invalid. Check your Google Cloud console." },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: "Pronunciation failed. Please try again." },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ audio: data.audioContent });
  } catch (err) {
    console.error("Speak error:", err);
    return NextResponse.json(
      { error: "Pronunciation failed. Please try again." },
      { status: 500 }
    );
  }
}
