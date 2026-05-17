import { useState } from "react";
import ChatWindow from "./components/ChatWindow";
import "./App.css";

export default function App() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [theme, setTheme] = useState("dark");
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="app-root" data-theme={theme}>
      <div className="bg-mesh" />
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />
      <ChatWindow
        sessionId={sessionId}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    </div>
  );
}
