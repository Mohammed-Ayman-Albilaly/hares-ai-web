// Screens 10-12: Department Admin

const DeptDashboard = ({ onNav, sessionUser }) => {
  const topUsers = USERS.slice(0, 6);
  return (
    <div className="app-shell">
      <Sidebar roleScope="dept" current="dept-dashboard" onNavigate={onNav} sessionUser={sessionUser} />
      <main>
        <Topbar crumb="Department · Engineering" title="Department Dashboard" actions={
          <button className="btn btn-secondary"><I.Download size={14}/> Export report</button>
        }/>
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: "var(--section-gap)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <Stat label="Total users in dept." value="42" icon={I.Users}/>
            <Stat label="Prompts scanned (dept)" value="6,184" delta={11} icon={I.Activity}/>
            <Stat label="High risk incidents" value="58" delta={-12} icon={I.Block} accent/>
            <Stat label="Avg risk level" value="Low" icon={I.Shield}/>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
            <div className="card" style={{ padding: "var(--card-p)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Risk trend</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>Daily incidents · last 14 days</div>
                </div>
                <select style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line-strong)", background: "var(--surface)", color: "var(--ink-2)" }}><option>14 days</option><option>30 days</option></select>
              </div>
              <LineChart series={[
                { color: "#DC2626", data: [4,7,5,9,6,11,7,5,8,10,6,4,9,12], fill: true,
                  labels: Array.from({length:14}, (_,i) => `${i+1}`) },
                { color: "#D97706", data: [9,12,10,15,11,18,12,9,14,17,11,8,15,19], fill: true },
              ]} height={200}/>
              <div style={{ display: "flex", gap: 18, marginTop: 8 }}>
                <span className="legend-row"><span className="legend-dot" style={{ background: "#DC2626" }}/> High</span>
                <span className="legend-row"><span className="legend-dot" style={{ background: "#D97706" }}/> Medium</span>
              </div>
            </div>
            <div className="card" style={{ padding: "var(--card-p)" }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Platform usage</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>Prompts per platform</div>
              </div>
              <BarChart vertical={false} data={[
                { label: "ChatGPT", value: 3402, color: "#10A37F" },
                { label: "Gemini", value: 1841, color: "#4285F4" },
                { label: "Claude", value: 941, color: "#D97706" },
              ]} height={170}/>
            </div>
          </div>

          <Section title="Top risky users" sub="Users in your department with most flagged prompts">
            <div className="card" style={{ overflow: "hidden" }}>
              <table className="h-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th style={{ width: 130 }}>High risk</th>
                    <th style={{ width: 130 }}>Medium risk</th>
                    <th style={{ width: 160 }}>Last activity</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.map(u => (
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
                      <td><span className="h-pill risk-high">{u.highCount}</span></td>
                      <td><span className="h-pill risk-med">{u.medCount}</span></td>
                      <td style={{ color: "var(--ink-3)" }}>{fmtRel(u.lastActive)}</td>
                      <td><button className="btn btn-ghost" style={{ padding: "6px 10px" }}><I.Right size={14}/></button></td>
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

const DeptLogReview = ({ onNav, sessionUser }) => {
  return <ActivityLog onNav={onNav} sessionUser={sessionUser}
    title="Department Log Review" crumb="Department · Engineering"
    roleScope="dept" current="dept-log" />;
};

const DeptUserManagement = ({ onNav, sessionUser }) => {
  const list = USERS.filter(u => u.dept === "Engineering").slice(0, 14);
  const active = list.filter(u => u.status === "Active").length;
  const [confirmUser, setConfirmUser] = React.useState(null);

  return (
    <div className="app-shell">
      <Sidebar roleScope="dept" current="dept-users" onNavigate={onNav} sessionUser={sessionUser} />
      <main>
        <Topbar crumb="Department · Engineering" title="User Management — Engineering" actions={
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}><strong>{active}</strong> Active · <strong>{list.length - active}</strong> Inactive</span>
        }/>
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FilterBar>
            <SearchInput placeholder="Search by name or email…" />
            <Field icon={I.Filter} width={140}>All statuses <I.Chevron size={12}/></Field>
          </FilterBar>

          <div className="card" style={{ overflow: "hidden" }}>
            <table className="h-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 140 }}>Last active</th>
                  <th style={{ width: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{u.name.split(" ").map(s=>s[0]).slice(0,2).join("")}</div>
                        <span style={{ fontWeight: 500, color: "var(--ink)" }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ color: "var(--ink-3)" }}>{u.email}</td>
                    <td><StatusBadge status={u.status}/></td>
                    <td style={{ color: "var(--ink-3)" }}>{fmtRel(u.lastActive)}</td>
                    <td>
                      {u.status === "Active" ? (
                        <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setConfirmUser(u)}>Deactivate</button>
                      ) : (
                        <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12 }}>Activate</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Modal open={!!confirmUser} onClose={() => setConfirmUser(null)} width={440}>
          {confirmUser && (
            <div style={{ padding: 28 }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Deactivate {confirmUser.name}?</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.55, marginBottom: 20 }}>
                They will no longer be able to log in. You can reactivate at any time.
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setConfirmUser(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => setConfirmUser(null)}>Deactivate</button>
              </div>
            </div>
          )}
        </Modal>
      </main>
    </div>
  );
};

Object.assign(window, { DeptDashboard, DeptLogReview, DeptUserManagement });
