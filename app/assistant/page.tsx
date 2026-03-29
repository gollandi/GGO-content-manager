"use client";

import { useState } from "react";
import AppShell from "../../components/AppShell";
import styles from "./page.module.css";
import * as Icons from "../../components/Icons";

const steps = [
  { title: "1. Submit content", desc: "Provide URL, text, or upload files" },
  { title: "2. Validate", desc: "Gemini AI checks against PIF Tick principles" },
  { title: "3. Review", desc: "Get recommendations and required actions" }
];

export default function AssistantPage() {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runValidation = async () => {
    if (!url && !text) return alert("Please provide a URL or text snippet");

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, text })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (error: any) {
      alert("Validation failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className={styles.page}>
        <header className="page-header">
          <div>
            <h1 className="page-title">Gemini AI Compliance Assistant</h1>
            <p className="page-subtitle">Automated content checks and recommendations</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Notifications">
              <Icons.IconBell />
              <span className={styles.iconBadge}>3</span>
            </button>
            <button className="btn-gradient" onClick={() => { setUrl(""); setText(""); setResult(null); }}>
              <Icons.IconPlus style={{ width: '16px', marginRight: '8px' }} />
              New Review
            </button>
          </div>
        </header>

        <section className="page-section">
          {!result && (
            <>
              <div className={styles.stepRow}>
                {steps.map((step) => (
                  <div key={step.title} className={styles.stepCard}>
                    <div className={styles.stepTitle}>{step.title}</div>
                    <div className={styles.stepDesc}>{step.desc}</div>
                  </div>
                ))}
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Icons.IconLink className="text-primary" style={{ width: '24px' }} />
                    <h3>URL Input</h3>
                  </div>
                  <p>Paste a content URL to validate</p>
                  <input
                    placeholder="https://..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
                <div className={styles.formCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Icons.IconFileText className="text-primary" style={{ width: '24px' }} />
                    <h3>Text Snippet</h3>
                  </div>
                  <p>Provide a text excerpt for quick analysis</p>
                  <textarea
                    placeholder="Paste text here..."
                    rows={6}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>
                <div className={styles.formCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Icons.IconUpload className="text-primary" style={{ width: '24px' }} />
                    <h3>Upload Files</h3>
                  </div>
                  <p>Drag and drop PDFs, docs, or images</p>
                  <div className={styles.uploadBox}>Drop files here</div>
                </div>
              </div>

              <div className={styles.footerActions}>
                <button className="btn-pill">
                  <Icons.IconSave style={{ width: '14px', marginRight: '6px' }} />
                  Save Draft
                </button>
                <button
                  className="btn-gradient"
                  onClick={runValidation}
                  disabled={loading}
                >
                  {loading ? (
                    <Icons.IconSync className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Icons.IconValidation className="w-4 h-4 mr-2" />
                  )}
                  {loading ? "Analyzing..." : "Run Validation"}
                </button>
              </div>
            </>
          )}

          {result && (
            <div className={styles.resultsContainer}>
              <div className={styles.resultsHeader}>
                <div className={styles.overallStatus}>
                  <span className={result.status === "✅ YES" ? styles.passBadge : styles.failBadge}>
                    {result.status} {result.status === "✅ YES" ? "Compliant" : "Needs Work"}
                  </span>
                  <h2>Compliance Analysis Result</h2>
                </div>
                <button className="btn-pill" onClick={() => setResult(null)}>Edit Submission</button>
              </div>

              <div className={styles.resultsGrid}>
                <div className={styles.findingsPanel}>
                  <h3>Principle Breakdown</h3>
                  <div className={styles.findingList}>
                    {result.findings.map((f: any, i: number) => (
                      <div key={i} className={`${styles.findingCard} ${f.pass ? styles.passCard : styles.failCard}`}>
                        <div className={styles.findingHeader}>
                          <strong>{f.principle}</strong>
                          <span>{f.pass ? "PASS" : "FAIL"}</span>
                        </div>
                        <p>{f.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.recommendationsPanel}>
                  <h3>AI Recommendations</h3>
                  <ul className={styles.recList}>
                    {result.recommendations.map((rec: string, i: number) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                  <div className={styles.actionCard}>
                    <h4>Action Required</h4>
                    <p>Update the content in Sanity and re-run validation to confirm compliance.</p>
                    <button className="btn-gradient w-full mt-4">Save to Compliance Log</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
