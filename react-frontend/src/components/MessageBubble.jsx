import { useState } from "react";

/* ── Simple Markdown Parser ───────────────────────── */

function formatInline(text) {
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIdx = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx)
      parts.push(<span key={key++}>{text.slice(lastIdx, match.index)}</span>);
    if (match[2]) parts.push(<strong key={key++}>{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={key++}>{match[3]}</em>);
    else if (match[4])
      parts.push(
        <code key={key++} className="inline-code">{match[4]}</code>
      );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length)
    parts.push(<span key={key++}>{text.slice(lastIdx)}</span>);
  return parts.length > 0 ? parts : text;
}

function parseMarkdown(text) {
  if (!text) return text;
  const blocks = text.split(/\n\n+/);
  return blocks.map((block, i) => {
    const lines = block.split("\n");
    const bullets = lines.filter((l) => /^[-*•]\s/.test(l.trim()));
    if (bullets.length === lines.length && bullets.length > 0)
      return (
        <ul key={i} className="md-list">
          {bullets.map((item, j) => (
            <li key={j}>{formatInline(item.replace(/^[-*•]\s/, ""))}</li>
          ))}
        </ul>
      );
    const nums = lines.filter((l) => /^\d+[.)]\s/.test(l.trim()));
    if (nums.length === lines.length && nums.length > 0)
      return (
        <ol key={i} className="md-list">
          {nums.map((item, j) => (
            <li key={j}>{formatInline(item.replace(/^\d+[.)]\s/, ""))}</li>
          ))}
        </ol>
      );
    return (
      <p key={i} className="md-para">{formatInline(block)}</p>
    );
  });
}

/* ── Config ───────────────────────────────────────── */

const SENTIMENT = {
  positive:  { label: "Positive",  color: "#22c55e", icon: "😊" },
  neutral:   { label: "Neutral",   color: "#6366f1", icon: "😐" },
  concerned: { label: "Concerned", color: "#f59e0b", icon: "😟" },
};

const PRIORITY_COLOR = {
  low: "#22c55e",
  medium: "#6366f1",
  high: "#f59e0b",
  urgent: "#ef4444",
};

/* ── Component ────────────────────────────────────── */

export default function MessageBubble({ message }) {
  const [feedback, setFeedback] = useState(null);
  const [showExpert, setShowExpert] = useState(false);
  const isUser = message.role === "user";
  const sentiment = message.sentiment && SENTIMENT[message.sentiment];
  const expert = message.expertAnalysis;

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`message-row ${isUser ? "user-row" : "bot-row"}`}>
      {!isUser && (
        <div className="bot-avatar">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM7 14v2a1 1 0 0 0 2 0v-2H7zm8 0v2a1 1 0 0 0 2 0v-2h-2zm-9 6h12a1 1 0 0 0 0-2H6a1 1 0 0 0 0 2z" />
          </svg>
        </div>
      )}
      <div className={`bubble-wrapper ${isUser ? "user-wrapper" : ""}`}>
        <div
          className={`bubble ${isUser ? "user-bubble" : "bot-bubble"} ${
            message.isError ? "error-bubble" : ""
          }`}
        >
          <div className="bubble-text">
            {isUser ? message.content : parseMarkdown(message.content)}
          </div>
        </div>

        <div className="message-meta">
          <span className="message-time">{formatTime(message.timestamp)}</span>

          {!isUser && sentiment && !message.isError && (
            <span className="sentiment-badge" style={{ "--sentiment-color": sentiment.color }}>
              {sentiment.icon} {sentiment.label}
            </span>
          )}

          {/* Expert System toggle */}
          {!isUser && expert && !message.isError && (
            <button
              className="expert-toggle"
              onClick={() => setShowExpert((v) => !v)}
            >
              🧠 Expert: {expert.intent}
              <svg
                className={`expert-chevron ${showExpert ? "open" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}

          {!isUser && !message.isError && message.id !== "welcome" && (
            <div className="feedback-btns">
              <button
                className={`feedback-btn ${feedback === "up" ? "active-up" : ""}`}
                onClick={() => setFeedback(feedback === "up" ? null : "up")}
                title="Helpful"
              >
                <svg viewBox="0 0 24 24" fill={feedback === "up" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
              </button>
              <button
                className={`feedback-btn ${feedback === "down" ? "active-down" : ""}`}
                onClick={() => setFeedback(feedback === "down" ? null : "down")}
                title="Not helpful"
              >
                <svg viewBox="0 0 24 24" fill={feedback === "down" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Expert System Panel */}
        {showExpert && expert && (
          <div className="expert-panel">
            <div className="expert-grid">
              <div className="expert-field">
                <span className="expert-label">Intent</span>
                <span className="expert-value">{expert.intent}</span>
              </div>
              <div className="expert-field">
                <span className="expert-label">Confidence</span>
                <span className="expert-value">{expert.confidence}%</span>
              </div>
              <div className="expert-field">
                <span className="expert-label">Priority</span>
                <span
                  className="expert-priority"
                  style={{ "--priority-color": PRIORITY_COLOR[expert.priority] || "#6366f1" }}
                >
                  {expert.priority}
                </span>
              </div>
              <div className="expert-field">
                <span className="expert-label">Category</span>
                <span className="expert-value">{expert.category}</span>
              </div>
            </div>
            <div className="expert-field expert-field-full">
              <span className="expert-label">Action</span>
              <span className="expert-value">{expert.action}</span>
            </div>
            {expert.rules_fired?.length > 0 && (
              <div className="expert-field expert-field-full">
                <span className="expert-label">
                  Rules Fired ({expert.rules_matched}/{expert.total_rules})
                </span>
                <div className="expert-rules">
                  {expert.rules_fired.map((r, i) => (
                    <span key={i} className="expert-rule-tag">{r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
