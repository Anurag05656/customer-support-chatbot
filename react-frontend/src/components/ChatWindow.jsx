import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import TypingIndicator from "./TypingIndicator";

const API_BASE = import.meta.env.VITE_API_URL || "";

const STORAGE_KEY = "chatbot_conversations";

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello! I'm your AI support assistant. I can help you with order tracking, refunds, account issues, and more. How can I assist you today?",
  timestamp: new Date().toISOString(),
  sentiment: "positive",
};

const INITIAL_SUGGESTIONS = [
  "Track my order",
  "Request a refund",
  "Account issues",
  "Talk to a human",
];

/* ── Guest-mode helpers (localStorage) ─────────────── */
function createLocalConversation() {
  return {
    id: crypto.randomUUID(),
    title: "New Chat",
    messages: [WELCOME_MESSAGE],
    apiHistory: [],
    createdAt: new Date().toISOString(),
  };
}

function loadLocalConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const convs = JSON.parse(raw);
      if (Array.isArray(convs) && convs.length > 0) return convs;
    }
  } catch {}
  return [createLocalConversation()];
}

function saveLocalConversations(convs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch {}
}

export default function ChatWindow({ sessionId, theme, onToggleTheme }) {
  const { isAuthenticated, isGuest, user, authHeaders, logout } = useAuth();

  /* ── State ────────────────────────────────────────── */
  const [conversations, setConversations] = useState(() =>
    isAuthenticated ? [] : loadLocalConversations()
  );
  const [activeId, setActiveId] = useState(() =>
    isAuthenticated ? null : conversations[0]?.id
  );
  const [isLoading, setIsLoading] = useState(false);
  const [activeSuggestions, setActiveSuggestions] = useState(INITIAL_SUGGESTIONS);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const initRef = useRef(false);

  const active = conversations.find((c) => c.id === activeId) || conversations[0];

  /* ── Load conversations from API for auth users ──── */
  useEffect(() => {
    if (!isAuthenticated) return;
    if (initRef.current) return;
    initRef.current = true;

    setSidebarLoading(true);
    fetch(`${API_BASE}/api/conversations`, { headers: authHeaders })
      .then((r) => r.json())
      .then(async (data) => {
        const convs = (data.conversations || []).map((c) => ({
          id: c.id,
          title: c.title,
          messages: [WELCOME_MESSAGE],
          apiHistory: [],
          createdAt: c.created_at,
          isServer: true,
          loaded: false,
        }));
        if (convs.length === 0) {
          // Create exactly one first conversation via API
          try {
            const res = await fetch(`${API_BASE}/api/conversations`, {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify({ title: "New Chat" }),
            });
            const d = await res.json();
            const conv = {
              id: d.conversation.id,
              title: d.conversation.title,
              messages: [WELCOME_MESSAGE],
              apiHistory: [],
              createdAt: d.conversation.created_at,
              isServer: true,
              loaded: true,
            };
            setConversations([conv]);
            setActiveId(conv.id);
          } catch (err) {
            console.error("Failed to create first conversation:", err);
          }
        } else {
          setConversations(convs);
          setActiveId(convs[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setSidebarLoading(false));
  }, [isAuthenticated]); // eslint-disable-line

  /* ── Load messages when switching to an unloaded server conversation ── */
  useEffect(() => {
    if (!isAuthenticated || !active || !active.isServer || active.loaded) return;

    fetch(`${API_BASE}/api/conversations/${active.id}`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => {
        const msgs = (data.conversation?.messages || []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.created_at,
          sentiment: m.sentiment || undefined,
          suggestions: m.suggestions || [],
          expertAnalysis: m.expert_analysis || null,
          isError: m.is_error || false,
        }));

        setConversations((prev) =>
          prev.map((c) =>
            c.id === active.id
              ? {
                  ...c,
                  messages: [WELCOME_MESSAGE, ...msgs],
                  loaded: true,
                }
              : c
          )
        );

        if (msgs.length > 0) {
          const last = msgs[msgs.length - 1];
          setActiveSuggestions(last.suggestions || []);
        } else {
          setActiveSuggestions(INITIAL_SUGGESTIONS);
        }
      })
      .catch(console.error);
  }, [activeId, isAuthenticated]); // eslint-disable-line

  /* ── Persist guest conversations to localStorage ─── */
  useEffect(() => {
    if (!isAuthenticated) {
      saveLocalConversations(conversations);
    }
  }, [conversations, isAuthenticated]);

  /* ── Auto-scroll ─────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages, isLoading]);

  /* ── Recalculate suggestions on conversation switch ─ */
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

  /* ── Notification sound ──────────────────────────── */
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

  /* ── Update a conversation immutably ─────────────── */
  const updateConv = useCallback((id, updater) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updater(c) } : c))
    );
  }, []);

  /* ── Send message ────────────────────────────────── */
  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    const isFirst = active.messages.length <= 1;
    const newTitle = isFirst ? text.slice(0, 40) : active.title;

    updateConv(active.id, (c) => ({
      title: newTitle,
      messages: [...c.messages, userMessage],
      apiHistory: [...(c.apiHistory || []), { role: "user", content: text }],
    }));

    setIsLoading(true);
    setActiveSuggestions([]);

    try {
      const body = {
        message: text,
        session_id: sessionId,
      };

      const headers = { "Content-Type": "application/json" };

      if (isAuthenticated) {
        body.conversation_id = active.id;
        headers.Authorization = authHeaders.Authorization;
      } else {
        body.history = [
          ...(active.apiHistory || []),
          { role: "user", content: text },
        ].slice(-10);
      }

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
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
          ...(c.apiHistory || []),
          { role: "user", content: text },
          { role: "assistant", content: data.reply },
        ].filter(
          (m, i, arr) =>
            arr.findIndex(
              (x) => x.role === m.role && x.content === m.content
            ) === i
        ),
      }));

      // Update title server-side if first message
      if (isAuthenticated && isFirst) {
        fetch(`${API_BASE}/api/conversations/${active.id}`, {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({ title: newTitle }),
        }).catch(() => {});
      }

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

  /* ── New chat ────────────────────────────────────── */
  const handleNewChat = async () => {
    if (isAuthenticated) {
      try {
        const res = await fetch(`${API_BASE}/api/conversations`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ title: "New Chat" }),
        });
        const data = await res.json();
        const conv = {
          id: data.conversation.id,
          title: data.conversation.title,
          messages: [WELCOME_MESSAGE],
          apiHistory: [],
          createdAt: data.conversation.created_at,
          isServer: true,
          loaded: true,
        };
        setConversations((prev) => [conv, ...prev]);
        setActiveId(conv.id);
      } catch (err) {
        console.error("Failed to create conversation:", err);
      }
    } else {
      const conv = createLocalConversation();
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
    }
    setActiveSuggestions(INITIAL_SUGGESTIONS);
  };

  const switchChat = (id) => {
    setActiveId(id);
  };

  const deleteChat = async (e, id) => {
    e.stopPropagation();
    if (isAuthenticated) {
      try {
        await fetch(`${API_BASE}/api/conversations/${id}`, {
          method: "DELETE",
          headers: authHeaders,
        });
      } catch {}
    }
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        handleNewChat();
        return prev;
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
    text += `Topic : ${active.title}\n`;
    text += `Date  : ${new Date(active.createdAt).toLocaleDateString()}\n`;
    text += `Msgs : ${active.messages.length - 1}\n`;
    text += `${'─'.repeat(45)}\n\n`;

    active.messages.forEach((msg) => {
      if (msg.id === "welcome") return;
      const sender = msg.role === "user" ? "[You]" : "[Bot]";
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

        {/* Guest Banner */}
        {isGuest && (
          <div className="guest-banner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v2m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
            <div>
              <span className="guest-banner-title">Guest Mode</span>
              <span className="guest-banner-text">
                Chat history won't be saved
              </span>
            </div>
          </div>
        )}

        {/* Chat History */}
        <div className="sidebar-section sidebar-section-grow">
          <h3 className="section-title">Chat History</h3>
          <div className="history-list">
            {sidebarLoading ? (
              <div className="sidebar-loader">
                <div className="loader-spinner small" />
              </div>
            ) : (
              conversations.map((conv) => (
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
              ))
            )}
          </div>
        </div>

        {/* AI Capabilities */}
        <div className="sidebar-section">
          <h3 className="section-title">AI Capabilities</h3>
          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </span>
              <div>
                <span className="feature-name">Expert System</span>
                <span className="feature-desc">Rule-based intent classification</span>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
                  <path d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                </svg>
              </span>
              <div>
                <span className="feature-name">Sentiment Analysis</span>
                <span className="feature-desc">Real-time emotion detection</span>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
                  <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </span>
              <div>
                <span className="feature-name">Smart Suggestions</span>
                <span className="feature-desc">AI-generated follow-ups</span>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
                  <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </span>
              <div>
                <span className="feature-name">Context Memory</span>
                <span className="feature-desc">Multi-turn awareness</span>
              </div>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          {/* User Profile / Auth */}
          {isAuthenticated && user ? (
            <div className="user-profile">
              <div className="user-avatar">
                {user.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="user-info">
                <span className="user-name">{user.name}</span>
                <span className="user-email">{user.email}</span>
              </div>
              <button className="logout-btn" onClick={logout} title="Sign out">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          ) : (
            <button className="login-sidebar-btn" onClick={logout}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Sign In to Save Chats
            </button>
          )}

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
              disabled={!active || active.messages.length <= 1}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          </div>
        </div>

        <div className="messages-area">
          <div className="session-label">
            <span className="session-dot" />
            Session started · {active ? new Date(active.createdAt).toLocaleDateString() : ""}
          </div>
          {active?.messages.map((msg) => (
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
