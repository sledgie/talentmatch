import React, { useEffect, useState } from "react";
import { Bell, FileText, Mail, Palette, Check, Loader2 } from "lucide-react";
import { supabase } from "./supabaseClient";
import { THEMES, DEFAULT_THEME_ID, getTheme } from "./theme";

const BLUE = "#2f6bff";
const GREEN = "#1fa971";
const RED = "#e15b5b";
const INK = "#16213e";
const SLATE = "#5b6478";
const BORDER = "#e7e9f2";

function Toggle({ checked, onChange, accentColor = BLUE }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
      style={{ background: checked ? accentColor : "#d7dbe8" }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
        style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  );
}

const RESUME_SAVE_OPTIONS = [
  {
    value: "ask",
    title: "Ask me every time",
    description: "Show the save/overwrite prompt whenever I upload a new resume.",
  },
  {
    value: "always",
    title: "Always save automatically",
    description: "Skip the prompt — every uploaded resume replaces what's saved on my profile.",
  },
  {
    value: "never",
    title: "Never save automatically",
    description: "Use uploads for that match only; never update what's saved on my profile.",
  },
];

export default function SettingsPage({ userId, theme, onThemeChange }) {
  const accent = theme?.c1 || BLUE;
  const tint = theme?.c2 || "#f2f6ff";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [notifyMatchReady, setNotifyMatchReady] = useState(true);
  const [notifyTips, setNotifyTips] = useState(true);
  const [resumeSavePreference, setResumeSavePreference] = useState("ask");
  const [preferResumeEmailDefault, setPreferResumeEmailDefault] = useState(false);
  const [themeId, setThemeId] = useState(theme?.id || DEFAULT_THEME_ID);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("profiles")
        .select("notify_match_ready, notify_tips, resume_save_preference, prefer_resume_email_default, theme_id")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (!error && data) {
        setNotifyMatchReady(data.notify_match_ready ?? true);
        setNotifyTips(data.notify_tips ?? true);
        setResumeSavePreference(data.resume_save_preference || "ask");
        setPreferResumeEmailDefault(data.prefer_resume_email_default ?? false);
        setThemeId(data.theme_id || DEFAULT_THEME_ID);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Selecting a theme reflects immediately across the whole app (sidebar,
  // buttons, highlights) via the parent's live state — it's only written to
  // the database once "Save settings" is clicked, same as every other
  // preference on this page.
  function handleSelectTheme(id) {
    setThemeId(id);
    onThemeChange?.(id);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    const { error } = await supabase
      .from("profiles")
      .update({
        notify_match_ready: notifyMatchReady,
        notify_tips: notifyTips,
        resume_save_preference: resumeSavePreference,
        prefer_resume_email_default: preferResumeEmailDefault,
        theme_id: themeId,
      })
      .eq("id", userId);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={22} className="animate-spin" color={SLATE} />
      </div>
    );
  }

  const previewTheme = getTheme(themeId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Theme */}
      <div className="rounded-xl border bg-white p-6" style={{ borderColor: BORDER }}>
        <div className="mb-1 flex items-center gap-2">
          <Palette size={18} color={accent} />
          <h2 className="text-base font-bold" style={{ color: INK }}>Theme</h2>
        </div>
        <p className="mb-4 text-sm" style={{ color: SLATE }}>Pick a color combination for the dashboard.</p>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEMES.map((t) => {
            const isSelected = t.id === themeId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTheme(t.id)}
                className="relative rounded-xl p-3 text-left"
                style={{
                  borderWidth: "1.5px",
                  borderStyle: "solid",
                  borderColor: isSelected ? accent : BORDER,
                  background: isSelected ? tint : "#ffffff",
                }}
              >
                <div className="flex h-12 overflow-hidden rounded-lg">
                  <div style={{ width: "58%", background: t.c1 }} />
                  <div style={{ width: "42%", background: t.c2 }} />
                </div>
                <p className="mt-2.5 text-xs font-bold" style={{ color: INK }}>{t.name}</p>
                <p className="mt-0.5 text-[11px]" style={{ color: SLATE }}>{t.label1} &amp; {t.label2}</p>

                {isSelected && (
                  <div
                    className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ background: accent }}
                  >
                    <Check size={12} color="#ffffff" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Live preview, using the same mapping everywhere else in the app:
            c1 = sidebar / primary actions, c2 = soft highlight tint. */}
        <p className="mb-2 text-xs font-semibold" style={{ color: INK }}>Preview</p>
        <div className="flex h-56 overflow-hidden rounded-xl border" style={{ borderColor: BORDER }}>
          <div
            className="flex w-40 shrink-0 flex-col gap-4 p-3.5"
            style={{ background: previewTheme.c1 }}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded" style={{ background: "rgba(255,255,255,0.18)" }}>
                <span className="text-[10px] font-bold text-white">H</span>
              </div>
              <span className="text-[10px] font-semibold text-white">Hirepilot</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ background: previewTheme.c2 }}>
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: previewTheme.c1 }} />
                <span className="text-[10px] font-bold" style={{ color: previewTheme.c1 }}>Dashboard</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.35)" }} />
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.75)" }}>My Profile</span>
              </div>
            </div>
          </div>
          <div className="flex flex-grow flex-col gap-3 p-4" style={{ background: "#f4f6fb" }}>
            <div>
              <p className="text-xs font-bold" style={{ color: INK }}>Hello, John! 👋</p>
              <p className="mt-0.5 text-[10px]" style={{ color: SLATE }}>Here's how your dashboard will look.</p>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-white p-3" style={{ borderColor: BORDER }}>
              <div>
                <p className="text-[11px] font-bold" style={{ color: INK }}>Senior Software Developer</p>
                <p className="mt-0.5 text-[10px]" style={{ color: SLATE }}>TechCorp Inc.</p>
              </div>
              <button className="rounded-md px-3 py-1.5 text-[10px] font-semibold text-white" style={{ background: previewTheme.c1 }}>
                View
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg p-3" style={{ background: previewTheme.c2 }}>
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: previewTheme.c1 }}>
                <Check size={11} color="#ffffff" strokeWidth={3} />
              </div>
              <p className="text-[10px] font-semibold" style={{ color: previewTheme.c1 }}>7 of 9 requirements matched</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border bg-white p-6" style={{ borderColor: BORDER }}>
        <div className="mb-5 flex items-center gap-2">
          <Bell size={18} color={accent} />
          <h2 className="text-base font-bold" style={{ color: INK }}>Notifications</h2>
        </div>

        <div className="divide-y" style={{ borderColor: BORDER }}>
          <div className="flex items-center justify-between gap-4 py-4 first:pt-0">
            <div>
              <p className="text-sm font-semibold" style={{ color: INK }}>Email me when a match result is ready</p>
              <p className="mt-0.5 text-xs" style={{ color: SLATE }}>
                We'll send your comparison results as soon as the analysis finishes.
              </p>
            </div>
            <Toggle checked={notifyMatchReady} onChange={setNotifyMatchReady} accentColor={accent} />
          </div>

          <div className="flex items-center justify-between gap-4 py-4 last:pb-0">
            <div>
              <p className="text-sm font-semibold" style={{ color: INK }}>Email me tips based on missing skills</p>
              <p className="mt-0.5 text-xs" style={{ color: SLATE }}>
                Occasional suggestions for closing the gaps your results point out.
              </p>
            </div>
            <Toggle checked={notifyTips} onChange={setNotifyTips} accentColor={accent} />
          </div>
        </div>
      </div>

      {/* Resume handling */}
      <div className="rounded-xl border bg-white p-6" style={{ borderColor: BORDER }}>
        <div className="mb-1 flex items-center gap-2">
          <FileText size={18} color={accent} />
          <h2 className="text-base font-bold" style={{ color: INK }}>Resume handling</h2>
        </div>
        <p className="mb-4 text-sm" style={{ color: SLATE }}>
          Choose what happens when you upload a new resume during a match.
        </p>

        <div className="space-y-2.5">
          {RESUME_SAVE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5"
              style={{
                borderColor: resumeSavePreference === opt.value ? accent : BORDER,
                background: resumeSavePreference === opt.value ? tint : "#ffffff",
              }}
            >
              <input
                type="radio"
                name="resumeSavePreference"
                value={opt.value}
                checked={resumeSavePreference === opt.value}
                onChange={() => setResumeSavePreference(opt.value)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-semibold" style={{ color: INK }}>{opt.title}</p>
                <p className="mt-0.5 text-xs" style={{ color: SLATE }}>{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Match results delivery */}
      <div className="rounded-xl border bg-white p-6" style={{ borderColor: BORDER }}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-2">
            <Mail size={18} color={accent} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold" style={{ color: INK }}>
                Prefer the email found in my resume
              </p>
              <p className="mt-0.5 text-xs" style={{ color: SLATE }}>
                Default this on for every new match, instead of choosing it each time. We'll still fall back to your
                account email if none is found in the resume.
              </p>
            </div>
          </div>
          <Toggle checked={preferResumeEmailDefault} onChange={setPreferResumeEmailDefault} accentColor={accent} />
        </div>
      </div>

      {error && <p className="text-sm font-medium" style={{ color: RED }}>{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: accent }}
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          Save settings
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: GREEN }}>
            <Check size={15} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
