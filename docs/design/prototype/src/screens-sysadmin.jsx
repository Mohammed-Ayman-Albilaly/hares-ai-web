// Screens 13-18: System Admin

const SysDashboard = ({ onNav, sessionUser }) => {
  const recentHigh = ACTIVITY.filter(a => a.risk === "High").slice(0, 8);
  return (
    <div className="app-shell">
      <Sidebar roleScope="sys" current="sys-dashboard" onNavigate={onNav} sessionUser={sessionUser} />
      <main>
        <Topbar crumb="Organization" title="Org-wide Dashboard" actions={
          <button className="btn btn-secondary"><I.Download size={14}/> Export report</button>
        }/>
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: "var(--section-gap)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <Stat label="Total users" value="284" icon={I.Users}/>
            <Stat label="Total prompts (org)" value="38,217" delta={9} icon={I.Activity}/>
            <Stat label="High risk incidents" value="412" delta={-7} icon={I.Block} accent/>
            <Stat label="Departments" value="6" icon={I.Departments}/>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
            <div className="card" style={{ padding: "var(--card-p)" }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Risk distribution by department</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>Stacked: High · Medium · Low · None</div>
              </div>
              <StackedBar data={[
                { label: "Engineering", values: [22, 41, 80, 380] },
                { label: "Finance",     values: [38, 62, 70, 240] },
                { label: "Customer Ops", values: [14, 28, 60, 290] },
                { label: "Legal",       values: [9,  19, 30, 150] },
                { label: "People",      values: [4,  10, 22, 130] },
                { label: "Marketing",   values: [6,  18, 44, 210] },
              ]} />
              <div style={{ display: "flex", gap: 18, marginTop: 8, flexWrap: "wrap" }}>
                <span className="legend-row"><span className="legend-dot" style={{ background: "#DC2626" }}/> High</span>
                <span className="legend-row"><span className="legend-dot" style={{ background: "#D97706" }}/> Medium</span>
                <span className="legend-row"><span className="legend-dot" style={{ background: "#2563EB" }}/> Low</span>
                <span className="legend-row"><span className="legend-dot" style={{ background: "#16A34A" }}/> None</span>
              </div>
            </div>
            <div className="card" style={{ padding: "var(--card-p)" }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Org-wide risk trend</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>30-day daily incidents</div>
              </div>
              <LineChart series={[
                { color: "#DC2626", data: [12,18,14,22,16,28,19,15,21,25,18,12,24,30,18,22,16,28,19,14,20,26,17,11,23,27,20,15,18,22], fill: true,
                  labels: ["1","","","","","","","","10","","","","","","","","","","","20","","","","","","","","","","30"] },
              ]} height={210}/>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 16 }}>
            <Section title="Top risky departments">
              <div className="card" style={{ overflow: "hidden" }}>
                <table className="h-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th style={{ width: 110 }}>High</th>
                      <th style={{ width: 110 }}>Medium</th>
                      <th style={{ width: 130 }}>Total scans</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Finance", 38, 62, 410],
                      ["Engineering", 22, 41, 523],
                      ["Customer Ops", 14, 28, 392],
                      ["Marketing", 6, 18, 278],
                      ["Legal", 9, 19, 208],
                      ["People", 4, 10, 166],
                    ].map(([dept, h, m, t]) => (
                      <tr key={dept}>
                        <td style={{ fontWeight: 500, color: "var(--ink)" }}>{dept}</td>
                        <td><span className="h-pill risk-high">{h}</span></td>
                        <td><span className="h-pill risk-med">{m}</span></td>
                        <td style={{ color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{t}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
            <Section title="Recent high-risk incidents" sub="Last 8 org-wide blocks">
              <div className="card" style={{ padding: 8, maxHeight: 360, overflow: "auto" }}>
                {recentHigh.map(r => (
                  <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, borderBottom: "1px solid var(--line)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--risk-high-soft)", color: "var(--risk-high)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                      <I.Block size={14}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.preview}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 3 }}>
                        {r.user} · {r.dept} · {r.platform} · {fmtRel(r.ts)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </main>
    </div>
  );
};

// 14. Full Log Review
const SysFullLog = ({ onNav, sessionUser }) => {
  const [selected, setSelected] = React.useState(new Set());
  const rows = ACTIVITY.slice(0, 24);
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  return (
    <div className="app-shell">
      <Sidebar roleScope="sys" current="sys-log" onNavigate={onNav} sessionUser={sessionUser} />
      <main>
        <Topbar crumb="Organization" title="Full Activity Log" actions={
          <button className="btn btn-secondary"><I.Download size={14}/> Export CSV</button>
        }/>
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FilterBar>
            <Field icon={I.Departments} width={140}>All departments <I.Chevron size={12}/></Field>
            <Field icon={I.User} width={140}>All users <I.Chevron size={12}/></Field>
            <Field icon={I.Calendar} width={170}>Last 30 days <I.Chevron size={12}/></Field>
            <Field icon={I.Globe} width={140}>All platforms <I.Chevron size={12}/></Field>
            <Field icon={I.Filter} width={140}>All risk <I.Chevron size={12}/></Field>
            <SearchInput placeholder="Search prompt text…" />
          </FilterBar>

          {selected.size > 0 && (
            <div className="card" style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, background: "var(--accent-soft)", borderColor: "var(--accent)" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--accent-2)" }}>{selected.size} selected</span>
              <div style={{ flex: 1 }}/>
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }}><I.Check size={13}/> Mark Reviewed</button>
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }}><I.AlertTriangle size={13}/> Flag for Follow-up</button>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 8px" }} onClick={() => setSelected(new Set())}><I.X size={13}/></button>
            </div>
          )}

          <div className="card" style={{ overflow: "auto" }}>
            <table className="h-table" style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" onChange={e => setSelected(new Set(e.target.checked ? rows.map(r => r.id) : []))} />
                  </th>
                  <th style={{ width: 150 }}>Timestamp</th>
                  <th style={{ width: 130 }}>Department</th>
                  <th style={{ width: 150 }}>User</th>
                  <th style={{ width: 100 }}>Platform</th>
                  <th>Prompt Preview</th>
                  <th style={{ width: 100 }}>Risk</th>
                  <th style={{ width: 110 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                    <td style={{ color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{fmtDate(r.ts)}</td>
                    <td>{r.dept}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>{r.user.split(" ").map(s=>s[0]).slice(0,2).join("")}</div>
                        <span style={{ fontSize: 13 }}>{r.user}</span>
                      </div>
                    </td>
                    <td>{r.platform}</td>
                    <td style={{ color: "var(--ink-2)", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.preview}</td>
                    <td><RiskBadge level={r.risk}/></td>
                    <td><ActionBadge action={r.action}/></td>
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

// 15. User Management — All Users
const SysUserManagement = ({ onNav, sessionUser }) => {
  const [editing, setEditing] = React.useState(null);
  const [adding, setAdding] = React.useState(false);
  return (
    <div className="app-shell">
      <Sidebar roleScope="sys" current="sys-users" onNavigate={onNav} sessionUser={sessionUser} />
      <main>
        <Topbar crumb="Organization" title="User Management" actions={
          <button className="btn btn-primary" onClick={() => setAdding(true)}><I.Plus size={14}/> Add User</button>
        }/>
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FilterBar>
            <Field icon={I.Departments} width={140}>All departments <I.Chevron size={12}/></Field>
            <Field icon={I.Roles} width={140}>All roles <I.Chevron size={12}/></Field>
            <Field icon={I.Filter} width={140}>All statuses <I.Chevron size={12}/></Field>
            <SearchInput placeholder="Search by name or email…" />
          </FilterBar>

          <div className="card" style={{ overflow: "hidden" }}>
            <table className="h-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th style={{ width: 220 }}>Email</th>
                  <th style={{ width: 130 }}>Department</th>
                  <th style={{ width: 150 }}>Role</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 130 }}>Last active</th>
                  <th style={{ width: 130 }}></th>
                </tr>
              </thead>
              <tbody>
                {USERS.slice(0, 16).map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{u.name.split(" ").map(s=>s[0]).slice(0,2).join("")}</div>
                        <span style={{ fontWeight: 500, color: "var(--ink)" }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ color: "var(--ink-3)" }}>{u.email}</td>
                    <td>{u.dept}</td>
                    <td><RoleBadge role={u.role}/></td>
                    <td><StatusBadge status={u.status}/></td>
                    <td style={{ color: "var(--ink-3)" }}>{fmtRel(u.lastActive)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setEditing(u)}>Edit</button>
                        <button className="btn btn-ghost" style={{ padding: "6px 8px" }}><I.More size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Modal open={!!editing} onClose={() => setEditing(null)} width={460}>
          {editing && (
            <div style={{ padding: 28 }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 18 }}>Edit user</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="field"><label>Name</label><input defaultValue={editing.name}/></div>
                <div className="field"><label>Email</label><input defaultValue={editing.email} disabled style={{ color: "var(--ink-4)" }}/></div>
                <div className="field"><label>Department</label>
                  <select defaultValue={editing.dept}>{DEPTS.map(d => <option key={d}>{d}</option>)}</select>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>Account active</div>
                  <Toggle checked={editing.status === "Active"} onChange={() => {}}/>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
                <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => setEditing(null)}>Save changes</button>
              </div>
            </div>
          )}
        </Modal>

        <Modal open={adding} onClose={() => setAdding(false)} width={460}>
          <div style={{ padding: 28 }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 18 }}>Add user</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field"><label>Full name</label><input placeholder="e.g. Sara Othman"/></div>
              <div className="field"><label>Work email</label><input type="email" placeholder="sara.othman@haresai.com"/></div>
              <div className="field"><label>Department</label>
                <select>{DEPTS.map(d => <option key={d}>{d}</option>)}</select>
              </div>
              <div className="field"><label>Initial role</label>
                <select><option>User</option><option>Department Admin</option><option>System Admin</option></select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button className="btn btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => setAdding(false)}>Send invitation</button>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
};

// 16. Role Assignment
const SysRoleAssignment = ({ onNav, sessionUser }) => {
  const [confirmUpgrade, setConfirmUpgrade] = React.useState(null);
  const [pending, setPending] = React.useState({}); // userId -> newRole
  const setRole = (u, newRole) => {
    if (newRole === "System Admin" && u.role !== "System Admin") setConfirmUpgrade({ user: u, role: newRole });
    else setPending(p => ({ ...p, [u.id]: newRole }));
  };
  return (
    <div className="app-shell">
      <Sidebar roleScope="sys" current="sys-roles" onNavigate={onNav} sessionUser={sessionUser} />
      <main>
        <Topbar crumb="Organization" title="Role Assignment" actions={
          <>
            <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{Object.keys(pending).length} pending changes</span>
            <button className="btn btn-primary" disabled={!Object.keys(pending).length} onClick={() => setPending({})}>Apply all changes</button>
          </>
        }/>
        <div className="content" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <FilterBar>
              <SearchInput placeholder="Search users…" />
            </FilterBar>
            <div className="card" style={{ overflow: "hidden" }}>
              <table className="h-table">
                <thead>
                  <tr><th>User</th><th style={{ width: 130 }}>Current</th><th style={{ width: 220 }}>New role</th><th style={{ width: 110 }}></th></tr>
                </thead>
                <tbody>
                  {USERS.slice(0, 14).map(u => {
                    const newR = pending[u.id];
                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{u.name.split(" ").map(s=>s[0]).slice(0,2).join("")}</div>
                            <div>
                              <div style={{ fontWeight: 500, color: "var(--ink)" }}>{u.name}</div>
                              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td><RoleBadge role={u.role}/></td>
                        <td>
                          <select value={newR || u.role} onChange={e => setRole(u, e.target.value)}
                                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line-strong)", background: "var(--surface)", color: "var(--ink)", fontSize: 13 }}>
                            <option>User</option>
                            <option>Department Admin</option>
                            <option>System Admin</option>
                          </select>
                        </td>
                        <td>{newR && newR !== u.role && <span className="h-pill risk-low" style={{ fontSize: 10.5 }}>changed</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Section title="Recent role changes" sub="Last 30 days">
            <div className="card" style={{ padding: 8 }}>
              {[
                ["Reem Karim", "User", "Department Admin", "Layla Al-Saud", "2h ago"],
                ["Bilal Halabi", "Department Admin", "User", "Layla Al-Saud", "Yesterday"],
                ["Yusuf Najjar", "User", "Department Admin", "Layla Al-Saud", "3d ago"],
                ["Faisal Younis", "User", "User", "Layla Al-Saud", "1w ago"],
              ].map(([n, oldR, newR, by, when], i) => (
                <div key={i} style={{ padding: 12, borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, color: "var(--ink)" }}>{n}</span>
                    <RoleBadge role={oldR}/>
                    <I.Right size={12} stroke="var(--ink-4)"/>
                    <RoleBadge role={newR}/>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-4)" }}>by {by} · {when}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <Modal open={!!confirmUpgrade} onClose={() => setConfirmUpgrade(null)} width={440}>
          {confirmUpgrade && (
            <div style={{ padding: 28 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", marginBottom: 14 }}>
                <I.Shield size={20}/>
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Grant System Admin access?</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.55, marginBottom: 18 }}>
                This will grant <strong>{confirmUpgrade.user.name}</strong> full administrative access — including audit logs, role assignment and detection-rule configuration. Confirm?
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setConfirmUpgrade(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => { setPending(p => ({ ...p, [confirmUpgrade.user.id]: "System Admin" })); setConfirmUpgrade(null); }}>Confirm</button>
              </div>
            </div>
          )}
        </Modal>
      </main>
    </div>
  );
};

// 17. Department Management
const SysDeptManagement = ({ onNav, sessionUser }) => {
  const [adding, setAdding] = React.useState(false);
  const depts = [
    ["Engineering", 42, "Layla Al-Saud", "Mar 2024"],
    ["Finance", 28, "Khalid Mansour", "Mar 2024"],
    ["Customer Ops", 36, "Reem Karim", "Apr 2024"],
    ["Legal", 14, "Hadi Sabbagh", "May 2024"],
    ["People", 18, "Maya Rahman", "Jul 2024"],
    ["Marketing", 22, "Sara Othman", "Sep 2024"],
  ];
  return (
    <div className="app-shell">
      <Sidebar roleScope="sys" current="sys-depts" onNavigate={onNav} sessionUser={sessionUser} />
      <main>
        <Topbar crumb="Organization" title="Departments" actions={
          <button className="btn btn-primary" onClick={() => setAdding(true)}><I.Plus size={14}/> Add Department</button>
        }/>
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="h-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th style={{ width: 130 }}>Members</th>
                  <th style={{ width: 220 }}>Admin</th>
                  <th style={{ width: 130 }}>Created</th>
                  <th style={{ width: 140 }}></th>
                </tr>
              </thead>
              <tbody>
                {depts.map(([name, count, admin, created], i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-3)", color: "var(--ink-3)", display: "grid", placeItems: "center" }}>
                          <I.Departments size={14}/>
                        </div>
                        <span style={{ fontWeight: 500, color: "var(--ink)" }}>{name}</span>
                      </div>
                    </td>
                    <td style={{ color: "var(--ink-3)" }}>{count} users</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>{admin.split(" ").map(s=>s[0]).slice(0,2).join("")}</div>
                        <span style={{ fontSize: 13 }}>{admin}</span>
                      </div>
                    </td>
                    <td style={{ color: "var(--ink-3)" }}>{created}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }}>Edit</button>
                        <button className="btn btn-ghost" style={{ padding: "6px 8px" }} title="Delete"><I.Trash size={14} stroke="var(--risk-high)"/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Modal open={adding} onClose={() => setAdding(false)} width={440}>
          <div style={{ padding: 28 }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 18 }}>Add department</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field"><label>Department name</label><input placeholder="e.g. Compliance"/></div>
              <div className="field"><label>Assign department admin</label>
                <select><option>Search users…</option>{USERS.slice(0, 8).map(u => <option key={u.id}>{u.name}</option>)}</select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button className="btn btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => setAdding(false)}>Create department</button>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
};

// 18. System Configuration
const SysConfig = ({ onNav, sessionUser }) => {
  const [rules, setRules] = React.useState([
    { name: "Saudi National ID", pattern: "^[12]\\d{9}$", level: "High", on: true },
    { name: "Credit Card (PAN)", pattern: "\\b\\d{4}[ -]?\\d{4}[ -]?\\d{4}[ -]?\\d{4}\\b", level: "High", on: true },
    { name: "IBAN", pattern: "[A-Z]{2}\\d{2}[A-Z0-9]{4,30}", level: "High", on: true },
    { name: "Email address", pattern: "[\\w.-]+@[\\w-]+\\.[\\w.-]+", level: "Medium", on: true },
    { name: "Phone (intl)", pattern: "\\+?\\d[\\d\\s-]{7,}\\d", level: "Medium", on: true },
    { name: "Internal codename", pattern: "(Atlas|Helios|Sirius)", level: "Low", on: false },
  ]);
  const [thresholds, setThresholds] = React.useState({ high: 80, med: 55, low: 25 });
  const [platforms, setPlatforms] = React.useState({ ChatGPT: true, Gemini: true, Claude: true });
  const [gemini, setGemini] = React.useState(true);

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
      <Sidebar roleScope="sys" current="sys-config" onNavigate={onNav} sessionUser={sessionUser} />
      <main>
        <Topbar crumb="Organization" title="System Configuration"/>
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 100 }}>
          <SectionCard title="Detection Rules" sub="Regex patterns evaluated against every outgoing prompt.">
            <div className="card" style={{ overflow: "hidden", marginBottom: 12 }}>
              <table className="h-table">
                <thead>
                  <tr><th>Pattern name</th><th>Pattern</th><th style={{ width: 110 }}>Risk</th><th style={{ width: 90 }}>Status</th><th style={{ width: 130 }}></th></tr>
                </thead>
                <tbody>
                  {rules.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500, color: "var(--ink)" }}>{r.name}</td>
                      <td><code className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{r.pattern}</code></td>
                      <td><RiskBadge level={r.level}/></td>
                      <td><Toggle size="sm" checked={r.on} onChange={v => setRules(rs => rs.map((x, j) => j === i ? { ...x, on: v } : x))}/></td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }}>Edit</button>
                          <button className="btn btn-ghost" style={{ padding: "6px 8px" }} title="Delete"><I.Trash size={14} stroke="var(--risk-high)"/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn btn-secondary"><I.Plus size={14}/> Add rule</button>
          </SectionCard>

          <SectionCard title="Risk Thresholds" sub="Confidence score required to assign each level.">
            {[
              ["high", "High", "var(--risk-high)"],
              ["med", "Medium", "var(--risk-med)"],
              ["low", "Low", "var(--risk-low)"],
            ].map(([k, label, color]) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "120px 1fr 60px", alignItems: "center", gap: 18, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{label}</div>
                <input type="range" min="0" max="100" value={thresholds[k]} onChange={e => setThresholds(s => ({ ...s, [k]: +e.target.value }))}
                  style={{ accentColor: color, width: "100%" }}/>
                <div className="mono" style={{ fontSize: 13, color: "var(--ink-2)", textAlign: "right" }}>{thresholds[k]}%</div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Supported Platforms" sub="Toggle Hares AI enforcement per platform.">
            {Object.entries(platforms).map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface-3)", color: "var(--ink-3)", display: "grid", placeItems: "center" }}>
                    <I.Globe size={14}/>
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>{k}</span>
                </div>
                <Toggle checked={v} onChange={nv => setPlatforms(s => ({ ...s, [k]: nv }))}/>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="AI Fallback (Gemini API)" sub="Use Gemini for secondary semantic analysis when regex is uncertain.">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0 18px" }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>Enable secondary analysis</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>Adds ~200ms latency. Calls billable via your Gemini API key.</div>
              </div>
              <Toggle checked={gemini} onChange={setGemini}/>
            </div>
            <div className="field"><label>Gemini API key</label>
              <input type="password" defaultValue="aiza-XXXX-XXXX-XXXX-XXXX-XXXX" disabled={!gemini}/>
            </div>
          </SectionCard>
        </div>

        <div style={{ position: "sticky", bottom: 0, background: "var(--surface)",
          borderTop: "1px solid var(--line)", padding: "14px 32px",
          display: "flex", justifyContent: "flex-end", gap: 10, zIndex: 4 }}>
          <button className="btn btn-secondary">Discard</button>
          <button className="btn btn-primary"><I.Check size={14}/> Save Configuration</button>
        </div>
      </main>
    </div>
  );
};

Object.assign(window, { SysDashboard, SysFullLog, SysUserManagement, SysRoleAssignment, SysDeptManagement, SysConfig });
