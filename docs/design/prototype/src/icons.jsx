// Lightweight icon set — stroke 1.6, 16x16 viewport. Inline SVG.
const Icon = ({ d, size = 16, fill = "none", stroke = "currentColor", strokeWidth = 1.6, children, ...rest }) => (
  <svg
    viewBox="0 0 24 24"
    width={size} height={size}
    fill={fill} stroke={stroke}
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    {...rest}
  >
    {d ? <path d={d} /> : children}
  </svg>
);

const I = {
  Shield: (p) => <Icon {...p}><path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2.2 2.2L15 10.5" /></Icon>,
  Dashboard: (p) => <Icon {...p}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></Icon>,
  Activity: (p) => <Icon {...p}><path d="M3 12h4l2-7 4 14 2-7h6"/></Icon>,
  Block: (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="m5.5 5.5 13 13"/></Icon>,
  Edit: (p) => <Icon {...p}><path d="M3 21h4l11-11-4-4L3 17v4Z"/><path d="m14 6 4 4"/></Icon>,
  User: (p) => <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></Icon>,
  Users: (p) => <Icon {...p}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.4 3.5-5 6.5-5s5.5 1.6 6.5 5"/><circle cx="17" cy="9" r="3"/><path d="M16 16c2.5.3 4.5 1.8 5.5 4.5"/></Icon>,
  Org: (p) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Icon>,
  Logs: (p) => <Icon {...p}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></Icon>,
  Settings: (p) => <Icon {...p}><circle cx="12" cy="12" r="2.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></Icon>,
  Roles: (p) => <Icon {...p}><path d="M12 2 4 5v6c0 4.5 3 8 8 10 5-2 8-5.5 8-10V5l-8-3Z"/><path d="M12 8v6"/><path d="M9 11h6"/></Icon>,
  Departments: (p) => <Icon {...p}><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-7h6v7"/></Icon>,
  AlertTriangle: (p) => <Icon {...p}><path d="M12 3 2 21h20L12 3Z"/><path d="M12 10v5"/><circle cx="12" cy="18" r=".6" fill="currentColor"/></Icon>,
  Info: (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".6" fill="currentColor"/></Icon>,
  Check: (p) => <Icon {...p}><path d="m4 12 5 5L20 6"/></Icon>,
  X: (p) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18"/></Icon>,
  Plus: (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  Search: (p) => <Icon {...p}><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/></Icon>,
  Calendar: (p) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></Icon>,
  Filter: (p) => <Icon {...p}><path d="M3 5h18l-7 9v6l-4-2v-4L3 5Z"/></Icon>,
  Download: (p) => <Icon {...p}><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></Icon>,
  Copy: (p) => <Icon {...p}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></Icon>,
  Send: (p) => <Icon {...p}><path d="m4 12 17-9-6 18-3-7-8-2Z"/></Icon>,
  Logout: (p) => <Icon {...p}><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="m15 8 4 4-4 4"/><path d="M19 12H9"/></Icon>,
  Mail: (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></Icon>,
  Lock: (p) => <Icon {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></Icon>,
  Eye: (p) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></Icon>,
  Chevron: (p) => <Icon {...p}><path d="m6 9 6 6 6-6"/></Icon>,
  Right: (p) => <Icon {...p}><path d="m9 6 6 6-6 6"/></Icon>,
  Sparkle: (p) => <Icon {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></Icon>,
  Bolt: (p) => <Icon {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></Icon>,
  Globe: (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a13 13 0 0 1 0 18"/><path d="M12 3a13 13 0 0 0 0 18"/></Icon>,
  Puzzle: (p) => <Icon {...p}><path d="M14 3h-4v3a2 2 0 0 1-4 0V3H3v6h3a2 2 0 0 1 0 4H3v8h6v-3a2 2 0 0 1 4 0v3h6v-6h3a2 2 0 0 0 0-4h-3V3h-5Z"/></Icon>,
  Trash: (p) => <Icon {...p}><path d="M4 7h16M9 7V4h6v3"/><path d="M6 7v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7"/><path d="M10 11v7M14 11v7"/></Icon>,
  More: (p) => <Icon {...p}><circle cx="6" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18" cy="12" r="1.4" fill="currentColor"/></Icon>,
  Dot: (p) => <Icon {...p}><circle cx="12" cy="12" r="3" fill="currentColor"/></Icon>,
  ExternalLink: (p) => <Icon {...p}><path d="M14 4h6v6"/><path d="M10 14 20 4"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></Icon>,
  ArrowRight: (p) => <Icon {...p}><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></Icon>,
  ArrowLeft: (p) => <Icon {...p}><path d="M19 12H5"/><path d="m11 6-6 6 6 6"/></Icon>,
};

window.I = I;
