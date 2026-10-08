import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { getTheme, DEFAULT_THEME_ID } from "./theme";
import Auth from "./Auth";
import Dashboard from "./Dashboard";
import ResumeBuilder from "./ResumeBuilder";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  const [screen, setScreen] = useState("dashboard"); // "dashboard" | "resumeBuilder"
  const [handoffResume, setHandoffResume] = useState(null); // { file, token } | null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Load the saved theme once we know who's logged in, so the rest of the
  // app (sidebar, buttons, highlights) can render in the right colors from
  // the first paint rather than flashing the default and then switching.
  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;

    supabase
      .from("profiles")
      .select("theme_id")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data?.theme_id) return;
        setThemeId(data.theme_id);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (session === undefined) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center" style={{ background: "#f4f6fb" }}>
        <p style={{ color: "#5b6478", fontFamily: "Inter, system-ui, sans-serif" }}>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth onAuthenticated={setSession} />;
  }

  const userName = session.user.user_metadata?.full_name || null;
  const userFirstName = session.user.user_metadata?.first_name || null;
  const userLastName = session.user.user_metadata?.last_name || null;
  const theme = getTheme(themeId);

  if (screen === "resumeBuilder") {
    return (
      <ResumeBuilder
        userId={session.user.id}
        theme={theme}
        onBack={() => setScreen("dashboard")}
        onResumeReady={(file) => {
          setHandoffResume({ file, token: Date.now() });
          setScreen("dashboard");
        }}
      />
    );
  }

  return (
    <Dashboard
      userId={session.user.id}
      userEmail={session.user.email}
      userName={userName}
      userFirstName={userFirstName}
      userLastName={userLastName}
      theme={theme}
      onThemeChange={setThemeId}
      onLogout={handleLogout}
      onOpenResumeBuilder={() => setScreen("resumeBuilder")}
      handoffResume={handoffResume}
      onConsumedHandoff={() => setHandoffResume(null)}
    />
  );
}
