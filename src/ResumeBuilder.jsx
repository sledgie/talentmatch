import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "./supabaseClient";
import resumeBuilderTemplateRaw from "./resumeBuilder.template.html?raw";

const SLATE = "#5b6478";
const BG = "#f4f6fb";

// The builder is a large, mostly self-contained HTML/CSS/JS mock (its own
// header, templates, live preview). Rather than port ~400 lines of working
// vanilla JS into React state, it runs inside a sandboxed iframe: that
// keeps its broad CSS (global `:root` variables, bare `button`/`input`
// selectors, a `prefers-color-scheme` override) from ever touching the
// rest of the app, and the only surface between the two sides is three
// postMessage events (back, save-draft, use-resume).
export default function ResumeBuilder({ userId, theme, onBack, onResumeReady }) {
  const [loading, setLoading] = useState(true);
  const [srcDoc, setSrcDoc] = useState(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let draft = null;
      if (userId) {
        const { data, error } = await supabase
          .from("profiles")
          .select("resume_builder_draft")
          .eq("id", userId)
          .maybeSingle();
        if (!error && data?.resume_builder_draft) draft = data.resume_builder_draft;
      }
      if (cancelled) return;

      const accent = theme?.c1 || "#0d3b3b";
      const tint = theme?.c2 || "#f6f1e4";

      const html = resumeBuilderTemplateRaw
        .replace("__INITIAL_DRAFT_JSON__", JSON.stringify(draft))
        .replace("__THEME_C1__", accent)
        .replace("__THEME_C2__", tint);

      setSrcDoc(html);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    function handleMessage(event) {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const { type, payload } = event.data || {};

      if (type === "resume-builder:back") {
        onBack?.();
        return;
      }

      if (type === "resume-builder:save-draft") {
        if (userId) {
          supabase
            .from("profiles")
            .update({ resume_builder_draft: payload })
            .eq("id", userId)
            .then(({ error }) => {
              if (error) console.warn("[Resume builder] couldn't save draft:", error.message);
            });
        }
        return;
      }

      if (type === "resume-builder:use-resume") {
        const { buffer, filename } = payload || {};
        if (!buffer) return;
        const file = new File([buffer], filename || "resume.pdf", { type: "application/pdf" });
        onResumeReady?.(file);
        return;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [userId, onBack, onResumeReady]);

  if (loading || !srcDoc) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center" style={{ background: BG }}>
        <Loader2 size={22} className="animate-spin" color={SLATE} />
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title="Resume Builder"
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none", background: "#ffffff" }}
    />
  );
}
