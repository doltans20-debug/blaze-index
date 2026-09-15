import React, { useState, useEffect, useMemo } from "react";
import {
  Flame, Search, User, ChevronLeft, X, Check, Camera, MessageCircle, ThumbsUp, Flag,
  Plus, Shield, Home as HomeIcon, Heart, Bookmark, ArrowUp, ArrowDown, Minus, Settings, LogOut,
} from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";
import * as api from "./lib/api.js";

const COLORS = {
  void: "#09090c", charcoal: "#141319", card: "#1b1a22", cardHi: "#221f2c",
  line: "rgba(241,238,247,0.09)", purple: "#9b6bff", purpleDeep: "#4b2f8f",
  green: "#c3ff4d", greenDim: "rgba(195,255,77,0.14)", gold: "#cba967",
  text: "#f2eff8", textDim: "#a49dbb", textFaint: "#6f6884", red: "#ff6b6b",
};
const FLAVOUR_TAGS = ["Candy","Gas","Creamy","Fruity","Citrus","Berry","Grape","Z","Earthy","Pine","Dessert","Tropical","Mint"];
const AROMA_TAGS = ["Skunky","Diesel","Floral","Sweet","Spicy","Woody","Sour","Herbal","Musky","Fuel"];

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

/* ---------------- UI atoms (same visual identity as the prototype) ---------------- */
function ScoreRing({ score, size = 56, stroke = 5 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = score == null ? 0 : score / 100;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={COLORS.line} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={COLORS.green} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Fraunces, serif", fontWeight: 700, color: COLORS.text, fontSize: size * 0.32 }}>
        {score == null ? "—" : Math.round(score)}
      </div>
    </div>
  );
}
function Tag({ children, tone = "default" }) {
  const bg = tone === "green" ? COLORS.greenDim : "rgba(241,238,247,0.06)";
  const color = tone === "green" ? COLORS.green : COLORS.textDim;
  return <span style={{ fontSize: 11.5, padding: "5px 10px", borderRadius: 20, background: bg, color, whiteSpace: "nowrap" }}>{children}</span>;
}
function Move({ current, previous }) {
  if (previous == null) return <span style={{ color: COLORS.gold, fontWeight: 700, fontSize: 12 }}>NEW</span>;
  const diff = previous - current;
  if (diff > 0) return <span style={{ color: COLORS.green, fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 2 }}><ArrowUp size={12} />{diff}</span>;
  if (diff < 0) return <span style={{ color: COLORS.red, fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 2 }}><ArrowDown size={12} />{Math.abs(diff)}</span>;
  return <span style={{ color: COLORS.textFaint, fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 2 }}><Minus size={12} /></span>;
}
function Btn({ children, onClick, kind = "primary", style, small, full, disabled }) {
  const base = { border: "1px solid transparent", borderRadius: 10, fontWeight: 700, cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: small ? "9px 14px" : "13px 20px", fontSize: small ? 13 : 14.5, width: full ? "100%" : "auto" };
  const kinds = {
    primary: { background: COLORS.green, color: "#0d0d0d" },
    outline: { background: "transparent", border: `1px solid rgba(155,107,255,0.5)`, color: COLORS.purple },
    ghost: { background: "transparent", border: `1px solid ${COLORS.line}`, color: COLORS.textDim },
    charcoal: { background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.text },
    danger: { background: "transparent", border: `1px solid rgba(255,107,107,0.4)`, color: COLORS.red },
  };
  return <button disabled={disabled} onClick={onClick} style={{ ...base, ...kinds[kind], ...style }}>{children}</button>;
}
function Card({ children, style, onClick }) {
  return <div onClick={onClick} style={{ background: COLORS.charcoal, border: `1px solid ${COLORS.line}`, borderRadius: 16, ...style }}>{children}</div>;
}
function StrainCard({ strain, stats, rank, previousRank, onClick, size = "md" }) {
  const h = size === "lg" ? 170 : 120;
  const s = stats || { score: null };
  return (
    <Card onClick={onClick} style={{ overflow: "hidden", cursor: "pointer", flexShrink: 0, width: size === "lg" ? 230 : 190 }}>
      <div style={{ height: h, background: strain.image_url ? `url(${strain.image_url}) center/cover` : `linear-gradient(135deg, #2a1f45, #123021)`,
        position: "relative", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size === "lg" ? 60 : 44 }}>
        {!strain.image_url && "🌿"}
        {rank && <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(9,9,12,0.7)", backdropFilter: "blur(6px)", borderRadius: 8, padding: "3px 9px", fontFamily: "Fraunces, serif", fontWeight: 700, fontSize: 14, color: COLORS.green }}>#{rank}</div>}
        <div style={{ position: "absolute", top: 10, right: 10 }}><ScoreRing score={s.score} size={40} stroke={4} /></div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{strain.name}</div>
        <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 8 }}>{strain.brand?.name || strain.breeder_name}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 5 }}>{(strain.flavourTags || []).slice(0, 2).map((t) => <Tag key={t}>{t}</Tag>)}</div>
          {previousRank !== undefined && <Move current={rank} previous={previousRank} />}
        </div>
      </div>
    </Card>
  );
}
function SectionHead({ title, sub, onSeeAll }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", margin: "8px 0 14px", gap: 12 }}>
      <div><div className="serif" style={{ fontSize: 21, fontWeight: 600 }}>{title}</div>{sub && <div style={{ fontSize: 12.5, color: COLORS.textFaint, marginTop: 2 }}>{sub}</div>}</div>
      {onSeeAll && <div onClick={onSeeAll} style={{ fontSize: 13, fontWeight: 700, color: COLORS.purple, cursor: "pointer", whiteSpace: "nowrap" }}>See all →</div>}
    </div>
  );
}
function HScroll({ children }) {
  return <div className="hide-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", marginBottom: 36, paddingBottom: 4 }}>{children}</div>;
}
function Stat({ label, value, small }) {
  return (
    <Card style={{ padding: 16, textAlign: "center" }}>
      <div className="serif" style={{ fontSize: small ? 15 : 22, fontWeight: 700, color: COLORS.green, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: COLORS.textFaint, marginTop: 4 }}>{label}</div>
    </Card>
  );
}
const inputStyle = { padding: "11px 14px", borderRadius: 9, background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.text, outline: "none", fontSize: 13.5, width: "100%" };

function ModalShell({ children, onClose, title }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(6,5,9,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.charcoal, border: `1px solid ${COLORS.line}`, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div className="serif" style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
          <X size={20} style={{ cursor: "pointer", color: COLORS.textFaint }} onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

/* ================= APP ================= */
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [profile, setProfile] = useState(null);
  const [page, setPage] = useState({ name: "home" });
  const [gateOpen, setGateOpen] = useState(true);
  const [authModal, setAuthModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState({ strains: [], brands: [] });
  const [reviewModalStrain, setReviewModalStrain] = useState(null);
  const [pickStrainOpen, setPickStrainOpen] = useState(false);
  const [savedIds, setSavedIds] = useState([]);
  const [followedIds, setFollowedIds] = useState([]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2800); }
  function nav(name, params = {}) { setPage({ name, ...params }); setSearchOpen(false); window.scrollTo(0, 0); }

  useEffect(() => {
    api.getSession().then(setSession).catch(() => setSession(null));
    const unsub = api.onAuthStateChange((s) => setSession(s));
    return unsub;
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) { setProfile(null); setSavedIds([]); setFollowedIds([]); return; }
    api.fetchProfile(session.user.id).then(setProfile).catch(() => {});
    api.fetchSavedStrainIds(session.user.id).then(setSavedIds).catch(() => {});
    api.fetchFollowedBrandIds(session.user.id).then(setFollowedIds).catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!search.trim()) { setSearchResults({ strains: [], brands: [] }); return; }
    const t = setTimeout(() => { api.searchAll(search).then(setSearchResults).catch(() => {}); }, 200);
    return () => clearTimeout(t);
  }, [search]);

  async function refreshSaved() { if (session) setSavedIds(await api.fetchSavedStrainIds(session.user.id)); }
  async function refreshFollowed() { if (session) setFollowedIds(await api.fetchFollowedBrandIds(session.user.id)); }

  function requireAuth(action) {
    if (!session) { setAuthModal(true); return false; }
    return true;
  }

  async function toggleSave(strainId) {
    if (!requireAuth()) return;
    try { await api.toggleSaveStrain(session.user.id, strainId, savedIds.includes(strainId)); await refreshSaved(); }
    catch (e) { showToast(e.message); }
  }
  async function toggleFollow(brandId) {
    if (!requireAuth()) return;
    try { await api.toggleFollowBrand(session.user.id, brandId, followedIds.includes(brandId)); await refreshFollowed(); }
    catch (e) { showToast(e.message); }
  }
  async function handleHelpful(reviewId) {
    if (!requireAuth()) return;
    try { await api.markHelpful(reviewId, session.user.id); showToast("Marked helpful"); }
    catch (e) { showToast(e.message); }
  }
  async function handleReport(reviewId) {
    if (!requireAuth()) return;
    try { await api.reportContent(session.user.id, "review", reviewId, "Reported from strain page"); showToast("Reported — moderators notified"); }
    catch (e) { showToast(e.message); }
  }
  async function handleSubmitReview(strainId, data) {
    if (!requireAuth()) return;
    try {
      await api.submitReview(strainId, session.user.id, data);
      showToast("Review posted 🔥 Blaze Score updated");
      setReviewModalStrain(null);
      setPage((p) => ({ ...p })); // force strain page to refetch
    } catch (e) { showToast(e.message); }
  }
  async function handleVote(battleId, strainId) {
    if (!requireAuth()) return;
    try { await api.voteBattle(battleId, session.user.id, strainId); showToast("Vote counted"); setPage((p) => ({ ...p })); }
    catch (e) { showToast(e.code === "23505" ? "You already voted on this battle" : e.message); }
  }

  return (
    <div style={{ fontFamily: "'Manrope', sans-serif", background: COLORS.void, color: COLORS.text, minHeight: "100vh", paddingBottom: 76 }}>
      {gateOpen && <AgeGate onEnter={() => setGateOpen(false)} />}
      {authModal && <AuthModal onClose={() => setAuthModal(false)} showToast={showToast} />}

      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(9,9,12,0.88)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${COLORS.line}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center", gap: 16 }}>
          <div onClick={() => nav("home")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(145deg, ${COLORS.purple}, ${COLORS.purpleDeep})`, display: "flex", alignItems: "center", justifyContent: "center" }}>🔥</div>
            <span className="serif" style={{ fontWeight: 600, fontSize: 18 }}>Blaze Index</span>
          </div>
          <div style={{ flex: 1, position: "relative", maxWidth: 380, marginLeft: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "8px 12px" }}>
              <Search size={15} color={COLORS.textFaint} />
              <input value={search} onFocus={() => setSearchOpen(true)} onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                placeholder="Search strains, brands…" style={{ background: "transparent", border: "none", outline: "none", color: COLORS.text, fontSize: 13.5, width: "100%" }} />
              {search && <X size={14} color={COLORS.textFaint} style={{ cursor: "pointer" }} onClick={() => setSearch("")} />}
            </div>
            {searchOpen && search.trim() && (
              <div style={{ position: "absolute", top: "110%", left: 0, right: 0, background: COLORS.charcoal, border: `1px solid ${COLORS.line}`, borderRadius: 12, overflow: "hidden", zIndex: 50, maxHeight: 340, overflowY: "auto" }}>
                {searchResults.strains.length === 0 && searchResults.brands.length === 0 && <div style={{ padding: 16, fontSize: 13, color: COLORS.textFaint }}>No matches yet.</div>}
                {searchResults.strains.map((s) => (
                  <div key={s.id} onClick={() => nav("strain", { slug: s.slug })} style={{ padding: "10px 14px", cursor: "pointer" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 11.5, color: COLORS.textFaint }}>{s.genetics_text}</div>
                  </div>
                ))}
                {searchResults.brands.map((b) => (
                  <div key={b.id} onClick={() => nav("brand", { slug: b.slug })} style={{ padding: "10px 14px", cursor: "pointer" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{b.name}</div>
                    <div style={{ fontSize: 11.5, color: COLORS.textFaint }}>{b.country}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {session ? (
            <Btn kind="charcoal" small onClick={() => nav("profile")}>{profile?.username || "…"}</Btn>
          ) : (
            <Btn small onClick={() => setAuthModal(true)}>Log in</Btn>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 16px" }}>
        {page.name === "home" && <HomePage nav={nav} onWriteReview={() => (requireAuth() ? setPickStrainOpen(true) : null)} />}
        {page.name === "smoking" && <WhatsSmoking nav={nav} />}
        {page.name === "strain" && (
          <StrainPage slug={page.slug} nav={nav} session={session} savedIds={savedIds}
            onWriteReview={(id) => (requireAuth() ? setReviewModalStrain(id) : null)}
            onSave={toggleSave} onHelpful={handleHelpful} onReport={handleReport} onFollow={toggleFollow} />
        )}
        {page.name === "brands" && <BrandsPage nav={nav} />}
        {page.name === "brand" && <BrandPage slug={page.slug} nav={nav} followedIds={followedIds} onFollow={toggleFollow} />}
        {page.name === "discover" && <DiscoverPage nav={nav} />}
        {page.name === "battle" && <BattlePage nav={nav} session={session} onVote={handleVote} />}
        {page.name === "profile" && profile && (
          <ProfilePage profile={profile} session={session} savedIds={savedIds} nav={nav}
            onSaveProfile={async (updates) => { const p = await api.updateProfile(session.user.id, updates); setProfile(p); }}
            onLogout={async () => { await api.signOut(); nav("home"); }} />
        )}
        {page.name === "profile" && !profile && !session && (
          <div style={{ padding: "60px 0", textAlign: "center", color: COLORS.textFaint }}>
            You need an account for that. <span style={{ color: COLORS.purple, cursor: "pointer" }} onClick={() => setAuthModal(true)}>Sign up or log in</span>
          </div>
        )}
        {page.name === "admin" && <AdminPage profile={profile} showToast={showToast} />}
      </div>

      {pickStrainOpen && <PickStrainModal onClose={() => setPickStrainOpen(false)} onPick={(id) => { setPickStrainOpen(false); setReviewModalStrain(id); }} />}
      {reviewModalStrain && <ReviewModal strainId={reviewModalStrain} onClose={() => setReviewModalStrain(null)} onSubmit={handleSubmitReview} />}
      {toast && <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "12px 20px", fontSize: 13.5, zIndex: 200 }}>{toast}</div>}

      <BottomNav page={page.name} nav={nav} onReview={() => (requireAuth() ? setPickStrainOpen(true) : null)} setSearchOpen={setSearchOpen} />
    </div>
  );
}

/* ---------------- Age gate ---------------- */
function AgeGate({ onEnter }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "radial-gradient(circle at 30% 20%, #1a1424 0%, #060509 60%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 400, width: "100%", background: COLORS.charcoal, border: `1px solid ${COLORS.line}`, borderRadius: 18, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>🔥</div>
        <div className="serif" style={{ fontSize: 24, fontWeight: 600, marginBottom: 10 }}>Before you blaze in</div>
        <p style={{ color: COLORS.textDim, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>Blaze Index is an 18+ community for cannabis culture, strain discovery and reviews. We don't sell cannabis or arrange deliveries.</p>
        <Btn full onClick={onEnter}>I'm 21+ — Enter</Btn>
        <div style={{ marginTop: 16, fontSize: 11, color: COLORS.textFaint, lineHeight: 1.6 }}>By entering you confirm you meet the legal cannabis age in your jurisdiction. No medical claims are made here.</div>
      </div>
    </div>
  );
}

/* ---------------- Auth modal ---------------- */
function AuthModal({ onClose, showToast }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      if (mode === "signup") {
        await api.signUp({ email, password, username: username || email.split("@")[0] });
        showToast("Check your email to confirm your account 🔥");
      } else {
        await api.signIn({ email, password });
        showToast("Welcome back 🔥");
      }
      onClose();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <ModalShell onClose={onClose} title={mode === "signup" ? "Create your account" : "Log in"}>
      <div style={{ display: "grid", gap: 12 }}>
        {mode === "signup" && <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />}
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        {err && <div style={{ color: COLORS.red, fontSize: 12.5 }}>{err}</div>}
        <Btn full disabled={busy} onClick={submit}>{busy ? "Working…" : mode === "signup" ? "Sign up" : "Log in"}</Btn>
        <div style={{ textAlign: "center", fontSize: 12.5, color: COLORS.textFaint, cursor: "pointer" }} onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
          {mode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------------- Bottom nav ---------------- */
function BottomNav({ page, nav, onReview, setSearchOpen }) {
  const items = [
    { key: "home", icon: HomeIcon, label: "Home" },
    { key: "smoking", icon: Flame, label: "Hot" },
    { key: "__search", icon: Search, label: "Search" },
    { key: "__review", icon: Flame, label: "Review" },
    { key: "profile", icon: User, label: "Profile" },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 150, background: "rgba(15,14,20,0.92)", backdropFilter: "blur(14px)", borderTop: `1px solid ${COLORS.line}`, display: "flex", justifyContent: "space-around", padding: "10px 6px 14px" }}>
      {items.map((it) => {
        const active = page === it.key; const Icon = it.icon;
        return (
          <div key={it.key} onClick={() => { if (it.key === "__search") setSearchOpen(true); else if (it.key === "__review") onReview(); else nav(it.key); }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", color: active ? COLORS.green : COLORS.textFaint, minWidth: 50 }}>
            <Icon size={20} /><span style={{ fontSize: 10.5, fontWeight: 700 }}>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Home ---------------- */
function HomePage({ nav, onWriteReview }) {
  const [strains, setStrains] = useState(null);
  const [stats, setStats] = useState({});
  const [movement, setMovement] = useState({});
  const [brands, setBrands] = useState([]);
  const [latestReviews, setLatestReviews] = useState([]);

  useEffect(() => {
    api.fetchStrains().then(setStrains).catch(() => setStrains([]));
    api.fetchAllStrainStats().then(setStats).catch(() => {});
    api.fetchRankingMovement("daily").then(setMovement).catch(() => {});
    api.fetchBrands().then(setBrands).catch(() => {});
  }, []);

  const ranked = useMemo(() => {
    if (!strains) return [];
    return [...strains].sort((a, b) => (stats[b.id]?.score || 0) - (stats[a.id]?.score || 0));
  }, [strains, stats]);

  if (!strains) return <Loading />;
  if (strains.length === 0) return <EmptyState nav={nav} />;

  const top1 = ranked[0];
  const top10 = ranked.slice(0, 10);

  return (
    <div>
      <div style={{ padding: "32px 0 8px" }}>
        <h1 className="serif" style={{ fontSize: "clamp(30px,7vw,50px)", fontStyle: "italic", lineHeight: 1.02, marginBottom: 14 }}>
          What's <span style={{ fontStyle: "normal", color: COLORS.green }}>smoking</span><br />right now?
        </h1>
        <p style={{ color: COLORS.textDim, fontSize: 15.5, maxWidth: 440, marginBottom: 22 }}>Real reviews, real ratings, from a community that actually blazes.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
          <Btn onClick={() => nav("smoking")}>🔥 See what's hot</Btn>
          <Btn kind="outline" onClick={onWriteReview}>⭐ Write a review</Btn>
        </div>
      </div>

      {top1 && (
        <Card onClick={() => nav("strain", { slug: top1.slug })} style={{ padding: 22, marginBottom: 34, cursor: "pointer", background: `linear-gradient(160deg, ${COLORS.cardHi}, ${COLORS.charcoal})` }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.textFaint, marginBottom: 14 }}>#1 SMOKING THIS WEEK</div>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: 110, height: 110, borderRadius: 16, background: top1.image_url ? `url(${top1.image_url}) center/cover` : "linear-gradient(135deg, #2a1f45, #123021)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, flexShrink: 0 }}>{!top1.image_url && "🌿"}</div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div className="serif" style={{ fontSize: 24, fontWeight: 600 }}>{top1.name}</div>
              <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 10 }}>{top1.brand?.name}</div>
              <div style={{ display: "flex", gap: 6 }}>{top1.flavourTags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
            </div>
            <ScoreRing score={stats[top1.id]?.score} size={74} stroke={6} />
          </div>
        </Card>
      )}

      <SectionHead title="🔥 Top 10 right now" sub="Ranked live by the Blaze Score" onSeeAll={() => nav("smoking")} />
      <HScroll>{top10.map((s, i) => <StrainCard key={s.id} strain={s} stats={stats[s.id]} rank={i + 1} previousRank={movement[s.id]} onClick={() => nav("strain", { slug: s.slug })} />)}</HScroll>

      <SectionHead title="🏢 Brands" sub="Browse the directory" onSeeAll={() => nav("brands")} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px,1fr))", gap: 12, marginBottom: 36 }}>
        {brands.slice(0, 5).map((b) => (
          <Card key={b.id} onClick={() => nav("brand", { slug: b.slug })} style={{ padding: 18, textAlign: "center", cursor: "pointer" }}>
            <div style={{ width: 42, height: 42, borderRadius: 99, margin: "0 auto 10px", background: `linear-gradient(135deg, ${COLORS.gold}, #8a713e)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#0d0d0d", fontFamily: "Fraunces, serif" }}>{b.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{b.name}</div>
          </Card>
        ))}
      </div>

      <SectionHead title="⚔️ Blaze Battle" sub="Vote in this week's head-to-head" onSeeAll={() => nav("battle")} />
      <div style={{ marginBottom: 20 }}><Btn kind="outline" onClick={() => nav("battle")}>Enter the battle arena</Btn></div>
    </div>
  );
}

function Loading() {
  return <div style={{ padding: "80px 0", textAlign: "center", color: COLORS.textDim, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}><Flame color={COLORS.green} /> Loading…</div>;
}
function EmptyState({ nav }) {
  return (
    <div style={{ padding: "80px 0", textAlign: "center", color: COLORS.textFaint }}>
      No strains in the database yet.<br />
      <span style={{ color: COLORS.purple, cursor: "pointer" }} onClick={() => nav("admin")}>Open the admin panel</span> to add the first one, or run the seed script in the README.
    </div>
  );
}

/* ---------------- What's Smoking ---------------- */
function WhatsSmoking({ nav }) {
  const [strains, setStrains] = useState(null);
  const [stats, setStats] = useState({});
  const [movement, setMovement] = useState({});
  const [timeFilter, setTimeFilter] = useState("All Time");
  const [sortBy, setSortBy] = useState("Best Overall");

  useEffect(() => {
    api.fetchStrains().then(setStrains).catch(() => setStrains([]));
    api.fetchAllStrainStats().then(setStats).catch(() => {});
    api.fetchRankingMovement("daily").then(setMovement).catch(() => {});
  }, []);

  const list = useMemo(() => {
    if (!strains) return [];
    let arr = [...strains];
    const sorters = {
      "Best Overall": (a, b) => (stats[b.id]?.score || 0) - (stats[a.id]?.score || 0),
      "Best Flavour": (a, b) => (stats[b.id]?.flavour || 0) - (stats[a.id]?.flavour || 0),
      "Best Aroma": (a, b) => (stats[b.id]?.aroma || 0) - (stats[a.id]?.aroma || 0),
      "Best Appearance": (a, b) => (stats[b.id]?.appearance || 0) - (stats[a.id]?.appearance || 0),
      "Most Reviewed": (a, b) => (stats[b.id]?.reviewCount || 0) - (stats[a.id]?.reviewCount || 0),
    };
    arr.sort(sorters[sortBy] || sorters["Best Overall"]);
    return arr;
  }, [strains, stats, sortBy]);

  if (!strains) return <Loading />;

  return (
    <div style={{ padding: "26px 0 40px" }}>
      <div className="serif" style={{ fontSize: 30, fontWeight: 600, marginBottom: 6 }}>🔥 What's Smoking</div>
      <div style={{ color: COLORS.textDim, fontSize: 14, marginBottom: 20 }}>The live community ranking, #1 through #{list.length}.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {["Today", "This Week", "This Month", "All Time"].map((t) => <Btn key={t} small kind={timeFilter === t ? "primary" : "ghost"} onClick={() => setTimeFilter(t)}>{t}</Btn>)}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {["Best Overall", "Best Flavour", "Best Aroma", "Best Appearance", "Most Reviewed"].map((t) => <Btn key={t} small kind={sortBy === t ? "outline" : "ghost"} onClick={() => setSortBy(t)}>{t}</Btn>)}
      </div>
      {timeFilter !== "All Time" && (
        <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 16 }}>
          "{timeFilter}" windowing filters reviews by created_at server-side once ranking_snapshots has enough daily history — showing All Time until then.
        </div>
      )}
      <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 16, overflow: "hidden" }}>
        {list.map((s, i) => {
          const st = stats[s.id] || {};
          const rank = i + 1;
          return (
            <div key={s.id} onClick={() => nav("strain", { slug: s.slug })} style={{ display: "grid", gridTemplateColumns: "34px 46px 1fr 60px", gap: 12, alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${COLORS.line}`, cursor: "pointer", background: COLORS.charcoal }}>
              <div className="serif" style={{ fontWeight: 700, fontSize: 17, color: rank <= 3 ? COLORS.green : COLORS.textFaint }}>{rank}</div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: s.image_url ? `url(${s.image_url}) center/cover` : "linear-gradient(135deg, #2a1f45, #123021)" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: COLORS.textFaint }}>{s.brand?.name} · {st.reviewCount || 0} reviews · {st.wouldAgainPct || 0}% would blaze again</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="serif" style={{ fontWeight: 700, fontSize: 17, color: COLORS.green }}>{st.score ?? "—"}</div>
                <Move current={rank} previous={movement[s.id]} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Strain page ---------------- */
function StrainPage({ slug, nav, session, savedIds, onWriteReview, onSave, onHelpful, onReport, onFollow }) {
  const [strain, setStrain] = useState(null);
  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [notFound, setNotFound] = useState(false);

  async function load() {
    try {
      const s = await api.fetchStrainBySlug(slug);
      setStrain(s);
      const [st, rv] = await Promise.all([api.fetchStrainStats(s.id), api.fetchReviewsForStrain(s.id)]);
      setStats(st); setReviews(rv);
    } catch (e) { setNotFound(true); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug]);

  // Realtime: new reviews on this strain update the page immediately for everyone viewing it.
  useEffect(() => {
    if (!strain) return;
    const channel = supabase
      .channel(`reviews-${strain.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews", filter: `strain_id=eq.${strain.id}` }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line
  }, [strain?.id]);

  if (notFound) return <div style={{ padding: "60px 0" }}>Strain not found. <span style={{ color: COLORS.purple, cursor: "pointer" }} onClick={() => nav("home")}>Go home</span></div>;
  if (!strain || !stats) return <Loading />;

  const saved = savedIds.includes(strain.id);

  return (
    <div style={{ padding: "22px 0 40px" }}>
      <div onClick={() => nav("smoking")} style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.textFaint, fontSize: 13, marginBottom: 16, cursor: "pointer" }}><ChevronLeft size={15} /> Back to rankings</div>
      <div style={{ height: 220, borderRadius: 20, background: strain.image_url ? `url(${strain.image_url}) center/cover` : "linear-gradient(135deg, #2a1f45, #123021)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 100, position: "relative", marginBottom: 20 }}>
        {!strain.image_url && "🌿"}
        <div style={{ position: "absolute", top: 16, right: 16 }}><ScoreRing score={stats.score} size={64} stroke={5} /></div>
      </div>
      <div className="serif" style={{ fontSize: 28, fontWeight: 600 }}>{strain.name}</div>
      {strain.brand && <div onClick={() => nav("brand", { slug: strain.brand.slug })} style={{ fontSize: 14, color: COLORS.purple, cursor: "pointer", marginBottom: 4 }}>{strain.brand.name}</div>}
      <div style={{ fontSize: 12.5, color: COLORS.textFaint, marginBottom: 14 }}>Genetics: {strain.genetics_text || "Unknown"} · <VerificationBadge status={strain.verification_status} /></div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {strain.flavourTags.map((t) => <Tag key={t}>{t}</Tag>)}
        {strain.aromaTags.map((t) => <Tag key={t} tone="green">{t}</Tag>)}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 26 }}>
        <Btn onClick={() => onWriteReview(strain.id)}>⭐ Write a review</Btn>
        <Btn kind={saved ? "primary" : "ghost"} onClick={() => onSave(strain.id)}><Bookmark size={15} /> {saved ? "Saved" : "Save"}</Btn>
      </div>

      <Card style={{ padding: 22, marginBottom: 26 }}>
        <div className="serif" style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Community ratings</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 18 }}>
          {[["👅 Flavour", stats.flavour], ["👃 Aroma", stats.aroma], ["👀 Appearance", stats.appearance], ["🔥 Overall", stats.overall]].map(([label, val]) => (
            <div key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}><span>{label}</span><b>{val.toFixed ? val.toFixed(1) : val}</b></div>
              <div style={{ height: 6, borderRadius: 4, background: "rgba(241,238,247,0.08)" }}><div style={{ height: "100%", width: `${val * 10}%`, borderRadius: 4, background: COLORS.purple }} /></div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, fontSize: 13, color: COLORS.textDim }}>🔥 <b style={{ color: COLORS.green }}>{stats.wouldAgainPct}%</b> would blaze this again · based on {stats.reviewCount} reviews</div>
      </Card>

      <div className="serif" style={{ fontSize: 20, fontWeight: 600, margin: "0 0 14px" }}>Reviews ({reviews.length})</div>
      <div style={{ display: "grid", gap: 12 }}>
        {reviews.length === 0 && <div style={{ color: COLORS.textFaint, fontSize: 13.5 }}>No reviews yet — be the first to blaze this.</div>}
        {reviews.map((r) => (
          <Card key={r.id} style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 99, background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.purpleDeep})` }} />
              <div><div style={{ fontSize: 13.5, fontWeight: 700 }}>@{r.author}</div><div style={{ fontSize: 11.5, color: COLORS.textFaint }}>{timeAgo(r.created_at)}</div></div>
              <div style={{ marginLeft: "auto", background: COLORS.greenDim, color: COLORS.green, fontWeight: 700, fontSize: 13, padding: "5px 11px", borderRadius: 20 }}>{r.overall_rating} 🔥</div>
            </div>
            <div style={{ fontSize: 13.5, color: COLORS.textDim, marginBottom: 12, lineHeight: 1.6 }}>{r.written_review}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {r.flavourTags.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)}
              <Tag tone="green">{{ definitely: "🔥 Definitely again", probably: "👍 Probably again", maybe: "😐 Maybe again", no: "👎 Not again" }[r.would_blaze_again]}</Tag>
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 12.5, color: COLORS.textFaint, borderTop: `1px solid ${COLORS.line}`, paddingTop: 10 }}>
              <span onClick={() => onHelpful(r.id)} style={{ cursor: "pointer", display: "flex", gap: 4, alignItems: "center" }}><ThumbsUp size={13} /> {r.helpful} helpful</span>
              <span style={{ display: "flex", gap: 4, alignItems: "center" }}><MessageCircle size={13} /> comment</span>
              <span onClick={() => onReport(r.id)} style={{ cursor: "pointer", display: "flex", gap: 4, alignItems: "center" }}><Flag size={13} /> report</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function VerificationBadge({ status }) {
  const map = { verified: ["✓ Verified", COLORS.green], editorially_verified: ["✓ Editorially verified", COLORS.gold], brand_submitted: ["Brand submitted", COLORS.purple], community_submitted: ["Community submitted", COLORS.textDim], unverified: ["Unverified", COLORS.textFaint] };
  const [label, color] = map[status] || map.unverified;
  return <span style={{ color }}>{label}</span>;
}

/* ---------------- Brands ---------------- */
function BrandsPage({ nav }) {
  const [brands, setBrands] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => { api.fetchBrands().then(setBrands).catch(() => setBrands([])); }, []);
  if (!brands) return <Loading />;
  const list = brands.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ padding: "26px 0 40px" }}>
      <div className="serif" style={{ fontSize: 28, fontWeight: 600, marginBottom: 16 }}>🏢 Brand Directory</div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brands…" style={{ ...inputStyle, marginBottom: 22 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
        {list.map((b) => (
          <Card key={b.id} onClick={() => nav("brand", { slug: b.slug })} style={{ padding: 20, cursor: "pointer" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 99, background: `linear-gradient(135deg, ${COLORS.gold}, #8a713e)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#0d0d0d", fontFamily: "Fraunces, serif" }}>{b.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
              <div><div style={{ fontWeight: 700, fontSize: 14.5 }}>{b.name}</div><div style={{ fontSize: 11.5, color: COLORS.textFaint }}>{b.country}</div></div>
            </div>
            <VerificationBadge status={b.verification_status} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function BrandPage({ slug, nav, followedIds, onFollow }) {
  const [brand, setBrand] = useState(null);
  const [strains, setStrains] = useState([]);
  const [stats, setStats] = useState({});
  useEffect(() => {
    api.fetchBrandBySlug(slug).then(setBrand).catch(() => {});
  }, [slug]);
  useEffect(() => {
    if (!brand) return;
    api.fetchStrains().then((all) => setStrains(all.filter((s) => s.brand?.id === brand.id || s.brand_id === brand.id)));
    api.fetchAllStrainStats().then(setStats);
  }, [brand]);
  if (!brand) return <Loading />;
  const scored = strains.map((s) => ({ ...s, score: stats[s.id]?.score || 0 })).sort((a, b) => b.score - a.score);
  const following = followedIds.includes(brand.id);

  return (
    <div style={{ padding: "26px 0 40px" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ width: 64, height: 64, borderRadius: 99, background: `linear-gradient(135deg, ${COLORS.gold}, #8a713e)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#0d0d0d", fontFamily: "Fraunces, serif", fontSize: 22 }}>{brand.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="serif" style={{ fontSize: 24, fontWeight: 600 }}>{brand.name}</div>
          <div style={{ fontSize: 13, color: COLORS.textFaint }}>{brand.country} · {brand.instagram_handle} · <VerificationBadge status={brand.verification_status} /></div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn kind={following ? "primary" : "outline"} small onClick={() => onFollow(brand.id)}><Heart size={13} /> {following ? "Following" : "Follow"}</Btn>
          <Btn kind="ghost" small><Shield size={13} /> Claim this brand</Btn>
        </div>
      </div>
      <p style={{ color: COLORS.textDim, fontSize: 14, marginBottom: 22, maxWidth: 640 }}>{brand.description}</p>
      <div className="serif" style={{ fontSize: 20, fontWeight: 600, marginBottom: 14 }}>Cultivars</div>
      <HScroll>{scored.map((s, i) => <StrainCard key={s.id} strain={s} stats={stats[s.id]} rank={i === 0 ? 1 : undefined} onClick={() => nav("strain", { slug: s.slug })} />)}</HScroll>
    </div>
  );
}

/* ---------------- Discover ---------------- */
function DiscoverPage({ nav }) {
  const [strains, setStrains] = useState(null);
  const [stats, setStats] = useState({});
  const [active, setActive] = useState("Trending");
  useEffect(() => {
    api.fetchStrains().then(setStrains).catch(() => setStrains([]));
    api.fetchAllStrainStats().then(setStats);
  }, []);
  if (!strains) return <Loading />;
  const cats = {
    "Trending": { emoji: "🔥", f: () => true, sort: (a, b) => (stats[b.id]?.reviewCount || 0) - (stats[a.id]?.reviewCount || 0) },
    "Gas": { emoji: "⛽", f: (s) => s.flavourTags.includes("Gas") },
    "Candy": { emoji: "🍬", f: (s) => s.flavourTags.includes("Candy") },
    "Fruity": { emoji: "🍓", f: (s) => s.flavourTags.includes("Fruity") },
    "Dessert": { emoji: "🍰", f: (s) => s.flavourTags.includes("Dessert") },
    "Hidden Gems": { emoji: "💎", f: (s) => (stats[s.id]?.reviewCount || 0) < 10 && (stats[s.id]?.score || 0) >= 78 },
    "New Additions": { emoji: "🆕", f: () => true, sort: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
    "Highest Rated": { emoji: "🏆", f: () => true, sort: (a, b) => (stats[b.id]?.score || 0) - (stats[a.id]?.score || 0) },
  };
  const cat = cats[active];
  const list = strains.filter(cat.f).sort(cat.sort || ((a, b) => (stats[b.id]?.score || 0) - (stats[a.id]?.score || 0)));
  return (
    <div style={{ padding: "26px 0 40px" }}>
      <div className="serif" style={{ fontSize: 28, fontWeight: 600, marginBottom: 16 }}>🧭 Discover</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        {Object.entries(cats).map(([key, c]) => <Btn key={key} small kind={active === key ? "primary" : "ghost"} onClick={() => setActive(key)}>{c.emoji} {key}</Btn>)}
      </div>
      {list.length === 0 ? <div style={{ color: COLORS.textFaint, fontSize: 13.5 }}>Nothing here yet.</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14 }}>
          {list.map((s, i) => <StrainCard key={s.id} strain={s} stats={stats[s.id]} rank={i + 1} onClick={() => nav("strain", { slug: s.slug })} size="lg" />)}
        </div>
      )}
    </div>
  );
}

/* ---------------- Battle ---------------- */
function BattlePage({ nav, session, onVote }) {
  const [battle, setBattle] = useState(null);
  const [votes, setVotes] = useState([]);
  async function load() {
    const battles = await api.fetchActiveBattles();
    if (battles[0]) { setBattle(battles[0]); setVotes(await api.fetchBattleVoteCounts(battles[0].id)); }
  }
  useEffect(() => { load(); }, []);
  if (!battle) return <div style={{ padding: "60px 0", textAlign: "center", color: COLORS.textFaint }}>No active battle right now — an admin can create one from Supabase Studio.</div>;
  const votesA = votes.filter((v) => v.strain_id === battle.a.id).length;
  const votesB = votes.filter((v) => v.strain_id === battle.b.id).length;
  const total = votesA + votesB || 1;
  return (
    <div style={{ padding: "30px 0 50px", textAlign: "center" }}>
      <div className="serif" style={{ fontSize: 26, fontWeight: 600, marginBottom: 6 }}>⚔️ Which one are you blazing?</div>
      <div style={{ fontSize: 13, color: COLORS.textFaint, marginBottom: 30 }}>{battle.round} · {total.toLocaleString()} votes so far</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "center", maxWidth: 560, margin: "0 auto" }}>
        <BattleCard strain={battle.a} pct={Math.round((votesA / total) * 100)} onVote={async () => { await onVote(battle.id, battle.a.id); load(); }} nav={nav} />
        <div className="serif" style={{ fontSize: 18, fontStyle: "italic", color: COLORS.textFaint }}>vs</div>
        <BattleCard strain={battle.b} pct={Math.round((votesB / total) * 100)} onVote={async () => { await onVote(battle.id, battle.b.id); load(); }} nav={nav} />
      </div>
    </div>
  );
}
function BattleCard({ strain, pct, onVote, nav }) {
  return (
    <Card style={{ padding: 20 }}>
      <div onClick={() => nav("strain", { slug: strain.slug })} style={{ width: "100%", height: 90, borderRadius: 12, marginBottom: 12, background: strain.image_url ? `url(${strain.image_url}) center/cover` : "linear-gradient(135deg, #2a1f45, #123021)", cursor: "pointer" }} />
      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{strain.name}</div>
      <Btn full small kind="outline" onClick={onVote} style={{ marginTop: 12 }}>Vote</Btn>
      <div className="serif" style={{ fontSize: 22, fontWeight: 700, color: COLORS.green, marginTop: 12 }}>{pct}%</div>
    </Card>
  );
}

/* ---------------- Profile ---------------- */
function ProfilePage({ profile, session, savedIds, nav, onSaveProfile, onLogout }) {
  const [name, setName] = useState(profile.username);
  const [myReviews, setMyReviews] = useState([]);
  const [saved, setSaved] = useState([]);
  useEffect(() => {
    api.fetchReviewsByUser(session.user.id).then(setMyReviews).catch(() => {});
    api.fetchStrains().then((all) => setSaved(all.filter((s) => savedIds.includes(s.id))));
  }, [savedIds]);

  return (
    <div style={{ padding: "26px 0 40px" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ width: 64, height: 64, borderRadius: 99, background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.purpleDeep})` }} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== profile.username && onSaveProfile({ username: name })} className="serif" style={{ fontSize: 22, fontWeight: 600, background: "transparent", border: "none", outline: "none", color: COLORS.text, width: "100%" }} />
          <div style={{ fontSize: 12.5, color: COLORS.textFaint }}>Joined {new Date(profile.created_at).toLocaleDateString()}</div>
        </div>
        <Btn kind="ghost" small onClick={onLogout}><LogOut size={13} /> Log out</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, marginBottom: 26 }}>
        <Stat label="Reviews" value={profile.review_count} />
        <Stat label="Saved strains" value={saved.length} />
        <Stat label="Reputation" value={profile.reviewer_reputation} />
      </div>
      <div className="serif" style={{ fontSize: 19, fontWeight: 600, marginBottom: 12 }}>Saved strains</div>
      {saved.length === 0 ? <div style={{ color: COLORS.textFaint, fontSize: 13.5, marginBottom: 26 }}>Nothing saved yet.</div> : <HScroll>{saved.map((s) => <StrainCard key={s.id} strain={s} onClick={() => nav("strain", { slug: s.slug })} />)}</HScroll>}
      <div className="serif" style={{ fontSize: 19, fontWeight: 600, marginBottom: 12 }}>My reviews</div>
      {myReviews.length === 0 ? <div style={{ color: COLORS.textFaint, fontSize: 13.5 }}>You haven't reviewed anything yet.</div> : (
        <div style={{ display: "grid", gap: 10 }}>
          {myReviews.map((r) => (
            <Card key={r.id} style={{ padding: 14, cursor: "pointer" }} onClick={() => nav("strain", { slug: r.strains.slug })}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}><span>{r.strains.name}</span><span style={{ color: COLORS.green }}>{r.overall_rating} 🔥</span></div>
              <div style={{ fontSize: 12.5, color: COLORS.textFaint }}>{r.written_review}</div>
            </Card>
          ))}
        </div>
      )}
      {profile.is_admin && <div style={{ marginTop: 20 }}><Btn onClick={() => nav("admin")}><Settings size={15} /> Open admin panel</Btn></div>}
    </div>
  );
}

/* ---------------- Admin ---------------- */
function AdminPage({ profile, showToast }) {
  const [tab, setTab] = useState("strains");
  const [brands, setBrands] = useState([]);
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState({ name: "", brand_id: "", genetics_text: "", flavourTags: "", aromaTags: "" });
  const [brandForm, setBrandForm] = useState({ name: "", country: "", description: "" });

  useEffect(() => { api.fetchBrands().then((b) => { setBrands(b); setForm((f) => ({ ...f, brand_id: b[0]?.id || "" })); }); api.fetchOpenReports().then(setReports).catch(() => {}); }, []);

  if (!profile?.is_admin) {
    return <div style={{ padding: "60px 0", textAlign: "center", color: COLORS.textFaint }}>Admin access required. Ask an existing admin to run: <code>update profiles set is_admin = true where username = 'you';</code> in Supabase Studio.</div>;
  }

  async function addStrain() {
    if (!form.name.trim()) return;
    try {
      await api.adminAddStrain(
        { name: form.name, slug: form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), brand_id: form.brand_id, genetics_text: form.genetics_text, is_demo: false, verification_status: "editorially_verified", created_by: profile.id },
        form.flavourTags.split(",").map((t) => t.trim()).filter(Boolean),
        form.aromaTags.split(",").map((t) => t.trim()).filter(Boolean)
      );
      showToast("Strain added to the Index");
      setForm({ name: "", brand_id: brands[0]?.id || "", genetics_text: "", flavourTags: "", aromaTags: "" });
    } catch (e) { showToast(e.message); }
  }
  async function addBrand() {
    if (!brandForm.name.trim()) return;
    try {
      await api.adminAddBrand({ name: brandForm.name, slug: brandForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), country: brandForm.country, description: brandForm.description, is_demo: false, verification_status: "editorially_verified", created_by: profile.id });
      showToast("Brand added");
      setBrandForm({ name: "", country: "", description: "" });
      setBrands(await api.fetchBrands());
    } catch (e) { showToast(e.message); }
  }

  return (
    <div style={{ padding: "26px 0 40px" }}>
      <div className="serif" style={{ fontSize: 26, fontWeight: 600, marginBottom: 16 }}>🛡️ Admin</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {["strains", "brands", "reports"].map((t) => <Btn key={t} small kind={tab === t ? "primary" : "ghost"} onClick={() => setTab(t)}>{t}</Btn>)}
      </div>
      {tab === "strains" && (
        <Card style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Add strain</div>
          <div style={{ display: "grid", gap: 10 }}>
            <input placeholder="Strain name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            <select value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })} style={inputStyle}>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input placeholder="Genetics" value={form.genetics_text} onChange={(e) => setForm({ ...form, genetics_text: e.target.value })} style={inputStyle} />
            <input placeholder="Flavour tags, comma separated" value={form.flavourTags} onChange={(e) => setForm({ ...form, flavourTags: e.target.value })} style={inputStyle} />
            <input placeholder="Aroma tags, comma separated" value={form.aromaTags} onChange={(e) => setForm({ ...form, aromaTags: e.target.value })} style={inputStyle} />
            <Btn onClick={addStrain}><Plus size={14} /> Add to Index</Btn>
          </div>
        </Card>
      )}
      {tab === "brands" && (
        <Card style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Add brand</div>
          <div style={{ display: "grid", gap: 10 }}>
            <input placeholder="Brand name" value={brandForm.name} onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })} style={inputStyle} />
            <input placeholder="Country" value={brandForm.country} onChange={(e) => setBrandForm({ ...brandForm, country: e.target.value })} style={inputStyle} />
            <input placeholder="Description" value={brandForm.description} onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })} style={inputStyle} />
            <Btn onClick={addBrand}><Plus size={14} /> Add brand</Btn>
          </div>
        </Card>
      )}
      {tab === "reports" && (
        <div style={{ display: "grid", gap: 10 }}>
          {reports.length === 0 && <div style={{ color: COLORS.textFaint, fontSize: 13.5 }}>No open reports.</div>}
          {reports.map((r) => <Card key={r.id} style={{ padding: 14 }}>{r.target_type} · {r.reason} · {timeAgo(r.created_at)}</Card>)}
        </div>
      )}
    </div>
  );
}

/* ---------------- Pick-strain + review modals ---------------- */
function PickStrainModal({ onClose, onPick }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  useEffect(() => { if (q.trim()) api.searchAll(q).then((r) => setResults(r.strains)); else setResults([]); }, [q]);
  return (
    <ModalShell onClose={onClose} title="Which strain are you reviewing?">
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search strains…" style={{ ...inputStyle, marginBottom: 14 }} />
      <div style={{ display: "grid", gap: 8, maxHeight: 340, overflowY: "auto" }}>
        {results.map((s) => (
          <div key={s.id} onClick={() => onPick(s.id)} style={{ padding: 10, borderRadius: 10, background: COLORS.card, cursor: "pointer" }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{s.name}</div>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

function ReviewModal({ strainId, onClose, onSubmit }) {
  const [flavour, setFlavour] = useState(7);
  const [aroma, setAroma] = useState(7);
  const [appearance, setAppearance] = useState(7);
  const [overall, setOverall] = useState(7);
  const [wouldAgain, setWouldAgain] = useState("probably");
  const [text, setText] = useState("");
  const [flavourTags, setFlavourTags] = useState([]);
  const [aromaTags, setAromaTags] = useState([]);
  const [busy, setBusy] = useState(false);
  function toggle(arr, setArr, val) { setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]); }

  return (
    <ModalShell onClose={onClose} title="Rate your smoke">
      <div style={{ display: "grid", gap: 16 }}>
        <Slider label="👅 Flavour" value={flavour} onChange={setFlavour} />
        <Slider label="👃 Aroma" value={aroma} onChange={setAroma} />
        <Slider label="👀 Appearance" value={appearance} onChange={setAppearance} />
        <Slider label="🔥 Overall" value={overall} onChange={setOverall} accent />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Would you blaze this again?</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[["definitely", "🔥 Definitely"], ["probably", "👍 Probably"], ["maybe", "😐 Maybe"], ["no", "👎 No"]].map(([k, l]) => <Btn key={k} small kind={wouldAgain === k ? "primary" : "ghost"} onClick={() => setWouldAgain(k)}>{l}</Btn>)}
          </div>
        </div>
        <TagPicker label="Flavour tags" options={FLAVOUR_TAGS} selected={flavourTags} onToggle={(t) => toggle(flavourTags, setFlavourTags, t)} />
        <TagPicker label="Aroma tags" options={AROMA_TAGS} selected={aromaTags} onToggle={(t) => toggle(aromaTags, setAromaTags, t)} />
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your review…" rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.textDim, cursor: "pointer" }}>
          <Camera size={16} /> Attach a photo (optional) — uploads to Supabase Storage once the review is posted
          <input type="file" accept="image/*" style={{ display: "none" }} />
        </label>
        <Btn full disabled={busy} onClick={async () => { setBusy(true); await onSubmit(strainId, { flavour, aroma, appearance, overall, wouldAgain, text: text || "No written comments.", flavourTags, aromaTags }); setBusy(false); }}>
          {busy ? "Posting…" : "Post review 🔥"}
        </Btn>
      </div>
    </ModalShell>
  );
}
function TagPicker({ label, options, selected, onToggle }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((t) => (
          <span key={t} onClick={() => onToggle(t)} style={{ cursor: "pointer", fontSize: 12, padding: "6px 11px", borderRadius: 20, background: selected.includes(t) ? COLORS.greenDim : "rgba(241,238,247,0.06)", color: selected.includes(t) ? COLORS.green : COLORS.textDim }}>{t}</span>
        ))}
      </div>
    </div>
  );
}
function Slider({ label, value, onChange, accent }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}><span style={{ fontWeight: 700 }}>{label}</span><span style={{ color: accent ? COLORS.green : COLORS.text, fontWeight: 700 }}>{value}/10</span></div>
      <input type="range" min="0" max="10" step="0.5" value={value} onChange={(e) => onChange(+e.target.value)} style={{ width: "100%", accentColor: accent ? COLORS.green : COLORS.purple }} />
    </div>
  );
}
