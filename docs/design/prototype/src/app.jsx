// App: routes between all 23 screens + Tweaks panel + screen switcher chrome.

const SCREENS = [
  { id: "landing", label: "1 Landing", group: "Public" },
  { id: "login", label: "2 Login", group: "Public" },
  { id: "register", label: "3 Register", group: "Public" },
  { id: "forgot", label: "4 Forgot", group: "Public" },
  { id: "user-dashboard", label: "5 Dashboard", group: "User" },
  { id: "user-activity", label: "6 Activity Log", group: "User" },
  { id: "user-blocked", label: "7 Blocked", group: "User" },
  { id: "user-revision", label: "8 Revision", group: "User" },
  { id: "user-profile", label: "9 Profile", group: "User" },
  { id: "dept-dashboard", label: "10 Dept Dashboard", group: "Dept Admin" },
  { id: "dept-log", label: "11 Dept Log", group: "Dept Admin" },
  { id: "dept-users", label: "12 Dept Users", group: "Dept Admin" },
  { id: "sys-dashboard", label: "13 Org Dashboard", group: "System Admin" },
  { id: "sys-log", label: "14 Full Log", group: "System Admin" },
  { id: "sys-users", label: "15 All Users", group: "System Admin" },
  { id: "sys-roles", label: "16 Roles", group: "System Admin" },
  { id: "sys-depts", label: "17 Departments", group: "System Admin" },
  { id: "sys-config", label: "18 Configuration", group: "System Admin" },
  { id: "ext-popup", label: "19 Popup", group: "Extension" },
  { id: "ext-high", label: "20 High Risk", group: "Extension" },
  { id: "ext-med", label: "21 Medium Risk", group: "Extension" },
  { id: "ext-low", label: "22 Low Risk", group: "Extension" },
  { id: "ext-revise", label: "23 Revise", group: "Extension" },
];

const App = () => {
  // Read initial screen from URL hash
  const initial = (() => {
    const h = (location.hash || "").replace("#", "");
    return SCREENS.find(s => s.id === h) ? h : "landing";
  })();
  const [screen, setScreen] = React.useState(initial);
  const session = SESSION.user;

  // Tweaks
  const tweakDefaults = window.__HARES_TWEAKS__ || { accent: "blue", density: "comfortable", theme: "light" };
  const [tweaks, setTweak] = (window.useTweaks || (() => [tweakDefaults, () => {}]))(tweakDefaults);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme || "light");
    document.documentElement.setAttribute("data-density", tweaks.density || "comfortable");
    document.documentElement.setAttribute("data-accent", tweaks.accent || "blue");
  }, [tweaks.theme, tweaks.density, tweaks.accent]);

  React.useEffect(() => {
    history.replaceState(null, "", "#" + screen);
    window.scrollTo({ top: 0 });
  }, [screen]);

  const onNav = (id) => setScreen(id);

  let content;
  switch (screen) {
    case "landing":         content = <LandingPage onNav={onNav}/>; break;
    case "login":           content = <LoginPage onNav={onNav}/>; break;
    case "register":        content = <RegisterPage onNav={onNav}/>; break;
    case "forgot":          content = <ForgotPasswordPage onNav={onNav}/>; break;
    case "user-dashboard":  content = <UserDashboard onNav={onNav} sessionUser={session}/>; break;
    case "user-activity":   content = <ActivityLog onNav={onNav} sessionUser={session}/>; break;
    case "user-blocked":    content = <BlockedMessages onNav={onNav} sessionUser={session}/>; break;
    case "user-revision":   content = <PromptRevision onNav={onNav} sessionUser={session}/>; break;
    case "user-profile":    content = <UserProfile onNav={onNav} sessionUser={session}/>; break;
    case "dept-dashboard":  content = <DeptDashboard onNav={onNav} sessionUser={session}/>; break;
    case "dept-log":        content = <DeptLogReview onNav={onNav} sessionUser={session}/>; break;
    case "dept-users":      content = <DeptUserManagement onNav={onNav} sessionUser={session}/>; break;
    case "sys-dashboard":   content = <SysDashboard onNav={onNav} sessionUser={session}/>; break;
    case "sys-log":         content = <SysFullLog onNav={onNav} sessionUser={session}/>; break;
    case "sys-users":       content = <SysUserManagement onNav={onNav} sessionUser={session}/>; break;
    case "sys-roles":       content = <SysRoleAssignment onNav={onNav} sessionUser={session}/>; break;
    case "sys-depts":       content = <SysDeptManagement onNav={onNav} sessionUser={session}/>; break;
    case "sys-config":      content = <SysConfig onNav={onNav} sessionUser={session}/>; break;
    case "ext-popup":       content = <ExtensionPopup/>; break;
    case "ext-high":        content = <HighRiskOverlay/>; break;
    case "ext-med":         content = <MediumRiskOverlay/>; break;
    case "ext-low":         content = <LowRiskToast/>; break;
    case "ext-revise":      content = <RevisionOverlay/>; break;
    default:                content = <LandingPage onNav={onNav}/>;
  }

  // Group screens for the switcher
  const groups = SCREENS.reduce((m, s) => ((m[s.group] = m[s.group] || []).push(s), m), {});

  return (
    <>
      {/* Floating screen index — sits above the design */}
      <div className="proto-switcher" data-screen-label="00 Switcher">
        {Object.entries(groups).map(([g, items], gi) => (
          <React.Fragment key={g}>
            {gi > 0 && <span className="divider"/>}
            {items.map(s => (
              <button key={s.id} data-active={screen === s.id} onClick={() => onNav(s.id)} title={`${g} · ${s.label}`}>
                {s.label}
              </button>
            ))}
          </React.Fragment>
        ))}
      </div>

      <div data-screen-label={SCREENS.find(s => s.id === screen)?.label || screen} style={{ paddingTop: 56 }}>
        {content}
      </div>

      {/* Tweaks panel */}
      {window.TweaksPanel && (
        <TweaksPanel title="Tweaks">
          <TweakSection label="Theme" />
          <TweakRadio label="Mode" value={tweaks.theme} options={["light", "dark"]} onChange={v => setTweak("theme", v)} />
          <TweakSection label="Accent" />
          <TweakRadio label="Color" value={tweaks.accent} options={["blue", "emerald", "violet", "cyan", "rose"]} onChange={v => setTweak("accent", v)} />
          <TweakSection label="Density" />
          <TweakRadio label="Spacing" value={tweaks.density} options={["comfortable", "compact"]} onChange={v => setTweak("density", v)} />
        </TweaksPanel>
      )}
    </>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
