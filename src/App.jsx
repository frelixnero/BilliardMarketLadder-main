
import React, { useState, useMemo, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const BML_SUPABASE_URL = "https://vhsxjfzhwrxujpsvrutx.supabase.co";
const BML_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoc3hqZnpod3J4dWpwc3ZydXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NjQzOTEsImV4cCI6MjA5NzE0MDM5MX0.uTSkYFb_IkVIPO4uIZniOph5uEwqcizHfe4mvBbIXWw";


// ─── PERSISTENCE ──────────────────────────────────────────────────────────────
const SAVE_KEY = "bml_dashboard_v10";
const saveState = (state) => {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch(e) {}
};
const loadState = () => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
};
const AUTH_KEY = "bml_local_auth_v1";
const USERS_KEY = "bml_local_users_v2";
const ROLE_PREFS_KEY = "bml_role_prefs_v1";
const SUPABASE_URL = window.BML_SUPABASE_URL || localStorage.getItem("BML_SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = window.BML_SUPABASE_ANON_KEY || localStorage.getItem("BML_SUPABASE_ANON_KEY") || "";

const hashPassword = async (password) => {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(password));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
};
const getLocalUsers = () => {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
};
const setLocalUsers = (users) => {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch(e) {}
};
const getLocalAuthUser = () => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
};
const setLocalAuthUser = (user) => {
  try {
    if (!user) localStorage.removeItem(AUTH_KEY);
    else localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  } catch(e) {}
};
const getRolePrefs = () => {
  try {
    const raw = localStorage.getItem(ROLE_PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
};
const getStoredRole = (email) => {
  if (!email) return null;
  return getRolePrefs()[String(email).toLowerCase()] || null;
};
const setStoredRole = (email, role) => {
  if (!email || !role) return;
  const next = getRolePrefs();
  next[String(email).toLowerCase()] = role;
  try { localStorage.setItem(ROLE_PREFS_KEY, JSON.stringify(next)); } catch (e) {}
};
const getSupabaseClient = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!window.supabase || !window.supabase.createClient) return null;
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
};
// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#0e0e1a", card: "#16162a", cardBorder: "#2a2a45",
  red: "#e94560", green: "#00c896", gold: "#f5c842",
  blue: "#4fa3ff", purple: "#a855f7", white: "#f0f0ff",
  gray: "#8888aa", dimBg: "#12121f", orange: "#ff8c42",
};
const PLAYER_COUNT = 16;
const WEEK_COUNT   = 8;
// ── Season Prizes (S1 lower, S2 bigger, S3 playoffs biggest) ──
const S1_PRIZES = { p1:850,  p2:450,  p3:250,  p4:100,  mvp:75  };
const S2_PRIZES = { p1:1200, p2:1000, p3:600,  p4:200,  mvp:125 };
const S3_PRIZES = { p1:1700, p2:1000, p3:850,  p4:500,  mvp:400 };
const INHOUSE_PRIZES = { p1:500, p2:250, p3:100, mvp:50 }; // per in-house league (×3 leagues)
const SEASON_PRIZES  = S1_PRIZES; // kept for legacy references
const PLAYOFF_PRIZES = S3_PRIZES; // S3 IS the playoff season
const PARTICIPATION_PRIZES = [900,650,450,250,50,50,50,50,50,50,50,50,50,50,50,50]; // Top 4 earn most; everyone else $50 flat
const PLAYER_SHARE_CUT = 0.20;
// ── Share limits (updated) ──
const SHARE_CAP_PER_PLAYER   = 50;   // max shares sold per player total
const PLAYER_SELF_BUY_MAX    = 6;    // player can buy max 6 of their own shares
const SUPPORTER_BUY_MAX      = 5;    // supporters: max 5 per price change
const PLAYER_SELF_BUY_PRICE  = 25;   // first-dibs discount price for self-buy
const SHARE_MIN_PRICE        = 10;   // absolute price floor (can drop to $10 with losses)
const SHARE_MAX_PRICE        = 150;  // ceiling: max $150 even for #1
const SHARE_FIRST_BUY_PRICE  = 35;   // unranked starting/first-buy price
// ── Team Format Constants ──
const TEAM_SHARE_START    = 45;    // team player first-buy share price
const TEAM_SHARE_FLOOR    = 10;    // same floor as singles
const DOUBLES_SHARE_CEIL  = 200;   // doubles: shares top out at $200
const TRIPLES_SHARE_CEIL  = 250;   // triples: shares top out at $250
const TEAM_REG_PER_PERSON = 150;   // registration per person (doubles & triples)
// Per-person prizes — doubles mirrors S1 singles; triples is juicier (harder to build a 3-man squad)
const DOUBLES_PRIZES = { p1:750,  p2:400,  p3:200,  p4:125 }; // per person; ×2 for team total
const TRIPLES_PRIZES = { p1:1000, p2:600,  p3:300,  p4:175 }; // per person; ×3 for team total
const TEAM_PARTICIPATION_PER_PERSON = 75; // 5th+ place — $75 per person
const SALVAGE_CASH           = 5;
const SALVAGE_DISCOUNT       = 10;
// ── Season & Game Volatility ──
const SEASON_VOL = [1.0, 1.5, 2.5];  // S1, S2, S3 — progressively more volatile
const GAME_VOL   = { 'straight8':1.13, 'bca8':1.33, '9ball':1.63, '10ball':1.93 };
const GAME_LABELS = { 'straight8':'Straight 8-Ball', 'bca8':'8-Ball (BCA Rules)', '9ball':'9-Ball', '10ball':'10-Ball' };
const OFF_SCHEDULE_FACTOR = 0.5; // off-schedule matches move price half as much
// ── Registration Fees per Season ──
const S1_REG = 150; const S2_REG = 175; const S3_REG = 200;
const S3_REG_FREE = 0;   // 1st place from S1 or S2 enters S3 FREE
const S3_REG_HALF = 100; // 2nd place from S1 or S2 pays half ($100)
const WEEK_FEE   = 25;
const BAR_REG_CUT   = 0.10; // bar owner gets 10% of reg fees from their players
const BAR_SHARE_CUT = 0.03; // bar owner gets 3% of share trading volume at their bar
const OP_SHARE_FEE  = 0.15; // operator takes 15% of all share trading
const INHOUSE_WEEKLY_FEE       = 25;   // per league per week
const INHOUSE_WEEKLY_BUNDLE    = 65;   // all 3 leagues/wk (vs $75, save $10)
const INHOUSE_REG_FEE          = 150;  // registration per league
const INHOUSE_REG_BUNDLE       = 400;  // all 3 leagues (vs $450, save $50)
const INHOUSE_STOCK_BUMPS      = [0, 10, 20, 35];   // extra $/share per leagues joined
const INHOUSE_VOL_SCALE        = [1, 1.2, 1.5, 2];  // exhibition volatility multiplier
const EXHB_WIN_BUMP            = 5;   // +$5/share per exhibition win
const EXHB_LOSS_BUMP           = 3;   // –$3/share per exhibition loss
const EXHB_MAX                 = 20;  // cap ±$20 fluctuation from exhibitions
const getSharePrice = (playerName, standings, players) => {
  const rank = standings.findIndex(s => s.name === playerName);
  let base = 30;
  if (rank === 0) base = 200;
  else if (rank === 1) base = 150;
  else if (rank < 4)  base = 100;
  else if (rank < 8)  base = 60;
  else if (rank >= 0) base = 30;
  // Exhibition bump: wins +$5, losses –$3, capped ±$20
  const p = players && players.find(x=>x.name===playerName);
  const bump = p ? Math.max(-EXHB_MAX, Math.min(EXHB_MAX, (p.exhibWins||0)*EXHB_WIN_BUMP - (p.exhibLosses||0)*EXHB_LOSS_BUMP)) : 0;
  return Math.max(15, base + bump);
};
const getPlayoffPayout = (playerName, playoffs) => {
  if (!playerName) return 0;
  const champ = playoffs.find(m => m.round.includes("Championship"));
  const sf1   = playoffs.find(m => m.round.includes("Semifinal 1"));
  const sf2   = playoffs.find(m => m.round.includes("Semifinal 2"));
  const cw  = champ ? getWinner(champ) : null;
  const s1w = sf1   ? getWinner(sf1)   : null;
  const s2w = sf2   ? getWinner(sf2)   : null;
  if (cw === playerName) return 100;
  if (champ && (champ.a === playerName || champ.b === playerName)) return 60;
  if (s1w === playerName || s2w === playerName) return 30;
  const inQF = playoffs.slice(0,4).some(m => m.a === playerName || m.b === playerName);
  if (inQF) return 10;
  return 0;
};
const defaultPlayers = () =>
  Array.from({ length: PLAYER_COUNT }, (_, i) => ({
    id: i+1, name: "", paid: false, weeksPaid: 0, s2paid: false, s2weeksPaid: 0, s3paid: false, s3weeksPaid: 0,
    exhibWins: 0, exhibLosses: 0, preferredGame: "straight8",
    inLeague1: false, inLeague2: false, inLeague3: false,
    inLeagueRegPaid: false, inLeagueWeeksPaid: 0,
    barId: null, s1Alumni: false, s2Alumni: false, s3RegStatus: "full",
  }));
const defaultMatches = (weekOffset = 0) => {
  const out = []; let id = 1 + weekOffset * (PLAYER_COUNT/2);
  for (let w = 1; w <= WEEK_COUNT; w++)
    for (let m = 0; m < PLAYER_COUNT/2; m++)
      out.push({ id: id++, week: w, a:"", b:"", aScore:"", bScore:"", gameType:"straight8", isOffSchedule:false });
  return out;
};
const defaultSupporters = () =>
  Array.from({ length: 80 }, (_, i) => ({
    id: i+1, name:"", player:"", shares:0,
    pricePaid: 30,
    cashedS1: false,
    lockedUntilMove: false,
    selfBuy: false,
    salvaged: false,
    salvageType: null,
  }));
const defaultLeagueNames = () => ["", "", ""];
const defaultBars = () => [
  { id:1, name:"", ownerName:"", barShares:0, barSharesPaid:false },
  { id:2, name:"", ownerName:"", barShares:0, barSharesPaid:false },
  { id:3, name:"", ownerName:"", barShares:0, barSharesPaid:false },
];
const defaultPlayoffs = () => [
  { id:1, round:"Quarterfinal 1",  a:"", b:"", aScore:"", bScore:"" },
  { id:2, round:"Quarterfinal 2",  a:"", b:"", aScore:"", bScore:"" },
  { id:3, round:"Quarterfinal 3",  a:"", b:"", aScore:"", bScore:"" },
  { id:4, round:"Quarterfinal 4",  a:"", b:"", aScore:"", bScore:"" },
  { id:5, round:"Semifinal 1",     a:"", b:"", aScore:"", bScore:"" },
  { id:6, round:"Semifinal 2",     a:"", b:"", aScore:"", bScore:"" },
  { id:7, round:"🏆 Championship", a:"", b:"", aScore:"", bScore:"" },
];
const $$ = (n) => {
  if (!n && n !== 0) return "$0";
  const abs = Math.abs(n);
  const s = abs % 1 === 0 ? abs.toLocaleString()
    : abs.toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 });
  return (n < 0 ? "–$" : "$") + s;
};
const getWinner = (m) => {
  if (!m || (!m.a && !m.b)) return null;
  if (m.aScore==="" && m.bScore==="") return null;
  const a = parseInt(m.aScore)||0, b = parseInt(m.bScore)||0;
  if (a===0 && b===0) return null;
  if (a > b) return m.a || "Player A";
  if (b > a) return m.b || "Player B";
  return "Tie";
};
const calcStandings = (players, matches) => {
  const stats = {};
  players.forEach(p => { if (p.name) stats[p.name] = { w:0, l:0, t:0 }; });
  matches.forEach(m => {
    const w = getWinner(m);
    if (!w) return;
    if (w==="Tie") { if(stats[m.a]) stats[m.a].t++; if(stats[m.b]) stats[m.b].t++; return; }
    const loser = w===m.a ? m.b : m.a;
    if (stats[w]) stats[w].w++;
    if (stats[loser]) stats[loser].l++;
  });
  return Object.entries(stats)
    .map(([name,s]) => ({ name, ...s, pts: s.w*2+s.t }))
    .sort((a,b) => b.pts-a.pts || b.w-a.w);
};

const isPlayerLocked = (player, season, matches) => {
  if (!player || !player.name) return false;
  const paidKey = season === 1 ? "paid" : season === 2 ? "s2paid" : "s3paid";
  if (!player[paidKey]) return true;

  const completedMatches = matches.filter(m => 
    (m.a === player.name || m.b === player.name) && 
    (m.aScore !== "" || m.bScore !== "")
  );
  const playedCount = completedMatches.length;

  const weeksPaidKey = season === 1 ? "weeksPaid" : season === 2 ? "s2weeksPaid" : "s3weeksPaid";
  const weeksPaid = parseInt(player[weeksPaidKey]) || 0;

  return weeksPaid < playedCount - 1;
};

const getPlayerOwedAmount = (player, season, matches) => {
  if (!player || !player.name) return 0;
  let owed = 0;
  
  const paidKey = season === 1 ? "paid" : season === 2 ? "s2paid" : "s3paid";
  if (!player[paidKey]) {
    const regFee = season === 1 ? S1_REG : season === 2 ? S2_REG : S3_REG;
    owed += regFee;
  }

  const completedMatches = matches.filter(m => 
    (m.a === player.name || m.b === player.name) && 
    (m.aScore !== "" || m.bScore !== "")
  );
  const playedCount = completedMatches.length;

  const weeksPaidKey = season === 1 ? "weeksPaid" : season === 2 ? "s2weeksPaid" : "s3weeksPaid";
  const weeksPaid = parseInt(player[weeksPaidKey]) || 0;

  if (playedCount > weeksPaid) {
    owed += (playedCount - weeksPaid) * WEEK_FEE;
  }

  return owed;
};

const getShareTierByPrice = (sharePrice) => {
  if (sharePrice >= 120) return "top2";
  if (sharePrice >= 90) return "top34";
  if (sharePrice >= 60) return "top58";
  return "unranked";
};

export function AuthShell() {
  const supabaseClient = useMemo(() => getSupabaseClient(), []);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("operator");
  const [showPassword, setShowPassword] = useState(false);
  const [authMsg, setAuthMsg] = useState({ text: "", isError: false });
  const [loading, setLoading] = useState(false);

  const setMsg = (text, isError = false) => setAuthMsg({ text, isError });
  const clearMsg = () => setAuthMsg({ text: "", isError: false });

  useEffect(() => {
    if (!supabaseClient) {
      setUser(getLocalAuthUser());
      setReady(true);
      return;
    }
    let mounted = true;
    supabaseClient.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data?.session?.user || null);
      setReady(true);
    });
    const { data: listener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [supabaseClient]);

  const handleLocalAuth = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) { setMsg("Email and password are required.", true); return; }
    if (password.length < 8) { setMsg("Password must be at least 8 characters.", true); return; }
    const users = getLocalUsers();
    const hashed = await hashPassword(password);
    if (mode === "signup") {
      if (password !== confirmPassword) { setMsg("Passwords do not match.", true); return; }
      if (users.some(u => u.email === cleanEmail)) { setMsg("An account with that email already exists.", true); return; }
      setLocalUsers([...users, { email: cleanEmail, hash: hashed }]);
      const localUser = { id: cleanEmail, email: cleanEmail, isLocal: true };
      setStoredRole(cleanEmail, selectedRole);
      setLocalAuthUser(localUser);
      setUser(localUser);
      return;
    }
    const found = users.find(u => u.email === cleanEmail && (u.hash === hashed || u.password === password));
    if (!found) { setMsg("Incorrect email or password.", true); return; }
    if (found.password && !found.hash) {
      const migrated = users.map(u => u.email === cleanEmail ? { email: u.email, hash: hashed } : u);
      setLocalUsers(migrated);
    }
    const localUser = { id: found.email, email: found.email, isLocal: true };
    setLocalAuthUser(localUser);
    setUser(localUser);
  };

  const submitAuth = async (e) => {
    e.preventDefault();
    clearMsg();
    if (!supabaseClient) { handleLocalAuth(); return; }
    if (password.length < 8) { setMsg("Password must be at least 8 characters.", true); return; }
    if (mode === "signup" && password !== confirmPassword) { setMsg("Passwords do not match.", true); return; }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabaseClient.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              role: selectedRole === "operator" ? "player" : selectedRole,
              requested_role: selectedRole,
            },
          },
        });
        if (error) throw error;
        setStoredRole(email.trim(), selectedRole);
        setMsg("Account created! Check your inbox to verify your email.", false);
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (err) {
      setMsg(err.message || "Authentication failed.", true);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLocalAuthUser(null);
    setUser(null);
    if (supabaseClient) {
      supabaseClient.auth.signOut().catch(e => {
        console.error("Sign out error:", e);
      });
    }
  };

  const switchMode = (next) => { setMode(next); clearMsg(); setPassword(""); setConfirmPassword(""); };

  const pwStrength = password.length === 0 ? null : password.length < 8 ? "weak" : password.length < 12 ? "ok" : "strong";
  const pwStrengthColor = { weak: C.red, ok: C.gold, strong: C.green }[pwStrength];
  const pwStrengthLabel = { weak: "Too short", ok: "Fair", strong: "Strong" }[pwStrength];

  if (!ready) {
    return (
      <div style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:C.bg, fontFamily:"'Segoe UI',Arial,sans-serif" }}>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:32 }}>🎱</div>
          <div style={{ color:C.gray, fontSize:14 }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:C.bg, color:C.white, fontFamily:"'Segoe UI',Arial,sans-serif", padding:20 }}>
        <div style={{ width:"100%", maxWidth:440 }}>
          <div style={{ textAlign:"center", marginBottom:28 }}>
            <div style={{ fontSize:44, marginBottom:8 }}>🎱</div>
            <div style={{ fontSize:22, fontWeight:900, letterSpacing:0.5 }}>BilliardsMarketLadder</div>
            <div style={{ fontSize:13, color:C.gray, marginTop:4 }}>League Dashboard</div>
            {!supabaseClient && (
              <div style={{ display:"inline-block", marginTop:10, background:"#1a1a00", border:`1px solid ${C.gold}`, borderRadius:20, padding:"3px 12px", fontSize:11, color:C.gold, fontWeight:700 }}>
                Local mode only
              </div>
            )}
          </div>

          <form onSubmit={submitAuth} style={{ background:C.card, border:`1px solid ${C.cardBorder}`, borderRadius:16, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", borderBottom:`1px solid ${C.cardBorder}` }}>
              {[ ["login","Log in"], ["signup","Create account"] ].map(([id, label]) => (
                <button key={id} type="button" onClick={() => switchMode(id)} style={{
                  background: mode === id ? C.card : C.dimBg,
                  border:"none", borderBottom: mode === id ? `2px solid ${C.red}` : "2px solid transparent",
                  color: mode === id ? C.white : C.gray,
                  padding:"14px 0", cursor:"pointer", fontFamily:"inherit",
                  fontSize:14, fontWeight: mode === id ? 700 : 400,
                }}>{label}</button>
              ))}
            </div>

            <div style={{ padding:24 }}>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:"block", fontSize:12, color:C.gray, marginBottom:6, fontWeight:600 }}>Email address</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" required autoComplete="email" style={{ ...selStyle, padding:"10px 12px" }} placeholder="you@example.com" />
              </div>

              {mode === "signup" && <div style={{ marginBottom:14 }}>
                <label style={{ display:"block", fontSize:12, color:C.gray, marginBottom:6, fontWeight:600 }}>Dashboard role</label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {[ ["operator", "Operator"], ["player", "Player"] ].map(([id, label]) => (
                    <button key={id} type="button" onClick={() => setSelectedRole(id)} style={{
                      background: selectedRole === id ? C.red : C.dimBg,
                      border:`1px solid ${selectedRole === id ? C.red : C.cardBorder}`,
                      color:C.white,
                      borderRadius:8,
                      padding:"10px 12px",
                      cursor:"pointer",
                      fontFamily:"inherit",
                      fontSize:13,
                      fontWeight:700,
                    }}>{label}</button>
                  ))}
                </div>
              </div>}

              <div style={{ marginBottom: mode === "signup" ? 14 : 20 }}>
                <label style={{ display:"block", fontSize:12, color:C.gray, marginBottom:6, fontWeight:600 }}>Password</label>
                <div style={{ position:"relative" }}>
                  <input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} required autoComplete={mode === "signup" ? "new-password" : "current-password"} style={{ ...selStyle, padding:"10px 40px 10px 12px" }} placeholder={mode === "signup" ? "Min. 8 characters" : "Your password"} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.gray, cursor:"pointer", fontSize:16, padding:0 }}>{showPassword ? "🙈" : "👁"}</button>
                </div>
                {mode === "signup" && pwStrength && (
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6 }}>
                    <div style={{ flex:1, height:3, borderRadius:2, background:C.cardBorder, overflow:"hidden" }}>
                      <div style={{ height:"100%", width: pwStrength === "weak" ? "33%" : pwStrength === "ok" ? "66%" : "100%", background:pwStrengthColor, transition:"width .3s,background .3s" }} />
                    </div>
                    <span style={{ fontSize:11, color:pwStrengthColor, fontWeight:700 }}>{pwStrengthLabel}</span>
                  </div>
                )}
              </div>

              {mode === "signup" && (
                <div style={{ marginBottom:20 }}>
                  <label style={{ display:"block", fontSize:12, color:C.gray, marginBottom:6, fontWeight:600 }}>Confirm password</label>
                  <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type={showPassword ? "text" : "password"} required autoComplete="new-password" style={{ ...selStyle, padding:"10px 12px", borderColor: confirmPassword && confirmPassword !== password ? C.red : C.cardBorder }} placeholder="Repeat password" />
                  {confirmPassword && confirmPassword !== password && (
                    <div style={{ fontSize:11, color:C.red, marginTop:4 }}>Passwords do not match</div>
                  )}
                </div>
              )}

              {authMsg.text && (
                <div style={{ background: authMsg.isError ? "#2a0010" : "#002a16", border:`1px solid ${authMsg.isError ? C.red : C.green}`, borderRadius:8, padding:"10px 12px", fontSize:13, color: authMsg.isError ? C.red : C.green, marginBottom:16 }}>
                  {authMsg.isError ? "⚠ " : "✓ "}{authMsg.text}
                </div>
              )}

              <button disabled={loading} type="submit" style={{ width:"100%", border:"none", borderRadius:8, padding:"12px", background: loading ? C.cardBorder : C.red, color:C.white, fontWeight:900, cursor: loading ? "not-allowed" : "pointer", fontFamily:"inherit", fontSize:15, letterSpacing:0.3 }}>
                {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Log in →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return <App authUser={user} supabaseClient={supabaseClient} onLogout={logout} />;
}
// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function App({ authUser, supabaseClient, onLogout }) {
  const saved = loadState();
  const [serverRole, setServerRole] = useState(null);
  const accountRole = serverRole || getStoredRole(authUser?.email) || authUser?.app_metadata?.role || authUser?.user_metadata?.role || "player";
  const [tab, setTab]       = useState("home");
  const [roleMode, setRoleMode] = useState(saved?.roleMode ?? (accountRole === "operator" ? "operator" : "player"));
  const [season, setSeason] = useState(saved?.season ?? 1);
  const [s1players, setS1Players]   = useState(saved?.s1players   ?? defaultPlayers());
  const [s1matches, setS1Matches]   = useState(saved?.s1matches   ?? defaultMatches(0));
  const [s2players, setS2Players]   = useState(saved?.s2players   ?? defaultPlayers());
  const [s2matches, setS2Matches]   = useState(saved?.s2matches   ?? defaultMatches(PLAYER_COUNT/2 * WEEK_COUNT));
  const [s3players, setS3Players]   = useState(saved?.s3players   ?? defaultPlayers());
  const [s3matches, setS3Matches]   = useState(saved?.s3matches   ?? defaultMatches(PLAYER_COUNT/2 * WEEK_COUNT * 2));
  const [supporters, setSupporters] = useState(saved?.supporters  ?? defaultSupporters());
  const [doublesTeams, setDoublesTeams] = useState(saved?.doublesTeams ?? []);
  const [triplesTeams, setTriplesTeams] = useState(saved?.triplesTeams ?? []);
  const [leagueNames, setLeagueNames] = useState(saved?.leagueNames ?? defaultLeagueNames());
  const [bars, setBars]             = useState(saved?.bars         ?? defaultBars());
  const [playoffs, setPlayoffs]     = useState(saved?.playoffs    ?? defaultPlayoffs());
  const [lastSaved, setLastSaved]   = useState(null);
  const [cloudStatus, setCloudStatus] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [checkoutBusyId, setCheckoutBusyId] = useState(null);
  const [playerCheckoutBusyId, setPlayerCheckoutBusyId] = useState(null);

  const snapshot = {
    roleMode, season, s1players, s1matches, s2players, s2matches, s3players, s3matches,
    supporters, leagueNames, bars, playoffs, doublesTeams, triplesTeams,
  };
  const effectiveRole = accountRole === "operator" ? roleMode : "player";

  const applySnapshot = (next) => {
    if (!next) return;
    setRoleMode(accountRole === "operator" ? (next.roleMode ?? "operator") : "player");
    setSeason(next.season ?? 1);
    setS1Players(next.s1players ?? defaultPlayers());
    setS1Matches(next.s1matches ?? defaultMatches(0));
    setS2Players(next.s2players ?? defaultPlayers());
    setS2Matches(next.s2matches ?? defaultMatches(PLAYER_COUNT/2 * WEEK_COUNT));
    setS3Players(next.s3players ?? defaultPlayers());
    setS3Matches(next.s3matches ?? defaultMatches(PLAYER_COUNT/2 * WEEK_COUNT * 2));
    setSupporters(next.supporters ?? defaultSupporters());
    setLeagueNames(next.leagueNames ?? defaultLeagueNames());
    setBars(next.bars ?? defaultBars());
    setPlayoffs(next.playoffs ?? defaultPlayoffs());
    setDoublesTeams(next.doublesTeams ?? []);
    setTriplesTeams(next.triplesTeams ?? []);
  };

  // Auto-save whenever any data changes
  useEffect(() => {
    saveState(snapshot);
    setLastSaved(new Date().toLocaleTimeString());
  }, [roleMode, season, s1players, s1matches, s2players, s2matches, s3players, s3matches, supporters, leagueNames, bars, playoffs, doublesTeams, triplesTeams]);

  useEffect(() => {
    if (accountRole !== "operator" && roleMode !== "player") setRoleMode("player");
  }, [accountRole, roleMode]);

  const getAccessToken = async () => {
    if (!supabaseClient) throw new Error("Supabase auth is not configured.");
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    const token = data?.session?.access_token;
    if (!token) throw new Error("Please log in again.");
    return token;
  };

  const saveToCloud = async () => {
    setCloudBusy(true);
    setCloudStatus("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/sync-state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          season,
          settings: {
            dashboard: snapshot,
            updatedBy: authUser?.email || "unknown",
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "Cloud sync failed");
      setCloudStatus("Cloud sync successful.");
    } catch (err) {
      setCloudStatus(err.message || "Cloud sync failed.");
    } finally {
      setCloudBusy(false);
    }
  };

  const loadFromCloud = async () => {
    setCloudBusy(true);
    setCloudStatus("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/load-state", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "Cloud load failed");
      if (data.role) {
        setServerRole(data.role);
      }
      if (!data.dashboard) {
        setCloudStatus("No cloud snapshot found.");
        return;
      }
      applySnapshot(data.dashboard);
      setCloudStatus("Loaded latest cloud snapshot.");
    } catch (err) {
      setCloudStatus(err.message || "Cloud load failed.");
    } finally {
      setCloudBusy(false);
    }
  };

  useEffect(() => {
    if (!supabaseClient) return;
    loadFromCloud();
  }, [supabaseClient]);

  const resetAll = () => {
    if (!confirm("Reset ALL data? This cannot be undone.")) return;
    localStorage.removeItem(SAVE_KEY);
    setSeason(1); setS1Players(defaultPlayers()); setS1Matches(defaultMatches(0));
    setS2Players(defaultPlayers()); setS2Matches(defaultMatches(PLAYER_COUNT/2*WEEK_COUNT));
    setSupporters(defaultSupporters()); setLeagueNames(defaultLeagueNames()); setBars(defaultBars()); setPlayoffs(defaultPlayoffs());
    setS3Players(defaultPlayers()); setS3Matches(defaultMatches(PLAYER_COUNT/2*WEEK_COUNT*2));
  };
  const players    = season===1 ? s1players : season===2 ? s2players : s3players;
  const matches    = season===1 ? s1matches : season===2 ? s2matches : s3matches;
  const setPlayers = season===1 ? setS1Players : season===2 ? setS2Players : setS3Players;
  const setMatches = season===1 ? setS1Matches : season===2 ? setS2Matches : setS3Matches;
  const s1standings = useMemo(() => calcStandings(s1players, s1matches), [s1players, s1matches]);
  const s2standings = useMemo(() => calcStandings(s2players, s2matches), [s2players, s2matches]);
  const s3standings = useMemo(() => calcStandings(s3players, s3matches), [s3players, s3matches]);
  const standings   = season===1 ? s1standings : season===2 ? s2standings : s3standings;
  const startStripeCheckout = async (supporter, marketPrice) => {
    const playerName = supporter?.player;
    if (!playerName) {
      setCloudStatus("Pick a player before launching Stripe checkout.");
      return;
    }
    const shareTier = getShareTierByPrice(marketPrice);
    const playerRank = standings.findIndex(s => s.name === playerName) + 1;
    setCheckoutBusyId(supporter.id);
    setCloudStatus("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "share",
          playerId: String(playerName),
          playerName,
          playerRank,
          shareTier,
          buyerName: supporter?.name || "",
          buyerEmail: supporter?.email || authUser?.email || "",
          season,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "Checkout launch failed");
      window.location.href = data.url;
    } catch (err) {
      setCloudStatus(err.message || "Checkout launch failed.");
    } finally {
      setCheckoutBusyId(null);
    }
  };
  const startPlayerStripeCheckout = async (player, type) => {
    const playerName = player?.name?.trim();
    if (!playerName) {
      setCloudStatus("Add player name before launching checkout.");
      return;
    }
    setPlayerCheckoutBusyId(`${type}-${player.id}`);
    setCloudStatus("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          playerId: String(player.id),
          playerName,
          season,
          buyerEmail: authUser?.email || "",
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "Checkout launch failed");
      window.location.href = data.url;
    } catch (err) {
      setCloudStatus(err.message || "Checkout launch failed.");
    } finally {
      setPlayerCheckoutBusyId(null);
    }
  };
  const inHouseRevenue = useMemo(() => {
    const calcRev = (p) => {
      const cnt = [p.inLeague1,p.inLeague2,p.inLeague3].filter(Boolean).length;
      if (!cnt) return 0;
      const reg = p.inLeagueRegPaid ? (cnt===3?INHOUSE_REG_BUNDLE:cnt*INHOUSE_REG_FEE) : 0;
      const wkly = cnt===3?INHOUSE_WEEKLY_BUNDLE:cnt*INHOUSE_WEEKLY_FEE;
      return reg + (parseInt(p.inLeagueWeeksPaid)||0)*wkly;
    };
    return [...s1players, ...s2players, ...s3players].reduce((s,p)=>s+calcRev(p), 0);
  }, [s1players, s2players, s3players]);
  const money = useMemo(() => {
    const s1reg  = s1players.filter(p=>p.paid).length * S1_REG;
    const s1week = s1players.reduce((s,p)=>s+(parseInt(p.weeksPaid)||0)*WEEK_FEE,0);
    const s1base = s1reg + s1week;
    const s2reg  = s2players.filter(p=>p.paid).length * S2_REG;
    const s2week = s2players.reduce((s,p)=>s+(parseInt(p.s2weeksPaid)||p.weeksPaid||0)*WEEK_FEE,0);
    const s2base = s2reg + s2week;
    // S3 (playoff season): 1st from S1&S2 free, 2nd half price, rest full $200
    const s1_1st = s1standings[0]?.name; const s1_2nd = s1standings[1]?.name;
    const s2_1st = s2standings[0]?.name; const s2_2nd = s2standings[1]?.name;
    const s3reg  = s3players.filter(p=>p.name&&p.s3paid).reduce((s,p)=>{
      const nm=p.name;
      if(nm===s1_1st||nm===s2_1st) return s+S3_REG_FREE;
      if(nm===s1_2nd||nm===s2_2nd) return s+S3_REG_HALF;
      return s+S3_REG;
    },0);
    const s3week = s3players.reduce((s,p)=>s+(parseInt(p.s3weeksPaid)||0)*WEEK_FEE,0);
    const s3base = s3reg + s3week;
    const totalBase = s1base + s2base + s3base;
    // Bar reg cut (10% of reg from their players, tracked by barId)
    const barCut    = Math.round((s1reg+s2reg+s3reg) * BAR_REG_CUT);
    const activeSupp  = supporters.filter(s => !s.cashedS1);
    const cashedSupp  = supporters.filter(s => s.cashedS1);
    const shareVolCollected = supporters.reduce((s,x) =>
      s + (parseInt(x.shares)||0) * x.pricePaid, 0);
    const activeMarketVal = activeSupp.reduce((s,x) => {
      const mktPrice = getSharePrice(x.player, s2standings, s2players);
      return s + (parseInt(x.shares)||0) * mktPrice;
    },0);
    const s1cashoutTotal = cashedSupp.reduce((s,x)=> s+(parseInt(x.shares)||0)*x.pricePaid,0);
    const opShareFee  = Math.round(shareVolCollected * 0.15);
    const barShareCut = Math.round(shareVolCollected * 0.02);
    const supPool     = shareVolCollected - opShareFee - barShareCut;
    const s1PayoutTotal = S1_PRIZES.p1+S1_PRIZES.p2+S1_PRIZES.p3+(S1_PRIZES.p4||0)+S1_PRIZES.mvp;
    const s2PayoutTotal = S2_PRIZES.p1+S2_PRIZES.p2+S2_PRIZES.p3+(S2_PRIZES.p4||0)+S2_PRIZES.mvp;
    const s3PayoutTotal = S3_PRIZES.p1+S3_PRIZES.p2+S3_PRIZES.p3+(S3_PRIZES.p4||0)+S3_PRIZES.mvp;
    const seasonPayouts  = s1PayoutTotal + s2PayoutTotal + s3PayoutTotal;
    const playoffPayouts = 0; // S3 is the playoff season, already in seasonPayouts
    const participationPayouts = PARTICIPATION_PRIZES.reduce((s,v)=>s+v,0) * 3; // all 3 seasons
    // playerShareCuts: 20% of each player's backers' payout, from op fee
    const getPlayoffPayoutForPlayer = (name) => {
      const champ = playoffs.find(m=>m.round.includes("Championship"));
      const sf1   = playoffs.find(m=>m.round.includes("Semifinal 1"));
      const sf2   = playoffs.find(m=>m.round.includes("Semifinal 2"));
      const cw = champ ? getWinner(champ) : null;
      const s1w = sf1 ? getWinner(sf1) : null;
      const s2w = sf2 ? getWinner(sf2) : null;
      if (cw===name) return PLAYOFF_PRIZES.p1;
      if (champ && (champ.a===name||champ.b===name)) return PLAYOFF_PRIZES.p2;
      if (s1w===name||s2w===name) return PLAYOFF_PRIZES.p3;
      return 0;
    };
    const playerShareCuts = s3standings.reduce((total, p, i) => {
      const backerPayout = i===0 ? Math.round(supPool*0.70) : i===1 ? Math.round(supPool*0.20) : i===2 ? Math.round(supPool*0.10) : 0;
      return total + Math.round(backerPayout * PLAYER_SHARE_CUT);
    }, 0);
    const inHousePrizesTotal = (INHOUSE_PRIZES.p1+INHOUSE_PRIZES.p2+INHOUSE_PRIZES.p3+INHOUSE_PRIZES.mvp) * 3;
    const baseProfit = totalBase + inHouseRevenue - barCut - seasonPayouts - playoffPayouts - participationPayouts - inHousePrizesTotal;
    const salvageCashOut = supporters.reduce((s,x)=>
      x.salvaged && x.salvageType==='cash' ? s + (parseInt(x.shares)||0)*SALVAGE_CASH : s, 0);
    const doublesReg = doublesTeams.reduce((s,t)=>s+(t.paid?2*TEAM_REG_PER_PERSON:0),0);
    const triplesReg = triplesTeams.reduce((s,t)=>s+(t.paid?3*TEAM_REG_PER_PERSON:0),0);
    const teamRevenue = doublesReg + triplesReg;
    const dBase = doublesTeams.length>=4?DOUBLES_PRIZES.p1+DOUBLES_PRIZES.p2+DOUBLES_PRIZES.p3+DOUBLES_PRIZES.p4:doublesTeams.length===3?DOUBLES_PRIZES.p1+DOUBLES_PRIZES.p2+DOUBLES_PRIZES.p3:doublesTeams.length===2?DOUBLES_PRIZES.p1+DOUBLES_PRIZES.p2:doublesTeams.length===1?DOUBLES_PRIZES.p1:0;
    const doublesPrizePool = dBase + Math.max(0,doublesTeams.length-4)*2*TEAM_PARTICIPATION_PER_PERSON;
    const tBase = triplesTeams.length>=4?TRIPLES_PRIZES.p1+TRIPLES_PRIZES.p2+TRIPLES_PRIZES.p3+TRIPLES_PRIZES.p4:triplesTeams.length===3?TRIPLES_PRIZES.p1+TRIPLES_PRIZES.p2+TRIPLES_PRIZES.p3:triplesTeams.length===2?TRIPLES_PRIZES.p1+TRIPLES_PRIZES.p2:triplesTeams.length===1?TRIPLES_PRIZES.p1:0;
    const triplesPrizePool = tBase + Math.max(0,triplesTeams.length-4)*3*TEAM_PARTICIPATION_PER_PERSON;
    const teamPrizes = doublesPrizePool + triplesPrizePool;
    const netProfit  = baseProfit + opShareFee - barShareCut - playerShareCuts - salvageCashOut + teamRevenue - teamPrizes;
    const perPartner = netProfit / 4;
    return {
      s1base, s2base, s3base, totalBase, barCut,
      shareVolCollected, activeMarketVal, s1cashoutTotal,
      opShareFee, barShareCut, supPool,
      supPool1: Math.round(supPool*0.70),
      supPool2: Math.round(supPool*0.20),
      supPool3: Math.round(supPool*0.10),
      seasonPayouts, playoffPayouts, participationPayouts, playerShareCuts, salvageCashOut, inHouseRevenue, inHousePrizesTotal,
      baseProfit, netProfit, perPartner,
      totalBar: barCut+barShareCut,
      teamRevenue, teamPrizes, doublesReg, triplesReg, doublesPrizePool, triplesPrizePool,
    };
  }, [s1players, s2players, s3players, supporters, s1standings, s2standings, s3standings, inHouseRevenue, doublesTeams, triplesTeams]);
  const operatorTabs = [
    { id:"home",        icon:"🏠", label:"Home" },
    { id:"payouts",     icon:"💵", label:"Payouts" },
    { id:"players",     icon:"👤", label:"Players" },
    { id:"matches",     icon:"🎱", label:"Matches" },
    { id:"inhouse",     icon:"🏟", label:"Leagues" },
    { id:"standings",   icon:"🏆", label:"Standings" },
    { id:"shares",      icon:"💰", label:"Shares" },
    { id:"playoffs",    icon:"🥊", label:"Playoffs" },
    { id:"teams",       icon:"👥", label:"Teams" },
    { id:"bars",        icon:"🏪", label:"Bar Tabs" },
    { id:"rules",       icon:"📖", label:"Rules" },
    { id:"manual",      icon:"📗", label:"Manual" },
    { id:"participation", icon:"🎱", label:"Participation" },
    { id:"money",       icon:"📊", label:"Money" },
    { id:"pnl",         icon:"📋", label:"P&L All" },
    { id:"playerboard", icon:"📺", label:"Player View" },
  ];
  const playerTabs = [
    { id:"playerboard", icon:"📺", label:"Player View" },
    { id:"standings",   icon:"🏆", label:"Standings" },
    { id:"matches",     icon:"🎱", label:"Matches" },
    { id:"playoffs",    icon:"🥊", label:"Playoffs" },
    { id:"participation", icon:"🎱", label:"Participation" },
    { id:"rules",       icon:"📖", label:"Rules" },
  ];
  const TABS = effectiveRole === "player" ? playerTabs : operatorTabs;

  useEffect(() => {
    if (!TABS.some(t => t.id === tab)) {
      setTab(effectiveRole === "player" ? "playerboard" : "home");
    }
  }, [effectiveRole, tab]);
  const views = {
    players, setPlayers, matches, setMatches,
    supporters, setSupporters,
    leagueNames, setLeagueNames,
    bars, setBars,
    playoffs, setPlayoffs, standings, money,
    s1standings, s2standings, s3standings, season, setSeason, setTab,
    s1players, s2players, s3players, s1matches, s2matches, s3matches,
    setS1Players, setS2Players, setS3Players,
    startStripeCheckout, checkoutBusyId,
    startPlayerStripeCheckout, playerCheckoutBusyId,
    roleMode: effectiveRole,
  };
  return (
    <div style={{ fontFamily:"'Segoe UI',Arial,sans-serif", background:C.bg, minHeight:"100vh", color:C.white }}>
      <div style={{ background:C.card, borderBottom:`3px solid ${C.red}`, padding:"12px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <span style={{ fontSize:28 }}>⚡</span>
        <div>
          <div style={{ fontSize:11, color:C.red, fontWeight:800, letterSpacing:3, textTransform:"uppercase" }}>Action Ladder</div>
          <div style={{ fontSize:20, fontWeight:900, color:C.white, lineHeight:1 }}>BilliardsMarketLadder</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:16 }}>
          {effectiveRole === "operator" && (
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:11, color:C.gray }}>Net profit</div>
              <div style={{ fontSize:22, fontWeight:900, color:C.green }}>{$$(money.netProfit)}</div>
            </div>
          )}
          <div style={{ textAlign:"right" }}>
            {lastSaved && <div style={{ fontSize:10, color:C.green, marginBottom:2 }}>💾 Saved {lastSaved}</div>}
            <div style={{ fontSize:10, color:C.gray, marginBottom:4 }}>{authUser?.email}</div>
            <div style={{ display:"flex", gap:6, justifyContent:"flex-end", flexWrap:"wrap" }}>
              {accountRole === "operator" && <button onClick={() => setRoleMode(roleMode === "operator" ? "player" : "operator")} style={{ background: roleMode === "operator" ? "#00162a" : "#001a10", border:`1px solid ${roleMode === "operator" ? C.blue : C.green}`, color: roleMode === "operator" ? C.blue : C.green, borderRadius:6, padding:"4px 8px", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700 }}>{roleMode === "operator" ? "Switch to Player" : "Switch to Operator"}</button>}
              {effectiveRole === "operator" && <button onClick={loadFromCloud} disabled={cloudBusy || !supabaseClient} style={{ background:"#00162a", border:`1px solid ${C.blue}`, color:C.blue, borderRadius:6, padding:"4px 8px", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700, opacity: !supabaseClient ? 0.5 : 1 }}>Load Cloud</button>}
              {effectiveRole === "operator" && <button onClick={saveToCloud} disabled={cloudBusy || !supabaseClient} style={{ background:"#001a10", border:`1px solid ${C.green}`, color:C.green, borderRadius:6, padding:"4px 8px", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700, opacity: !supabaseClient ? 0.5 : 1 }}>Save Cloud</button>}
              <button onClick={onLogout} style={{ background:"#2a2a45", border:`1px solid ${C.cardBorder}`, color:C.white, borderRadius:6, padding:"4px 8px", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700 }}>Logout</button>
              {effectiveRole === "operator" && <button onClick={resetAll} style={{ background:"#2a0010", border:`1px solid ${C.red}`, color:C.red, borderRadius:6, padding:"4px 8px", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700 }}>Reset</button>}
            </div>
          </div>
        </div>
      </div>
      {effectiveRole === "operator" && cloudStatus && (
        <div style={{ background:"#0a0a18", borderBottom:`1px solid ${C.cardBorder}`, padding:"6px 20px", fontSize:12, color:C.gold }}>
          {cloudStatus}
        </div>
      )}
      <div style={{ background:"#0a0a18", borderBottom:`1px solid ${C.cardBorder}`, padding:"8px 20px", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:12, color:C.gray, marginRight:4 }}>Active Season:</span>
        {[1,2,3].map(s => (
          <button key={s} onClick={() => effectiveRole === "operator" && setSeason(s)} style={{
            background: season===s ? C.red : C.card,
            border:`2px solid ${season===s ? C.red : C.cardBorder}`,
            color:C.white, borderRadius:8, padding:"5px 18px",
            cursor: effectiveRole === "operator" ? "pointer" : "default", opacity: effectiveRole === "operator" ? 1 : 0.85, fontFamily:"inherit", fontSize:13, fontWeight:700,
          }}>Season {s}{s===3?' 🏆':''}</button>
        ))}
        <span style={{ fontSize:11, color:C.gray, marginLeft:8 }}>
          {season===1 ? "🟡 S1 — vol ×1.0 · lower prizes · S1 players get S2/S3 priority" : season===2 ? "🟢 S2 — vol ×1.5 · bigger prizes · S1 alumni get priority sign-up" : "🔴 S3 PLAYOFFS — vol ×2.5 · biggest prizes · top S1+S2 players compete"}
        </span>
        <span style={{ marginLeft:"auto", fontSize:11, color: effectiveRole === "operator" ? C.blue : C.green, fontWeight:700 }}>
          {effectiveRole === "operator" ? "Operator dashboard" : "Player dashboard"}
        </span>
      </div>
      <div style={{ display:"flex", overflowX:"auto", background:C.dimBg, borderBottom:`1px solid ${C.cardBorder}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex:"0 0 auto", background:"none", border:"none",
            borderBottom:`3px solid ${tab===t.id ? C.red : "transparent"}`,
            color:tab===t.id ? C.white : C.gray,
            padding:"10px 14px", cursor:"pointer", fontFamily:"inherit",
            fontSize:11, fontWeight:tab===t.id?700:400,
            display:"flex", flexDirection:"column", alignItems:"center", gap:2,
          }}>
            <span style={{ fontSize:17 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <div style={{ padding:"20px", maxWidth:980, margin:"0 auto" }}>
        {tab==="home"        && <HomeView {...views} />}
        {tab==="payouts"     && <PayoutsView supporters={views.supporters} s1standings={views.s1standings} s2standings={views.s2standings} s1players={views.s1players} s2players={views.s2players} money={views.money} bars={views.bars} playoffs={views.playoffs} />}
        {tab==="players"     && <PlayersView {...views} />}
        {tab==="matches"     && <MatchesView {...views} />}
        {tab==="inhouse"     && <InHouseView {...views} />}
        {tab==="standings"   && <StandingsView {...views} />}
        {tab==="shares"      && <SharesView {...views} />}
        {tab==="playoffs"    && <PlayoffsView {...views} />}
        {tab==="participation" && <ParticipationView {...views} />}
        {tab==="money"       && <MoneyView {...views} />}
        {tab==="pnl"         && <PnLView {...views} />}
        {tab==="playerboard" && <PlayerBoardView {...views} />}
        {tab==="teams"       && <TeamsView {...views} />}
        {tab==="bars"        && <BarsView {...views} />}
        {tab==="rules"       && <RulesView />}
        {tab==="manual"      && <ManualView money={views.money} season={views.season} bars={views.bars} />}
      </div>
    </div>
  );
}

// ─── OPERATOR P&L VIEW (PIN LOCKED) ─────────────────────────────────────────
function OperatorPLView({ money={} }) {
  const PIN_KEY = "bml_op_pin";
  const $$ = v => "$"+(Math.round(v)||0).toLocaleString();
  const [pin, setPin]           = React.useState("");
  const [unlocked, setUnlocked] = React.useState(false);
  const [savedPin, setSavedPin] = React.useState(()=>localStorage.getItem(PIN_KEY)||"1234");
  const [changingPin, setChangingPin] = React.useState(false);
  const [newPin, setNewPin]     = React.useState("");
  const [pinErr, setPinErr]     = React.useState("");
  const tryUnlock = () => {
    if(pin===savedPin){ setUnlocked(true); setPinErr(""); }
    else { setPinErr("Wrong PIN — try again."); setPin(""); }
  };
  const saveNewPin = () => {
    if(newPin.length<4){ setPinErr("Must be at least 4 digits."); return; }
    localStorage.setItem(PIN_KEY, newPin); setSavedPin(newPin);
    setChangingPin(false); setNewPin(""); setPinErr("");
  };
  if(!unlocked) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"70px 20px"}}>
      <div style={{fontSize:52,marginBottom:14}}>🔒</div>
      <div style={{fontSize:22,fontWeight:900,color:C.white,marginBottom:6}}>Operator Revenue — Private</div>
      <div style={{fontSize:13,color:C.gray,marginBottom:28}}>Enter your operator PIN to view P&L and revenue data.</div>
      <input
        type="password" value={pin} onChange={e=>setPin(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&tryUnlock()}
        placeholder="PIN" maxLength={8}
        style={{background:C.card,border:`2px solid ${C.cardBorder}`,color:C.white,borderRadius:8,padding:"12px 20px",textAlign:"center",fontSize:24,letterSpacing:10,width:180,marginBottom:12,fontFamily:"inherit",outline:"none"}}
        autoFocus
      />
      {pinErr && <div style={{color:C.red,fontSize:12,marginBottom:8}}>{pinErr}</div>}
      <button onClick={tryUnlock} style={{background:C.green,border:"none",color:"#000",borderRadius:8,padding:"10px 36px",fontSize:16,fontWeight:900,cursor:"pointer",fontFamily:"inherit",marginBottom:20}}>Unlock</button>
      <div style={{fontSize:11,color:C.gray}}>Default PIN: 1234 — change it once unlocked.</div>
    </div>
  );
  return (
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:14}}>
        {changingPin ? (
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input value={newPin} onChange={e=>setNewPin(e.target.value)} placeholder="New PIN (min 4 digits)" maxLength={8}
              style={{background:C.card,border:`1px solid ${C.cardBorder}`,color:C.white,borderRadius:6,padding:"6px 10px",fontFamily:"inherit",fontSize:13,outline:"none"}} />
            <button onClick={saveNewPin} style={{background:C.green,border:"none",color:"#000",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700}}>Save PIN</button>
            <button onClick={()=>{setChangingPin(false);setPinErr("");}} style={{background:C.card,border:`1px solid ${C.cardBorder}`,color:C.white,borderRadius:6,padding:"6px 12px",cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Cancel</button>
            {pinErr && <span style={{color:C.red,fontSize:11}}>{pinErr}</span>}
          </div>
        ) : (
          <button onClick={()=>setChangingPin(true)} style={{background:C.card,border:`1px solid ${C.cardBorder}`,color:C.gray,borderRadius:6,padding:"6px 12px",cursor:"pointer",fontFamily:"inherit",fontSize:11}}>🔑 Change PIN</button>
        )}
        <button onClick={()=>{setUnlocked(false);setPin("");}} style={{background:C.card,border:`1px solid ${C.cardBorder}`,color:C.gray,borderRadius:6,padding:"6px 12px",cursor:"pointer",fontFamily:"inherit",fontSize:11}}>🔒 Lock</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12,marginBottom:20}}>
        <BigCard icon="💵" title="Gross Revenue" value={$$(money.totalBase+(money.inHouseRevenue||0)+money.teamRevenue+money.opShareFee)} color={C.blue}/>
        <BigCard icon="📈" title="Net Profit" value={$$(money.netProfit)} color={money.netProfit>=0?C.green:C.red}/>
        <BigCard icon="🤝" title="Per Partner" value={$$(money.perPartner)} color={C.gold} sub="÷ 4 partners"/>
        <BigCard icon="💰" title="Share Fee (15%)" value={$$(money.opShareFee)} color={C.purple}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <Card title="💵 Revenue In" borderColor={C.green}>
          <MRow label="Season 1 — reg + weekly fees" value={$$(money.s1base)}/>
          <MRow label="Season 2 — reg + weekly fees" value={$$(money.s2base)}/>
          <MRow label="Season 3 — playoff season" value={$$(money.s3base||0)}/>
          <MRow label="In-House leagues (reg + weekly)" value={$$(money.inHouseRevenue||0)} color={C.green}/>
          <MRow label="2v2 Doubles registrations" value={$$(money.doublesReg)} color={C.blue}/>
          <MRow label="3v3 Triples registrations" value={$$(money.triplesReg)} color={C.blue}/>
          <MRow label="15% share trading fee" value={$$(money.opShareFee)} color={C.gold}/>
          <MRow label="GROSS REVENUE" value={$$(money.totalBase+(money.inHouseRevenue||0)+money.teamRevenue+money.opShareFee)} color={C.green} big/>
        </Card>
        <Card title="💸 Costs Out" borderColor={C.red}>
          <MRow label="Bar cut — reg (10%)" value={$$(money.barCut)} color={C.red}/>
          <MRow label="Bar cut — share volume (3%)" value={$$(money.barShareCut)} color={C.red}/>
          <MRow label="Singles prizes — S1 + S2 + S3" value={$$(money.seasonPayouts)} color={C.red}/>
          <MRow label="In-house league prizes (3 leagues)" value={$$(money.inHousePrizesTotal||0)} color={C.red}/>
          <MRow label="Participation payouts" value={$$(money.participationPayouts)} color={C.red}/>
          <MRow label="Player share cuts (20%)" value={$$(money.playerShareCuts)} color={C.red}/>
          <MRow label="Team prizes — doubles + triples" value={$$(money.teamPrizes)} color={C.red}/>
          <MRow label="Salvage buybacks" value={$$(money.salvageCashOut)} color={C.red}/>
          <MRow label="TOTAL COSTS" value={$$(money.barCut+money.barShareCut+money.seasonPayouts+(money.inHousePrizesTotal||0)+money.participationPayouts+money.playerShareCuts+money.teamPrizes+money.salvageCashOut)} color={C.red} big/>
        </Card>
      </div>
      <div style={{background:"#001a0a",border:`3px solid ${C.green}`,borderRadius:12,padding:"20px 24px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:20,textAlign:"center"}}>
        <div><div style={{fontSize:11,color:C.gray,marginBottom:6}}>GROSS REVENUE</div><div style={{fontSize:26,fontWeight:900,color:C.blue}}>{$$(money.totalBase+(money.inHouseRevenue||0)+money.teamRevenue+money.opShareFee)}</div></div>
        <div><div style={{fontSize:11,color:C.gray,marginBottom:6}}>NET PROFIT</div><div style={{fontSize:26,fontWeight:900,color:money.netProfit>=0?C.green:C.red}}>{$$(money.netProfit)}</div></div>
        <div><div style={{fontSize:11,color:C.gray,marginBottom:6}}>PER PARTNER (÷4)</div><div style={{fontSize:26,fontWeight:900,color:C.gold}}>{$$(money.perPartner)}</div></div>
        <div><div style={{fontSize:11,color:C.gray,marginBottom:6}}>PRIZES PAID OUT</div><div style={{fontSize:26,fontWeight:900,color:C.red}}>{$$(money.seasonPayouts+(money.playoffPayouts||0)+money.teamPrizes)}</div></div>
      </div>
    </div>
  );
}

// ─── PAYOUTS VIEW ────────────────────────────────────────────────────────────
function PayoutsView({ supporters=[], s1standings=[], s2standings=[], s1players=[], s2players=[], money={}, bars=[], playoffs=[] }) {
  const $$ = v => "$"+(Math.round(v)||0).toLocaleString();
  const [section, setSection] = React.useState("schedule");
  const sections = [
    {id:"schedule", label:"📅 Prize Schedule"},
    {id:"shares",   label:"📈 Share Tracker"},
    {id:"operator", label:"🏢 Operator P&L"},
    {id:"bars",     label:"🏪 Bar Owners"},
    {id:"players",  label:"👤 Players"},
  ];

  // ── Share tracker data ──
  const activeSupps = supporters.filter(s=>s.name&&s.player&&(parseInt(s.shares)||0)>0);
  const shareRows = activeSupps.map(s => {
    const sharesN    = parseInt(s.shares)||0;
    const costBasis  = sharesN * (s.pricePaid||0);
    const mktPrice   = getSharePrice(s.player, s2standings.length?s2standings:s1standings, s2players.length?s2players:s1players);
    const mktValue   = sharesN * mktPrice;
    const gain       = mktValue - costBasis;
    const gainPct    = costBasis>0 ? Math.round((gain/costBasis)*100) : 0;
    const status     = s.salvaged ? "Salvaged" : s.cashedS1 ? "Cashed S1" : "Active";
    return { ...s, sharesN, costBasis, mktPrice, mktValue, gain, gainPct, status };
  }).sort((a,b)=>b.mktValue-a.mktValue);

  // ── Player P&L ──
  const allNames = [...new Set([...s1players.map(p=>p.name),...s2players.map(p=>p.name)].filter(Boolean))];
  const playerRows = allNames.map(name => {
    const s1p  = s1players.find(p=>p.name===name)||{};
    const s2p  = s2players.find(p=>p.name===name)||{};
    const costIn = (s1p.paid?150:0)+(s2p.paid?150:0)+((parseInt(s1p.weeksPaid)||0)+(parseInt(s2p.weeksPaid)||0))*25;
    const s1rank = s1standings.findIndex(x=>x.name===name);
    const s2rank = s2standings.findIndex(x=>x.name===name);
    const s1prize = s1rank===0?S1_PRIZES.p1:s1rank===1?S1_PRIZES.p2:s1rank===2?S1_PRIZES.p3:s1rank===3?(S1_PRIZES.p4||0):s1rank>=0?50:0;
    const s2prize = s2rank===0?S2_PRIZES.p1:s2rank===1?S2_PRIZES.p2:s2rank===2?S2_PRIZES.p3:s2rank===3?(S2_PRIZES.p4||0):s2rank>=0?50:0;
    const champ = playoffs.find(m=>m.round?.includes("Championship"));
    const s3prize = champ?.a===name&&(parseInt(champ?.aScore)||0)>(parseInt(champ?.bScore)||0)?S3_PRIZES.p1:
                    champ?.b===name&&(parseInt(champ?.bScore)||0)>(parseInt(champ?.aScore)||0)?S3_PRIZES.p1:0;
    const totalOut = s1prize+s2prize+s3prize;
    return { name, costIn, s1prize, s2prize, s3prize, totalOut, net:totalOut-costIn,
             s1rank, s2rank, bar: bars.find(b=>b.id===s1p.barId)||bars.find(b=>b.id===s2p.barId) };
  }).sort((a,b)=>b.net-a.net);

  // ── Bar P&L ──
  const barRows = bars.filter(b=>b.name).map(b=>{
    const myS1 = s1players.filter(p=>p.barId===b.id&&p.paid);
    const myS2 = s2players.filter(p=>p.barId===b.id&&p.paid);
    const regRev = (myS1.length*S1_REG + myS2.length*S2_REG)*BAR_REG_CUT;
    const wklyRev = (myS1.reduce((s,p)=>(parseInt(p.weeksPaid)||0)+s,0)+myS2.reduce((s,p)=>(parseInt(p.weeksPaid)||0)+s,0))*WEEK_FEE*BAR_REG_CUT;
    const shareEst = (b.barShares||0)*75;
    return { ...b, myS1, myS2, regRev, wklyRev, shareEst, total:regRev+wklyRev+shareEst };
  });

  const PRow = ({place,s1,s2,s3,color}) => (
    <div style={{display:"grid",gridTemplateColumns:"90px 1fr 1fr 1fr",gap:8,padding:"10px 0",borderBottom:`1px solid ${C.cardBorder}`,alignItems:"center"}}>
      <div style={{fontSize:13,fontWeight:900,color:color||C.white}}>{place}</div>
      <div style={{textAlign:"center",fontSize:15,fontWeight:900,color:color||C.green}}>{s1}</div>
      <div style={{textAlign:"center",fontSize:15,fontWeight:900,color:color||C.green}}>{s2}</div>
      <div style={{textAlign:"center",fontSize:15,fontWeight:900,color:color||C.gold}}>{s3}</div>
    </div>
  );
  const TRow = ({place,dPP,dTotal,tPP,tTotal,color}) => (
    <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,padding:"10px 0",borderBottom:`1px solid ${C.cardBorder}`,alignItems:"center"}}>
      <div style={{fontSize:13,fontWeight:900,color:color||C.white}}>{place}</div>
      <div style={{textAlign:"center",fontSize:14,fontWeight:700,color:color||C.blue}}>{dPP}</div>
      <div style={{textAlign:"center",fontSize:13,color:C.gray}}>{dTotal}</div>
      <div style={{textAlign:"center",fontSize:14,fontWeight:700,color:color||C.purple}}>{tPP}</div>
      <div style={{textAlign:"center",fontSize:13,color:C.gray}}>{tTotal}</div>
    </div>
  );

  return (
    <div>
      <PageTitle icon="💵" title="Payouts & Financials" desc="Prize schedule · Share tracker · P&L for operator, bar owners, and players." />

      {/* Section nav */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {sections.map(s=>(
          <button key={s.id} onClick={()=>setSection(s.id)} style={{
            background:section===s.id?C.red:C.card,
            border:`2px solid ${section===s.id?C.red:C.cardBorder}`,
            color:C.white,borderRadius:8,padding:"8px 16px",cursor:"pointer",
            fontFamily:"inherit",fontSize:13,fontWeight:section===s.id?900:400,
          }}>{s.label}</button>
        ))}
      </div>

      {/* ── PRIZE SCHEDULE ── */}
      {section==="schedule" && (
        <div>
          <Card title="🎱 Singles — Prize by Season" borderColor={C.gold} icon="🏆">
            <div style={{display:"grid",gridTemplateColumns:"90px 1fr 1fr 1fr",gap:8,padding:"8px 0",borderBottom:`2px solid ${C.cardBorder}`,marginBottom:4}}>
              {["Place","Season 1","Season 2","Season 3 🏆"].map(h=>(
                <div key={h} style={{fontSize:11,color:C.gray,fontWeight:700,textAlign:h==="Place"?"left":"center"}}>{h}</div>
              ))}
            </div>
            <PRow place="🥇 1st"      s1="$850"    s2="$1,200"  s3="$1,700"  color={C.gold}/>
            <PRow place="🥈 2nd"      s1="$450"    s2="$1,000"  s3="$1,000"  color="#aaa"/>
            <PRow place="🥉 3rd"      s1="$250"    s2="$600"    s3="$850"    color="#cd7f32"/>
            <PRow place="4th"         s1="$100"    s2="$200"    s3="$500"    color={C.blue}/>
            <PRow place="🎖 MVP"      s1="$75"     s2="$125"    s3="$400"    color={C.purple}/>
            <PRow place="All others"  s1="$50 min" s2="$50 min" s3="$50 min" color={C.gray}/>
            <div style={{marginTop:12,background:"#001a0a",border:`1px solid ${C.green}`,borderRadius:8,padding:"10px 14px",fontSize:12,color:C.gray}}>
              💡 Win all 3 seasons → max $5,250. S1/S2 1st place enters S3 <strong style={{color:C.green}}>FREE</strong>. 2nd place pays $100.
            </div>
          </Card>
          <Card title="⚡ Team Leagues — Per Person & Total" borderColor={C.blue} icon="👥">
            <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",gap:8,padding:"8px 0",borderBottom:`2px solid ${C.cardBorder}`,marginBottom:4}}>
              {["Place","2v2 /person","2v2 total","3v3 /person","3v3 total"].map(h=>(
                <div key={h} style={{fontSize:11,color:C.gray,fontWeight:700,textAlign:h==="Place"?"left":"center"}}>{h}</div>
              ))}
            </div>
            <TRow place="🥇 1st" dPP="$750"  dTotal="($1,500)" tPP="$1,000" tTotal="($3,000)" color={C.gold}/>
            <TRow place="🥈 2nd" dPP="$400"  dTotal="($800)"   tPP="$600"   tTotal="($1,800)" color="#aaa"/>
            <TRow place="🥉 3rd" dPP="$200"  dTotal="($400)"   tPP="$300"   tTotal="($900)"   color="#cd7f32"/>
            <TRow place="4th"    dPP="$125"  dTotal="($250)"   tPP="$175"   tTotal="($525)"   color={C.blue}/>
            <TRow place="5th+"   dPP="$75"   dTotal="($150)"   tPP="$75"    tTotal="($225)"   color={C.gray}/>
          </Card>
          <Card title="🏟 In-House Leagues — Prize per League (×3 leagues)" borderColor={C.green} icon="🏆">
            <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr",gap:8,padding:"8px 0",borderBottom:`2px solid ${C.cardBorder}`,marginBottom:4}}>
              {["Place","Prize","Notes"].map(h=>(
                <div key={h} style={{fontSize:11,color:C.gray,fontWeight:700,textAlign:h==="Place"?"left":"center"}}>{h}</div>
              ))}
            </div>
            {[
              {place:"🥇 1st", prize:"$500", note:"per league", color:C.gold},
              {place:"🥈 2nd", prize:"$250", note:"per league", color:"#aaa"},
              {place:"🥉 3rd", prize:"$100", note:"per league", color:"#cd7f32"},
              {place:"🎖 MVP", prize:"$50",  note:"per league", color:C.blue},
            ].map(({place,prize,note,color})=>(
              <div key={place} style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr",gap:8,padding:"10px 0",borderBottom:`1px solid ${C.cardBorder}`,alignItems:"center"}}>
                <div style={{fontSize:13,fontWeight:900,color}}>{place}</div>
                <div style={{textAlign:"center",fontSize:15,fontWeight:900,color}}>{prize}</div>
                <div style={{textAlign:"center",fontSize:12,color:C.gray}}>{note}</div>
              </div>
            ))}
            <div style={{marginTop:10,background:"#001a0a",border:`1px solid ${C.green}`,borderRadius:8,padding:"10px 14px",fontSize:12,color:C.gray}}>
              3 leagues running = <strong style={{color:C.white}}>$2,700 total in prizes</strong> paid out across all in-house leagues. Each league is separate — you can win multiple.
            </div>
          </Card>

          <Card title="💳 Registration Fees" borderColor={C.cardBorder}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              {[
                {label:"Season 1",    fee:"$150 reg", wkly:"+ $25/wk", note:"8 wks = $350 max",            color:C.gold},
                {label:"Season 2",    fee:"$175 reg", wkly:"+ $25/wk", note:"S1 alumni first pick",         color:C.purple},
                {label:"Season 3 🏆", fee:"$200 reg", wkly:"+ $25/wk", note:"1st FREE · 2nd = $100",       color:C.red},
                {label:"2v2 Teams",   fee:"$150/pp",  wkly:"$300/team",note:"Shares $45 start · $200 ceil", color:C.blue},
                {label:"3v3 Teams",   fee:"$150/pp",  wkly:"$450/team",note:"Shares $45 start · $250 ceil", color:C.purple},
                {label:"In-House",    fee:"$150 reg", wkly:"+ $25/wk", note:"Bundle 3: $400 + $65/wk",     color:C.green},
              ].map(({label,fee,wkly,note,color})=>(
                <div key={label} style={{background:C.dimBg,border:`2px solid ${color}`,borderRadius:10,padding:14,textAlign:"center"}}>
                  <div style={{fontSize:12,fontWeight:900,color,marginBottom:6}}>{label}</div>
                  <div style={{fontSize:18,fontWeight:900,color:C.white}}>{fee}</div>
                  <div style={{fontSize:13,color:C.gray,marginTop:2}}>{wkly}</div>
                  <div style={{fontSize:11,color:C.gray,marginTop:4}}>{note}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── SHARE TRACKER ── */}
      {section==="shares" && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12,marginBottom:20}}>
            <BigCard icon="💰" title="Total invested" value={$$(shareRows.reduce((s,r)=>s+r.costBasis,0))} color={C.blue}/>
            <BigCard icon="📈" title="Current market value" value={$$(shareRows.reduce((s,r)=>s+r.mktValue,0))} color={C.green}/>
            <BigCard icon="📊" title="Total gain/loss" value={$$(shareRows.reduce((s,r)=>s+r.gain,0))} color={shareRows.reduce((s,r)=>s+r.gain,0)>=0?C.green:C.red}/>
            <BigCard icon="🧾" title="Backers tracked" value={shareRows.length} color={C.gold}/>
          </div>
          {shareRows.length===0 ? (
            <div style={{color:C.gray,textAlign:"center",padding:40,fontSize:14}}>No shares entered yet. Add backers in the Shares tab.</div>
          ) : (
            <Card title="📈 Share Ledger — Every Buy, Live Value, Gain/Loss" borderColor={C.green} icon="📈">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 60px 70px 70px 80px 80px 70px 80px",gap:6,padding:"8px 0",borderBottom:`2px solid ${C.cardBorder}`,marginBottom:4}}>
                {["Backer","Player","Shares","Buy $","Mkt $","Cost In","Mkt Val","Gain","% Ret"].map(h=>(
                  <div key={h} style={{fontSize:10,color:C.gray,fontWeight:700,textAlign:"center"}}>{h}</div>
                ))}
              </div>
              {shareRows.map((r,i)=>{
                const isUp = r.gain>=0;
                return (
                  <div key={r.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 60px 70px 70px 80px 80px 70px 80px",gap:6,padding:"9px 0",borderTop:`1px solid ${C.cardBorder}`,alignItems:"center",background:i%2===0?C.card:C.dimBg}}>
                    <div style={{fontSize:12,fontWeight:700,color:r.selfBuy?C.gold:C.white}}>{r.name}{r.selfBuy?" ★":""}</div>
                    <div style={{fontSize:12,color:C.blue}}>{r.player}</div>
                    <div style={{textAlign:"center",fontSize:13,fontWeight:700}}>{r.sharesN}</div>
                    <div style={{textAlign:"center",fontSize:13,color:C.gray}}>{$$(r.pricePaid)}</div>
                    <div style={{textAlign:"center",fontSize:13,color:C.green,fontWeight:700}}>{$$(r.mktPrice)}</div>
                    <div style={{textAlign:"center",fontSize:12}}>{$$(r.costBasis)}</div>
                    <div style={{textAlign:"center",fontSize:13,fontWeight:700,color:C.blue}}>{$$(r.mktValue)}</div>
                    <div style={{textAlign:"center",fontSize:13,fontWeight:900,color:isUp?C.green:C.red}}>{isUp?"+":""}{$$(r.gain)}</div>
                    <div style={{textAlign:"center",fontSize:13,fontWeight:700,color:isUp?C.green:C.red}}>{r.gainPct>0?"+":""}{r.gainPct}%</div>
                  </div>
                );
              })}
              <div style={{marginTop:10,fontSize:11,color:C.gray}}>★ = self-buy (player buying own shares). Mkt price based on current standings.</div>
            </Card>
          )}
        </div>
      )}

      {/* ── OPERATOR P&L — PIN LOCKED ── */}
      {section==="operator" && <OperatorPLView money={money} />}

      {/* ── BAR OWNERS ── */}
      {section==="bars" && (
        <div>
          {barRows.length===0 ? (
            <div style={{color:C.gray,textAlign:"center",padding:40,fontSize:14}}>No bars set up yet. Add bar names in the Bar Tabs section.</div>
          ) : (
            <div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
                {barRows.map(b=>(
                  <BigCard key={b.id} icon="🏪" title={b.name||`Bar ${b.id}`} value={$$(b.total)} color={C.green} sub={`${b.myS1.length+b.myS2.length} players · ${b.ownerName||"Owner TBD"}`}/>
                ))}
              </div>
              {barRows.map(b=>(
                <Card key={b.id} title={`🏪 ${b.name||`Bar ${b.id}`} — ${b.ownerName||"Owner TBD"}`} borderColor={C.green} icon="🏪">
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                    <div>
                      <MRow label="Players at this bar" value={b.myS1.length+b.myS2.length}/>
                      <MRow label="Reg cut (10% of player reg)" value={$$(b.regRev)} color={C.green}/>
                      <MRow label="Weekly fee cut (10%)" value={$$(b.wklyRev)} color={C.green}/>
                      <MRow label="Bar share appreciation (est.)" value={$$(b.shareEst)} color={C.gold}/>
                      <MRow label="TOTAL EARNED" value={$$(b.total)} color={C.green} big/>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:C.gray,marginBottom:8,fontWeight:700}}>PLAYERS AT THIS BAR</div>
                      {b.myS1.length+b.myS2.length===0 ? (
                        <div style={{color:C.gray,fontSize:12}}>No players assigned yet.</div>
                      ) : [...new Set([...b.myS1.map(p=>p.name),...b.myS2.map(p=>p.name)])].map(name=>(
                        <div key={name} style={{fontSize:12,color:C.white,padding:"4px 0",borderBottom:`1px solid ${C.cardBorder}`}}>▶ {name}</div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PLAYERS ── */}
      {section==="players" && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
            <BigCard icon="💵" title="Total cost in (all players)" value={$$(playerRows.reduce((s,r)=>s+r.costIn,0))} color={C.blue}/>
            <BigCard icon="🏆" title="Total prizes out" value={$$(playerRows.reduce((s,r)=>s+r.totalOut,0))} color={C.gold}/>
            <BigCard icon="📊" title="Players in profit" value={playerRows.filter(r=>r.net>0).length+"/"+playerRows.filter(r=>r.name).length} color={C.green}/>
          </div>
          {playerRows.filter(r=>r.name).length===0 ? (
            <div style={{color:C.gray,textAlign:"center",padding:40,fontSize:14}}>No players entered yet.</div>
          ) : (
            <Card title="👤 Player P&L — Cost In vs Prizes Out" borderColor={C.gold} icon="📊">
              <div style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 70px 70px 70px 80px 90px",gap:6,padding:"8px 0",borderBottom:`2px solid ${C.cardBorder}`,marginBottom:4}}>
                {["Player","S1 Rank","S2 Rank","Cost In","S1 Prize","S2 Prize","S3 Prize","Net P&L"].map(h=>(
                  <div key={h} style={{fontSize:10,color:C.gray,fontWeight:700,textAlign:"center"}}>{h}</div>
                ))}
              </div>
              {playerRows.filter(r=>r.name).map((r,i)=>{
                const isProfit = r.net>=0;
                return (
                  <div key={r.name} style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 70px 70px 70px 80px 90px",gap:6,padding:"9px 0",borderTop:`1px solid ${C.cardBorder}`,alignItems:"center",background:i%2===0?C.card:C.dimBg}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700}}>{r.name}</div>
                      {r.bar&&<div style={{fontSize:10,color:C.gray}}>🏪 {r.bar.name}</div>}
                    </div>
                    <div style={{textAlign:"center",fontSize:12,color:r.s1rank===0?C.gold:r.s1rank<=2?C.green:C.gray}}>{r.s1rank>=0?`#${r.s1rank+1}`:"—"}</div>
                    <div style={{textAlign:"center",fontSize:12,color:r.s2rank===0?C.gold:r.s2rank<=2?C.green:C.gray}}>{r.s2rank>=0?`#${r.s2rank+1}`:"—"}</div>
                    <div style={{textAlign:"center",fontSize:12,color:C.red}}>({$$(r.costIn)})</div>
                    <div style={{textAlign:"center",fontSize:12,color:r.s1prize>0?C.green:C.gray}}>{r.s1prize>0?$$(r.s1prize):"—"}</div>
                    <div style={{textAlign:"center",fontSize:12,color:r.s2prize>0?C.green:C.gray}}>{r.s2prize>0?$$(r.s2prize):"—"}</div>
                    <div style={{textAlign:"center",fontSize:12,color:r.s3prize>0?C.gold:C.gray}}>{r.s3prize>0?$$(r.s3prize):"—"}</div>
                    <div style={{textAlign:"center",fontSize:14,fontWeight:900,color:isProfit?C.green:C.red}}>{isProfit?"+":""}{$$(r.net)}</div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
// ─── TEAMS VIEW ──────────────────────────────────────────────────────────────
function TeamsView({ doublesTeams, setDoublesTeams, triplesTeams, setTriplesTeams, money }) {
  const $$ = v => "$" + (Math.round(v)||0).toLocaleString();

  const addTeam = (format) => {
    const name = prompt(`Team name (${format==="doubles"?"2v2":"3v3"} League):`);
    if (!name) return;
    const p1 = prompt("Starter 1 name:");
    const p2 = prompt("Starter 2 name:");
    const p3 = format==="triples" ? prompt("Starter 3 name:") : null;
    if (!p1||!p2) return;
    const sub1 = prompt("Sub 1 name (optional — press Cancel to skip):") || "";
    const sub2 = prompt("Sub 2 name (optional — press Cancel to skip):") || "";
    const newTeam = { id:Date.now(), name, p1, p2, p3:p3||"", sub1, sub2, paid:false, wins:0, losses:0, sharePrice:TEAM_SHARE_START, format };
    if (format==="doubles") setDoublesTeams(t=>[...t,newTeam]);
    else setTriplesTeams(t=>[...t,newTeam]);
  };

  const togglePaid = (format, id) => {
    if (format==="doubles") setDoublesTeams(ts=>ts.map(t=>t.id===id?{...t,paid:!t.paid}:t));
    else setTriplesTeams(ts=>ts.map(t=>t.id===id?{...t,paid:!t.paid}:t));
  };

  const recordWin = (format, id) => {
    const update = ts => ts.map(t => {
      if (t.id!==id) return t;
      const wins = (t.wins||0)+1;
      const rank = format==="doubles"
        ? (format==="doubles"?doublesTeams:triplesTeams).sort((a,b)=>b.wins-a.wins).findIndex(x=>x.id===id)
        : triplesTeams.sort((a,b)=>b.wins-a.wins).findIndex(x=>x.id===id);
      const ceil = format==="doubles" ? DOUBLES_SHARE_CEIL : TRIPLES_SHARE_CEIL;
      const newPrice = Math.min(ceil, Math.max(TEAM_SHARE_FLOOR, TEAM_SHARE_START + wins*8));
      return {...t, wins, sharePrice:newPrice};
    });
    if (format==="doubles") setDoublesTeams(update);
    else setTriplesTeams(update);
  };

  const recordLoss = (format, id) => {
    const update = ts => ts.map(t => {
      if (t.id!==id) return t;
      const losses = (t.losses||0)+1;
      const ceil = format==="doubles" ? DOUBLES_SHARE_CEIL : TRIPLES_SHARE_CEIL;
      const newPrice = Math.max(TEAM_SHARE_FLOOR, (t.sharePrice||TEAM_SHARE_START) - 5);
      return {...t, losses, sharePrice:newPrice};
    });
    if (format==="doubles") setDoublesTeams(update);
    else setTriplesTeams(update);
  };

  const removeTeam = (format, id) => {
    if (!confirm("Remove this team?")) return;
    if (format==="doubles") setDoublesTeams(ts=>ts.filter(t=>t.id!==id));
    else setTriplesTeams(ts=>ts.filter(t=>t.id!==id));
  };

  const renderTeamTable = (teams, format) => {
    const ceil = format==="doubles" ? DOUBLES_SHARE_CEIL : TRIPLES_SHARE_CEIL;
    const prizes = format==="doubles" ? DOUBLES_PRIZES : TRIPLES_PRIZES;
    const perPerson = TEAM_REG_PER_PERSON;
    const perTeam = format==="doubles" ? perPerson*2 : perPerson*3;
    const sorted = [...teams].sort((a,b)=>(b.wins||0)-(a.wins||0));
    return (
      <Card title={format==="doubles" ? "⚡ 2v2 League — Doubles" : "⚡ 3v3 League — Triples"} borderColor={format==="doubles" ? C.blue : C.purple} icon={format==="doubles"?"⚡":"⚡"}>
        <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
          <BigCard icon="👥" title="Teams" value={teams.length} color={format==="doubles"?C.blue:C.purple} sub={`${perTeam}/team reg`} />
          <BigCard icon="💰" title="Reg Revenue" value={$$(teams.filter(t=>t.paid).length*perTeam)} color={C.green} sub={`${teams.filter(t=>t.paid).length} paid`} />
          <BigCard icon="📈" title="Start Price" value={$$( TEAM_SHARE_START)} color={C.gold} sub={`floor $${TEAM_SHARE_FLOOR} · ceil $${ceil}`} />
          <BigCard icon="🏆" title="Prize Pool" value={$$(teams.length>=4?prizes.p1+prizes.p2+prizes.p3+prizes.p4:teams.length===3?prizes.p1+prizes.p2+prizes.p3:teams.length===2?prizes.p1+prizes.p2:prizes.p1||0)} color={C.red} sub="1st–4th paid · 5th+ $75/person" />
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 90px 110px",gap:8,padding:"8px 0",borderBottom:`2px solid ${C.cardBorder}`,marginBottom:4}}>
          {["Team","W","L","Share $","Reg",""].map(h=>(
            <div key={h} style={{fontSize:11,color:C.gray,fontWeight:700,textAlign:"center"}}>{h}</div>
          ))}
        </div>

        {sorted.length===0 ? (
          <div style={{color:C.gray,fontSize:13,padding:"20px 0",textAlign:"center"}}>No teams yet. Add one below.</div>
        ) : sorted.map((t,i)=>{
          const perPpl = format==="doubles"?2:3;
          const prizeAmt = i===0?prizes.p1:i===1?prizes.p2:i===2?prizes.p3:i===3?prizes.p4:TEAM_PARTICIPATION_PER_PERSON*perPpl;
          return (
            <div key={t.id} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 80px 90px 110px",gap:8,padding:"10px 0",borderTop:`1px solid ${C.cardBorder}`,alignItems:"center"}}>
              <div>
                <div style={{fontSize:13,fontWeight:900,color:i===0?C.gold:i===1?"#aaa":i===2?"#cd7f32":C.white}}>
                  {i===0?"🥇":i===1?"🥈":i===2?"🥉":"  "} {t.name}
                </div>
                <div style={{fontSize:11,color:C.gray,marginTop:2}}>
                  <span style={{color:C.white}}>▶ {t.p1} · {t.p2}{t.p3?` · ${t.p3}`:""}</span>
                </div>
                {(t.sub1||t.sub2) && (
                  <div style={{fontSize:11,color:C.gray,marginTop:1}}>
                    Sub: {[t.sub1,t.sub2].filter(Boolean).join(" · ")}
                  </div>
                )}
                {prizeAmt>0 && <div style={{fontSize:11,color:C.gold,fontWeight:700}}>🏆 Prize: {$$(prizeAmt)}</div>}
              </div>
              <div style={{textAlign:"center",fontSize:14,fontWeight:900,color:C.green}}>{t.wins||0}</div>
              <div style={{textAlign:"center",fontSize:14,fontWeight:900,color:C.red}}>{t.losses||0}</div>
              <div style={{textAlign:"center"}}>
                <span style={{fontSize:13,fontWeight:900,color:t.sharePrice>=ceil*0.8?C.gold:t.sharePrice<=TEAM_SHARE_FLOOR*2?C.red:C.green}}>
                  {$$(t.sharePrice||TEAM_SHARE_START)}
                </span>
              </div>
              <div style={{textAlign:"center"}}>
                <span onClick={()=>togglePaid(format,t.id)} style={{cursor:"pointer",fontSize:11,fontWeight:700,padding:"4px 8px",borderRadius:6,background:t.paid?"#00ff0022":C.dimBg,color:t.paid?C.green:C.gray,border:`1px solid ${t.paid?C.green:C.cardBorder}`}}>
                  {t.paid?"✅ PAID":"⬜ unpaid"}
                </span>
              </div>
              <div style={{display:"flex",gap:6,justifyContent:"center"}}>
                <button onClick={()=>recordWin(format,t.id)} style={{background:"#00ff0022",color:C.green,border:`1px solid ${C.green}`,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:12,fontWeight:700}}>+W</button>
                <button onClick={()=>recordLoss(format,t.id)} style={{background:"#ff000022",color:C.red,border:`1px solid ${C.red}`,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:12,fontWeight:700}}>+L</button>
                <button onClick={()=>removeTeam(format,t.id)} style={{background:C.dimBg,color:C.gray,border:`1px solid ${C.cardBorder}`,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:12}}>✕</button>
              </div>
            </div>
          );
        })}
        <button onClick={()=>addTeam(format)} style={{marginTop:14,width:"100%",padding:"12px",background:"#00ff0011",color:C.green,border:`2px dashed ${C.green}`,borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14}}>
          + Add {format==="doubles"?"2v2 (Doubles)":"3v3 (Triples)"} Team
        </button>
      </Card>
    );
  };

  // P&L for teams
  const dPaid = doublesTeams.filter(t=>t.paid).length;
  const tPaid = triplesTeams.filter(t=>t.paid).length;
  const dRev = dPaid*2*TEAM_REG_PER_PERSON;
  const tRev = tPaid*3*TEAM_REG_PER_PERSON;
  const dBase2 = doublesTeams.length>=4?DOUBLES_PRIZES.p1+DOUBLES_PRIZES.p2+DOUBLES_PRIZES.p3+DOUBLES_PRIZES.p4:doublesTeams.length===3?DOUBLES_PRIZES.p1+DOUBLES_PRIZES.p2+DOUBLES_PRIZES.p3:doublesTeams.length===2?DOUBLES_PRIZES.p1+DOUBLES_PRIZES.p2:doublesTeams.length===1?DOUBLES_PRIZES.p1:0;
  const dPrize = dBase2 + Math.max(0,doublesTeams.length-4)*2*TEAM_PARTICIPATION_PER_PERSON;
  const tBase2 = triplesTeams.length>=4?TRIPLES_PRIZES.p1+TRIPLES_PRIZES.p2+TRIPLES_PRIZES.p3+TRIPLES_PRIZES.p4:triplesTeams.length===3?TRIPLES_PRIZES.p1+TRIPLES_PRIZES.p2+TRIPLES_PRIZES.p3:triplesTeams.length===2?TRIPLES_PRIZES.p1+TRIPLES_PRIZES.p2:triplesTeams.length===1?TRIPLES_PRIZES.p1:0;
  const tPrize = tBase2 + Math.max(0,triplesTeams.length-4)*3*TEAM_PARTICIPATION_PER_PERSON;
  const teamNet = dRev + tRev - dPrize - tPrize;

  return (
    <div>
      <PageTitle icon="👥" title="Team Play" desc="Doubles (2v2) & Triples (3v3) · $150/person reg · 1st–4th paid · 5th+ gets $75/person · Shares start $45" />
      <Tip color={C.blue}>Team share prices start at <strong>$45</strong> and move based on wins/losses. Floor is $10. Doubles max $200 · Triples max $250. More volatile than singles — bigger upside for supporters.</Tip>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12,marginBottom:20}}>
        <BigCard icon="⚡" title="2v2 Teams" value={doublesTeams.length} color={C.blue} sub={`${dPaid} paid · ${$$( dRev)} reg`} />
        <BigCard icon="⚡" title="3v3 Teams" value={triplesTeams.length} color={C.purple} sub={`${tPaid} paid · ${$$(tRev)} reg`} />
        <BigCard icon="💰" title="Team Revenue" value={$$(dRev+tRev)} color={C.green} sub="reg collected" />
        <BigCard icon="📊" title="Team Net P&L" value={$$(teamNet)} color={teamNet>=0?C.green:C.red} sub="after prizes" />
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        {renderTeamTable(doublesTeams,"doubles")}
        {renderTeamTable(triplesTeams,"triples")}
      </div>

      <Card title="📊 Team P&L Breakdown" borderColor={C.gold} icon="📊">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:C.green,marginBottom:10,paddingBottom:6,borderBottom:`2px solid ${C.green}33`}}>2v2 LEAGUE — DOUBLES</div>
            {[
              [`Reg (${dPaid} teams × 2 × $150)`, dRev, true],
              [`1st — $500/person`, DOUBLES_PRIZES.p1, false],
              [`2nd — $300/person`, DOUBLES_PRIZES.p2, false],
              [`3rd — $150/person`, DOUBLES_PRIZES.p3, false],
              [`4th — $100/person`, DOUBLES_PRIZES.p4, false],
              [`5th+ — $75/person (${Math.max(0,doublesTeams.length-4)} teams)`, Math.max(0,doublesTeams.length-4)*2*TEAM_PARTICIPATION_PER_PERSON, false],
            ].map(([l,v,isRev])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.cardBorder}`,fontSize:12}}>
                <span style={{color:C.gray}}>{l}</span>
                <span style={{color:isRev?C.green:C.red,fontWeight:700}}>{isRev?$$(v):`(${$$(v)})`}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",fontWeight:900,fontSize:13}}>
              <span>Doubles Net</span>
              <span style={{color:dRev-dPrize>=0?C.green:C.red}}>{$$(dRev-dPrize)}</span>
            </div>
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:C.purple,marginBottom:10,paddingBottom:6,borderBottom:`2px solid ${C.purple}33`}}>3v3 LEAGUE — TRIPLES</div>
            {[
              [`Reg (${tPaid} teams × 3 × $150)`, tRev, true],
              [`1st — $500/person`, TRIPLES_PRIZES.p1, false],
              [`2nd — $300/person`, TRIPLES_PRIZES.p2, false],
              [`3rd — $150/person`, TRIPLES_PRIZES.p3, false],
              [`4th — $100/person`, TRIPLES_PRIZES.p4, false],
              [`5th+ — $75/person (${Math.max(0,triplesTeams.length-4)} teams)`, Math.max(0,triplesTeams.length-4)*3*TEAM_PARTICIPATION_PER_PERSON, false],
            ].map(([l,v,isRev])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.cardBorder}`,fontSize:12}}>
                <span style={{color:C.gray}}>{l}</span>
                <span style={{color:isRev?C.purple:C.red,fontWeight:700}}>{isRev?$$(v):`(${$$(v)})`}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",fontWeight:900,fontSize:13}}>
              <span>Triples Net</span>
              <span style={{color:tRev-tPrize>=0?C.green:C.red}}>{$$(tRev-tPrize)}</span>
            </div>
          </div>
        </div>
        <div style={{marginTop:14,background:"#001a0a",border:`2px solid ${C.green}`,borderRadius:10,padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,textAlign:"center"}}>
          <div><div style={{fontSize:11,color:C.gray,marginBottom:4}}>TEAM NET (LIVE)</div><div style={{fontSize:22,fontWeight:900,color:teamNet>=0?C.green:C.red}}>{$$(teamNet)}</div></div>
          <div><div style={{fontSize:11,color:C.gray,marginBottom:4}}>PROJ (8D + 6T)</div>
            <div style={{fontSize:22,fontWeight:900,color:C.gold}}>{$$(8*2*150+6*3*150-(DOUBLES_PRIZES.p1+DOUBLES_PRIZES.p2+DOUBLES_PRIZES.p3+TRIPLES_PRIZES.p1+TRIPLES_PRIZES.p2+TRIPLES_PRIZES.p3))}</div>
          </div>
          <div><div style={{fontSize:11,color:C.gray,marginBottom:4}}>PROJ/PARTNER</div>
            <div style={{fontSize:22,fontWeight:900,color:C.gold}}>{$$((8*2*150+6*3*150-(DOUBLES_PRIZES.p1+DOUBLES_PRIZES.p2+DOUBLES_PRIZES.p3+TRIPLES_PRIZES.p1+TRIPLES_PRIZES.p2+TRIPLES_PRIZES.p3))/4)}</div>
          </div>
        </div>
        <div style={{fontSize:11,color:C.gray,marginTop:8,textAlign:"center"}}>
          Projection assumes 8 doubles teams + 6 triples teams · Share vol not included above · Shares traded separately at $45 start, $200/$250 ceiling
        </div>
      </Card>
    </div>
  );
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function BigCard({ icon, title, value, sub, color, onClick }) {
  return (
    <div onClick={onClick} style={{ background:C.card, border:`1px solid ${C.cardBorder}`, borderTop:`4px solid ${color||C.green}`, borderRadius:12, padding:18, cursor:onClick?"pointer":"default" }}>
      <div style={{ fontSize:26, marginBottom:4 }}>{icon}</div>
      <div style={{ fontSize:11, color:C.gray, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>{title}</div>
      <div style={{ fontSize:24, fontWeight:900, color:color||C.green }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:C.gray, marginTop:3 }}>{sub}</div>}
    </div>
  );
}
function Card({ children, title, icon, borderColor }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${borderColor||C.cardBorder}`, borderRadius:10, overflow:"hidden", marginBottom:16 }}>
      {title && (
        <div style={{ background:C.dimBg, padding:"10px 16px", fontSize:13, fontWeight:700, borderBottom:`1px solid ${borderColor||C.cardBorder}` }}>
          {icon && <span style={{ marginRight:6 }}>{icon}</span>}{title}
        </div>
      )}
      <div style={{ padding:16 }}>{children}</div>
    </div>
  );
}
function PageTitle({ icon, title, desc }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:26, fontWeight:900 }}>{icon} {title}</div>
      {desc && <div style={{ color:C.gray, fontSize:14, marginTop:4 }}>{desc}</div>}
    </div>
  );
}
function Tip({ children, color }) {
  return (
    <div style={{ background: color ? color+"22" : "#1a1a35", border:`1px solid ${color||"#3333aa"}`, borderRadius:8, padding:"10px 14px", fontSize:13, color:color||"#9999ee", marginBottom:16, display:"flex", gap:8 }}>
      <span>💡</span><span>{children}</span>
    </div>
  );
}
function MRow({ label, value, color, big, indent }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:big?"11px 0":"7px 0", borderBottom:`1px solid ${C.cardBorder}`, paddingLeft:indent?18:0 }}>
      <span style={{ fontSize:big?14:13, color:big?C.white:C.gray }}>{label}</span>
      <span style={{ fontSize:big?17:14, fontWeight:big?900:600, color:color||C.white }}>{value}</span>
    </div>
  );
}
function CheckBox({ checked, onChange, label, color }) {
  return (
    <button onClick={() => onChange(!checked)} style={{
      background:checked?(color||C.green)+"22":"#1a1a2e",
      border:`2px solid ${checked?(color||C.green):"#3333aa"}`,
      borderRadius:6, color:checked?(color||C.green):C.gray,
      padding:"5px 10px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700, minWidth:70,
    }}>{label}</button>
  );
}
const btnSm = { background:"#2a2a45", border:"none", color:C.white, width:26, height:26, borderRadius:6, cursor:"pointer", fontSize:16, fontWeight:700, fontFamily:"inherit" };
const selStyle = { background:C.dimBg, border:`1px solid ${C.cardBorder}`, color:C.white, borderRadius:6, padding:"8px 10px", fontFamily:"inherit", fontSize:14, width:"100%", outline:"none" };
const textInp = { background:"transparent", border:"none", borderBottom:`1px solid ${C.cardBorder}`, color:C.white, fontSize:14, padding:"4px 6px", fontFamily:"inherit", outline:"none", width:"100%" };
// ─── HOME ─────────────────────────────────────────────────────────────────────
function HomeView({ money, standings, s1standings, s2standings, season, setSeason, setTab, players }) {
  return (
    <div>
      <div style={{ textAlign:"center", padding:"16px 0 24px" }}>
        <div style={{ fontSize:48 }}>🎱</div>
        <div style={{ fontSize:26, fontWeight:900 }}>BilliardsMarketLadder</div>
        <div style={{ fontSize:15, color:C.gray, marginTop:6 }}>3 seasons · 4 game types · Per-bar live leaderboards · Shares $35–$150</div>
      </div>
      <Card title="How the 3-Season League Works" icon="📋" borderColor={C.blue}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={{ background:C.dimBg, borderRadius:8, padding:14, border:`1px solid ${C.gold}` }}>
            <div style={{ fontSize:13, fontWeight:900, color:C.gold, marginBottom:8 }}>📅 SEASON 1 — Weeks 1–8 (vol ×1.0)</div>
            <div style={{ fontSize:13, color:C.gray, lineHeight:1.7 }}>
              • Lower prizes: 1st $750 · 2nd $350 · 3rd $150<br/>
              • Shares: $35 (unranked) → $150 (#1)<br/>
              • 🔑 S1 alumni get FIRST PICK for S2 &amp; S3<br/>
              • 1st place = FREE S3 entry · 2nd = $100 S3 entry
            </div>
          </div>
          <div style={{ background:C.dimBg, borderRadius:8, padding:14, border:`1px solid ${C.purple}` }}>
            <div style={{ fontSize:13, fontWeight:900, color:C.purple, marginBottom:8 }}>📅 SEASON 2 — Weeks 9–16 (vol ×1.5)</div>
            <div style={{ fontSize:13, color:C.gray, lineHeight:1.7 }}>
              • Bigger prizes: 1st $1,500 · 2nd $700 · 3rd $300<br/>
              • S1 alumni get first registration choice<br/>
              • MORE volatile shares — bigger swings<br/>
              • 1st place = FREE S3 entry · 2nd = $100 S3 entry
            </div>
          </div>
        </div>
        <div style={{ marginTop:12, background:"#001a10", borderRadius:8, padding:"12px 16px", fontSize:13, color:C.green }}>
          💡 A player can win <strong>S1 + S2 + S3 prizes</strong> — three paydays total · S3 is the playoff season (vol ×2.5) · Max = $5,250 for S3 champion
        </div>
      </Card>
      <Card title="How Shares Work — Like a Stock" icon="📈" borderColor={C.gold}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:12 }}>
          {[["⚪ Unranked","$35",C.gray],["🔵 Top 8","$60",C.blue],["🟡 Top 4","$90",C.gold],["🟠 #2","$120","#ff6b35"],["🔴 #1","$150",C.red]].map(([l,v,c])=>(
            <div key={l} style={{ background:C.dimBg, borderRadius:8, padding:"10px 8px", textAlign:"center", border:`1px solid ${c}` }}>
              <div style={{ fontSize:11, color:C.gray }}>{l}</div>
              <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}/share</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:13, color:C.gray, lineHeight:1.8 }}>
          ✅ <strong style={{ color:C.white }}>Buy in</strong> at whatever the player is ranked right now — that price is locked as your cost.<br/>
          📈 <strong style={{ color:C.green }}>Hold</strong> and if the player climbs, your shares are worth more at cash-out.<br/>
          💵 <strong style={{ color:C.gold }}>Cash out</strong> at end of Season 1 at the current market price — or hold for Season 2 playoffs.<br/>
          🏆 <strong style={{ color:C.red }}>Final cash-out</strong> is mandatory at end of Season 2 playoffs. Champion backers earn $100/share.
        </div>
        <div style={{ marginTop:10, background:"#0a0a20", border:`1px solid ${C.blue}`, borderRadius:8, padding:"10px 14px", fontSize:13, color:C.blue }}>
          Example: Buy 5 shares at $30 when player is unranked = <strong>$150 in</strong>. Player wins championship → <strong>$1,000 back</strong>. That's a 4× return.
        </div>
      </Card>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
        <BigCard icon="💵" title="Total revenue (both seasons)" value={$$(money.totalBase)} color={C.green} onClick={() => setTab("money")} />
        <BigCard icon="📈" title="Your net profit" value={$$(money.netProfit)} color={C.red} onClick={() => setTab("money")} sub="tap for full breakdown" />
        <BigCard icon="🤝" title="Per partner ÷4" value={$$(money.perPartner)} color={C.gold} onClick={() => setTab("money")} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {[
          { tab:"players",     icon:"👤", label:"Add Players",        desc:"Register all 16 players" },
          { tab:"matches",     icon:"🎱", label:"Enter Matches",       desc:"Record weekly scores" },
          { tab:"shares",      icon:"💰", label:"Manage Shares",       desc:"Buy ins, hold, cash out" },
          { tab:"pnl",         icon:"📋", label:"Full P&L — Everyone", desc:"Players, supporters, operators, bar" },
        ].map(item => (
          <div key={item.tab} onClick={() => setTab(item.tab)} style={{ background:C.card, border:`1px solid ${C.cardBorder}`, borderRadius:10, padding:"14px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:24 }}>{item.icon}</span>
            <div>
              <div style={{ fontWeight:700, fontSize:14 }}>{item.label}</div>
              <div style={{ fontSize:12, color:C.gray }}>{item.desc}</div>
            </div>
            <span style={{ marginLeft:"auto", color:C.gray }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}
// ─── PLAYERS ─────────────────────────────────────────────────────────────────
// ─── IN-HOUSE LEAGUES ───────────────────────────────────────────────────────────────────────────────
function InHouseView({ players, setPlayers, leagueNames, setLeagueNames, standings }) {
  const updP  = (i,k,v) => setPlayers(ps=>ps.map((p,idx)=>idx===i?{...p,[k]:v}:p));
  const updLN = (i,v)   => setLeagueNames(ln=>ln.map((n,idx)=>idx===i?v:n));
  const named = players.filter(p=>p.name);
  const getCnt   = (p) => [p.inLeague1,p.inLeague2,p.inLeague3].filter(Boolean).length;
  const getWkly  = (c) => c===3 ? INHOUSE_WEEKLY_BUNDLE : c*INHOUSE_WEEKLY_FEE;
  const getReg   = (c) => c===3 ? INHOUSE_REG_BUNDLE    : c*INHOUSE_REG_FEE;
  const totalReg  = named.reduce((s,p) => p.inLeagueRegPaid ? s+getReg(getCnt(p)) : s, 0);
  const totalWkly = named.reduce((s,p) => { const c=getCnt(p); return c ? s+(parseInt(p.inLeagueWeeksPaid)||0)*getWkly(c) : s; }, 0);
  const totalRev  = totalReg + totalWkly;
  const bundleCount = named.filter(p=>p.inLeague1&&p.inLeague2&&p.inLeague3).length;
  return (
    <div>
      <PageTitle icon="🏟" title="In-House Leagues" desc={`3 leagues at 3 different bars. 1 league = $${INHOUSE_WEEKLY_FEE}/wk + $${INHOUSE_REG_FEE} reg. All 3 = $${INHOUSE_WEEKLY_BUNDLE}/wk + $${INHOUSE_REG_BUNDLE} reg. Bundle saves $50 reg + $10/wk. More leagues = higher & more volatile stock.`} />
      <Tip>Players in more leagues get a higher stock price AND their exhibition results swing the price harder. A 3-league player’s stock is the most active on the board.</Tip>

      <Card title="🍺 League Locations — Add Bar Names When Confirmed" borderColor={C.orange} icon="🍺">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          {[0,1,2].map(i=>(
            <div key={i} style={{ background:C.dimBg, borderRadius:8, padding:14, border:`1px solid ${leagueNames[i]?C.green:C.cardBorder}` }}>
              <div style={{ fontSize:11, color:C.gray, fontWeight:700, marginBottom:6 }}>LEAGUE {i+1}</div>
              <input value={leagueNames[i]} onChange={e=>updLN(i,e.target.value)} placeholder="Bar name (pending)…" style={{ ...textInp, fontSize:14, fontWeight:700 }} />
              <div style={{ marginTop:6, fontSize:11, color:leagueNames[i]?C.green:C.gray }}>
                {leagueNames[i] ? `✅ ${leagueNames[i]}` : "⏳ Pending bar agreement"}
              </div>
              <div style={{ marginTop:4, fontSize:10, color:C.blue }}>$150 reg · $25/wk · +$10/share min</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, background:"#001a2a", borderRadius:8, padding:"10px 14px", fontSize:13, color:C.blue }}>
          💡 Players at all 3 bars auto-connect. Bundle discount applies automatically when all 3 leagues checked below.
        </div>
      </Card>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:20 }}>
        <BigCard icon="💵" title="Total In-House Revenue" value={$$(totalRev)} color={C.green} />
        <BigCard icon="📋" title="Registration Collected" value={$$(totalReg)} color={C.blue} sub={`${named.filter(p=>p.inLeagueRegPaid&&getCnt(p)>0).length} players paid`} />
        <BigCard icon="📅" title="Weekly Dues Collected" value={$$(totalWkly)} color={C.gold} sub="all leagues combined" />
        <BigCard icon="🎯" title="Bundle Players (all 3)" value={`${bundleCount}`} color={C.orange} sub="save $50 reg + $10/wk" />
      </div>

      <Card title="📊 Fee Structure & Stock Impact" borderColor={C.gold}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10 }}>
          {[
            { label:"0 leagues", wkly:"—", reg:"—",                          cnt:0, color:C.gray   },
            { label:"1 league",  wkly:`$${INHOUSE_WEEKLY_FEE}/wk`,    reg:`$${INHOUSE_REG_FEE} reg`,   cnt:1, color:C.blue   },
            { label:"2 leagues", wkly:`$${INHOUSE_WEEKLY_FEE*2}/wk`,  reg:`$${INHOUSE_REG_FEE*2} reg`, cnt:2, color:C.gold   },
            { label:"3 leagues", wkly:`$${INHOUSE_WEEKLY_BUNDLE}/wk`, reg:`$${INHOUSE_REG_BUNDLE} reg`, cnt:3, color:C.red, save:"save $50 reg + $10/wk" },
          ].map(({label,wkly,reg,cnt,color,save})=>(
            <div key={label} style={{ background:C.dimBg, border:`2px solid ${color}`, borderRadius:10, padding:12, textAlign:"center" }}>
              <div style={{ fontSize:12, fontWeight:700, color, marginBottom:6 }}>{label}</div>
              <div style={{ fontSize:15, fontWeight:900, color:C.white }}>{wkly}</div>
              <div style={{ fontSize:11, color:C.gray, marginBottom:6 }}>{reg}</div>
              <div style={{ fontSize:14, fontWeight:900, color }}>+${INHOUSE_STOCK_BUMPS[cnt]}/share</div>
              <div style={{ fontSize:10, color:C.gray }}>stock bump</div>
              <div style={{ fontSize:10, color:C.orange, marginTop:2 }}>×{INHOUSE_VOL_SCALE[cnt]} swing</div>
              {save && <div style={{ fontSize:9, color:C.green, fontWeight:700, marginTop:4 }}>{save}</div>}
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, background:"#0a1a00", border:`1px solid ${C.green}`, borderRadius:8, padding:"10px 14px", fontSize:13, color:C.gray }}>
          <strong style={{ color:C.green }}>Example — All-3 bundle · 8 weeks:</strong> {" "}
          ${INHOUSE_REG_BUNDLE} reg + (8 × ${INHOUSE_WEEKLY_BUNDLE}) = <strong style={{ color:C.white }}>${INHOUSE_REG_BUNDLE + 8*INHOUSE_WEEKLY_BUNDLE} total in-house cost</strong>. Stock gets +${INHOUSE_STOCK_BUMPS[3]}/share on top of rank + exhibition.
        </div>
      </Card>

      <Card title="👤 Player League Registrations" borderColor={C.blue} icon="👤">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 55px 55px 55px 60px 70px 70px 70px 90px", gap:4, padding:"8px 0", borderBottom:`2px solid ${C.cardBorder}`, marginBottom:4 }}>
          {["Player","Lg 1","Lg 2","Lg 3","Cnt","Fee/Wk","Reg $","RegPaid","Stock +"].map(h=>(
            <div key={h} style={{ fontSize:9, color:C.gray, fontWeight:700, textAlign:"center" }}>{h}</div>
          ))}
        </div>
        {named.length===0 ? (
          <div style={{ color:C.gray, fontSize:13, padding:"20px 0", textAlign:"center" }}>Add players in the Players tab first.</div>
        ) : named.map((p,_i)=>{
          const idx = players.findIndex(x=>x.id===p.id);
          const cnt = getCnt(p);
          const regFee = getReg(cnt);
          const wklyFee = getWkly(cnt);
          const bump = INHOUSE_STOCK_BUMPS[cnt];
          const isBundle = cnt===3;
          const bumpColor = bump>=35?C.red:bump>=20?C.gold:bump>=10?C.blue:C.gray;
          return (
            <div key={p.id} style={{ display:"grid", gridTemplateColumns:"1fr 55px 55px 55px 60px 70px 70px 70px 90px", gap:4, padding:"9px 0", borderTop:`1px solid ${C.cardBorder}`, alignItems:"center", background:isBundle?"#001a08":_i%2===0?C.card:C.dimBg }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700 }}>{p.name}</div>
                {isBundle && <div style={{ fontSize:9, color:C.green, fontWeight:700 }}>✅ BUNDLE</div>}
                {cnt>0 && <div style={{ fontSize:9, color:C.gray }}>${wklyFee}/wk</div>}
              </div>
              {[1,2,3].map(n=>(
                <div key={n} style={{ display:"flex", justifyContent:"center" }}>
                  <button onClick={()=>updP(idx,`inLeague${n}`,!p[`inLeague${n}`])} style={{
                    background:p[`inLeague${n}`]?C.green+"22":"transparent",
                    border:`2px solid ${p[`inLeague${n}`]?C.green:C.cardBorder}`,
                    color:p[`inLeague${n}`]?C.green:C.gray,
                    borderRadius:6, padding:"4px 2px", cursor:"pointer",
                    fontFamily:"inherit", fontSize:12, fontWeight:700, width:"100%",
                  }}>
                    {p[`inLeague${n}`]?"✓":"—"}
                    {leagueNames[n-1] && <div style={{ fontSize:7, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{leagueNames[n-1].slice(0,7)}</div>}
                  </button>
                </div>
              ))}
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:14, fontWeight:900, color:cnt===3?C.red:cnt===2?C.gold:cnt===1?C.blue:C.gray }}>{cnt}/3</div>
              </div>
              <div style={{ textAlign:"center", fontSize:12, fontWeight:700, color:C.white }}>{cnt>0?`$${wklyFee}/wk`:"—"}</div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:12, fontWeight:700, color:isBundle?C.green:C.white }}>{cnt>0?`$${regFee}`:"—"}</div>
                {isBundle && <div style={{ fontSize:8, color:C.green }}>save $50</div>}
              </div>
              <div style={{ display:"flex", justifyContent:"center" }}>
                {cnt>0 ? (
                  <button onClick={()=>updP(idx,"inLeagueRegPaid",!p.inLeagueRegPaid)} style={{
                    background:p.inLeagueRegPaid?C.green+"22":"transparent",
                    border:`2px solid ${p.inLeagueRegPaid?C.green:C.cardBorder}`,
                    color:p.inLeagueRegPaid?C.green:C.gray,
                    borderRadius:6, padding:"4px 4px", cursor:"pointer",
                    fontFamily:"inherit", fontSize:10, fontWeight:700, width:"100%",
                  }}>{p.inLeagueRegPaid?"✓ Paid":"Unpaid"}</button>
                ) : <span style={{ textAlign:"center", display:"block", color:C.gray }}>—</span>}
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:14, fontWeight:900, color:bumpColor }}>{cnt>0?`+$${bump}`:"+$0"}</div>
                <div style={{ fontSize:8, color:C.gray }}>per share</div>
              </div>
            </div>
          );
        })}

        {named.filter(p=>getCnt(p)>0).length>0 && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:12, color:C.gray, fontWeight:700, paddingTop:10, borderTop:`1px solid ${C.cardBorder}`, marginBottom:8 }}>
              📅 WEEKLY IN-HOUSE DUES — track weeks paid per player
            </div>
            {named.filter(p=>getCnt(p)>0).map((p)=>{
              const idx = players.findIndex(x=>x.id===p.id);
              const cnt = getCnt(p);
              const wkly = getWkly(cnt);
              const wksPaid = parseInt(p.inLeagueWeeksPaid)||0;
              return (
                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:`1px solid ${C.cardBorder}` }}>
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:13, fontWeight:700 }}>{p.name}</span>
                    <span style={{ fontSize:11, color:C.gray, marginLeft:8 }}>${wkly}/wk · {cnt} league{cnt!==1?"s":""}{cnt===3?" (bundle)":""}</span>
                  </div>
                  <button onClick={()=>updP(idx,"inLeagueWeeksPaid",Math.max(0,wksPaid-1))} style={btnSm}>−</button>
                  <span style={{ minWidth:22, textAlign:"center", fontWeight:900, color:C.gold, fontSize:16 }}>{wksPaid}</span>
                  <button onClick={()=>updP(idx,"inLeagueWeeksPaid",Math.min(8,wksPaid+1))} style={btnSm}>+</button>
                  <span style={{ fontSize:12, color:C.gray, minWidth:80 }}>× ${wkly} = <strong style={{ color:C.green }}>${wksPaid*wkly}</strong></span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#001a0a", border:`2px solid ${C.green}`, padding:"12px 16px", marginTop:10, borderRadius:8 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700 }}>Total in-house revenue collected:</div>
            <div style={{ fontSize:11, color:C.gray }}>{$$(totalReg)} reg + {$$(totalWkly)} weekly dues</div>
          </div>
          <div style={{ fontSize:22, fontWeight:900, color:C.green }}>{$$(totalRev)}</div>
        </div>
      </Card>

      <Card title="⚡ Exhibition Stock Swings Per Player" borderColor={C.orange} icon="⚡">
        <Tip color={C.orange}>Exhibition wins push stock up, losses pull it down. More in-house leagues = bigger swing (volatility multiplier shown). Rank is NEVER affected by exhibition results.</Tip>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 70px 55px 60px 75px 80px", gap:6, padding:"6px 0", borderBottom:`2px solid ${C.cardBorder}`, marginBottom:4 }}>
          {["Player","Exhb W","Exhb L","Leagues","Vol ×","Swing","Stock $"].map(h=>(
            <div key={h} style={{ fontSize:10, color:C.gray, fontWeight:700, textAlign:"center" }}>{h}</div>
          ))}
        </div>
        {named.map((p)=>{
          const idx = players.findIndex(x=>x.id===p.id);
          const cnt = getCnt(p);
          const vol = INHOUSE_VOL_SCALE[cnt];
          const raw = (p.exhibWins||0)*EXHB_WIN_BUMP - (p.exhibLosses||0)*EXHB_LOSS_BUMP;
          const swing = Math.max(-EXHB_MAX*vol, Math.min(EXHB_MAX*vol, raw*vol));
          const swingColor = swing>0?C.green:swing<0?C.red:C.gray;
          const price = getSharePrice(p.name, standings, players);
          return (
            <div key={p.id} style={{ display:"grid", gridTemplateColumns:"1fr 70px 70px 55px 60px 75px 80px", gap:6, padding:"8px 0", borderTop:`1px solid ${C.cardBorder}`, alignItems:"center" }}>
              <div style={{ fontSize:13, fontWeight:700 }}>{p.name}</div>
              <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:3 }}>
                <button onClick={()=>updP(idx,"exhibWins",Math.max(0,(p.exhibWins||0)-1))} style={{...btnSm,width:18,height:18,fontSize:11}}>−</button>
                <span style={{ minWidth:18, textAlign:"center", fontWeight:900, color:C.green }}>{p.exhibWins||0}</span>
                <button onClick={()=>updP(idx,"exhibWins",(p.exhibWins||0)+1)} style={{...btnSm,width:18,height:18,fontSize:11}}>+</button>
              </div>
              <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:3 }}>
                <button onClick={()=>updP(idx,"exhibLosses",Math.max(0,(p.exhibLosses||0)-1))} style={{...btnSm,width:18,height:18,fontSize:11}}>−</button>
                <span style={{ minWidth:18, textAlign:"center", fontWeight:900, color:C.red }}>{p.exhibLosses||0}</span>
                <button onClick={()=>updP(idx,"exhibLosses",(p.exhibLosses||0)+1)} style={{...btnSm,width:18,height:18,fontSize:11}}>+</button>
              </div>
              <div style={{ textAlign:"center", fontSize:12, color:cnt>0?C.orange:C.gray, fontWeight:700 }}>{cnt}/3</div>
              <div style={{ textAlign:"center", fontSize:14, fontWeight:900, color:cnt>0?C.orange:C.gray }}>×{vol}</div>
              <div style={{ textAlign:"center", fontSize:13, fontWeight:700, color:swingColor }}>
                {swing>0?`+$${Math.round(swing)}`:swing<0?`–$${Math.abs(Math.round(swing))}`:"—"}
              </div>
              <div style={{ textAlign:"center", fontSize:14, fontWeight:900, color:C.gold }}>{$$(price)}</div>
            </div>
          );
        })}
        {named.length===0 && <div style={{ color:C.gray, fontSize:13, padding:"16px 0", textAlign:"center" }}>No named players yet.</div>}
      </Card>
    </div>
  );
}
function PlayersView({ players, setPlayers, season, bars, startPlayerStripeCheckout, playerCheckoutBusyId, matches = [] }) {
  const upd = (i,k,v) => setPlayers(ps=>ps.map((p,idx)=>idx===i?{...p,[k]:v}:p));
  const regFee = season===1?S1_REG:season===2?S2_REG:S3_REG;
  const weekKey = season===1?"weeksPaid":season===2?"s2weeksPaid":"s3weeksPaid";
  const paidKey = season===1?"paid":season===2?"s2paid":"s3paid";
  const totReg  = players.filter(p=>p[paidKey]).length * regFee;
  const totWeek = players.reduce((s,p)=>s+(parseInt(p[weekKey])||0)*WEEK_FEE,0);
  return (
    <div>
      <PageTitle icon="👤" title={`Players — Season ${season}`} desc={season===1 ? `Register players. Reg fee $${S1_REG}/player. Weekly $${WEEK_FEE}/wk. Assign bar.` : season===2 ? `S2: Reg $${S2_REG}/player. S1 alumni get first pick. Weekly $${WEEK_FEE}/wk.` : `S3 PLAYOFFS: Reg $${S3_REG} (S1/S2 winners free or half). Weekly $${WEEK_FEE}/wk.`} />
      <Tip>{season===1 ? `Check Reg Paid ($${S1_REG}). Set weeks. Assign player to a bar. S1 alumni get priority for S2+S3.` : season===2 ? `S2 reg $${S2_REG}. S1 players get sign-up priority. S1 1st place = FREE S3. S1 2nd = $100 S3.` : `S3 playoffs reg $${S3_REG} (S1/S2 1st = FREE, 2nd = $100). Vol ×2.5 — maximum volatility.`}</Tip>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
        <BigCard icon="💵" title="Registration" value={$$(totReg)} color={C.green} />
        <BigCard icon="📅" title="Weekly dues" value={$$(totWeek)} color={C.blue} />
      </div>
      <div style={{ borderRadius:10, overflow:"hidden", border:`1px solid ${C.cardBorder}` }}>
        <div style={{ display:"grid", gridTemplateColumns:"30px 1fr 90px 110px 90px 80px 80px 80px", gap:8, padding:"10px 14px", background:C.dimBg }}>
          {["#","Player Name",`Reg Paid\n($${regFee})`,"Weeks Paid","Bar","Game","Stripe Reg","Stripe Week"].map(h=>(
            <div key={h} style={{ fontSize:11, color:C.gray, fontWeight:700, textAlign:"center", whiteSpace:"pre-line", lineHeight:1.3 }}>{h}</div>
          ))}
        </div>
        {players.map((p,i)=>{
          const locked = isPlayerLocked(p, season, matches);
          const owed = getPlayerOwedAmount(p, season, matches);
          return (
            <div key={p.id} style={{ display:"grid", gridTemplateColumns:"30px 1fr 90px 110px 90px 80px 80px 80px", gap:8, padding:"9px 14px", background:locked ? "#2a0010" : (i%2===0?C.card:C.dimBg), borderTop:`1px solid ${C.cardBorder}`, borderLeft:locked?`4px solid ${C.red}`:"none", alignItems:"center" }}>
              <div style={{ fontSize:12, color:C.gray, textAlign:"center" }}>{i+1}</div>
              <div>
                <input value={p.name} onChange={e=>upd(i,"name",e.target.value)} placeholder={`Player ${i+1}`} style={{ ...textInp, borderColor: locked ? C.red : C.cardBorder }} />
                {locked && <div style={{ fontSize:10, color:C.red, fontWeight:700, marginTop:2 }}>🔒 LOCKED (Owes ${owed})</div>}
              </div>
              <div style={{ display:"flex", justifyContent:"center" }}>
                <CheckBox checked={p[paidKey]||false} onChange={v=>upd(i,paidKey,v)} label={p[paidKey]?"✓ Paid":"Unpaid"} color={C.green} />
              </div>
              <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:4 }}>
                <button onClick={()=>upd(i,weekKey,Math.max(0,(parseInt(p[weekKey])||0)-1))} style={btnSm}>−</button>
                <span style={{ minWidth:22, textAlign:"center", fontWeight:900, fontSize:16, color:C.gold }}>{p[weekKey]||0}</span>
                <button onClick={()=>upd(i,weekKey,Math.min(8,(parseInt(p[weekKey])||0)+1))} style={btnSm}>+</button>
              </div>
              <div>
                <select value={p.barId||""} onChange={e=>upd(i,"barId",e.target.value?parseInt(e.target.value):null)} style={{ ...selStyle, fontSize:11, padding:"4px 6px" }}>
                  <option value="">No bar</option>
                  {bars.map(b=><option key={b.id} value={b.id}>{b.name||`Bar ${b.id}`}</option>)}
                </select>
              </div>
              <div>
                <select value={p.preferredGame||"straight8"} onChange={e=>upd(i,"preferredGame",e.target.value)} style={{ ...selStyle, fontSize:11, padding:"4px 6px" }}>
                  {Object.entries(GAME_LABELS).map(([k,v])=><option key={k} value={k}>{v.replace("8-Ball (BCA Rules)","BCA 8").replace("Straight 8-Ball","Str. 8").replace("-Ball","")}</option>)}
                </select>
              </div>
              <div style={{ display:"flex", justifyContent:"center" }}>
                <button
                  onClick={() => startPlayerStripeCheckout && startPlayerStripeCheckout(p, "registration")}
                  disabled={!p.name || !startPlayerStripeCheckout || playerCheckoutBusyId === `registration-${p.id}`}
                  style={{ background:"#001a10", border:`1px solid ${C.green}`, color:C.green, borderRadius:6, padding:"6px 8px", cursor:"pointer", fontFamily:"inherit", fontSize:10, fontWeight:700, opacity: !p.name ? 0.5 : 1 }}>
                  {playerCheckoutBusyId === `registration-${p.id}` ? "Opening" : "Pay Reg"}
                </button>
              </div>
              <div style={{ display:"flex", justifyContent:"center" }}>
                <button
                  onClick={() => startPlayerStripeCheckout && startPlayerStripeCheckout(p, "weekly_dues")}
                  disabled={!p.name || !startPlayerStripeCheckout || playerCheckoutBusyId === `weekly_dues-${p.id}`}
                  style={{ background:"#00162a", border:`1px solid ${C.blue}`, color:C.blue, borderRadius:6, padding:"6px 8px", cursor:"pointer", fontFamily:"inherit", fontSize:10, fontWeight:700, opacity: !p.name ? 0.5 : 1 }}>
                  {playerCheckoutBusyId === `weekly_dues-${p.id}` ? "Opening" : "Pay Week"}
                </button>
              </div>
            </div>
          );
        })}
        <div style={{ background:"#0a1a0a", border:`2px solid ${C.green}`, padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:14, fontWeight:700 }}>S{season} total collected:</span>
          <span style={{ fontSize:22, fontWeight:900, color:C.green }}>{$$(totReg+totWeek)}</span>
        </div>
      </div>
    </div>
  );
}
// ─── MATCHES ─────────────────────────────────────────────────────────────────
function MatchesView({ matches, setMatches, players, season, roleMode }) {
  const upd = (i,k,v) => setMatches(ms=>ms.map((m,idx)=>idx===i?{...m,[k]:v}:m));
  const names = players.map(p=>p.name).filter(Boolean);
  const weeks = [...new Set(matches.map(m=>m.week))];
  const [openWeek, setOpenWeek] = useState(1);
  return (
    <div>
      <PageTitle icon="🎱" title={`Match Results — Season ${season}`} desc="Straight 8 · BCA 8 · 9-Ball · 10-Ball. Off-schedule matches count at ½ price impact." />
      <Tip>Game type affects stock volatility (10-ball = most volatile). Off-schedule matches move prices half as much as scheduled matches. S{season} vol ×{SEASON_VOL[season-1]}.</Tip>
      {roleMode === "player" && <Tip color={C.blue}>Player mode is read-only here. You can view schedules and completed scores, but only operators can edit match data.</Tip>}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        {Object.entries(GAME_LABELS).map(([k,v])=>(<span key={k} style={{ background:C.card, border:`1px solid ${C.cardBorder}`, borderRadius:20, padding:"4px 12px", fontSize:11, color:C.gray }}>{v} ×{GAME_VOL[k]}</span>))}
        <span style={{ background:C.card, border:`1px solid ${C.orange}`, borderRadius:20, padding:"4px 12px", fontSize:11, color:C.orange }}>Off-Schedule ×{OFF_SCHEDULE_FACTOR} impact</span>
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
        {weeks.map(w=>{
          const wm = matches.filter(m=>m.week===w);
          const done = wm.filter(m=>getWinner(m)).length;
          return (
            <button key={w} onClick={()=>setOpenWeek(w)} style={{ background:openWeek===w?C.red:C.card, border:`2px solid ${openWeek===w?C.red:C.cardBorder}`, color:C.white, borderRadius:8, padding:"8px 16px", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700 }}>
              Week {w} <span style={{ fontSize:11, opacity:0.7 }}>({done}/{wm.length})</span>
            </button>
          );
        })}
      </div>
      {matches.filter(m=>m.week===openWeek).map((m,idx)=>{
        const mi = matches.findIndex(x=>x.id===m.id);
        const w = getWinner(m);
        const playerALocked = m.a && isPlayerLocked(players.find(x => x.name === m.a), season, matches);
        const playerBLocked = m.b && isPlayerLocked(players.find(x => x.name === m.b), season, matches);
        const hasLockedPlayer = playerALocked || playerBLocked;
        return (
          <div key={m.id} style={{ background:C.card, border:`2px solid ${m.isOffSchedule?C.orange+"66":w?C.green+"66":C.cardBorder}`, borderRadius:12, padding:16, marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontSize:11, color:C.gray, fontWeight:700 }}>S{season} MATCH {m.id} — WEEK {m.week} {m.isOffSchedule?"⚡ OFF-SCHEDULE":""}</span>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {Object.entries(GAME_LABELS).map(([k,v])=>(
                  <button key={k} onClick={()=>roleMode !== "player" && upd(mi,"gameType",k)} disabled={roleMode === "player"} style={{ background:m.gameType===k?C.blue+"33":"transparent", border:`1px solid ${m.gameType===k?C.blue:C.cardBorder}`, color:m.gameType===k?C.blue:C.gray, borderRadius:6, padding:"3px 8px", cursor:roleMode === "player" ? "default" : "pointer", opacity: roleMode === "player" ? 0.75 : 1, fontFamily:"inherit", fontSize:10, fontWeight:700 }}>{v.replace(" Rules","").replace("8-Ball","8-Ball")}</button>
                ))}
                <button onClick={()=>roleMode !== "player" && upd(mi,"isOffSchedule",!m.isOffSchedule)} disabled={roleMode === "player"} style={{ background:m.isOffSchedule?C.orange+"33":"transparent", border:`1px solid ${m.isOffSchedule?C.orange:C.cardBorder}`, color:m.isOffSchedule?C.orange:C.gray, borderRadius:6, padding:"3px 8px", cursor:roleMode === "player" ? "default" : "pointer", opacity: roleMode === "player" ? 0.75 : 1, fontFamily:"inherit", fontSize:10, fontWeight:700 }}>{m.isOffSchedule?"⚡ Off-Sched":"📅 Scheduled"}</button>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 70px 1fr", gap:10, alignItems:"end" }}>
              <div>
                <div style={{ fontSize:12, color:C.gray, marginBottom:5 }}>Player A</div>
                <select value={m.a} onChange={e=>upd(mi,"a",e.target.value)} style={selStyle} disabled={roleMode === "player"}>
                  <option value="">— pick player —</option>
                  {names.map(n=>{
                    const dbP = players.find(x => x.name === n);
                    const locked = isPlayerLocked(dbP, season, matches);
                    return (
                      <option key={n} value={n}>
                        {n}{locked ? " 🔒 LOCKED" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12, color:C.gray, marginBottom:5, textAlign:"center" }}>Score</div>
                <input type="number" min={0} value={m.aScore} onChange={e=>upd(mi,"aScore",e.target.value)} style={{ ...selStyle, textAlign:"center", fontWeight:900, fontSize:22, color:C.gold }} disabled={roleMode === "player"} />
              </div>
              <div>
                <div style={{ fontSize:12, color:C.gray, marginBottom:5, textAlign:"center" }}>Score</div>
                <input type="number" min={0} value={m.bScore} onChange={e=>upd(mi,"bScore",e.target.value)} style={{ ...selStyle, textAlign:"center", fontWeight:900, fontSize:22, color:C.gold }} disabled={roleMode === "player"} />
              </div>
              <div>
                <div style={{ fontSize:12, color:C.gray, marginBottom:5 }}>Player B</div>
                <select value={m.b} onChange={e=>upd(mi,"b",e.target.value)} style={selStyle} disabled={roleMode === "player"}>
                  <option value="">— pick player —</option>
                  {names.map(n=>{
                    const dbP = players.find(x => x.name === n);
                    const locked = isPlayerLocked(dbP, season, matches);
                    return (
                      <option key={n} value={n}>
                        {n}{locked ? " 🔒 LOCKED" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            {hasLockedPlayer && (
              <div style={{ marginTop:12, background:"#2a0010", border:`1px solid ${C.red}`, borderRadius:8, padding:"10px 16px", display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:18 }}>⚠️</span>
                <span style={{ fontSize:13, fontWeight:800, color:C.red }}>
                  Warning: Match includes a locked player due to unpaid dues.
                </span>
              </div>
            )}
            {w && (
              <div style={{ marginTop:12, background:w==="Tie"?"#2a2a00":"#002a16", borderRadius:8, padding:"10px 16px", display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:22 }}>{w==="Tie"?"🤝":"🏆"}</span>
                <span style={{ fontSize:16, fontWeight:800, color:w==="Tie"?C.gold:C.green }}>{w==="Tie"?"It's a Tie!":`Winner: ${w}`}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
// ─── STANDINGS ────────────────────────────────────────────────────────────────
function StandingsView({ standings, s1standings, s2standings, s3standings, season, supporters = [], players = [], matches = [] }) {
  const seasonPrizes = season === 1 ? S1_PRIZES : season === 2 ? S2_PRIZES : S3_PRIZES;
  const getBackersStr = (playerName) => {
    const list = supporters.filter(s => s.player === playerName && (parseInt(s.shares) || 0) > 0 && !s.cashedS1 && !s.salvaged);
    if (list.length === 0) return "No backers";
    return list.map(s => `${s.name} (${s.shares})`).join(", ");
  };

  return (
    <div>
      <PageTitle icon="🏆" title={`Standings — Season ${season}`} desc="Win = 2pts · Tie = 1pt · Loss = 0" />
      {(s1standings.length > 0 || s2standings.length > 0 || s3standings.length > 0) && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
          {[{label:"S1", data:s1standings, color:C.gold},{label:"S2", data:s2standings, color:C.purple},{label:"S3 Playoffs", data:s3standings, color:C.red}].map(({label,data,color})=>(
            <div key={label} style={{ background:C.card, border:`1px solid ${color}`, borderRadius:10, overflow:"hidden" }}>
              <div style={{ background:C.dimBg, padding:"8px 14px", fontSize:12, fontWeight:700, color, borderBottom:`1px solid ${color}` }}>{label}</div>
              <div style={{ padding:12 }}>
                {data.slice(0,5).map((p,i)=>(
                  <div key={p.name} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.cardBorder}`, alignItems:"center" }}>
                    <span style={{ fontSize:13, color:i<3?[C.gold,"#ccc","#cd7f32"][i]:C.gray }}>#{i+1} {p.name}</span>
                    <span style={{ fontWeight:700, color:C.red }}>{p.pts}pts</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {standings.length===0 ? (
        <Card><div style={{ textAlign:"center", padding:40, color:C.gray }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🎱</div>
          <div>No matches yet. Enter scores in the Matches tab.</div>
        </div></Card>
      ) : (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
            {["🥇","🥈","🥉"].map((medal,i)=>(
              <div key={i} style={{ background:C.card, border:`2px solid ${[C.gold,"#aaa","#cd7f32"][i]}`, borderRadius:12, padding:20, textAlign:"center" }}>
                <div style={{ fontSize:34 }}>{medal}</div>
                {standings[i] ? (
                  <>
                    <div style={{ fontSize:18, fontWeight:900, color:[C.gold,"#ccc","#cd7f32"][i] }}>
                      {standings[i].name}
                      {isPlayerLocked(players.find(x => x.name === standings[i].name), season, matches) && <span style={{ color:C.red, fontSize:12, marginLeft:6 }}>🔒 LOCKED</span>}
                    </div>
                    <div style={{ fontSize:13, color:C.gray }}>{standings[i].pts} pts · {standings[i].w}W</div>
                    <div style={{ fontSize:15, color:C.green, fontWeight:700, marginTop:6 }}>S{season} prize: {$$([seasonPrizes.p1,seasonPrizes.p2,seasonPrizes.p3][i])}</div>
                    <div style={{ fontSize:11, color:C.gray, marginTop:6, fontStyle:"italic" }}>Backers: {getBackersStr(standings[i].name)}</div>
                  </>
                ) : <div style={{ color:C.gray, fontSize:14, marginTop:8 }}>TBD</div>}
              </div>
            ))}
          </div>
          <Card>
            <div style={{ display:"grid", gridTemplateColumns:"40px 1.5fr 50px 50px 50px 70px 80px 80px", borderBottom:`2px solid ${C.cardBorder}`, paddingBottom:8, marginBottom:4 }}>
              {["#","Name","W","L","T","Pts","Prize","Share $"].map(h=>(
                <div key={h} style={{ fontSize:11, color:C.gray, fontWeight:700, textAlign:"center" }}>{h}</div>
              ))}
            </div>
            {standings.map((p,i)=>{
              const sharePrice = getSharePrice(p.name, standings);
              const pc = sharePrice===75?C.red:sharePrice===50?C.gold:sharePrice===35?C.blue:C.gray;
              const dbPlayer = players.find(x => x.name === p.name);
              const locked = isPlayerLocked(dbPlayer, season, matches);
              const owed = getPlayerOwedAmount(dbPlayer, season, matches);
              return (
                <div key={p.name} style={{ display:"grid", gridTemplateColumns:"40px 1.5fr 50px 50px 50px 70px 80px 80px", padding:"10px 0", borderBottom:`1px solid ${C.cardBorder}`, alignItems:"center", background:i<3?`${[C.gold,"#aaa","#cd7f32"][i]}11`:"transparent" }}>
                  <div style={{ textAlign:"center", fontSize:15, fontWeight:900, color:i<3?[C.gold,"#ccc","#cd7f32"][i]:C.gray }}>#{i+1}</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
                      {p.name}
                      {locked && <span style={{ color:C.red, fontSize:10, fontWeight:800, background:"#2a0010", border:`1px solid ${C.red}`, borderRadius:4, padding:"1px 4px" }}>🔒 LOCKED (Owes ${owed})</span>}
                    </div>
                    <div style={{ fontSize:11, color:C.gray }}>Backers: {getBackersStr(p.name)}</div>
                  </div>
                  <div style={{ textAlign:"center", color:C.green, fontWeight:700 }}>{p.w}</div>
                  <div style={{ textAlign:"center", color:C.red, fontWeight:700 }}>{p.l}</div>
                  <div style={{ textAlign:"center", color:C.gray }}>{p.t}</div>
                  <div style={{ textAlign:"center", fontSize:15, fontWeight:900, color:C.red }}>{p.pts}</div>
                  <div style={{ textAlign:"center", fontSize:13, color:C.gold, fontWeight:700 }}>{i<3?$$([seasonPrizes.p1,seasonPrizes.p2,seasonPrizes.p3][i]):"—"}</div>
                  <div style={{ textAlign:"center", fontSize:14, fontWeight:900, color:pc }}>${sharePrice}</div>
                </div>
              );
            })}
          </Card>
        </>
      )}
    </div>
  );
}
// ─── PARTICIPATION ───────────────────────────────────────────────────────────
function ParticipationView({ standings, s1standings, s2standings, supporters, playoffs, money, season }) {
  const getPlayerShareCut = (name, pool) => {
    const idx = s2standings.findIndex(s=>s.name===name);
    const backerPayout = idx===0 ? Math.round(pool*0.70) : idx===1 ? Math.round(pool*0.20) : idx===2 ? Math.round(pool*0.10) : 0;
    return Math.round(backerPayout * PLAYER_SHARE_CUT);
  };
  const renderTable = (stnd, label) => (
    <Card title={label} icon="🎱" borderColor={C.blue}>
      <div style={{ display:"grid", gridTemplateColumns:"30px 1fr 80px 80px 80px 80px", gap:8, padding:"8px 0", borderBottom:`2px solid ${C.cardBorder}`, marginBottom:4 }}>
        {["#","Player","Rank Prize","Share Cut","Total",""].map(h=>(
          <div key={h} style={{ fontSize:11, color:C.gray, fontWeight:700, textAlign:"center" }}>{h}</div>
        ))}
      </div>
      {stnd.length===0 ? (
        <div style={{ color:C.gray, fontSize:13, padding:"16px 0", textAlign:"center" }}>No players yet.</div>
      ) : stnd.map((p,i) => {
        const prize = PARTICIPATION_PRIZES[i] || 65;
        const shareCut = label.includes("3") ? getPlayerShareCut(p.name, money.supPool) : 0;
        const total = prize + shareCut;
        return (
          <div key={p.name} style={{ display:"grid", gridTemplateColumns:"30px 1fr 80px 80px 80px 80px", gap:8, padding:"9px 0", borderTop:`1px solid ${C.cardBorder}`, alignItems:"center" }}>
            <div style={{ textAlign:"center", fontSize:14, fontWeight:900, color:i===0?C.gold:i===1?"#aaa":i===2?"#cd7f32":C.gray }}>{i+1}</div>
            <div style={{ fontSize:13, fontWeight:700 }}>{p.name||"—"}</div>
            <div style={{ textAlign:"center", fontSize:13, color:C.green, fontWeight:700 }}>{$$(prize)}</div>
            <div style={{ textAlign:"center", fontSize:13, color:C.purple, fontWeight:700 }}>{shareCut>0?$$(shareCut):"—"}</div>
            <div style={{ textAlign:"center", fontSize:14, fontWeight:900, color:C.gold }}>{$$(total)}</div>
            <div style={{ textAlign:"center", fontSize:10, color:C.gray }}>#{i+1} of {stnd.length}</div>
          </div>
        );
      })}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.dimBg, borderRadius:8, padding:"10px 14px", marginTop:10 }}>
        <span style={{ fontSize:13, fontWeight:700 }}>Total participation pool:</span>
        <span style={{ fontSize:16, fontWeight:900, color:C.green }}>{$$(PARTICIPATION_PRIZES.reduce((s,v)=>s+v,0))}</span>
      </div>
    </Card>
  );
  return (
    <div>
      <PageTitle icon="🎱" title="Participation Prizes" desc="EVERY player earns money each season — no exceptions. Minimum $65/season. Rank determines how much. S3 playoff share cuts go to top 3 finishers." />
      <Tip color={C.green}>💡 No one goes home empty. Whether you finish 1st or 16th, you earn a payout every season. All 3 seasons guaranteed.</Tip>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:20 }}>
        <BigCard icon="🎱" title="Per-season pool" value={$$(PARTICIPATION_PRIZES.reduce((s,v)=>s+v,0))} color={C.blue} sub="every player earns" />
        <BigCard icon="🏆" title="Total × 3 seasons" value={$$(PARTICIPATION_PRIZES.reduce((s,v)=>s+v,0)*3)} color={C.green} sub="participation only" />
        <BigCard icon="💜" title="Player share cuts" value={$$(money.playerShareCuts)} color={C.purple} sub="top 3 S3 finishers" />
        <BigCard icon="💰" title="All payouts (incl. prizes)" value={$$(money.participationPayouts + money.playerShareCuts + money.seasonPayouts)} color={C.gold} sub="full 3-season total" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:16 }}>
        {renderTable(s1standings,"Season 1 — All Players Paid")}
        {renderTable(s2standings,"Season 2 — All Players Paid")}
        {renderTable(s3standings,"Season 3 (Playoffs) — All Players Paid")}
      </div>
      <Card title="📊 Participation Prize Scale — All 16 Spots Paid Every Season" icon="📊" borderColor={C.gold}>
        <div style={{ fontSize:12, color:C.gray, marginBottom:12 }}>Every position earns something. No one finishes empty. Prizes below are per season (×3 seasons total).</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:8 }}>
          {PARTICIPATION_PRIZES.map((v,i)=>(
            <div key={i} style={{ background:C.dimBg, borderRadius:8, padding:"10px 6px", textAlign:"center" }}>
              <div style={{ fontSize:10, color:C.gray, marginBottom:4 }}>#{i+1}</div>
              <div style={{ fontSize:14, fontWeight:900, color:i===0?C.gold:i===1?"#aaa":i===2?"#cd7f32":C.green }}>{$$(v)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
// ─── SHARES ──────────────────────────────────────────────────────────────────
function SharesView({ supporters, setSupporters, players, money, standings, playoffs, season }) {
  const updSupp = (i,k,v) => setSupporters(ss=>ss.map((s,idx)=>idx===i?{...s,[k]:v}:s));
  const names = players.map(p=>p.name).filter(Boolean);
  const filled = supporters.filter(s=>s.name||s.shares>0).length;
  const cashOut = (i) => { updSupp(i,"cashedS1",true); };
  return (
    <div>
      <PageTitle icon="💰" title="Supporter Shares" desc="50 shares/player · Supporters: max 5/price-change · Players: max 6 self-buy · First buy $35 (floor $10, ceiling $150) · Vol multiplied by season + game type." />
      {season===1 && (
        <div style={{ background:"#1a1000", border:`2px solid ${C.gold}`, borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:13, color:C.gold }}>
          🔔 <strong>End of Season 1:</strong> Supporters may cash out or hold for S2. Max 5 shares/buy · First-buy $35 · Floor $10 · Ceil $150.
        </div>
      )}
      {season===2 && (
        <div style={{ background:"#1a0010", border:`2px solid ${C.red}`, borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:13, color:C.red }}>
          🔔 <strong>Season 2:</strong> Vol ×1.5 — bigger swings. 1st &amp; 2nd place earn free/discounted S3 entry.
        </div>
      )}
      {season===3 && (
        <div style={{ background:"#2a0000", border:`3px solid ${C.red}`, borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:13, color:C.red }}>
          🏆 <strong>S3 PLAYOFFS — Vol ×2.5 — MAXIMUM VOLATILITY.</strong> Top S1+S2 players compete for the biggest prizes. All shares MUST cash out after S3 finals.
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:16 }}>
        {[["⚪ Unranked","$35",C.gray,"First-buy price (floor $10)"],["🔵 Top 8","$60",C.blue,"Ranked #5–8"],["🟡 Top 4","$90",C.gold,"Ranked #3–4"],["🟠 #2","$120","#ff6b35","Runner-up"],["🔴 #1","$150",C.red,"Champion · max $150"]].map(([l,v,c,d])=>(
          <div key={l} style={{ background:C.card, border:`2px solid ${c}`, borderRadius:8, padding:"10px 8px", textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.gray, marginBottom:2 }}>{l}</div>
            <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}/share</div>
            <div style={{ fontSize:10, color:C.gray, marginTop:2 }}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:16 }}>
        <div style={{ background:"#001a2a", border:`2px solid ${C.blue}`, borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
          <div style={{ fontSize:11, color:C.gray, marginBottom:2 }}>⭐ PLAYER SELF-BUY</div>
          <div style={{ fontSize:20, fontWeight:900, color:C.blue }}>$25/share</div>
          <div style={{ fontSize:10, color:C.gray, marginTop:2 }}>First-dibs discount</div>
        </div>
        <BigCard icon="💸" title="Share volume collected" value={$$(money.shareVolCollected)} color={C.purple} />
        <BigCard icon="📈" title="Current market value (active)" value={$$(money.activeMarketVal)} color={C.green} sub="what active shares worth today" />
        <BigCard icon="💰" title="Your 15% share fee" value={$$(money.opShareFee)} color={C.gold} />
      </div>
      <Card title="🎯 Shares Sold Per Player (50 cap · Supporters ≤10/purchase · Player self-buy ≤6)" borderColor={C.blue}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
          {names.map(n=>{
            const tot = supporters.reduce((s,x)=>x.player===n?s+(parseInt(x.shares)||0):s,0);
            const pct = Math.min(tot/SHARE_CAP_PER_PLAYER,1);
            const color = pct>=1?C.red:pct>=0.75?C.gold:C.blue;
            return (
              <div key={n} style={{ background:C.dimBg, borderRadius:8, padding:"8px 10px" }}>
                <div style={{ fontSize:11, fontWeight:700, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n}</div>
                <div style={{ background:C.cardBorder, borderRadius:4, height:6, marginBottom:4 }}>
                  <div style={{ width:`${pct*100}%`, height:"100%", background:color, borderRadius:4, transition:"width 0.3s" }} />
                </div>
                <div style={{ fontSize:11, color, fontWeight:700 }}>{tot}/{SHARE_CAP_PER_PLAYER} — {$$(getSharePrice(n,standings,[],season))}/sh</div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Supporter pool splits at end of Season 2 playoffs" icon="🥧" borderColor={C.purple}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
          {[["Champion's backers","70%",money.supPool1,C.gold],["2nd place backers","20%",money.supPool2,"#aaa"],["3rd place backers","10%",money.supPool3,"#cd7f32"]].map(([lbl,pct,val,c])=>(
            <div key={lbl} style={{ background:C.dimBg, borderRadius:8, padding:14, textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:900, color:c }}>{pct}</div>
              <div style={{ fontSize:12, color:C.gray, marginBottom:6 }}>{lbl}</div>
              <div style={{ fontSize:18, fontWeight:700, color:C.green }}>{$$(val)}</div>
            </div>
          ))}
        </div>
      </Card>
      <div style={{ borderRadius:10, overflow:"hidden", border:`1px solid ${C.cardBorder}` }}>
        <div style={{ display:"grid", gridTemplateColumns:"24px 1fr 1fr 70px 80px 80px 90px 90px 90px", gap:4, padding:"10px 10px", background:C.dimBg }}>
          {["#","Supporter","Backing","Shares","Paid $","Mkt $","Gain","Playoff $","Status"].map(h=>(
            <div key={h} style={{ fontSize:10, color:C.gray, fontWeight:700, textAlign:"center", lineHeight:1.3 }}>{h}</div>
          ))}
        </div>
        {(() => {
          // Per-player share totals for cap enforcement
          const playerTotals = {};
          supporters.forEach(s => {
            if (s.player) playerTotals[s.player] = (playerTotals[s.player]||0) + (parseInt(s.shares)||0);
          });
          return supporters.slice(0, Math.max(filled+4,6)).map((s,i) => {
            const shares     = parseInt(s.shares)||0;
            const paidPrice  = s.pricePaid||30;
            const mktPrice   = getSharePrice(s.player, standings);
            const totalPaid  = shares * paidPrice;
            const totalMkt   = shares * mktPrice;
            const gain       = totalMkt - totalPaid;
            const playoutPPS = getPlayoffPayout(s.player, playoffs);
            const finalOut   = shares * playoutPPS;
            const pc         = mktPrice===200?C.red:mktPrice===150?"#ff6b35":mktPrice===100?C.gold:mktPrice===60?C.blue:C.gray;
            const playerTotal = playerTotals[s.player]||0;
            const playerAtCap = s.player && playerTotal >= SHARE_CAP_PER_PLAYER;
            const maxShares  = s.selfBuy ? PLAYER_SELF_BUY_MAX : SUPPORTER_BUY_MAX;
            const atPurchaseMax = shares >= maxShares;
            const canBuyMore = !s.cashedS1 && !s.lockedUntilMove && !playerAtCap && !atPurchaseMax;
            return (
              <div key={s.id} style={{ display:"grid", gridTemplateColumns:"24px 1fr 1fr 70px 80px 80px 90px 90px 90px", gap:4, padding:"8px 10px", background:s.cashedS1?"#0a1a0a":s.lockedUntilMove?"#1a0a00":i%2===0?C.card:C.dimBg, borderTop:`1px solid ${C.cardBorder}`, alignItems:"center", opacity:s.cashedS1?0.55:1 }}>
                <div style={{ fontSize:11, color:C.gray, textAlign:"center" }}>{i+1}</div>
                <input value={s.name} onChange={e=>updSupp(i,"name",e.target.value)} placeholder="Supporter…" style={{ ...textInp, fontSize:12 }} disabled={s.cashedS1} />
                <div>
                  <select value={s.player} onChange={e=>{ const base = s.selfBuy ? PLAYER_SELF_BUY_PRICE : getSharePrice(e.target.value, standings); const price = s.salvageType==="discount" ? Math.max(5,base-SALVAGE_DISCOUNT) : base; updSupp(i,"player",e.target.value); if (!s.shares || s.shares===0) updSupp(i,"pricePaid",price); }} style={{ ...selStyle, fontSize:12, width:"100%" }} disabled={s.cashedS1}>
                    <option value="">— pick player —</option>
                    {names.map(n=>{
                      const tot = playerTotals[n]||0;
                      return <option key={n} value={n}>{n} ({tot}/{SHARE_CAP_PER_PLAYER})</option>;
                    })}
                  </select>
                  {!s.cashedS1 && (
                    <button onClick={()=>{
                      const nowSelf = !s.selfBuy;
                      updSupp(i,"selfBuy",nowSelf);
                      if(s.shares===0) updSupp(i,"pricePaid", nowSelf ? PLAYER_SELF_BUY_PRICE : getSharePrice(s.player,standings));
                    }} style={{ marginTop:3, background:s.selfBuy?"#001a2a":"transparent", border:`1px solid ${s.selfBuy?C.blue:C.cardBorder}`, color:s.selfBuy?C.blue:C.gray, borderRadius:5, padding:"2px 5px", cursor:"pointer", fontSize:9, fontWeight:700, fontFamily:"inherit" }}>
                      {s.selfBuy ? "⭐ SELF $25" : "self buy?"}
                    </button>
                  )}
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                    <button onClick={()=>{ if(!s.cashedS1){ updSupp(i,"shares",Math.max(0,(parseInt(s.shares)||0)-1)); if(s.lockedUntilMove) updSupp(i,"lockedUntilMove",false); }}} style={{ ...btnSm, width:20, height:20, fontSize:13 }}>−</button>
                    <span style={{ minWidth:20, textAlign:"center", fontWeight:900, color:atPurchaseMax?C.red:C.gold, fontSize:14 }}>{shares}</span>
                    <button onClick={()=>{
                      if(!s.cashedS1 && !s.lockedUntilMove && !playerAtCap) {
                        const newShares = Math.min(maxShares,(parseInt(s.shares)||0)+1);
                        const base = s.selfBuy ? PLAYER_SELF_BUY_PRICE : getSharePrice(s.player, standings);
                        const p = s.salvageType==="discount" ? Math.max(5,base-SALVAGE_DISCOUNT) : base;
                        if(!s.shares||s.shares===0) updSupp(i,"pricePaid",p);
                        updSupp(i,"shares",newShares);
                        if (newShares >= maxShares) updSupp(i,"lockedUntilMove",true);
                      }
                    }} style={{ ...btnSm, width:20, height:20, fontSize:13, opacity:canBuyMore?1:0.3 }}>+</button>
                  </div>
                  <div style={{ fontSize:9, color:atPurchaseMax?C.red:C.gray, textAlign:"center" }}>{shares}/{maxShares} max</div>
                </div>
                <div style={{ textAlign:"center", fontSize:12, color:C.gray }}>{totalPaid>0?$$(totalPaid):"—"}</div>
                <div style={{ textAlign:"center", fontSize:12, fontWeight:700, color:pc }}>{totalMkt>0?$$(totalMkt):"—"}</div>
                <div style={{ textAlign:"center", fontSize:12, fontWeight:700, color:gain>0?C.green:gain<0?C.red:C.gray }}>{gain>0?`+${$$(gain)}`:gain<0?$$(gain):"—"}</div>
                <div style={{ textAlign:"center", fontSize:12, fontWeight:700, color:finalOut>0?C.purple:C.gray }}>{finalOut>0?$$(finalOut):"—"}</div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  {s.cashedS1 ? (
                    <span style={{ fontSize:11, color:C.green, fontWeight:700 }}>✓ Cashed S1</span>
                  ) : s.salvaged ? (
                    <div style={{ textAlign:"center" }}>
                      {s.salvageType==="cash" ? (
                        <span style={{ fontSize:10, color:C.green, fontWeight:700 }}>💵 Salvaged<br/>(+{$$(shares*SALVAGE_CASH)})</span>
                      ) : (
                        <span style={{ fontSize:10, color:C.blue, fontWeight:700 }}>🎟 S2 Discount<br/>(–${SALVAGE_DISCOUNT}/sh)</span>
                      )}
                    </div>
                  ) : s.lockedUntilMove ? (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                      <span style={{ fontSize:10, color:C.red, fontWeight:700 }}>🔒 LOCKED</span>
                      <button onClick={()=>{ updSupp(i,"lockedUntilMove",false); updSupp(i,"shares",0); updSupp(i,"pricePaid",getSharePrice(s.player,standings)); }} style={{ background:"#2a0010", border:`1px solid ${C.red}`, color:C.red, borderRadius:6, padding:"3px 6px", cursor:"pointer", fontSize:9, fontWeight:700, fontFamily:"inherit" }}>Player Moved ✓</button>
                    </div>
                  ) : playerAtCap ? (
                    <span style={{ fontSize:10, color:C.red, fontWeight:700 }}>CAP FULL</span>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                      <button onClick={()=>cashOut(i)} style={{ background:"#2a1a00", border:`1px solid ${C.gold}`, color:C.gold, borderRadius:6, padding:"3px 6px", cursor:"pointer", fontSize:9, fontWeight:700, fontFamily:"inherit" }}>Cash S1</button>
                      {shares>0 && (
                        <div style={{ display:"flex", gap:3 }}>
                          <button onClick={()=>{ updSupp(i,"salvaged",true); updSupp(i,"salvageType","cash"); }} style={{ background:"#001a0a", border:`1px solid ${C.green}`, color:C.green, borderRadius:5, padding:"2px 4px", cursor:"pointer", fontSize:8, fontWeight:700, fontFamily:"inherit" }} title="Get $5 back per share">💵 $5/sh</button>
                          <button onClick={()=>{ updSupp(i,"salvaged",true); updSupp(i,"salvageType","discount"); }} style={{ background:"#00102a", border:`1px solid ${C.blue}`, color:C.blue, borderRadius:5, padding:"2px 4px", cursor:"pointer", fontSize:8, fontWeight:700, fontFamily:"inherit" }} title="Get $10 off per share next season">🎟 $10 off</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          });
        })()}
        <div style={{ background:"#0a0a1a", border:`2px solid ${C.purple}`, padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:14, fontWeight:700 }}>Total share volume collected:</span>
          <span style={{ fontSize:22, fontWeight:900, color:C.purple }}>{$$(money.shareVolCollected)}</span>
        </div>
      </div>
    </div>
  );
}
// ─── PLAYOFFS ────────────────────────────────────────────────────────────────
function PlayoffsView({ standings, playoffs, setPlayoffs, roleMode }) {
  const upd = (i,k,v) => setPlayoffs(ps=>ps.map((p,idx)=>idx===i?{...p,[k]:v}:p));
  const seeds = standings.slice(0,8);
  const finalMatch = playoffs.find(m=>m.round.includes("Championship"));
  const champ = finalMatch ? getWinner(finalMatch) : null;
  return (
    <div>
      <PageTitle icon="🥊" title="Playoffs — After Season 2" desc="Top 8 from Season 2 standings. Separate prize money. All shares cash out after this." />
      {roleMode === "player" && <Tip color={C.blue}>Player mode is read-only here. You can view the bracket and results, but only operators can edit playoff matchups.</Tip>}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
        <BigCard icon="🏆" title="Playoff Champion" value={$$(PLAYOFF_PRIZES.p1)} color={C.gold} sub="on top of any season prizes" />
        <BigCard icon="🥈" title="Playoff Runner-Up" value={$$(PLAYOFF_PRIZES.p2)} color="#aaa" />
        <BigCard icon="🥉" title="Playoff 3rd Place" value={$$(PLAYOFF_PRIZES.p3)} color="#cd7f32" />
      </div>
      <Card title="Max earnings across everything" icon="💰" borderColor={C.green}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div>
            <MRow label="🥇 Season 1 — 1st place" value={$$(SEASON_PRIZES.p1)} />
            <MRow label="🥇 Season 2 — 1st place" value={$$(SEASON_PRIZES.p1)} />
            <MRow label="🏆 Playoff Champion"      value={$$(PLAYOFF_PRIZES.p1)} color={C.gold} />
            <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0 0" }}>
              <span style={{ fontWeight:900, fontSize:15 }}>Maximum total</span>
              <span style={{ fontWeight:900, fontSize:22, color:C.green }}>{$$(SEASON_PRIZES.p1*2+PLAYOFF_PRIZES.p1)}</span>
            </div>
          </div>
          <div style={{ background:C.dimBg, borderRadius:8, padding:12 }}>
            <div style={{ fontSize:12, color:C.gray, fontWeight:700, marginBottom:8 }}>SUPPORTER SHARE PAYOUTS/SHARE</div>
            {[["🏆 Champion's backers","$100"],["🥈 Finalist backers","$60"],["🥉 Semifinal losers","$30"],["🏅 QF losers","$10"]].map(([l,v])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.cardBorder}`, fontSize:13 }}>
                <span>{l}</span><span style={{ color:C.purple, fontWeight:700 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
      {champ && champ!=="Tie" && (
        <div style={{ background:"linear-gradient(135deg,#2a1800,#1a2800)", border:`3px solid ${C.gold}`, borderRadius:14, padding:24, textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:52 }}>🏆</div>
          <div style={{ fontSize:13, color:C.gray, textTransform:"uppercase", letterSpacing:2 }}>Playoff Champion</div>
          <div style={{ fontSize:30, fontWeight:900, color:C.gold }}>{champ}</div>
          <div style={{ fontSize:18, color:C.green, fontWeight:700, marginTop:6 }}>Wins $600 playoff prize!</div>
        </div>
      )}
      <Card title="Playoff Seeds — from Season 2 standings" icon="📋" borderColor={C.red}>
        {seeds.length===0 ? (
          <div style={{ color:C.gray, fontSize:13 }}>Finish Season 2 matches first. Top 8 auto-seed here.</div>
        ) : seeds.map((p,i)=>(
          <div key={p.name} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${C.cardBorder}` }}>
            <div style={{ width:30, height:30, borderRadius:"50%", background:i<3?[C.gold,"#aaa","#cd7f32"][i]:C.dimBg, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13, color:i<3?"#000":C.gray, flexShrink:0 }}>{i+1}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:700 }}>{p.name}</div>
              <div style={{ fontSize:12, color:C.gray }}>{p.pts} pts · {p.w}W {p.l}L</div>
            </div>
          </div>
        ))}
      </Card>
      <div style={{ fontSize:18, fontWeight:900, marginBottom:14 }}>🥊 Bracket Results</div>
      {playoffs.map((m,i)=>{
        const w = getWinner(m);
        const isFinal = m.round.includes("Championship");
        return (
          <div key={m.id} style={{ background:isFinal?"#1a1500":C.card, border:`2px solid ${isFinal?C.gold:w?C.green+"66":C.cardBorder}`, borderRadius:12, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:13, color:isFinal?C.gold:C.gray, fontWeight:700, marginBottom:12 }}>{m.round}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 60px 60px 1fr", gap:10, alignItems:"end" }}>
              <div>
                <div style={{ fontSize:12, color:C.gray, marginBottom:5 }}>Player A</div>
                <input value={m.a} onChange={e=>upd(i,"a",e.target.value)} placeholder="Name…" style={selStyle} disabled={roleMode === "player"} />
              </div>
              <div>
                <div style={{ fontSize:12, color:C.gray, marginBottom:5, textAlign:"center" }}>Score</div>
                <input type="number" min={0} value={m.aScore} onChange={e=>upd(i,"aScore",e.target.value)} style={{ ...selStyle, textAlign:"center", fontWeight:900, fontSize:22, color:C.gold }} disabled={roleMode === "player"} />
              </div>
              <div>
                <div style={{ fontSize:12, color:C.gray, marginBottom:5, textAlign:"center" }}>Score</div>
                <input type="number" min={0} value={m.bScore} onChange={e=>upd(i,"bScore",e.target.value)} style={{ ...selStyle, textAlign:"center", fontWeight:900, fontSize:22, color:C.gold }} disabled={roleMode === "player"} />
              </div>
              <div>
                <div style={{ fontSize:12, color:C.gray, marginBottom:5 }}>Player B</div>
                <input value={m.b} onChange={e=>upd(i,"b",e.target.value)} placeholder="Name…" style={selStyle} disabled={roleMode === "player"} />
              </div>
            </div>
            {w && (
              <div style={{ marginTop:12, background:isFinal?"#2a2000":"#002a16", borderRadius:8, padding:"10px 16px", display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:22 }}>{isFinal?"🏆":"✅"}</span>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:isFinal?C.gold:C.green }}>{isFinal?`Champion: ${w}`:`Winner: ${w}`}</div>
                  {isFinal && <div style={{ fontSize:13, color:C.green }}>Earns $600 + all supporter shares cash out now!</div>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
// ─── MONEY ───────────────────────────────────────────────────────────────────
function MoneyView({ money }) {
  return (
    <div>
      <PageTitle icon="📊" title="Money Breakdown" desc="Both seasons combined. Updates live as you enter data." />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
        <BigCard icon="💵" title="Total revenue (S1+S2)" value={$$(money.totalBase)} color={C.blue} />
        <BigCard icon="💰" title="Share volume collected" value={$$(money.shareVolCollected)} color={C.purple} sub={`Supporter pool: ${$$(money.supPool)}`} />
        <BigCard icon="📈" title="Your net profit" value={$$(money.netProfit)} color={C.green} />
        <BigCard icon="🤝" title="Each partner gets" value={$$(money.perPartner)} color={C.gold} sub="÷ 4 partners" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Card title="💵 Revenue In" borderColor={C.green}>
          <MRow label="Season 1 base revenue" value={$$(money.s1base)} />
          <MRow label="Season 2 base revenue" value={$$(money.s2base)} />
          <MRow label="Season 3 playoffs revenue" value={$$(money.s3base||0)} />
          <MRow label="In-House leagues (reg + weekly dues)" value={$$(money.inHouseRevenue)} color={C.green} />
          <MRow label="Season 2 base revenue" value={$$(money.s2base)} />
          <MRow label="Total base revenue" value={$$(money.totalBase)} color={C.green} big />
          <div style={{ height:10 }} />
          <MRow label="Share volume collected" value={$$(money.shareVolCollected)} />
          <MRow label="Active shares market value" value={$$(money.activeMarketVal)} color={C.blue} />
          <MRow label="Your 15% share fee" value={$$(money.opShareFee)} color={C.gold} />
        </Card>
        <Card title="💸 Money Out" borderColor={C.red}>
          <MRow label="Bar cut — 5% of base rev" value={$$(money.barCut)} color={C.red} />
          <MRow label="Bar share cut — 2% of shares" value={$$(money.barShareCut)} color={C.red} />
          <div style={{ height:8 }} />
          <MRow label="Season prizes × 2 seasons" value={$$(money.seasonPayouts)} />
          <MRow label="Playoff prizes" value={$$(money.playoffPayouts)} color={C.purple} />
          <MRow label="Supporter prize pool" value={$$(money.supPool)} />
          <MRow label="Participation prizes (×2)" value={$$(money.participationPayouts)} />
          <MRow label="Player share cuts (20%)" value={$$(money.playerShareCuts)} color={C.purple} />
        </Card>
      </div>
      <Card title="🧮 Your Profit — Step by Step" borderColor={C.gold}>
        <MRow label="Total base revenue (both seasons)" value={$$(money.totalBase)} />
        <MRow label="– Bar cut (5%)" value={`– ${$$(money.barCut)}`} color={C.red} indent />
        <MRow label="– Season prizes (×2)" value={`– ${$$(money.seasonPayouts)}`} color={C.red} indent />
        <MRow label="– Playoff prizes" value={`– ${$$(money.playoffPayouts)}`} color={C.red} indent />
        <MRow label="– Participation prizes (×2)" value={`– ${$$(money.participationPayouts)}`} color={C.red} indent />
        <MRow label="– Player share cuts (20%)" value={`– ${$$(money.playerShareCuts)}`} color={C.red} indent />
        <MRow label="– Salvage cash buybacks" value={`– ${$$(money.salvageCashOut)}`} color={C.red} indent />
        <MRow label="+ In-House leagues (reg + dues)" value={`+ ${$$(money.inHouseRevenue)}`} color={C.green} indent />
        <MRow label="= Base Profit" value={$$(money.baseProfit)} color={C.blue} big />
        <MRow label="+ Your 15% share fee" value={`+ ${$$(money.opShareFee)}`} color={C.green} indent />
        <MRow label="– Bar share cut (2%)" value={`– ${$$(money.barShareCut)}`} color={C.red} indent />
        <div style={{ background:"#001a0a", borderRadius:10, padding:"16px 20px", marginTop:14, border:`2px solid ${C.green}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700 }}>NET OPERATOR PROFIT</div>
            <div style={{ fontSize:12, color:C.gray }}>÷ 4 partners</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:30, fontWeight:900, color:C.green }}>{$$(money.netProfit)}</div>
            <div style={{ fontSize:16, color:C.gold, fontWeight:700 }}>{$$(money.perPartner)} each</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
// ─── P&L ALL STAKEHOLDERS ────────────────────────────────────────────────────
function PnLView({ s1players, s2players, s1standings, s2standings, supporters, playoffs, money }) {
  const allPlayerNames = [...new Set([
    ...s1players.map(p=>p.name).filter(Boolean),
    ...s2players.map(p=>p.name).filter(Boolean),
  ])];
  const playerRows = allPlayerNames.map(name => {
    const s1p = s1players.find(p=>p.name===name)||{};
    const s2p = s2players.find(p=>p.name===name)||{};
    const s1reg   = s1p.paid ? 150 : 0;
    const s2reg   = s2p.paid ? 150 : 0;
    const s1weeks = (parseInt(s1p.weeksPaid)||0)*25;
    const s2weeks = (parseInt(s2p.weeksPaid)||0)*25;
    const totalIn = s1reg + s2reg + s1weeks + s2weeks;
    const s1rank = s1standings.findIndex(s=>s.name===name);
    const s2rank = s2standings.findIndex(s=>s.name===name);
    const s1prize = s1rank===0?SEASON_PRIZES.p1:s1rank===1?SEASON_PRIZES.p2:s1rank===2?SEASON_PRIZES.p3:0;
    const s2prize = s2rank===0?SEASON_PRIZES.p1:s2rank===1?SEASON_PRIZES.p2:s2rank===2?SEASON_PRIZES.p3:0;
    const champ = playoffs.find(m=>m.round.includes("Championship"));
    const sf1   = playoffs.find(m=>m.round.includes("Semifinal 1"));
    const sf2   = playoffs.find(m=>m.round.includes("Semifinal 2"));
    const cw  = champ ? getWinner(champ) : null;
    const s1w = sf1   ? getWinner(sf1)   : null;
    const s2w = sf2   ? getWinner(sf2)   : null;
    let playoffPrize = 0;
    if (cw===name) playoffPrize = PLAYOFF_PRIZES.p1;
    else if (champ && (champ.a===name||champ.b===name)) playoffPrize = PLAYOFF_PRIZES.p2;
    else if (s1w===name||s2w===name) playoffPrize = PLAYOFF_PRIZES.p3;
    const s1rank2 = s1standings.findIndex(s=>s.name===name);
    const s2rank2 = s2standings.findIndex(s=>s.name===name);
    const s1participation = s1rank2>=0 ? (PARTICIPATION_PRIZES[s1rank2]||15) : 0;
    const s2participation = s2rank2>=0 ? (PARTICIPATION_PRIZES[s2rank2]||15) : 0;
    // In-house league cost
    const calcIH = (pp) => {
      const c=[pp.inLeague1||false,pp.inLeague2||false,pp.inLeague3||false].filter(Boolean).length;
      if(!c) return 0;
      const reg = pp.inLeagueRegPaid?(c===3?INHOUSE_REG_BUNDLE:c*INHOUSE_REG_FEE):0;
      const wk  = c===3?INHOUSE_WEEKLY_BUNDLE:c*INHOUSE_WEEKLY_FEE;
      return reg + (parseInt(pp.inLeagueWeeksPaid)||0)*wk;
    };
    const inhouseCost = calcIH(s1p) + calcIH(s2p);
    const totalOut = s1prize + s2prize + playoffPrize + s1participation + s2participation;
    const net      = totalOut - totalIn - inhouseCost;
    return { name, totalIn: totalIn+inhouseCost, s1prize, s2prize, playoffPrize, totalOut, net, s1rank, s2rank };
  });
  const activeSupp = supporters.filter(s=>s.name||s.shares>0);
  const suppRows = activeSupp.map(s => {
    const shares     = parseInt(s.shares)||0;
    const totalIn    = shares * (s.pricePaid||30);
    const playoutPPS = getPlayoffPayout(s.player, playoffs);
    const totalOut   = s.cashedS1 ? shares * (s.pricePaid||30) : shares * playoutPPS;
    const net = totalOut - totalIn;
    return { ...s, shares, totalIn, totalOut, net, playoutPPS };
  });
  const [filter, setFilter] = useState("all");
  const sortedPlayers = [...playerRows].sort((a,b)=>b.net-a.net);
  return (
    <div>
      <PageTitle icon="📋" title="P&L — Everyone" desc="Full profit & loss for every stakeholder." />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:20 }}>
        <div style={{ background:C.card, border:`2px solid ${C.green}`, borderRadius:10, padding:14, textAlign:"center" }}>
          <div style={{ fontSize:11, color:C.gray, marginBottom:4 }}>OPERATOR NET</div>
          <div style={{ fontSize:22, fontWeight:900, color:C.green }}>{$$(money.netProfit)}</div>
          <div style={{ fontSize:11, color:C.gray }}>{$$(money.perPartner)} / partner</div>
        </div>
        <div style={{ background:C.card, border:`2px solid ${C.orange}`, borderRadius:10, padding:14, textAlign:"center" }}>
          <div style={{ fontSize:11, color:C.gray, marginBottom:4 }}>BAR TAKE</div>
          <div style={{ fontSize:22, fontWeight:900, color:C.orange }}>{$$(money.totalBar)}</div>
          <div style={{ fontSize:11, color:C.gray }}>5% base + 2% shares</div>
        </div>
        <div style={{ background:C.card, border:`2px solid ${C.gold}`, borderRadius:10, padding:14, textAlign:"center" }}>
          <div style={{ fontSize:11, color:C.gray, marginBottom:4 }}>PLAYER PRIZES PAID</div>
          <div style={{ fontSize:22, fontWeight:900, color:C.gold }}>{$$(money.seasonPayouts + money.playoffPayouts + money.participationPayouts)}</div>
          <div style={{ fontSize:11, color:C.gray }}>seasons + playoffs + participation</div>
        </div>
        <div style={{ background:C.card, border:`2px solid ${C.purple}`, borderRadius:10, padding:14, textAlign:"center" }}>
          <div style={{ fontSize:11, color:C.gray, marginBottom:4 }}>SUPPORTER POOL</div>
          <div style={{ fontSize:22, fontWeight:900, color:C.purple }}>{$$(money.supPool)}</div>
          <div style={{ fontSize:11, color:C.gray }}>from share volume</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[["all","All"],["players","Players"],["supporters","Supporters"],["ops","Operator / Bar"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setFilter(id)} style={{ background:filter===id?C.red:C.card, border:`2px solid ${filter===id?C.red:C.cardBorder}`, color:C.white, borderRadius:8, padding:"6px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700 }}>{lbl}</button>
        ))}
      </div>
      {(filter==="all"||filter==="players") && (
        <Card title="👤 Players — Cost In vs Prizes Out" borderColor={C.gold}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 70px 70px 70px 80px 90px", gap:6, padding:"8px 0", borderBottom:`2px solid ${C.cardBorder}`, marginBottom:4 }}>
            {["Player","Cost In","S1 Prize","S2 Prize","Playoff","Total Out","Net P&L"].map(h=>(
              <div key={h} style={{ fontSize:10, color:C.gray, fontWeight:700, textAlign:"center" }}>{h}</div>
            ))}
          </div>
          {sortedPlayers.length===0 ? (
            <div style={{ color:C.gray, fontSize:13, padding:"16px 0", textAlign:"center" }}>No players entered yet.</div>
          ) : sortedPlayers.map((p, i) => {
            const netColor = p.net > 0 ? C.green : p.net < 0 ? C.red : C.gray;
            const netBg    = p.net > 0 ? "#002a16" : p.net < 0 ? "#2a0010" : "transparent";
            return (
              <div key={p.name} style={{ display:"grid", gridTemplateColumns:"1fr 70px 70px 70px 70px 80px 90px", gap:6, padding:"10px 0", borderBottom:`1px solid ${C.cardBorder}`, alignItems:"center" }}>
                <div style={{ fontWeight:700, fontSize:13 }}>{p.name}</div>
                <div style={{ textAlign:"center", fontSize:12, color:C.red }}>–{$$(p.totalIn)}</div>
                <div style={{ textAlign:"center", fontSize:12, color:p.s1prize>0?C.gold:C.gray, fontWeight:p.s1prize>0?700:400 }}>{p.s1prize>0?$$(p.s1prize):"—"}</div>
                <div style={{ textAlign:"center", fontSize:12, color:p.s2prize>0?C.gold:C.gray, fontWeight:p.s2prize>0?700:400 }}>{p.s2prize>0?$$(p.s2prize):"—"}</div>
                <div style={{ textAlign:"center", fontSize:12, color:p.playoffPrize>0?C.purple:C.gray, fontWeight:p.playoffPrize>0?700:400 }}>{p.playoffPrize>0?$$(p.playoffPrize):"—"}</div>
                <div style={{ textAlign:"center", fontSize:13, fontWeight:700, color:C.green }}>{p.totalOut>0?$$(p.totalOut):"—"}</div>
                <div style={{ textAlign:"center", fontSize:14, fontWeight:900, color:netColor, background:netBg, borderRadius:6, padding:"3px 6px" }}>
                  {p.net>0?`+${$$(p.net)}`:p.net<0?$$(p.net):"$0"}
                </div>
              </div>
            );
          })}
        </Card>
      )}
      {(filter==="all"||filter==="supporters") && (
        <Card title="💰 Supporters — Investment vs Payout" borderColor={C.purple}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 70px 80px 80px 90px 90px", gap:6, padding:"8px 0", borderBottom:`2px solid ${C.cardBorder}`, marginBottom:4 }}>
            {["Supporter","Backing","Shares","Paid In","$/Share Out","Total Out","Net P&L"].map(h=>(
              <div key={h} style={{ fontSize:10, color:C.gray, fontWeight:700, textAlign:"center" }}>{h}</div>
            ))}
          </div>
          {suppRows.length===0 ? (
            <div style={{ color:C.gray, fontSize:13, padding:"16px 0", textAlign:"center" }}>No supporters entered yet.</div>
          ) : suppRows.map((s, i) => {
            const netColor = s.net > 0 ? C.green : s.net < 0 ? C.red : C.gray;
            const netBg    = s.net > 0 ? "#002a16" : s.net < 0 ? "#2a0010" : "transparent";
            return (
              <div key={s.id} style={{ display:"grid", gridTemplateColumns:"1fr 80px 70px 80px 80px 90px 90px", gap:6, padding:"9px 0", borderBottom:`1px solid ${C.cardBorder}`, alignItems:"center", opacity:s.cashedS1?0.7:1 }}>
                <div style={{ fontWeight:700, fontSize:13 }}>{s.name||`Supporter ${s.id}`}{s.cashedS1 && <span style={{ fontSize:10, color:C.green, marginLeft:6 }}>✓ Cashed S1</span>}</div>
                <div style={{ textAlign:"center", fontSize:12, color:C.blue }}>{s.player||"—"}</div>
                <div style={{ textAlign:"center", fontSize:13, fontWeight:700, color:C.gold }}>{s.shares}</div>
                <div style={{ textAlign:"center", fontSize:12, color:C.red }}>–{$$(s.totalIn)}</div>
                <div style={{ textAlign:"center", fontSize:12, color:s.playoutPPS>0?C.purple:C.gray, fontWeight:700 }}>{s.cashedS1 ? `$${s.pricePaid||30}` : s.playoutPPS>0 ? `$${s.playoutPPS}` : "TBD"}</div>
                <div style={{ textAlign:"center", fontSize:13, fontWeight:700, color:C.green }}>{s.totalOut>0?$$(s.totalOut):"TBD"}</div>
                <div style={{ textAlign:"center", fontSize:14, fontWeight:900, color:netColor, background:netBg, borderRadius:6, padding:"3px 6px" }}>
                  {s.cashedS1 ? (s.net===0?"$0":s.net>0?`+${$$(s.net)}`:$$(s.net)) : s.playoutPPS>0 ? (s.net>0?`+${$$(s.net)}`:$$(s.net)) : "TBD"}
                </div>
              </div>
            );
          })}
        </Card>
      )}
      {(filter==="all"||filter==="ops") && (
        <Card title="⚡ Operator & Bar" borderColor={C.green}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.green, marginBottom:10, paddingBottom:6, borderBottom:`1px solid ${C.cardBorder}` }}>⚡ Operator (4 Partners)</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10 }}>
              <div style={{ background:C.dimBg, borderRadius:8, padding:12, textAlign:"center" }}>
                <div style={{ fontSize:11, color:C.gray, marginBottom:4 }}>REVENUE IN</div>
                <div style={{ fontSize:16, fontWeight:900, color:C.blue }}>{$$(money.totalBase)}</div>
              </div>
              <div style={{ background:C.dimBg, borderRadius:8, padding:12, textAlign:"center" }}>
                <div style={{ fontSize:11, color:C.gray, marginBottom:4 }}>SHARE FEE (15%)</div>
                <div style={{ fontSize:16, fontWeight:900, color:C.gold }}>{$$(money.opShareFee)}</div>
              </div>
              <div style={{ background:C.dimBg, borderRadius:8, padding:12, textAlign:"center" }}>
                <div style={{ fontSize:11, color:C.gray, marginBottom:4 }}>COSTS OUT</div>
                <div style={{ fontSize:16, fontWeight:900, color:C.red }}>–{$$(money.barCut + money.seasonPayouts + money.playoffPayouts + money.participationPayouts + money.playerShareCuts + money.barShareCut)}</div>
              </div>
              <div style={{ background:"#001a0a", borderRadius:8, padding:12, textAlign:"center", border:`2px solid ${C.green}` }}>
                <div style={{ fontSize:11, color:C.gray, marginBottom:4 }}>NET PROFIT</div>
                <div style={{ fontSize:20, fontWeight:900, color:C.green }}>{$$(money.netProfit)}</div>
                <div style={{ fontSize:12, color:C.gold, fontWeight:700 }}>{$$(money.perPartner)} each</div>
              </div>
            </div>
          </div>
          <div style={{ borderTop:`2px solid ${C.cardBorder}`, paddingTop:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.orange, marginBottom:10 }}>🍺 Bar</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              <div style={{ background:C.dimBg, borderRadius:8, padding:12, textAlign:"center" }}>
                <div style={{ fontSize:11, color:C.gray, marginBottom:4 }}>5% OF BASE REV</div>
                <div style={{ fontSize:16, fontWeight:900, color:C.orange }}>{$$(money.barCut)}</div>
              </div>
              <div style={{ background:C.dimBg, borderRadius:8, padding:12, textAlign:"center" }}>
                <div style={{ fontSize:11, color:C.gray, marginBottom:4 }}>2% OF SHARES</div>
                <div style={{ fontSize:16, fontWeight:900, color:C.orange }}>{$$(money.barShareCut)}</div>
              </div>
              <div style={{ background:"#1a0d00", borderRadius:8, padding:12, textAlign:"center", border:`2px solid ${C.orange}` }}>
                <div style={{ fontSize:11, color:C.gray, marginBottom:4 }}>TOTAL BAR TAKE</div>
                <div style={{ fontSize:20, fontWeight:900, color:C.orange }}>{$$(money.totalBar)}</div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
// ─── PLAYER BOARD ─────────────────────────────────────────────────────────────
function PlayerBoardView({ standings, s1standings, s2standings, playoffs, supporters = [], season, startStripeCheckout, checkoutBusyId, players = [], matches = [], startPlayerStripeCheckout, playerCheckoutBusyId }) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedYourName, setSelectedYourName] = useState("");

  const finalMatch = playoffs.find(m=>m.round.includes("Championship"));
  const champ = finalMatch ? getWinner(finalMatch) : null;
  const marketPrice = selectedPlayer ? getSharePrice(selectedPlayer, standings, players) : 0;
  
  const seasonPrizes = season === 1 ? S1_PRIZES : season === 2 ? S2_PRIZES : S3_PRIZES;

  const getBackersStr = (playerName) => {
    const list = supporters.filter(s => s.player === playerName && (parseInt(s.shares) || 0) > 0 && !s.cashedS1 && !s.salvaged);
    if (list.length === 0) return "No backers";
    return list.map(s => `${s.name} (${s.shares})`).join(", ");
  };

  const yourPlayerObj = players.find(p => p.name === selectedYourName);
  const isYourLocked = yourPlayerObj ? isPlayerLocked(yourPlayerObj, season, matches) : false;
  const yourOwedAmount = yourPlayerObj ? getPlayerOwedAmount(yourPlayerObj, season, matches) : 0;

  return (
    <div>
      <div style={{ background:"linear-gradient(135deg,#0a0a1a,#16162a)", border:`2px solid ${C.red}`, borderRadius:14, padding:"24px 20px", textAlign:"center", marginBottom:24 }}>
        <div style={{ fontSize:11, color:C.red, letterSpacing:4, textTransform:"uppercase", fontWeight:700, marginBottom:4 }}>Action Ladder</div>
        <div style={{ fontSize:30, fontWeight:900, color:C.white }}>🎱 BilliardsMarketLadder</div>
        <div style={{ fontSize:14, color:C.gray, marginTop:4 }}>Live Standings · Share Prices · Prize Board</div>
        <div style={{ marginTop:10, display:"inline-block", background:season===1?C.gold+"22":C.purple+"22", border:`1px solid ${season===1?C.gold:C.purple}`, borderRadius:6, padding:"4px 14px", fontSize:13, color:season===1?C.gold:C.purple, fontWeight:700 }}>
          Currently: Season {season}
        </div>
      </div>

      <div style={{ marginBottom:24 }}>
        <Card title="My Account & Dues" borderColor={C.blue} icon="👤">
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", gap:12, alignItems:"end", flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ fontSize:12, color:C.gray, marginBottom:5 }}>Select your player name to check dues:</div>
                <select value={selectedYourName} onChange={e => setSelectedYourName(e.target.value)} style={selStyle}>
                  <option value="">— select your name —</option>
                  {players.filter(p => p.name).map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              {yourPlayerObj && (
                <div style={{ display:"flex", gap:8 }}>
                  <button
                    onClick={() => startPlayerStripeCheckout && startPlayerStripeCheckout(yourPlayerObj, "registration")}
                    disabled={yourPlayerObj[season === 1 ? "paid" : season === 2 ? "s2paid" : "s3paid"] || !startPlayerStripeCheckout || playerCheckoutBusyId === `registration-${yourPlayerObj.id}`}
                    style={{ background:"#001a10", border:`1px solid ${C.green}`, color:C.green, borderRadius:8, padding:"10px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:900, opacity: yourPlayerObj[season === 1 ? "paid" : season === 2 ? "s2paid" : "s3paid"] ? 0.5 : 1 }}>
                    {playerCheckoutBusyId === `registration-${yourPlayerObj.id}` ? "Opening" : yourPlayerObj[season === 1 ? "paid" : season === 2 ? "s2paid" : "s3paid"] ? "Reg Paid ✓" : "Pay Reg"}
                  </button>
                  <button
                    onClick={() => startPlayerStripeCheckout && startPlayerStripeCheckout(yourPlayerObj, "weekly_dues")}
                    disabled={yourOwedAmount <= (yourPlayerObj[season === 1 ? "paid" : season === 2 ? "s2paid" : "s3paid"] ? 0 : (season === 1 ? S1_REG : season === 2 ? S2_REG : S3_REG)) || !startPlayerStripeCheckout || playerCheckoutBusyId === `weekly_dues-${yourPlayerObj.id}`}
                    style={{ background:"#00162a", border:`1px solid ${C.blue}`, color:C.blue, borderRadius:8, padding:"10px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:900, opacity: yourOwedAmount <= (yourPlayerObj[season === 1 ? "paid" : season === 2 ? "s2paid" : "s3paid"] ? 0 : (season === 1 ? S1_REG : season === 2 ? S2_REG : S3_REG)) ? 0.5 : 1 }}>
                    {playerCheckoutBusyId === `weekly_dues-${yourPlayerObj.id}` ? "Opening" : "Pay Week Dues ($25)"}
                  </button>
                </div>
              )}
            </div>
            {yourPlayerObj ? (
              <div style={{ background:isYourLocked ? "#2a0010" : "#002a16", border:`1px solid ${isYourLocked ? C.red : C.green}`, borderRadius:8, padding:"12px 16px", marginTop:6 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <span style={{ fontSize:15, fontWeight:900 }}>{yourPlayerObj.name}</span>
                    <span style={{ fontSize:11, color:C.gray, marginLeft:10 }}>
                      Reg: {yourPlayerObj[season === 1 ? "paid" : season === 2 ? "s2paid" : "s3paid"] ? "Paid" : "Unpaid"} · 
                      Weeks Paid: {yourPlayerObj[season === 1 ? "weeksPaid" : season === 2 ? "s2weeksPaid" : "s3weeksPaid"]}
                    </span>
                  </div>
                  <span style={{ fontSize:14, fontWeight:900, color:isYourLocked ? C.red : C.green }}>
                    {isYourLocked ? `🔒 LOCKED (Owes $${yourOwedAmount})` : `✅ ACTIVE (Owes $${yourOwedAmount})`}
                  </span>
                </div>
                {isYourLocked && (
                  <div style={{ fontSize:11, color:C.red, marginTop:6, fontStyle:"italic" }}>
                    ⚠️ Note: You must pay outstanding dues to be unlocked before your next match.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize:12, color:C.gray, textAlign:"center", fontStyle:"italic", padding:"10px 0" }}>
                Select your name above to check if you owe dues and clear them via Stripe checkout.
              </div>
            )}
          </div>
        </Card>
      </div>

      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:13, color:C.gray, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:10 }}>💰 Share Prices Right Now</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:10 }}>
          {[["🔴 #1","$200",C.red],["🟠 #2","$150","#ff6b35"],["🟡 Top 4","$100",C.gold],["🔵 Top 8","$60",C.blue],["⚪ Others","$30",C.gray]].map(([l,v,c])=>(
            <div key={l} style={{ background:C.card, border:`1px solid ${c}`, borderRadius:8, padding:"10px 8px", textAlign:"center" }}>
              <div style={{ fontSize:11, color:C.gray }}>{l}</div>
              <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}/share</div>
            </div>
          ))}
        </div>
        <Card title="Buy A Share" borderColor={C.green} icon="💳">
          <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr auto", gap:10, alignItems:"end" }}>
            <div>
              <div style={{ fontSize:12, color:C.gray, marginBottom:5 }}>Who are you backing?</div>
              <select value={selectedPlayer} onChange={e => setSelectedPlayer(e.target.value)} style={selStyle}>
                <option value="">Select player</option>
                {standings.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:12, color:C.gray, marginBottom:5 }}>Your name</div>
              <input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Supporter name" style={selStyle} />
            </div>
            <div>
              <div style={{ fontSize:12, color:C.gray, marginBottom:5 }}>Email</div>
              <input value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} placeholder="Email for receipt" style={selStyle} />
            </div>
            <button
              onClick={() => startStripeCheckout && startStripeCheckout({ id: "player-board", name: buyerName, email: buyerEmail, player: selectedPlayer }, marketPrice)}
              disabled={!selectedPlayer || !buyerName || !startStripeCheckout || checkoutBusyId === "player-board"}
              style={{ background:"#001a10", border:`1px solid ${C.green}`, color:C.green, borderRadius:8, padding:"10px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:900, minWidth:120, opacity: (!selectedPlayer || !buyerName) ? 0.5 : 1 }}>
              {checkoutBusyId === "player-board" ? "Opening" : `Buy 1 @ ${marketPrice ? `$${marketPrice}` : "--"}`}
            </button>
          </div>
          <div style={{ marginTop:10, fontSize:12, color:C.gray }}>Stripe opens in test/production mode based on your configured backend. This player view does not expose operator profit data.</div>
        </Card>
      </div>

      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:13, color:C.gray, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:10 }}>🏆 Season {season} Standings</div>
        {standings.length===0 ? (
          <div style={{ background:C.card, borderRadius:10, padding:24, textAlign:"center", color:C.gray }}>No matches played yet.</div>
        ) : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
              {[0,1,2].map(i=>standings[i]?(
                <div key={i} style={{ background:C.card, border:`2px solid ${[C.gold,"#aaa","#cd7f32"][i]}`, borderRadius:12, padding:"16px 12px", textAlign:"center" }}>
                  <div style={{ fontSize:30 }}>{["🥇","🥈","🥉"][i]}</div>
                  <div style={{ fontSize:18, fontWeight:900, color:[C.gold,"#ccc","#cd7f32"][i], margin:"6px 0" }}>
                    {standings[i].name}
                    {isPlayerLocked(players.find(x => x.name === standings[i].name), season, matches) && <span style={{ color:C.red, fontSize:11, marginLeft:6 }}>🔒 LOCKED</span>}
                  </div>
                  <div style={{ fontSize:13, color:C.gray }}>{standings[i].pts} pts</div>
                  <div style={{ marginTop:8, fontSize:11, color:C.gray }}>Season prize</div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.green }}>{$$([seasonPrizes.p1,seasonPrizes.p2,seasonPrizes.p3][i])}</div>
                  <div style={{ fontSize:11, color:C.gray, marginTop:6, fontStyle:"italic" }}>Backers: {getBackersStr(standings[i].name)}</div>
                  <div style={{ marginTop:6, fontWeight:900, color:[C.red,C.gold,C.blue][i]||C.gray, fontSize:14 }}>
                    Shares: ${getSharePrice(standings[i].name,standings,players)}/each
                  </div>
                </div>
              ):(
                <div key={i} style={{ background:C.card, border:`2px solid ${C.cardBorder}`, borderRadius:12, padding:16, textAlign:"center", color:C.gray }}>{["🥇","🥈","🥉"][i]}<br/>TBD</div>
              ))}
            </div>
            <div style={{ background:C.card, border:`1px solid ${C.cardBorder}`, borderRadius:10, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"38px 1.5fr 40px 40px 50px 70px 80px", padding:"8px 14px", background:C.dimBg, borderBottom:`1px solid ${C.cardBorder}` }}>
                {["#","Player","W","L","Pts","S Prize","Share $"].map(h=>(
                  <div key={h} style={{ fontSize:10, color:C.gray, fontWeight:700, textAlign:"center" }}>{h}</div>
                ))}
              </div>
              {standings.map((p,i)=>{
                const sp = getSharePrice(p.name,standings,players);
                const pc = sp===75?C.red:sp===50?C.gold:sp===35?C.blue:C.gray;
                const dbPlayer = players.find(x => x.name === p.name);
                const locked = isPlayerLocked(dbPlayer, season, matches);
                const owed = getPlayerOwedAmount(dbPlayer, season, matches);
                return (
                  <div key={p.name} style={{ display:"grid", gridTemplateColumns:"38px 1.5fr 40px 40px 50px 70px 80px", padding:"10px 14px", borderBottom:`1px solid ${C.cardBorder}`, background:i<3?`${[C.gold,"#aaa","#cd7f32"][i]}11`:"transparent", alignItems:"center" }}>
                    <div style={{ textAlign:"center", fontWeight:900, fontSize:14, color:i<3?[C.gold,"#ccc","#cd7f32"][i]:C.gray }}>#{i+1}</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
                        {p.name}
                        {locked && <span style={{ color:C.red, fontSize:10, fontWeight:800, background:"#2a0010", border:`1px solid ${C.red}`, borderRadius:4, padding:"1px 4px" }}>🔒 LOCKED (Owes ${owed})</span>}
                      </div>
                      <div style={{ fontSize:11, color:C.gray }}>Backers: {getBackersStr(p.name)}</div>
                    </div>
                    <div style={{ textAlign:"center", color:C.green, fontWeight:700 }}>{p.w}</div>
                    <div style={{ textAlign:"center", color:C.red, fontWeight:700 }}>{p.l}</div>
                    <div style={{ textAlign:"center", fontWeight:900, color:C.red }}>{p.pts}</div>
                    <div style={{ textAlign:"center", color:C.gold, fontWeight:700, fontSize:13 }}>{i<3?$$([seasonPrizes.p1,seasonPrizes.p2,seasonPrizes.p3][i]):"—"}</div>
                    <div style={{ textAlign:"center", fontWeight:900, color:pc, fontSize:15 }}>${sp}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div style={{ background:C.card, border:`1px solid ${C.cardBorder}`, borderRadius:10, padding:16 }}>
        <div style={{ fontSize:13, color:C.gray, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:12 }}>💵 Full Prize Board</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <div>
            <div style={{ fontSize:11, color:C.gold, fontWeight:700, marginBottom:8 }}>📅 EACH SEASON</div>
            {[["🥇 1st",$$(SEASON_PRIZES.p1)],["🥈 2nd",$$(SEASON_PRIZES.p2)],["🥉 3rd",$$(SEASON_PRIZES.p3)],["🏅 MVP",$$(SEASON_PRIZES.mvp)]].map(([l,v])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.cardBorder}`, fontSize:13 }}>
                <span>{l}</span><span style={{ color:C.gold, fontWeight:700 }}>{v}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize:11, color:C.purple, fontWeight:700, marginBottom:8 }}>🥊 PLAYOFFS (AFTER S2)</div>
            {[["🏆 Champion","$600"],["🥈 Runner-Up","$300"],["🥉 3rd Place","$100"]].map(([l,v])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.cardBorder}`, fontSize:13 }}>
                <span>{l}</span><span style={{ color:C.purple, fontWeight:700 }}>{v}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize:11, color:C.purple, fontWeight:700, marginTop:10, marginBottom:6 }}>💰 SHARES PAYOUT/SHARE</div>
            {[["Champion","$100"],["Finalist","$60"],["Semifinal","$30"],["Quarterfinal","$10"]].map(([l,v])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${C.cardBorder}`, fontSize:12 }}>
                <span>{l}</span><span style={{ color:C.purple, fontWeight:700 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop:12, background:"#001a10", borderRadius:8, padding:"12px 16px", fontSize:14, color:C.green, fontWeight:700, textAlign:"center" }}>
          🏆 Max a player can earn: $1,000 + $1,000 + $600 = $2,600
        </div>
      </div>
    </div>
  );
}



// ─── RULES VIEW ───────────────────────────────────────────────────────────────
function RulesView() {
  const [activeGame, setActiveGame] = React.useState('straight8');
  const games = {
    straight8: {
      title: "Straight 8-Ball",
      icon: "🎱",
      color: C.blue,
      vol: "×1.0 (base)",
      obj: "Pocket all 7 of your group (solids or stripes) then legally pocket the 8-ball to win.",
      rules: [
        "Break: Cue ball must hit the rack. If you pocket a ball on the break, you keep shooting. 8-ball on break = re-rack (or spot, varies by house rules).",
        "Groups assigned: First player to pocket a ball (non-8) after the break claims that group (solids 1–7 or stripes 9–15).",
        "Legal shot: You must hit one of your own balls first. Ball or cue must contact a cushion after contact, OR pocket a ball.",
        "Scratch: Opponent gets ball-in-hand anywhere on the table.",
        "8-Ball: Call the pocket. You must pocket all your group first. Scratching on the 8 = loss. Pocketing 8 in wrong pocket = loss.",
        "Win: Pocket the 8-ball legally after clearing your group.",
      ]
    },
    bca8: {
      title: "8-Ball — BCA Rules",
      icon: "🔵",
      color: C.purple,
      vol: "×1.1",
      obj: "Same as straight 8-ball with stricter fouls and ball-in-hand rules enforced tournament-style.",
      rules: [
        "Break requirements: At least 4 balls must hit cushions OR a ball must be pocketed. Failure = opponent's choice: re-rack or accept table as-is.",
        "Ball-in-hand: After any foul, opponent places cue ball ANYWHERE on the table (not just behind the line).",
        "Push-out rule: On the first shot after the break (before groups are decided), the shooter may push out. The opponent then decides to shoot or pass.",
        "Open table: Before groups are decided, a legally pocketed 8-ball wins if all your group is also cleared. Otherwise spot the 8-ball.",
        "Call-pocket: Only the 8-ball pocket must be called. All other balls are free — no need to call every shot.",
        "Combination shots: Legal as long as you hit your ball first.",
        "Loss of game: Pocket the 8-ball before clearing your group · Pocket 8-ball on break (re-rack in BCA) · Scratch on the 8-ball · 8-ball off the table.",
        "Win: Legally pocket the 8-ball in the called pocket after clearing your entire group.",
      ]
    },
    '9ball': {
      title: "9-Ball",
      icon: "9️⃣",
      color: C.gold,
      vol: "×1.2",
      obj: "Hit balls in numerical order. Pocket the 9-ball (any time legally) to win.",
      rules: [
        "Object: Strike the lowest-numbered ball on the table first. You don't have to pocket it — just hit it first.",
        "9-Ball anytime: If the 9-ball is legally pocketed (lowest ball hit first) on any shot — including the break — you WIN.",
        "Break: Ball-in-hand behind the head string. Must strike the 1-ball first. Must pocket a ball OR drive 4 balls to cushions, or opponent may request re-rack.",
        "Push-out (after break): Shooter can push out once. Opponent decides to shoot or give it back. No foul on a push-out.",
        "Ball-in-hand: Any foul gives opponent ball-in-hand anywhere on the table.",
        "Combination shots: Legal — as long as you contact the lowest-numbered ball first.",
        "Jump & masse shots: Legal unless venue prohibits for table protection.",
        "Win: Pocket the 9-ball on any legal shot.",
      ]
    },
    '10ball': {
      title: "10-Ball",
      icon: "🔟",
      color: C.red,
      vol: "×1.3 (most volatile)",
      obj: "Hit and pocket balls 1–10 in order. Must call every shot. Pocket the 10-ball to win.",
      rules: [
        "Object: Balls must be pocketed in numerical order, 1 through 10. The 10-ball wins the game.",
        "Call every shot: Unlike 9-ball, you MUST call the ball AND the pocket for every shot. Accidental pockets are spotted (not scored).",
        "Break: Must hit the 1-ball first. If the 10-ball is pocketed on the break it is spotted (does NOT win in most rulesets). Must pocket a ball or drive 4 to cushions.",
        "No push-out: Push-out is NOT used in standard 10-ball. The break shooter must play a legal shot.",
        "Ball-in-hand: Any foul gives opponent ball-in-hand anywhere on the table.",
        "Spotted balls: Illegally pocketed balls (wrong order or un-called) are spotted on the foot spot.",
        "Fouls: Failure to hit the lowest ball first · Scratch · Ball off table · Touching any ball illegally.",
        "Win: Legally pocket the 10-ball in the called pocket, with balls played in correct order.",
      ]
    }
  };
  const g = games[activeGame];
  return (
    <div>
      <PageTitle icon="📖" title="Official Game Rules" desc="Straight 8 · BCA 8-Ball · 9-Ball · 10-Ball — select a game to see the full ruleset." />
      <Tip>Game type is set per match in the Matches tab. More complex games (9-ball, 10-ball) have higher stock volatility — bigger swings for winners AND losers.</Tip>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:20 }}>
        {Object.entries(games).map(([k,v])=>(
          <button key={k} onClick={()=>setActiveGame(k)} style={{ background:activeGame===k?v.color+"33":C.card, border:`2px solid ${activeGame===k?v.color:C.cardBorder}`, color:activeGame===k?v.color:C.gray, borderRadius:10, padding:"14px 10px", cursor:"pointer", fontFamily:"inherit", textAlign:"center" }}>
            <div style={{ fontSize:28, marginBottom:4 }}>{v.icon}</div>
            <div style={{ fontSize:12, fontWeight:700 }}>{v.title}</div>
            <div style={{ fontSize:10, marginTop:2 }}>Vol {v.vol}</div>
          </button>
        ))}
      </div>
      <Card title={`${g.icon} ${g.title} — Full Rules`} borderColor={g.color} icon={g.icon}>
        <div style={{ background:g.color+"11", border:`1px solid ${g.color}`, borderRadius:8, padding:"12px 16px", marginBottom:16 }}>
          <div style={{ fontSize:11, color:g.color, fontWeight:700, marginBottom:4 }}>OBJECTIVE</div>
          <div style={{ fontSize:14, color:C.white, fontWeight:700 }}>{g.obj}</div>
          <div style={{ fontSize:11, color:g.color, marginTop:4 }}>Volatility multiplier: {g.vol}</div>
        </div>
        <ol style={{ paddingLeft:20, margin:0 }}>
          {g.rules.map((r,i)=>(
            <li key={i} style={{ fontSize:13, color:C.gray, lineHeight:1.8, marginBottom:6, borderBottom:`1px solid ${C.cardBorder}`, paddingBottom:6 }}>
              {r}
            </li>
          ))}
        </ol>
      </Card>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Card title="General Fouls (All Games)" borderColor={C.red} icon="⚠️">
          {["Scratch — cue ball falls in pocket","No rail contact + no ball pocketed","Touching the cue ball with anything other than cue tip","Double-hit or push shot","Ball jumped off the table","Shooting before balls stop moving","Shooting out of turn"].map((r,i)=>(
            <div key={i} style={{ fontSize:13, color:C.gray, padding:"6px 0", borderBottom:`1px solid ${C.cardBorder}` }}>⚠️ {r}</div>
          ))}
        </Card>
        <Card title="Stock Volatility by Game & Season" borderColor={C.gold} icon="📈">
          <div style={{ fontSize:13, color:C.gray, marginBottom:12, lineHeight:1.8 }}>
            Each win/loss moves a player's stock price. Harder game types and later seasons multiply the swing.
          </div>
          {[["Straight 8-Ball","×1.0","Base"],["8-Ball BCA","×1.1","+10% swing"],["9-Ball","×1.2","+20% swing"],["10-Ball","×1.3","+30% swing"],["Season 1","×1.0","Base season"],["Season 2","×1.5","50% bigger swings"],["Season 3 (Playoffs)","×2.5","Most volatile"]].map(([l,v,d])=>(
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.cardBorder}` }}>
              <span style={{ fontSize:13, color:C.gray }}>{l}</span>
              <span style={{ fontSize:13, fontWeight:700, color:C.gold }}>{v} <span style={{ color:C.gray, fontWeight:400, fontSize:11 }}>{d}</span></span>
            </div>
          ))}
          <div style={{ marginTop:10, background:"#001a0a", border:`1px solid ${C.green}`, borderRadius:8, padding:"10px 14px", fontSize:12, color:C.green }}>
            Off-Schedule match: ½ price impact (×0.5) — can still play and report, counts for fun + small stock move.
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── BARS VIEW ─────────────────────────────────────────────────
function BarsView({ bars, setBars, players, season }) {
  const updBar = (i, k, v) => setBars(bs => bs.map((b, idx) => idx === i ? { ...b, [k]: v } : b));
  const regFee = season === 1 ? S1_REG : season === 2 ? S2_REG : S3_REG;

  return (
    <div>
      <PageTitle icon="🏪" title="Bar Tab Management" desc="Manage bar details, track host locations, and monitor bar-level share trade volumes and cuts." />
      <Tip>Bar owners get a 10% cut of registration fees from players registered at their bar (BAR_REG_CUT = 10%) and 3% of share trading volume (BAR_SHARE_CUT = 3%).</Tip>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        {bars.map((b, i) => {
          const barPlayers = players.filter(p => p.barId === b.id);
          const regCollected = barPlayers.length * regFee;
          const barRegCut = Math.round(regCollected * BAR_REG_CUT);
          
          return (
            <Card key={b.id} title={b.name || `Bar ${b.id}`} borderColor={C.blue} icon="🏪">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.gray, marginBottom: 3 }}>BAR NAME</div>
                  <input value={b.name || ""} onChange={e => updBar(i, "name", e.target.value)} placeholder="Enter bar name..." style={textInp} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.gray, marginBottom: 3 }}>OWNER NAME</div>
                  <input value={b.ownerName || ""} onChange={e => updBar(i, "ownerName", e.target.value)} placeholder="Owner name..." style={textInp} />
                </div>
                <div style={{ borderTop: `1px solid ${C.cardBorder}`, marginTop: 8, paddingTop: 8, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: C.gray }}>Registered Players:</span>
                    <span style={{ fontWeight: 700 }}>{barPlayers.length}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: C.gray }}>Registration Vol:</span>
                    <span style={{ color: C.green, fontWeight: 700 }}>{$$ (regCollected)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: C.gray }}>Bar Owner Reg Cut (10%):</span>
                    <span style={{ color: C.gold, fontWeight: 700 }}>{$$ (barRegCut)}</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── MANUAL VIEW ───────────────────────────────────────────────
function ManualView({ money, season, bars }) {
  return (
    <div>
      <PageTitle icon="📗" title="Operator Manual & System Guide" desc="Overview of rules, parameters, financial splits, and manual operations for league operators." />
      <Tip>This screen provides guidance on the financial structure and active league operations.</Tip>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card title="💰 Financial Flows & Payout Splits" borderColor={C.gold} icon="💵">
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.6 }}>
            <p style={{ marginBottom: 8 }}>
              <strong>Registration Fees:</strong> Player registration is collected at the start of each season. Bars receive a <strong>10%</strong> cut of the registration fees of all players registered at their bar.
            </p>
            <p style={{ marginBottom: 8 }}>
              <strong>Weekly Dues:</strong> Players pay <strong>$25/week</strong>.
            </p>
            <p style={{ marginBottom: 8 }}>
              <strong>Share Trading Fees:</strong> The operator takes a <strong>15%</strong> transaction fee on all supporter share purchases. Bars receive <strong>3%</strong> of share trading volume (or 2% depending on configuration).
            </p>
            <p style={{ marginBottom: 8 }}>
              <strong>Net Profits:</strong> Remaining revenue after payouts is split equally among the 4 league partners.
            </p>
          </div>
        </Card>
        
        <Card title="🔧 System Parameters & Settings" borderColor={C.blue} icon="⚙️">
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.6 }}>
            <p style={{ marginBottom: 4 }}><strong>S1 Registration Fee:</strong> $150</p>
            <p style={{ marginBottom: 4 }}><strong>S2 Registration Fee:</strong> $175</p>
            <p style={{ marginBottom: 4 }}><strong>S3 Registration Fee:</strong> $200</p>
            <p style={{ marginBottom: 4 }}><strong>Weekly Dues Fee:</strong> $25/week</p>
            <p style={{ marginBottom: 4 }}><strong>Share Price Floor:</strong> $10</p>
            <p style={{ marginBottom: 4 }}><strong>Share Price Ceiling:</strong> $150</p>
          </div>
        </Card>
      </div>
    </div>
  );
}