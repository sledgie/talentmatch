import { supabase } from "./supabaseClient";

// Reads the Settings-page preferences that affect the resume step:
// whether to ask/always/never save automatically, and whether to default
// to preferring the resume's own email address. Defensive defaults match
// the schema's column defaults, in case the row or columns aren't there yet.
export async function fetchResumePreferences(userId) {
  if (!userId) return { resumeSavePreference: "ask", preferResumeEmailDefault: false };

  const { data, error } = await supabase
    .from("profiles")
    .select("resume_save_preference, prefer_resume_email_default")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return { resumeSavePreference: "ask", preferResumeEmailDefault: false };
  }

  return {
    resumeSavePreference: data.resume_save_preference || "ask",
    preferResumeEmailDefault: data.prefer_resume_email_default ?? false,
  };
}

// Reads the resume currently saved on a user's profile, if any.
// Returns null if there's no saved resume (or the lookup fails).
export async function fetchSavedResumeMeta(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("resume_url, resume_filename, resume_type, resume_size, resume_uploaded_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data || !data.resume_url) return null;

  return {
    path: data.resume_url,
    filename: data.resume_filename || data.resume_url.split("/").pop(),
    type: data.resume_type || "",
    size: data.resume_size,
    uploadedAt: data.resume_uploaded_at,
  };
}

// Uploads a File to the private "resumes" bucket under the user's own folder
// and records its metadata on profiles. Throws on failure so callers can
// decide how to surface that (this is always an explicit, user-initiated
// save/overwrite, never a silent background action).
export async function uploadResumeAndSaveToProfile(userId, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const path = `${userId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;

  const uploadedAt = new Date().toISOString();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      resume_url: path,
      resume_filename: file.name,
      resume_type: file.type,
      resume_size: file.size,
      resume_uploaded_at: uploadedAt,
    })
    .eq("id", userId);
  if (profileError) throw profileError;

  return { path, filename: file.name, type: file.type, size: file.size, uploadedAt };
}

// Downloads the actual resume bytes from Storage as a Blob, e.g. to attach
// a previously-saved resume to an outgoing request. Throws on failure.
export async function downloadResumeBlob(path) {
  const { data, error } = await supabase.storage.from("resumes").download(path);
  if (error) throw error;
  return data;
}
