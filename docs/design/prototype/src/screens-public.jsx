// Screens 1-4: Landing, Login, Register, Forgot Password

const AuthShell = ({ children, footer = true }) => (
  <div style={{ minHeight: "100vh", background: "var(--bg)",
    display: "flex", flexDirection: "column", alignItems: "stretch" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px" }}>
      <Wordmark />
      <a href="#" style={{ fontSize: 13, color: "var(--ink-3)", textDecoration: "none", fontWeight: 500 }}>← Back to home</a>
    </div>
    <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "20px 16px 64px" }}>
      {children}
    </div>
    {footer && (
      <div style={{ textAlign: "center", padding: "0 0 28px", color: "var(--ink-4)", fontSize: 12 }}>
        © Hares AI 2026 · <a href="#" style={{ color: "inherit" }}>Privacy</a> · <a href="#" style={{ color: "inherit" }}>Terms</a>
      </div>
    )}
  </div>
);

// ---------- 1. Landing ----------
const LandingPage = ({ onNav }) => (
  <div style={{ minHeight: "100vh", background: "var(--surface)", color: "var(--ink)" }}>
    {/* Top nav */}
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "20px 48px", borderBottom: "1px solid var(--line)", background: "var(--surface)",
      position: "sticky", top: 0, zIndex: 4 }}>
      <Wordmark />
      <nav style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 13.5, color: "var(--ink-2)", fontWeight: 500 }}>
        <a href="#features" style={{ color: "inherit", textDecoration: "none" }}>Features</a>
        <a href="#how" style={{ color: "inherit", textDecoration: "none" }}>How It Works</a>
        <a href="#about" style={{ color: "inherit", textDecoration: "none" }}>About</a>
      </nav>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn btn-ghost" onClick={() => onNav("login")}>Log In</button>
        <button className="btn btn-primary" onClick={() => onNav("register")}>Sign Up</button>
      </div>
    </header>

    {/* Hero */}
    <section style={{ padding: "90px 48px 60px", maxWidth: 1240, margin: "0 auto",
      display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 56, alignItems: "center" }}>
      <div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
          padding: "5px 12px", borderRadius: 999,
          background: "var(--accent-soft)", color: "var(--accent-2)", fontSize: 12, fontWeight: 500 }}>
          <I.Shield size={13} /> Enterprise DLP for generative AI
        </div>
        <h1 style={{ margin: "20px 0 18px", fontSize: 64, lineHeight: 1.02, letterSpacing: "-0.025em",
          fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
          Protect your data <em style={{ fontStyle: "italic", color: "var(--accent)" }}>before</em> it leaves your hands.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--ink-3)", maxWidth: 560, margin: "0 0 28px" }}>
          Hares AI scans every prompt your team sends to ChatGPT, Gemini and Claude — flagging
          sensitive entities, blocking high-risk submissions, and offering safe rewrites in real time.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button className="btn btn-primary" style={{ padding: "12px 22px", fontSize: 14.5 }} onClick={() => onNav("register")}>
            Get Started Free <I.ArrowRight size={15} />
          </button>
          <button className="btn btn-ghost" style={{ padding: "12px 18px" }}>Learn More →</button>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        {/* Mock dashboard preview */}
        <div className="card" style={{ padding: 18, transform: "rotate(0.4deg)", boxShadow: "var(--shadow-lg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span className="browser-dot" style={{ background: "#FF5F56" }} />
            <span className="browser-dot" style={{ background: "#FFBD2E" }} />
            <span className="browser-dot" style={{ background: "#27C93F" }} />
            <div style={{ flex: 1, marginLeft: 8, fontSize: 11, color: "var(--ink-4)" }}>app.haresai.com/dashboard</div>
          </div>
          <div style={{ background: "var(--bg)", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: "var(--ink-4)", letterSpacing: ".06em", textTransform: "uppercase" }}>Today</div>
            <div className="serif" style={{ fontSize: 38, lineHeight: 1.05, marginTop: 4 }}>1,284 prompts scanned</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontSize: 11, color: "var(--ink-4)" }}>High risk blocked</div>
                <div className="serif" style={{ fontSize: 26 }}>17</div>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontSize: 11, color: "var(--ink-4)" }}>Medium warned</div>
                <div className="serif" style={{ fontSize: 26 }}>42</div>
              </div>
            </div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Saudi National ID detected", "high"],
                ["Customer email mentioned", "med"],
                ["Internal codename 'Atlas'", "low"],
              ].map(([t, sev], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                  background: "var(--surface)", borderRadius: 8, border: "1px solid var(--line)", fontSize: 12.5 }}>
                  <span className={`h-pill risk-${sev === "med" ? "med" : sev}`} style={{ padding: "2px 8px", fontSize: 10.5 }}>
                    {sev === "high" ? "HIGH" : sev === "med" ? "MED" : "LOW"}
                  </span>
                  <span style={{ flex: 1, color: "var(--ink-2)" }}>{t}</span>
                  <span style={{ color: "var(--ink-4)", fontSize: 11 }}>2m ago</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", bottom: -22, right: -16,
          background: "var(--brand-navy)", color: "white", width: 48, height: 48, borderRadius: "50%",
          boxShadow: "var(--shadow-lg)", display: "grid", placeItems: "center" }}>
          <I.Shield size={20} />
        </div>
      </div>
    </section>

    {/* Features */}
    <section id="features" style={{ padding: "60px 48px", background: "var(--surface-2)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: "var(--ink-4)", letterSpacing: ".1em", textTransform: "uppercase", textAlign: "center" }}>Why teams choose Hares AI</div>
        <h2 className="serif" style={{ fontSize: 40, textAlign: "center", margin: "10px 0 40px" }}>Three layers, one continuous defence.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {[
            { icon: I.Bolt, title: "Real-Time Detection", body: "Pattern + AI hybrid scanning catches sensitive entities the moment they're typed — without slowing the flow." },
            { icon: I.Shield, title: "Risk Classification", body: "Every prompt is graded High / Medium / Low / None and routed to the right enforcement action automatically." },
            { icon: I.Logs, title: "Audit Logs", body: "Every scan, decision and override is recorded — exportable, filterable, and ready for compliance reviews." },
          ].map((f, i) => (
            <div key={i} className="card" style={{ padding: 28 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10,
                background: "var(--accent-soft)", color: "var(--accent)",
                display: "grid", placeItems: "center", marginBottom: 18 }}>
                <f.icon size={20} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* How it works */}
    <section id="how" style={{ padding: "70px 48px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: "var(--ink-4)", letterSpacing: ".1em", textTransform: "uppercase", textAlign: "center" }}>How it works</div>
        <h2 className="serif" style={{ fontSize: 40, textAlign: "center", margin: "10px 0 50px" }}>From install to insight in under five minutes.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", gap: 16, alignItems: "stretch" }}>
          {[
            { step: "01", icon: I.Puzzle, title: "Install Extension", body: "Deploy the Hares AI browser extension to every employee via your IdP or MDM." },
            { step: "02", icon: I.Sparkle, title: "Prompt is Scanned", body: "Each outgoing prompt is parsed for sensitive entities — local-first, sub-100ms." },
            { step: "03", icon: I.Shield, title: "Risk is Flagged", body: "High blocks, Medium warns, Low informs. Users get a clean rewrite in one click." },
          ].map((s, i, arr) => (
            <React.Fragment key={i}>
              <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="serif" style={{ fontSize: 32, color: "var(--accent)" }}>{s.step}</span>
                  <s.icon size={22} stroke="var(--ink-3)" />
                </div>
                <div style={{ fontSize: 17, fontWeight: 600 }}>{s.title}</div>
                <div style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.55 }}>{s.body}</div>
              </div>
              {i < arr.length - 1 && (
                <div style={{ alignSelf: "center" }}>
                  <I.ArrowRight stroke="var(--ink-4)" size={20} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section style={{ padding: "60px 48px 100px" }}>
      <div className="card" style={{ maxWidth: 1180, margin: "0 auto", padding: 56,
        background: "var(--brand-navy)", color: "white", border: "none",
        display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 28, alignItems: "center" }}>
        <div>
          <h3 className="serif" style={{ fontSize: 38, lineHeight: 1.1, margin: "0 0 12px" }}>Stop leaks before they happen.</h3>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", lineHeight: 1.55, margin: 0 }}>
            14-day free trial. No credit card required. Self-serve onboarding.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-primary" style={{ padding: "13px 22px" }} onClick={() => onNav("register")}>
            Get Started Free <I.ArrowRight size={15} />
          </button>
          <button className="btn" style={{ background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.3)", padding: "13px 22px" }}>
            Book a demo
          </button>
        </div>
      </div>
    </section>

    {/* Footer */}
    <footer style={{ padding: "32px 48px", borderTop: "1px solid var(--line)",
      display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--ink-4)", fontSize: 12.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Wordmark sub={false} scale={0.85} />
        <span>© 2026 Hares AI. All rights reserved.</span>
      </div>
      <div style={{ display: "flex", gap: 22 }}>
        <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Privacy Policy</a>
        <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Terms of Use</a>
        <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Contact</a>
      </div>
    </footer>
  </div>
);

// ---------- 2. Login ----------
const LoginPage = ({ onNav }) => {
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [showErr, setShowErr] = React.useState(false);
  return (
    <AuthShell>
      <div className="card" style={{ width: 420, padding: 36 }}>
        <div style={{ display: "grid", placeItems: "center", marginBottom: 18 }}>
          <Logo size={42} />
        </div>
        <h2 style={{ textAlign: "center", margin: "0 0 6px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>Welcome back</h2>
        <p style={{ textAlign: "center", margin: "0 0 24px", color: "var(--ink-4)", fontSize: 13.5 }}>Log in to your Hares AI account.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label>Email</label>
            <input type="email" placeholder="your-email@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
            {showErr && !email && <div className="err">Email is required.</div>}
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} />
            {showErr && pw && <div className="err">Invalid credentials.</div>}
            <a href="#" style={{ alignSelf: "flex-end", fontSize: 12.5, color: "var(--accent)", textDecoration: "none" }}
               onClick={e => { e.preventDefault(); onNav("forgot"); }}>Forgot password?</a>
          </div>
          <button className="btn btn-primary" style={{ padding: "12px", marginTop: 4 }}
                  onClick={() => { if (!email || !pw) { setShowErr(true); return; } onNav("user-dashboard"); }}>Log In</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0 16px", color: "var(--ink-4)", fontSize: 11.5 }}>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          <span>OR</span>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>
        <button className="btn btn-secondary" style={{ width: "100%", padding: "12px" }}>
          <I.Globe size={15} /> Continue with Single Sign-On
        </button>
        <div style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: "var(--ink-3)" }}>
          Don't have an account? <a href="#" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}
            onClick={e => { e.preventDefault(); onNav("register"); }}>Sign Up</a>
        </div>
      </div>
    </AuthShell>
  );
};

// ---------- 3. Register ----------
const RegisterPage = ({ onNav }) => {
  const [pw, setPw] = React.useState("");
  const score = (() => {
    let s = 0;
    if (pw.length > 6) s++;
    if (pw.length > 10) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  })();
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong", "Excellent"];
  const colors = ["#DC2626", "#DC2626", "#D97706", "#D97706", "#16A34A", "#16A34A"];

  return (
    <AuthShell>
      <div className="card" style={{ width: 460, padding: 36 }}>
        <div style={{ display: "grid", placeItems: "center", marginBottom: 18 }}>
          <Logo size={42} />
        </div>
        <h2 style={{ textAlign: "center", margin: "0 0 6px", fontSize: 22, fontWeight: 600 }}>Create your account</h2>
        <p style={{ textAlign: "center", margin: "0 0 24px", color: "var(--ink-4)", fontSize: 13.5 }}>Free for 14 days. No card required.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-4)", fontWeight: 500 }}>Identity</div>
          <div className="field">
            <label>Full name</label>
            <input placeholder="Layla Al-Saud" />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" placeholder="your-email@gmail.com" />
          </div>

          <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-4)", fontWeight: 500, marginTop: 8 }}>Organization</div>
          <div className="field">
            <label>Organization</label>
            <select defaultValue=""><option value="" disabled>Select an organization…</option><option>Acme Corp</option><option>Riyadh Bank</option><option>Other (enter manually)</option></select>
          </div>

          <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-4)", fontWeight: 500, marginTop: 8 }}>Security</div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} />
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              {[0,1,2,3,4].map(i => (
                <div key={i} style={{ flex: 1, height: 4, borderRadius: 2,
                  background: i < score ? colors[score] : "var(--line)" }} />
              ))}
            </div>
            <div className="hint">{pw ? labels[score] : "Use 10+ characters with mixed case, a number and a symbol."}</div>
          </div>
          <div className="field">
            <label>Confirm password</label>
            <input type="password" />
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
            <input type="checkbox" style={{ marginTop: 3 }} />
            <span>I agree to the <a href="#" style={{ color: "var(--accent)", textDecoration: "none" }}>Terms of Use</a> and <a href="#" style={{ color: "var(--accent)", textDecoration: "none" }}>Privacy Policy</a>.</span>
          </label>

          <button className="btn btn-primary" style={{ padding: "12px", marginTop: 4 }} onClick={() => onNav("user-dashboard")}>Create Account</button>
        </div>

        <div style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: "var(--ink-3)" }}>
          Already have an account? <a href="#" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}
            onClick={e => { e.preventDefault(); onNav("login"); }}>Log In</a>
        </div>
      </div>
    </AuthShell>
  );
};

// ---------- 4. Forgot Password ----------
const ForgotPasswordPage = ({ onNav }) => {
  const [submitted, setSubmitted] = React.useState(false);
  return (
    <AuthShell>
      <div className="card" style={{ width: 420, padding: 36 }}>
        <div style={{ display: "grid", placeItems: "center", marginBottom: 18 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center" }}>
            {submitted ? <I.Check size={22} /> : <I.Mail size={22} />}
          </div>
        </div>

        {!submitted ? (
          <>
            <h2 style={{ textAlign: "center", margin: "0 0 6px", fontSize: 22, fontWeight: 600 }}>Reset your password</h2>
            <p style={{ textAlign: "center", margin: "0 0 24px", color: "var(--ink-4)", fontSize: 13.5 }}>Enter the email address associated with your account.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="field">
                <label>Email</label>
                <input type="email" placeholder="your-email@gmail.com" />
              </div>
              <button className="btn btn-primary" style={{ padding: "12px" }} onClick={() => setSubmitted(true)}>Send Reset Link</button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ textAlign: "center", margin: "0 0 6px", fontSize: 22, fontWeight: 600 }}>Check your inbox</h2>
            <p style={{ textAlign: "center", margin: "0 0 24px", color: "var(--ink-3)", fontSize: 13.5, lineHeight: 1.55 }}>
              A password reset link has been sent to your email. The link will expire in 30 minutes.
            </p>
            <button className="btn btn-secondary" style={{ width: "100%", padding: "12px" }} onClick={() => setSubmitted(false)}>Send another link</button>
          </>
        )}

        <div style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: "var(--ink-3)" }}>
          <a href="#" style={{ color: "var(--ink-3)", textDecoration: "none" }} onClick={e => { e.preventDefault(); onNav("login"); }}>← Back to Login</a>
        </div>
      </div>
    </AuthShell>
  );
};

Object.assign(window, { LandingPage, LoginPage, RegisterPage, ForgotPasswordPage });
