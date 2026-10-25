// Screens 5-9: Normal user

const RISK_DONUT_DATA = [
  { label: "High", value: 17, color: "#DC2626" },
  { label: "Medium", value: 42, color: "#D97706" },
  { label: "Low", value: 88, color: "#2563EB" },
  { label: "None", value: 1137, color: "#16A34A" },
];

// 5. User Dashboard
const UserDashboard = ({ onNav, sessionUser }) => {
  const recent = ACTIVITY.slice(0, 6);
  return (
    <div className="app-shell">
      <Sidebar roleScope="user" current="user-dashboard" onNavigate={onNav} sessionUser={sessionUser} />
      <main>
        <Topbar crumb="Personal" title="My Dashboard" actions={
          <>
            <button className="btn btn-ghost"><I.Bolt size={14}/> Extension</button>
            <button className="btn btn-secondary" onClick={() => onNav("user-revision")}><I.Edit size={14}/> Revise a Prompt</button>
          </>
        } />
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: "var(--section-gap)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <Stat label="Total Prompts Scanned" value="1,284" delta={12} icon={I.Activity} />
            <Stat label="High Risk Blocked" value="17" delta={-4} icon={I.Block} accent />
            <Stat label="Medium Risk Warned" value="42" delta={8} icon={I.AlertTriangle} />
            <Stat label="Prompts Revised" value="36" delta={22} icon={I.Edit} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 16 }}>
            <div className="card" style={{ padding: "var(--card-p)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Risk Distribution</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-4)", marginTop: 2 }}>Last 30 days</div>
                </div>
                <select style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line-strong)", background: "var(--surface)", color: "var(--ink-2)" }}>
                  <option>30 days</option><option>7 days</option><option>90 days</option>
                </select>
              </div>
              <Donut data={RISK_DONUT_DATA} size={170} />
            </div>

            <div className="card" style={{ padding: "var(--card-p)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Risk trend</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-4)", marginTop: 2 }}>Daily flagged prompts</div>
                </div>
              </div>
              <LineChart series={[
                { color: "#DC2626", data: [3,1,4,2,5,3,6,4,2,3,5,7,4,2], fill: true,
                  labels: ["M","T","W","T","F","S","S","M","T","W","T","F","S","S"] },
                { color: "#D97706", data: [6,4,8,5,7,3,9,6,5,4,8,11,6,4], fill: true },
              ]} height={210} />
              <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
                <span className="legend-row"><span className="legend-dot" style={{ background: "#DC2626" }}/> High</span>
                <span className="legend-row"><span className="legend-dot" style={{ background: "#D97706" }}/> Medium</span>
              </div>
            </div>
          </div>

          <Section title="Recent Activity" sub="Your last 6 prompt scans"
            actions={<button className="btn btn-ghost" onClick={() => onNav("user-activity")}>View Full Log →</button>}>
            <div className="card" style={{ overflow: "hidden" }}>
              <table className="h-table">
                <thead>
                  <tr>
                    <th style={{ width: 150 }}>Date / Time</th>
                    <th style={{ width: 110 }}>Platform</th>
                    <th>Prompt</th>
                    <th style={{ width: 110 }}>Risk</th>
                    <th style={{ width: 120 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(r => (
                    <tr key={r.id}>
                      <td style={{ color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{fmtDate(r.ts)}</td>
                      <td>{r.platform}</td>
                      <td style={{ color: "var(--ink-2)", maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.preview}</td>
                      <td><RiskBadge level={r.risk}/></td>
                      <td><ActionBadge action={r.action}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
};

// 6. Activity Log
const ActivityLog = ({ onNav, sessionUser, defaultRiskFilter, title = "My Activity Log", crumb = "Personal", roleScope = "user", current = "user-activity" }) => {
  const [riskFilter, setRiskFilter] = React.useState(defaultRiskFilter || null);
  const [expanded, setExpanded] = React.useState(null);
  const rows = ACTIVITY.filter(r => !riskFilter || r.risk === riskFilter).slice(0, 30);

  return (
    <div className="app-shell">
      <Sidebar roleScope={roleScope} current={current} onNavigate={onNav} sessionUser={sessionUser} />
      <main>
        <Topbar crumb={crumb} title={title} actions={
          <button className="btn btn-secondary"><I.Download size={14}/> Export CSV</button>
        }/>
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FilterBar>
            <Field icon={I.Calendar} width={180}>Last 30 days <I.Chevron size={12}/></Field>
            <Field icon={I.Globe} width={140}>All platforms <I.Chevron size={12}/></Field>
            <Field icon={I.Filter} width={170}>
              {riskFilter ? `Risk: ${riskFilter}` : "All risk levels"}
              <I.Chevron size={12}/>
            </Field>
            <SearchInput placeholder="Search prompt text…" />
            <button className="btn btn-ghost" onClick={() => setRiskFilter(null)}>Clear</button>
          </FilterBar>

          <div className="card" style={{ overflow: "hidden" }}>
            <table className="h-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th style={{ width: 150 }}>Timestamp</th>
                  <th style={{ width: 110 }}>Platform</th>
                  <th>Prompt Preview</th>
                  <th style={{ width: 200 }}>Detected Entities</th>
                  <th style={{ width: 100 }}>Risk</th>
                  <th style={{ width: 110 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <React.Fragment key={r.id}>
                    <tr style={{ cursor: "pointer" }} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                      <td style={{ color: "var(--ink-4)" }}>{(i+1).toString().padStart(2,"0")}</td>
                      <td style={{ color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{fmtDate(r.ts)}</td>
                      <td>{r.platform}</td>
                      <td style={{ color: "var(--ink-2)", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.preview}</td>
                      <td style={{ color: "var(--ink-3)", fontSize: 12.5 }}>
                        {r.entities.length === 0 ? <span style={{ color: "var(--ink-4)" }}>—</span> :
                          r.entities.slice(0,2).map(([w, , sev], j) => (
                            <span key={j} className={`h-pill risk-${sev}`} style={{ marginRight: 4, fontSize: 11 }}>{w.length > 14 ? w.slice(0,12)+"…" : w}</span>
                          ))
                        }
                        {r.entities.length > 2 && <span style={{ color: "var(--ink-4)" }}>+{r.entities.length - 2}</span>}
                      </td>
                      <td><RiskBadge level={r.risk}/></td>
                      <td><ActionBadge action={r.action}/></td>
                    </tr>
                    {expanded === r.id && (
                      <tr>
                        <td colSpan={7} style={{ background: "var(--surface-2)", padding: 0 }}>
                          <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
                            <div>
                              <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 8 }}>Full prompt</div>
                              <div className="promptbox"><HighlightedPrompt text={r.preview} entities={r.entities}/></div>
                              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                                <button className="btn btn-secondary" onClick={() => onNav("user-revision")}><I.Edit size={13}/> Revise this prompt</button>
                                <button className="btn btn-ghost"><I.Copy size={13}/> Copy</button>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 8 }}>Detected entities</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {r.entities.length === 0 && <div style={{ color: "var(--ink-4)", fontSize: 13 }}>No entities detected.</div>}
                                {r.entities.map(([w, kind, sev], j) => (
                                  <div key={j} className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                                    <span className={`h-pill risk-${sev}`} style={{ fontSize: 10.5 }}>{sev.toUpperCase()}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w}</div>
                                      <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{kind}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--line)", fontSize: 12.5, color: "var(--ink-4)" }}>
              <div>Showing 1–{rows.length} of {ACTIVITY.length}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-ghost" style={{ padding: "6px 10px" }}>← Prev</button>
                {[1,2,3].map(n => <button key={n} className="btn btn-ghost" style={{ padding: "6px 10px", background: n === 1 ? "var(--surface-3)" : "transparent" }}>{n}</button>)}
                <button className="btn btn-ghost" style={{ padding: "6px 10px" }}>Next →</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// 7. Blocked Messages
const BlockedMessages = ({ onNav, sessionUser }) => {
  const blocked = ACTIVITY.filter(a => a.risk === "High");
  return (
    <div className="app-shell">
      <Sidebar roleScope="user" current="user-blocked" onNavigate={onNav} sessionUser={sessionUser} />
      <main>
        <Topbar crumb="Personal" title="Blocked Messages" actions={
          <button className="btn btn-secondary"><I.Download size={14}/> Export CSV</button>
        }/>
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, borderLeft: "3px solid var(--risk-high)" }}>
            <I.Block size={18} stroke="var(--risk-high)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{blocked.length} prompts have been blocked from leaving your device.</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>Each block is logged and counted against your high-risk activity profile.</div>
            </div>
          </div>

          <FilterBar>
            <Field icon={I.Calendar} width={180}>Last 30 days <I.Chevron size={12}/></Field>
            <Field icon={I.Globe} width={140}>All platforms <I.Chevron size={12}/></Field>
            <SearchInput placeholder="Search blocked prompt text…" />
          </FilterBar>

          <div className="card" style={{ overflow: "hidden" }}>
            <table className="h-table">
              <thead>
                <tr>
                  <th style={{ width: 150 }}>Timestamp</th>
                  <th style={{ width: 110 }}>Platform</th>
                  <th>Prompt</th>
                  <th style={{ width: 220 }}>Blocked entities</th>
                  <th style={{ width: 200 }}>Reason</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {blocked.map(r => (
                  <tr key={r.id} style={{ borderLeft: "3px solid var(--risk-high)" }}>
                    <td style={{ color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{fmtDate(r.ts)}</td>
                    <td>{r.platform}</td>
                    <td style={{ maxWidth: 360 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <HighlightedPrompt text={r.preview} entities={r.entities}/>
                      </div>
                    </td>
                    <td>
                      {r.entities.slice(0,3).map(([w, kind], j) => (
                        <span key={j} className="h-pill risk-high" style={{ marginRight: 4, marginBottom: 3, fontSize: 10.5 }}>{kind}</span>
                      ))}
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Sensitive PII / financial data detected</td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => onNav("user-revision")}>
                        <I.Edit size={12}/> Revise
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

// 8. Prompt Revision
const PromptRevision = ({ onNav, sessionUser }) => {
  const original = "Draft a refund email to customer Mariam Al-Hashimi (ID 1102936453, IBAN SA03 8000 0000 6080 1016 7519) for invoice 4421.";
  const entities = [
    ["Mariam Al-Hashimi","Person Name","high"],
    ["1102936453","Saudi National ID","high"],
    ["SA03 8000 0000 6080 1016 7519","IBAN","high"],
  ];
  const revised = "Draft a refund email to a customer (referred to as [Customer Name]) regarding their invoice. Reference the invoice number and apologise for the delay; confirm the refund will be processed within 5 business days.";
  const structured = `Goal: Customer refund email
Tone: Polite, apologetic
Required fields:
  • [Customer Name]
  • [Invoice Number]
  • [Refund Window: 5 business days]
Constraints: Do not include national IDs, IBANs, or any financial identifiers.`;

  return (
    <div className="app-shell">
      <Sidebar roleScope="user" current="user-revision" onNavigate={onNav} sessionUser={sessionUser} />
      <main>
        <Topbar crumb="Personal" title="Prompt Revision" actions={
          <span className="h-pill risk-none"><I.Check size={11}/> 3 entities removed</span>
        }/>
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="card" style={{ padding: "var(--card-p)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Original Prompt</div>
                <span className="h-pill risk-high">High Risk</span>
              </div>
              <div className="promptbox" style={{ minHeight: 180 }}>
                <HighlightedPrompt text={original} entities={entities}/>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 8 }}>Flagged entities</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {entities.map(([w, kind], i) => (
                    <span key={i} className="h-pill risk-high" style={{ fontSize: 11 }}>{kind}: {w.length > 18 ? w.slice(0,16)+"…" : w}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: "var(--card-p)", borderLeft: "3px solid var(--risk-none)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Revised Prompt <span style={{ color: "var(--ink-4)", fontWeight: 400, marginLeft: 6 }}>· editable</span></div>
                <span className="h-pill risk-none"><I.Check size={11}/> Safe</span>
              </div>
              <textarea defaultValue={revised}
                style={{ width: "100%", minHeight: 180, padding: 14, fontSize: 14, lineHeight: 1.55,
                  border: "1px solid var(--line-strong)", borderRadius: 12, background: "var(--surface)", color: "var(--ink)" , resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn btn-primary"><I.Send size={14}/> Use This Version</button>
                <button className="btn btn-secondary"><I.Copy size={14}/> Copy Revised</button>
                <button className="btn btn-ghost"><I.Edit size={14}/> Edit Manually</button>
                <button className="btn btn-ghost"><I.ExternalLink size={14}/> Submit to ChatGPT</button>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: "var(--card-p)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Suggested Structured Version</div>
              <button className="btn btn-ghost" style={{ fontSize: 12 }}><I.Copy size={13}/> Copy</button>
            </div>
            <pre className="mono" style={{ margin: 0, padding: 16, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.7, overflow: "auto" }}>{structured}</pre>
          </div>
        </div>
      </main>
    </div>
  );
};

// 9. User Profile & Settings
const UserProfile = ({ onNav, sessionUser }) => {
  const [tweaks, setTweaks] = React.useState({ alertHigh: true, weeklyDigest: false, lowBanners: true });
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const SectionCard = ({ title, sub, children }) => (
    <div className="card" style={{ padding: "var(--card-p)" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: "var(--ink-4)", marginTop: 3 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );

  return (
    <div className="app-shell">
      <Sidebar roleScope="user" current="user-profile" onNavigate={onNav} sessionUser={sessionUser} />
      <main>
        <Topbar crumb="Personal" title="Profile & Settings" />
        <div className="content" style={{ display: "grid", gridTemplateColumns: "minmax(0, 720px)", justifyContent: "center", gap: 16 }}>
          <SectionCard title="Personal Information" sub="How you appear inside Hares AI.">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="field"><label>Full name</label><input defaultValue="Layla Al-Saud"/></div>
              <div className="field"><label>Email</label><input defaultValue="layla.alsaud@haresai.com" disabled style={{ color: "var(--ink-4)" }}/></div>
              <div className="field"><label>Organization</label><input defaultValue="Acme Corp" disabled style={{ color: "var(--ink-4)" }}/></div>
              <div className="field"><label>Department</label><input defaultValue="Engineering" disabled style={{ color: "var(--ink-4)" }}/></div>
            </div>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary">Save changes</button>
            </div>
          </SectionCard>

          <SectionCard title="Change Password" sub="Use a strong, unique password.">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="field" style={{ gridColumn: "1 / -1" }}><label>Current password</label><input type="password"/></div>
              <div className="field"><label>New password</label><input type="password"/></div>
              <div className="field"><label>Confirm new password</label><input type="password"/></div>
            </div>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary">Update password</button>
            </div>
          </SectionCard>

          <SectionCard title="Notification Preferences">
            {[
              ["alertHigh", "Email alerts for High Risk blocks", "Sent every time a high-risk prompt is blocked."],
              ["weeklyDigest", "Weekly activity summary", "Receive a Monday-morning email with last week's stats."],
            ].map(([k, label, hint]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>{hint}</div>
                </div>
                <Toggle checked={tweaks[k]} onChange={v => setTweaks(s => ({ ...s, [k]: v }))} />
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Extension Settings" sub="Synced with your browser extension.">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>Show Low Risk info banners</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>Display the small bottom-right toast for Low risk detections.</div>
              </div>
              <Toggle checked={tweaks.lowBanners} onChange={v => setTweaks(s => ({ ...s, lowBanners: v }))}/>
            </div>
          </SectionCard>

          <SectionCard title="Danger Zone" sub="Irreversible actions.">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>Delete my account</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>Permanently remove your account and all associated audit logs.</div>
              </div>
              <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}><I.Trash size={14}/> Delete account</button>
            </div>
          </SectionCard>
        </div>

        <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} width={460}>
          <div style={{ padding: 28 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--risk-high-soft)", color: "var(--risk-high)", display: "grid", placeItems: "center", marginBottom: 14 }}>
              <I.AlertTriangle size={20}/>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Delete your account?</div>
            <div style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.55, marginBottom: 18 }}>
              This will permanently delete your account, your activity history, and all preferences. This cannot be undone.
            </div>
            <div className="field" style={{ marginBottom: 18 }}>
              <label>Type <span className="mono">DELETE</span> to confirm</label>
              <input placeholder="DELETE" />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn btn-danger">Delete account</button>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
};

Object.assign(window, { UserDashboard, ActivityLog, BlockedMessages, PromptRevision, UserProfile });
