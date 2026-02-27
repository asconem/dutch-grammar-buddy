import { NextResponse } from "next/server";

const USERS = {
  matt: process.env.USER_MATT_PASSWORD,
  tuz: process.env.USER_TUZ_PASSWORD,
};

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    const lower = username.toLowerCase();

    // Guest access — no password needed
    if (lower === "guest") {
      const res = NextResponse.json({ success: true, user: "guest" });
      res.cookies.set("dgb_user", "guest", {
        httpOnly: false,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: "/",
      });
      return res;
    }

    // Authenticated users
    if (!USERS[lower]) {
      return NextResponse.json({ error: "Unknown user" }, { status: 401 });
    }

    if (!password || password !== USERS[lower]) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    const res = NextResponse.json({ success: true, user: lower });
    res.cookies.set("dgb_user", lower, {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
