// Shared building blocks: Logo, Sidebar, Topbar, Badge, Card, Stat, Filter bar, Modal, Toast

const Logo = ({ size = 28, mono = false }) => (
  <div className="mark" style={{ width: size, height: size, borderRadius: 8, display: "grid", placeItems: "center",
    background: mono ? "transparent" : "var(--brand-navy)",
    color: mono ? "var(--ink)" : "white",
    border: mono ? "1px solid var(--line-strong)" : "none",
  }}>
    <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Z"/>
      <circle cx="12" cy="11" r="2.2" fill="currentColor" stroke="none"/>
      <path d="M12 13.2v3.4M9.6 11h-2M16.4 11h-2M10.4 9 9 7.6M13.6 9l1.4-1.4"/>
    </svg>
  </div>
);

const Wordmark = ({ scale = 1, sub = true }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <Logo size={28 * scale} />
    <div style={{ lineHeight: 1.05 }}>
      <div style={{ fontWeight: 600, fontSize: 15 * scale, letterSpacing: "-0.01em", color: "var(--ink)" }}>Hares AI</div>
      {sub && <div style={{ fontSize: 10 * scale, color: "var(--ink-4)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 1 }}>Data Leak Prevention</div>}
    </div>
  </div>
);

const RiskBadge = ({ level }) => {
  const map = { High: "risk-high", Medium: "risk-med", Low: "risk-low", None: "risk-none" };
  const dot = { High: "#DC2626", Medium: "#D97706", Low: "#2563EB", None: "#16A34A" };
  return (
    <span className={`h-pill ${map[level]}`}>
      <span className="dot" style={{ background: dot[level] }} />
      {level}
    </span>
  );
};

const RoleBadge = ({ role }) => {
  const map = { "System Admin": "role-sysadmin", "Department Admin": "role-deptadmin", "User": "role-user" };
  return <span className={`h-pill ${map[role]}`}>{role}</span>;
};

const StatusBadge = ({ status }) => (
  <span className={`h-pill ${status === "Active" ? "status-active" : "status-inactive"}`}>
    <span className="dot" style={{ background: status === "Active" ? "#16A34A" : "#DC2626" }} />
    {status}
  </span>
);

const ActionBadge = ({ action }) => {
  const c = action === "Blocked" ? "risk-high" : action === "Warned" ? "risk-med" : action === "Submitted" ? "risk-low" : "risk-none";
  return <span className={`h-pill ${c}`}>{action}</span>;
};

// ----------- Sidebar / Topbar -----------

const NAV_BY_ROLE = {
  user: [
    { id: "user-dashboard", label: "Dashboard", icon: "Dashboard" },
    { id: "user-activity", label: "Activity Log", icon: "Activity" },
    { id: "user-blocked", label: "Blocked Messages", icon: "Block" },
    { id: "user-revision", label: "Prompt Revision", icon: "Edit" },
    { id: "user-profile", label: "Profile & Settings", icon: "Settings" },
  ],
  dept: [
    { id: "dept-dashboard", label: "Department Dashboard", icon: "Dashboard" },
    { id: "dept-log", label: "Department Log Review", icon: "Logs" },
    { id: "dept-users", label: "User Management", icon: "Users" },
  ],
  sys: [
    { id: "sys-dashboard", label: "Org Dashboard", icon: "Dashboard" },
    { id: "sys-log", label: "Full Log Review", icon: "Logs" },
    { id: "sys-users", label: "User Management", icon: "Users" },
    { id: "sys-roles", label: "Role Assignment", icon: "Roles" },
    { id: "sys-depts", label: "Department Management", icon: "Departments" },
    { id: "sys-config", label: "System Configuration", icon: "Settings" },
  ],
};

const ROLE_LABEL = { user: "Personal", dept: "Department Admin", sys: "System Admin" };

const Sidebar = ({ roleScope, current, onNavigate, sessionUser }) => {
  const items = NAV_BY_ROLE[roleScope];
  return (
    <aside className="sidebar">
      <div className="brand" style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 18 }}>
        <Logo />
        <div style={{ lineHeight: 1.1 }}>
          <div className="name">Hares AI</div>
          <div className="sub">DLP for AI</div>
        </div>
      </div>

      <div className="nav-section-label">{ROLE_LABEL[roleScope]}</div>
      {items.map(it => {
        const Ic = I[it.icon];
        return (
          <div key={it.id}
               className="nav-link"
               data-active={current === it.id}
               onClick={() => onNavigate(it.id)}>
            <Ic />
            <span>{it.label}</span>
          </div>
        );
      })}

      <div style={{ flex: 1 }} />

      <div className="nav-section-label">Switch role view</div>
      {[["user","Normal User"],["dept","Dept Admin"],["sys","System Admin"]].map(([k, label]) => (
        <div key={k}
             className="nav-link"
             data-active={roleScope === k}
             onClick={() => {
               const first = NAV_BY_ROLE[k][0].id;
               onNavigate(first);
             }}>
          <I.User />
          <span>{label}</span>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 8px 4px", borderTop: "1px solid var(--line)", marginTop: 8 }}>
        <div className="avatar">{(sessionUser?.name || "L A").split(" ").map(s=>s[0]).slice(0,2).join("")}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sessionUser?.name || "Layla Al-Saud"}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sessionUser?.email || "layla@haresai.com"}</div>
        </div>
      </div>
    </aside>
  );
};

const Topbar = ({ crumb, title, actions }) => (
  <div className="topbar">
    <div>
      {crumb && <div className="crumb">{crumb}</div>}
      <div className="title">{title}</div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {actions}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px 5px 5px", borderRadius: 999, border: "1px solid var(--line)" }}>
        <div className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>LA</div>
        <span style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 500 }}>Layla</span>
        <I.Chevron size={14} stroke="var(--ink-4)" />
      </div>
    </div>
  </div>
);

// ----------- Stat card -----------

const Stat = ({ label, value, delta, icon: Ic, accent = false }) => (
  <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 500 }}>{label}</div>
      {Ic && (
        <div style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center",
          background: accent ? "var(--accent-soft)" : "var(--surface-3)",
          color: accent ? "var(--accent)" : "var(--ink-3)" }}>
          <Ic size={15} />
        </div>
      )}
    </div>
    <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)", fontFamily: "'Instrument Serif', serif" }}>
      <span className="serif" style={{ fontSize: 36, fontWeight: 400 }}>{value}</span>
    </div>
    {delta !== undefined && (
      <div style={{ fontSize: 12, color: delta >= 0 ? "#16A34A" : "#DC2626" }}>
        {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs. last week
      </div>
    )}
  </div>
);

// ----------- Filter Bar -----------

const FilterBar = ({ children }) => (
  <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
    {children}
  </div>
);

const Field = ({ icon: Ic, children, width }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
    border: "1px solid var(--line-strong)", borderRadius: 8,
    background: "var(--surface)", minWidth: width || 140, fontSize: 13, color: "var(--ink-2)" }}>
    {Ic && <Ic size={14} stroke="var(--ink-4)" />}
    {children}
  </div>
);

const SearchInput = ({ placeholder = "Search…" }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
    border: "1px solid var(--line-strong)", borderRadius: 8,
    background: "var(--surface)", flex: 1, minWidth: 220, fontSize: 13 }}>
    <I.Search size={14} stroke="var(--ink-4)" />
    <input style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 13, color: "var(--ink)" }} placeholder={placeholder} />
  </div>
);

// ----------- Toggle -----------

const Toggle = ({ checked, onChange, size = "md" }) => {
  const w = size === "sm" ? 32 : 38;
  const h = size === "sm" ? 18 : 22;
  const k = size === "sm" ? 14 : 18;
  return (
    <button type="button"
      onClick={() => onChange && onChange(!checked)}
      style={{
        position: "relative",
        width: w, height: h, borderRadius: 999,
        background: checked ? "var(--accent)" : "var(--line-strong)",
        border: "none", padding: 0, transition: "background .12s",
      }}>
      <div style={{
        position: "absolute", top: 2, left: checked ? w - k - 2 : 2,
        width: k, height: k, borderRadius: "50%", background: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.18)", transition: "left .14s ease",
      }} />
    </button>
  );
};

// ----------- Modal -----------

const Modal = ({ open, onClose, children, width = 540 }) => {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 14, 28, 0.55)", display: "grid", placeItems: "center", zIndex: 60, animation: "fadeIn .14s ease" }}
         onClick={onClose}>
      <div className="card" onClick={e => e.stopPropagation()}
           style={{ width, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 64px)", overflow: "auto", animation: "popIn .14s ease", boxShadow: "var(--shadow-lg)" }}>
        {children}
      </div>
    </div>
  );
};

// ----------- Section heading -----------
const Section = ({ title, sub, children, actions }) => (
  <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--ink)" }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: "var(--ink-4)", marginTop: 3 }}>{sub}</div>}
      </div>
      {actions}
    </div>
    {children}
  </section>
);

// ----------- Highlighted prompt body -----------
const HighlightedPrompt = ({ text, entities }) => {
  if (!entities?.length) return <span>{text}</span>;
  const parts = [];
  let cursor = 0;
  const matches = [];
  entities.forEach(([word, , sev]) => {
    const idx = text.indexOf(word);
    if (idx !== -1) matches.push([idx, word, sev]);
  });
  matches.sort((a, b) => a[0] - b[0]);
  matches.forEach(([idx, word, sev], i) => {
    if (idx > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, idx)}</span>);
    parts.push(<mark key={`m${i}`} className={`flag-${sev}`}>{word}</mark>);
    cursor = idx + word.length;
  });
  if (cursor < text.length) parts.push(<span key="end">{text.slice(cursor)}</span>);
  return <>{parts}</>;
};

Object.assign(window, {
  Logo, Wordmark, RiskBadge, RoleBadge, StatusBadge, ActionBadge,
  Sidebar, Topbar, Stat, FilterBar, Field, SearchInput, Toggle, Modal, Section, HighlightedPrompt,
  NAV_BY_ROLE, ROLE_LABEL,
});
