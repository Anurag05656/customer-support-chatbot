import { useState, useRef, useEffect, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import TypingIndicator from "./TypingIndicator";

const API_BASE = import.meta.env.VITE_API_URL || "";

const STORAGE_KEY = "chatbot_conversations";

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello! 👋 I'm your AI support assistant. I can help you with order tracking, refunds, account issues, and more. How can I assist you today?",
  timestamp: new Date().toISOString(),
  sentiment: "positive",
};

const INITIAL_SUGGESTIONS = [
  "Track my order",
  "Request a refund",
  "Account issues",
  "Talk to a human",
];

function createConversation() {
  return {
    id: crypto.randomUUID(),
    title: "New Chat",
    messages: [WELCOME_MESSAGE],
    apiHistory: [],
    createdAt: new Date().toISOString(),
  };
}

function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const convs = JSON.parse(raw);
      if (Array.isArray(convs) && convs.length > 0) return convs;
    }
  } catch {}
  return [createConversation()];
}

function saveConversations(convs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch {}
}

export default function ChatWindow({ sessionId, theme, onToggleTheme }) {
  const [conversations, setConversations] = useState(loadConversations);
  const [activeId, setActiveId] = useState(() => conversations[0]?.id);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSuggestions, setActiveSuggestions] = useState(INITIAL_SUGGESTIONS);
  const messagesEndRef = useRef(null);

  const active = conversations.find((c) => c.id === activeId) || conversations[0];

  /* persist on every change */
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages, isLoading]);

  /* recalculate suggestions when switching conversations */
  useEffect(() => {
    if (!active) return;
    const msgs = active.messages;
    if (msgs.length <= 1) {
      setActiveSuggestions(INITIAL_SUGGESTIONS);
    } else {
      const last = msgs[msgs.length - 1];
      setActiveSuggestions(last.suggestions || []);
    }
  }, [activeId]); // eslint-disable-line

  /* notification sound */
  const playNotification = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.value = 0.08;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }, []);

  /* update a conversation immutably */
  const updateConv = useCallback(
    (id, updater) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updater(c) } : c))
      );
    },
    []
  );

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    /* derive title from first user message */
    const isFirst = active.messages.length <= 1;
    const newTitle = isFirst ? text.slice(0, 40) : active.title;

    updateConv(active.id, (c) => ({
      title: newTitle,
      messages: [...c.messages, userMessage],
      apiHistory: [...c.apiHistory, { role: "user", content: text }],
    }));

    setIsLoading(true);
    setActiveSuggestions([]);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          history: [...active.apiHistory, { role: "user", content: text }].slice(-10),
        }),
      });

      if (!response.ok) throw new Error("Failed");

      const data = await response.json();

      const botMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        timestamp: new Date().toISOString(),
        sentiment: data.sentiment || "neutral",
        suggestions: data.suggestions || [],
        expertAnalysis: data.expert_analysis || null,
      };

      updateConv(active.id, (c) => ({
        messages: [...c.messages, userMessage, botMessage].filter(
          (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i
        ),
        apiHistory: [
          ...c.apiHistory,
          { role: "user", content: text },
          { role: "assistant", content: data.reply },
        ].filter(
          (m, i, arr) =>
            arr.findIndex(
              (x) => x.role === m.role && x.content === m.content
            ) === i
        ),
      }));

      setActiveSuggestions(data.suggestions || []);
      playNotification();
    } catch {
      const errMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date().toISOString(),
        isError: true,
      };
      updateConv(active.id, (c) => ({
        messages: [...c.messages, errMsg].filter(
          (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i
        ),
      }));
      setActiveSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    const conv = createConversation();
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setActiveSuggestions(INITIAL_SUGGESTIONS);
  };

  const switchChat = (id) => {
    setActiveId(id);
  };

  const deleteChat = (e, id) => {
    e.stopPropagation();
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        const conv = createConversation();
        setActiveId(conv.id);
        return [conv];
      }
      if (id === activeId) setActiveId(filtered[0].id);
      return filtered;
    });
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return "Today";
    if (diff < 172800000) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const exportChat = () => {
    if (!active || active.messages.length <= 1) return;

    const time = (iso) =>
      new Date(iso).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

    let text = `╔══════════════════════════════════════════╗\n`;
    text += `║  AI Support Chat — Export                ║\n`;
    text += `╚══════════════════════════════════════════╝\n\n`;
    text += `Topic: ${active.title}\n`;
    text += `Date : ${new Date(active.createdAt).toLocaleDateString()}\n`;
    text += `Msgs : ${active.messages.length - 1}\n`;
    text += `${'─'.repeat(45)}\n\n`;

    active.messages.forEach((msg) => {
      if (msg.id === "welcome") return;
      const sender = msg.role === "user" ? "🧑 You" : "🤖 Bot";
      text += `[${time(msg.timestamp)}] ${sender}\n`;
      text += `${msg.content}\n`;
      if (msg.sentiment) text += `  ↳ Sentiment: ${msg.sentiment}\n`;
      if (msg.expertAnalysis) {
        const ea = msg.expertAnalysis;
        text += `  ↳ Expert: ${ea.intent} (${ea.confidence}% confidence, ${ea.priority} priority)\n`;
        if (ea.rules_fired?.length) {
          text += `  ↳ Rules : ${ea.rules_fired.join(", ")}\n`;
        }
      }
      text += `\n`;
    });

    text += `${'─'.repeat(45)}\n`;
    text += `Exported from AI Support Chatbot\n`;
    text += `Powered by LLaMA 3 · Expert System · Sentiment Analysis\n`;

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${active.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30)}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-layout">
      {/* ── Sidebar ─────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="brand-name">AI Support</h1>
            <p className="brand-tagline">Powered by LLaMA 3</p>
          </div>
        </div>

        <button className="new-chat-btn" onClick={handleNewChat}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Conversation
        </button>

        {/* Chat History */}
        <div className="sidebar-section sidebar-section-grow">
          <h3 className="section-title">Chat History</h3>
          <div className="history-list">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                className={`history-item ${conv.id === activeId ? "active" : ""}`}
                onClick={() => switchChat(conv.id)}
              >
                <svg className="history-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <div className="history-text">
                  <span className="history-title">{conv.title}</span>
                  <span className="history-date">{formatDate(conv.createdAt)}</span>
                </div>
                <button
                  className="history-delete"
                  onClick={(e) => deleteChat(e, conv.id)}
                  title="Delete"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </button>
            ))}
          </div>
        </div>

        {/* AI Capabilities */}
        <div className="sidebar-section">
          <h3 className="section-title">AI Capabilities</h3>
          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-icon">🧠</span>
              <div>
                <span className="feature-name">Expert System</span>
                <span className="feature-desc">Rule-based intent classification</span>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💡</span>
              <div>
                <span className="feature-name">Sentiment Analysis</span>
                <span className="feature-desc">Real-time emotion detection</span>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⚡</span>
              <div>
                <span className="feature-name">Smart Suggestions</span>
                <span className="feature-desc">AI-generated follow-ups</span>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🔒</span>
              <div>
                <span className="feature-name">Context Memory</span>
                <span className="feature-desc">Multi-turn awareness</span>
              </div>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={onToggleTheme} title="Toggle theme">
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <p className="sidebar-credits">Built with React · Laravel · Groq</p>
        </div>
      </aside>

      {/* ── Chat Panel ──────────────────────── */}
      <main className="chat-panel">
        <div className="chat-header">
          <div className="header-left">
            <div className="agent-avatar">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM7 14v2a1 1 0 0 0 2 0v-2H7zm8 0v2a1 1 0 0 0 2 0v-2h-2zm-9 6h12a1 1 0 0 0 0-2H6a1 1 0 0 0 0 2z" />
              </svg>
              <span className="online-dot" />
            </div>
            <div className="agent-info">
              <span className="agent-name">Support Assistant</span>
              <span className="agent-status">
                <span className="status-pulse" />
                Online — typically replies instantly
              </span>
            </div>
          </div>
          <div className="header-actions">
            <button
              className="icon-btn"
              onClick={exportChat}
              title="Export chat"
              disabled={active.messages.length <= 1}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            <button className="icon-btn" onClick={handleNewChat} title="New conversation">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="messages-area">
          <div className="session-label">
            <span className="session-dot" />
            Session started · {new Date(active.createdAt).toLocaleDateString()}
          </div>
          {active.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {activeSuggestions.length > 0 && !isLoading && (
          <div className="suggestions-bar">
            {activeSuggestions.map((text, i) => (
              <button key={i} className="suggestion-chip" onClick={() => sendMessage(text)}>
                {text}
              </button>
            ))}
          </div>
        )}

        <ChatInput onSend={sendMessage} isLoading={isLoading} />
      </main>
    </div>
  );
}
