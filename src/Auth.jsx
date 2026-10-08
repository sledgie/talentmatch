import React, { useState } from "react";
import { Mail, Lock, Loader2 } from "lucide-react";
import { supabase } from "./supabaseClient";

const BLUE = "#2f6bff";
const INK = "#16213e";
const SLATE = "#5b6478";
const BORDER = "#e7e9f2";
const BG = "#f4f6fb";
const RED = "#e15b5b";
const GREEN = "#1fa971";

export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function switchMode(next) {
    setMode(next);
    setError("");
    setMessage("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setError("Enter both an email and a password.");
      return;
    }

    if (mode === "signup") {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Enter your first and last name.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Those passwords don't match. Please retype them.");
        return;
      }
    }

    setLoading(true);

    if (mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      onAuthenticated?.(data.session);
    } else {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          },
        },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        onAuthenticated?.(data.session);
      } else {
        setMessage("Check your email to confirm your account before logging in.");
      }
    }
  }

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center p-6"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="w-full max-w-sm rounded-xl border bg-white p-6" style={{ borderColor: BORDER }}>
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: BLUE }}>
            <span className="text-white font-bold text-sm">H</span>
          </div>
          <div>
            <p className="font-semibold leading-tight" style={{ color: INK }}>Hirepilot</p>
            <p className="text-[11px] leading-tight" style={{ color: SLATE }}>Your Skills. Our Insight.</p>
          </div>
        </div>

        <div className="mb-5 flex rounded-lg p-1" style={{ background: "#eef1f8" }}>
          <button
            onClick={() => switchMode("login")}
            className="flex-1 rounded-md py-2 text-sm font-semibold"
            style={{ background: mode === "login" ? "#fff" : "transparent", color: mode === "login" ? INK : SLATE }}
          >
            Log in
          </button>
          <button
            onClick={() => switchMode("signup")}
            className="flex-1 rounded-md py-2 text-sm font-semibold"
            style={{ background: mode === "signup" ? "#fff" : "transparent", color: mode === "signup" ? INK : SLATE }}
          >
            Sign up
          </button>
        </div>

        <h1 className="mb-1 text-lg font-bold" style={{ color: INK }}>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mb-5 text-sm" style={{ color: SLATE }}>
          {mode === "login"
            ? "Log in to see how you match against your saved jobs."
            : "Sign up to start comparing your profile against job openings."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold" style={{ color: INK }}>First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: BORDER, color: INK }}
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold" style={{ color: INK }}>Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: BORDER, color: INK }}
                  autoComplete="family-name"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: INK }}>Email</label>
            <div className="flex items-center gap-2 rounded-lg border px-3" style={{ borderColor: BORDER }}>
              <Mail size={16} color={SLATE} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full py-2.5 text-sm outline-none"
                style={{ color: INK }}
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: INK }}>Password</label>
            <div className="flex items-center gap-2 rounded-lg border px-3" style={{ borderColor: BORDER }}>
              <Lock size={16} color={SLATE} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-2.5 text-sm outline-none"
                style={{ color: INK }}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
          </div>

          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: INK }}>Confirm password</label>
              <div className="flex items-center gap-2 rounded-lg border px-3" style={{ borderColor: BORDER }}>
                <Lock size={16} color={SLATE} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full py-2.5 text-sm outline-none"
                  style={{ color: INK }}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {error && <p className="text-xs font-medium" style={{ color: RED }}>{error}</p>}
          {message && <p className="text-xs font-medium" style={{ color: GREEN }}>{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: BLUE }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
}
