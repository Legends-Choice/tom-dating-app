import React, { useState, useRef, useCallback } from "react";

// ================= Brand =================
const T = {
  royal: "#5B21B6", violet: "#7C3AED", lilac: "#EDE7FB", lilacDeep: "#D9CCF5",
  white: "#FFFFFF", sun: "#FFC53D", ink: "#2A1B4A", soft: "#8A7BAF", green: "#2FBF71",
  red: "#E5484D",
};
const FONT = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    input, textarea { font-family: Nunito, sans-serif; }
    @keyframes popIn { 0% { transform: scale(.7); opacity: 0 } 70% { transform: scale(1.05) } 100% { transform: scale(1); opacity: 1 } }
    @keyframes floatUp { 0% { transform: translateY(8px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important } }
  `}</style>
);

// ================= Built-in backend =================
// Mirrors the real TOM server API contract (tom-server.js), running in memory
// here so the whole experience works inside this preview. Point the app at the
// real server later by replacing these functions with fetch calls.
const MAX_PHOTOS = 5;
const MAX_MB = 5;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const isAllowedFile = (file) =>
  ALLOWED.includes(file.type) || /\.(heic|heif)$/i.test(file.name);

const api = {
  user: null,
  accounts: {},
  signup({ name, email, password, age }) {
    if (!name.trim()) return { error: "Name required" };
    const mail = (email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return { error: "Valid email required" };
    if (password.length < 8) return { error: "Password must be at least 8 characters" };
    const a = Number(age);
    if (!Number.isInteger(a) || a < 18 || a > 120) return { error: "You must be 18 or older to join TOM" };
    if (this.accounts[mail]) return { error: "An account with this email already exists. Sign in instead." };
    const user = {
      name: name.trim(), age: a, email: mail,
      heightCm: null, gender: null, orientation: null, interestedIn: null,
      chronotype: null, bio: "", city: "",
      thingsILikeToDo: [], interests: [], hobbies: [],
      profilePhoto: null, photos: [],
    };
    this.accounts[mail] = { password, user };
    this.user = user;
    return { ok: true };
  },
  login({ email, password }) {
    const acc = this.accounts[(email || "").trim().toLowerCase()];
    if (!acc || acc.password !== password) return { error: "Email or password is incorrect" };
    this.user = acc.user;
    return { ok: true, complete: Boolean(acc.user.bio && acc.user.profilePhoto) };
  },
  validatePhoto(file) {
    if (!isAllowedFile(file)) return "Only JPEG, PNG, WebP, or HEIC photos are allowed";
    if (file.size > MAX_MB * 1024 * 1024) return `Photos must be under ${MAX_MB} MB`;
    return null;
  },
  addGalleryPhoto(url) {
    if (this.user.photos.length >= MAX_PHOTOS) return { error: `Gallery is full (max ${MAX_PHOTOS} photos). Delete one first.` };
    this.user.photos = [...this.user.photos, url];
    return { ok: true };
  },
};

// ================= Option pools =================
const ACTIVITY_POOL = ["Stargazing", "Board games", "Park hangs", "Walks", "Free museums", "Sunset spots", "Market browsing", "Beach days", "People watching", "Free concerts", "Picnics (bring your own)", "Photography strolls"];
const INTEREST_POOL = ["Music", "Art", "History", "Film", "Food", "Travel", "Books", "Fitness", "Tech", "Nature", "Fashion", "Languages"];
const HOBBY_POOL = ["Chess", "Photography", "Hiking", "Dancing", "Reading", "Walking", "Cycling", "Basketball", "Yoga", "Running", "Stargazing", "Museums", "Art Galleries", "Window Shopping", "Birdwatching", "Picnics"];
const GENDERS = [["man", "Man"], ["woman", "Woman"], ["nonbinary", "Nonbinary"], ["other", "Other"], ["prefer_not_to_say", "Prefer not to say"]];
const ORIENTATIONS = [["straight", "Straight"], ["gay", "Gay"], ["lesbian", "Lesbian"], ["bisexual", "Bisexual"], ["pansexual", "Pansexual"], ["asexual", "Asexual"], ["queer", "Queer"], ["other", "Other"], ["prefer_not_to_say", "Prefer not to say"]];
const INTERESTED_IN = [["men", "Men"], ["women", "Women"], ["everyone", "Everyone"]];
const CHRONO = [["morning_person", "Morning person"], ["night_person", "Night person"], ["both", "Both"]];

// ================= Location & distance =================
// Real app: phone GPS via geolocation permission. Fallback: city center.
const FALLBACK_LOC = { lat: 41.0082, lng: 28.9784 };
function haversineKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const distLabel = (from, p) => {
  const km = haversineKm(from, p.loc);
  return km < 1 ? `${Math.max(Math.round(km * 10) * 100, 100)} m` : `${km.toFixed(1)} km`;
};

// Shared-interest boost: each interest you have in common counts as being
// this many km closer in the ranking.
const BOOST_KM = 1.5;
const myLikes = () => new Set([
  ...(api.user?.thingsILikeToDo || []),
  ...(api.user?.interests || []),
  ...(api.user?.hobbies || []),
]);
const sharedLikes = (p) => { const mine = myLikes(); return (p.likes || []).filter((l) => mine.has(l)); };
const rankScore = (from, p) => haversineKm(from, p.loc) - sharedLikes(p).length * BOOST_KM;

// ================= Demo profiles for the deck =================
const PROFILES = [
  { id: 1, name: "Elif", verified: true, likes: ["Stargazing", "Sunset spots", "Photography", "Nature", "Reading"], age: 27, loc: { lat: 41.0296, lng: 28.9490 }, grad: ["#7C3AED", "#B197F0"], vibe: "Stargazer", tags: ["Night owl", "Big questions"], idea: "Stargazing from the hilltop lookout", bio: "I know exactly three constellations and I will point at all of them with total confidence." },
  { id: 2, name: "Marco", likes: ["Board games", "Park hangs", "Chess", "Picnics", "Food"], age: 31, loc: { lat: 40.9906, lng: 29.0250 }, grad: ["#5B21B6", "#8B5CF6"], vibe: "Board gamer", tags: ["Brings the games", "Park tables"], idea: "Chess and backgammon at the park tables", bio: "I carry a travel chess set everywhere. Losing to me is free. Beating me is priceless." },
  { id: 3, name: "Ayşe", likes: ["Free museums", "Museums", "Art Galleries", "Art", "History", "Photography"], age: 25, loc: { lat: 41.0370, lng: 28.9850 }, grad: ["#9333EA", "#F0ABFC"], vibe: "Museum hopper", tags: ["Free entry days", "Art opinions"], idea: "Free museum night this Thursday", bio: "I will absolutely make up backstories for the paintings. You judge which ones are real." },
  { id: 4, name: "Deniz", verified: true, likes: ["Walks", "Walking", "Hiking", "Running", "Fitness", "Nature"], age: 29, loc: { lat: 41.0430, lng: 29.0061 }, grad: ["#6D28D9", "#67E8F9"], vibe: "Walker", tags: ["Sea air", "Deep talks"], idea: "Coastal walk along the breakwater", bio: "I walk fast and ask real questions. Keep up and I'll keep it interesting." },
  { id: 5, name: "Sofia", verified: true, likes: ["Sunset spots", "Music", "Dancing", "Photography strolls", "Stargazing"], age: 26, loc: { lat: 41.0226, lng: 29.0155 }, grad: ["#7E22CE", "#FDA4AF"], vibe: "Sunset chaser", tags: ["Golden hour", "Rooftop views"], idea: "Sunset at the viewpoint, shared playlist", bio: "You pick three songs, I pick three songs. The sunset decides who won." },
  { id: 6, name: "Leo", likes: ["Market browsing", "Window Shopping", "People watching", "Food", "Travel", "Walking"], age: 28, loc: { lat: 40.9832, lng: 29.0273 }, grad: ["#6B21A8", "#FDBA74"], vibe: "Market browser", tags: ["Bazaar wanderer", "Zero purchases"], idea: "Browse the grand bazaar, buy nothing", bio: "World champion of picking things up, admiring them, and putting them back down." },
];
const DATE_IDEAS = ["Sunset at the overlook", "Board games, main square tables", "Free museum Thursday", "Walk from the ferry dock", "Stargazing on the hill"];

// ================= Shared pieces =================
const fr = (w, s, c) => ({ fontFamily: "Fredoka", fontWeight: w, fontSize: s, color: c });
const nu = (w, s, c) => ({ fontFamily: "Nunito", fontWeight: w, fontSize: s, color: c });

// ================= TOM icon set (custom SVG, no keyboard emojis) =================
const Ic = {
  Sun: ({ s = 20, c = "#FFC53D" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.4" fill={c} />
      <g stroke={c} strokeWidth="2.1" strokeLinecap="round">
        <line x1="12" y1="1.8" x2="12" y2="4.6" /><line x1="12" y1="19.4" x2="12" y2="22.2" />
        <line x1="1.8" y1="12" x2="4.6" y2="12" /><line x1="19.4" y1="12" x2="22.2" y2="12" />
        <line x1="4.8" y1="4.8" x2="6.8" y2="6.8" /><line x1="17.2" y1="17.2" x2="19.2" y2="19.2" />
        <line x1="19.2" y1="4.8" x2="17.2" y2="6.8" /><line x1="6.8" y1="17.2" x2="4.8" y2="19.2" />
      </g>
    </svg>
  ),
  Hourglass: ({ s = 20, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.5 2.5h11M6.5 21.5h11" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 2.5v3c0 2.6 4 4.4 4 6.5s-4 3.9-4 6.5v3M16 2.5v3c0 2.6-4 4.4-4 6.5s4 3.9 4 6.5v3" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.6 19.2c.4-1.7 1.5-2.6 2.4-2.6s2 .9 2.4 2.6z" fill={c} />
    </svg>
  ),
  Cross: ({ s = 18, c = "#2A1B4A" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  ),
  Heart: ({ s = 20, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20.5S3.5 15.4 3.5 9.6C3.5 6.6 5.9 4.5 8.4 4.5c1.6 0 3 .8 3.6 2 .6-1.2 2-2 3.6-2 2.5 0 4.9 2.1 4.9 5.1 0 5.8-8.5 10.9-8.5 10.9z" fill={c} />
    </svg>
  ),
  Person: ({ s = 20, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill={c} />
      <path d="M4.5 20.5c.8-3.6 3.9-5.5 7.5-5.5s6.7 1.9 7.5 5.5" stroke={c} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  ),
  Spark: ({ s = 16, c = "#FFC53D" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.5c.7 4.6 2.4 6.3 7 7-4.6.7-6.3 2.4-7 7-.7-4.6-2.4-6.3-7-7 4.6-.7 6.3-2.4 7-7z" fill={c} />
      <circle cx="19" cy="17.5" r="1.6" fill={c} />
    </svg>
  ),
  Bolt: ({ s = 14, c = "#177245" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13.2 2.5L5.5 13.5h5l-1.7 8 7.7-11h-5z" fill={c} />
    </svg>
  ),
  Pin: ({ s = 14, c = "#8A7BAF" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21.5s6.5-6.3 6.5-11A6.5 6.5 0 0 0 5.5 10.5c0 4.7 6.5 11 6.5 11z" fill={c} />
      <circle cx="12" cy="10.2" r="2.4" fill="#FFFFFF" />
    </svg>
  ),
  Bulb: ({ s = 15, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.8a6.4 6.4 0 0 0-3.6 11.7c.8.6 1.1 1.3 1.1 2h5c0-.7.3-1.4 1.1-2A6.4 6.4 0 0 0 12 2.8z" fill={c} />
      <path d="M9.8 19h4.4M10.6 21.3h2.8" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  Gift: ({ s = 15, c = "#8A6400" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="8" width="17" height="4" rx="1.2" fill={c} />
      <rect x="5" y="13.2" width="14" height="7.8" rx="1.4" fill={c} opacity=".85" />
      <path d="M12 8c-1.5-.4-4.4-1.4-4.4-3.3 0-1.2 1-1.9 2.1-1.9 1.7 0 2.3 2.6 2.3 5.2zm0 0c1.5-.4 4.4-1.4 4.4-3.3 0-1.2-1-1.9-2.1-1.9-1.7 0-2.3 2.6-2.3 5.2z" stroke={c} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  ),
  Infinity: ({ s = 20, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 12c-2-2.8-3.3-4-5.3-4a4 4 0 0 0 0 8c2 0 3.3-1.2 5.3-4zm0 0c2 2.8 3.3 4 5.3 4a4 4 0 0 0 0-8c-2 0-3.3 1.2-5.3 4z" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  Eye: ({ s = 20, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.6" fill={c} />
    </svg>
  ),
  Globe: ({ s = 20, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2" />
      <path d="M3.4 12h17.2M12 3.2c-4.8 5.4-4.8 12.2 0 17.6 4.8-5.4 4.8-12.2 0-17.6z" stroke={c} strokeWidth="1.8" />
    </svg>
  ),
  Moon: ({ s = 20, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" fill={c} />
    </svg>
  ),
  Sliders: ({ s = 20, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="2.2" fill="#FFFFFF" stroke={c} strokeWidth="2" />
      <circle cx="15" cy="12" r="2.2" fill="#FFFFFF" stroke={c} strokeWidth="2" />
      <circle cx="7.5" cy="17" r="2.2" fill="#FFFFFF" stroke={c} strokeWidth="2" />
    </svg>
  ),
  Rise: ({ s = 20, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 13l6-6 6 6M6 19l6-6 6 6" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Compass: ({ s = 20, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" fill={c} />
    </svg>
  ),
  Chevron: ({ s = 16, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 5l7 7-7 7" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ShieldCheck: ({ s = 20, c = "#2FBF71" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.5l7.5 3v5.2c0 5-3.2 8.6-7.5 10.8-4.3-2.2-7.5-5.8-7.5-10.8V5.5z" fill={c} />
      <path d="M8.6 12l2.3 2.3 4.5-4.6" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Flag: ({ s = 16, c = "#8A7BAF" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 21.5V3.5" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M6 4h11.5l-2.6 3.5 2.6 3.5H6z" fill={c} />
    </svg>
  ),
  Camera: ({ s = 20, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.8" y="6.5" width="18.4" height="13" rx="2.6" fill={c} />
      <path d="M8.5 6.5l1.4-2.3h4.2l1.4 2.3" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="13" r="3.4" fill="#FFFFFF" />
      <circle cx="12" cy="13" r="1.7" fill={c} />
    </svg>
  ),
};


function ZeroStamp({ size = 54 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", border: `3px dashed ${T.sun}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", background: "rgba(255,255,255,.92)", transform: "rotate(-8deg)", boxShadow: "0 4px 14px rgba(91,33,182,.18)" }}>
      <span style={{ ...fr(700, size * 0.3, T.royal), lineHeight: 1 }}>$0</span>
      <span style={{ ...nu(800, size * 0.125, T.soft), letterSpacing: ".4px", lineHeight: 1.25 }}>DATES</span>
      <span style={{ ...nu(800, size * 0.125, T.soft), letterSpacing: ".4px", lineHeight: 1.25 }}>ALWAYS</span>
    </div>
  );
}
function Pill({ children, filled }) {
  return <span style={{ ...nu(700, 12, filled ? T.white : T.royal), padding: "5px 11px", borderRadius: 999, background: filled ? T.royal : T.lilac, whiteSpace: "nowrap" }}>{children}</span>;
}
function Chip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ ...nu(700, 13, active ? T.white : T.royal), padding: "8px 13px", borderRadius: 999, border: `2px solid ${active ? T.royal : T.lilacDeep}`, background: active ? T.royal : T.white, cursor: "pointer" }}>
      {label}
    </button>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...nu(800, 11.5, T.soft), letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 14, border: `2px solid ${T.lilacDeep}`, ...nu(700, 15, T.ink), outline: "none", background: T.white };
function PrimaryBtn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: "100%", padding: "14px 0", borderRadius: 16, border: "none", background: disabled ? T.lilacDeep : T.royal, color: T.white, cursor: disabled ? "default" : "pointer", ...fr(600, 16, T.white) }}>
      {children}
    </button>
  );
}
function PhotoThumb({ src, size = 76, onRemove, round }) {
  const [broken, setBroken] = useState(false);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {broken ? (
        <div style={{ width: size, height: size, borderRadius: round ? "50%" : 14, background: `linear-gradient(135deg, ${T.royal}, ${T.violet})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35 }} title="HEIC photo saved (preview depends on browser)">📷</div>
      ) : (
        <img src={src} onError={() => setBroken(true)} alt="" style={{ width: size, height: size, borderRadius: round ? "50%" : 14, objectFit: "cover", boxShadow: "0 3px 10px rgba(42,27,74,.15)" }} />
      )}
      {onRemove && (
        <button onClick={onRemove} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", border: "none", background: T.ink, color: T.white, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Cross s={10} c={T.white} /></button>
      )}
    </div>
  );
}

// ================= Swipe card =================
function Card({ profile, onSwipe, isTop, myLoc, onReport }) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const start = useRef({ x: 0, y: 0 });
  const onDown = (e) => { if (!isTop) return; const p = e.touches ? e.touches[0] : e; start.current = { x: p.clientX, y: p.clientY }; setDrag((d) => ({ ...d, active: true })); };
  const onMove = (e) => { if (!drag.active) return; const p = e.touches ? e.touches[0] : e; setDrag({ x: p.clientX - start.current.x, y: p.clientY - start.current.y, active: true }); };
  const onUp = () => { if (!drag.active) return; if (drag.x > 110) onSwipe("right"); else if (drag.x < -110) onSwipe("left"); setDrag({ x: 0, y: 0, active: false }); };
  const rot = drag.x / 18, likeOp = Math.min(Math.max(drag.x / 90, 0), 1), nopeOp = Math.min(Math.max(-drag.x / 90, 0), 1);
  return (
    <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
      style={{ position: "absolute", inset: 0, touchAction: "none", transform: `translate(${drag.x}px, ${drag.y * 0.3}px) rotate(${rot}deg) scale(${isTop ? 1 : 0.95})`, transition: drag.active ? "none" : "transform .25s ease", cursor: isTop ? "grab" : "default", zIndex: isTop ? 2 : 1 }}>
      <div style={{ height: "100%", borderRadius: 26, overflow: "hidden", background: T.white, boxShadow: "0 12px 32px rgba(42,27,74,.16)", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: "0 0 44%", position: "relative", background: `linear-gradient(135deg, ${profile.grad[0]}, ${profile.grad[1]})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ ...fr(700, 92, "rgba(255,255,255,.95)"), filter: "drop-shadow(0 6px 12px rgba(0,0,0,.2))", lineHeight: 1 }}>{profile.name[0]}</span>
          <div style={{ position: "absolute", top: 14, right: 14 }}><ZeroStamp /></div>
          <div style={{ position: "absolute", top: 18, left: 16, opacity: likeOp, ...fr(700, 24, T.white), border: `3px solid ${T.white}`, borderRadius: 12, padding: "2px 12px", transform: "rotate(-10deg)", background: "rgba(47,191,113,.85)" }}>WORTH MY TIME</div>
          <div style={{ position: "absolute", top: 18, right: 76, opacity: nopeOp, ...fr(700, 24, T.white), border: `3px solid ${T.white}`, borderRadius: 12, padding: "2px 12px", transform: "rotate(10deg)", background: "rgba(42,27,74,.6)" }}>NOT THIS TIME</div>
        </div>
        <div style={{ flex: 1, padding: "16px 18px 14px", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={fr(600, 26, T.ink)}>{profile.name}, {profile.age}</span>
            {profile.verified && <Ic.ShieldCheck s={19} c={T.green} />}
            <span style={{ ...nu(700, 13, T.soft), display: "inline-flex", alignItems: "center", gap: 4 }}><Ic.Pin s={13} c={T.soft} />{distLabel(myLoc, profile)} away</span>
            <button onClick={() => onReport(profile)} onPointerDown={(e) => e.stopPropagation()} aria-label="Report this profile" style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", padding: 4 }}><Ic.Flag s={15} c={T.lilacDeep} /></button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {haversineKm(myLoc, profile.loc) < 3 && (
              <span style={{ ...nu(800, 11.5, "#177245"), background: "#E8F8EF", padding: "5px 11px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 5 }}><Ic.Bolt s={12} c="#177245" />Close enough to meet today</span>
            )}
            <Pill filled>{profile.vibe}</Pill>
            {profile.tags.map((t) => <Pill key={t}>{t}</Pill>)}
          </div>
          {sharedLikes(profile).length > 0 && (
            <div style={{ background: "#FFF4D6", borderRadius: 14, padding: "8px 12px", ...nu(700, 12.5, "#8A6400"), display: "flex", alignItems: "center", gap: 6 }}>
              <Ic.Spark s={14} c={T.sun} />You both love: {sharedLikes(profile).slice(0, 3).join(", ")}
            </div>
          )}
          <div style={{ background: T.lilac, borderRadius: 14, padding: "10px 12px", ...nu(700, 13.5, T.royal), display: "flex", alignItems: "center", gap: 6 }}><Ic.Bulb s={14} c={T.royal} />Free date idea: {profile.idea}</div>
          <p style={{ margin: 0, ...nu(600, 13.5, T.ink), lineHeight: 1.45 }}>{profile.bio}</p>
        </div>
      </div>
    </div>
  );
}

function Paywall({ onClose }) {
  const feats = [
    [Ic.Infinity, "Unlimited likes", "Never run out of time to give"],
    [Ic.Eye, "See who likes you", "Skip straight to mutual"],
    [Ic.Globe, "Time Zones", "Match in other cities before you travel"],
    [Ic.Moon, "Off the Clock", "Browse invisibly"],
    [Ic.Sliders, "Advanced filters", "Hours, height, date styles"],
    [Ic.Rise, "Weekly Prime Time", "30 minutes at the top, every week"],
    [Ic.Compass, "Free Date Guides", "Curated $0 dates in your city"],
  ];
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "26px 26px 0 0", padding: "22px 20px 20px", width: "100%", maxHeight: "88%", overflowY: "auto", animation: "floatUp .3s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <h2 style={{ ...fr(700, 28, T.royal), margin: 0 }}>TOM<span style={{ color: T.sun }}>+</span></h2>
          <p style={{ ...nu(700, 13.5, T.ink), margin: "4px 0 0" }}>More time, better matched.</p>
        </div>
        {feats.map(([icon, title, sub]) => (
          <div key={title} style={{ display: "flex", gap: 12, alignItems: "center", padding: "9px 4px" }}>
            <span style={{ width: 26, display: "flex", justifyContent: "center" }}>{React.createElement(icon, { s: 20, c: T.royal })}</span>
            <div>
              <div style={{ ...nu(800, 14, T.ink) }}>{title}</div>
              <div style={{ ...nu(600, 12, T.soft) }}>{sub}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <PrimaryBtn onClick={onClose}>Get TOM+ · $9.99/month</PrimaryBtn>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 14, border: `2px solid ${T.lilacDeep}`, background: T.white, cursor: "pointer", ...nu(800, 12.5, T.royal), display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Ic.Sun s={14} c={T.sun} />5 Golden Hours · $4.99</button>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 14, border: `2px solid ${T.lilacDeep}`, background: T.white, cursor: "pointer", ...nu(800, 12.5, T.royal), display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Ic.Rise s={14} c={T.royal} />Prime Time · $2.99</button>
        </div>
        <button onClick={onClose} style={{ width: "100%", marginTop: 10, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Not now</button>
        <p style={{ ...nu(700, 12, T.royal), textAlign: "center", margin: "8px 0 0", background: T.lilac, borderRadius: 12, padding: "10px 12px" }}>
          TOM will never charge you to go on a date.<br />Dates are $0. Always.
        </p>
      </div>
    </div>
  );
}

// ================= Screens =================

// ================= In-app legal documents =================
// Condensed in-app versions. Full versions live at tomdates.com/privacy and /terms.
const LEGAL = {
  privacy: {
    title: "Privacy Policy",
    sections: [
      ["Who we are", "TOM is operated by [COMPANY NAME]. This policy explains what we collect and why. Privacy questions: [PRIVACY EMAIL]."],
      ["What we collect", "Your account details (name, email, encrypted password, age, 18 and over only) and the profile you choose to share: photos, bio, height, city, gender, orientation, and interests. Orientation is optional, used only for matching, and processed only with your explicit consent. Verification selfies are never shown on your profile and are deleted within 30 days of the decision. Others only ever see your distance, like 2.3 km, never your actual position. Payments are handled by our payment provider; we never see your card number."],
      ["How we use it", "To run your account, show profiles, rank people by distance and shared interests, keep the community safe, process purchases, and comply with law. We never sell your personal data."],
      ["Who we share it with", "A small set of trusted providers for hosting, database, photo storage, and payments, under data protection agreements. Authorities only when legally required."],
      ["How long we keep it", "While your account is active. Deleted from live systems within 30 days after you delete your account. Safety reports are kept up to 24 months to protect other users. Payment records are kept as tax law requires."],
      ["Your rights", "You can access, correct, download, and delete your data, and object to certain uses. Delete your account any time from this screen. Requests: [PRIVACY EMAIL], answered within 30 days. EU and UK users can also complain to their data protection authority."],
      ["Safety and age", "Reports are anonymous to the person reported. Meet in public places. TOM does not run background checks. TOM is for adults 18 and over."],
      ["Security and changes", "Passwords are hashed and data is encrypted in transit. Meaningful changes to this policy are announced in the app before they take effect."],
    ],
  },
  terms: {
    title: "Terms of Service",
    sections: [
      ["The agreement", "These terms are between you and [COMPANY NAME]. By creating an account you accept them together with the Privacy Policy."],
      ["Who can join", "You must be 18 or older, with one account that is truly about you, using your own recent photos."],
      ["What TOM is", "TOM helps people meet for free dates. We do not supervise dates or run background checks. Use good judgment: meet in public, tell someone where you are going, and never send money to people you meet here."],
      ["Community rules", "No impersonation or fake photos. No harassment, threats, or abuse. No sexual, violent, hateful, or illegal content. Never ask other users for money. No one under 18. No commercial use, scraping, or ban evasion. Accounts that break these rules can be restricted or removed."],
      ["Report and block", "Available on every profile, and anonymous to the person reported. If anyone is in immediate danger, contact local emergency services first."],
      ["Your content", "You own what you post. You give TOM a license to show it inside the app so the service can work. The license ends when you delete it, except records needed for safety."],
      ["Verification", "Optional. The badge means a live selfie matched the profile photos at review time. It is not a background check or an identity guarantee."],
      ["Paid features", "The core TOM experience is free, and TOM will never charge you to go on a date. TOM+ renews automatically until cancelled. Purchases through Apple or Google follow their rules. One-time purchases are generally non-refundable unless the law says otherwise."],
      ["TOM Perks", "Optional offers from local businesses shown after dates. The businesses are responsible for honoring their offers. Perks are never required."],
      ["Ending things", "Delete your account any time in this app. We may remove accounts that harm other users or break these rules."],
      ["The legal part", "The service is provided as is, and our liability is limited to the fullest extent the law allows. These terms are governed by the laws of [JURISDICTION]. The full version lives at tomdates.com/terms."],
    ],
  },
};

function LegalModal({ doc, onClose }) {
  const d = LEGAL[doc];
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "26px 26px 0 0", width: "100%", height: "90%", display: "flex", flexDirection: "column", animation: "floatUp .3s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 10px" }}>
          <h2 style={{ ...fr(700, 22, T.ink), margin: 0 }}>{d.title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: T.lilac, borderRadius: "50%", width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Cross s={15} c={T.royal} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 24px" }}>
          {d.sections.map(([h, body]) => (
            <div key={h} style={{ marginBottom: 14 }}>
              <div style={{ ...nu(800, 12, T.royal), letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 4 }}>{h}</div>
              <p style={{ ...nu(600, 13.5, T.ink), margin: 0, lineHeight: 1.55 }}>{body}</p>
            </div>
          ))}
          <p style={{ ...nu(700, 12, T.soft), marginTop: 6 }}>Last updated: [DATE]. Draft pending legal review.</p>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ onCancel, onConfirm }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: T.white, borderRadius: 26, padding: "24px 22px 20px", width: "100%", maxWidth: 320, textAlign: "center", animation: "popIn .3s ease", boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}>
        <h2 style={{ ...fr(700, 22, T.ink), margin: "0 0 8px" }}>Delete your account?</h2>
        <p style={{ ...nu(600, 13.5, T.soft), margin: "0 0 16px", lineHeight: 1.55 }}>This permanently removes your profile, photos, matches, and Golden Hours. Safety reports are kept as described in the Privacy Policy. This cannot be undone.</p>
        <button onClick={onConfirm} style={{ width: "100%", padding: "14px 0", borderRadius: 16, border: "none", background: T.red, color: T.white, cursor: "pointer", ...fr(600, 16, T.white) }}>Delete my account</button>
        <button onClick={onCancel} style={{ width: "100%", marginTop: 10, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Keep my account</button>
      </div>
    </div>
  );
}

function Home({ onPick, onLegal }) {
  return (
    <div style={{ flex: 1, background: T.white, display: "flex", flexDirection: "column", padding: "0 28px 26px", textAlign: "center" }}>
      <div style={{ flex: 1.2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
        <h1 style={{ ...fr(700, 68, T.royal), margin: 0, lineHeight: 1, letterSpacing: "2px" }}>
          TOM<span style={{ color: T.sun }}>.</span>
        </h1>
        <p style={{ ...nu(800, 15, T.soft), margin: "12px 0 0", letterSpacing: "4px" }}>TIME OVER MONEY</p>
        <p style={{ ...fr(600, 23, T.royal), margin: "30px 0 0" }}>Dating without the bill.</p>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={() => onPick("signup")} style={{ ...fr(600, 18, T.white), background: T.royal, border: "none", borderRadius: 16, padding: "16px 0", cursor: "pointer", boxShadow: "0 6px 16px rgba(91,33,182,.25)" }}>
          Sign Up
        </button>
        <button onClick={() => onPick("signin")} style={{ ...fr(600, 18, T.royal), background: T.white, border: `2px solid ${T.royal}`, borderRadius: 16, padding: "14px 0", cursor: "pointer" }}>
          Log In
        </button>
        <button onClick={() => onPick("guest")} style={{ ...fr(600, 16, T.royal), background: "none", border: "none", cursor: "pointer", padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          Continue as Guest <Ic.Chevron s={13} c={T.royal} />
        </button>
      </div>
      <p style={{ ...nu(600, 12, T.soft), margin: "14px 0 0", lineHeight: 1.6 }}>
        By continuing, you agree to our<br />
        <button onClick={() => onLegal("terms")} style={{ ...nu(800, 12, T.soft), border: "none", background: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>Terms of Service</button>&nbsp;&nbsp;and&nbsp;&nbsp;<button onClick={() => onLegal("privacy")} style={{ ...nu(800, 12, T.soft), border: "none", background: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>Privacy Policy</button>
      </p>
    </div>
  );
}

function Welcome({ onDone, initialMode }) {
  const [mode, setMode] = useState(initialMode || "signup"); // signup | signin
  const [form, setForm] = useState({ name: "", email: "", password: "", age: "" });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = () => {
    setError(null);
    if (mode === "signup") {
      const r = api.signup(form);
      if (r.error) setError(r.error); else onDone("builder");
    } else {
      const r = api.login(form);
      if (r.error) setError(r.error); else onDone(r.complete ? "main" : "builder");
    }
  };
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "10px 24px 24px" }}>
      <div style={{ textAlign: "center", margin: "16px 0 20px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><ZeroStamp size={70} /></div>
        <h2 style={{ ...fr(700, 26, T.ink), margin: 0 }}>
          {mode === "signup" ? "Dating costs $200 to $500 now." : "Welcome back"}
        </h2>
        <p style={{ ...nu(700, 15, T.royal), margin: "6px 0 0" }}>
          {mode === "signup" ? "On TOM it costs nothing. Don't spend money. Spend time." : "Your time is waiting."}
        </p>
      </div>
      {mode === "signup" && <Field label="Your name"><input style={inputStyle} value={form.name} onChange={set("name")} placeholder="What should we call you?" /></Field>}
      <Field label="Email"><input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" /></Field>
      <Field label="Password"><input style={inputStyle} type="password" value={form.password} onChange={set("password")} placeholder={mode === "signup" ? "8+ characters" : "Your password"} /></Field>
      {mode === "signup" && <Field label="Age"><input style={inputStyle} type="number" value={form.age} onChange={set("age")} placeholder="18+" /></Field>}
      {error && <p style={{ ...nu(700, 13, T.red), margin: "0 0 12px" }}>{error}</p>}
      <PrimaryBtn onClick={submit}>{mode === "signup" ? "Create my account" : "Sign in"}</PrimaryBtn>
      <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }}
        style={{ width: "100%", marginTop: 12, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13.5, T.royal) }}>
        {mode === "signup" ? "Already on TOM? Sign in" : "New here? Create an account"}
      </button>
      <p style={{ ...nu(600, 11.5, T.soft), textAlign: "center", marginTop: 8 }}>Public places. Equal basis. $0 always.</p>
    </div>
  );
}

function Builder({ onDone }) {
  const [step, setStep] = useState(0);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [photoError, setPhotoError] = useState(null);
  const [heightUnit, setHeightUnit] = useState("cm");
  const [ftIn, setFtIn] = useState({ ft: "", inch: "" });
  const u = api.user;

  const switchUnit = (unit) => {
    if (unit === "ft" && u.heightCm) {
      const totalIn = Math.round(u.heightCm / 2.54);
      setFtIn({ ft: String(Math.floor(totalIn / 12)), inch: String(totalIn % 12) });
    }
    setHeightUnit(unit);
  };
  const setFeet = (part, val) => {
    const next = { ...ftIn, [part]: val };
    setFtIn(next);
    const f = Number(next.ft) || 0, i = Number(next.inch) || 0;
    u.heightCm = f || i ? Math.round((f * 12 + i) * 2.54) : null;
    rerender();
  };

  const handleFiles = (files, asProfile) => {
    setPhotoError(null);
    for (const file of Array.from(files)) {
      const err = api.validatePhoto(file);
      if (err) { setPhotoError(err); continue; }
      if (!asProfile && u.photos.length >= MAX_PHOTOS) {
        setPhotoError(`Gallery is full (max ${MAX_PHOTOS} photos). Delete one first.`);
        break;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result; // data URL, works inside the preview sandbox
        if (asProfile) { u.profilePhoto = url; }
        else {
          const r = api.addGalleryPhoto(url);
          if (r.error) setPhotoError(r.error);
        }
        rerender();
      };
      reader.readAsDataURL(file);
    }
  };
  const toggle = (arrKey, item) => {
    const arr = u[arrKey];
    u[arrKey] = arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
    rerender();
  };
  const canNext = [
    Boolean(u.profilePhoto),
    Boolean(u.gender && u.orientation && u.interestedIn && u.chronotype),
    u.thingsILikeToDo.length > 0,
    u.bio.trim().length > 0,
  ][step];

  const steps = [
    // ---- Step 1: photos ----
    <div key="p">
      <h3 style={{ ...fr(600, 21, T.ink), margin: "0 0 4px" }}>Show your face</h3>
      <p style={{ ...nu(600, 13.5, T.soft), margin: "0 0 16px" }}>JPEG, PNG, WebP, or HEIC. Up to 5 MB each.</p>
      <Field label="Profile picture (required)">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {u.profilePhoto ? <PhotoThumb src={u.profilePhoto} size={84} round /> : (
            <div style={{ width: 84, height: 84, borderRadius: "50%", background: T.lilac, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Person s={34} c={T.royal} /></div>
          )}
          <label style={{ ...nu(800, 13, T.royal), background: T.lilac, borderRadius: 999, padding: "10px 16px", cursor: "pointer" }}>
            {u.profilePhoto ? "Change photo" : "Upload photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files, true)} />
          </label>
        </div>
      </Field>
      <Field label={`Gallery (up to ${MAX_PHOTOS} more) — ${u.photos.length}/${MAX_PHOTOS}`}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {u.photos.map((src, i) => (
            <PhotoThumb key={i} src={src} onRemove={() => { u.photos = u.photos.filter((_, j) => j !== i); rerender(); }} />
          ))}
          {u.photos.length < MAX_PHOTOS && (
            <label style={{ width: 76, height: 76, borderRadius: 14, border: `2px dashed ${T.lilacDeep}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...fr(600, 26, T.royal) }}>
              +
              <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files, false)} />
            </label>
          )}
        </div>
      </Field>
      {photoError && <p style={{ ...nu(700, 13, T.red), margin: 0 }}>{photoError}</p>}
    </div>,

    // ---- Step 2: about you ----
    <div key="a">
      <h3 style={{ ...fr(600, 21, T.ink), margin: "0 0 16px" }}>About you</h3>
      <Field label="Height">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", borderRadius: 999, background: T.lilac, padding: 3 }}>
            {["cm", "ft"].map((unit) => (
              <button key={unit} onClick={() => switchUnit(unit)} style={{ ...nu(800, 12.5, heightUnit === unit ? T.white : T.royal), border: "none", borderRadius: 999, padding: "8px 16px", background: heightUnit === unit ? T.royal : "transparent", cursor: "pointer" }}>{unit}</button>
            ))}
          </div>
          {heightUnit === "cm" ? (
            <input style={{ ...inputStyle, width: 100 }} type="number" placeholder="175" value={u.heightCm || ""} onChange={(e) => { u.heightCm = e.target.value ? Number(e.target.value) : null; rerender(); }} />
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input style={{ ...inputStyle, width: 66 }} type="number" placeholder="5" value={ftIn.ft} onChange={(e) => setFeet("ft", e.target.value)} />
              <span style={nu(800, 13, T.soft)}>ft</span>
              <input style={{ ...inputStyle, width: 66 }} type="number" placeholder="11" value={ftIn.inch} onChange={(e) => setFeet("inch", e.target.value)} />
              <span style={nu(800, 13, T.soft)}>in</span>
            </div>
          )}
        </div>
        {heightUnit === "ft" && u.heightCm && <div style={{ ...nu(700, 12, T.soft), marginTop: 6 }}>= {u.heightCm} cm</div>}
      </Field>
      <Field label="City"><input style={inputStyle} placeholder="Where you date" value={u.city} onChange={(e) => { u.city = e.target.value; rerender(); }} /></Field>
      <Field label="I am a"><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{GENDERS.map(([v, l]) => <Chip key={v} label={l} active={u.gender === v} onClick={() => { u.gender = v; rerender(); }} />)}</div></Field>
      <Field label="Orientation"><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{ORIENTATIONS.map(([v, l]) => <Chip key={v} label={l} active={u.orientation === v} onClick={() => { u.orientation = v; rerender(); }} />)}</div></Field>
      <Field label="Show me"><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{INTERESTED_IN.map(([v, l]) => <Chip key={v} label={l} active={u.interestedIn === v} onClick={() => { u.interestedIn = v; rerender(); }} />)}</div></Field>
      <Field label="My hours"><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{CHRONO.map(([v, l]) => <Chip key={v} label={l} active={u.chronotype === v} onClick={() => { u.chronotype = v; rerender(); }} />)}</div></Field>
    </div>,

    // ---- Step 3: what you love ----
    <div key="t">
      <h3 style={{ ...fr(600, 21, T.ink), margin: "0 0 16px" }}>What do you love doing?</h3>
      <Field label="Free dates I'm up for (pick at least 1)"><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{ACTIVITY_POOL.map((a) => <Chip key={a} label={a} active={u.thingsILikeToDo.includes(a)} onClick={() => toggle("thingsILikeToDo", a)} />)}</div></Field>
      <Field label="Interests"><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{INTEREST_POOL.map((a) => <Chip key={a} label={a} active={u.interests.includes(a)} onClick={() => toggle("interests", a)} />)}</div></Field>
      <Field label="Hobbies"><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{HOBBY_POOL.map((a) => <Chip key={a} label={a} active={u.hobbies.includes(a)} onClick={() => toggle("hobbies", a)} />)}</div></Field>
    </div>,

    // ---- Step 4: bio ----
    <div key="b">
      <h3 style={{ ...fr(600, 21, T.ink), margin: "0 0 4px" }}>Last one: your bio</h3>
      <p style={{ ...nu(600, 13.5, T.soft), margin: "0 0 14px" }}>What should someone know before they spend time with you?</p>
      <textarea rows={5} maxLength={600} placeholder="I rate every bench I sit on..." value={u.bio} onChange={(e) => { u.bio = e.target.value; rerender(); }} style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }} />
      <div style={{ ...nu(700, 11.5, T.soft), textAlign: "right", marginTop: 4 }}>{u.bio.length}/600</div>
    </div>,
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "6px 0 12px" }}>
        {steps.map((_, i) => <div key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 999, background: i <= step ? T.royal : T.lilacDeep, transition: "width .2s" }} />)}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 22px" }}>{steps[step]}</div>
      <div style={{ display: "flex", gap: 10, padding: "14px 22px 20px" }}>
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} style={{ padding: "14px 18px", borderRadius: 16, border: `2px solid ${T.lilacDeep}`, background: T.white, ...fr(600, 15, T.royal), cursor: "pointer" }}>Back</button>
        )}
        <div style={{ flex: 1 }}>
          <PrimaryBtn disabled={!canNext} onClick={() => (step < 3 ? setStep(step + 1) : onDone())}>
            {step < 3 ? "Continue" : "Start spending time"}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

function Discover({ deck, onSwipe, myLoc, onGolden, goldenLeft, onReport }) {
  if (deck.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 32, textAlign: "center" }}>
        <Ic.Hourglass s={54} c={T.royal} />
        <h2 style={{ ...fr(600, 22, T.ink), margin: 0 }}>You've seen everyone nearby</h2>
        <p style={{ ...nu(600, 14, T.soft), margin: 0 }}>New people join TOM every day. Check back soon.</p>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "6px 16px 0" }}>
      <div style={{ ...nu(800, 10.5, T.soft), letterSpacing: ".6px", paddingBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Ic.Pin s={11} c={T.soft} />CLOSEST · <Ic.Spark s={11} c={T.sun} />MOST IN COMMON FIRST</div>
      <div style={{ position: "relative", flex: 1, marginBottom: 12 }}>
        {deck.slice(0, 2).map((p, i) => <Card key={p.id} profile={p} isTop={i === 0} onSwipe={onSwipe} myLoc={myLoc} onReport={onReport} />).reverse()}
      </div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 22, padding: "4px 0 12px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <button onClick={() => onSwipe("left")} aria-label="Pass" style={{ width: 56, height: 56, borderRadius: "50%", border: "none", background: T.white, cursor: "pointer", boxShadow: "0 6px 16px rgba(42,27,74,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Cross s={20} c={T.ink} /></button>
          <span style={{ ...nu(800, 10.5, T.soft), letterSpacing: ".4px" }}>PASS</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <button onClick={onGolden} aria-label="Golden Hour" style={{ position: "relative", width: 50, height: 50, borderRadius: "50%", border: "none", background: T.sun, cursor: "pointer", boxShadow: "0 6px 16px rgba(255,197,61,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ic.Sun s={24} c={T.white} />
            <span style={{ position: "absolute", top: -4, right: -4, background: T.royal, color: T.white, borderRadius: 999, minWidth: 18, height: 18, ...nu(800, 11, T.white), display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{goldenLeft}</span>
          </button>
          <span style={{ ...nu(800, 10.5, "#B8860B"), letterSpacing: ".4px" }}>GOLDEN HOUR</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <button onClick={() => onSwipe("right")} aria-label="Spend time" style={{ width: 64, height: 64, borderRadius: "50%", border: "none", background: T.royal, cursor: "pointer", boxShadow: "0 6px 18px rgba(91,33,182,.4)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Hourglass s={26} c={T.white} /></button>
          <span style={{ ...nu(800, 10.5, T.royal), letterSpacing: ".4px" }}>SPEND TIME</span>
        </div>
      </div>
    </div>
  );
}

function MatchModal({ profile, onClose, myLoc }) {
  const [idea, setIdea] = useState(null);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: T.white, borderRadius: 26, padding: "26px 22px 22px", width: "100%", maxWidth: 320, textAlign: "center", animation: "popIn .35s ease", boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><ZeroStamp size={64} /></div>
        <h2 style={{ ...fr(700, 27, T.royal), margin: "0 0 4px" }}>Time well matched!</h2>
        <p style={{ ...nu(700, 14, T.ink), margin: "0 0 6px" }}>You and {profile.name} both chose time over money.</p>
        <p style={{ ...nu(800, 13, T.royal), margin: "0 0 14px", background: T.lilac, borderRadius: 999, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}><Ic.Pin s={12} c={T.royal} />You're {distLabel(myLoc, profile)} apart</p>
        <p style={{ ...nu(800, 12, T.soft), margin: "0 0 8px", letterSpacing: ".5px", textTransform: "uppercase" }}>Suggest a free first date (public places only)</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18, maxHeight: 190, overflowY: "auto" }}>
          {DATE_IDEAS.map((s) => (
            <button key={s} onClick={() => setIdea(s)} style={{ ...nu(700, 13.5, idea === s ? T.royal : T.ink), padding: "11px 12px", borderRadius: 14, cursor: "pointer", border: `2px solid ${idea === s ? T.royal : T.lilacDeep}`, background: idea === s ? T.lilac : T.white, textAlign: "left" }}>{s}</button>
          ))}
        </div>
        <PrimaryBtn onClick={onClose}>{idea ? "Send this idea" : "Keep swiping"}</PrimaryBtn>
      </div>
    </div>
  );
}

function GoldenIntro({ profileName, goldenLeft, onSend, onClose }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 25, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: T.white, borderRadius: 26, padding: "26px 22px 22px", width: "100%", maxWidth: 320, textAlign: "center", animation: "popIn .35s ease", boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: T.sun, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", boxShadow: "0 8px 22px rgba(255,197,61,.5)" }}>
          <Ic.Sun s={38} c={T.white} />
        </div>
        <h2 style={{ ...fr(700, 26, T.royal), margin: "0 0 8px" }}>Golden Hour</h2>
        <p style={{ ...nu(700, 14.5, T.ink), margin: "0 0 6px", lineHeight: 1.5 }}>
          Instantly tell {profileName} they're worth your best hour. They see it before anyone else.
        </p>
        <p style={{ ...nu(700, 12.5, T.soft), margin: "0 0 18px" }}>You get 1 free every day.</p>
        <PrimaryBtn onClick={onSend} disabled={goldenLeft <= 0}>Send Golden Hour</PrimaryBtn>
        <button onClick={onClose} style={{ width: "100%", marginTop: 10, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Not now</button>
      </div>
    </div>
  );
}

function ReportModal({ profile, onCancel, onConfirm }) {
  const [reason, setReason] = useState(null);
  const [done, setDone] = useState(false);
  const REASONS = ["Fake profile or photos", "Inappropriate content", "Harassment or threats", "Under 18", "Asked for money", "Something else"];
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 26, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: T.white, borderRadius: 26, padding: "24px 22px 20px", width: "100%", maxWidth: 320, animation: "popIn .3s ease", boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}>
        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><Ic.ShieldCheck s={44} c={T.green} /></div>
            <h2 style={{ ...fr(700, 22, T.ink), margin: "0 0 8px" }}>Thanks for keeping TOM safe</h2>
            <p style={{ ...nu(600, 13.5, T.soft), margin: "0 0 16px", lineHeight: 1.5 }}>{profile.name} has been blocked and removed. Our safety team will review this report. They won't know it came from you.</p>
            <PrimaryBtn onClick={onConfirm}>Done</PrimaryBtn>
          </div>
        ) : (
          <>
            <h2 style={{ ...fr(700, 22, T.ink), margin: "0 0 4px", textAlign: "center" }}>Report {profile.name}</h2>
            <p style={{ ...nu(600, 12.5, T.soft), margin: "0 0 14px", textAlign: "center" }}>Reports are anonymous. Reporting also blocks them.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
              {REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)} style={{ ...nu(700, 13.5, reason === r ? T.royal : T.ink), padding: "11px 12px", borderRadius: 14, cursor: "pointer", border: `2px solid ${reason === r ? T.royal : T.lilacDeep}`, background: reason === r ? T.lilac : T.white, textAlign: "left" }}>{r}</button>
              ))}
            </div>
            <PrimaryBtn disabled={!reason} onClick={() => setDone(true)}>Report and block</PrimaryBtn>
            <button onClick={onCancel} style={{ width: "100%", marginTop: 8, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

function VerifyModal({ onClose, onSubmit }) {
  const [selfie, setSelfie] = useState(null);
  const takeSelfie = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSelfie(reader.result);
    reader.readAsDataURL(file);
  };
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 26, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: T.white, borderRadius: 26, padding: "24px 22px 20px", width: "100%", maxWidth: 320, textAlign: "center", animation: "popIn .3s ease", boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><Ic.ShieldCheck s={48} c={T.green} /></div>
        <h2 style={{ ...fr(700, 23, T.ink), margin: "0 0 8px" }}>Verify it's really you</h2>
        <p style={{ ...nu(600, 13.5, T.soft), margin: "0 0 4px", lineHeight: 1.5 }}>Take a selfie with a thumbs up next to your face. Our safety team compares it with your profile photos.</p>
        <p style={{ ...nu(700, 12, T.soft), margin: "0 0 16px" }}>The selfie is never shown on your profile.</p>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          {selfie ? <PhotoThumb src={selfie} size={92} round /> : (
            <label style={{ width: 92, height: 92, borderRadius: "50%", border: `2px dashed ${T.lilacDeep}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", background: T.lilac }}>
              <Ic.Camera s={26} c={T.royal} />
              <span style={{ ...nu(800, 10.5, T.royal) }}>Take selfie</span>
              <input type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={takeSelfie} />
            </label>
          )}
        </div>
        <PrimaryBtn disabled={!selfie} onClick={onSubmit}>Submit for review</PrimaryBtn>
        <button onClick={onClose} style={{ width: "100%", marginTop: 8, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Not now</button>
      </div>
    </div>
  );
}

function Matches({ matches, myLoc, onUpgrade, onReport }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "6px 16px 16px" }}>
      <button onClick={onUpgrade} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: `linear-gradient(135deg, ${T.royal}, ${T.violet})`, border: "none", borderRadius: 18, padding: 14, marginBottom: 12, cursor: "pointer", textAlign: "left" }}>
        <div style={{ display: "flex" }}>
          {["#B197F0", "#F0ABFC", "#67E8F9"].map((c, i) => (
            <div key={i} style={{ width: 34, height: 34, borderRadius: "50%", background: c, filter: "blur(4px)", marginLeft: i ? -10 : 0, border: `2px solid ${T.white}` }} />
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...nu(800, 14, T.white) }}>3 people think you're worth their time</div>
          <div style={{ ...nu(700, 12, "#D9CCF5") }}>See who likes you with TOM+ →</div>
        </div>
      </button>
      {matches.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: 70 }}>
          <Ic.Hourglass s={48} c={T.royal} />
          <h2 style={{ ...fr(600, 22, T.ink), margin: "10px 0 6px" }}>No dates planned yet</h2>
          <p style={{ ...nu(600, 14, T.soft), margin: 0 }}>Swipe right on someone worth your time.</p>
        </div>
      ) : (
        <>
          {matches.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, background: T.white, borderRadius: 18, padding: 12, marginBottom: 10, boxShadow: "0 4px 14px rgba(42,27,74,.08)", animation: "floatUp .3s ease" }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: `linear-gradient(135deg, ${p.grad[0]}, ${p.grad[1]})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...fr(700, 22, T.white) }}>{p.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={fr(600, 17, T.ink)}>{p.name} <span style={{ ...nu(700, 12, T.soft), display: "inline-flex", alignItems: "center", gap: 3 }}>· <Ic.Pin s={11} c={T.soft} />{distLabel(myLoc, p)}</span></div>
                <div style={{ ...nu(700, 12.5, T.soft), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 5 }}><Ic.Bulb s={12} c={T.soft} />{p.idea}</div>
              </div>
              <button onClick={() => onReport(p)} aria-label="Report or unmatch" style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><Ic.Flag s={15} c={T.lilacDeep} /></button>
              <span style={{ ...fr(700, 13, T.green), background: "#E8F8EF", borderRadius: 999, padding: "5px 10px" }}>$0</span>
            </div>
          ))}
          <div style={{ background: "#FFF4D6", borderRadius: 18, padding: "13px 15px", marginTop: 4 }}>
            <div style={{ ...nu(800, 11, "#8A6400"), letterSpacing: ".6px", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}><Ic.Gift s={13} c="#8A6400" />TOM Perk</div>
            <div style={{ ...nu(700, 13.5, T.ink), marginTop: 3 }}>After your date: Kafe Luna nearby gives TOM couples 20% off.</div>
            <div style={{ ...nu(600, 11.5, T.soft), marginTop: 3 }}>Only if you choose. The date itself stays $0.</div>
          </div>
        </>
      )}
    </div>
  );
}

function You({ onSignUp, onUpgrade, verifyStatus, onVerify, onLegal, onDelete }) {
  const u = api.user;
  const chronoLabel = CHRONO.find(([v]) => v === u.chronotype)?.[1] || "";
  const ftLabel = (cm) => { const t = Math.round(cm / 2.54); return `${Math.floor(t / 12)}'${t % 12}"`; };
  const heightLabel = u.heightCm ? `${u.heightCm} cm (${ftLabel(u.heightCm)})` : null;
  if (u.isGuest) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", gap: 14 }}>
        <Ic.Person s={48} c={T.royal} />
        <h2 style={{ ...fr(600, 22, T.ink), margin: 0 }}>You're browsing as a guest</h2>
        <p style={{ ...nu(600, 14, T.soft), margin: 0 }}>Create your free profile to match and plan dates.</p>
        <div style={{ width: "100%", maxWidth: 240 }}><PrimaryBtn onClick={onSignUp}>Sign up free</PrimaryBtn></div>
        <div style={{ display: "flex", gap: 18, marginTop: 4 }}>
          <button onClick={() => onLegal("terms")} style={{ ...nu(800, 12, T.soft), border: "none", background: "none", cursor: "pointer", textDecoration: "underline" }}>Terms</button>
          <button onClick={() => onLegal("privacy")} style={{ ...nu(800, 12, T.soft), border: "none", background: "none", cursor: "pointer", textDecoration: "underline" }}>Privacy</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "6px 20px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 10px" }}>
          {u.profilePhoto ? <PhotoThumb src={u.profilePhoto} size={92} round /> : (
            <div style={{ width: 92, height: 92, borderRadius: "50%", background: `linear-gradient(135deg, ${T.royal}, ${T.violet})`, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Person s={44} c={T.white} /></div>
          )}
        </div>
        <h2 style={{ ...fr(600, 24, T.ink), margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>{u.name}, {u.age}{verifyStatus === "verified" && <Ic.ShieldCheck s={21} c={T.green} />}</h2>
        <p style={{ ...nu(700, 13, T.soft), margin: "4px 0 0" }}>{[u.city, heightLabel, chronoLabel].filter(Boolean).join(" · ")}</p>
      </div>
      {u.photos.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12 }}>
          {u.photos.map((src, i) => <PhotoThumb key={i} src={src} size={70} />)}
        </div>
      )}
      {[
        ["My bio", u.bio],
        ["Free dates I'm up for", u.thingsILikeToDo.join(", ")],
        ["Interests", u.interests.join(", ")],
        ["Hobbies", u.hobbies.join(", ")],
      ].filter(([, v]) => v).map(([label, value]) => (
        <div key={label} style={{ background: T.white, borderRadius: 16, padding: "13px 15px", marginBottom: 9, boxShadow: "0 3px 10px rgba(42,27,74,.06)" }}>
          <div style={{ ...nu(800, 11, T.soft), letterSpacing: ".6px", textTransform: "uppercase" }}>{label}</div>
          <div style={{ ...nu(700, 15, T.ink), marginTop: 3 }}>{value}</div>
        </div>
      ))}
      <div style={{ marginTop: 14, borderRadius: 18, padding: 16, background: `linear-gradient(135deg, ${T.royal}, ${T.violet})`, color: T.white, textAlign: "center" }}>
        <div style={fr(700, 18, T.white)}>Money spent on TOM</div>
        <div style={{ ...fr(700, 40, T.sun), margin: "4px 0" }}>$0.00</div>
        <div style={{ ...nu(700, 12.5, T.white), opacity: 0.9 }}>Don't spend money. Spend time.</div>
      </div>
      {verifyStatus !== "verified" && (
        <button onClick={onVerify} disabled={verifyStatus === "review"} style={{ width: "100%", marginTop: 10, borderRadius: 18, padding: "14px 16px", border: `2px solid ${verifyStatus === "review" ? T.lilacDeep : T.green}`, background: verifyStatus === "review" ? "#F7F5FC" : "#F0FBF5", cursor: verifyStatus === "review" ? "default" : "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
          <Ic.ShieldCheck s={26} c={verifyStatus === "review" ? T.soft : T.green} />
          <span style={{ flex: 1 }}>
            <span style={{ ...fr(700, 16, T.ink), display: "block" }}>{verifyStatus === "review" ? "Verification in review" : "Verify your profile"}</span>
            <span style={{ ...nu(700, 12.5, T.soft) }}>{verifyStatus === "review" ? "Usually done within 24 hours" : "Get the green badge. Match with more confidence."}</span>
          </span>
          {verifyStatus !== "review" && <Ic.Chevron s={16} c={T.green} />}
        </button>
      )}
      <button onClick={onUpgrade} style={{ width: "100%", marginTop: 10, borderRadius: 18, padding: "14px 16px", border: `2px solid ${T.sun}`, background: "#FFFBEF", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
        <Ic.Sun s={26} c={T.sun} />
        <span style={{ flex: 1 }}>
          <span style={{ ...fr(700, 16, T.royal), display: "block" }}>Get TOM<span style={{ color: T.sun }}>+</span></span>
          <span style={{ ...nu(700, 12.5, T.soft) }}>Golden Hours, Prime Time, Time Zones and more</span>
        </span>
        <Ic.Chevron s={16} c={T.royal} />
      </button>
      <div style={{ marginTop: 16 }}>
        <div style={{ ...nu(800, 11, T.soft), letterSpacing: ".6px", textTransform: "uppercase", margin: "0 2px 8px" }}>About and privacy</div>
        {[
          ["Privacy Policy", () => onLegal("privacy")],
          ["Terms of Service", () => onLegal("terms")],
        ].map(([label, fn]) => (
          <button key={label} onClick={fn} style={{ width: "100%", background: T.white, border: "none", borderRadius: 16, padding: "13px 15px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 3px 10px rgba(42,27,74,.06)" }}>
            <span style={{ ...nu(700, 14.5, T.ink) }}>{label}</span>
            <Ic.Chevron s={14} c={T.soft} />
          </button>
        ))}
        <button onClick={onDelete} style={{ width: "100%", background: T.white, border: "none", borderRadius: 16, padding: "13px 15px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 3px 10px rgba(42,27,74,.06)" }}>
          <span style={{ ...nu(700, 14.5, T.red) }}>Delete my account</span>
          <Ic.Chevron s={14} c={T.red} />
        </button>
      </div>
    </div>
  );
}

// ================= App =================
export default function TomApp() {
  const [screen, setScreen] = useState("home"); // home -> welcome -> builder -> main
  const [authMode, setAuthMode] = useState("signup");
  const [deck, setDeck] = useState(PROFILES);
  const [matches, setMatches] = useState([]);
  const [tab, setTab] = useState("discover");
  const [matched, setMatched] = useState(null);
  const [paywall, setPaywall] = useState(false);
  const [goldenLeft, setGoldenLeft] = useState(1); // 1 free Golden Hour per day
  const [myLoc, setMyLoc] = useState(FALLBACK_LOC);

  const [goldenIntro, setGoldenIntro] = useState(false);
  const [goldenSeen, setGoldenSeen] = useState(false);
  const [reporting, setReporting] = useState(null); // { profile, from: "deck" | "matches" }
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(null); // null | "review" | "verified"
  const [legal, setLegal] = useState(null); // null | "privacy" | "terms"
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteAccount = () => {
    if (api.user && api.user.email) delete api.accounts[api.user.email];
    api.user = null;
    setDeck(PROFILES);
    setMatches([]);
    setMatched(null);
    setGoldenLeft(1);
    setGoldenSeen(false);
    setVerifyStatus(null);
    setPaywall(false);
    setDeleteOpen(false);
    setTab("discover");
    setScreen("home");
  };

  React.useEffect(() => {
    if (verifyStatus !== "review") return;
    const t = setTimeout(() => { setVerifyStatus("verified"); if (api.user) api.user.verified = true; }, 4000);
    return () => clearTimeout(t);
  }, [verifyStatus]);

  const confirmReport = () => {
    if (!reporting) return;
    if (reporting.from === "deck") setDeck((d) => d.filter((p) => p.id !== reporting.profile.id));
    else setMatches((m) => m.filter((p) => p.id !== reporting.profile.id));
    setReporting(null);
  };

  const fireGolden = () => {
    if (sortedDeck.length === 0) return;
    if (goldenLeft <= 0) { setPaywall(true); return; }
    setGoldenLeft(goldenLeft - 1);
    const top = sortedDeck[0];
    setDeck((d) => d.filter((p) => p.id !== top.id));
    setMatched(top);
    setMatches((m) => [...m, top]);
  };
  const onGolden = () => {
    if (sortedDeck.length === 0) return;
    if (!goldenSeen) { setGoldenIntro(true); return; }
    fireGolden();
  };

  React.useEffect(() => {
    if (screen !== "main" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, // denied or unavailable: keep city-center fallback
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 }
    );
  }, [screen]);

  // Ranking: distance minus shared-interest boost (closest + most in common first)
  const sortedDeck = React.useMemo(
    () => [...deck].sort((a, b) => rankScore(myLoc, a) - rankScore(myLoc, b)),
    [deck, myLoc]
  );

  const onSwipe = (dir) => {
    if (sortedDeck.length === 0) return;
    const top = sortedDeck[0];
    setDeck((d) => d.filter((p) => p.id !== top.id));
    if (dir === "right") {
      setMatches((m) => {
        if (top.id % 2 === 1 || m.length === 0) { setMatched(top); return [...m, top]; }
        return m;
      });
    }
  };

  const tabs = [
    { id: "discover", icon: Ic.Hourglass, label: "Discover" },
    { id: "matches", icon: Ic.Heart, label: "Dates" },
    { id: "profile", icon: Ic.Person, label: "You" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${T.lilac} 0%, #F7F4FD 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "Nunito, sans-serif" }}>
      {FONT}
      <div style={{ width: "100%", maxWidth: 390, height: "min(780px, 94vh)", background: "#FBFAFE", borderRadius: 34, overflow: "hidden", boxShadow: "0 24px 60px rgba(42,27,74,.22)", position: "relative", display: "flex", flexDirection: "column" }}>
        {screen !== "home" && (
          <header style={{ padding: "18px 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ ...fr(700, 28, T.royal), margin: 0, lineHeight: 1, letterSpacing: "1px" }}>TOM<span style={{ color: T.sun }}>.</span></h1>
              <p style={{ ...nu(800, 10.5, T.soft), margin: "3px 0 0", letterSpacing: ".6px" }}>TIME OVER MONEY</p>
            </div>
            {screen === "main" && (
              <span style={{ ...fr(700, 12.5, T.royal), background: T.lilac, borderRadius: 999, padding: "6px 12px", textAlign: "center", lineHeight: 1.25 }}>Don't spend money.<br />Spend time.</span>
            )}
          </header>
        )}

        {screen === "home" && <Home onLegal={setLegal} onPick={(mode) => {
          if (mode === "guest") {
            api.user = { name: "Guest", age: null, isGuest: true, heightCm: null, gender: null, orientation: null, interestedIn: null, chronotype: null, bio: "", city: "", thingsILikeToDo: [], interests: [], hobbies: [], profilePhoto: null, photos: [] };
            setScreen("main");
          } else {
            setAuthMode(mode);
            setScreen("welcome");
          }
        }} />}
        {screen === "welcome" && <Welcome initialMode={authMode} onDone={(target) => setScreen(target)} />}
        {screen === "builder" && <Builder onDone={() => setScreen("main")} />}
        {screen === "main" && (
          <>
            {tab === "discover" && <Discover deck={sortedDeck} onSwipe={onSwipe} myLoc={myLoc} onGolden={onGolden} goldenLeft={goldenLeft} onReport={(p) => setReporting({ profile: p, from: "deck" })} />}
            {tab === "matches" && <Matches matches={matches} myLoc={myLoc} onUpgrade={() => setPaywall(true)} onReport={(p) => setReporting({ profile: p, from: "matches" })} />}
            {tab === "profile" && <You onLegal={setLegal} onDelete={() => setDeleteOpen(true)} verifyStatus={verifyStatus} onVerify={() => setVerifyOpen(true)} onUpgrade={() => setPaywall(true)} onSignUp={() => { setAuthMode("signup"); setScreen("welcome"); setTab("discover"); }} />}
            <nav style={{ display: "flex", justifyContent: "space-around", padding: "10px 8px 16px", background: T.white, borderTop: `1px solid ${T.lilac}` }}>
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ border: "none", background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, opacity: tab === t.id ? 1 : 0.45, padding: "4px 14px" }}>
                  {React.createElement(t.icon, { s: 22, c: T.royal })}
                  <span style={nu(800, 11, T.royal)}>{t.label}</span>
                </button>
              ))}
            </nav>
          </>
        )}

        {matched && <MatchModal profile={matched} onClose={() => setMatched(null)} myLoc={myLoc} />}
        {goldenIntro && (
          <GoldenIntro
            profileName={sortedDeck[0]?.name || "someone"}
            goldenLeft={goldenLeft}
            onSend={() => { setGoldenSeen(true); setGoldenIntro(false); fireGolden(); }}
            onClose={() => { setGoldenSeen(true); setGoldenIntro(false); }}
          />
        )}
        {reporting && <ReportModal profile={reporting.profile} onCancel={() => setReporting(null)} onConfirm={confirmReport} />}
        {verifyOpen && <VerifyModal onClose={() => setVerifyOpen(false)} onSubmit={() => { setVerifyOpen(false); setVerifyStatus("review"); }} />}
        {paywall && <Paywall onClose={() => setPaywall(false)} />}
        {legal && <LegalModal doc={legal} onClose={() => setLegal(null)} />}
        {deleteOpen && <DeleteModal onCancel={() => setDeleteOpen(false)} onConfirm={deleteAccount} />}
      </div>
    </div>
  );
}
