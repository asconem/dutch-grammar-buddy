"use client";

import { useState, useRef, useEffect } from "react";

const MAX_HISTORY = 50;

async function loadHistoryFromServer() {
  try {
    const res = await fetch("/api/history");
    const data = await res.json();
    return data.history || [];
  } catch {
    return [];
  }
}

async function saveHistoryToServer(history) {
  try {
    await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: history.slice(0, MAX_HISTORY) }),
    });
  } catch {}
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState(null); // null = checking, "login" = show login screen
  const [loginError, setLoginError] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [dutchPhrase, setDutchPhrase] = useState("");
  const [translation, setTranslation] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [hasTranslated, setHasTranslated] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [parseError, setParseError] = useState("");
  const [screenshotPhrases, setScreenshotPhrases] = useState([]);
  const [showScreenshotPicker, setShowScreenshotPicker] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState(-1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [breakdown, setBreakdown] = useState(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const phraseTextareaRef = useRef(null);

  const isGuest = currentUser === "guest";

  // Check for existing login cookie on mount
  useEffect(() => {
    const cookie = document.cookie.split("; ").find((c) => c.startsWith("dgb_user="));
    if (cookie) {
      setCurrentUser(cookie.split("=")[1]);
    } else {
      setCurrentUser("login");
    }
  }, []);

  const handleLogin = async (user) => {
    if (user === "guest") {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "guest" }),
      });
      if (res.ok) setCurrentUser("guest");
      return;
    }
    setSelectedUser(user);
    setLoginPassword("");
    setLoginError("");
  };

  const submitPassword = async () => {
    if (!loginPassword.trim()) return;
    setIsLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: selectedUser, password: loginPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(selectedUser);
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch {
      setLoginError("Login failed. Please try again.");
    }
    setIsLoggingIn(false);
  };

  const handleLogout = () => {
    document.cookie = "dgb_user=; path=/; max-age=0";
    setCurrentUser("login");
    setSelectedUser(null);
    setLoginPassword("");
    setHistory([]);
    setDutchPhrase("");
    setTranslation("");
    setChatMessages([]);
    setHasTranslated(false);
    setIsBookmarked(false);
    setBreakdown(null);
  };

  const speakPhrase = async () => {
    if (!dutchPhrase.trim() || isSpeaking) return;
    setIsSpeaking(true);
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: dutchPhrase.trim() }),
      });
      const data = await res.json();
      if (data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        await audio.play();
      } else {
        setIsSpeaking(false);
      }
    } catch {
      setIsSpeaking(false);
    }
  };

  const fetchBreakdown = async (phrase, trans) => {
    setIsLoadingBreakdown(true);
    setBreakdown(null);
    try {
      const res = await fetch("/api/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase, translation: trans }),
      });
      const data = await res.json();
      if (data.breakdown) {
        setBreakdown(data.breakdown);
      }
    } catch {}
    setIsLoadingBreakdown(false);
  };

  // Auto-resize the Dutch phrase textarea
  useEffect(() => {
    const el = phraseTextareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [dutchPhrase]);

  useEffect(() => {
    // Clean up old localStorage data from previous versions
    try { localStorage.removeItem("dgb_history"); } catch {}

    // Ensure page starts at top
    window.scrollTo(0, 0);

    if (currentUser && currentUser !== "login" && currentUser !== "guest") {
      // One-time migration of old shared history to matt's namespace
      if (currentUser === "matt") {
        fetch("/api/migrate", { method: "POST" }).catch(() => {});
      }
      loadHistoryFromServer().then((h) => {
        if (Array.isArray(h)) {
          setHistory(h);
        } else {
          setHistory([]);
        }
      }).catch(() => setHistory([]));
    }
  }, [currentUser]);

  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);

  useEffect(() => {
    if (shouldAutoScroll) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isThinking, shouldAutoScroll]);

  useEffect(() => {
    if (isBookmarked && activeHistoryIndex >= 0 && chatMessages.length > 0) {
      setHistory((prev) => {
        const updated = [...prev];
        if (updated[activeHistoryIndex]) {
          updated[activeHistoryIndex] = {
            ...updated[activeHistoryIndex],
            chat: chatMessages,
          };
          saveHistoryToServer(updated);
        }
        return updated;
      });
    }
  }, [chatMessages, isBookmarked, activeHistoryIndex]);

  const bookmarkCurrent = () => {
    if (!hasTranslated) return;
    if (isBookmarked) {
      if (activeHistoryIndex >= 0) {
        const updated = history.filter((_, i) => i !== activeHistoryIndex);
        setHistory(updated);
        saveHistoryToServer(updated);
        setActiveHistoryIndex(-1);
      }
      setIsBookmarked(false);
      return;
    }
    const entry = {
      dutch: dutchPhrase.trim(),
      english: translation,
      chat: chatMessages,
      timestamp: Date.now(),
    };
    const updated = [entry, ...history.filter((h) => h.dutch !== dutchPhrase.trim())].slice(0, MAX_HISTORY);
    setHistory(updated);
    saveHistoryToServer(updated);
    setIsBookmarked(true);
    setActiveHistoryIndex(0);
  };

  const removeFromHistory = (index) => {
    if (index === activeHistoryIndex) {
      setIsBookmarked(false);
      setActiveHistoryIndex(-1);
    } else if (index < activeHistoryIndex) {
      setActiveHistoryIndex((prev) => prev - 1);
    }
    const updated = history.filter((_, i) => i !== index);
    setHistory(updated);
    saveHistoryToServer(updated);
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistoryToServer([]);
    setIsBookmarked(false);
    setActiveHistoryIndex(-1);
  };

  const loadFromHistory = (entry) => {
    setShouldAutoScroll(false);
    setDutchPhrase(entry.dutch);
    setTranslation(entry.english);
    setChatMessages(entry.chat || []);
    setHasTranslated(true);
    setShowHistory(false);
    setIsBookmarked(true);
    setBreakdown(null);
    setShowBreakdown(false);
    const idx = history.findIndex((h) => h.dutch === entry.dutch && h.timestamp === entry.timestamp);
    setActiveHistoryIndex(idx);
    fetchBreakdown(entry.dutch, entry.english);
  };

  const translatePhrase = async () => {
    if (!dutchPhrase.trim()) return;
    setIsTranslating(true);
    setTranslation("");
    setChatMessages([]);
    setHasTranslated(false);
    setIsBookmarked(false);
    setActiveHistoryIndex(-1);
    setParseError("");
    setBreakdown(null);
    setShowBreakdown(false);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase: dutchPhrase.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setTranslation(data.error);
      } else {
        setTranslation(data.translation || "Translation failed.");
        setHasTranslated(true);
        fetchBreakdown(dutchPhrase.trim(), data.translation);
      }
    } catch {
      setTranslation("Translation error. Please try again.");
    }
    setIsTranslating(false);
  };

  const selectScreenshotPhrase = async (phrase) => {
    setShowScreenshotPicker(false);
    setDutchPhrase(phrase);
    setTranslation("");
    setChatMessages([]);
    setHasTranslated(false);
    setIsBookmarked(false);
    setActiveHistoryIndex(-1);
    setParseError("");
    setBreakdown(null);
    setShowBreakdown(false);
    setIsTranslating(true);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase }),
      });
      const data = await res.json();
      if (data.error) {
        setTranslation(data.error);
      } else {
        setTranslation(data.translation || "Translation failed.");
        setHasTranslated(true);
        fetchBreakdown(phrase, data.translation);
      }
    } catch {
      setTranslation("Translation error. Please try again.");
    }
    setIsTranslating(false);
  };

  const handleScreenshot = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setIsParsing(true);
    setParseError("");
    setDutchPhrase("");
    setTranslation("");
    setChatMessages([]);
    setHasTranslated(false);
    setIsBookmarked(false);
    setActiveHistoryIndex(-1);
    setScreenshotPhrases([]);
    setShowScreenshotPicker(false);

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/parse-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType: file.type || "image/png" }),
      });
      const data = await res.json();

      if (data.error) {
        setParseError(data.error);
      } else if (data.phrases && data.phrases.length > 0) {
        setScreenshotPhrases(data.phrases);
        if (data.phrases.length === 1) {
          await selectScreenshotPhrase(data.phrases[0]);
        } else {
          setShowScreenshotPicker(true);
        }
      }
    } catch {
      setParseError("Failed to process screenshot. Please try again.");
    }
    setIsParsing(false);
  };

  const askQuestion = async () => {
    if (!chatInput.trim() || !hasTranslated) return;
    setShouldAutoScroll(true);
    const question = chatInput.trim();
    setChatInput("");

    const newMessages = [...chatMessages, { role: "user", content: question }];
    setChatMessages(newMessages);
    setIsThinking(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dutchPhrase: dutchPhrase.trim(), translation, messages: newMessages }),
      });
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.error || data.response || "Sorry, couldn't generate a response." },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error getting response. Please try again." },
      ]);
    }
    setIsThinking(false);
  };

  const handleTranslateKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); translatePhrase(); }
  };

  const handleChatKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askQuestion(); }
  };

  const renderText = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i} style={{ color: "#E87A2E" }}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("*") && part.endsWith("*"))
        return <em key={i} style={{ color: "#8BA4B8" }}>{part.slice(1, -1)}</em>;
      return part;
    });
  };

  const formatDate = (timestamp) => {
    const d = new Date(timestamp);
    const diff = Date.now() - d;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <>
      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        textarea:focus, button:focus-visible { outline: 2px solid #e87a2e; outline-offset: -1px; border-radius: 10px; }
        textarea::placeholder { color: #6b7b8d; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a3a4a; border-radius: 3px; }
        @media (max-width: 768px) {
          .main-layout { flex-direction: column !important; padding: 0 16px 32px !important; height: auto !important; }
          .left-col { width: 100% !important; overflow-y: visible !important; }
          .right-col {
            position: relative !important;
            top: auto !important;
            align-self: auto !important;
            height: auto !important;
            max-height: none !important;
          }
        }
      `}</style>

      {/* Login Screen */}
      {(!currentUser || currentUser === "login") && (
        <div style={{
          minHeight: "100vh", background: "#0F1923", color: "#E0E8EF",
          fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{
            position: "fixed", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse at 20% 0%, rgba(232,122,46,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(33,70,139,0.08) 0%, transparent 60%)",
          }} />
          <div style={{
            textAlign: "center", position: "relative", zIndex: 1,
            animation: "fadeIn 0.3s ease-out",
          }}>
            <div style={{
              display: "flex", width: 48, height: 34, margin: "0 auto 14px",
              borderRadius: 3, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}>
              <div style={{ flex: 1, background: "#AE1C28" }} />
              <div style={{ flex: 1, background: "#FFF" }} />
              <div style={{ flex: 1, background: "#21468B" }} />
            </div>
            <h1 style={{
              fontFamily: "'Fraunces', serif", fontSize: 28,
              fontWeight: 700, color: "#F5F5F0", letterSpacing: "-0.02em", marginBottom: 4,
            }}>
              Dutch Grammar Buddy
            </h1>
            <p style={{ fontSize: 13, color: "#7A8D9E", marginBottom: 32 }}>
              Choose your profile to get started.
            </p>

            {!selectedUser ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 220, margin: "0 auto" }}>
                {["Matt", "Tuz"].map((name) => (
                  <button key={name} onClick={() => handleLogin(name.toLowerCase())}
                    style={{
                      padding: "12px 20px", borderRadius: 10, border: "1px solid #2A3A4A",
                      background: "#1A2733", color: "#E0E8EF", fontSize: 16, fontWeight: 600,
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#2A3A4A"; e.currentTarget.style.borderColor = "#E87A2E"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#1A2733"; e.currentTarget.style.borderColor = "#2A3A4A"; }}
                  >
                    {name}
                  </button>
                ))}
                <button onClick={() => handleLogin("guest")}
                  style={{
                    padding: "12px 20px", borderRadius: 10, border: "1px solid #1E2D3D",
                    background: "transparent", color: "#5A6A7A", fontSize: 14,
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    transition: "all 0.15s", marginTop: 6,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#7A8D9E"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#5A6A7A"; }}
                >
                  Continue as Guest
                </button>
              </div>
            ) : (
              <div style={{ width: 220, margin: "0 auto", animation: "fadeIn 0.2s ease-out" }}>
                <p style={{ fontSize: 14, color: "#E0E8EF", marginBottom: 12 }}>
                  Welcome back, <span style={{ color: "#E87A2E", fontWeight: 600 }}>{selectedUser.charAt(0).toUpperCase() + selectedUser.slice(1)}</span>
                </p>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitPassword(); }}
                  autoFocus
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 10,
                    border: loginError ? "1px solid #AE1C28" : "1px solid #2A3A4A",
                    background: "#1A2733", color: "#E0E8EF", fontSize: 15,
                    fontFamily: "'DM Sans', sans-serif", marginBottom: 8,
                  }}
                />
                {loginError && (
                  <p style={{ fontSize: 12, color: "#AE1C28", marginBottom: 8 }}>{loginError}</p>
                )}
                <button onClick={submitPassword} disabled={isLoggingIn}
                  style={{
                    width: "100%", padding: "10px 20px", borderRadius: 10, border: "none",
                    background: "#E87A2E", color: "#FFF", fontSize: 15, fontWeight: 600,
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    opacity: isLoggingIn ? 0.6 : 1, marginBottom: 10,
                  }}
                >
                  {isLoggingIn ? "Logging in…" : "Log In"}
                </button>
                <button onClick={() => { setSelectedUser(null); setLoginError(""); }}
                  style={{
                    background: "transparent", border: "none", color: "#5A6A7A",
                    fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  ← Back
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main App — only shown when logged in */}
      {currentUser && currentUser !== "login" && (
            position: relative !important;
            top: auto !important;
            align-self: auto !important;
            height: auto !important;
            max-height: none !important;
          }
        }
      `}</style>

      <div style={{
        minHeight: "100vh", background: "#0F1923", color: "#E0E8EF",
        fontFamily: "'DM Sans', sans-serif", position: "relative",
      }}>
        <div style={{
          position: "fixed", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at 20% 0%, rgba(232,122,46,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(33,70,139,0.08) 0%, transparent 60%)",
        }} />

        {/* Header */}
        <header style={{ textAlign: "center", padding: "16px 16px 12px", position: "relative", zIndex: 1 }}>
          <div style={{
            display: "flex", width: 40, height: 28, margin: "0 auto 8px",
            borderRadius: 3, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}>
            <div style={{ flex: 1, background: "#AE1C28" }} />
            <div style={{ flex: 1, background: "#FFF" }} />
            <div style={{ flex: 1, background: "#21468B" }} />
          </div>
          <h1 style={{
            fontFamily: "'Fraunces', serif", fontSize: "clamp(22px, 4vw, 28px)",
            fontWeight: 700, color: "#F5F5F0", letterSpacing: "-0.02em", marginBottom: 2,
          }}>
            Dutch Grammar Buddy
          </h1>
          <p style={{ fontSize: 13, color: "#7A8D9E" }}>
            Paste a phrase, upload a screenshot, or tap history. Then ask why.
          </p>
          <div style={{ marginTop: 6, fontSize: 11, color: "#4A5A6A" }}>
            <span>{isGuest ? "Guest" : currentUser?.charAt(0).toUpperCase() + currentUser?.slice(1)}</span>
            <span style={{ margin: "0 6px" }}>·</span>
            <button onClick={handleLogout}
              style={{
                background: "transparent", border: "none", color: "#4A5A6A",
                fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                textDecoration: "underline",
              }}
            >Log out</button>
          </div>
        </header>

        {/* Main two-column layout */}
        <div style={{
          display: "flex", flexDirection: "row", gap: 20, padding: "0 20px 16px",
          maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1,
          height: "calc(100vh - 110px)",
        }}
          className="main-layout"
        >
          {/* LEFT COLUMN — Input, Screenshot picker, History, Translation */}
          <div style={{ width: 360, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}
            className="left-col"
          >
            {/* Dutch Phrase Input */}
            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#E87A2E" }}>
                  Dutch Phrase
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {hasTranslated && (
                    <button
                      onClick={() => {
                        setDutchPhrase("");
                        setTranslation("");
                        setChatMessages([]);
                        setHasTranslated(false);
                        setIsBookmarked(false);
                        setActiveHistoryIndex(-1);
                        setParseError("");
                        setShowHistory(false);
                        setShowScreenshotPicker(false);
                        setShouldAutoScroll(false);
                        setBreakdown(null);
                        setShowBreakdown(false);
                        window.scrollTo(0, 0);
                      }}
                      style={{
                        background: "transparent",
                        border: "1px solid #2A3A4A", borderRadius: 6, padding: "3px 8px",
                        fontSize: 10, color: "#E87A2E", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      + New
                    </button>
                  )}
                  {screenshotPhrases.length > 1 && (
                    <button
                      onClick={() => { setShowScreenshotPicker(!showScreenshotPicker); setShowHistory(false); }}
                      style={{
                        background: showScreenshotPicker ? "#2A3A4A" : "transparent",
                        border: "1px solid #2A3A4A", borderRadius: 6, padding: "3px 8px",
                        fontSize: 10, color: "#E87A2E", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      📷 Phrases ({screenshotPhrases.length})
                    </button>
                  )}
                  {history.length > 0 && !isGuest && (
                    <button
                      onClick={() => { setShowHistory(!showHistory); setShowScreenshotPicker(false); if (!showHistory) setShowBreakdown(false); }}
                      style={{
                        background: showHistory ? "#2A3A4A" : "transparent",
                        border: "1px solid #2A3A4A", borderRadius: 6, padding: "3px 8px",
                        fontSize: 10, color: "#7A8D9E", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      Saved ({history.length})
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <textarea
                  ref={phraseTextareaRef}
                  rows={2}
                  placeholder="Type or paste a Dutch phrase…"
                  value={dutchPhrase}
                  onChange={(e) => setDutchPhrase(e.target.value)}
                  onKeyDown={handleTranslateKey}
                  style={{
                    flex: 1, background: "#1A2733", border: "1px solid #2A3A4A",
                    borderRadius: 10, padding: "10px 12px", fontSize: 15,
                    color: "#E0E8EF", fontFamily: "'DM Sans', sans-serif",
                    resize: "none", lineHeight: 1.5, overflow: "hidden",
                    minHeight: 60,
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button
                    onClick={translatePhrase}
                    disabled={!dutchPhrase.trim() || isTranslating || isParsing}
                    style={{
                      width: 44, height: 44, borderRadius: 10, border: "none",
                      background: "#E87A2E", color: "#FFF", fontSize: 20, fontWeight: 700,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      opacity: dutchPhrase.trim() && !isTranslating && !isParsing ? 1 : 0.4,
                    }}
                  >
                    {isTranslating ? <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: 18 }}>⟳</span> : "→"}
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isParsing || isTranslating}
                    style={{
                      width: 44, height: 44, borderRadius: 10, border: "1px solid #2A3A4A",
                      background: "#1A2733", color: "#7A8D9E", fontSize: 18, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      opacity: isParsing ? 0.4 : 1,
                    }}
                    title="Upload Duolingo screenshot"
                  >
                    {isParsing ? <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: 14 }}>⟳</span> : "📷"}
                  </button>
                  {hasTranslated && (
                    <button
                      onClick={speakPhrase}
                      disabled={isSpeaking}
                      style={{
                        width: 44, height: 44, borderRadius: 10, border: "1px solid #2A3A4A",
                        background: isSpeaking ? "#2A3A4A" : "#1A2733", color: isSpeaking ? "#E87A2E" : "#7A8D9E",
                        fontSize: 18, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.2s",
                      }}
                      title="Hear pronunciation"
                    >
                      🔊
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleScreenshot} style={{ display: "none" }} />
                </div>
              </div>

              {parseError && (
                <div style={{
                  marginTop: 8, padding: "6px 10px", background: "#2A1A1A",
                  border: "1px solid #4A2A2A", borderRadius: 8, fontSize: 12, color: "#E87A7A",
                }}>
                  {parseError}
                </div>
              )}
            </section>

            {/* Screenshot Phrase Picker */}
            {showScreenshotPicker && screenshotPhrases.length > 1 && (
              <section style={{
                background: "#141E28", border: "1px solid #2A3A4A", borderRadius: 12,
                overflow: "hidden", animation: "fadeIn 0.2s ease-out",
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", borderBottom: "1px solid #2A3A4A",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#E87A2E", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    From Screenshot
                  </span>
                  <button onClick={() => { setScreenshotPhrases([]); setShowScreenshotPicker(false); }}
                    style={{ background: "transparent", border: "none", fontSize: 10, color: "#5A6A7A", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    Dismiss
                  </button>
                </div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {screenshotPhrases.map((phrase, i) => (
                    <div key={i}
                      style={{
                        padding: "10px 12px", borderBottom: i < screenshotPhrases.length - 1 ? "1px solid #1E2D3D" : "none",
                        cursor: "pointer", transition: "background 0.15s", fontSize: 14,
                        color: phrase === dutchPhrase ? "#E87A2E" : "#E0E8EF",
                      }}
                      onClick={() => selectScreenshotPhrase(phrase)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#1A2733")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {phrase}
                    </div>
                  ))}
                </div>
              </section>
            )}


            {/* Translation + Bookmark */}
            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#E87A2E" }}>
                  English Translation
                </label>
                {hasTranslated && !isGuest && (
                  <button onClick={bookmarkCurrent}
                    style={{
                      background: "transparent", border: isBookmarked ? "1px solid #E87A2E" : "1px solid #2A3A4A",
                      borderRadius: 6, padding: "3px 8px", fontSize: 12,
                      color: isBookmarked ? "#E87A2E" : "#5A6A7A",
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                    }}
                    title={isBookmarked ? "Remove from saved" : "Save phrase + chat"}
                  >
                    {isBookmarked ? "🔖 Saved" : "🏷️ Save"}
                  </button>
                )}
              </div>
              <div style={{
                background: "#1A2733", border: "1px solid #2A3A4A", borderRadius: 10,
                padding: "10px 12px", minHeight: 44, fontSize: 15, lineHeight: 1.5,
                display: "flex", alignItems: "center",
              }}>
                {isTranslating ? (
                  <span style={{ color: "#7A8D9E", fontStyle: "italic" }}>Translating…</span>
                ) : translation ? (
                  <span>{translation}</span>
                ) : (
                  <span style={{ color: "#4A5A6A" }}>Translation will appear here</span>
                )}
              </div>
            </section>

            {/* Word Breakdown — collapsible */}
            {hasTranslated && (breakdown || isLoadingBreakdown) && (
              <section>
                <button
                  onClick={() => {
                    const next = !showBreakdown;
                    setShowBreakdown(next);
                    if (next) setShowHistory(false);
                  }}
                  style={{
                    background: "transparent", border: "none", padding: "4px 0",
                    fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                    letterSpacing: "0.08em", color: "#5A6A7A", cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span style={{
                    display: "inline-block", transition: "transform 0.2s",
                    transform: showBreakdown ? "rotate(90deg)" : "rotate(0deg)",
                    fontSize: 10,
                  }}>▶</span>
                  Word Breakdown
                </button>
                {showBreakdown && (
                  <div style={{
                    background: "#141E28", border: "1px solid #2A3A4A", borderRadius: 10,
                    padding: "12px", marginTop: 6, overflowX: "auto",
                    animation: "fadeIn 0.2s ease-out",
                  }}>
                    {isLoadingBreakdown ? (
                      <span style={{ color: "#5A6A7A", fontSize: 12, fontStyle: "italic" }}>Analyzing…</span>
                    ) : breakdown && (
                      <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                        {breakdown.map((word, i) => (
                          <div key={i} style={{
                            display: "flex", flexDirection: "column", alignItems: "center",
                            padding: "6px 8px", minWidth: 0,
                          }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: "#E87A2E", whiteSpace: "nowrap" }}>
                              {word.dutch}
                            </span>
                            <span style={{ fontSize: 12, color: "#8BA4B8", fontStyle: "italic", marginTop: 2, whiteSpace: "nowrap" }}>
                              {word.english}
                            </span>
                            <span style={{
                              fontSize: 9, fontWeight: 600, color: "#4A5A6A", marginTop: 3,
                              background: "#1A2733", borderRadius: 3, padding: "1px 5px",
                              letterSpacing: "0.05em", whiteSpace: "nowrap",
                            }}>
                              {word.pos}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* History Panel */}
            {showHistory && (
              <section style={{
                background: "#141E28", border: "1px solid #2A3A4A", borderRadius: 12,
                overflow: "hidden", animation: "fadeIn 0.2s ease-out",
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", borderBottom: "1px solid #2A3A4A",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#7A8D9E", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Saved Phrases
                  </span>
                  <button onClick={clearHistory}
                    style={{ background: "transparent", border: "none", fontSize: 10, color: "#5A6A7A", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    Clear all
                  </button>
                </div>
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {history.map((entry, i) => (
                    <div key={i}
                      style={{
                        display: "flex", alignItems: "center", padding: "9px 12px",
                        borderBottom: i < history.length - 1 ? "1px solid #1E2D3D" : "none",
                        cursor: "pointer", transition: "background 0.15s",
                      }}
                      onClick={() => loadFromHistory(entry)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#1A2733")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "#E0E8EF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {entry.dutch}
                        </div>
                        <div style={{ fontSize: 11, color: "#5A6A7A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
                          {entry.english}
                        </div>
                        {entry.chat && entry.chat.length > 0 && (
                          <div style={{ fontSize: 10, color: "#3E4E5E", marginTop: 2 }}>
                            💬 {entry.chat.length} msg{entry.chat.length !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, color: "#3E4E5E" }}>{formatDate(entry.timestamp)}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFromHistory(i); }}
                          style={{ background: "transparent", border: "none", color: "#3E4E5E", fontSize: 13, cursor: "pointer", padding: "2px 4px", lineHeight: 1 }}
                          title="Remove"
                        >×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT COLUMN — Grammar Chat (fills remaining space) */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column", minWidth: 0,
            position: "sticky", top: 20, alignSelf: "flex-start",
            height: "calc(100vh - 140px)", maxHeight: "calc(100vh - 140px)",
          }}
            className="right-col"
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
            }}>
              <div style={{ flex: 1, height: 1, background: "#2A3A4A" }} />
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#E87A2E" }}>
                Grammar Chat
              </span>
              <div style={{ flex: 1, height: 1, background: "#2A3A4A" }} />
            </div>

            {/* Chat Window — fills available height */}
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              background: "#141E28", border: "1px solid #2A3A4A",
              borderRadius: "12px 12px 0 0",
              minHeight: 0,
              overflow: "hidden",
            }}>
              <div style={{
                flex: 1, padding: 16, overflowY: "auto",
                display: "flex", flexDirection: "column", gap: 12,
              }}>
                {chatMessages.length === 0 && !isThinking && (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", textAlign: "center", gap: 8,
                    padding: "60px 16px", color: "#5A6A7A", fontSize: 14, flex: 1,
                  }}>
                    {hasTranslated ? (
                      <>
                        <span style={{ fontSize: 32, marginBottom: 4 }}>💬</span>
                        <span>Ask anything about this phrase&apos;s grammar, word choice, or structure.</span>
                        <span style={{ fontSize: 12, color: "#3E4E5E", fontStyle: "italic", marginTop: 4 }}>
                          e.g. &quot;Why is &apos;het&apos; used here instead of &apos;de&apos;?&quot;
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 32, marginBottom: 4 }}>☝️</span>
                        <span>Enter a Dutch phrase to get started.</span>
                      </>
                    )}
                  </div>
                )}

                {chatMessages.map((msg, i) => (
                  <div key={i}
                    style={msg.role === "user" ? {
                      alignSelf: "flex-end", background: "#E87A2E", color: "#FFF",
                      borderRadius: "14px 14px 4px 14px", padding: "10px 14px",
                      maxWidth: "85%", fontSize: 14, lineHeight: 1.5,
                    } : {
                      alignSelf: "flex-start", background: "#1E2D3D",
                      border: "1px solid #2A3A4A", borderRadius: "14px 14px 14px 4px",
                      padding: "10px 14px", maxWidth: "90%", fontSize: 14, lineHeight: 1.6,
                    }}
                  >
                    {msg.role === "assistant" && (
                      <div style={{
                        fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                        letterSpacing: "0.06em", color: "#E87A2E", marginBottom: 4,
                      }}>Grammar Buddy</div>
                    )}
                    <div style={{ color: msg.role === "user" ? "#FFF" : "#D0D8E0" }}>
                      {msg.content.split("\n").map((line, j) => (
                        <p key={j} style={{ margin: j === 0 ? 0 : "8px 0 0" }}>{renderText(line)}</p>
                      ))}
                    </div>
                  </div>
                ))}

                {isThinking && (
                  <div style={{
                    alignSelf: "flex-start", background: "#1E2D3D",
                    border: "1px solid #2A3A4A", borderRadius: "14px 14px 14px 4px",
                    padding: "10px 14px", maxWidth: "90%", fontSize: 14,
                  }}>
                    <div style={{
                      fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                      letterSpacing: "0.06em", color: "#E87A2E", marginBottom: 4,
                    }}>Grammar Buddy</div>
                    <div style={{ display: "flex", gap: 4, padding: "4px 0" }}>
                      <span style={{ fontSize: 10, color: "#5A6A7A", animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0s" }}>●</span>
                      <span style={{ fontSize: 10, color: "#5A6A7A", animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.2s" }}>●</span>
                      <span style={{ fontSize: 10, color: "#5A6A7A", animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.4s" }}>●</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Chat Input */}
            <div style={{
              display: "flex", background: "#1A2733", border: "1px solid #2A3A4A",
              borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden",
            }}>
              <textarea
                rows={2}
                placeholder={hasTranslated ? "Ask about the grammar…" : "Translate a phrase first…"}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKey}
                disabled={!hasTranslated}
                style={{
                  flex: 1, background: "transparent", border: "none",
                  padding: "12px 14px", fontSize: 14, color: "#E0E8EF",
                  fontFamily: "'DM Sans', sans-serif", resize: "none", lineHeight: 1.5,
                }}
              />
              <button
                onClick={askQuestion}
                disabled={!chatInput.trim() || !hasTranslated || isThinking}
                style={{
                  width: 48, border: "none", background: "transparent",
                  color: "#E87A2E", fontSize: 20, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: chatInput.trim() && hasTranslated && !isThinking ? 1 : 0.4,
                }}
              >↑</button>
            </div>
          </div>
        </div>

        {/* Responsive styles */}
      </div>
      )}
    </>
  );
}
