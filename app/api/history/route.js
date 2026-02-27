import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

function getHistoryKey(user) {
  return `dgb:history:${user}`;
}

function getUser() {
  const cookieStore = cookies();
  const user = cookieStore.get("dgb_user")?.value;
  return user || null;
}

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  if (data.result === null || data.result === undefined) return null;
  try {
    return typeof data.result === "string" ? JSON.parse(data.result) : data.result;
  } catch {
    return null;
  }
}

async function kvSet(key, value) {
  const res = await fetch(`${KV_URL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["SET", key, JSON.stringify(value)]),
  });
  const data = await res.json();
  if (data.error) {
    console.error("KV SET error:", data.error);
    throw new Error(data.error);
  }
  return data;
}

export async function GET() {
  try {
    const user = getUser();
    if (!user || user === "guest") {
      return NextResponse.json({ history: [] });
    }
    const history = await kvGet(getHistoryKey(user));
    return NextResponse.json({ history: history || [] });
  } catch (err) {
    console.error("History load error:", err);
    return NextResponse.json({ history: [] });
  }
}

export async function POST(request) {
  try {
    const user = getUser();
    if (!user || user === "guest") {
      return NextResponse.json({ error: "Guests cannot save" }, { status: 403 });
    }
    const { history } = await request.json();
    if (!Array.isArray(history)) {
      return NextResponse.json({ error: "Invalid history format" }, { status: 400 });
    }
    await kvSet(getHistoryKey(user), history);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("History save error:", err);
    return NextResponse.json({ error: "Failed to save history" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = getUser();
    if (!user || user === "guest") {
      return NextResponse.json({ error: "Guests cannot modify history" }, { status: 403 });
    }
    await kvSet(getHistoryKey(user), []);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("History clear error:", err);
    return NextResponse.json({ error: "Failed to clear history" }, { status: 500 });
  }
}
