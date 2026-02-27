import { NextResponse } from "next/server";

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

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
  return res.json();
}

export async function POST() {
  try {
    // Check if old key has data
    const oldHistory = await kvGet("dgb:history");
    if (oldHistory && Array.isArray(oldHistory) && oldHistory.length > 0) {
      // Check if matt already has data
      const mattHistory = await kvGet("dgb:history:matt");
      if (!mattHistory || !Array.isArray(mattHistory) || mattHistory.length === 0) {
        // Migrate old data to matt
        await kvSet("dgb:history:matt", oldHistory);
        return NextResponse.json({ migrated: true, count: oldHistory.length });
      }
      return NextResponse.json({ migrated: false, reason: "matt already has history" });
    }
    return NextResponse.json({ migrated: false, reason: "no old data to migrate" });
  } catch (err) {
    console.error("Migration error:", err);
    return NextResponse.json({ error: "Migration failed" }, { status: 500 });
  }
}
