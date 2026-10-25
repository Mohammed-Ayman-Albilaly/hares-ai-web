// Mock data — keeps screens looking real and consistent

const PLATFORMS = ["ChatGPT", "Gemini", "Claude"];
const RISK = ["High", "Medium", "Low", "None"];
const DEPTS = ["Engineering", "Finance", "Customer Ops", "Legal", "People", "Marketing"];
const FIRST = ["Layla","Omar","Fatimah","Yusuf","Reem","Khalid","Noor","Sami","Maya","Tariq","Ines","Hadi","Aaliya","Faisal","Lina","Bilal","Sara","Hamza","Dana","Rashid"];
const LAST = ["Al-Saud","Haddad","Najjar","Khouri","Mansour","Saleh","Habib","Rahman","Aziz","Karim","Mahdi","Othman","Younis","Sabbagh","Dahan","Halabi"];

function rng(seed) {
  let s = seed | 0;
  return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) % 100000) / 100000; };
}

const PROMPT_SAMPLES = [
  { text: "Draft a refund email to customer Mariam Al-Hashimi (ID 1102936453, IBAN SA03 8000 0000 6080 1016 7519) for invoice 4421.", entities: [["Mariam Al-Hashimi","Person Name","high"], ["1102936453","Saudi National ID","high"], ["SA03 8000 0000 6080 1016 7519","IBAN","high"]], risk: "High", platform: "ChatGPT" },
  { text: "Summarize the Q3 revenue figures from the attached spreadsheet for the leadership memo.", entities: [["Q3 revenue figures","Financial figures","med"]], risk: "Medium", platform: "Gemini" },
  { text: "Help me rewrite this paragraph to be more concise and professional in tone.", entities: [], risk: "None", platform: "ChatGPT" },
  { text: "Generate test cases for our internal pricing-engine endpoint /api/v2/pricing.", entities: [["/api/v2/pricing","Internal endpoint","low"]], risk: "Low", platform: "Claude" },
  { text: "What's a good agenda for a 30-minute customer onboarding call?", entities: [], risk: "None", platform: "ChatGPT" },
  { text: "My credit card 4532 1488 0343 6467 was declined — can you suggest what to say to the bank?", entities: [["4532 1488 0343 6467","Credit Card Number","high"]], risk: "High", platform: "Gemini" },
  { text: "Translate this internal NDA clause to Arabic, keeping legal precision.", entities: [["NDA clause","Confidential document","med"]], risk: "Medium", platform: "Claude" },
  { text: "Suggest a tagline for the new product launch (working name: Atlas).", entities: [["Atlas","Internal codename","low"]], risk: "Low", platform: "ChatGPT" },
  { text: "Patient record for case #88-77291 — what does this lab result indicate?", entities: [["Patient record","Health record","high"], ["#88-77291","Case ID","high"]], risk: "High", platform: "Gemini" },
  { text: "Explain the OWASP top 10 for our junior dev onboarding deck.", entities: [], risk: "None", platform: "Claude" },
  { text: "Summarize this candidate's CV: Faisal Younis, faisal.y@email.com, +966 50 222 9981.", entities: [["Faisal Younis","Person Name","med"], ["faisal.y@email.com","Email","med"], ["+966 50 222 9981","Phone Number","med"]], risk: "Medium", platform: "ChatGPT" },
  { text: "What are common phishing patterns I should warn employees about?", entities: [], risk: "None", platform: "Claude" },
];

function nameAt(r) {
  const f = FIRST[Math.floor(r() * FIRST.length)];
  const l = LAST[Math.floor(r() * LAST.length)];
  return `${f} ${l}`;
}

function makeActivity(count = 80, seed = 7) {
  const r = rng(seed);
  const now = Date.now();
  const out = [];
  for (let i = 0; i < count; i++) {
    const sample = PROMPT_SAMPLES[Math.floor(r() * PROMPT_SAMPLES.length)];
    const minutesAgo = Math.floor(r() * 60 * 24 * 30);
    const ts = new Date(now - minutesAgo * 60 * 1000);
    const action = sample.risk === "High" ? "Blocked" : sample.risk === "Medium" ? (r() > .4 ? "Warned" : "Submitted") : "Allowed";
    out.push({
      id: `LOG-${(10000 + i).toString()}`,
      ts,
      platform: sample.platform,
      preview: sample.text,
      entities: sample.entities,
      risk: sample.risk,
      action,
      user: nameAt(r),
      dept: DEPTS[Math.floor(r() * DEPTS.length)],
    });
  }
  out.sort((a, b) => b.ts - a.ts);
  return out;
}

function makeUsers(count = 24, seed = 3) {
  const r = rng(seed);
  const list = [];
  for (let i = 0; i < count; i++) {
    const name = nameAt(r);
    const role = i === 0 ? "System Admin" : (i < 4 ? "Department Admin" : "User");
    list.push({
      id: `U-${1000 + i}`,
      name,
      email: name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g,"") + "@haresai.com",
      dept: DEPTS[Math.floor(r() * DEPTS.length)],
      role,
      status: r() > 0.12 ? "Active" : "Inactive",
      lastActive: new Date(Date.now() - Math.floor(r() * 60 * 24 * 14) * 60 * 1000),
      highCount: Math.floor(r() * 8),
      medCount: Math.floor(r() * 18),
    });
  }
  return list;
}

const ACTIVITY = makeActivity();
const USERS = makeUsers();
const SESSION = {
  user: { name: "Layla Al-Saud", email: "layla.alsaud@haresai.com", role: "User", dept: "Engineering" },
};

function fmtDate(d) {
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const hh = d.getHours().toString().padStart(2,"0");
  const mm = d.getMinutes().toString().padStart(2,"0");
  return `${m[d.getMonth()]} ${d.getDate()}, ${hh}:${mm}`;
}
function fmtRel(d) {
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

Object.assign(window, { PLATFORMS, RISK, DEPTS, ACTIVITY, USERS, SESSION, fmtDate, fmtRel, PROMPT_SAMPLES });
