import React, { useEffect, useState, useRef } from "react";
import {
  Eye,
  EyeOff,
  FileText,
  UploadCloud,
  Check,
  Loader2,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { fetchSavedResumeMeta, uploadResumeAndSaveToProfile } from "./resumeStorage";

const BLUE = "#2f6bff";
const GREEN = "#1fa971";
const RED = "#e15b5b";
const INK = "#16213e";
const SLATE = "#5b6478";
const BORDER = "#e7e9f2";

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function ProfilePage({ userId, userEmail, userName, userFirstName, userLastName, theme }) {
  const accent = theme?.c1 || BLUE;
  const [loading, setLoading] = useState(true);

  // Personal info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(userEmail || "");
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);
  const [infoError, setInfoError] = useState("");

  // Password
  const [showPasswords, setShowPasswords] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  // Resume
  const [resumeMeta, setResumeMeta] = useState(null); // { path, filename, type, size, uploadedAt }
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function loadProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (!error && data) {
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
      }

      const meta = await fetchSavedResumeMeta(userId);
      if (!cancelled && meta) setResumeMeta(meta);

      setLoading(false);
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleSaveInfo(e) {
    e.preventDefault();
    setInfoError("");
    setInfoSaved(false);

    if (!firstName.trim() || !lastName.trim()) {
      setInfoError("Enter both a first and last name.");
      return;
    }

    setSavingInfo(true);

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ first_name: firstName.trim(), last_name: lastName.trim(), full_name: fullName })
      .eq("id", userId);

    if (profileError) {
      setSavingInfo(false);
      setInfoError(profileError.message);
      return;
    }

    // Keep the auth user's metadata (used for the dashboard greeting) in sync too.
    const { error: metaError } = await supabase.auth.updateUser({
      data: { first_name: firstName.trim(), last_name: lastName.trim(), full_name: fullName },
      ...(email.trim() !== userEmail ? { email: email.trim() } : {}),
    });

    setSavingInfo(false);

    if (metaError) {
      setInfoError(metaError.message);
      return;
    }

    setInfoSaved(true);
    setTimeout(() => setInfoSaved(false), 2500);
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();
    setPasswordError("");
    setPasswordUpdated(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Fill in all three password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Those new passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    setUpdatingPassword(true);

    // Supabase doesn't verify the "current" password for an update by itself,
    // so we confirm it ourselves by re-authenticating with it first.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });

    if (reauthError) {
      setUpdatingPassword(false);
      setPasswordError("Current password is incorrect.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    setUpdatingPassword(false);

    if (updateError) {
      setPasswordError(updateError.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordUpdated(true);
    setTimeout(() => setPasswordUpdated(false), 2500);
  }

  async function handleResumeFileChange(e) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setResumeError("");
    setUploadingResume(true);

    try {
      const meta = await uploadResumeAndSaveToProfile(userId, file);
      setResumeMeta(meta);
    } catch (err) {
      setResumeError(err.message || "Couldn't upload that file. Please try again.");
    } finally {
      setUploadingResume(false);
      e.target.value = "";
    }
  }

  async function handleDownloadResume() {
    if (!resumeMeta?.path) return;
    setResumeError("");

    const { data, error } = await supabase.storage
      .from("resumes")
      .createSignedUrl(resumeMeta.path, 60);

    if (error || !data?.signedUrl) {
      setResumeError("Couldn't generate a download link. Please try again.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={22} className="animate-spin" color={SLATE} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Personal information */}
      <form onSubmit={handleSaveInfo} className="rounded-xl border bg-white p-6" style={{ borderColor: BORDER }}>
        <h2 className="mb-1 text-base font-bold" style={{ color: INK }}>Personal information</h2>
        <p className="mb-5 text-sm" style={{ color: SLATE }}>
          Your name is shown on the dashboard; your email is where match results are sent.
        </p>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="mb-1.5 block text-xs font-semibold" style={{ color: INK }}>First name</label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={userFirstName || "First name"}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: BORDER, color: INK }}
            />
          </div>
          <div>
            <label htmlFor="lastName" className="mb-1.5 block text-xs font-semibold" style={{ color: INK }}>Last name</label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={userLastName || "Last name"}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: BORDER, color: INK }}
            />
          </div>
        </div>

        <div className="mb-5">
          <label htmlFor="profileEmail" className="mb-1.5 block text-xs font-semibold" style={{ color: INK }}>
            Email (where match results are sent)
          </label>
          <input
            id="profileEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: BORDER, color: INK }}
          />
          {email.trim() !== userEmail && (
            <p className="mt-1.5 text-xs" style={{ color: SLATE }}>
              Changing your email will send a confirmation link to the new address.
            </p>
          )}
        </div>

        {infoError && <p className="mb-3 text-xs font-medium" style={{ color: RED }}>{infoError}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={savingInfo}
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: accent }}
          >
            {savingInfo && <Loader2 size={15} className="animate-spin" />}
            Save changes
          </button>
          {infoSaved && (
            <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: GREEN }}>
              <Check size={15} /> Saved
            </span>
          )}
        </div>
      </form>

      {/* Password */}
      <form onSubmit={handleUpdatePassword} className="rounded-xl border bg-white p-6" style={{ borderColor: BORDER }}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: INK }}>Password</h2>
          <button
            type="button"
            onClick={() => setShowPasswords((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: SLATE }}
          >
            {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
            {showPasswords ? "Hide passwords" : "Show passwords"}
          </button>
        </div>
        <p className="mb-5 text-sm" style={{ color: SLATE }}>Use at least 8 characters, including a number.</p>

        <div className="mb-5 space-y-3">
          <div>
            <label htmlFor="currentPassword" className="mb-1.5 block text-xs font-semibold" style={{ color: INK }}>Current password</label>
            <input
              id="currentPassword"
              type={showPasswords ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: BORDER, color: INK }}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="newPassword" className="mb-1.5 block text-xs font-semibold" style={{ color: INK }}>New password</label>
              <input
                id="newPassword"
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: BORDER, color: INK }}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-semibold" style={{ color: INK }}>Confirm new password</label>
              <input
                id="confirmPassword"
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: BORDER, color: INK }}
              />
            </div>
          </div>
        </div>

        {passwordError && <p className="mb-3 text-xs font-medium" style={{ color: RED }}>{passwordError}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={updatingPassword}
            className="flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ borderColor: BORDER, color: INK }}
          >
            {updatingPassword && <Loader2 size={15} className="animate-spin" />}
            Update password
          </button>
          {passwordUpdated && (
            <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: GREEN }}>
              <Check size={15} /> Password updated
            </span>
          )}
        </div>
      </form>

      {/* Resume */}
      <div className="rounded-xl border bg-white p-6" style={{ borderColor: BORDER }}>
        <h2 className="mb-1 text-base font-bold" style={{ color: INK }}>Resume</h2>
        <p className="mb-5 text-sm" style={{ color: SLATE }}>
          We match this file against each job's requirements and store it securely for next time.
        </p>

        {resumeMeta ? (
          <>
            <div className="mb-4 flex items-center gap-4 rounded-lg border p-4" style={{ borderColor: BORDER }}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ background: "#e7f8f0" }}>
                <FileText size={20} color={GREEN} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" style={{ color: INK }}>{resumeMeta.filename}</p>
                <p className="mt-0.5 text-xs" style={{ color: SLATE }}>
                  {[resumeMeta.type || null, formatBytes(resumeMeta.size), resumeMeta.uploadedAt ? `Uploaded ${formatDate(resumeMeta.uploadedAt)}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                onClick={handleDownloadResume}
                className="shrink-0 text-sm font-semibold"
                style={{ color: accent }}
              >
                Download
              </button>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 rounded-lg p-4 sm:grid-cols-2" style={{ background: "#f4f6fb" }}>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: SLATE }}>File name</p>
                <p className="mt-1 text-sm" style={{ color: INK }}>{resumeMeta.filename}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: SLATE }}>File type</p>
                <p className="mt-1 text-sm" style={{ color: INK }}>{resumeMeta.type || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: SLATE }}>Size</p>
                <p className="mt-1 text-sm" style={{ color: INK }}>{formatBytes(resumeMeta.size) || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: SLATE }}>Stored as (binary, private)</p>
                <p className="mt-1 break-all font-mono text-xs" style={{ color: INK }}>{resumeMeta.path}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="mb-5 text-sm" style={{ color: SLATE }}>No resume on file yet.</p>
        )}

        {resumeError && <p className="mb-3 text-xs font-medium" style={{ color: RED }}>{resumeError}</p>}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleResumeFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingResume}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center disabled:opacity-60"
          style={{ borderColor: "#c7cde0" }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "#e8f0ff" }}>
            {uploadingResume ? <Loader2 size={18} className="animate-spin" color={accent} /> : <UploadCloud size={18} color={accent} />}
          </div>
          <p className="text-sm font-semibold" style={{ color: INK }}>
            {resumeMeta ? "Replace your resume" : "Upload your resume"}
          </p>
          <p className="text-xs" style={{ color: SLATE }}>PDF or Word document, up to 10MB</p>
        </button>
      </div>
    </div>
  );
}
