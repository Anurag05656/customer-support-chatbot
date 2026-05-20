import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ChatWindow from "./components/ChatWindow";
import LoginPage from "./components/LoginPage";
import "./App.css";

function AppContent() {
  const { isAuthenticated, isGuest, loading } = useAuth();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [theme, setTheme] = useState("dark");
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  if (loading) {
    return (
      <div className="app-root" data-theme={theme}>
        <div className="bg-mesh" />
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
        <div className="bg-orb orb-3" />
        <div className="app-loader">
          <div className="loader-spinner" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isGuest) {
    return (
      <div className="app-root" data-theme={theme}>
        <LoginPage />
      </div>
    );
  }

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

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
