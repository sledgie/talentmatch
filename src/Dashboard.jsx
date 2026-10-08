import React, { useState, useRef, useEffect } from "react";
import { fetchSavedResumeMeta, uploadResumeAndSaveToProfile, downloadResumeBlob, fetchResumePreferences } from "./resumeStorage";
import ProfilePage from "./ProfilePage";
import SettingsPage from "./SettingsPage";
import {
  LayoutDashboard,
  FileSearch,
  User,
  GitCompare,
  Settings,
  Bell,
  ExternalLink,
  Check,
  ClipboardPaste,
  Briefcase,
  Building2,
  UploadCloud,
  Mail,
  Wand2,
  FileText,
  Loader2,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  LogOut,
} from "lucide-react";

const BLUE = "#2f6bff";
const GREEN = "#1fa971";
const AMBER = "#e0a63a";
const RED = "#e15b5b";
const INK = "#16213e";
const SLATE = "#5b6478";
const BORDER = "#e7e9f2";
const BG = "#f4f6fb";

const STEPS = ["Job Requirements", "Your Profile", "Results"];

// Endpoint that receives the job description + resume and returns the match analysis.
// Override at build time with VITE_ANALYSIS_API_URL if you don't want to edit this file.
const ANALYSIS_API_URL =
  import.meta.env.VITE_ANALYSIS_API_URL || "https://your-api.example.com/analyze";

// HTTP Basic Auth credentials for the analysis endpoint above.
const ANALYSIS_API_USERNAME = import.meta.env.VITE_ANALYSIS_API_USERNAME || "";
const ANALYSIS_API_PASSWORD = import.meta.env.VITE_ANALYSIS_API_PASSWORD || "";

function SkillTag({ children }) {
  return (
    <span
      style={{ background: "#eef1f8", color: INK, borderColor: BORDER }}
      className="rounded-md border px-3 py-1 text-sm font-medium"
    >
      {children}
    </span>
  );
}

function NavItem({ icon: Icon, label, active, onClick, activeColor = BLUE }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium"
      style={{
        background: active ? activeColor : "transparent",
        color: active ? "#ffffff" : "#aab3cc",
        border: "none",
        cursor: "pointer",
      }}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}

function StepBadge({ number, label, state, onClick, activeColor = BLUE }) {
  const styles = {
    done: { circle: GREEN, text: INK },
    active: { circle: activeColor, text: INK },
    todo: { circle: "#c7cde0", text: "#9aa2b8" },
  };
  const s = styles[state];
  return (
    <button
      onClick={onClick}
      disabled={state === "todo"}
      className="flex items-center gap-2"
      style={{ cursor: state === "todo" ? "default" : "pointer" }}
    >
      <div
        className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ background: s.circle }}
      >
        {state === "done" ? <Check size={13} /> : number}
      </div>
      <span className="text-sm font-medium" style={{ color: s.text }}>
        {label}
      </span>
    </button>
  );
}

export default function Dashboard({ userId, userEmail, userName, userFirstName, userLastName, theme, onThemeChange, onLogout, onOpenResumeBuilder, handoffResume, onConsumedHandoff }) {
  const accent = theme?.c1 || BLUE;
  const tint = theme?.c2 || "#f2f6ff";
  const [view, setView] = useState("dashboard"); // "dashboard" | "profile" | "settings"
  const [step, setStep] = useState(0);
  const [maxStepReached, setMaxStepReached] = useState(0);

  // Step 1 state
  const [companyName, setCompanyName] = useState("");
  const [position, setPosition] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [jobDetailsError, setJobDetailsError] = useState("");

  // Step 2 state
  const [resumeFile, setResumeFile] = useState(null);
  const fileInputRef = useRef(null);
  const [email, setEmail] = useState(userEmail || "");
  const [emailError, setEmailError] = useState("");
  const [preferResumeEmail, setPreferResumeEmail] = useState(false);
  const [preferResumeEmailDefault, setPreferResumeEmailDefault] = useState(false); // from Settings

  // Whichever resume is actually SELECTED for this match: the one already
  // saved on the profile, or a freshly uploaded file. This is the single
  // source of truth for what gets attached to the n8n submission below.
  const [loadingSavedResume, setLoadingSavedResume] = useState(true);
  const [savedResumeMeta, setSavedResumeMeta] = useState(null); // {path, filename, type, size, uploadedAt} | null
  const [resumeSource, setResumeSource] = useState(null); // "saved" | "upload" | null (not decided yet)
  const [saveChoice, setSaveChoice] = useState(null); // null | "saved" | "skipped" | "failed"
  const [savingResumeChoice, setSavingResumeChoice] = useState(false);
  const [resumeSaveError, setResumeSaveError] = useState("");
  const [resumeSavePreference, setResumeSavePreference] = useState("ask"); // from Settings: "ask" | "always" | "never"

  // Analysis request state (job description + resume -> match results)
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  // Load whatever resume is already saved on this user's profile, once, so
  // the resume step can default to "use your saved resume" when one exists.
  // Also load their Settings preferences so this step respects them.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      setLoadingSavedResume(true);
      const [meta, prefs] = await Promise.all([
        fetchSavedResumeMeta(userId),
        fetchResumePreferences(userId),
      ]);
      if (cancelled) return;
      setSavedResumeMeta(meta);
      setResumeSource(meta ? "saved" : "upload");
      setResumeSavePreference(prefs.resumeSavePreference);
      setPreferResumeEmailDefault(prefs.preferResumeEmailDefault);
      setPreferResumeEmail(prefs.preferResumeEmailDefault);
      setLoadingSavedResume(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // True when a newly chosen file would replace an already-saved resume
  // (as opposed to there being nothing saved yet).
  const isOverwrite = !!savedResumeMeta && resumeSource === "upload";

  const canGoNextFromStep1 =
    companyName.trim().length > 0 && position.trim().length > 0 && pastedText.trim().length > 0;

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const canGoNextFromStep2 =
    isValidEmail(email) &&
    ((resumeSource === "saved" && !!savedResumeMeta) || (resumeSource === "upload" && !!resumeFile));

  function goToStep(n) {
    if (n <= maxStepReached) setStep(n);
  }

  function advance() {
    const next = Math.min(step + 1, STEPS.length - 1);
    setStep(next);
    setMaxStepReached((m) => Math.max(m, next));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  // Checks that the pasted job details can actually be serialized and sent as
  // part of a JSON request body without throwing or silently corrupting data.
  // Returns { valid: true } or { valid: false, error: "..." }.
  function validateJobDetailsForRequest(text) {
    if (!text || !text.trim()) {
      return { valid: false, error: "Please paste the job description before continuing." };
    }

    // JSON.stringify throws on values it can't serialize (e.g. BigInt) and,
    // more realistically here, this also confirms the payload shape we intend
    // to send is actually constructible.
    let serialized;
    try {
      serialized = JSON.stringify({ jobDescription: text });
    } catch (err) {
      return {
        valid: false,
        error: "This text can't be sent as JSON. Please remove any unusual formatting and try again.",
      };
    }

    // JSON.stringify won't catch unpaired surrogate characters (a common
    // artifact of copy-pasting from some web pages). Those survive
    // stringification but throw when the request body is encoded to UTF-8,
    // so check for them explicitly.
    try {
      new TextEncoder().encode(serialized);
    } catch (err) {
      return {
        valid: false,
        error: "This text contains characters that can't be sent in a request. Try pasting as plain text instead.",
      };
    }

    return { valid: true };
  }

  // Called from the "Next" button on the Job Requirements page.
  // Validates the pasted text can safely be used in a JSON request before
  // letting the user move on to the resume upload page.
  function handleJobDetailsNext() {
    if (!companyName.trim() || !position.trim()) {
      setJobDetailsError("Please enter the company name and the position you're applying for.");
      return;
    }
    const result = validateJobDetailsForRequest(pastedText);
    if (!result.valid) {
      setJobDetailsError(result.error);
      return;
    }
    setJobDetailsError("");
    advance();
  }

  // Resets the whole wizard back to the Job Requirements page,
  // clearing everything the user entered so they can start a fresh analysis.
  function handleRestart() {
    setCompanyName("");
    setPosition("");
    setPastedText("");
    setJobDetailsError("");
    setResumeFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setResumeSource(savedResumeMeta ? "saved" : "upload");
    setSaveChoice(null);
    setResumeSaveError("");
    setEmail("");
    setEmailError("");
    setPreferResumeEmail(preferResumeEmailDefault);
    setAnalysisResult(null);
    setAnalyzeError("");
    setAnalyzing(false);
    setSubmitted(false);
    setStep(0);
    setMaxStepReached(0);
  }

  // Switches to the upload flow, whether because there's nothing saved yet
  // or because the user wants to use a different file than the saved one.
  function chooseUploadInstead() {
    setResumeFile(null);
    setSaveChoice(null);
    setResumeSaveError("");
    setResumeSource("upload");
  }

  // Switches back to the saved resume after having started an upload.
  function useSavedInstead() {
    setResumeFile(null);
    setSaveChoice(null);
    setResumeSaveError("");
    setResumeSource("saved");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Shared by the real file input and by a resume handed off from the
  // Resume Builder, so both paths behave identically (save preference,
  // ask/overwrite prompt, etc.) rather than drifting apart.
  function applyChosenFile(file) {
    if (!file) return;

    setResumeFile(file);
    setResumeSource("upload");
    setResumeSaveError("");

    if (resumeSavePreference === "always") {
      setSaveChoice(null);
      confirmSaveChoice(file); // save immediately, skipping the prompt
    } else if (resumeSavePreference === "never") {
      setSaveChoice("skipped"); // skip immediately, skipping the prompt
    } else {
      setSaveChoice(null); // "ask" (default): show the save/overwrite prompt
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    applyChosenFile(file);
  }

  // A resume just came back from the Resume Builder (App.jsx handed it to
  // us via props after generating the PDF). Jump straight to the resume
  // step with it already selected, exactly as if the person had uploaded
  // it themselves.
  useEffect(() => {
    if (!handoffResume?.file) return;
    setStep(1);
    setMaxStepReached((m) => Math.max(m, 1));
    applyChosenFile(handoffResume.file);
    onConsumedHandoff?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffResume?.token]);

  // The user explicitly agreed to save (or overwrite) the chosen file on
  // their profile. This is the only place a resume gets written to Storage
  // from this step — nothing happens automatically.
  async function confirmSaveChoice(fileOverride) {
    const file = fileOverride || resumeFile;
    if (!file || !userId) return;
    setSavingResumeChoice(true);
    setResumeSaveError("");
    try {
      const meta = await uploadResumeAndSaveToProfile(userId, file);
      setSavedResumeMeta(meta);
      setSaveChoice("saved");
    } catch (err) {
      setResumeSaveError(err.message || "Couldn't save that resume to your profile. Please try again.");
      setSaveChoice("failed");
    } finally {
      setSavingResumeChoice(false);
    }
  }

  function skipSaveChoice() {
    setSaveChoice("skipped");
  }

  // Generates a RFC 4122-ish v4 GUID to tag each analysis request.
  // Prefers the native crypto.randomUUID (available in all modern browsers
  // over HTTPS/localhost); falls back to a manual implementation otherwise.
  function generateGuid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Called from the "Next" button on the Resume Upload page.
  // Sends the pasted job description, resume file, and the user's email to the
  // analysis endpoint. Since n8n takes ~5-10 minutes to actually produce the
  // match result, this only waits for n8n's immediate "request accepted"
  // response, then advances to a confirmation page — the real result gets
  // emailed to the user once the workflow finishes, rather than shown here.
  async function handleAnalyzeAndAdvance() {
    if (!canGoNextFromStep2 || analyzing) return;

    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address so we can send you the results.");
      return;
    }
    setEmailError("");
    setAnalyzing(true);
    setAnalyzeError("");

    try {
      const requestId = generateGuid();
      console.log("[Analysis API] requestId:", requestId);

      // Resolve whichever resume the user actually selected into a single
      // (blob, filename) pair to attach. This is the one place that decides
      // what reaches n8n, regardless of which path the user took to get here.
      let resumeBlob;
      let resumeFilename;

      if (resumeSource === "saved" && savedResumeMeta) {
        try {
          resumeBlob = await downloadResumeBlob(savedResumeMeta.path);
        } catch (err) {
          throw new Error("Couldn't retrieve your saved resume. Please try again or upload a different file.");
        }
        resumeFilename = savedResumeMeta.filename;
      } else if (resumeSource === "upload" && resumeFile) {
        resumeBlob = resumeFile;
        resumeFilename = resumeFile.name;
      } else {
        throw new Error("Please choose a resume before submitting.");
      }

      const formData = new FormData();
      formData.append("requestId", requestId);
      formData.append("fullName", userName || "");
      formData.append("companyName", companyName.trim());
      formData.append("position", position.trim());
      formData.append("jobDescription", pastedText);
      formData.append("resume", resumeBlob, resumeFilename);
      formData.append("email", email.trim());
      formData.append("preferResumeEmail", preferResumeEmail ? "true" : "false");

      const response = await fetch(ANALYSIS_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${ANALYSIS_API_USERNAME}:${ANALYSIS_API_PASSWORD}`)}`,
        },
        body: formData,
      });

      console.log("[Analysis API] status:", response.status, response.statusText);
      console.log("[Analysis API] headers:", Object.fromEntries(response.headers.entries()));

      // Read the body as text first so we can log it even if it isn't valid JSON,
      // then try to parse it. response.json() would throw and hide the raw body
      // if the server ever returns something unexpected (HTML error page, empty body, etc).
      const rawBody = await response.text();
      console.log("[Analysis API] raw body:", rawBody);

      if (!response.ok) {
        throw new Error(`Submission failed (status ${response.status}): ${rawBody}`);
      }

      let data = null;
      try {
        data = rawBody ? JSON.parse(rawBody) : null;
      } catch (parseErr) {
        // Some n8n webhook configurations respond with an empty body on
        // success, so a non-JSON body here isn't necessarily fatal — log it
        // for visibility but don't block the confirmation screen on it.
        console.warn("[Analysis API] response body was not valid JSON:", parseErr);
      }

      console.log("[Analysis API] parsed data:", data);
      setAnalysisResult(data);
      setSubmitted(true);
      advance();
    } catch (err) {
      console.error("[Analysis API] request failed:", err);
      setAnalyzeError(
        err instanceof Error ? err.message : "Something went wrong while analyzing your resume. Please try again."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full" style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col justify-between p-5 md:flex" style={{ background: accent }}>
        <div>
          <div className="mb-8 flex items-center gap-2 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.16)" }}>
              <span className="text-white font-bold text-sm">H</span>
            </div>
            <div>
              <p className="text-white font-semibold leading-tight">Hirepilot</p>
              <p className="text-[11px] leading-tight" style={{ color: "rgba(255,255,255,0.6)" }}>Your Skills. Our Insight.</p>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            <NavItem icon={LayoutDashboard} label="Dashboard" active={view === "dashboard"} onClick={() => setView("dashboard")} activeColor="rgba(255,255,255,0.18)" />
            <NavItem icon={FileSearch} label="Job Analysis" />
            <NavItem icon={User} label="My Profile" active={view === "profile"} onClick={() => setView("profile")} activeColor="rgba(255,255,255,0.18)" />
            <NavItem icon={GitCompare} label="Compare" />
            <NavItem icon={Settings} label="Settings" active={view === "settings"} onClick={() => setView("settings")} activeColor="rgba(255,255,255,0.18)" />
          </nav>
        </div>
        <div className="rounded-xl p-4" style={{ background: "rgba(0,0,0,0.18)" }}>
          <div className="mb-3 flex h-16 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.1)" }}>
            <User size={28} color="rgba(255,255,255,0.55)" />
          </div>
          <p className="text-white text-sm font-semibold">Know Your Strengths</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
            See how you match, where to improve, and what's next.
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: INK }}>Hello{userName ? `, ${userName}` : ""}! 👋</h1>
            <p className="text-sm" style={{ color: SLATE }}>
              {view === "profile" && "Manage your name, login, and resume."}
              {view === "settings" && "Manage notifications and how we handle your resume."}
              {view === "dashboard" && step === 0 && "Let's start with the job you're interested in."}
              {view === "dashboard" && step === 1 && "Now, tell us about your background."}
              {view === "dashboard" && step === 2 && "Here's how you stack up against the job requirements."}
            </p>
          </div>

          {view === "dashboard" && (
            <div className="flex items-center gap-6">
              {STEPS.map((label, i) => (
                <StepBadge
                  key={label}
                  number={i + 1}
                  label={label}
                  state={i < step ? "done" : i === step ? "active" : "todo"}
                  onClick={() => goToStep(i)}
                  activeColor={accent}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="relative">
              <Bell size={20} color={SLATE} />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full" style={{ background: RED }} />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "#c9d3ea" }}>
                <User size={16} color={accent} />
              </div>
              <span className="text-sm font-medium" style={{ color: INK }}>{userEmail}</span>
              <button onClick={onLogout} title="Log out" className="ml-1">
                <LogOut size={16} color={SLATE} />
              </button>
            </div>
          </div>
        </div>

        {view === "profile" && (
          <ProfilePage
            userId={userId}
            userEmail={userEmail}
            userName={userName}
            userFirstName={userFirstName}
            userLastName={userLastName}
            theme={theme}
          />
        )}

        {view === "settings" && (
          <SettingsPage userId={userId} theme={theme} onThemeChange={onThemeChange} />
        )}

        {view === "dashboard" && (
        <>
        {/* STEP 1: Job Requirements */}
        {step === 0 && (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-xl border bg-white p-6" style={{ borderColor: BORDER }}>
              <h2 className="mb-1 text-lg font-bold" style={{ color: INK }}>Start with a Job Opening</h2>
              <p className="mb-6 text-sm" style={{ color: SLATE }}>
                Copy the job description or requirements from the job posting site and paste it below so we can
                analyze the position and identify the skills, qualifications, and experience needed.
              </p>

              <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: INK }}>
                    <Building2 size={16} color={accent} /> Company name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      if (jobDetailsError) setJobDetailsError("");
                    }}
                    placeholder="e.g. TechCorp Inc."
                    className="w-full rounded-lg border p-3 text-sm outline-none"
                    style={{ borderColor: BORDER, color: INK }}
                  />
                </div>
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: INK }}>
                    <Briefcase size={16} color={accent} /> Position
                  </label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => {
                      setPosition(e.target.value);
                      if (jobDetailsError) setJobDetailsError("");
                    }}
                    placeholder="e.g. Senior Software Developer"
                    className="w-full rounded-lg border p-3 text-sm outline-none"
                    style={{ borderColor: BORDER, color: INK }}
                  />
                </div>
              </div>

              <div className="mb-2">
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: INK }}>
                  <ClipboardPaste size={16} color={accent} /> Job Requirements
                </label>
                <textarea
                  value={pastedText}
                  onChange={(e) => {
                    setPastedText(e.target.value.slice(0, 10000));
                    if (jobDetailsError) setJobDetailsError("");
                  }}
                  placeholder="Paste the job description, responsibilities, qualifications, skills, and other requirements here..."
                  rows={10}
                  className="w-full rounded-lg border p-3 text-sm outline-none"
                  style={{ borderColor: jobDetailsError ? RED : BORDER, color: INK }}
                />
                <div className="mt-1 flex items-center justify-between">
                  <button onClick={() => setPastedText("")} className="text-sm font-medium" style={{ color: SLATE }}>
                    Clear
                  </button>
                  <span className="text-xs" style={{ color: SLATE }}>{pastedText.length}/10000</span>
                </div>
                {jobDetailsError && (
                  <p className="mt-2 text-sm font-medium" style={{ color: RED }}>
                    {jobDetailsError}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={handleJobDetailsNext}
                disabled={!canGoNextFromStep1}
                className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: accent }}
              >
                Next <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Your Profile */}
        {step === 1 && (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-xl border bg-white p-6" style={{ borderColor: BORDER }}>
              <h2 className="mb-1 text-lg font-bold" style={{ color: INK }}>Tell us about your background</h2>
              <p className="mb-6 text-sm" style={{ color: SLATE }}>
                Upload your resume, or build one from scratch, so we can compare your profile against the job.
              </p>

              {loadingSavedResume ? (
                <div className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-dashed p-8" style={{ borderColor: BORDER }}>
                  <Loader2 size={18} className="animate-spin" color={SLATE} />
                  <span className="text-sm" style={{ color: SLATE }}>Checking your profile for a saved resume...</span>
                </div>
              ) : (
                <>
                  {/* Primary option: use the resume already saved on My Profile */}
                  {resumeSource === "saved" && savedResumeMeta && (
                    <div className="mb-4 rounded-xl border-2 p-4" style={{ borderColor: accent, background: tint }}>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: accent }}>
                          <Check size={12} color="#ffffff" strokeWidth={3} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: accent }}>Recommended</p>
                          <p className="text-sm font-bold" style={{ color: INK }}>Use your saved resume</p>
                          <div className="mt-2.5 flex items-center gap-3 rounded-lg border bg-white p-3" style={{ borderColor: BORDER }}>
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "#e7f8f0" }}>
                              <FileText size={18} color={GREEN} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold" style={{ color: INK }}>{savedResumeMeta.filename}</p>
                              <p className="mt-0.5 text-xs" style={{ color: SLATE }}>From My Profile</p>
                            </div>
                          </div>
                          <button
                            onClick={chooseUploadInstead}
                            className="mt-2.5 text-xs font-semibold underline"
                            style={{ color: SLATE }}
                          >
                            Use a different resume instead
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Link back to the saved resume, once "upload instead" was chosen */}
                  {savedResumeMeta && resumeSource === "upload" && (
                    <button
                      onClick={useSavedInstead}
                      className="mb-3 flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: accent }}
                    >
                      <ArrowLeft size={13} /> Back to your saved resume
                    </button>
                  )}

                  {/* Upload area: the only option when nothing is saved, or shown after "use a different resume" */}
                  {resumeSource === "upload" && (
                    <>
                      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} className="hidden" />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mb-4 flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center"
                        style={{ borderColor: resumeFile ? GREEN : BORDER, background: resumeFile ? "#f2fbf7" : "#fafbfd" }}
                      >
                        {resumeFile ? (
                          <>
                            <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "#e7f8f0" }}>
                              <FileText size={20} color={GREEN} />
                            </div>
                            <p className="text-sm font-semibold" style={{ color: INK }}>{resumeFile.name}</p>
                            <p className="text-xs" style={{ color: SLATE }}>Click to replace this file</p>
                          </>
                        ) : (
                          <>
                            <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "#e8f0ff" }}>
                              <UploadCloud size={20} color={accent} />
                            </div>
                            <p className="text-sm font-semibold" style={{ color: INK }}>Upload your resume</p>
                            <p className="text-xs" style={{ color: SLATE }}>PDF or Word document, up to 10MB</p>
                          </>
                        )}
                      </button>
                    </>
                  )}

                  {/* "always"/"never" preference: no prompt, just a quiet status line */}
                  {resumeFile && resumeSavePreference === "always" && saveChoice === null && (
                    <p className="mb-4 flex items-center gap-1.5 text-xs" style={{ color: SLATE }}>
                      <Loader2 size={13} className="animate-spin" /> Saving to your profile...
                    </p>
                  )}

                  {/* The ask: save (or overwrite) the newly chosen file on My Profile */}
                  {resumeFile && saveChoice === null && resumeSavePreference === "ask" && (
                    <div className="mb-4 rounded-lg border p-4" style={{ borderColor: BORDER }}>
                      <p className="mb-0.5 text-sm font-bold" style={{ color: INK }}>
                        {isOverwrite ? "Overwrite your saved resume?" : "Save this resume to your profile?"}
                      </p>
                      <p className="mb-3 text-xs" style={{ color: SLATE }}>
                        {isOverwrite
                          ? "This will replace the resume currently saved to your profile."
                          : "You won't need to upload it again next time you run a match."}
                      </p>
                      {resumeSaveError && (
                        <p className="mb-3 text-xs font-medium" style={{ color: RED }}>{resumeSaveError}</p>
                      )}
                      <div className="flex gap-2.5">
                        <button
                          onClick={() => confirmSaveChoice()}
                          disabled={savingResumeChoice}
                          className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                          style={{ background: accent }}
                        >
                          {savingResumeChoice && <Loader2 size={13} className="animate-spin" />}
                          {isOverwrite ? "Overwrite saved resume" : "Save for next time"}
                        </button>
                        <button
                          onClick={skipSaveChoice}
                          disabled={savingResumeChoice}
                          className="rounded-lg border px-4 py-2 text-xs font-semibold disabled:opacity-60"
                          style={{ borderColor: BORDER, color: INK }}
                        >
                          Not now
                        </button>
                      </div>
                    </div>
                  )}

                  {saveChoice === "saved" && (
                    <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold" style={{ color: GREEN }}>
                      <Check size={14} />
                      {isOverwrite ? "Your saved resume has been updated." : "Saved to your profile for next time."}
                    </p>
                  )}
                  {saveChoice === "skipped" && (
                    <p className="mb-4 text-xs" style={{ color: SLATE }}>
                      {resumeSavePreference === "never"
                        ? "Your settings keep this resume for this match only — nothing saved to your profile."
                        : "Okay — we'll only use this resume for this match."}
                    </p>
                  )}
                </>
              )}

              <div className="flex items-center gap-3">
                <div className="h-px flex-1" style={{ background: BORDER }} />
                <span className="text-xs" style={{ color: SLATE }}>or</span>
                <div className="h-px flex-1" style={{ background: BORDER }} />
              </div>

              <button
                type="button"
                onClick={onOpenResumeBuilder}
                className="mt-4 flex w-full items-center justify-between rounded-lg border p-4 text-left"
                style={{ borderColor: BORDER }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "#fbf1e0" }}>
                    <Wand2 size={18} color={AMBER} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: INK }}>Don't have a resume yet?</p>
                    <p className="text-xs" style={{ color: SLATE }}>Build one step by step with our Resume Builder.</p>
                  </div>
                </div>
                <ArrowRight size={16} color={SLATE} />
              </button>

              <div className="mt-6">
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: INK }}>
                  <Mail size={16} color={accent} /> Email address
                </label>
                <p className="mb-2 text-xs" style={{ color: SLATE }}>
                  Matching your profile against this job takes a few minutes to process. We'll email your results to
                  this address as soon as they're ready.
                </p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border p-3 text-sm outline-none"
                  style={{ borderColor: emailError ? RED : BORDER, color: INK }}
                />
                {emailError && (
                  <p className="mt-2 text-sm font-medium" style={{ color: RED }}>
                    {emailError}
                  </p>
                )}

                <label className="mt-3 flex items-start gap-2 text-xs" style={{ color: SLATE }}>
                  <input
                    type="checkbox"
                    checked={preferResumeEmail}
                    onChange={(e) => setPreferResumeEmail(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    If my resume includes an email address, use that one instead. We'll still send to the address
                    above if none is found in the resume.
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-between">
              <button onClick={goBack} className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold" style={{ color: SLATE }}>
                <ArrowLeft size={16} /> Back
              </button>
              <button
                onClick={handleAnalyzeAndAdvance}
                disabled={!canGoNextFromStep2 || analyzing}
                className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: accent }}
              >
                {analyzing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    Submit <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
            {analyzeError && (
              <p className="mt-3 text-right text-sm font-medium" style={{ color: RED }}>
                {analyzeError}
              </p>
            )}
          </div>
        )}

        {/* STEP 3: Submitted confirmation (results arrive later by email) */}
        {step === 2 && (
          <div className="mx-auto max-w-xl">
            <div className="rounded-xl border bg-white p-8 text-center" style={{ borderColor: BORDER }}>
              <div
                className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: "#e7f8f0" }}
              >
                <Check size={26} color={GREEN} />
              </div>
              <h2 className="mb-2 text-lg font-bold" style={{ color: INK }}>You're all set!</h2>
              <p className="mb-1 text-sm" style={{ color: SLATE }}>
                We're comparing your resume against this job now. This usually takes about 5–10 minutes.
              </p>
              <p className="mb-6 text-sm" style={{ color: SLATE }}>
                {preferResumeEmail ? (
                  <>
                    We'll send your match results to the email address in your resume, if we find one — otherwise
                    we'll use{" "}
                    <span className="font-semibold" style={{ color: INK }}>{email}</span>. No need to keep this page
                    open.
                  </>
                ) : (
                  <>
                    We'll send your match results to{" "}
                    <span className="font-semibold" style={{ color: INK }}>{email}</span> as soon as they're ready —
                    no need to keep this page open.
                  </>
                )}
              </p>
              <div className="mb-6 flex items-center justify-center gap-2 rounded-lg p-3 text-xs" style={{ background: "#f4f6fb", color: SLATE }}>
                <Mail size={14} color={accent} /> Didn't land in your Primary inbox? Be sure to check your spam or junk folder.
              </div>
              {saveChoice === "saved" && (
                <p className="mb-6 -mt-3 text-xs" style={{ color: SLATE }}>
                  {isOverwrite ? "Your saved resume has also been updated." : "Your resume has also been saved to your profile for next time."}
                </p>
              )}
              <button
                onClick={handleRestart}
                className="mx-auto flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold"
                style={{ color: SLATE }}
              >
                <RotateCcw size={16} /> Start a New Match
              </button>
            </div>
          </div>
        )}
        </>
        )}
      </main>
    </div>
  );
}
