// Screens 19-23: Browser Extension UI
// Render inside a mock "AI chat" page so the overlays make sense.

const MockChatPage = ({ children, prompt = "Draft a refund email to customer Mariam Al-Hashimi (ID 1102936453, IBAN SA03 8000 0000 6080 1016 7519) for invoice 4421." }) => (
  <div style={{ position: "relative", minHeight: "100vh", background: "var(--bg)" }}>
    {/* Fake browser chrome */}
    <div style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <span className="browser-dot" style={{ background: "#FF5F56" }} />
      <span className="browser-dot" style={{ background: "#FFBD2E" }} />
      <span className="browser-dot" style={{ background: "#27C93F" }} />
      <div className="mono" style={{ flex: 1, marginLeft: 8, fontSize: 11.5, color: "var(--ink-4)", padding: "5px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
        chat.example-ai.com / new
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6 }}>
        <Logo size={18}/>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>Hares AI · active</span>
      </div>
    </div>
    {/* Fake AI chat content */}
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "60px 24px 220px" }}>
      <div style={{ fontSize: 12, color: "var(--ink-4)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>New conversation</div>
      <div className="serif" style={{ fontSize: 36, color: "var(--ink-2)", lineHeight: 1.1, marginBottom: 24 }}>How can I help you today?</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, opacity: 0.6 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>LA</div>
          <div className="card" style={{ padding: "10px 14px", fontSize: 13.5, color: "var(--ink-2)" }}>Help me draft a polite refund email.</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surface-3)", display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 11 }}>AI</div>
          <div style={{ padding: "10px 14px", fontSize: 13.5, color: "var(--ink-3)" }}>Of course — could you share the customer's name and the invoice details?</div>
        </div>
      </div>
    </div>
    {/* Fake prompt input */}
    <div style={{ position: "fixed", bottom: 28, left: 0, right: 0, display: "grid", placeItems: "center", padding: "0 24px", zIndex: 1 }}>
      <div className="card" style={{ width: "100%", maxWidth: 760, padding: 14, boxShadow: "var(--shadow-md)" }}>
        <textarea readOnly value={prompt} style={{ width: "100%", border: "none", outline: "none", background: "transparent", resize: "none", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.5, minHeight: 60 }}/>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <span style={{ fontSize: 11.5, color: "var(--ink-4)" }}>Hares AI is scanning…</span>
          <button className="btn btn-primary" style={{ padding: "8px 14px" }}><I.Send size={13}/> Send</button>
        </div>
      </div>
    </div>
    {children}
  </div>
);

// 19. Extension Popup (380px)
const ExtensionPopup = () => {
  const [enabled, setEnabled] = React.useState(true);
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "60px 20px", display: "grid", placeItems: "start center", gap: 24 }}>
      <div style={{ fontSize: 12, color: "var(--ink-4)", letterSpacing: ".08em", textTransform: "uppercase" }}>Browser Extension Popup · 380×&nbsp;auto</div>
      <div style={{ width: 380, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
          <Logo size={24}/>
          <div style={{ flex: 1, lineHeight: 1.1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Hares AI</div>
            <div style={{ fontSize: 11, color: "var(--ink-4)" }}>v2.4.1</div>
          </div>
          <span className={`h-pill ${enabled ? "status-active" : "status-inactive"}`}>
            <span className="dot" style={{ background: enabled ? "#16A34A" : "#94A3B8" }}/>
            {enabled ? "Active" : "Inactive"}
          </span>
        </div>

        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>LA</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>Layla Al-Saud</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>layla.alsaud@haresai.com</div>
          </div>
        </div>

        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: "var(--ink-4)", letterSpacing: ".04em", textTransform: "uppercase" }}>Today's scans</div>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.1 }}>47</div>
          </div>
          <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: "var(--risk-high)", letterSpacing: ".04em", textTransform: "uppercase" }}>Today's blocks</div>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.1, color: "var(--risk-high)" }}>3</div>
          </div>
        </div>

        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Protection</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{enabled ? "Active on this tab" : "Disabled — prompts will pass through"}</div>
            </div>
            <Toggle checked={enabled} onChange={setEnabled}/>
          </div>
        </div>

        <div style={{ padding: "10px 8px" }}>
          {[
            [I.Dashboard, "View My Dashboard", "→"],
            [I.Activity, "View Activity Log", "→"],
            [I.Edit, "Open Prompt Revision", "→"],
          ].map(([Ic, label, arrow], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, cursor: "pointer", color: "var(--ink-2)", fontSize: 13 }}
                 onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
                 onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <Ic size={14} stroke="var(--ink-3)" />
              <span style={{ flex: 1 }}>{label}</span>
              <span style={{ color: "var(--ink-4)" }}>{arrow}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: "10px 18px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, color: "var(--ink-4)" }}>
          <span>v2.4.1 · build 8821</span>
          <a href="#" style={{ color: "var(--ink-3)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}><I.Logout size={11}/> Log Out</a>
        </div>
      </div>
    </div>
  );
};

// 20. High Risk Alert Overlay
const HighRiskOverlay = () => (
  <MockChatPage>
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 14, 28, 0.55)", display: "grid", placeItems: "center", zIndex: 10, animation: "fadeIn .14s ease" }}>
      <div className="card" style={{ width: 480, maxWidth: "calc(100vw - 32px)", overflow: "hidden", boxShadow: "var(--shadow-lg)", animation: "popIn .16s ease" }}>
        <div style={{ padding: "16px 22px", display: "flex", alignItems: "center", gap: 12, background: "var(--risk-high-soft)", borderBottom: "1px solid rgba(220,38,38,0.2)" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--risk-high)", color: "white", display: "grid", placeItems: "center" }}>
            <I.AlertTriangle size={18}/>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--risk-high)", letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>High Risk · Submission Blocked</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>This prompt cannot leave your device.</div>
          </div>
        </div>

        <div style={{ padding: 22 }}>
          <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 14 }}>
            Your prompt contains sensitive information that violates your organization's data policy.
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-4)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>Detected entities</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {[["Saudi National ID", "1102936453"], ["IBAN", "SA03 8000…7519"], ["Person name", "Mariam Al-Hashimi"]].map(([k, v], i) => (
              <span key={i} className="h-pill risk-high" style={{ fontSize: 11 }}>{k}: <strong style={{ marginLeft: 4 }}>{v}</strong></span>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="btn btn-danger"><I.Edit size={14}/> Edit Prompt</button>
            <button className="btn btn-secondary"><I.Sparkle size={14}/> Revise with Hares AI</button>
            <button className="btn btn-ghost" style={{ fontSize: 12.5 }}><I.ExternalLink size={13}/> View Full Details</button>
          </div>
        </div>

        <div style={{ padding: "10px 22px", borderTop: "1px solid var(--line)", background: "var(--surface-2)", fontSize: 11.5, color: "var(--ink-4)", display: "flex", alignItems: "center", gap: 8 }}>
          <I.Logs size={12}/> Submission has been blocked and logged.
        </div>
      </div>
    </div>
  </MockChatPage>
);

// 21. Medium Risk Alert Overlay
const MediumRiskOverlay = () => (
  <MockChatPage prompt="Summarize the Q3 revenue figures from the attached spreadsheet for the leadership memo.">
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 14, 28, 0.45)", display: "grid", placeItems: "center", zIndex: 10, animation: "fadeIn .14s ease" }}>
      <div className="card" style={{ width: 480, maxWidth: "calc(100vw - 32px)", overflow: "hidden", boxShadow: "var(--shadow-lg)", animation: "popIn .16s ease" }}>
        <div style={{ padding: "16px 22px", display: "flex", alignItems: "center", gap: 12, background: "var(--risk-med-soft)", borderBottom: "1px solid rgba(217,119,6,0.2)" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--risk-med)", color: "white", display: "grid", placeItems: "center" }}>
            <I.AlertTriangle size={18}/>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--risk-med)", letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>Medium Risk · Review Before Sending</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>This prompt may contain sensitive context.</div>
          </div>
        </div>

        <div style={{ padding: 22 }}>
          <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 14 }}>
            Your prompt may contain information that could be sensitive. Please review before submitting.
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-4)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>Detected entities</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {[["Financial figures", "Q3 revenue"]].map(([k, v], i) => (
              <span key={i} className="h-pill risk-med" style={{ fontSize: 11 }}>{k}: <strong style={{ marginLeft: 4 }}>{v}</strong></span>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="btn" style={{ background: "var(--risk-med)", color: "white" }}><I.Edit size={14}/> Edit Prompt</button>
            <button className="btn btn-secondary" style={{ borderColor: "var(--risk-none)", color: "var(--risk-none)" }}><I.Check size={14}/> Submit Anyway</button>
            <button className="btn btn-ghost" style={{ fontSize: 12.5 }}><I.Sparkle size={13}/> Revise with Hares AI</button>
          </div>
        </div>

        <div style={{ padding: "10px 22px", borderTop: "1px solid var(--line)", background: "var(--surface-2)", fontSize: 11.5, color: "var(--ink-4)", display: "flex", alignItems: "center", gap: 8 }}>
          <I.Logs size={12}/> Your choice will be logged for audit purposes.
        </div>
      </div>
    </div>
  </MockChatPage>
);

// 22. Low Risk Info Toast
const LowRiskToast = () => (
  <MockChatPage prompt="Generate test cases for our internal pricing-engine endpoint /api/v2/pricing.">
    <div style={{ position: "fixed", bottom: 130, right: 28, zIndex: 10, animation: "toastIn .2s ease" }}>
      <div className="card" style={{ width: 360, padding: 14, display: "flex", alignItems: "flex-start", gap: 10, borderLeft: "3px solid var(--risk-low)", boxShadow: "var(--shadow-lg)" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--risk-low-soft)", color: "var(--risk-low)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
          <I.Info size={14}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--risk-low)", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600 }}>Low Risk · Info</span>
            <button style={{ border: "none", background: "transparent", color: "var(--ink-4)", cursor: "pointer", padding: 2 }}><I.X size={13}/></button>
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.45 }}>
            A potentially sensitive term was detected. Submission allowed.
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="h-pill risk-low" style={{ fontSize: 10.5 }}>Internal endpoint: /api/v2/pricing</span>
            <a href="#" style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>View Details →</a>
          </div>
          <div style={{ marginTop: 10, height: 2, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: "65%", background: "var(--risk-low)" }}/>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 4 }}>Auto-dismisses in 3s</div>
        </div>
      </div>
    </div>
  </MockChatPage>
);

// 23. Revision Suggestion Overlay
const RevisionOverlay = () => (
  <MockChatPage>
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 14, 28, 0.55)", display: "grid", placeItems: "center", zIndex: 10, padding: 16, animation: "fadeIn .14s ease" }}>
      <div className="card" style={{ width: 880, maxWidth: "100%", overflow: "hidden", boxShadow: "var(--shadow-lg)", animation: "popIn .16s ease" }}>
        <div style={{ padding: "14px 22px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--line)" }}>
          <Logo size={22}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Hares AI — Suggested Revision</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>3 entities removed · sensitive data replaced with placeholders</div>
          </div>
          <button style={{ border: "none", background: "transparent", color: "var(--ink-4)", cursor: "pointer", padding: 4 }}><I.X size={16}/></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          <div style={{ padding: 22, borderRight: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>Original Prompt</div>
              <span className="h-pill risk-high" style={{ fontSize: 10.5 }}>High Risk</span>
            </div>
            <div className="promptbox" style={{ minHeight: 160 }}>
              <HighlightedPrompt
                text="Draft a refund email to customer Mariam Al-Hashimi (ID 1102936453, IBAN SA03 8000 0000 6080 1016 7519) for invoice 4421."
                entities={[["Mariam Al-Hashimi","Person Name","high"], ["1102936453","Saudi National ID","high"], ["SA03 8000 0000 6080 1016 7519","IBAN","high"]]}
              />
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "var(--ink-4)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6 }}>Removed</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {["Mariam Al-Hashimi → [Customer Name]", "1102936453 → [removed]", "IBAN → [removed]"].map((t, i) => (
                  <span key={i} className="h-pill risk-low" style={{ fontSize: 10.5 }}>{t}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: 22, borderLeft: "3px solid var(--risk-none)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>Revised Prompt <span style={{ color: "var(--ink-4)", fontWeight: 400, marginLeft: 4 }}>· editable</span></div>
              <span className="h-pill risk-none" style={{ fontSize: 10.5 }}><I.Check size={10}/> Safe</span>
            </div>
            <textarea
              defaultValue="Draft a refund email to a customer (referred to as [Customer Name]) regarding their invoice. Reference the invoice number and apologise for the delay; confirm the refund will be processed within 5 business days."
              style={{ width: "100%", minHeight: 160, padding: 12, fontSize: 13.5, lineHeight: 1.55, border: "1px solid var(--line-strong)", borderRadius: 10, background: "var(--surface)", color: "var(--ink)", resize: "vertical" }}
            />
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-3)" }}>
                <input type="checkbox" /> Show structured version
              </label>
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--line)", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12.5 }}>Cancel</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary"><I.Edit size={14}/> Edit Manually</button>
            <button className="btn btn-primary"><I.Check size={14}/> Use Revised Prompt</button>
          </div>
        </div>
      </div>
    </div>
  </MockChatPage>
);

Object.assign(window, { ExtensionPopup, HighRiskOverlay, MediumRiskOverlay, LowRiskToast, RevisionOverlay });
