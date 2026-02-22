import { NextResponse } from "next/server";

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const HISTORY_KEY = "dgb:history";

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function kvSet(key, value) {
  await fetch(`${KV_URL}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(JSON.stringify(value)),
  });
}

export async function GET() {
  try {
    const history = await kvGet(HISTORY_KEY);
    return NextResponse.json({ history: history || [] });
  } catch (err) {
    console.error("History load error:", err);
    return NextResponse.json({ history: [] });
  }
}

export async function POST(request) {
  try {
    const { history } = await request.json();
    if (!Array.isArray(history)) {
      return NextResponse.json({ error: "Invalid history format" }, { status: 400 });
    }
    await kvSet(HISTORY_KEY, history);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("History save error:", err);
    return NextResponse.json({ error: "Failed to save history" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await kvSet(HISTORY_KEY, []);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("History clear error:", err);
    return NextResponse.json({ error: "Failed to clear history" }, { status: 500 });
  }
}
