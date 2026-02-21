"use client";

import { useState, useRef, useEffect } from "react";

const MAX_HISTORY = 50;

function loadHistory() {
  try {
    const raw = localStorage.getItem("dgb_history");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem("dgb_history", JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {}
}

export default function Home() {
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
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isThinking]);

  const addToHistory = (dutch, english) => {
    const entry = {
      dutch,
      english,
      timestamp: Date.now(),
    };
    const updated = [entry, ...history.filter((h) => h.dutch !== dutch)].slice(0, MAX_HISTORY);
    setHistory(updated);
    saveHistory(updated);
  };

  const removeFromHistory = (index) => {
    const updated = history.filter((_, i) => i !== index);
    setHistory(updated);
    saveHistory(updated);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("dgb_history");
  };

  const loadFromHistory = (entry) => {
    setDutchPhrase(entry.dutch);
    setTranslation(entry.english);
    setHasTranslated(true);
    setChatMessages([]);
    setShowHistory(false);
  };

  const translatePhrase = async () => {
    if (!dutchPhrase.trim()) return;
    setIsTranslating(true);
    setTranslation("");
    setChatMessages([]);
    setHasTranslated(false);
    setParseError("");

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
        addToHistory(dutchPhrase.trim(), data.translation);
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
    setTranslation("");
    setChatMessages([]);
    setHasTranslated(false);

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
        body: JSON.stringify({
          image: base64,
          mediaType: file.type || "image/png",
        }),
      });
      const data = await res.json();

      if (data.error) {
        setParseError(data.error);
      } else if (data.phrase) {
        setDutchPhrase(data.phrase);
        setParseError("");
        setIsTranslating(true);
        try {
          const transRes = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phrase: data.phrase }),
          });
          const transData = await transRes.json();
          if (transData.error) {
            setTranslation(transData.error);
          } else {
            setTranslation(transData.translation || "Translation failed.");
            setHasTranslated(true);
            addToHistory(data.phrase, transData.translation);
          }
        } catch {
          setTranslation("Translation error. Please try again.");
        }
        setIsTranslating(false);
      }
    } catch {
      setParseError("Failed to process screenshot. Please try again.");
    }
    setIsParsing(false);
  };

  const askQuestion = async () => {
    if (!chatInput.trim() || !hasTranslated) return;
    const question = chatInput.trim();
    setChatInput("");

    const newMessages = [...chatMessages, { role: "user", content: question }];
    setChatMessages(newMessages);
    setIsThinking(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dutchPhrase: dutchPhrase.trim(),
          translation,
          messages: newMessages,
        }),
      });
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.error || data.response || "Sorry, couldn't generate a response.",
        },
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      translatePhrase();
    }
  };

  const handleChatKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  };

  const renderText = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} style={{ color: "#E87A2E" }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return (
          <em key={i} style={{ color: "#8BA4B8" }}>
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  };

  const formatDate = (timestamp) => {
    const d = new Date(timestamp);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        textarea:focus,
        button:focus-visible {
          outline: 2px solid #e87a2e;
          outline-offset: 2px;
        }
        textarea::placeholder {
          color: #6b7b8d;
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #2a3a4a;
          border-radius: 3px;
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#0F1923",
          color: "#E0E8EF",
          fontFamily: "'DM Sans', sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "radial-gradient(ellipse at 20% 0%, rgba(232,122,46,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(33,70,139,0.08) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            padding: "24px 16px 32px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Header */}
          <header style={{ textAlign: "center", marginBottom: 32 }}>
            <div
              style={{
                display: "flex",
                width: 48,
                height: 32,
                margin: "0 auto 12px",
                borderRadius: 4,
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              <div style={{ flex: 1, background: "#AE1C28" }} />
              <div style={{ flex: 1, background: "#FFF" }} />
              <div style={{ flex: 1, background: "#21468B" }} />
            </div>
            <h1
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "clamp(24px, 5vw, 32px)",
                fontWeight: 700,
                color: "#F5F5F0",
                letterSpacing: "-0.02em",
                marginBottom: 4,
              }}
            >
              Dutch Grammar Buddy
            </h1>
            <p style={{ fontSize: 14, color: "#7A8D9E", fontWeight: 400 }}>
              Paste a phrase, upload a screenshot, or tap history. Then ask why.
            </p>
          </header>

          {/* Dutch Phrase Input */}
          <section style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#7A8D9E",
                }}
              >
                Dutch Phrase
              </label>
              {history.length > 0 && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  style={{
                    background: showHistory ? "#2A3A4A" : "transparent",
                    border: "1px solid #2A3A4A",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 11,
                    color: "#7A8D9E",
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  History ({history.length})
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <textarea
                rows={2}
                placeholder="Type or paste a Dutch phrase…"
                value={dutchPhrase}
                onChange={(e) => setDutchPhrase(e.target.value)}
                onKeyDown={handleTranslateKey}
                style={{
                  flex: 1,
                  background: "#1A2733",
                  border: "1px solid #2A3A4A",
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontSize: 16,
                  color: "#E0E8EF",
                  fontFamily: "'DM Sans', sans-serif",
                  resize: "none",
                  lineHeight: 1.5,
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={translatePhrase}
                  disabled={!dutchPhrase.trim() || isTranslating || isParsing}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    border: "none",
                    background: "#E87A2E",
                    color: "#FFF",
                    fontSize: 22,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    opacity: dutchPhrase.trim() && !isTranslating && !isParsing ? 1 : 0.4,
                  }}
                >
                  {isTranslating ? (
                    <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: 20 }}>⟳</span>
                  ) : (
                    "→"
                  )}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsing || isTranslating}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    border: "1px solid #2A3A4A",
                    background: "#1A2733",
                    color: "#7A8D9E",
                    fontSize: 20,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    opacity: isParsing ? 0.4 : 1,
                  }}
                  title="Upload Duolingo screenshot"
                >
                  {isParsing ? (
                    <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: 16 }}>⟳</span>
                  ) : (
                    "📷"
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshot}
                  style={{ display: "none" }}
                />
              </div>
            </div>

            {parseError && (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  background: "#2A1A1A",
                  border: "1px solid #4A2A2A",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#E87A7A",
                }}
              >
                {parseError}
              </div>
            )}
          </section>

          {/* History Panel */}
          {showHistory && (
            <section
              style={{
                marginBottom: 20,
                background: "#141E28",
                border: "1px solid #2A3A4A",
                borderRadius: 12,
                overflow: "hidden",
                animation: "fadeIn 0.2s ease-out",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  borderBottom: "1px solid #2A3A4A",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: "#7A8D9E", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Saved Phrases
                </span>
                <button
                  onClick={clearHistory}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: 11,
                    color: "#5A6A7A",
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Clear all
                </button>
              </div>
              <div style={{ maxHeight: 240, overflowY: "auto" }}>
                {history.map((entry, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "10px 14px",
                      borderBottom: i < history.length - 1 ? "1px solid #1E2D3D" : "none",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onClick={() => loadFromHistory(entry)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1A2733")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          color: "#E0E8EF",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {entry.dutch}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#5A6A7A",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginTop: 2,
                        }}
                      >
                        {entry.english}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 12, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: "#3E4E5E" }}>{formatDate(entry.timestamp)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromHistory(i);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#3E4E5E",
                          fontSize: 14,
                          cursor: "pointer",
                          padding: "2px 4px",
                          lineHeight: 1,
                        }}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Translation */}
          <section style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#7A8D9E",
                marginBottom: 8,
              }}
            >
              English Translation
            </label>
            <div
              style={{
                background: "#1A2733",
                border: "1px solid #2A3A4A",
                borderRadius: 10,
                padding: "12px 14px",
                minHeight: 48,
                fontSize: 16,
                lineHeight: 1.5,
                display: "flex",
                alignItems: "center",
              }}
            >
              {isTranslating ? (
                <span style={{ color: "#7A8D9E", fontStyle: "italic" }}>Translating…</span>
              ) : translation ? (
                <span>{translation}</span>
              ) : (
                <span style={{ color: "#4A5A6A" }}>Translation will appear here</span>
              )}
            </div>
          </section>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 20px" }}>
            <div style={{ flex: 1, height: 1, background: "#2A3A4A" }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#5A6A7A",
              }}
            >
              Grammar Chat
            </span>
            <div style={{ flex: 1, height: 1, background: "#2A3A4A" }} />
          </div>

          {/* Chat Window */}
          <section style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                background: "#141E28",
                border: "1px solid #2A3A4A",
                borderRadius: "12px 12px 0 0",
                padding: 16,
                minHeight: 240,
                maxHeight: 400,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {chatMessages.length === 0 && !isThinking && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    gap: 8,
                    padding: "48px 16px",
                    color: "#5A6A7A",
                    fontSize: 14,
                  }}
                >
                  {hasTranslated ? (
                    <>
                      <span style={{ fontSize: 28, marginBottom: 4 }}>💬</span>
                      <span>Ask anything about this phrase&apos;s grammar, word choice, or structure.</span>
                      <span style={{ fontSize: 12, color: "#3E4E5E", fontStyle: "italic", marginTop: 4 }}>
                        e.g. &quot;Why is &apos;het&apos; used here instead of &apos;de&apos;?&quot;
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 28, marginBottom: 4 }}>☝️</span>
                      <span>Enter a Dutch phrase above to get started.</span>
                    </>
                  )}
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  style={
                    msg.role === "user"
                      ? {
                          alignSelf: "flex-end",
                          background: "#E87A2E",
                          color: "#FFF",
                          borderRadius: "14px 14px 4px 14px",
                          padding: "10px 14px",
                          maxWidth: "85%",
                          fontSize: 14,
                          lineHeight: 1.5,
                        }
                      : {
                          alignSelf: "flex-start",
                          background: "#1E2D3D",
                          border: "1px solid #2A3A4A",
                          borderRadius: "14px 14px 14px 4px",
                          padding: "10px 14px",
                          maxWidth: "90%",
                          fontSize: 14,
                          lineHeight: 1.6,
                        }
                  }
                >
                  {msg.role === "assistant" && (
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "#E87A2E",
                        marginBottom: 4,
                      }}
                    >
                      Grammar Buddy
                    </div>
                  )}
                  <div style={{ color: msg.role === "user" ? "#FFF" : "#D0D8E0" }}>
                    {msg.content.split("\n").map((line, j) => (
                      <p key={j} style={{ margin: j === 0 ? 0 : "8px 0 0" }}>
                        {renderText(line)}
                      </p>
                    ))}
                  </div>
                </div>
              ))}

              {isThinking && (
                <div
                  style={{
                    alignSelf: "flex-start",
                    background: "#1E2D3D",
                    border: "1px solid #2A3A4A",
                    borderRadius: "14px 14px 14px 4px",
                    padding: "10px 14px",
                    maxWidth: "90%",
                    fontSize: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#E87A2E",
                      marginBottom: 4,
                    }}
                  >
                    Grammar Buddy
                  </div>
                  <div style={{ display: "flex", gap: 4, padding: "4px 0" }}>
                    <span style={{ fontSize: 10, color: "#5A6A7A", animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0s" }}>●</span>
                    <span style={{ fontSize: 10, color: "#5A6A7A", animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.2s" }}>●</span>
                    <span style={{ fontSize: 10, color: "#5A6A7A", animation: "pulse 1.2s ease-in-out infinite", animationDelay: "0.4s" }}>●</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div
              style={{
                display: "flex",
                gap: 0,
                background: "#1A2733",
                border: "1px solid #2A3A4A",
                borderTop: "none",
                borderRadius: "0 0 12px 12px",
                overflow: "hidden",
              }}
            >
              <textarea
                rows={2}
                placeholder={hasTranslated ? "Ask about the grammar…" : "Translate a phrase first…"}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKey}
                disabled={!hasTranslated}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  padding: "12px 14px",
                  fontSize: 14,
                  color: "#E0E8EF",
                  fontFamily: "'DM Sans', sans-serif",
                  resize: "none",
                  lineHeight: 1.5,
                }}
              />
              <button
                onClick={askQuestion}
                disabled={!chatInput.trim() || !hasTranslated || isThinking}
                style={{
                  width: 48,
                  border: "none",
                  background: "transparent",
                  color: "#E87A2E",
                  fontSize: 20,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  opacity: chatInput.trim() && hasTranslated && !isThinking ? 1 : 0.4,
                }}
              >
                ↑
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
