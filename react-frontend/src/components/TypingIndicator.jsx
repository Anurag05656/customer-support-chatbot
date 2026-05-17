export default function TypingIndicator() {
  return (
    <div className="message-row bot-row">
      <div className="bot-avatar">
        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM7 14v2a1 1 0 0 0 2 0v-2H7zm8 0v2a1 1 0 0 0 2 0v-2h-2zm-9 6h12a1 1 0 0 0 0-2H6a1 1 0 0 0 0 2z" />
        </svg>
      </div>
      <div className="bubble bot-bubble typing-bubble">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}
