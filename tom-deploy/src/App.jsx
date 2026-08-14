import React, { useState, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ================= Supabase =================
const SUPABASE_URL = "https://adanpwwxovponnluoztd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fxfFnuDXlNm8dgEwPbNLog_1hkZlsbL";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Keep people signed in until THEY log out: store the session on the
    // device and refresh the token in the background before it expires.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "tom-auth",
    flowType: "pkce",
  },
});

// ================= Brand =================
const T = {
  royal: "#5B21B6", violet: "#7C3AED", lilac: "#EDE7FB", lilacDeep: "#D9CCF5",
  white: "#FFFFFF", sun: "#FFC53D", ink: "#2A1B4A", soft: "#8A7BAF", green: "#2FBF71",
  red: "#E5484D",
};

// ================= Toast Context =================
const ToastContext = React.createContext();

function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);
  const showToast = (message, duration = 3000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };
  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts }) {
  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 1000, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{ background: "rgba(42,27,74,.95)", color: "#FFFFFF", padding: "12px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, boxShadow: "0 8px 24px rgba(42,27,74,.2)", animation: "popIn .3s ease", maxWidth: 280 }}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function useToast() {
  return React.useContext(ToastContext);
}

const FONT = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    input, textarea { font-family: Nunito, sans-serif; }
    @keyframes popIn { 0% { transform: scale(.7); opacity: 0 } 70% { transform: scale(1.05) } 100% { transform: scale(1); opacity: 1 } }
    @keyframes floatUp { 0% { transform: translateY(8px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
    @keyframes buttonPress { 0% { transform: scale(1); } 50% { transform: scale(0.97); } 100% { transform: scale(1); } }
    @keyframes heartBlink { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .25; transform: scale(.82); } }
    button:active { animation: buttonPress 0.15s ease; }
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

// Maps a Supabase profiles row into the card shape Discover/Matches/Card expect
// Photos are stored as base64 data URLs inside the profiles table, so a plain
// select("*") drags every image byte across the network. gallery_photos is the
// worst offender: several full-size images per person. List views only need the
// single avatar, so they use this column list and fetch the gallery on demand
// when someone actually opens a profile.
const LIST_COLUMNS = "id,name,age,verified,bio,location,latitude,longitude,avatar_url,interests,hobbies,things_i_like_to_do,availability,height_cm,gender,chronotype,free_tonight_until,open_to_doubles,off_the_clock,is_deleted";

const CARD_GRADIENTS = [
  ["#7C3AED", "#B197F0"], ["#5B21B6", "#8B5CF6"], ["#9333EA", "#F0ABFC"],
  ["#6D28D9", "#67E8F9"], ["#7E22CE", "#FDA4AF"], ["#6B21A8", "#FDBA74"],
];
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0;
  return h;
}
// A profile only enters other people's decks once there is something to judge.
// Empty shells hurt everyone: they waste swipes and they make the whole app
// feel dead. Kept deliberately low so it filters shells, not shy people.
const MIN_BIO_CHARS = 20;
function profileComplete(row) {
  if (!row) return false;
  const bio = (row.bio || "").trim();
  return Boolean(row.name) && Boolean(row.age) && Boolean(row.avatar_url) && bio.length >= MIN_BIO_CHARS;
}
function missingProfileBits(row) {
  const missing = [];
  if (!row || !row.avatar_url) missing.push("photo");
  if (!row || (row.bio || "").trim().length < MIN_BIO_CHARS) missing.push("bio");
  if (!row || !row.age) missing.push("age");
  return missing;
}

function dbRowToCard(row) {
  const h = hashStr(row.id);
  const likes = [...(row.interests || []), ...(row.hobbies || []), ...(row.things_i_like_to_do || [])];
  return {
    id: row.id,
    name: row.name,
    verified: Boolean(row.verified),
    likes,
    age: row.age,
    loc: (row.latitude != null && row.longitude != null) ? { lat: row.latitude, lng: row.longitude } : null,
    grad: CARD_GRADIENTS[h % CARD_GRADIENTS.length],
    photo: row.avatar_url || null,
    photos: row.gallery_photos || [],
    vibe: likes[0] || "New here",
    tags: (row.hobbies && row.hobbies.length ? row.hobbies : (row.interests || [])).slice(0, 2),
    idea: DATE_IDEAS[h % DATE_IDEAS.length],
    bio: row.bio || "Just joined TOM. Say hi!",
    // Everything below powers the full profile view
    city: row.location || null,
    heightCm: row.height_cm ?? null,
    gender: row.gender || null,
    chronotype: row.chronotype || null,
    interests: row.interests || [],
    hobbies: row.hobbies || [],
    activities: row.things_i_like_to_do || [],
    availability: row.availability || [],
    freeTonight: Boolean(row.free_tonight_until) && new Date(row.free_tonight_until) > new Date(),
    openToDoubles: Boolean(row.open_to_doubles),
  };
}

// Maps a Supabase profiles row back into the shape the UI expects
function rowToUser(row, email) {
  return {
    id: row.id,
    name: row.name || "",
    age: row.age ?? null,
    email: email || row.email || "",
    heightCm: row.height_cm ?? null,
    gender: row.gender || null,
    orientation: row.orientation || null,
    interestedIn: row.interested_in || null,
    chronotype: row.chronotype || null,
    bio: row.bio || "",
    city: row.location || "",
    thingsILikeToDo: row.things_i_like_to_do || [],
    interests: row.interests || [],
    hobbies: row.hobbies || [],
    profilePhoto: row.avatar_url || null,
    photos: row.gallery_photos || [],
    verified: Boolean(row.verified),
    searchRadiusKm: row.search_radius_km ?? 50,
    distanceUnit: row.distance_unit || "km",
    emailOnMatch: row.email_on_match !== false,
    emailOnMessage: row.email_on_message !== false,
    emailOnDate: row.email_on_date !== false,
    isPlus: Boolean(row.is_plus) && (!row.plus_until || new Date(row.plus_until) > new Date()),
    plusUntil: row.plus_until || null,
    offTheClock: Boolean(row.off_the_clock),
    filterMinAge: row.filter_min_age ?? 18,
    filterMaxAge: row.filter_max_age ?? 99,
    filterInterests: row.filter_interests || [],
    availability: row.availability || [],
    freeTonightUntil: row.free_tonight_until || null,
    openToDoubles: Boolean(row.open_to_doubles),
  };
}

// Free-tier daily limits. TOM+ lifts these.
// A pass is not forever. After this many days they can come back around.
// Set low (10) while the user base is small, so decks never dead-end.
// Raise this as TOM grows: 20-30 once there are plenty of people nearby.
const PASS_EXPIRY_DAYS = 10;
const FREE_DAILY_LIKES = 50;
const FREE_DAILY_GOLDEN = 1;
const PLUS_DAILY_GOLDEN = 5;
const startOfTodayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const api = {
  user: null,
  async signup({ name, email, password, age }) {
    if (!name.trim()) return { error: "Name required" };
    const mail = (email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return { error: "Valid email required" };
    if (password.length < 8) return { error: "Password must be at least 8 characters" };
    const a = Number(age);
    if (!Number.isInteger(a) || a < 18 || a > 120) return { error: "You must be 18 or older to join TOM" };

    const { data, error } = await supabase.auth.signUp({ email: mail, password });
    if (error) return { error: error.message };
    const authUser = data.user;
    if (!authUser) return { error: "Check your email to confirm your account, then sign in." };

    const user = {
      id: authUser.id,
      name: name.trim(), age: a, email: mail,
      heightCm: null, gender: null, orientation: null, interestedIn: null,
      chronotype: null, bio: "", city: "",
      thingsILikeToDo: [], interests: [], hobbies: [],
      profilePhoto: null, photos: [],
      searchRadiusKm: 50, distanceUnit: "km",
    };
    const { error: insertErr } = await supabase.from("profiles").insert({
      id: authUser.id, email: mail, name: user.name, age: user.age,
    });
    if (insertErr) return { error: insertErr.message };
    this.user = user;
    return { ok: true };
  },
  async login({ email, password }) {
    const mail = (email || "").trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password });
    if (error) return { error: "Email or password is incorrect" };
    let { data: row, error: profErr } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
    if (profErr || !row) {
      // Account exists in auth but has no profile row yet (e.g. an earlier
      // signup attempt got interrupted). Create the missing row instead of
      // leaving the user stuck.
      const { data: created, error: createErr } = await supabase.from("profiles")
        .insert({ id: data.user.id, email: mail, name: "", age: null })
        .select().single();
      if (createErr || !created) return { error: "We couldn't set up your profile. Please try again." };
      row = created;
    }
    this.user = rowToUser(row, mail);
    return { ok: true, complete: Boolean(this.user.bio && this.user.profilePhoto) };
  },
  // Sends the reset link. Always reports success, even for an address that
  // has no account, so this can't be used to find out who is on TOM.
  async requestPasswordReset(email) {
    const mail = (email || "").trim().toLowerCase();
    if (!mail || !mail.includes("@")) return { error: "Enter your email address" };
    const redirectTo = `${window.location.origin}${window.location.pathname}?recovery=1`;
    const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo });
    if (error && /rate|limit|seconds/i.test(error.message || "")) {
      return { error: "Too many attempts. Wait a minute and try again." };
    }
    return { ok: true };
  },
  // Called from the recovery screen. Supabase has already put the user in a
  // temporary session from the emailed link, so updateUser is enough.
  async setNewPassword(password) {
    if (!password || password.length < 8) return { error: "Password must be at least 8 characters" };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    const { data } = await supabase.auth.getSession();
    if (!data.session) return { ok: true, signedIn: false };
    const { data: row } = await supabase.from("profiles").select("*").eq("id", data.session.user.id).single();
    if (row) this.user = rowToUser(row, data.session.user.email);
    return { ok: true, signedIn: Boolean(row), complete: Boolean(row && row.bio && row.avatar_url) };
  },
  async restoreSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return { ok: false };
    const { data: row, error } = await supabase.from("profiles").select("*").eq("id", data.session.user.id).single();
    if (error || !row) {
      // The session is valid, so a failed profile read (network blip, brief
      // outage) must NOT log the person out. Keep them in with what we know
      // and let the next load fill in the rest.
      this.user = {
        id: data.session.user.id,
        email: data.session.user.email,
        name: "", age: null, bio: "", city: "",
        heightCm: null, gender: null, orientation: null, interestedIn: null,
        chronotype: null, thingsILikeToDo: [], interests: [], hobbies: [],
        profilePhoto: null, photos: [], verified: false,
        searchRadiusKm: 50, distanceUnit: "km",
        isPlus: false, offTheClock: false,
        filterMinAge: 18, filterMaxAge: 99, filterInterests: [],
        profileIncomplete: true,
      };
      return { ok: true, complete: false };
    }
    this.user = rowToUser(row, data.session.user.email);
    return { ok: true, complete: Boolean(this.user.bio && this.user.profilePhoto) };
  },
  async saveProfile() {
    if (!this.user || !this.user.id) return { error: "Not signed in" };
    const u = this.user;
    const { error } = await supabase.from("profiles").update({
      name: u.name, age: u.age, bio: u.bio, location: u.city,
      gender: u.gender, orientation: u.orientation, interested_in: u.interestedIn,
      chronotype: u.chronotype, height_cm: u.heightCm,
      interests: u.interests, hobbies: u.hobbies, things_i_like_to_do: u.thingsILikeToDo,
      avatar_url: u.profilePhoto, gallery_photos: u.photos,
      search_radius_km: u.searchRadiusKm, distance_unit: u.distanceUnit,
      email_on_match: u.emailOnMatch !== false,
      email_on_message: u.emailOnMessage !== false,
      email_on_date: u.emailOnDate !== false,
      off_the_clock: Boolean(u.offTheClock),
      filter_min_age: u.filterMinAge ?? 18, filter_max_age: u.filterMaxAge ?? 99,
      filter_interests: u.filterInterests || [],
      availability: u.availability || [],
      free_tonight_until: u.freeTonightUntil || null,
      open_to_doubles: Boolean(u.openToDoubles),
      orientation_consent_at: new Date().toISOString(),
    }).eq("id", u.id);
    if (error) return { error: error.message };
    return { ok: true };
  },
  async logout() {
    await supabase.auth.signOut();
    this.user = null;
    return { ok: true };
  },
  async deleteAccount() {
    if (this.user && this.user.id) {
      await supabase.from("profiles").delete().eq("id", this.user.id);
    }
    await supabase.auth.signOut();
    this.user = null;
    return { ok: true };
  },
  async loadDeck() {
    // Guests browse real people too. TOM never shows invented profiles.
    if (!this.user || this.user.isGuest || !this.user.id) {
      const { data: guestRows } = await supabase.from("profiles").select(LIST_COLUMNS).limit(50);
      const guestCards = (guestRows || [])
        // NULL is not false in SQL, so these checks live here, not in the query
        .filter((p) => profileComplete(p) && p.is_deleted !== true && p.off_the_clock !== true)
        .map(dbRowToCard);
      const guestReps = await this.loadReputations(guestCards.map((c) => c.id));
      return { cards: guestCards.map((c) => ({ ...c, rep: guestReps[c.id] || null })) };
    }
    const myId = this.user.id;
    const [{ data: allProfiles, error: profErr }, { data: myLikes }, { data: myBlocks }, { data: likedMe }] = await Promise.all([
      supabase.from("profiles").select(LIST_COLUMNS).neq("id", myId),
      supabase.from("likes").select("liked_user_id, action, created_at").eq("user_id", myId),
      supabase.from("blocks").select("blocked_user_id").eq("user_id", myId),
      // People who gave me their time; used for second chances after a pass
      supabase.from("likes").select("user_id").eq("liked_user_id", myId).in("action", ["spend_time", "golden_hour"]),
    ]);

    // Blocks are permanent. They never expire and never resurface.
    const blocked = new Set((myBlocks || []).map((b) => b.blocked_user_id));
    const likedMeSet = new Set((likedMe || []).map((l) => l.user_id));

    const hidden = new Set();      // people who should not appear at all
    const secondChance = new Set(); // passed on, but they like me: bring back
    const cutoff = Date.now() - PASS_EXPIRY_DAYS * 86400000;

    (myLikes || []).forEach((l) => {
      if (l.action === "pass") {
        const passedAt = l.created_at ? new Date(l.created_at).getTime() : 0;
        // A pass fades after a while, so decks don't dead-end forever
        const expired = passedAt > 0 && passedAt < cutoff;
        if (likedMeSet.has(l.liked_user_id)) {
          secondChance.add(l.liked_user_id);
        } else if (!expired) {
          hidden.add(l.liked_user_id);
        }
      } else {
        // Already liked or golden-houred: don't show again
        hidden.add(l.liked_user_id);
      }
    });

    if (profErr) return { cards: [], error: profErr.message };
    let cards = (allProfiles || [])
      // A row with no name is a half finished signup, not a person to show.
      // is_deleted and off_the_clock are checked against true, because NULL
      // is not false in SQL and would otherwise hide everyone silently.
      .filter((p) => !blocked.has(p.id) && !hidden.has(p.id)
        && p.is_deleted !== true && p.off_the_clock !== true && p.name)
      .map(dbRowToCard)
      .map((c) => ({ ...c, secondChance: secondChance.has(c.id) }));

    // Batch 3: attach Time Reputation to each card (only 3+ reviews come back)
    const reps = await this.loadReputations(cards.map((c) => c.id));
    cards = cards.map((c) => ({ ...c, rep: reps[c.id] || null }));
    return { cards };
  },
  // Undo the last swipe. TOM+ only. Blocks are never undone here.
  async undoLastSwipe() {
    if (!this.user || !this.user.id) return { error: "Not signed in" };
    const myId = this.user.id;
    const { data: last } = await supabase.from("likes")
      .select("id, liked_user_id, action, created_at")
      .eq("user_id", myId)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = last && last[0];
    if (!row) return { error: "Nothing to undo" };
    // If that swipe already produced a match, leave it alone
    const u1 = myId < row.liked_user_id ? myId : row.liked_user_id;
    const u2 = myId < row.liked_user_id ? row.liked_user_id : myId;
    const { data: existing } = await supabase.from("matches").select("id")
      .eq("user_id_1", u1).eq("user_id_2", u2).eq("is_active", true).maybeSingle();
    if (existing) return { error: "That one turned into a match already" };
    const { error } = await supabase.from("likes").delete().eq("id", row.id);
    if (error) return { error: error.message };
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", row.liked_user_id).single();
    return { ok: true, action: row.action, profile: prof ? dbRowToCard(prof) : null };
  },
  async loadMatches() {
    if (!this.user || !this.user.id) return { matches: [], error: "Not signed in" };
    const myId = this.user.id;
    // is_active can be NULL on older rows, and NULL is not false in SQL, so
    // filter it out here rather than in the query.
    const { data: rows, error } = await supabase.from("matches").select("*")
      .or(`user_id_1.eq.${myId},user_id_2.eq.${myId}`);
    if (error) return { matches: [], error: error.message };
    const active = (rows || []).filter((r) => r.is_active !== false);
    if (active.length === 0) return { matches: [] };
    const otherIds = active.map((r) => (r.user_id_1 === myId ? r.user_id_2 : r.user_id_1));
    const { data: profs, error: profErr } = await supabase.from("profiles").select(LIST_COLUMNS).in("id", otherIds);
    if (profErr) return { matches: [], error: profErr.message };
    const matchIdByUser = {};
    active.forEach((r) => { matchIdByUser[r.user_id_1 === myId ? r.user_id_2 : r.user_id_1] = r.id; });
    return { matches: (profs || []).map((p) => ({ ...dbRowToCard(p), matchId: matchIdByUser[p.id] })) };
  },
  // Galleries are excluded from list queries because they are base64 blobs.
  // Fetch one person's photos only when their profile is actually opened.
  async loadGallery(userId) {
    if (!userId) return { photos: [] };
    const { data, error } = await supabase.from("profiles").select("gallery_photos").eq("id", userId).single();
    if (error) return { photos: [], error: error.message };
    return { photos: (data && data.gallery_photos) || [] };
  },
  // Uploads a file to the photos bucket and returns a short public URL.
  // The folder is the user's id because the storage policy only allows writing
  // inside your own folder. The long cache header is what makes the CDN serve
  // repeat views instead of the database, which is the whole point of moving
  // photos out of the table.
  async uploadPhoto(file) {
    if (!this.user || !this.user.id || this.user.isGuest) return { error: "Sign in to upload photos" };
    const rawExt = (file.name && file.name.includes(".")) ? file.name.split(".").pop().toLowerCase() : "";
    const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : "jpg";
    const path = `${this.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("photos").upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) return { error: error.message };
    const { data } = supabase.storage.from("photos").getPublicUrl(path);
    if (!data || !data.publicUrl) return { error: "Upload succeeded but no URL came back" };
    return { url: data.publicUrl };
  },
  // One-time cleanup for photos saved before Storage existed. Anything still
  // held as a base64 data URL gets uploaded to the bucket and replaced with a
  // short link. Runs quietly in the background after login and becomes a no-op
  // once there is nothing left to convert. A photo that fails to convert is
  // left exactly as it was, so nothing is ever lost.
  async migrateBase64Photos() {
    if (!this.user || !this.user.id || this.user.isGuest) return { migrated: 0 };
    // React re-invokes effects in development, and a second pass would upload
    // every photo again. Once per session is enough.
    if (this._photoMigrationRan) return { migrated: 0 };
    this._photoMigrationRan = true;
    const isData = (v) => typeof v === "string" && v.startsWith("data:");
    const main = this.user.profilePhoto;
    const gallery = Array.isArray(this.user.photos) ? this.user.photos : [];
    if (!isData(main) && !gallery.some(isData)) return { migrated: 0 };

    const convert = async (dataUrl) => {
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        if (!blob || !blob.size) return null;
        const sub = (blob.type && blob.type.split("/")[1]) || "jpg";
        const ext = sub === "jpeg" ? "jpg" : sub.replace(/[^a-z0-9]/g, "") || "jpg";
        const file = new File([blob], `migrated.${ext}`, { type: blob.type || "image/jpeg" });
        const up = await this.uploadPhoto(file);
        return up && up.url ? up.url : null;
      } catch {
        return null;
      }
    };

    let migrated = 0;
    let nextMain = main;
    if (isData(main)) {
      const url = await convert(main);
      if (url) { nextMain = url; migrated++; }
    }
    const nextGallery = [];
    for (const photo of gallery) {
      if (!isData(photo)) { nextGallery.push(photo); continue; }
      const url = await convert(photo);
      if (url) { nextGallery.push(url); migrated++; }
      else nextGallery.push(photo);
    }

    if (migrated === 0) return { migrated: 0 };
    const prevMain = this.user.profilePhoto;
    const prevGallery = this.user.photos;
    this.user.profilePhoto = nextMain;
    this.user.photos = nextGallery;
    const r = await this.saveProfile();
    if (r.error) {
      // Leave the in-memory copy matching what is actually stored.
      this.user.profilePhoto = prevMain;
      this.user.photos = prevGallery;
      return { migrated: 0, error: r.error };
    }
    return { migrated };
  },
  async swipe(profileId, action) {
    if (!this.user || !this.user.id) return { matched: false };
    // Server-side function checks the mutual like and creates the match in one
    // atomic step. The old client-side check was blocked by row security.
    const { data, error } = await supabase.rpc("swipe_and_match", {
      target_id: profileId, swipe_action: action,
    });
    if (error || !data) return { matched: false };
    return { matched: Boolean(data.matched), matchId: data.match_id || null };
  },
  async sendGoldenHour(profileId) {
    if (!this.user || !this.user.id) return { ok: false };
    const myId = this.user.id;
    const { data } = await supabase.rpc("swipe_and_match", {
      target_id: profileId, swipe_action: "golden_hour",
    });
    await supabase.from("golden_hours").insert({ user_id: myId, recipient_id: profileId });
    return { ok: true, matchId: data && data.match_id ? data.match_id : null };
  },
  async reportAndBlock(profileId, reason) {
    const myId = this.user && this.user.id ? this.user.id : null;
    await supabase.from("reports").insert({ reporter_id: myId, reported_user_id: profileId, reason: reason || "Something else" });
    if (myId) await supabase.from("blocks").insert({ user_id: myId, blocked_user_id: profileId });
    return { ok: true };
  },
  async countAdmirers() {
    if (!this.user || !this.user.id) return 0;
    const myId = this.user.id;
    const [{ data: likes }, { data: matchRows }] = await Promise.all([
      supabase.from("likes").select("user_id").eq("liked_user_id", myId).in("action", ["spend_time", "golden_hour"]),
      supabase.from("matches").select("*").or(`user_id_1.eq.${myId},user_id_2.eq.${myId}`).eq("is_active", true),
    ]);
    const matchedIds = new Set((matchRows || []).map((r) => (r.user_id_1 === myId ? r.user_id_2 : r.user_id_1)));
    const admirerIds = new Set((likes || []).map((l) => l.user_id).filter((id) => !matchedIds.has(id)));
    return admirerIds.size;
  },
  // Batch 2: full admirer profiles for TOM+ "See who likes you"
  async loadAdmirers() {
    if (!this.user || !this.user.id) return [];
    const myId = this.user.id;
    const [{ data: likes }, { data: matchRows }, { data: myBlocks }] = await Promise.all([
      supabase.from("likes").select("user_id").eq("liked_user_id", myId).in("action", ["spend_time", "golden_hour"]),
      supabase.from("matches").select("*").or(`user_id_1.eq.${myId},user_id_2.eq.${myId}`).eq("is_active", true),
      supabase.from("blocks").select("blocked_user_id").eq("user_id", myId),
    ]);
    const matchedIds = new Set((matchRows || []).map((r) => (r.user_id_1 === myId ? r.user_id_2 : r.user_id_1)));
    const blockedIds = new Set((myBlocks || []).map((b) => b.blocked_user_id));
    const admirerIds = [...new Set((likes || []).map((l) => l.user_id))].filter((id) => !matchedIds.has(id) && !blockedIds.has(id));
    if (admirerIds.length === 0) return [];
    const { data: profs } = await supabase.from("profiles").select(LIST_COLUMNS).in("id", admirerIds).eq("is_deleted", false);
    return (profs || []).map(dbRowToCard);
  },
  // Batch 2: Weekly Prime Time boost (7 days at the top of the deck)
  async myReputation() {
    if (!this.user || !this.user.id) return null;
    const { data } = await supabase.rpc("my_time_reputation");
    return data || null;
  },
  async setFreeTonight(on) {
    if (!this.user || !this.user.id) return { error: "Not signed in" };
    const until = on ? endOfToday() : null;
    const { error } = await supabase.from("profiles")
      .update({ free_tonight_until: until }).eq("id", this.user.id);
    if (error) return { error: error.message };
    this.user.freeTonightUntil = until;
    return { ok: true };
  },
  async saveLocation(lat, lng) {
    if (!this.user || !this.user.id || this.user.isGuest) return { ok: false };
    if (typeof lat !== "number" || typeof lng !== "number") return { ok: false };
    const { error } = await supabase.from("profiles")
      .update({ latitude: lat, longitude: lng, location_updated_at: new Date().toISOString() })
      .eq("id", this.user.id);
    if (error) return { error: error.message };
    this.user.latitude = lat;
    this.user.longitude = lng;
    return { ok: true };
  },
  async activateWeeklyBoost() {
    if (!this.user || !this.user.id) return { error: "Not signed in" };
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    const { error } = await supabase.from("profiles").update({
      weekly_boost_active_at: new Date().toISOString(),
      weekly_boost_expires_at: expiry.toISOString(),
    }).eq("id", this.user.id);
    if (error) return { error: error.message };
    return { ok: true, expiresAt: expiry.toISOString() };
  },
  // ===== Batch 3: planned dates, reviews, reputation (all via RPCs) =====
  async getPlannedDate(matchId) {
    if (!matchId) return null;
    const { data, error } = await supabase.rpc("get_planned_date", { p_match_id: matchId });
    if (error || !data) return null;
    return data;
  },
  async proposeDate(matchId, idea, scheduledAt, isDouble) {
    const { data, error } = await supabase.rpc("propose_date", {
      p_match_id: matchId, p_idea: idea, p_scheduled_at: scheduledAt || null,
      p_is_double: Boolean(isDouble),
    });
    if (error) return { error: error.message };
    return { ok: true, date: data };
  },
  // Both people are asked what happened; a date only counts when both say met
  async answerOutcome(dateId, answer) {
    const { data, error } = await supabase.rpc("answer_date_outcome", {
      p_date_id: dateId, p_answer: answer,
    });
    if (error) return { error: error.message };
    return { ok: true, result: data };
  },
  async loadPendingOutcome() {
    const { data, error } = await supabase.rpc("pending_outcome");
    if (error || !data) return null;
    return data;
  },
  async confirmDate(dateId) {
    const { error } = await supabase.rpc("confirm_date", { p_date_id: dateId });
    return error ? { error: error.message } : { ok: true };
  },
  async completeDate(dateId) {
    const { error } = await supabase.rpc("complete_date", { p_date_id: dateId });
    return error ? { error: error.message } : { ok: true };
  },
  async submitReview(dateId, timeWellSpent, traits, flag) {
    const { error } = await supabase.rpc("submit_date_review", {
      p_date_id: dateId, p_time_well_spent: timeWellSpent, p_traits: traits, p_flag: flag || null,
    });
    return error ? { error: error.message } : { ok: true };
  },
  async loadPendingReview() {
    // Returns the oldest completed date this user has not reviewed yet, or null
    const { data, error } = await supabase.rpc("pending_review");
    if (error || !data) return null;
    return data;
  },
  async loadReputations(userIds) {
    if (!userIds || userIds.length === 0) return {};
    const { data, error } = await supabase.rpc("get_time_reputations", { p_user_ids: userIds });
    if (error || !data) return {};
    const map = {};
    (data || []).forEach((r) => { map[r.user_id] = { pct: r.well_spent_pct, traits: r.top_traits || [], total: r.total }; });
    return map;
  },
  async loadDailyUsage() {
    if (!this.user || !this.user.id) return { likesUsed: 0, goldenUsed: 0 };
    const since = startOfTodayISO();
    const { data } = await supabase.from("likes")
      .select("action").eq("user_id", this.user.id).gte("created_at", since);
    const rows = data || [];
    return {
      likesUsed: rows.filter((r) => r.action === "spend_time" || r.action === "golden_hour").length,
      goldenUsed: rows.filter((r) => r.action === "golden_hour").length,
    };
  },
  likeLimit() {
    return this.user && this.user.isPlus ? Infinity : FREE_DAILY_LIKES;
  },
  goldenLimit() {
    return this.user && this.user.isPlus ? PLUS_DAILY_GOLDEN : FREE_DAILY_GOLDEN;
  },
  async loadMessages(matchId) {
    const { data } = await supabase.from("messages").select("*")
      .eq("match_id", matchId).order("created_at", { ascending: true });
    return data || [];
  },
  async markRead(matchId) {
    if (!this.user || !this.user.id || !matchId) return;
    await supabase.rpc("tom_mark_read", { p_match_id: matchId });
  },
  // Powers the dot on the Connections tab. Never let a failure here
  // surface as an error: a missing badge is better than a broken tab.
  async unreadSummary() {
    if (!this.user || !this.user.id) return { unread: 0, actions: 0 };
    const { data, error } = await supabase.rpc("tom_unread_summary");
    if (error || !data || !data.length) return { unread: 0, actions: 0 };
    return { unread: data[0].unread_count || 0, actions: data[0].action_count || 0 };
  },
  // Per-connection breakdown so each row in Connections can show its own badge.
  async unreadByMatch() {
    if (!this.user || !this.user.id) return {};
    const { data, error } = await supabase.rpc("tom_unread_by_match");
    if (error || !data) return {};
    const byUser = {};
    data.forEach((r) => {
      byUser[r.other_id] = { unread: r.unread_count || 0, action: Boolean(r.has_action) };
    });
    return byUser;
  },
  async sendMessage(matchId, body) {
    if (!this.user || !this.user.id) return { error: "Not signed in" };
    const text = (body || "").trim();
    if (!text) return { error: "Message is empty" };
    const { data, error } = await supabase.from("messages")
      .insert({ match_id: matchId, sender_id: this.user.id, body: text })
      .select().single();
    if (error) return { error: error.message };
    return { ok: true, message: data };
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

// Display labels for stored option values. English is the stored key so that
// shared interests still match across languages; only the label changes.
const LABELS = {
  "Weekday mornings": { tr: "Hafta i\u00e7i sabahlar\u0131", es: "Ma\u00f1anas entre semana" },
  "Weekday evenings": { tr: "Hafta i\u00e7i ak\u015famlar\u0131", es: "Tardes entre semana" },
  "Weekend days": { tr: "Hafta sonu g\u00fcnd\u00fcz", es: "D\u00edas de fin de semana" },
  "Weekend nights": { tr: "Hafta sonu geceleri", es: "Noches de fin de semana" },
  // Activities
  "Stargazing": { tr: "Y\u0131ld\u0131z izleme", es: "Observar estrellas" },
  "Board games": { tr: "Kutu oyunlar\u0131", es: "Juegos de mesa" },
  "Park hangs": { tr: "Parkta tak\u0131lmak", es: "Ratos en el parque" },
  "Walks": { tr: "Y\u00fcr\u00fcy\u00fcşler", es: "Paseos" },
  "Free museums": { tr: "\u00dccretsiz m\u00fczeler", es: "Museos gratis" },
  "Sunset spots": { tr: "G\u00fcn bat\u0131m\u0131 noktalar\u0131", es: "Miradores al atardecer" },
  "Market browsing": { tr: "\u00c7ar\u015f\u0131 gezmek", es: "Recorrer mercados" },
  "Beach days": { tr: "Sahil g\u00fcnleri", es: "D\u00edas de playa" },
  "People watching": { tr: "\u0130nsan izlemek", es: "Observar a la gente" },
  "Free concerts": { tr: "\u00dccretsiz konserler", es: "Conciertos gratis" },
  "Picnics (bring your own)": { tr: "Piknik (kendi getirdi\u011fin)", es: "Picnic (trae lo tuyo)" },
  "Photography strolls": { tr: "Foto\u011fraf y\u00fcr\u00fcy\u00fc\u015f\u00fc", es: "Paseos fotogr\u00e1ficos" },
  // Interests
  "Music": { tr: "M\u00fczik", es: "M\u00fasica" },
  "Art": { tr: "Sanat", es: "Arte" },
  "History": { tr: "Tarih", es: "Historia" },
  "Film": { tr: "Sinema", es: "Cine" },
  "Food": { tr: "Yemek", es: "Comida" },
  "Travel": { tr: "Seyahat", es: "Viajes" },
  "Books": { tr: "Kitaplar", es: "Libros" },
  "Fitness": { tr: "Spor", es: "Fitness" },
  "Tech": { tr: "Teknoloji", es: "Tecnolog\u00eda" },
  "Nature": { tr: "Do\u011fa", es: "Naturaleza" },
  "Fashion": { tr: "Moda", es: "Moda" },
  "Languages": { tr: "Diller", es: "Idiomas" },
  // Hobbies
  "Chess": { tr: "Satran\u00e7", es: "Ajedrez" },
  "Photography": { tr: "Foto\u011fraf\u00e7\u0131l\u0131k", es: "Fotograf\u00eda" },
  "Hiking": { tr: "Do\u011fa y\u00fcr\u00fcy\u00fc\u015f\u00fc", es: "Senderismo" },
  "Dancing": { tr: "Dans", es: "Baile" },
  "Reading": { tr: "Okumak", es: "Lectura" },
  "Walking": { tr: "Y\u00fcr\u00fcmek", es: "Caminar" },
  "Cycling": { tr: "Bisiklet", es: "Ciclismo" },
  "Basketball": { tr: "Basketbol", es: "Baloncesto" },
  "Yoga": { tr: "Yoga", es: "Yoga" },
  "Running": { tr: "Ko\u015fu", es: "Correr" },
  "Museums": { tr: "M\u00fczeler", es: "Museos" },
  "Art Galleries": { tr: "Sanat galerileri", es: "Galer\u00edas de arte" },
  "Window Shopping": { tr: "Vitrin gezmek", es: "Mirar escaparates" },
  "Birdwatching": { tr: "Ku\u015f g\u00f6zlemi", es: "Observaci\u00f3n de aves" },
  "Picnics": { tr: "Piknik", es: "Picnic" },
  // Gender
  "Man": { tr: "Erkek", es: "Hombre" },
  "Woman": { tr: "Kad\u0131n", es: "Mujer" },
  "Nonbinary": { tr: "\u0130kili olmayan", es: "No binario" },
  "Other": { tr: "Di\u011fer", es: "Otro" },
  "Prefer not to say": { tr: "Belirtmek istemiyorum", es: "Prefiero no decirlo" },
  // Orientation
  "Straight": { tr: "Heteroseks\u00fcel", es: "Heterosexual" },
  "Gay": { tr: "Gey", es: "Gay" },
  "Lesbian": { tr: "Lezbiyen", es: "Lesbiana" },
  "Bisexual": { tr: "Biseks\u00fcel", es: "Bisexual" },
  "Pansexual": { tr: "Panseks\u00fcel", es: "Pansexual" },
  "Asexual": { tr: "Aseks\u00fcel", es: "Asexual" },
  "Queer": { tr: "Queer", es: "Queer" },
  // Interested in
  "Men": { tr: "Erkekler", es: "Hombres" },
  "Women": { tr: "Kad\u0131nlar", es: "Mujeres" },
  "Everyone": { tr: "Herkes", es: "Todos" },
  // Chronotype
  "Morning person": { tr: "Sabah insan\u0131", es: "Persona de ma\u00f1ana" },
  "Night person": { tr: "Gece insan\u0131", es: "Persona de noche" },
  "Both": { tr: "\u0130kisi de", es: "Ambos" },
  // Review traits
  "On time": { tr: "Dakik", es: "Puntual" },
  "Great listener": { tr: "\u0130yi dinleyici", es: "Sabe escuchar" },
  "Made me laugh": { tr: "Beni g\u00fcld\u00fcrd\u00fc", es: "Me hizo re\u00edr" },
  "Felt safe": { tr: "G\u00fcvende hissettim", es: "Me sent\u00ed seguro" },
  "Genuine": { tr: "Samimi", es: "Aut\u00e9ntico" },
  "Good energy": { tr: "\u0130yi enerji", es: "Buena energ\u00eda" },
  "Planned it well": { tr: "\u0130yi planlam\u0131\u015f", es: "Lo planeó bien" },
  "Respectful": { tr: "Sayg\u0131l\u0131", es: "Respetuoso" },
  "Easy to talk to": { tr: "Konu\u015fmas\u0131 kolay", es: "F\u00e1cil de hablar" },
  "Adventurous": { tr: "Maceraperest", es: "Aventurero" },
  // Review flags
  "They paid or insisted on paying": { tr: "\u00d6dedi ya da \u00f6demekte \u0131srar etti", es: "Pag\u00f3 o insisti\u00f3 en pagar" },
  "Didn't show up": { tr: "Gelmedi", es: "No apareci\u00f3" },
  "Made me uncomfortable": { tr: "Beni rahats\u0131z etti", es: "Me incomod\u00f3" },
};

// Translate a stored option value for display
function useLabel() {
  const { lang } = useLang();
  return (key) => (lang === "en" ? key : (LABELS[key] && LABELS[key][lang]) || key);
}

// ================= Availability =================
// TOM is named after time, so when someone is free is a first class signal.
const AVAIL_SLOTS = [
  ["weekday_morning", "Weekday mornings"],
  ["weekday_evening", "Weekday evenings"],
  ["weekend_day", "Weekend days"],
  ["weekend_night", "Weekend nights"],
];
// "Free tonight" expires on its own at the end of the day
function freeTonightActive(iso) {
  return Boolean(iso) && new Date(iso) > new Date();
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

const ACTIVITY_POOL = ["Stargazing", "Board games", "Park hangs", "Walks", "Free museums", "Sunset spots", "Market browsing", "Beach days", "People watching", "Free concerts", "Picnics (bring your own)", "Photography strolls"];
const INTEREST_POOL = ["Music", "Art", "History", "Film", "Food", "Travel", "Books", "Fitness", "Tech", "Nature", "Fashion", "Languages"];
const HOBBY_POOL = ["Chess", "Photography", "Hiking", "Dancing", "Reading", "Walking", "Cycling", "Basketball", "Yoga", "Running", "Stargazing", "Museums", "Art Galleries", "Window Shopping", "Birdwatching", "Picnics"];
const GENDERS = [["man", "Man"], ["woman", "Woman"], ["nonbinary", "Nonbinary"], ["other", "Other"], ["prefer_not_to_say", "Prefer not to say"]];
const ORIENTATIONS = [["straight", "Straight"], ["gay", "Gay"], ["lesbian", "Lesbian"], ["bisexual", "Bisexual"], ["pansexual", "Pansexual"], ["asexual", "Asexual"], ["queer", "Queer"], ["other", "Other"], ["prefer_not_to_say", "Prefer not to say"]];
const INTERESTED_IN = [["men", "Men"], ["women", "Women"], ["everyone", "Everyone"]];
const CHRONO = [["morning_person", "Morning person"], ["night_person", "Night person"], ["both", "Both"]];

// ================= Location & distance =================
// Real app: phone GPS via geolocation permission. If either side has no saved
// location we show nothing rather than a made-up distance.
function haversineKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const distLabel = (from, p) => {
  const km = haversineKm(from, p && p.loc);
  if (km === null) return "Distance unavailable";
  const useMiles = api.user?.distanceUnit === "mi";
  if (useMiles) {
    const mi = km * 0.621371;
    return mi < 0.1 ? `${Math.max(Math.round(mi * 5280), 100)} ft` : `${mi.toFixed(1)} mi`;
  }
  return km < 1 ? `${Math.max(Math.round(km * 10) * 100, 100)} m` : `${km.toFixed(1)} km`;
};
// "3.2 mi away" reads wrong when there's no distance, so callers use this.
const distPhrase = (from, p) => {
  const km = haversineKm(from, p && p.loc);
  return km === null ? "Distance unavailable" : `${distLabel(from, p)} away`;
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
// No known distance sorts to the back of the deck, but is never hidden.
const rankScore = (from, p) => {
  const km = haversineKm(from, p.loc);
  const base = km === null ? 100000 : km;
  // Someone you passed on who then chose you rises to the top, so real
  // mutual interest is never lost to a careless swipe.
  const secondChanceBoost = p.secondChance ? 100000 : 0;
  // Someone free tonight is the most actionable person in the deck
  const freeTonightBoost = p.freeTonight ? 20 : 0;
  return base - sharedLikes(p).length * BOOST_KM - secondChanceBoost - freeTonightBoost;
};

// ================= Demo profiles for the deck =================
// Demo profiles removed. TOM only ever shows real people.
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
  Leaf: ({ s = 18, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M19.5 4.5C11 4.5 5.5 9 5.5 15.5c0 1.4.3 2.6.8 3.6C9 20.5 13 20 15.5 17.5c3.3-3.3 4-8.5 4-13z" fill={c} />
      <path d="M5.5 19.5C9 14 13 10.5 17.5 8" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  Bubble: ({ s = 18, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.5c-5 0-9 3.3-9 7.4 0 2.3 1.3 4.4 3.3 5.8-.1 1.2-.6 2.4-1.6 3.4 1.9-.2 3.5-.9 4.7-1.7.8.2 1.7.3 2.6.3 5 0 9-3.3 9-7.4S17 3.5 12 3.5z" fill={c} />
      <circle cx="8.5" cy="11" r="1.2" fill="#FFFFFF" /><circle cx="12" cy="11" r="1.2" fill="#FFFFFF" /><circle cx="15.5" cy="11" r="1.2" fill="#FFFFFF" />
    </svg>
  ),
  Palette: ({ s = 18, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 .8 17.96c1.3-.1 1.7-1.6.9-2.5-.9-1-.3-2.46 1-2.46h2.8c2 0 3.5-1.6 3.5-3.5C21 7 17 3 12 3z" fill={c} />
      <circle cx="8" cy="9" r="1.5" fill="#FFFFFF" /><circle cx="12.5" cy="7" r="1.5" fill="#FFFFFF" /><circle cx="7" cy="13.5" r="1.5" fill="#FFFFFF" />
    </svg>
  ),
  Rain: ({ s = 18, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 14.5a4.5 4.5 0 0 1-.7-8.95A6 6 0 0 1 18 7.6a4 4 0 0 1-.6 7.9H7z" fill={c} />
      <path d="M8.5 17.5l-1 3M12.5 17.5l-1 3M16.5 17.5l-1 3" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Column: ({ s = 18, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.5L3.5 7h17z" fill={c} />
      <path d="M5 9h2.6v9H5zM10.7 9h2.6v9h-2.6zM16.4 9H19v9h-2.6z" fill={c} />
      <rect x="3.5" y="19.5" width="17" height="2.2" rx="1" fill={c} />
    </svg>
  ),
  Check: ({ s = 16, c = "#2FBF71" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 12.5l5 5L19.5 7" stroke={c} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Users: ({ s = 20, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.4" fill={c} />
      <circle cx="16.8" cy="9" r="2.6" fill={c} opacity="0.6" />
      <path d="M2.8 19.5c.7-3.2 3.3-4.9 6.2-4.9s5.5 1.7 6.2 4.9" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16.5 14.8c2.2.2 3.9 1.6 4.4 4" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
  ),
  Undo: ({ s = 20, c = "#5B21B6" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9h9.5a5.5 5.5 0 0 1 0 11H8" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 4.5L3.5 9l4 4.5" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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
function ToggleRow({ on, onToggle, label, icon }) {
  const RIcon = icon && Ic[icon] ? Ic[icon] : null;
  return (
    <button onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: on ? T.lilac : T.white, border: `2px solid ${on ? T.royal : T.lilacDeep}`, borderRadius: 16, padding: "12px 14px", cursor: "pointer", textAlign: "left" }}>
      {RIcon && <RIcon s={20} c={T.royal} />}
      <span style={{ flex: 1, ...nu(800, 14, T.ink) }}>{label}</span>
      <span style={{ width: 42, height: 24, borderRadius: 999, background: on ? T.royal : T.lilacDeep, position: "relative", transition: "background .2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: T.white, transition: "left .2s" }} />
      </span>
    </button>
  );
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
        <div style={{ width: size, height: size, borderRadius: round ? "50%" : 14, background: `linear-gradient(135deg, ${T.royal}, ${T.violet})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35 }} title="HEIC photo saved (preview depends on browser)"><Ic.Camera s={size * 0.4} c={T.white} /></div>
      ) : (
        <img src={src} onError={() => setBroken(true)} alt="" style={{ width: size, height: size, borderRadius: round ? "50%" : 14, objectFit: "cover", boxShadow: "0 3px 10px rgba(42,27,74,.15)" }} />
      )}
      {onRemove && (
        <button onClick={onRemove} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", border: "none", background: T.ink, color: T.white, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Cross s={10} c={T.white} /></button>
      )}
    </div>
  );
}

// ================= Batch 2: TOM+ features =================
function PlusGate({ title, blurb, onClose, onUpgrade }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24 }} onClick={onClose}>
      <div style={{ width: "100%", background: T.white, borderRadius: 24, padding: 22, textAlign: "center", animation: "popIn .25s ease" }} onClick={(e) => e.stopPropagation()}>
        <Ic.Sun s={34} c={T.sun} />
        <h2 style={{ ...fr(700, 20, T.royal), margin: "8px 0 6px" }}>{title}</h2>
        <p style={{ ...nu(700, 13.5, T.soft), margin: "0 0 16px" }}>{blurb}</p>
        <PrimaryBtn onClick={onUpgrade}>Get TOM<span style={{ color: T.sun }}>+</span></PrimaryBtn>
        <button onClick={onClose} style={{ width: "100%", marginTop: 8, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Not now</button>
      </div>
    </div>
  );
}

function AdmirersPanel({ admirers, myLoc, onLikeBack, onBack, onReport }) {
  const { t } = useLang();
  const [viewing, setViewing] = useState(null);
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "6px 16px 16px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "none", cursor: "pointer", padding: "4px 0 10px", ...nu(800, 13, T.royal) }}>
        <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><Ic.Chevron s={14} c={T.royal} /></span> {t("backToDiscover")}
      </button>
      <h2 style={{ ...fr(700, 21, T.ink), margin: "0 0 3px" }}>{t("worthTheirTime")}</h2>
      <p style={{ ...nu(700, 13, T.soft), margin: "0 0 14px" }}>{t("admirersSub")}</p>
      {admirers.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: 60 }}>
          <Ic.Eye s={44} c={T.royal} />
          <h3 style={{ ...fr(600, 19, T.ink), margin: "10px 0 4px" }}>{t("noAdmirers")}</h3>
          <p style={{ ...nu(600, 13.5, T.soft), margin: 0 }}>{t("noAdmirersSub")}</p>
        </div>
      ) : admirers.map((p) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, background: T.white, borderRadius: 18, padding: 12, marginBottom: 10, boxShadow: "0 4px 14px rgba(42,27,74,.08)", animation: "floatUp .3s ease" }}>
          <button onClick={() => setViewing(p)} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, border: "none", background: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
            <div style={{ width: 54, height: 54, borderRadius: "50%", background: p.photo ? `url(${p.photo}) center/cover no-repeat` : `linear-gradient(135deg, ${p.grad[0]}, ${p.grad[1]})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...fr(700, 22, T.white) }}>{p.photo ? "" : p.name[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...fr(600, 17, T.ink), display: "flex", alignItems: "center", gap: 6 }}>{p.name}, {p.age}{p.verified && <Ic.ShieldCheck s={16} c={T.green} />}</div>
              <div style={{ ...nu(700, 12, T.soft), display: "inline-flex", alignItems: "center", gap: 3 }}><Ic.Pin s={11} c={T.soft} />{distPhrase(myLoc, p)}</div>
            </div>
          </button>
          <button onClick={() => onReport(p)} aria-label="Report" style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><Ic.Flag s={15} c={T.lilacDeep} /></button>
          <button onClick={() => onLikeBack(p)} style={{ border: "none", borderRadius: 999, padding: "9px 14px", background: T.royal, cursor: "pointer", ...fr(600, 13, T.white) }}>Spend time</button>
        </div>
      ))}
      {viewing && (
        <ProfileDetailModal
          profile={viewing}
          myLoc={myLoc}
          onClose={() => setViewing(null)}
          onLikeBack={(p) => { setViewing(null); onLikeBack(p); }}
        />
      )}
    </div>
  );
}

function FiltersModal({ onClose, onApply }) {
  const { t } = useLang();
  const L = useLabel();
  const u = api.user || {};
  const [minAge, setMinAge] = useState(u.filterMinAge ?? 18);
  const [maxAge, setMaxAge] = useState(u.filterMaxAge ?? 99);
  const [radius, setRadius] = useState(u.searchRadiusKm ?? 50);
  const [picked, setPicked] = useState(u.filterInterests || []);
  const toggle = (i) => setPicked((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  const lo = Math.min(Number(minAge) || 18, Number(maxAge) || 99);
  const hi = Math.max(Number(minAge) || 18, Number(maxAge) || 99);
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "flex-end", zIndex: 60 }} onClick={onClose}>
      <div style={{ width: "100%", background: T.white, borderRadius: "26px 26px 0 0", padding: "20px 20px 24px", maxHeight: "82%", overflowY: "auto", animation: "floatUp .25s ease" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ ...fr(700, 20, T.royal), margin: 0, display: "flex", alignItems: "center", gap: 8 }}><Ic.Sliders s={20} c={T.royal} />Fine-tune your time</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><Ic.Cross s={18} /></button>
        </div>
        <Field label="Age range">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="number" min="18" max="99" value={minAge} onChange={(e) => setMinAge(e.target.value)} style={{ ...inputStyle, textAlign: "center" }} />
            <span style={nu(800, 14, T.soft)}>to</span>
            <input type="number" min="18" max="99" value={maxAge} onChange={(e) => setMaxAge(e.target.value)} style={{ ...inputStyle, textAlign: "center" }} />
          </div>
        </Field>
        <Field label={`Max distance: ${radius} km`}>
          <input type="range" min="1" max="300" value={radius} onChange={(e) => setRadius(Number(e.target.value))} style={{ width: "100%", accentColor: T.royal }} />
        </Field>
        <Field label="Only show people into">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {INTEREST_POOL.map((i) => <Chip key={i} label={L(i)} active={picked.includes(i)} onClick={() => toggle(i)} />)}
          </div>
        </Field>
        <PrimaryBtn onClick={() => onApply({ minAge: lo, maxAge: hi, radius, interests: picked })}>Apply filters</PrimaryBtn>
        <button onClick={() => onApply({ minAge: 18, maxAge: 99, radius: 50, interests: [] })} style={{ width: "100%", marginTop: 8, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Reset all</button>
      </div>
    </div>
  );
}

function OffTheClockModal({ onClose, onToggle }) {
  const active = Boolean(api.user && api.user.offTheClock);
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24 }} onClick={onClose}>
      <div style={{ width: "100%", background: T.white, borderRadius: 24, padding: 22, textAlign: "center", animation: "popIn .25s ease" }} onClick={(e) => e.stopPropagation()}>
        <Ic.Moon s={34} c={T.royal} />
        <h2 style={{ ...fr(700, 20, T.royal), margin: "8px 0 6px" }}>Off the Clock</h2>
        <p style={{ ...nu(700, 13.5, T.soft), margin: "0 0 16px" }}>
          {active
            ? "You're invisible right now. Nobody new can see your card. Your matches can still message you."
            : "Take a break without deleting anything. Your card disappears from every deck until you come back."}
        </p>
        <PrimaryBtn onClick={onToggle}>{active ? "Punch back in" : "Go off the clock"}</PrimaryBtn>
        <button onClick={onClose} style={{ width: "100%", marginTop: 8, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Cancel</button>
      </div>
    </div>
  );
}

// City list for Time Zones. lat/lng power the distance labels while browsing.
const TIME_ZONE_CITIES = [
  { id: "istanbul", name: "Istanbul", loc: { lat: 41.0082, lng: 28.9784 } },
  { id: "athens", name: "Athens", loc: { lat: 37.9838, lng: 23.7275 } },
  { id: "valletta", name: "Valletta", loc: { lat: 35.8989, lng: 14.5146 } },
  { id: "tbilisi", name: "Tbilisi", loc: { lat: 41.7151, lng: 44.8271 } },
  { id: "izmir", name: "Izmir", loc: { lat: 38.4161, lng: 27.1302 } },
  { id: "ankara", name: "Ankara", loc: { lat: 39.9334, lng: 32.8597 } },
  { id: "barcelona", name: "Barcelona", loc: { lat: 41.3851, lng: 2.1734 } },
  { id: "london", name: "London", loc: { lat: 51.5074, lng: -0.1278 } },
  { id: "paris", name: "Paris", loc: { lat: 48.8566, lng: 2.3522 } },
  { id: "berlin", name: "Berlin", loc: { lat: 52.52, lng: 13.405 } },
  { id: "newyork", name: "New York", loc: { lat: 40.7128, lng: -74.006 } },
  { id: "losangeles", name: "Los Angeles", loc: { lat: 34.0522, lng: -118.2437 } },
];

function TimeZonesModal({ current, onPick, onClose }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "flex-end", zIndex: 60 }} onClick={onClose}>
      <div style={{ width: "100%", background: T.white, borderRadius: "26px 26px 0 0", padding: "20px 20px 24px", maxHeight: "82%", overflowY: "auto", animation: "floatUp .25s ease" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ ...fr(700, 20, T.royal), margin: 0, display: "flex", alignItems: "center", gap: 8 }}><Ic.Globe s={20} c={T.royal} />Time Zones</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><Ic.Cross s={18} /></button>
        </div>
        <p style={{ ...nu(700, 13, T.soft), margin: "0 0 14px" }}>Spend time in another city before you even get there.</p>
        <button onClick={() => { onPick(null); }} style={{ width: "100%", background: !current ? T.lilac : T.white, border: `2px solid ${!current ? T.royal : T.lilacDeep}`, borderRadius: 16, padding: "13px 15px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ ...nu(800, 14.5, T.ink) }}>My current area</span>
          <Ic.Pin s={14} c={T.royal} />
        </button>
        {TIME_ZONE_CITIES.map((c) => (
          <button key={c.id} onClick={() => { onPick(c); }} style={{ width: "100%", background: current && current.id === c.id ? T.lilac : T.white, border: `2px solid ${current && current.id === c.id ? T.royal : T.lilacDeep}`, borderRadius: 16, padding: "13px 15px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ ...nu(800, 14.5, T.ink) }}>{c.name}</span>
            <Ic.Chevron s={14} c={T.soft} />
          </button>
        ))}
      </div>
    </div>
  );
}

function PrimeTimeModal({ onClose, onActivate, boostUntil }) {
  const active = boostUntil && new Date(boostUntil) > new Date();
  const daysLeft = active ? Math.max(1, Math.ceil((new Date(boostUntil) - new Date()) / 86400000)) : 0;
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24 }} onClick={onClose}>
      <div style={{ width: "100%", background: T.white, borderRadius: 24, padding: 22, textAlign: "center", animation: "popIn .25s ease" }} onClick={(e) => e.stopPropagation()}>
        <Ic.Rise s={34} c={T.royal} />
        <h2 style={{ ...fr(700, 20, T.royal), margin: "8px 0 6px" }}>Weekly Prime Time</h2>
        {active ? (
          <>
            <p style={{ ...nu(700, 13.5, T.soft), margin: "0 0 16px" }}>You're in Prime Time. Your card rises to the top of nearby decks for {daysLeft} more {daysLeft === 1 ? "day" : "days"}.</p>
            <PrimaryBtn onClick={onClose}>Nice</PrimaryBtn>
          </>
        ) : (
          <>
            <p style={{ ...nu(700, 13.5, T.soft), margin: "0 0 16px" }}>Rise to the top of nearby decks for 7 days. More eyes on your card, more time offers.</p>
            <PrimaryBtn onClick={onActivate}>Start my Prime Time</PrimaryBtn>
            <button onClick={onClose} style={{ width: "100%", marginTop: 8, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Not now</button>
          </>
        )}
      </div>
    </div>
  );
}

// ================= Batch 3: Mission Dates, plans, reviews =================
const MISSIONS = [
  { id: "adventure", label: "Adventure", icon: "Compass", ideas: [
    "Sunrise mission: reach the best viewpoint in town before the sun does",
    "Explore a neighborhood neither of you has ever walked",
    "Urban treasure hunt: find five hidden details most people miss",
    "Walk on ferry ride at golden hour, best story wins",
    "Follow a street cat and see where it takes us",
    "Find the highest free viewpoint in the city together",
    "Get deliberately lost, then find your way home with no maps",
    "Ride a bus to the last stop and explore whatever is there",
    "Find the oldest street in town and walk its full length",
    "Coin flip walk: heads you go left, tails you go right, twenty flips",
    "Explore the biggest park end to end without repeating a path",
    "Find five staircases and climb every one",
    "Pick a direction and walk it for one hour, then turn around",
  ]},
  { id: "conversation", label: "Conversation", icon: "Bubble", ideas: [
    "36 questions on a park bench, no phones",
    "Swap playlists and each explain three songs that made you",
    "People watch and invent their life stories",
    "Teach each other something new in twenty minutes",
    "Walk and talk: describe the street you grew up on",
    "Debate your silliest hills to die on",
    "Interview each other like a talk show host",
    "Trade the three best pieces of advice you ever got",
    "Describe your perfect ordinary Tuesday, then compare",
    "Two truths and a lie until someone finally gets caught",
    "Plan an imaginary road trip you will never actually take",
    "Tell each other the story behind a scar",
    "Say what you would do with a completely free year",
  ]},
  { id: "nature", label: "Nature", icon: "Leaf", ideas: [
    "Botanical garden on its free day",
    "Sunset picnic, you each bring something from home",
    "Stone skipping contest at the water",
    "Find the oldest tree in the park",
    "Birdwatching with a shared thermos",
    "Barefoot walk on the grass, loser plans the next date",
    "Collect five leaves each and rank them seriously",
    "Cloud watching, name every shape out loud",
    "Walk the whole waterfront, wherever it starts and ends",
    "Find water: river, fountain, lake, whichever is closest",
    "Wildflower hunt, photograph them and leave them growing",
    "Hunt for the best shade tree and read there",
    "Follow a trail neither of you has taken all the way to its end",
  ]},
  { id: "culture", label: "Culture", icon: "Column", ideas: [
    "Free museum night, invent backstories for the art",
    "Street art hunt: photograph ten murals",
    "Self guided walking tour of the old town",
    "Library date: pick a book for each other",
    "Free concert or open rehearsal in the park",
    "Visit the oldest building either of you can find",
    "Read the plaque on every monument you pass",
    "Find the strangest statue in the city and pose with it",
    "Sit in on a free lecture or open class",
    "Bookshop browse, choose each other's next read",
    "Cemetery walk for the history and the quiet",
    "Find a place your grandparents would still recognize",
    "Watch the buskers and pick who deserves to be famous",
  ]},
  { id: "exercise", label: "Exercise", icon: "Rise", ideas: [
    "Sunrise run or brisk walk along the water",
    "Outdoor gym challenge: see who gives up first",
    "Race up the big steps, winner picks the next mission",
    "Park yoga, bring two mats",
    "Bike ride to somewhere neither of you has been",
    "Swim at the public beach",
    "Plank contest in the park, no mercy",
    "Walk ten thousand steps together and actually count them",
    "Teach each other your best stretch",
    "Hill sprints until one of you calls it",
    "Handstand attempts against a wall, film the failures",
    "Long walk with one rule: no stopping for an hour",
    "Shadow boxing lesson from whichever of you knows more",
  ]},
  { id: "creativity", label: "Creativity", icon: "Palette", ideas: [
    "Sketch each other in ten minutes, reveal at the same time",
    "Phone photo challenge: one theme, ten shots each",
    "Write a six word story about this exact date",
    "Build something tiny out of found objects",
    "Learn a dance from a free video and film the result",
    "Cook off using only what is already in the kitchen",
    "Write each other a terrible poem on purpose",
    "Invent a board game using whatever is on the table",
    "Photograph the same thing ten completely different ways",
    "Make up a song about your day, talent not required",
    "Design your dream house on scrap paper",
    "Write the opening line of a novel, trade, keep going",
    "Rename every shop you pass with a better name",
  ]},
  { id: "rainy", label: "Rainy Day", icon: "Rain", ideas: [
    "Board games marathon, loser makes the tea",
    "Covered market wander, strictly buy nothing",
    "Library afternoon, read each other one page",
    "Movie marathon with popcorn from your own kitchen",
    "Puzzle race against the rain",
    "Rain on window photography from a dry doorway",
    "Card games, invent house rules as you go",
    "Build a blanket fort with real structural engineering",
    "Cook something neither of you has ever made",
    "Trade favourite childhood shows and watch one each",
    "Deep clean a room together with the music loud",
    "Learn a card trick from a video and perform it badly",
    "Bake with whatever is already in the cupboard",
  ]},
  { id: "nighttime", label: "Nighttime", icon: "Moon", ideas: [
    "Stargazing from the darkest spot you can reach",
    "Full moon walk through the old streets",
    "City lights viewpoint with hot drinks from home",
    "Night market stroll, spend nothing",
    "Ghost story walk, scariest local legend wins",
    "Midnight breakfast at home",
    "Find every lit fountain in the city",
    "Late walk with one earbud each, shared playlist",
    "Watch planes land from wherever you can see them",
    "Sit somewhere high and invent your own constellations",
    "Empty street photography after midnight",
    "Stay up for the sunrise, then sleep the day away",
    "Rooftop or hilltop, whichever one you can reach for free",
  ]},
];

// Date idea translations. English stays the stored value.
const IDEA_LABELS = {
  "Sunrise mission: reach the best viewpoint in town before the sun does": { tr: "Gün doğumu görevi: güneşten önce şehrin en iyi manzarasına var", es: "Misión amanecer: llega al mejor mirador antes que el sol" },
  "Explore a neighborhood neither of you has ever walked": { tr: "İkinizin de hiç yürümediği bir mahalleyi keşfedin", es: "Exploren un barrio que ninguno haya caminado" },
  "Urban treasure hunt: find five hidden details most people miss": { tr: "Şehir hazine avı: çoğu kişinin görmediği beş detay bulun", es: "Búsqueda urbana del tesoro: encuentren cinco detalles que casi nadie ve" },
  "Walk on ferry ride at golden hour, best story wins": { tr: "Gün batımında vapur yolculuğu, en iyi hikaye kazanır", es: "Paseo en ferry al atardecer, gana la mejor historia" },
  "Follow a street cat and see where it takes us": { tr: "Bir sokak kedisini takip edin, sizi nereye götürüyor görün", es: "Sigan a un gato callejero y vean a dónde los lleva" },
  "Find the highest free viewpoint in the city together": { tr: "Şehrin en yüksek ücretsiz manzarasını birlikte bulun", es: "Encuentren juntos el mirador gratuito más alto" },
  "Get deliberately lost, then find your way home with no maps": { tr: "Bilerek kaybolun, sonra haritasız eve dönün", es: "Piérdanse a propósito y vuelvan sin mapas" },
  "Ride a bus to the last stop and explore whatever is there": { tr: "Otobüse binip son durağa gidin ve orası neyse keşfedin", es: "Tomen un autobús hasta la última parada y exploren lo que haya" },
  "Find the oldest street in town and walk its full length": { tr: "Şehrin en eski sokağını bulun ve baştan sona yürüyün", es: "Encuentren la calle más antigua y recórranla entera" },
  "Coin flip walk: heads you go left, tails you go right, twenty flips": { tr: "Yazı tura yürüyüşü: yazı sola, tura sağa, yirmi atış", es: "Paseo a cara o cruz: cara izquierda, cruz derecha, veinte tiradas" },
  "Explore the biggest park end to end without repeating a path": { tr: "En büyük parkı aynı yoldan geçmeden baştan sona keşfedin", es: "Recorran el parque más grande de punta a punta sin repetir camino" },
  "Find five staircases and climb every one": { tr: "Beş merdiven bulun ve hepsini tırmanın", es: "Encuentren cinco escaleras y suban todas" },
  "Pick a direction and walk it for one hour, then turn around": { tr: "Bir yön seçin, bir saat yürüyün, sonra geri dönün", es: "Elijan una dirección, caminen una hora y vuelvan" },
  "36 questions on a park bench, no phones": { tr: "Park bankında 36 soru, telefon yok", es: "36 preguntas en un banco del parque, sin teléfonos" },
  "Swap playlists and each explain three songs that made you": { tr: "Çalma listelerinizi değiştirin ve sizi siz yapan üç şarkıyı anlatın", es: "Intercambien playlists y expliquen tres canciones que los formaron" },
  "People watch and invent their life stories": { tr: "İnsanları izleyin ve hayat hikayelerini uydurun", es: "Observen a la gente e inventen sus historias de vida" },
  "Teach each other something new in twenty minutes": { tr: "Yirmi dakikada birbirinize yeni bir şey öğretin", es: "Enséñense algo nuevo en veinte minutos" },
  "Walk and talk: describe the street you grew up on": { tr: "Yürüyün ve konuşun: büyüdüğünüz sokağı anlatın", es: "Caminen y hablen: describe la calle donde creciste" },
  "Debate your silliest hills to die on": { tr: "En saçma inatlarınızı tartışın", es: "Debatan sus manias más absurdas" },
  "Interview each other like a talk show host": { tr: "Birbirinizle talk show sunucusu gibi röportaj yapın", es: "Entrevístense como en un programa de televisión" },
  "Trade the three best pieces of advice you ever got": { tr: "Aldığınız en iyi üç tavsiyeyi paylaşın", es: "Intercambien los tres mejores consejos que les han dado" },
  "Describe your perfect ordinary Tuesday, then compare": { tr: "Mükemmel sıradan bir Salı gününüzü anlatın, sonra karşılaştırın", es: "Describan su martes perfecto y compárenlos" },
  "Two truths and a lie until someone finally gets caught": { tr: "Biri yakalanana kadar iki doğru bir yalan", es: "Dos verdades y una mentira hasta que alguien caiga" },
  "Plan an imaginary road trip you will never actually take": { tr: "Asla çıkmayacağınız hayali bir yol gezisi planlayın", es: "Planeen un viaje imaginario que nunca harán" },
  "Tell each other the story behind a scar": { tr: "Birbirinize bir yaranın hikayesini anlatın", es: "Cuéntense la historia detrás de una cicatriz" },
  "Say what you would do with a completely free year": { tr: "Tamamen boş bir yılınız olsa ne yapardınız söyleyin", es: "Digan qué harían con un año completamente libre" },
  "Botanical garden on its free day": { tr: "Botanik bahçesinin ücretsiz günü", es: "Jardín botánico en su día gratuito" },
  "Sunset picnic, you each bring something from home": { tr: "Gün batımı pikniği, herkes evden bir şey getirsin", es: "Picnic al atardecer, cada uno trae algo de casa" },
  "Stone skipping contest at the water": { tr: "Suda taş sektirme yarışması", es: "Concurso de saltar piedras en el agua" },
  "Find the oldest tree in the park": { tr: "Parktaki en yaşlı ağacı bulun", es: "Encuentren el árbol más viejo del parque" },
  "Birdwatching with a shared thermos": { tr: "Paylaşılan bir termosla kuş gözlemi", es: "Observación de aves con un termo compartido" },
  "Barefoot walk on the grass, loser plans the next date": { tr: "Çimende çıplak ayak yürüyüş, kaybeden bir sonraki buluşmayı planlar", es: "Caminen descalzos por el césped, el que pierda planea la próxima cita" },
  "Collect five leaves each and rank them seriously": { tr: "Beşer yaprak toplayın ve ciddi ciddi sıralayın", es: "Recojan cinco hojas cada uno y clasifíquenlas en serio" },
  "Cloud watching, name every shape out loud": { tr: "Bulut izleyin, her şekle isim verin", es: "Miren las nubes y nombren cada forma en voz alta" },
  "Walk the whole waterfront, wherever it starts and ends": { tr: "Sahilin tamamını yürüyün, nerede başlayıp biterse", es: "Recorran todo el paseo marítimo, empiece donde empiece" },
  "Find water: river, fountain, lake, whichever is closest": { tr: "Su bulun: nehir, çeşme, göl, hangisi yakınsa", es: "Busquen agua: río, fuente, lago, lo que quede más cerca" },
  "Wildflower hunt, photograph them and leave them growing": { tr: "Yabani çiçek avı, fotoğraflayın ama koparmayın", es: "Busquen flores silvestres, fotografíenlas y déjenlas crecer" },
  "Hunt for the best shade tree and read there": { tr: "En iyi gölge ağacını bulun ve orada okuyun", es: "Busquen el mejor árbol con sombra y lean ahí" },
  "Follow a trail neither of you has taken all the way to its end": { tr: "İkinizin de gitmediği bir patikayı sonuna kadar takip edin", es: "Sigan hasta el final un sendero que ninguno haya tomado" },
  "Free museum night, invent backstories for the art": { tr: "Ücretsiz müze gecesi, eserlere hikaye uydurun", es: "Noche de museo gratis, inventen historias para el arte" },
  "Street art hunt: photograph ten murals": { tr: "Sokak sanatı avı: on duvar resmi fotoğraflayın", es: "Búsqueda de arte urbano: fotografíen diez murales" },
  "Self guided walking tour of the old town": { tr: "Eski şehirde kendi rehberli yürüyüşünüz", es: "Recorrido a pie por el casco antiguo por su cuenta" },
  "Library date: pick a book for each other": { tr: "Kütüphane buluşması: birbirinize kitap seçin", es: "Cita en la biblioteca: elijan un libro el uno para el otro" },
  "Free concert or open rehearsal in the park": { tr: "Parkta ücretsiz konser ya da açık prova", es: "Concierto gratis o ensayo abierto en el parque" },
  "Visit the oldest building either of you can find": { tr: "İkinizin bulabileceği en eski binayı ziyaret edin", es: "Visiten el edificio más antiguo que puedan encontrar" },
  "Read the plaque on every monument you pass": { tr: "Geçtiğiniz her anıtın tabelasını okuyun", es: "Lean la placa de cada monumento que pasen" },
  "Find the strangest statue in the city and pose with it": { tr: "Şehrin en tuhaf heykelini bulun ve yanında poz verin", es: "Encuentren la estatua más rara de la ciudad y posen con ella" },
  "Sit in on a free lecture or open class": { tr: "Ücretsiz bir derse ya da konferansa katılın", es: "Asistan a una charla o clase abierta gratuita" },
  "Bookshop browse, choose each other's next read": { tr: "Kitapçı gezin, birbirinizin bir sonraki kitabını seçin", es: "Recorran una librería y elijan la próxima lectura del otro" },
  "Cemetery walk for the history and the quiet": { tr: "Tarih ve sessizlik için mezarlık yürüyüşü", es: "Paseo por el cementerio por la historia y el silencio" },
  "Find a place your grandparents would still recognize": { tr: "Büyükanne ve büyükbabanızın hala tanıyacağı bir yer bulun", es: "Encuentren un lugar que sus abuelos aún reconocerían" },
  "Watch the buskers and pick who deserves to be famous": { tr: "Sokak müzisyenlerini izleyin ve kimin ünlü olmayı hak ettiğini seçin", es: "Miren a los músicos callejeros y elijan quién merece ser famoso" },
  "Sunrise run or brisk walk along the water": { tr: "Sahil boyunca gün doğumu koşusu ya da tempolu yürüyüş", es: "Carrera o caminata rápida al amanecer junto al agua" },
  "Outdoor gym challenge: see who gives up first": { tr: "Açık hava spor aleti meydan okuması: kim önce pes edecek", es: "Reto en el gimnasio al aire libre: a ver quién se rinde primero" },
  "Race up the big steps, winner picks the next mission": { tr: "Büyük merdivenleri yarışın, kazanan bir sonraki görevi seçer", es: "Suban corriendo las escaleras grandes, el ganador elige la próxima misión" },
  "Park yoga, bring two mats": { tr: "Parkta yoga, iki mat getirin", es: "Yoga en el parque, lleven dos esterillas" },
  "Bike ride to somewhere neither of you has been": { tr: "İkinizin de gitmediği bir yere bisikletle gidin", es: "Paseo en bici a un sitio donde ninguno haya estado" },
  "Swim at the public beach": { tr: "Halk plajında yüzme", es: "Nádense en la playa pública" },
  "Plank contest in the park, no mercy": { tr: "Parkta plank yarışı, acımak yok", es: "Concurso de plancha en el parque, sin piedad" },
  "Walk ten thousand steps together and actually count them": { tr: "Birlikte on bin adım yürüyün ve gerçekten sayin", es: "Caminen diez mil pasos juntos y cuéntenlos de verdad" },
  "Teach each other your best stretch": { tr: "Birbirinize en iyi esneme hareketinizi öğretin", es: "Enséñense su mejor estiramiento" },
  "Hill sprints until one of you calls it": { tr: "Biriniz pes edene kadar yokuş sprintleri", es: "Sprints cuesta arriba hasta que alguien lo deje" },
  "Handstand attempts against a wall, film the failures": { tr: "Duvara yaslanıp amuda kalkmayı deneyin, başarısızlıkları çekin", es: "Intenten hacer el pino contra la pared y graben los fallos" },
  "Long walk with one rule: no stopping for an hour": { tr: "Tek kurallı uzun yürüyüş: bir saat boyunca durmak yok", es: "Caminata larga con una sola regla: no parar en una hora" },
  "Shadow boxing lesson from whichever of you knows more": { tr: "Hanginiz daha iyi biliyorsa gölge boks dersi versin", es: "Clase de boxeo de sombra del que sepa más" },
  "Sketch each other in ten minutes, reveal at the same time": { tr: "On dakikada birbirinizi çizin, aynı anda gösterin", es: "Dibújense en diez minutos y muéstrenlo a la vez" },
  "Phone photo challenge: one theme, ten shots each": { tr: "Telefon fotoğraf meydan okuması: tek tema, beşer kare", es: "Reto fotográfico: un tema, diez fotos cada uno" },
  "Write a six word story about this exact date": { tr: "Tam bu buluşma hakkında altı kelimelik bir hikaye yazın", es: "Escriban una historia de seis palabras sobre esta cita" },
  "Build something tiny out of found objects": { tr: "Bulduğunuz nesnelerden minik bir şey yapın", es: "Construyan algo diminuto con objetos encontrados" },
  "Learn a dance from a free video and film the result": { tr: "Ücretsiz bir videodan dans öğrenin ve sonucu çekin", es: "Aprendan un baile de un video gratis y graben el resultado" },
  "Cook off using only what is already in the kitchen": { tr: "Sadece mutfakta olanlarla yemek yarışı", es: "Duelo de cocina usando solo lo que ya hay" },
  "Write each other a terrible poem on purpose": { tr: "Birbirinize bilerek kötü bir şiir yazın", es: "Escríbanse un poema malo a propósito" },
  "Invent a board game using whatever is on the table": { tr: "Masadakilerle bir kutu oyunu icat edin", es: "Inventen un juego de mesa con lo que haya en la mesa" },
  "Photograph the same thing ten completely different ways": { tr: "Aynı şeyi on farklı şekilde fotoğraflayın", es: "Fotografíen lo mismo de diez formas distintas" },
  "Make up a song about your day, talent not required": { tr: "Gününüz hakkında bir şarkı uydurun, yetenek gerekmez", es: "Inventen una canción sobre su día, no hace falta talento" },
  "Design your dream house on scrap paper": { tr: "Hayalinizdeki evi müsvedde kağıda çizin", es: "Diseñen la casa de sus sueños en papel de borrador" },
  "Write the opening line of a novel, trade, keep going": { tr: "Bir romanın ilk cümlesini yazın, değiştirin, devam edin", es: "Escriban la primera línea de una novela, intercámbienla y sigan" },
  "Rename every shop you pass with a better name": { tr: "Geçtiğiniz her dükkana daha iyi bir isim verin", es: "Renombren cada tienda que pasen con un nombre mejor" },
  "Board games marathon, loser makes the tea": { tr: "Kutu oyunu maratonu, kaybeden çay yapar", es: "Maratón de juegos de mesa, el que pierda hace el té" },
  "Covered market wander, strictly buy nothing": { tr: "Kapalı çarşı gezisi, kesinlikle hiçbir şey almadan", es: "Paseo por el mercado cubierto sin comprar absolutamente nada" },
  "Library afternoon, read each other one page": { tr: "Kütüphane öğleden sonrası, birbirinize bir sayfa okuyun", es: "Tarde de biblioteca, léanse una página el uno al otro" },
  "Movie marathon with popcorn from your own kitchen": { tr: "Kendi mutfağınızdan patlamış mısırla film maratonu", es: "Maratón de películas con palomitas de su propia cocina" },
  "Puzzle race against the rain": { tr: "Yağmura karşı yapboz yarışı", es: "Carrera de rompecabezas contra la lluvia" },
  "Rain on window photography from a dry doorway": { tr: "Kuru bir kapı eşiğinden cama yağmur fotoğrafları", es: "Fotos de lluvia en la ventana desde un portal seco" },
  "Card games, invent house rules as you go": { tr: "İskambil oyunları, kuralları yolda uydurun", es: "Juegos de cartas, inventen las reglas sobre la marcha" },
  "Build a blanket fort with real structural engineering": { tr: "Gerçek mühendislikle battaniye kalesi kurun", es: "Construyan un fuerte de mantas con ingeniería de verdad" },
  "Cook something neither of you has ever made": { tr: "İkinizin de hiç yapmadığı bir yemeği pişirin", es: "Cocinen algo que ninguno haya hecho nunca" },
  "Trade favourite childhood shows and watch one each": { tr: "Çocukluk dizilerinizi değiştirin ve birer tane izleyin", es: "Intercambien series de la infancia y vean una de cada uno" },
  "Deep clean a room together with the music loud": { tr: "Müziği açıp birlikte bir odayı derinlemesine temizleyin", es: "Limpien a fondo una habitación juntos con la música alta" },
  "Learn a card trick from a video and perform it badly": { tr: "Videodan bir kart oyunu öğrenin ve kötü bir şekilde sergileyin", es: "Aprendan un truco de cartas de un video y háganlo mal" },
  "Bake with whatever is already in the cupboard": { tr: "Dolapta ne varsa onunla fırınlayın", es: "Horneen con lo que ya haya en la despensa" },
  "Stargazing from the darkest spot you can reach": { tr: "Ulaşabileceğiniz en karanlık noktadan yıldız izleme", es: "Observen estrellas desde el punto más oscuro al que lleguen" },
  "Full moon walk through the old streets": { tr: "Dolunayda eski sokaklarda yürüyüş", es: "Paseo de luna llena por las calles antiguas" },
  "City lights viewpoint with hot drinks from home": { tr: "Evden getirilen sıcak içeceklerle şehir ışıkları manzarası", es: "Mirador de luces de la ciudad con bebidas calientes de casa" },
  "Night market stroll, spend nothing": { tr: "Gece pazarı gezisi, hiçbir şey harcamadan", es: "Paseo por el mercado nocturno sin gastar nada" },
  "Ghost story walk, scariest local legend wins": { tr: "Hayalet hikayesi yürüyüşü, en korkunç yerel efsane kazanır", es: "Paseo de historias de fantasmas, gana la leyenda local más aterradora" },
  "Midnight breakfast at home": { tr: "Evde gece yarısı kahvaltısı", es: "Desayuno de medianoche en casa" },
  "Find every lit fountain in the city": { tr: "Şehirdeki ışıklı tüm çeşmeleri bulun", es: "Encuentren todas las fuentes iluminadas de la ciudad" },
  "Late walk with one earbud each, shared playlist": { tr: "Birer kulaklıkla geç saatte yürüyüş, ortak çalma listesi", es: "Paseo nocturno con un auricular cada uno y playlist compartida" },
  "Watch planes land from wherever you can see them": { tr: "Görebileceğiniz bir yerden uçakların inişini izleyin", es: "Miren aterrizar los aviones desde donde puedan verlos" },
  "Sit somewhere high and invent your own constellations": { tr: "Yüksek bir yere oturun ve kendi takımyıldızlarınızı icat edin", es: "Siéntense en alto e inventen sus propias constelaciones" },
  "Empty street photography after midnight": { tr: "Gece yarısından sonra boş sokak fotoğrafçılığı", es: "Fotografía de calles vacías después de medianoche" },
  "Stay up for the sunrise, then sleep the day away": { tr: "Gün doğumu için uyanık kalın, sonra gün boyu uyuyun", es: "Quédense despiertos para el amanecer y luego duerman todo el día" },
  "Rooftop or hilltop, whichever one you can reach for free": { tr: "Çatı ya da tepe, ücretsiz ulaşabildiğiniz hangisiyse", es: "Azotea o colina, la que puedan alcanzar gratis" },
};

// Flat list for the date proposal picker
function useIdeaText() {
  const { lang } = useLang();
  return (idea) => (lang === "en" ? idea : (IDEA_LABELS[idea] && IDEA_LABELS[idea][lang]) || idea);
}

const ALL_IDEAS = MISSIONS.flatMap((m) => m.ideas.map((idea) => ({ idea, cat: m.id, label: m.label, icon: m.icon })));

const REVIEW_TRAITS = ["On time", "Great listener", "Made me laugh", "Felt safe", "Genuine", "Good energy", "Planned it well", "Respectful", "Easy to talk to", "Adventurous"];
const REVIEW_FLAGS = ["They paid or insisted on paying", "Didn't show up", "Made me uncomfortable"];

function Missions({ matches, onSend }) {
  const { t } = useLang();
  const ideaText = useIdeaText();
  const [cat, setCat] = useState(MISSIONS[0].id);
  const active = MISSIONS.find((m) => m.id === cat);
  const CatIcon = Ic[active.icon];
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "6px 16px 16px" }}>
      <h2 style={{ ...fr(700, 21, T.ink), margin: "0 0 3px" }}>{t("missionDates")}</h2>
      <p style={{ ...nu(700, 13, T.soft), margin: "0 0 12px" }}>{t("missionSub")}</p>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, marginBottom: 6 }}>
        {MISSIONS.map((m) => {
          const MIcon = Ic[m.icon];
          const on = m.id === cat;
          return (
            <button key={m.id} onClick={() => setCat(m.id)} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", padding: "8px 13px", borderRadius: 999, border: `2px solid ${on ? T.royal : T.lilacDeep}`, background: on ? T.royal : T.white, cursor: "pointer", ...nu(700, 13, on ? T.white : T.royal) }}>
              <MIcon s={15} c={on ? T.white : T.royal} />{m.label}
            </button>
          );
        })}
      </div>
      {active.ideas.map((idea) => (
        <div key={idea} style={{ background: T.white, borderRadius: 16, padding: "13px 15px", marginBottom: 9, boxShadow: "0 3px 10px rgba(42,27,74,.06)", display: "flex", alignItems: "center", gap: 10 }}>
          <CatIcon s={18} c={T.royal} />
          <span style={{ flex: 1, ...nu(700, 13.5, T.ink) }}>{ideaText(idea)}</span>
          <button onClick={() => onSend(idea)} style={{ border: "none", borderRadius: 999, padding: "8px 12px", background: matches.length ? T.royal : T.lilacDeep, cursor: matches.length ? "pointer" : "default", ...fr(600, 12, T.white) }} disabled={!matches.length}>{t("send")}</button>
        </div>
      ))}
      {!matches.length && <p style={{ ...nu(600, 12.5, T.soft), textAlign: "center", marginTop: 8 }}>{t("matchFirst")}</p>}
    </div>
  );
}

function SendMissionModal({ idea, matches, onPick, onClose }) {
  const { t } = useLang();
  const ideaText = useIdeaText();
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "flex-end", zIndex: 60 }} onClick={onClose}>
      <div style={{ width: "100%", background: T.white, borderRadius: "26px 26px 0 0", padding: "20px 20px 24px", maxHeight: "70%", overflowY: "auto", animation: "floatUp .25s ease" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ ...fr(700, 18, T.royal), margin: "0 0 4px" }}>{t("sendMissionTo")}</h2>
        <p style={{ ...nu(700, 12.5, T.soft), margin: "0 0 14px" }}>{ideaText(idea)}</p>
        {matches.map((p) => (
          <button key={p.id} onClick={() => onPick(p)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: T.white, border: `2px solid ${T.lilacDeep}`, borderRadius: 16, padding: 12, marginBottom: 8, cursor: "pointer" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: p.photo ? `url(${p.photo}) center/cover no-repeat` : `linear-gradient(135deg, ${p.grad[0]}, ${p.grad[1]})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...fr(700, 18, T.white) }}>{p.photo ? "" : p.name[0]}</div>
            <span style={{ ...fr(600, 15, T.ink) }}>{p.name}</span>
          </button>
        ))}
        <button onClick={onClose} style={{ width: "100%", marginTop: 4, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Cancel</button>
      </div>
    </div>
  );
}

// Banner inside Chat showing the current plan and its next action
function whenLabel(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (same(d, today)) return `Today at ${time}`;
  if (same(d, tomorrow)) return `Tomorrow at ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} at ${time}`;
}

function PlanBanner({ plan, myId, profileName, onConfirm, onComplete }) {
  const { t } = useLang();
  if (!plan) return null;
  const mine = plan.proposed_by === myId;
  const when = whenLabel(plan.scheduled_at);
  const past = plan.scheduled_at && new Date(plan.scheduled_at) < new Date();
  return (
    <div style={{ margin: "10px 16px 0", background: plan.status === "confirmed" ? "#F0FBF5" : T.lilac, border: `2px solid ${plan.status === "confirmed" ? T.green : T.lilacDeep}`, borderRadius: 16, padding: "11px 13px" }}>
      <div style={{ ...nu(800, 10.5, T.soft), letterSpacing: ".5px", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
        <Ic.Hourglass s={13} c={T.royal} />{plan.status === "confirmed" ? "It's a plan" : "Date proposal"}
      </div>
      <div style={{ ...nu(700, 13.5, T.ink), margin: "3px 0 2px" }}>{plan.idea}</div>
      {plan.is_double && (
        <div style={{ ...nu(800, 11.5, T.royal), display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
          <Ic.Users s={12} c={T.royal} />{t("doubleDate")}
        </div>
      )}
      {when && <div style={{ ...nu(800, 12, T.royal), marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}><Ic.Hourglass s={11} c={T.royal} />{when}</div>}
      {!when && <div style={{ marginBottom: 8 }} />}
      {plan.status === "proposed" && mine && <div style={{ ...nu(700, 12, T.soft) }}>Waiting for {profileName} to confirm</div>}
      {plan.status === "proposed" && !mine && (
        <button onClick={onConfirm} style={{ border: "none", borderRadius: 999, padding: "8px 14px", background: T.royal, cursor: "pointer", ...fr(600, 12.5, T.white) }}>{t("confirmTheDate")}</button>
      )}
      {plan.status === "confirmed" && (!when || past) && (
        <button onClick={onComplete} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 999, padding: "8px 14px", background: T.green, cursor: "pointer", ...fr(600, 12.5, T.white) }}>
          <Ic.Check s={13} c={T.white} />We met up
        </button>
      )}
      {plan.status === "confirmed" && when && !past && (
        <div style={{ ...nu(700, 12, T.soft) }}>{t("willCheckIn")}</div>
      )}
    </div>
  );
}

// Asked of BOTH people a few hours after a scheduled date
function OutcomeModal({ pending, onAnswer, onLater }) {
  const [saving, setSaving] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const answer = async (a) => {
    if (saving) return;
    setSaving(true);
    const r = await api.answerOutcome(pending.date_id, a);
    setSaving(false);
    if (r.ok && r.result && r.result.status === "waiting") { setWaiting(true); return; }
    onAnswer(a, r.result);
  };
  if (waiting) {
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: T.white, borderRadius: 26, padding: "22px 20px", width: "100%", maxWidth: 330, textAlign: "center", animation: "popIn .3s ease" }}>
          <Ic.Hourglass s={34} c={T.royal} />
          <h2 style={{ ...fr(700, 20, T.royal), margin: "8px 0 6px" }}>Thanks</h2>
          <p style={{ ...nu(700, 13.5, T.soft), margin: "0 0 16px" }}>Once {pending.other_name} confirms too, you'll both get to rate the time you spent.</p>
          <PrimaryBtn onClick={() => onAnswer("met", { status: "waiting" })}>Got it</PrimaryBtn>
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: T.white, borderRadius: 26, padding: "22px 20px", width: "100%", maxWidth: 330, animation: "popIn .3s ease" }}>
        <h2 style={{ ...fr(700, 21, T.royal), margin: "0 0 2px", textAlign: "center" }}>How did it go?</h2>
        <p style={{ ...nu(700, 12.5, T.soft), margin: "0 0 4px", textAlign: "center" }}>Your plan with {pending.other_name}</p>
        <div style={{ background: T.lilac, borderRadius: 14, padding: "9px 12px", margin: "0 0 16px", ...nu(700, 13, T.royal), textAlign: "center" }}>
          {pending.idea}{pending.scheduled_at ? ` · ${whenLabel(pending.scheduled_at)}` : ""}
        </div>
        <button onClick={() => answer("met")} disabled={saving} style={{ width: "100%", padding: "13px 0", marginBottom: 8, borderRadius: 14, border: `2px solid ${T.green}`, background: "#F0FBF5", cursor: "pointer", ...fr(600, 15, T.green) }}>We met up</button>
        <button onClick={() => answer("cancelled")} disabled={saving} style={{ width: "100%", padding: "12px 0", marginBottom: 8, borderRadius: 14, border: `2px solid ${T.lilacDeep}`, background: T.white, cursor: "pointer", ...fr(600, 14, T.ink) }}>We rescheduled or called it off</button>
        <button onClick={() => answer("no_show")} disabled={saving} style={{ width: "100%", padding: "12px 0", borderRadius: 14, border: `2px solid ${T.lilacDeep}`, background: T.white, cursor: "pointer", ...fr(600, 14, T.ink) }}>They didn't show up</button>
        <button onClick={onLater} style={{ width: "100%", marginTop: 10, padding: "8px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Ask me later</button>
      </div>
    </div>
  );
}

function ReviewModal({ pending, onDone, onSkip }) {
  const { t } = useLang();
  const L = useLabel();
  const [well, setWell] = useState(null); // true | false
  const [traits, setTraits] = useState([]);
  const [flag, setFlag] = useState(null);
  const [saving, setSaving] = useState(false);
  const toggle = (t) => setTraits((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : prev.length < 3 ? [...prev, t] : prev);
  const submit = async () => {
    if (well === null || saving) return;
    setSaving(true);
    await api.submitReview(pending.date_id, well, traits, flag);
    setSaving(false);
    onDone();
  };
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: T.white, borderRadius: 26, padding: "22px 20px", width: "100%", maxWidth: 330, animation: "popIn .3s ease", maxHeight: "88%", overflowY: "auto" }}>
        <h2 style={{ ...fr(700, 21, T.royal), margin: "0 0 2px", textAlign: "center" }}>Rate your TOM date</h2>
        <p style={{ ...nu(700, 12.5, T.soft), margin: "0 0 14px", textAlign: "center" }}>With {pending.other_name}. About the time, never the looks.</p>
        <div style={{ ...nu(800, 11, T.soft), letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 7 }}>Was it time well spent?</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setWell(true)} style={{ flex: 1, padding: "11px 0", borderRadius: 14, border: `2px solid ${well === true ? T.green : T.lilacDeep}`, background: well === true ? "#F0FBF5" : T.white, cursor: "pointer", ...fr(600, 14, well === true ? T.green : T.ink) }}>Yes</button>
          <button onClick={() => setWell(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 14, border: `2px solid ${well === false ? T.ink : T.lilacDeep}`, background: well === false ? T.lilac : T.white, cursor: "pointer", ...fr(600, 14, T.ink) }}>Not really</button>
        </div>
        <div style={{ ...nu(800, 11, T.soft), letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 7 }}>What were they like? (pick up to 3)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
          {REVIEW_TRAITS.map((x) => <Chip key={x} label={L(x)} active={traits.includes(x)} onClick={() => toggle(x)} />)}
        </div>
        <div style={{ ...nu(800, 11, T.soft), letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 7 }}>Anything to flag? (optional, private)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
          {REVIEW_FLAGS.map((f) => (
            <button key={f} onClick={() => setFlag(flag === f ? null : f)} style={{ textAlign: "left", padding: "9px 12px", borderRadius: 12, border: `2px solid ${flag === f ? T.royal : T.lilacDeep}`, background: flag === f ? T.lilac : T.white, cursor: "pointer", ...nu(700, 12.5, T.ink) }}>{L(f)}</button>
          ))}
        </div>
        <PrimaryBtn disabled={well === null || saving} onClick={submit}>{saving ? "Sending..." : "Submit review"}</PrimaryBtn>
        <button onClick={onSkip} style={{ width: "100%", marginTop: 8, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Skip for now</button>
      </div>
    </div>
  );
}

function EmailSettingsModal({ onClose }) {
  const u = api.user || {};
  const [match, setMatch] = useState(u.emailOnMatch !== false);
  const [message, setMessage] = useState(u.emailOnMessage !== false);
  const [date, setDate] = useState(u.emailOnDate !== false);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    api.user.emailOnMatch = match;
    api.user.emailOnMessage = message;
    api.user.emailOnDate = date;
    await api.saveProfile();
    setSaving(false);
    onClose();
  };
  const Row = ({ label, blurb, on, set }) => (
    <button onClick={() => set(!on)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: T.white, border: `2px solid ${on ? T.royal : T.lilacDeep}`, borderRadius: 16, padding: "12px 14px", marginBottom: 9, cursor: "pointer", textAlign: "left" }}>
      <span style={{ flex: 1 }}>
        <span style={{ ...fr(600, 15, T.ink), display: "block" }}>{label}</span>
        <span style={{ ...nu(700, 12, T.soft) }}>{blurb}</span>
      </span>
      <span style={{ width: 44, height: 26, borderRadius: 999, background: on ? T.royal : T.lilacDeep, position: "relative", flexShrink: 0, transition: "background .15s" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: T.white, transition: "left .15s" }} />
      </span>
    </button>
  );
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "flex-end", zIndex: 60 }} onClick={onClose}>
      <div style={{ width: "100%", background: T.white, borderRadius: "26px 26px 0 0", padding: "20px 20px 24px", maxHeight: "82%", overflowY: "auto", animation: "floatUp .25s ease" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ ...fr(700, 20, T.royal), margin: 0 }}>Email me when</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><Ic.Cross s={18} /></button>
        </div>
        <p style={{ ...nu(700, 12.5, T.soft), margin: "0 0 16px" }}>TOM has no push notifications yet, so email is how you hear about things.</p>
        <Row label="Someone matches with me" blurb="Both of you said yes" on={match} set={setMatch} />
        <Row label="I get a message" blurb="At most once an hour per conversation" on={message} set={setMessage} />
        <Row label="Date plans and check ins" blurb="Proposals, and how did it go" on={date} set={setDate} />
        <PrimaryBtn onClick={save}>{saving ? "Saving..." : "Save"}</PrimaryBtn>
      </div>
    </div>
  );
}

function GuestPrompt({ onSignUp, onClose }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24 }} onClick={onClose}>
      <div style={{ width: "100%", background: T.white, borderRadius: 24, padding: 22, textAlign: "center", animation: "popIn .25s ease" }} onClick={(e) => e.stopPropagation()}>
        <Ic.Hourglass s={34} c={T.royal} />
        <h2 style={{ ...fr(700, 20, T.royal), margin: "8px 0 6px" }}>Join to spend time</h2>
        <p style={{ ...nu(700, 13.5, T.soft), margin: "0 0 16px" }}>These are real people. Create your free profile and they can say yes back.</p>
        <PrimaryBtn onClick={onSignUp}>Create my profile</PrimaryBtn>
        <button onClick={onClose} style={{ width: "100%", marginTop: 8, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Keep looking</button>
      </div>
    </div>
  );
}

// ================= Full profile view (before or after matching) =================
function ProfileDetailModal({ profile, myLoc, onClose, onSwipe, onMessage, onLikeBack, onReport }) {
  const { t } = useLang();
  const L = useLabel();
  const ideaText = useIdeaText();
  const [idx, setIdx] = useState(0);
  // List queries skip gallery photos to keep them fast, so pull this person's
  // gallery only now that their profile is actually open.
  const [lazyPhotos, setLazyPhotos] = useState(null);
  const pid = profile && profile.id;
  React.useEffect(() => {
    let cancelled = false;
    setLazyPhotos(null);
    if (!pid) return;
    api.loadGallery(pid).then((r) => { if (!cancelled) setLazyPhotos(r.photos || []); });
    return () => { cancelled = true; };
  }, [pid]);
  if (!profile) return null;
  const extraPhotos = (profile.photos && profile.photos.length) ? profile.photos : (lazyPhotos || []);
  const gallery = [profile.photo, ...extraPhotos].filter(Boolean);
  const hasPhotos = gallery.length > 0;
  const shared = sharedLikes(profile);

  // Height reads in feet and inches for people using miles
  const heightLabel = (() => {
    if (!profile.heightCm) return null;
    if (api.user?.distanceUnit === "mi") {
      const total = Math.round(profile.heightCm / 2.54);
      return `${Math.floor(total / 12)}' ${total % 12}"`;
    }
    return `${profile.heightCm} cm`;
  })();

  const chronoLabel = profile.chronotype
    ? (CHRONO.find(([v]) => v === profile.chronotype) || [])[1] || null
    : null;
  const genderLabel = profile.gender
    ? (GENDERS.find(([v]) => v === profile.gender) || [])[1] || null
    : null;

  const facts = [
    heightLabel && { icon: "Rise", text: heightLabel },
    genderLabel && genderLabel !== "Prefer not to say" && { icon: "Person", text: genderLabel },
    chronoLabel && { icon: chronoLabel === "Night person" ? "Moon" : "Sun", text: chronoLabel },
    profile.city && { icon: "Pin", text: profile.city },
    profile.openToDoubles && { icon: "Users", text: t("doubleBadge") },
  ].filter(Boolean);

  const Section = ({ title, items }) => (
    items && items.length > 0 ? (
      <div>
        <div style={{ ...nu(800, 10.5, T.soft), letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 7 }}>{title}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {items.map((x) => <Pill key={x} filled={shared.includes(x)}>{L(x)}</Pill>)}
        </div>
      </div>
    ) : null
  );

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: T.white, borderRadius: "26px 26px 0 0", width: "100%", maxHeight: "94%", overflowY: "auto", animation: "floatUp .3s ease" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ position: "relative", height: 300, background: hasPhotos ? `url(${gallery[idx]}) center/cover no-repeat` : `linear-gradient(135deg, ${profile.grad[0]}, ${profile.grad[1]})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {!hasPhotos && <span style={{ ...fr(700, 100, "rgba(255,255,255,.95)"), lineHeight: 1 }}>{profile.name[0]}</span>}
          <button onClick={onClose} aria-label={t("close")} style={{ position: "absolute", top: 14, right: 14, width: 34, height: 34, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.35)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Cross s={16} c={T.white} /></button>
          {gallery.length > 1 && (
            <>
              <button onClick={() => setIdx((i) => (i - 1 + gallery.length) % gallery.length)} aria-label="Previous photo" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.35)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><Ic.Chevron s={16} c={T.white} /></span></button>
              <button onClick={() => setIdx((i) => (i + 1) % gallery.length)} aria-label="Next photo" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.35)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Chevron s={16} c={T.white} /></button>
              <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5 }}>
                {gallery.map((_, i) => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === idx ? T.white : "rgba(255,255,255,.5)" }} />)}
              </div>
            </>
          )}
          <div style={{ position: "absolute", top: 14, left: 14 }}><ZeroStamp size={54} /></div>
        </div>

        <div style={{ padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={fr(700, 26, T.ink)}>{profile.name}, {profile.age}</span>
            {profile.verified && <Ic.ShieldCheck s={20} c={T.green} />}
            <span style={{ ...nu(700, 13, T.soft), marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}><Ic.Pin s={13} c={T.soft} />{distPhrase(myLoc, profile)}</span>
          </div>

          {profile.freeTonight && (
            <div style={{ display: "flex" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.royal, borderRadius: 999, padding: "6px 12px", ...nu(800, 12.5, T.white) }}>
                <Ic.Moon s={13} c={T.white} />{t("freeTonightBadge")}
              </span>
            </div>
          )}

          {profile.rep && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ ...fr(700, 12, T.green), background: "#E8F8EF", borderRadius: 999, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}><Ic.Hourglass s={12} c={T.green} />{profile.rep.pct}% {t("timeWellSpentPct")}</span>
              {(profile.rep.traits || []).map((x) => <Pill key={x}>{x}</Pill>)}
            </div>
          )}

          {facts.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {facts.map((f, i) => {
                const FIcon = Ic[f.icon];
                return (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#FBFAFE", border: `1px solid ${T.lilac}`, borderRadius: 999, padding: "6px 11px", ...nu(700, 12.5, T.ink) }}>
                    <FIcon s={13} c={T.royal} />{L(f.text)}
                  </span>
                );
              })}
            </div>
          )}

          {profile.bio && (
            <div>
              <div style={{ ...nu(800, 10.5, T.soft), letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 6 }}>{t("aboutMe")}</div>
              <p style={{ margin: 0, ...nu(600, 14, T.ink), lineHeight: 1.55 }}>{profile.bio}</p>
            </div>
          )}

          {shared.length > 0 && (
            <div style={{ background: "#FFF4D6", borderRadius: 14, padding: "10px 12px", ...nu(700, 13, "#8A6400"), display: "flex", alignItems: "center", gap: 6 }}>
              <Ic.Spark s={14} c={T.sun} />{t("bothLove")}: {shared.map(L).join(", ")}
            </div>
          )}

          {(profile.availability || []).length > 0 && (
            <div>
              <div style={{ ...nu(800, 10.5, T.soft), letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 7 }}>{t("availabilityLabel")}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(profile.availability || []).map((v) => {
                  const slot = AVAIL_SLOTS.find(([k]) => k === v);
                  return slot ? <Pill key={v}>{L(slot[1])}</Pill> : null;
                })}
              </div>
            </div>
          )}
          <Section title={t("thingsTheyDo")} items={profile.activities} />
          <Section title={t("interestsLabel")} items={profile.interests} />
          <Section title={t("hobbiesLabel")} items={profile.hobbies} />

          <div style={{ background: T.lilac, borderRadius: 14, padding: "11px 13px", ...nu(700, 13.5, T.royal), display: "flex", alignItems: "center", gap: 6 }}><Ic.Bulb s={14} c={T.royal} />{t("freeDateIdea")}: {ideaText(profile.idea)}</div>

          {onSwipe && (
            <div style={{ display: "flex", justifyContent: "center", gap: 18, paddingTop: 4 }}>
              <button onClick={() => onSwipe("left")} aria-label={t("pass")} style={{ width: 54, height: 54, borderRadius: "50%", border: "none", background: T.lilac, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Cross s={20} c={T.ink} /></button>
              <button onClick={() => onSwipe("right")} aria-label={t("spendTime")} style={{ width: 64, height: 64, borderRadius: "50%", border: "none", background: T.royal, cursor: "pointer", boxShadow: "0 6px 18px rgba(91,33,182,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Hourglass s={26} c={T.white} /></button>
            </div>
          )}
          {onLikeBack && <PrimaryBtn onClick={() => onLikeBack(profile)}>{t("spendTimeWith")} {profile.name}</PrimaryBtn>}
          {onMessage && <PrimaryBtn onClick={() => onMessage(profile)}>{t("messageBtn")} {profile.name}</PrimaryBtn>}
          {onReport && (
            <button onClick={() => onReport(profile)} style={{ marginTop: 2, width: "100%", border: `1.5px solid ${T.lilacDeep}`, background: T.white, borderRadius: 999, padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, ...nu(800, 13, T.soft) }}>
              <Ic.Flag s={15} c={T.soft} />{t("blockOrReport")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ================= Swipe card =================
function Card({ profile, onSwipe, isTop, myLoc, onReport, onView }) {
  const { t } = useLang();
  const L = useLabel();
  const ideaText = useIdeaText();
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
        <div style={{ flex: "0 0 44%", position: "relative", background: profile.photo ? `url(${profile.photo}) center/cover no-repeat, linear-gradient(135deg, ${profile.grad[0]}, ${profile.grad[1]})` : `linear-gradient(135deg, ${profile.grad[0]}, ${profile.grad[1]})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {!profile.photo && <span style={{ ...fr(700, 92, "rgba(255,255,255,.95)"), filter: "drop-shadow(0 6px 12px rgba(0,0,0,.2))", lineHeight: 1 }}>{profile.name[0]}</span>}
          <div style={{ position: "absolute", top: 14, right: 14 }}><ZeroStamp /></div>
          <div style={{ position: "absolute", top: 18, left: 16, opacity: likeOp, ...fr(700, 24, T.white), border: `3px solid ${T.white}`, borderRadius: 12, padding: "2px 12px", transform: "rotate(-10deg)", background: "rgba(47,191,113,.85)" }}>WORTH MY TIME</div>
          <div style={{ position: "absolute", top: 18, right: 76, opacity: nopeOp, ...fr(700, 24, T.white), border: `3px solid ${T.white}`, borderRadius: 12, padding: "2px 12px", transform: "rotate(10deg)", background: "rgba(42,27,74,.6)" }}>NOT THIS TIME</div>
          <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5 }}>
            {profile.secondChance && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 999, padding: "6px 11px", background: T.sun, ...fr(600, 11.5, T.ink) }}>
                <Ic.Hourglass s={12} c={T.ink} />{t("gaveYouTime")}
              </span>
            )}
            {profile.freeTonight && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 999, padding: "6px 11px", background: T.green, ...fr(600, 11.5, T.white) }}>
                <Ic.Moon s={12} c={T.white} />{t("freeTonightBadge")}
              </span>
            )}
            {profile.openToDoubles && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 999, padding: "6px 11px", background: "rgba(255,255,255,.9)", ...fr(600, 11.5, T.royal) }}>
                <Ic.Users s={12} c={T.royal} />{t("doubleBadge")}
              </span>
            )}
          </div>
          <button onClick={() => onView(profile)} onPointerDown={(e) => e.stopPropagation()} aria-label={t("viewProfile")} style={{ position: "absolute", bottom: 14, right: 14, display: "flex", alignItems: "center", gap: 5, border: "none", borderRadius: 999, padding: "7px 12px", background: "rgba(0,0,0,.35)", cursor: "pointer", ...nu(700, 12, T.white) }}>
            <Ic.Eye s={14} c={T.white} />{t("viewProfile")}
          </button>
        </div>
        <div style={{ flex: 1, padding: "16px 18px 14px", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={fr(600, 26, T.ink)}>{profile.name}, {profile.age}</span>
            {profile.verified && <Ic.ShieldCheck s={19} c={T.green} />}
            <span style={{ ...nu(700, 13, T.soft), display: "inline-flex", alignItems: "center", gap: 4 }}><Ic.Pin s={13} c={T.soft} />{distPhrase(myLoc, profile)}</span>
            <button onClick={() => onReport(profile)} onPointerDown={(e) => e.stopPropagation()} aria-label="Report this profile" style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", padding: 4 }}><Ic.Flag s={15} c={T.lilacDeep} /></button>
          </div>
          {profile.rep && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ ...fr(700, 12, T.green), background: "#E8F8EF", borderRadius: 999, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}><Ic.Hourglass s={12} c={T.green} />{profile.rep.pct}% time well spent</span>
              {(profile.rep.traits || []).slice(0, 2).map((t) => <Pill key={t}>{t}</Pill>)}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {haversineKm(myLoc, profile.loc) !== null && haversineKm(myLoc, profile.loc) < 3 && (
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
  // Only list things TOM+ actually gives you. Anything free for everyone
  // does not belong on this screen.
  const feats = [
    [Ic.Infinity, "Unlimited likes", "Never run out of time to give"],
    [Ic.Eye, "See who likes you", "Skip straight to mutual"],
    [Ic.Bubble, "Read receipts", "See when your message was opened"],
    [Ic.Sun, "Golden Hours", "Five a day instead of one"],
    [Ic.Moon, "Off the Clock", "Browse invisibly"],
    [Ic.Rise, "Weekly Prime Time", "Seven days at the top of nearby decks"],
  ];
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: T.white, borderRadius: "26px 26px 0 0", padding: "22px 20px 20px", width: "100%", maxHeight: "88%", overflowY: "auto", animation: "floatUp .3s ease" }} onClick={(e) => e.stopPropagation()}>
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

// ================= Language (built into this file on purpose) =================
// Kept inline so a future App.jsx swap can never drop it again.
const LANGS = [
  { code: "en", short: "EN", name: "English" },
  { code: "tr", short: "TR", name: "Türkçe" },
  { code: "es", short: "ES", name: "Español" },
];

const STRINGS = {
  en: {
    roadmap1: "Make connections",
    roadmap2: "Propose a date",
    roadmap3: "Or send a mission",
    roadmap4: "Use our \"Free Tonight\" button",
    roadmap5: "Rate the time you spent",
    personThinks: "person thinks you're worth their time", peopleThink: "people think you're worth their time", seeWhoLikes: "See who likes you with TOM+",
    loadTrouble: "Trouble loading. Tap retry.", retry: "Retry",
    whenFree: "When are you usually free?", whenFreeSub: "Helps TOM match you with people whose hours line up.",
    freeTonight: "Free tonight", freeTonightSub: "Shows a badge until midnight, then clears itself",
    freeTonightBadge: "Free tonight", availabilityLabel: "Usually free",
    openToDoubles: "Open to double dates", openToDoublesSub: "Two of you, two of them. Less pressure, more fun.",
    doubleBadge: "Up for doubles", doubleDate: "Double date",
    doubleDateSub: "You each bring a friend. Still $0.",
    yourReputation: "Your Time Reputation", noReputationYet: "No reviews yet",
    noReputationSub: "After 3 rated dates your reputation shows on your profile.",
    reputationFrom: "from", ratedDates: "rated dates",
    onlyFreeTonight: "Only people free tonight",
    datingCosts: "Dating costs $200 to $500 now.", datingCostsSub: "On TOM it costs nothing. Don't spend money. Spend time.",
    welcomeBack: "Welcome back", timeWaiting: "Your time is waiting.",
    forgotPassword: "Forgot your password?",
    forgotTitle: "Reset your password",
    forgotSub: "We'll email you a link to set a new one.",
    sendResetLink: "Send reset link",
    backToSignIn: "Back to sign in",
    checkYourEmail: "Check your email",
    resetSentBody: "If {email} has a TOM account, a link to set a new password is on its way.",
    resetSpamHint: "The link expires in an hour. Check your spam folder if it hasn't arrived.",
    resendReset: "Send it again",
    chooseNewPassword: "Choose a new password",
    chooseNewPasswordSub: "Almost there.",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    passwordsDontMatch: "Those passwords don't match",
    savePassword: "Save new password",
    yourName: "Your name", namePlaceholder: "What should we call you?",
    emailLabel: "Email", passwordLabel: "Password", pw8: "8+ characters", yourPassword: "Your password",
    ageLabel: "Age", pleaseWait: "Please wait...", createAccount: "Create my account", signIn: "Sign in",
    alreadyOnTom: "Already on TOM? Sign in", newHere: "New here? Create an account",
    publicPlaces: "Public places. Equal basis. $0 always.",
    showYourFace: "Show your face", photoFormats: "JPEG, PNG, WebP, or HEIC. Up to 5 MB each.",
    profilePicture: "Profile picture (required)", changePhoto: "Change photo", uploadPhoto: "Upload photo",
    galleryLabel: "Gallery", moreLabel: "more",
    aboutYou: "About you", heightLabel: "Height", cityLabel: "City", cityPlaceholder: "Where you date",
    iAmA: "I am a", orientationLabel: "Orientation", showMe: "Show me", myHours: "My hours",
    whatYouLove: "What do you love doing?", freeDatesUpFor: "Free dates I'm up for (pick at least 1)",
    lastOneBio: "Last one: your bio", bioHint: "What should someone know before they spend time with you?",
    bioPlaceholder: "I rate every bench I sit on...",
    back: "Back", saving: "Saving...", continueBtn: "Continue", saveChanges: "Save changes", startSpending: "Start spending time",
    loadingDates: "Loading your connections",
    aboutMe: "About me", thingsTheyDo: "Things they like to do",
    interestsLabel: "Interests", hobbiesLabel: "Hobbies",
    spendTimeWith: "Spend time with", messageBtn: "Message",
    bootLead1: "The best dates are measured in moments\u2026", bootEmph1: "not money.",
    bootLead2: "Share experiences.", bootEmph2: "Not expenses.",
    undo: "UNDO", gaveYouTime: "Gave you their time",
    tagline: "TIME OVER MONEY", hook: "Dating without the bill.",
    signUp: "Sign Up", logIn: "Log In", guest: "Continue as Guest",
    agree: "By continuing, you agree to our", terms: "Terms of Service",
    privacy: "Privacy Policy", and: "and", language: "Language",
    languageSub: "Choose how TOM speaks to you",
    findingPeople: "Finding people near you",
    tabDiscover: "Discover", tabMissions: "Missions", tabDates: "Connections", tabYou: "You",
    closest: "CLOSEST", mostInCommon: "MOST IN COMMON", primeTime: "PRIME TIME",
    pass: "PASS", goldenHour: "GOLDEN HOUR", spendTime: "SPEND TIME",
    seenEveryone: "You've seen everyone nearby",
    newPeopleDaily: "New people join TOM every day. Check back soon.",
    blockOrReport: "Block or report",
    connLoadFailed: "Your connections did not load",
    connLoadFailedBody: "This is a connection problem on our side, not an empty inbox.",
    hiddenTitle: "You are not in anyone's deck yet",
    hiddenBody: "Add your {bits} and people will start seeing you.",
    hiddenCta: "Finish my profile",
    bit_photo: "photo", bit_bio: "short bio", bit_age: "age",
    oneNewMessage: "1 new message",
    newMessages: "{n} new messages",
    planWaiting: "A date plan is waiting on you",
    readReceipt: "Read",
    tuneHint: "Widen your age range or distance with the sliders button above to see more people.",
    emptyAdmirers: "{n} people already gave you their time. Take a look.",
    emptyAdmirersOne: "1 person already gave you their time. Take a look.",
    emptyTimeZones: "Spend time in another city. Free for everyone.",
    emptyInvite: "Invite a friend to TOM and fill your deck.",
    inviteCopied: "Invite link copied. Send it to a friend.",
    outOfLikes: "You're out of likes for today",
    likesReset: "Your likes reset tomorrow. Passing is always unlimited.",
    getUnlimited: "Get unlimited with TOM+",
    locationOff: "Location is off, so distances are hidden. Turn it on in your browser or phone settings to see who's nearby.",
    viewProfile: "View profile", distanceUnavailable: "Distance unavailable",
    away: "away", bothLove: "You both love", freeDateIdea: "Free date idea",
    yourDates: "Your connections", noDatesYet: "Make connections and they will show up here",
    noDatesSub: "Swipe right on someone whose time you'd like to share.",
    tapToMessage: "Tap to message", worthTheirTime: "Worth their time",
    admirersSub: "These people already said yes to spending time with you.",
    noAdmirers: "No admirers yet",
    noAdmirersSub: "When someone likes you, they show up here first.",
    backToDiscover: "Back to Discover",
    missionDates: "Mission Dates",
    missionSub: "Curated $0 dates. Pick one, send it to a match. Always optional.",
    send: "Send", matchFirst: "Match with someone first, then send them a mission.",
    sendMissionTo: "Send this mission to", cancel: "Cancel",
    sentMissionDate: "sent you a mission date", youSentMissionDate: "You sent a mission date",
    accept: "Accept", decline: "Decline", counter: "Counter",
    planADate: "Plan a date", ideas: "Ideas", proposeADate: "Propose a $0 date",
    whatsThePlan: "What's the plan?", propose: "Propose",
    timeHint: "Adding a time lets TOM check in afterwards. You can skip it.",
    itsAPlan: "It's a plan", dateProposal: "Date proposal",
    confirmTheDate: "Confirm the date", weMetUp: "We met up",
    waitingConfirm: "Waiting for", toConfirm: "to confirm",
    willCheckIn: "TOM will check in after to see how it went",
    typeMessage: "Type a message", sendBtn: "Send",
    verifyProfile: "Verify your profile", verifyInReview: "Verification in review",
    verifySub: "Get the green badge. Match with more confidence.",
    verifyReviewSub: "Usually done within 24 hours",
    getTom: "Get TOM", tomPerks: "Golden Hours, Prime Time, and more",
    offTheClock: "Off the Clock", offOn: "You're invisible right now",
    offOff: "Go invisible without deleting anything",
    emailNotifs: "Email notifications",
    emailNotifsSub: "Matches, messages, and date check ins",
    aboutPrivacy: "About and privacy", logOut: "Log out", deleteAccount: "Delete account",
    everyDateCosts: "Every TOM date is designed to cost",
    noBills: "No bills. No paying. Just time together.",
    editProfile: "Edit profile", fineTune: "Fine-tune your time",
    ageRange: "Age range", maxDistance: "Max distance", onlyShow: "Only show people into",
    applyFilters: "Apply filters", resetAll: "Reset all",
    timeZones: "Time Zones", timeZonesSub: "Spend time in another city before you even get there.",
    myArea: "My current area",
    howDidItGo: "How did it go?", yourPlanWith: "Your plan with",
    weMetUpBtn: "We met up", rescheduled: "We rescheduled or called it off",
    didntShow: "They didn't show up", askLater: "Ask me later",
    thanks: "Thanks", waitingOther: "confirms too, you'll both get to rate the time you spent.",
    rateYourDate: "Rate your TOM date", ratePrefix: "With",
    rateSub: "About the time, never the looks.",
    timeWellSpent: "Was it time well spent?", yes: "Yes", notReally: "Not really",
    whatWereThey: "What were they like? (pick up to 3)",
    anythingFlag: "Anything to flag? (optional, private)",
    submitReview: "Submit review", skipForNow: "Skip for now",
    timeWellSpentPct: "time well spent",
    joinToSpend: "Join to spend time",
    joinSub: "These are real people. Create your free profile and they can say yes back.",
    createProfile: "Create my profile", keepLooking: "Keep looking",
    notNow: "Not now", close: "Close", gotIt: "Got it",
  },
  tr: {
    roadmap1: "Ba\u011flant\u0131 kur",
    roadmap2: "Bulu\u015fma \u00f6ner",
    roadmap3: "Ya da bir g\u00f6rev g\u00f6nder",
    roadmap4: "Bu \"Ak\u015fam M\u00fcsaitim\" d\u00fc\u011fmesini kullan",
    roadmap5: "Ge\u00e7irdi\u011fin zaman\u0131 puanla",
    personThinks: "ki\u015fi zaman\u0131na de\u011fer buluyor", peopleThink: "ki\u015fi zaman\u0131na de\u011fer buluyor", seeWhoLikes: "TOM+ ile seni be\u011fenenleri g\u00f6r",
    loadTrouble: "Y\u00fckleme sorunu. Yeniden dene.", retry: "Yeniden dene",
    whenFree: "Genelde ne zaman m\u00fcsaitsin?", whenFreeSub: "TOM'un saatleri uyan ki\u015filerle e\u015fle\u015ftirmesine yard\u0131mc\u0131 olur.",
    freeTonight: "Bu ak\u015fam m\u00fcsaitim", freeTonightSub: "Gece yar\u0131s\u0131na kadar rozet g\u00f6sterir, sonra kendili\u011finden kalkar",
    freeTonightBadge: "Bu ak\u015fam m\u00fcsait", availabilityLabel: "Genelde m\u00fcsait",
    openToDoubles: "\u00c7ift bulu\u015fmaya a\u00e7\u0131k", openToDoublesSub: "\u0130kiniz, ikisi. Daha az bask\u0131, daha \u00e7ok e\u011flence.",
    doubleBadge: "\u00c7ifte var", doubleDate: "\u00c7ift bulu\u015fma",
    doubleDateSub: "Her biriniz bir arkada\u015f getirir. Yine 0 TL.",
    yourReputation: "Zaman \u0130tibar\u0131n", noReputationYet: "Hen\u00fcz de\u011ferlendirme yok",
    noReputationSub: "3 de\u011ferlendirilmi\u015f bulu\u015fmadan sonra itibar\u0131n profilinde g\u00f6r\u00fcn\u00fcr.",
    reputationFrom: "kaynak:", ratedDates: "de\u011ferlendirilmi\u015f bulu\u015fma",
    onlyFreeTonight: "Sadece bu ak\u015fam m\u00fcsait olanlar",
    datingCosts: "Fl\u00f6rt art\u0131k 200 ile 500 dolar aras\u0131.", datingCostsSub: "TOM'da hi\u00e7bir \u015fey tutmaz. Para de\u011fil, zaman harcay\u0131n.",
    welcomeBack: "Tekrar ho\u015f geldin", timeWaiting: "Zaman\u0131n seni bekliyor.",
    forgotPassword: "\u015eifreni mi unuttun?",
    forgotTitle: "\u015eifreni s\u0131f\u0131rla",
    forgotSub: "Yeni bir \u015fifre belirlemen i\u00e7in sana bir ba\u011flant\u0131 g\u00f6nderece\u011fiz.",
    sendResetLink: "S\u0131f\u0131rlama ba\u011flant\u0131s\u0131 g\u00f6nder",
    backToSignIn: "Giri\u015fe d\u00f6n",
    checkYourEmail: "E-postan\u0131 kontrol et",
    resetSentBody: "{email} adresine ait bir TOM hesab\u0131 varsa, yeni \u015fifre belirleme ba\u011flant\u0131s\u0131 yolda.",
    resetSpamHint: "Ba\u011flant\u0131 bir saat i\u00e7inde ge\u00e7ersiz olur. Gelmediyse spam klas\u00f6r\u00fcne bak.",
    resendReset: "Tekrar g\u00f6nder",
    chooseNewPassword: "Yeni \u015fifre se\u00e7",
    chooseNewPasswordSub: "Neredeyse bitti.",
    newPassword: "Yeni \u015fifre",
    confirmPassword: "Yeni \u015fifreyi onayla",
    passwordsDontMatch: "\u015eifreler e\u015fle\u015fmiyor",
    savePassword: "Yeni \u015fifreyi kaydet",
    yourName: "Ad\u0131n", namePlaceholder: "Sana nas\u0131l hitap edelim?",
    emailLabel: "E-posta", passwordLabel: "\u015eifre", pw8: "En az 8 karakter", yourPassword: "\u015eifren",
    ageLabel: "Ya\u015f", pleaseWait: "L\u00fctfen bekleyin...", createAccount: "Hesab\u0131m\u0131 olu\u015ftur", signIn: "Giri\u015f yap",
    alreadyOnTom: "Zaten TOM'da m\u0131s\u0131n? Giri\u015f yap", newHere: "Yeni misin? Hesap olu\u015ftur",
    publicPlaces: "A\u00e7\u0131k mekanlar. E\u015fit ko\u015fullar. Her zaman 0 TL.",
    showYourFace: "Y\u00fcz\u00fcn\u00fc g\u00f6ster", photoFormats: "JPEG, PNG, WebP veya HEIC. Her biri en fazla 5 MB.",
    profilePicture: "Profil foto\u011fraf\u0131 (zorunlu)", changePhoto: "Foto\u011fraf\u0131 de\u011fi\u015ftir", uploadPhoto: "Foto\u011fraf y\u00fckle",
    galleryLabel: "Galeri", moreLabel: "daha",
    aboutYou: "Hakk\u0131nda", heightLabel: "Boy", cityLabel: "\u015eehir", cityPlaceholder: "Nerede bulu\u015fuyorsun",
    iAmA: "Ben bir", orientationLabel: "Y\u00f6nelim", showMe: "Bana g\u00f6ster", myHours: "Saatlerim",
    whatYouLove: "Ne yapmay\u0131 seversin?", freeDatesUpFor: "Vars\u0131n oldu\u011fum \u00fccretsiz bulu\u015fmalar (en az 1 se\u00e7)",
    lastOneBio: "Son olarak: biyografin", bioHint: "Biri seninle zaman ge\u00e7irmeden \u00f6nce ne bilmeli?",
    bioPlaceholder: "Oturdu\u011fum her bank\u0131 puanlar\u0131m...",
    back: "Geri", saving: "Kaydediliyor...", continueBtn: "Devam", saveChanges: "De\u011fi\u015fiklikleri kaydet", startSpending: "Zaman ay\u0131rmaya ba\u015fla",
    loadingDates: "Ba\u011flant\u0131lar\u0131n y\u00fckleniyor",
    aboutMe: "Hakk\u0131mda", thingsTheyDo: "Yapmay\u0131 sevdikleri",
    interestsLabel: "\u0130lgi alanlar\u0131", hobbiesLabel: "Hobiler",
    spendTimeWith: "Zaman ay\u0131r:", messageBtn: "Mesaj g\u00f6nder:",
    bootLead1: "En g\u00fczel bulu\u015fmalar anlarla \u00f6l\u00e7\u00fcl\u00fcr\u2026", bootEmph1: "parayla de\u011fil.",
    bootLead2: "Deneyimleri payla\u015f\u0131n.", bootEmph2: "Masraflar\u0131 de\u011fil.",
    undo: "GERİ AL", gaveYouTime: "Sana zaman ayırdı",
    tagline: "PARA DEĞİL ZAMAN", hook: "Hesap ödemeden flört.",
    signUp: "Kayıt Ol", logIn: "Giriş Yap", guest: "Misafir olarak devam et",
    agree: "Devam ederek şunları kabul edersiniz:", terms: "Kullanım Şartları",
    privacy: "Gizlilik Politikası", and: "ve", language: "Dil",
    languageSub: "TOM'un sizinle hangi dilde konuşacağını seçin",
    findingPeople: "Yakınındaki kişiler aranıyor",
    tabDiscover: "Keşfet", tabMissions: "Görevler", tabDates: "Bağlantılar", tabYou: "Sen",
    closest: "EN YAKIN", mostInCommon: "EN ÇOK ORTAK NOKTA", primeTime: "ALTIN SAAT",
    pass: "GEÇ", goldenHour: "ALTIN SAAT", spendTime: "ZAMAN AYIR",
    seenEveryone: "Yakındaki herkesi gördün",
    newPeopleDaily: "TOM'a her gün yeni kişiler katılıyor. Yakında tekrar bak.",
    blockOrReport: "Engelle veya bildir",
    connLoadFailed: "Bağlantıların yüklenemedi",
    connLoadFailedBody: "Bu bizim tarafımızda bir sorun, kutun boş olduğu için değil.",
    hiddenTitle: "Henüz kimsenin destesinde değilsin",
    hiddenBody: "{bits} ekle, insanlar seni görmeye başlasın.",
    hiddenCta: "Profilimi tamamla",
    bit_photo: "fotoğraf", bit_bio: "kısa biyografi", bit_age: "yaş",
    oneNewMessage: "1 yeni mesaj",
    newMessages: "{n} yeni mesaj",
    planWaiting: "Bir buluşma planı seni bekliyor",
    readReceipt: "Okundu",
    tuneHint: "Daha fazla kişi görmek için yukarıdaki ayar düğmesinden yaş aralığını veya mesafeyi genişlet.",
    emptyAdmirers: "{n} kişi sana çoktan zaman ayırdı. Bir bak.",
    emptyAdmirersOne: "1 kişi sana çoktan zaman ayırdı. Bir bak.",
    emptyTimeZones: "Başka bir şehirde zaman geçir. Herkese ücretsiz.",
    emptyInvite: "Bir arkadaşını TOM'a davet et, desteni doldur.",
    inviteCopied: "Davet bağlantısı kopyalandı. Bir arkadaşına gönder.",
    outOfLikes: "Bugünlük beğeni hakkın bitti",
    likesReset: "Beğenilerin yarın yenilenir. Geçmek her zaman sınırsızdır.",
    getUnlimited: "TOM+ ile sınırsız al",
    locationOff: "Konum kapalı, bu yüzden mesafeler gizli. Yakındakileri görmek için tarayıcı veya telefon ayarlarından aç.",
    viewProfile: "Profili gör", distanceUnavailable: "Mesafe bilinmiyor",
    away: "uzakta", bothLove: "İkiniz de seviyorsunuz", freeDateIdea: "Ücretsiz buluşma fikri",
    yourDates: "Bağlantıların", noDatesYet: "Bağlantı kur, burada görünsünler",
    noDatesSub: "Zamanını paylaşmak istediğin birine sağa kaydır.",
    tapToMessage: "Mesaj için dokun", worthTheirTime: "Zamanına değer",
    admirersSub: "Bu kişiler seninle zaman geçirmeye çoktan evet dedi.",
    noAdmirers: "Henüz beğenen yok",
    noAdmirersSub: "Biri seni beğendiğinde önce burada görünür.",
    backToDiscover: "Keşfet'e dön",
    missionDates: "Görev Buluşmaları",
    missionSub: "Seçilmiş 0 TL buluşmalar. Birini seç, eşleşmene gönder. Her zaman isteğe bağlı.",
    send: "Gönder", matchFirst: "Önce biriyle eşleş, sonra ona bir görev gönder.",
    sendMissionTo: "Bu görevi şuna gönder", cancel: "İptal",
    sentMissionDate: "sana bir görev buluşması gönderdi", youSentMissionDate: "Bir görev buluşması gönderdin",
    accept: "Kabul et", decline: "Reddet", counter: "Karşı öneri",
    planADate: "Buluşma planla", ideas: "Fikirler", proposeADate: "0 TL buluşma öner",
    whatsThePlan: "Plan ne?", propose: "Öner",
    timeHint: "Saat eklersen TOM sonrasında nasıl geçtiğini sorar. Atlayabilirsin.",
    itsAPlan: "Anlaştık", dateProposal: "Buluşma önerisi",
    confirmTheDate: "Buluşmayı onayla", weMetUp: "Buluştuk",
    waitingConfirm: "Onay bekleniyor:", toConfirm: "",
    willCheckIn: "TOM sonrasında nasıl geçtiğini soracak",
    typeMessage: "Bir mesaj yaz", sendBtn: "Gönder",
    verifyProfile: "Profilini doğrula", verifyInReview: "Doğrulama inceleniyor",
    verifySub: "Yeşil rozeti al. Daha güvenle eşleş.",
    verifyReviewSub: "Genellikle 24 saat içinde tamamlanır",
    getTom: "TOM", tomPerks: "Altın Saatler, Altın Saat önceliği, ve daha fazlası",
    offTheClock: "Mesai Dışı", offOn: "Şu anda görünmezsin",
    offOff: "Hesabını silmeden görünmez ol",
    emailNotifs: "E-posta bildirimleri",
    emailNotifsSub: "Eşleşmeler, mesajlar ve buluşma soruları",
    aboutPrivacy: "Hakkında ve gizlilik", logOut: "Çıkış yap", deleteAccount: "Hesabı sil",
    everyDateCosts: "Her TOM buluşmasının maliyeti",
    noBills: "Hesap yok. Ödeme yok. Sadece birlikte zaman.",
    editProfile: "Profili düzenle", fineTune: "Zamanını ayarla",
    ageRange: "Yaş aralığı", maxDistance: "En fazla mesafe", onlyShow: "Sadece şunlarla ilgilenenler",
    applyFilters: "Filtreleri uygula", resetAll: "Hepsini sıfırla",
    timeZones: "Zaman Dilimleri", timeZonesSub: "Gitmeden önce başka bir şehirde zaman geçir.",
    myArea: "Bulunduğum bölge",
    howDidItGo: "Nasıl geçti?", yourPlanWith: "Şununla planın:",
    weMetUpBtn: "Buluştuk", rescheduled: "Erteledik veya iptal ettik",
    didntShow: "Gelmedi", askLater: "Sonra sor",
    thanks: "Teşekkürler", waitingOther: "de onayladığında ikiniz de geçirdiğiniz zamanı puanlayabileceksiniz.",
    rateYourDate: "TOM buluşmanı puanla", ratePrefix: "Şununla:",
    rateSub: "Görünüş değil, geçirilen zaman hakkında.",
    timeWellSpent: "İyi geçen bir zaman mıydı?", yes: "Evet", notReally: "Pek değil",
    whatWereThey: "Nasıl biriydi? (en fazla 3 seç)",
    anythingFlag: "Bildirmek istediğin bir şey var mı? (isteğe bağlı, gizli)",
    submitReview: "Değerlendirmeyi gönder", skipForNow: "Şimdilik geç",
    timeWellSpentPct: "iyi geçen zaman",
    joinToSpend: "Zaman ayırmak için katıl",
    joinSub: "Bunlar gerçek insanlar. Ücretsiz profilini oluştur ki onlar da evet diyebilsin.",
    createProfile: "Profilimi oluştur", keepLooking: "Bakmaya devam et",
    notNow: "Şimdi değil", close: "Kapat", gotIt: "Anladım",
  },
  es: {
    roadmap1: "Haz conexiones",
    roadmap2: "Propon una cita",
    roadmap3: "O env\u00eda una misi\u00f3n",
    roadmap4: "Usa el bot\u00f3n \"Libre esta noche\"",
    roadmap5: "Califica el tiempo que pasaron",
    personThinks: "persona cree que vales su tiempo", peopleThink: "personas creen que vales su tiempo", seeWhoLikes: "Ve qui\u00e9n te quiere con TOM+",
    loadTrouble: "Problema al cargar. Reintenta.", retry: "Reintentar",
    whenFree: "\u00bfCu\u00e1ndo sueles estar libre?", whenFreeSub: "Ayuda a TOM a emparejarte con gente cuyos horarios encajan.",
    freeTonight: "Libre esta noche", freeTonightSub: "Muestra una insignia hasta medianoche y luego se borra sola",
    freeTonightBadge: "Libre esta noche", availabilityLabel: "Suele estar libre",
    openToDoubles: "Abierto a citas dobles", openToDoublesSub: "Ustedes dos, ellos dos. Menos presi\u00f3n, m\u00e1s diversi\u00f3n.",
    doubleBadge: "Va a dobles", doubleDate: "Cita doble",
    doubleDateSub: "Cada uno trae a un amigo. Sigue siendo $0.",
    yourReputation: "Tu Reputaci\u00f3n de Tiempo", noReputationYet: "A\u00fan sin rese\u00f1as",
    noReputationSub: "Tras 3 citas calificadas tu reputaci\u00f3n aparece en tu perfil.",
    reputationFrom: "de", ratedDates: "citas calificadas",
    onlyFreeTonight: "Solo gente libre esta noche",
    datingCosts: "Salir cuesta ahora entre $200 y $500.", datingCostsSub: "En TOM no cuesta nada. No gastes dinero. Dedica tiempo.",
    welcomeBack: "Bienvenido de nuevo", timeWaiting: "Tu tiempo te espera.",
    forgotPassword: "\u00bfOlvidaste tu contrase\u00f1a?",
    forgotTitle: "Restablece tu contrase\u00f1a",
    forgotSub: "Te enviaremos un enlace para crear una nueva.",
    sendResetLink: "Enviar enlace",
    backToSignIn: "Volver a iniciar sesi\u00f3n",
    checkYourEmail: "Revisa tu correo",
    resetSentBody: "Si {email} tiene una cuenta en TOM, el enlace para crear una nueva contrase\u00f1a va en camino.",
    resetSpamHint: "El enlace caduca en una hora. Revisa tu carpeta de spam si no llega.",
    resendReset: "Enviar de nuevo",
    chooseNewPassword: "Elige una nueva contrase\u00f1a",
    chooseNewPasswordSub: "Ya casi est\u00e1.",
    newPassword: "Nueva contrase\u00f1a",
    confirmPassword: "Confirma la nueva contrase\u00f1a",
    passwordsDontMatch: "Las contrase\u00f1as no coinciden",
    savePassword: "Guardar contrase\u00f1a",
    yourName: "Tu nombre", namePlaceholder: "\u00bfC\u00f3mo te llamamos?",
    emailLabel: "Correo", passwordLabel: "Contrase\u00f1a", pw8: "8 caracteres o m\u00e1s", yourPassword: "Tu contrase\u00f1a",
    ageLabel: "Edad", pleaseWait: "Un momento...", createAccount: "Crear mi cuenta", signIn: "Iniciar sesi\u00f3n",
    alreadyOnTom: "\u00bfYa est\u00e1s en TOM? Inicia sesi\u00f3n", newHere: "\u00bfNuevo aqu\u00ed? Crea una cuenta",
    publicPlaces: "Lugares p\u00fablicos. En igualdad. Siempre $0.",
    showYourFace: "Muestra tu cara", photoFormats: "JPEG, PNG, WebP o HEIC. Hasta 5 MB cada una.",
    profilePicture: "Foto de perfil (obligatoria)", changePhoto: "Cambiar foto", uploadPhoto: "Subir foto",
    galleryLabel: "Galer\u00eda", moreLabel: "m\u00e1s",
    aboutYou: "Sobre ti", heightLabel: "Estatura", cityLabel: "Ciudad", cityPlaceholder: "D\u00f3nde tienes citas",
    iAmA: "Soy", orientationLabel: "Orientaci\u00f3n", showMe: "Mu\u00e9strame", myHours: "Mis horas",
    whatYouLove: "\u00bfQu\u00e9 te encanta hacer?", freeDatesUpFor: "Citas gratis que me apetecen (elige al menos 1)",
    lastOneBio: "Lo \u00faltimo: tu biograf\u00eda", bioHint: "\u00bfQu\u00e9 deber\u00eda saber alguien antes de pasar tiempo contigo?",
    bioPlaceholder: "Califico cada banco en el que me siento...",
    back: "Atr\u00e1s", saving: "Guardando...", continueBtn: "Continuar", saveChanges: "Guardar cambios", startSpending: "Empezar a dar tiempo",
    loadingDates: "Cargando tus conexiones",
    aboutMe: "Sobre m\u00ed", thingsTheyDo: "Lo que le gusta hacer",
    interestsLabel: "Intereses", hobbiesLabel: "Pasatiempos",
    spendTimeWith: "Dar tiempo a", messageBtn: "Enviar mensaje a",
    bootLead1: "Las mejores citas se miden en momentos\u2026", bootEmph1: "no en dinero.",
    bootLead2: "Comparte experiencias.", bootEmph2: "No gastos.",
    undo: "DESHACER", gaveYouTime: "Te dio su tiempo",
    tagline: "TIEMPO SOBRE DINERO", hook: "Citas sin la cuenta.",
    signUp: "Registrarse", logIn: "Iniciar sesión", guest: "Continuar como invitado",
    agree: "Al continuar, aceptas nuestros", terms: "Términos del Servicio",
    privacy: "Política de Privacidad", and: "y", language: "Idioma",
    languageSub: "Elige cómo TOM te habla",
    findingPeople: "Buscando personas cerca de ti",
    tabDiscover: "Descubrir", tabMissions: "Misiones", tabDates: "Conexiones", tabYou: "Tú",
    closest: "MÁS CERCA", mostInCommon: "MÁS EN COMÚN", primeTime: "HORA ESTELAR",
    pass: "PASAR", goldenHour: "HORA DORADA", spendTime: "DAR TIEMPO",
    seenEveryone: "Ya viste a todos cerca de ti",
    newPeopleDaily: "Cada día se une gente nueva a TOM. Vuelve pronto.",
    blockOrReport: "Bloquear o reportar",
    connLoadFailed: "Tus conexiones no se cargaron",
    connLoadFailedBody: "Es un problema nuestro, no que no tengas conexiones.",
    hiddenTitle: "Aún no estás en el mazo de nadie",
    hiddenBody: "Añade tu {bits} y la gente empezará a verte.",
    hiddenCta: "Completar mi perfil",
    bit_photo: "foto", bit_bio: "biografía breve", bit_age: "edad",
    oneNewMessage: "1 mensaje nuevo",
    newMessages: "{n} mensajes nuevos",
    planWaiting: "Un plan de cita te está esperando",
    readReceipt: "Leído",
    tuneHint: "Amplía tu rango de edad o distancia con el botón de ajustes de arriba para ver a más personas.",
    emptyAdmirers: "{n} personas ya te dieron su tiempo. Échales un vistazo.",
    emptyAdmirersOne: "1 persona ya te dio su tiempo. Échale un vistazo.",
    emptyTimeZones: "Pasa tiempo en otra ciudad. Gratis para todos.",
    emptyInvite: "Invita a un amigo a TOM y llena tu mazo.",
    inviteCopied: "Enlace de invitación copiado. Envíaselo a un amigo.",
    outOfLikes: "Se acabaron tus me gusta de hoy",
    likesReset: "Tus me gusta se reinician mañana. Pasar es siempre ilimitado.",
    getUnlimited: "Consigue ilimitado con TOM+",
    locationOff: "La ubicación está desactivada, así que las distancias están ocultas. Actívala en tu navegador o teléfono para ver quién está cerca.",
    viewProfile: "Ver perfil", distanceUnavailable: "Distancia no disponible",
    away: "de distancia", bothLove: "A los dos les gusta", freeDateIdea: "Idea de cita gratis",
    yourDates: "Tus conexiones", noDatesYet: "Haz conexiones y aparecerán aquí",
    noDatesSub: "Desliza a la derecha en alguien con quien quieras compartir tu tiempo.",
    tapToMessage: "Toca para escribir", worthTheirTime: "Vales su tiempo",
    admirersSub: "Estas personas ya dijeron que sí a pasar tiempo contigo.",
    noAdmirers: "Aún no hay admiradores",
    noAdmirersSub: "Cuando alguien te dé me gusta, aparecerá aquí primero.",
    backToDiscover: "Volver a Descubrir",
    missionDates: "Citas Misión",
    missionSub: "Citas de $0 seleccionadas. Elige una y envíala. Siempre opcional.",
    send: "Enviar", matchFirst: "Primero haz match con alguien y luego envíale una misión.",
    sendMissionTo: "Enviar esta misión a", cancel: "Cancelar",
    sentMissionDate: "te envió una cita misión", youSentMissionDate: "Enviaste una cita misión",
    accept: "Aceptar", decline: "Rechazar", counter: "Contrapropuesta",
    planADate: "Planear una cita", ideas: "Ideas", proposeADate: "Propón una cita de $0",
    whatsThePlan: "¿Cuál es el plan?", propose: "Proponer",
    timeHint: "Añadir una hora permite que TOM pregunte después. Puedes omitirlo.",
    itsAPlan: "Es un plan", dateProposal: "Propuesta de cita",
    confirmTheDate: "Confirmar la cita", weMetUp: "Nos vimos",
    waitingConfirm: "Esperando que confirme", toConfirm: "",
    willCheckIn: "TOM preguntará después cómo fue",
    typeMessage: "Escribe un mensaje", sendBtn: "Enviar",
    verifyProfile: "Verifica tu perfil", verifyInReview: "Verificación en revisión",
    verifySub: "Consigue la insignia verde. Haz match con más confianza.",
    verifyReviewSub: "Normalmente listo en 24 horas",
    getTom: "Consigue TOM", tomPerks: "Horas Doradas, Hora Estelar, y más",
    offTheClock: "Fuera de servicio", offOn: "Ahora eres invisible",
    offOff: "Vuélvete invisible sin borrar nada",
    emailNotifs: "Notificaciones por correo",
    emailNotifsSub: "Matches, mensajes y preguntas sobre citas",
    aboutPrivacy: "Acerca de y privacidad", logOut: "Cerrar sesión", deleteAccount: "Eliminar cuenta",
    everyDateCosts: "Cada cita de TOM está diseñada para costar",
    noBills: "Sin cuentas. Sin pagar. Solo tiempo juntos.",
    editProfile: "Editar perfil", fineTune: "Ajusta tu tiempo",
    ageRange: "Rango de edad", maxDistance: "Distancia máxima", onlyShow: "Mostrar solo a quienes les guste",
    applyFilters: "Aplicar filtros", resetAll: "Restablecer todo",
    timeZones: "Zonas Horarias", timeZonesSub: "Pasa tiempo en otra ciudad antes de llegar.",
    myArea: "Mi zona actual",
    howDidItGo: "¿Cómo fue?", yourPlanWith: "Tu plan con",
    weMetUpBtn: "Nos vimos", rescheduled: "Lo reprogramamos o cancelamos",
    didntShow: "No apareció", askLater: "Pregúntame luego",
    thanks: "Gracias", waitingOther: "confirme también, ambos podrán calificar el tiempo que pasaron.",
    rateYourDate: "Califica tu cita TOM", ratePrefix: "Con",
    rateSub: "Sobre el tiempo, nunca sobre la apariencia.",
    timeWellSpent: "¿Fue tiempo bien invertido?", yes: "Sí", notReally: "La verdad no",
    whatWereThey: "¿Cómo fue esa persona? (elige hasta 3)",
    anythingFlag: "¿Algo que reportar? (opcional, privado)",
    submitReview: "Enviar reseña", skipForNow: "Omitir por ahora",
    timeWellSpentPct: "tiempo bien invertido",
    joinToSpend: "Únete para dar tiempo",
    joinSub: "Estas son personas reales. Crea tu perfil gratis y podrán decirte que sí.",
    createProfile: "Crear mi perfil", keepLooking: "Seguir mirando",
    notNow: "Ahora no", close: "Cerrar", gotIt: "Entendido",
  },
};

const LangCtx = React.createContext({ lang: "en", setLang: () => {}, t: (k) => STRINGS.en[k] });
const useLang = () => React.useContext(LangCtx);

function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = window.localStorage.getItem("tom-lang");
      if (saved && STRINGS[saved]) return saved;
      const browser = (navigator.language || "en").slice(0, 2);
      return STRINGS[browser] ? browser : "en";
    } catch { return "en"; }
  });
  const setLang = (code) => {
    setLangState(code);
    try { window.localStorage.setItem("tom-lang", code); } catch {}
  };
  const t = React.useCallback((key) => (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key, [lang]);
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

// Text codes rather than flag emojis, per the no keyboard emoji rule
function LanguageSelector() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.code === lang) || LANGS[0];
  return (
    <div style={{ position: "absolute", right: 16, bottom: 16, zIndex: 50 }}>
      {open && (
        <div style={{ position: "absolute", bottom: 42, right: 0, background: T.white, borderRadius: 14, boxShadow: "0 8px 24px rgba(42,27,74,.18)", border: `1px solid ${T.lilac}`, overflow: "hidden", minWidth: 132 }}>
          {LANGS.map((l) => (
            <button key={l.code} onClick={() => { setLang(l.code); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "10px 13px", border: "none", background: l.code === lang ? T.lilac : T.white, cursor: "pointer", ...nu(700, 13, l.code === lang ? T.royal : T.ink) }}>
              <span style={{ ...fr(700, 11, l.code === lang ? T.royal : T.soft), width: 22 }}>{l.short}</span>
              {l.name}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => setOpen((v) => !v)} aria-label="Change language"
        style={{ display: "flex", alignItems: "center", gap: 6, background: T.royal, border: "none", borderRadius: 999, padding: "8px 14px", cursor: "pointer", boxShadow: "0 4px 12px rgba(91,33,182,.28)" }}>
        <Ic.Globe s={15} c={T.white} />
        <span style={fr(600, 13, T.white)}>{current.short}</span>
      </button>
    </div>
  );
}

function Home({ onPick, onLegal }) {
  const { t } = useLang();
  return (
    <div style={{ flex: 1, background: T.white, display: "flex", flexDirection: "column", padding: "0 28px 26px", textAlign: "center", position: "relative" }}>
      <LanguageSelector />
      <div style={{ flex: 1.2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
        <h1 style={{ ...fr(700, 68, T.royal), margin: 0, lineHeight: 1, letterSpacing: "2px" }}>
          TOM<span style={{ color: T.sun }}>.</span>
        </h1>
        <p style={{ ...nu(800, 15, T.soft), margin: "12px 0 0", letterSpacing: "4px" }}>{t("tagline")}</p>
        <p style={{ ...fr(600, 23, T.royal), margin: "30px 0 0" }}>{t("hook")}</p>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={() => onPick("signup")} style={{ ...fr(600, 18, T.white), background: T.royal, border: "none", borderRadius: 16, padding: "16px 0", cursor: "pointer", boxShadow: "0 6px 16px rgba(91,33,182,.25)" }}>
          {t("signUp")}
        </button>
        <button onClick={() => onPick("signin")} style={{ ...fr(600, 18, T.royal), background: T.white, border: `2px solid ${T.royal}`, borderRadius: 16, padding: "14px 0", cursor: "pointer" }}>
          {t("logIn")}
        </button>
        <button onClick={() => onPick("guest")} style={{ ...fr(600, 16, T.royal), background: "none", border: "none", cursor: "pointer", padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          {t("guest")} <Ic.Chevron s={13} c={T.royal} />
        </button>
      </div>
      <p style={{ ...nu(600, 12, T.soft), margin: "14px 0 0", lineHeight: 1.6 }}>
        {t("agree")}<br />
        <button onClick={() => onLegal("terms")} style={{ ...nu(800, 12, T.soft), border: "none", background: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>{t("terms")}</button>&nbsp;&nbsp;{t("and")}&nbsp;&nbsp;<button onClick={() => onLegal("privacy")} style={{ ...nu(800, 12, T.soft), border: "none", background: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>{t("privacy")}</button>
      </p>
    </div>
  );
}

// Shown after someone clicks the reset link in their email. Supabase has
// already exchanged the link for a temporary session by this point, so all
// this screen has to do is collect and set the new password.
function ResetPasswordScreen({ onDone }) {
  const { t } = useLang();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (password !== confirm) { setError(t("passwordsDontMatch")); return; }
    setBusy(true);
    const r = await api.setNewPassword(password);
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    onDone(r.signedIn ? (r.complete ? "main" : "builder") : "welcome");
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "10px 24px 24px" }}>
      <div style={{ textAlign: "center", margin: "16px 0 20px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Ic.ShieldCheck s={54} c={T.royal} /></div>
        <h2 style={{ ...fr(700, 25, T.ink), margin: 0 }}>{t("chooseNewPassword")}</h2>
        <p style={{ ...nu(700, 14, T.royal), margin: "6px 0 0" }}>{t("chooseNewPasswordSub")}</p>
      </div>
      <Field label={t("newPassword")}>
        <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("pw8")} />
      </Field>
      <Field label={t("confirmPassword")}>
        <input style={inputStyle} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t("pw8")} />
      </Field>
      {error && <p style={{ ...nu(700, 13, T.red), margin: "0 0 12px" }}>{error}</p>}
      <PrimaryBtn disabled={busy || !password || !confirm} onClick={submit}>{busy ? t("pleaseWait") : t("savePassword")}</PrimaryBtn>
    </div>
  );
}

function Welcome({ onDone, initialMode }) {
  const { t } = useLang();
  const [mode, setMode] = useState(initialMode || "signup"); // signup | signin | forgot | sent
  const [form, setForm] = useState({ name: "", email: "", password: "", age: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async () => {
    setError(null);
    setBusy(true);
    if (mode === "forgot") {
      const r = await api.requestPasswordReset(form.email);
      setBusy(false);
      if (r.error) setError(r.error); else setMode("sent");
      return;
    }
    if (mode === "signup") {
      const r = await api.signup(form);
      setBusy(false);
      if (r.error) setError(r.error); else onDone("builder");
    } else {
      const r = await api.login(form);
      setBusy(false);
      if (r.error) setError(r.error); else onDone(r.complete ? "main" : "builder");
    }
  };

  // Confirmation that the email is on its way. Deliberately does not say
  // whether the address had an account, so nobody can probe for members.
  if (mode === "sent") {
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 24px 24px" }}>
        <div style={{ textAlign: "center", margin: "16px 0 20px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Ic.Bubble s={54} c={T.royal} /></div>
          <h2 style={{ ...fr(700, 24, T.ink), margin: 0 }}>{t("checkYourEmail")}</h2>
          <p style={{ ...nu(600, 14, T.soft), margin: "10px 0 0", lineHeight: 1.5 }}>
            {t("resetSentBody").replace("{email}", (form.email || "").trim().toLowerCase())}
          </p>
          <p style={{ ...nu(600, 12.5, T.soft), margin: "12px 0 0" }}>{t("resetSpamHint")}</p>
        </div>
        <PrimaryBtn onClick={() => { setMode("signin"); setError(null); }}>{t("backToSignIn")}</PrimaryBtn>
        <button onClick={() => { setMode("forgot"); setError(null); }}
          style={{ width: "100%", marginTop: 12, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13.5, T.royal) }}>
          {t("resendReset")}
        </button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "10px 24px 24px" }}>
      <div style={{ textAlign: "center", margin: "16px 0 20px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><ZeroStamp size={70} /></div>
        <h2 style={{ ...fr(700, 26, T.ink), margin: 0 }}>
          {mode === "forgot" ? t("forgotTitle") : mode === "signup" ? t("datingCosts") : t("welcomeBack")}
        </h2>
        <p style={{ ...nu(700, 15, T.royal), margin: "6px 0 0" }}>
          {mode === "forgot" ? t("forgotSub") : mode === "signup" ? t("datingCostsSub") : t("timeWaiting")}
        </p>
      </div>
      {mode === "signup" && <Field label={t("yourName")}><input style={inputStyle} value={form.name} onChange={set("name")} placeholder={t("namePlaceholder")} /></Field>}
      <Field label={t("emailLabel")}><input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" /></Field>
      {mode !== "forgot" && <Field label={t("passwordLabel")}><input style={inputStyle} type="password" value={form.password} onChange={set("password")} placeholder={mode === "signup" ? t("pw8") : t("yourPassword")} /></Field>}
      {mode === "signup" && <Field label={t("ageLabel")}><input style={inputStyle} type="number" value={form.age} onChange={set("age")} placeholder="18+" /></Field>}
      {error && <p style={{ ...nu(700, 13, T.red), margin: "0 0 12px" }}>{error}</p>}
      <PrimaryBtn disabled={busy} onClick={submit}>{busy ? t("pleaseWait") : (mode === "forgot" ? t("sendResetLink") : mode === "signup" ? t("createAccount") : t("signIn"))}</PrimaryBtn>
      {mode === "signin" && (
        <button onClick={() => { setMode("forgot"); setError(null); }}
          style={{ width: "100%", marginTop: 12, padding: "8px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>
          {t("forgotPassword")}
        </button>
      )}
      <button onClick={() => { setMode(mode === "signup" ? "signin" : mode === "forgot" ? "signin" : "signup"); setError(null); }}
        style={{ width: "100%", marginTop: mode === "signin" ? 2 : 12, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13.5, T.royal) }}>
        {mode === "forgot" ? t("backToSignIn") : mode === "signup" ? t("alreadyOnTom") : t("newHere")}
      </button>
      <p style={{ ...nu(600, 11.5, T.soft), textAlign: "center", marginTop: 8 }}>{t("publicPlaces")}</p>
    </div>
  );
}

function Builder({ onDone, editMode }) {
  const { t } = useLang();
  const L = useLabel();
  const [step, setStep] = useState(0);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [photoError, setPhotoError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const handleFiles = async (files, asProfile) => {
    setPhotoError(null);
    for (const file of Array.from(files)) {
      const err = api.validatePhoto(file);
      if (err) { setPhotoError(err); continue; }
      if (!asProfile && u.photos.length >= MAX_PHOTOS) {
        setPhotoError(`Gallery is full (max ${MAX_PHOTOS} photos). Delete one first.`);
        break;
      }
      setUploading(true);
      const up = await api.uploadPhoto(file);
      setUploading(false);
      if (up.error) { setPhotoError(up.error); continue; }
      if (asProfile) { u.profilePhoto = up.url; }
      else {
        const r = api.addGalleryPhoto(up.url);
        if (r.error) setPhotoError(r.error);
      }
      rerender();
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
      <h3 style={{ ...fr(600, 21, T.ink), margin: "0 0 4px" }}>{t("showYourFace")}</h3>
      <p style={{ ...nu(600, 13.5, T.soft), margin: "0 0 16px" }}>{t("photoFormats")}</p>
      <Field label={t("profilePicture")}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {u.profilePhoto ? <PhotoThumb src={u.profilePhoto} size={84} round /> : (
            <div style={{ width: 84, height: 84, borderRadius: "50%", background: T.lilac, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Person s={34} c={T.royal} /></div>
          )}
          <label style={{ ...nu(800, 13, T.royal), background: T.lilac, borderRadius: 999, padding: "10px 16px", cursor: "pointer" }}>
            {u.profilePhoto ? t("changePhoto") : t("uploadPhoto")}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files, true)} />
          </label>
        </div>
      </Field>
      <Field label={`${t("galleryLabel")} ${u.photos.length}/${MAX_PHOTOS}`}>
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
      {uploading && <p style={{ ...nu(700, 13, T.royal), margin: 0 }}>Uploading photo...</p>}
      {photoError && <p style={{ ...nu(700, 13, T.red), margin: 0 }}>{photoError}</p>}
    </div>,

    // ---- Step 2: about you ----
    <div key="a">
      <h3 style={{ ...fr(600, 21, T.ink), margin: "0 0 16px" }}>{t("aboutYou")}</h3>
      <Field label={t("heightLabel")}>
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
      <Field label={t("cityLabel")}><input style={inputStyle} placeholder={t("cityPlaceholder")} value={u.city} onChange={(e) => { u.city = e.target.value; rerender(); }} /></Field>
      <Field label={t("iAmA")}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{GENDERS.map(([v, l]) => <Chip key={v} label={L(l)} active={u.gender === v} onClick={() => { u.gender = v; rerender(); }} />)}</div></Field>
      <Field label={t("orientationLabel")}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{ORIENTATIONS.map(([v, l]) => <Chip key={v} label={L(l)} active={u.orientation === v} onClick={() => { u.orientation = v; rerender(); }} />)}</div></Field>
      <Field label={t("showMe")}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{INTERESTED_IN.map(([v, l]) => <Chip key={v} label={L(l)} active={u.interestedIn === v} onClick={() => { u.interestedIn = v; rerender(); }} />)}</div></Field>
      <Field label={t("myHours")}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{CHRONO.map(([v, l]) => <Chip key={v} label={L(l)} active={u.chronotype === v} onClick={() => { u.chronotype = v; rerender(); }} />)}</div></Field>
      <Field label={t("whenFree")}>
        <p style={{ ...nu(600, 12.5, T.soft), margin: "0 0 8px" }}>{t("whenFreeSub")}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {AVAIL_SLOTS.map(([v, l]) => (
            <Chip key={v} label={L(l)} active={(u.availability || []).includes(v)} onClick={() => {
              const arr = u.availability || [];
              u.availability = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
              rerender();
            }} />
          ))}
        </div>
      </Field>
      <Field label={t("openToDoubles")}>
        <p style={{ ...nu(600, 12.5, T.soft), margin: "0 0 8px" }}>{t("openToDoublesSub")}</p>
        <ToggleRow on={Boolean(u.openToDoubles)} onToggle={() => { u.openToDoubles = !u.openToDoubles; rerender(); }} label={t("openToDoubles")} icon="Users" />
      </Field>
    </div>,

    // ---- Step 3: what you love ----
    <div key="t">
      <h3 style={{ ...fr(600, 21, T.ink), margin: "0 0 16px" }}>{t("whatYouLove")}</h3>
      <Field label={t("freeDatesUpFor")}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{ACTIVITY_POOL.map((a) => <Chip key={a} label={L(a)} active={u.thingsILikeToDo.includes(a)} onClick={() => toggle("thingsILikeToDo", a)} />)}</div></Field>
      <Field label={t("interestsLabel")}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{INTEREST_POOL.map((a) => <Chip key={a} label={L(a)} active={u.interests.includes(a)} onClick={() => toggle("interests", a)} />)}</div></Field>
      <Field label={t("hobbiesLabel")}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{HOBBY_POOL.map((a) => <Chip key={a} label={L(a)} active={u.hobbies.includes(a)} onClick={() => toggle("hobbies", a)} />)}</div></Field>
    </div>,

    // ---- Step 4: bio ----
    <div key="b">
      <h3 style={{ ...fr(600, 21, T.ink), margin: "0 0 4px" }}>{t("lastOneBio")}</h3>
      <p style={{ ...nu(600, 13.5, T.soft), margin: "0 0 14px" }}>{t("bioHint")}</p>
      <textarea rows={5} maxLength={600} placeholder={t("bioPlaceholder")} value={u.bio} onChange={(e) => { u.bio = e.target.value; rerender(); }} style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }} />
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
          <button onClick={() => setStep(step - 1)} style={{ padding: "14px 18px", borderRadius: 16, border: `2px solid ${T.lilacDeep}`, background: T.white, ...fr(600, 15, T.royal), cursor: "pointer" }}>{t("back")}</button>
        )}
        <div style={{ flex: 1 }}>
          <PrimaryBtn disabled={!canNext || saving || uploading} onClick={async () => {
            if (step < 3) { setStep(step + 1); return; }
            setSaving(true);
            const r = await api.saveProfile();
            setSaving(false);
            if (r.error) { setPhotoError(r.error); return; }
            onDone();
          }}>
            {saving ? t("saving") : (step < 3 ? t("continueBtn") : (editMode ? t("saveChanges") : t("startSpending")))}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

// Clock with a sweeping hand, shown while the deck loads
function SearchClock({ size = 68 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="42" fill={T.lilac} />
      <circle cx="50" cy="50" r="42" fill="none" stroke={T.royal} strokeWidth="5" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
        const a = (i * 30 * Math.PI) / 180;
        const long = i % 3 === 0;
        const r1 = long ? 29 : 32;
        return (
          <line key={i}
            x1={50 + r1 * Math.sin(a)} y1={50 - r1 * Math.cos(a)}
            x2={50 + 36 * Math.sin(a)} y2={50 - 36 * Math.cos(a)}
            stroke={T.royal} strokeWidth={long ? 3.5 : 2} strokeLinecap="round" opacity={long ? 0.9 : 0.45} />
        );
      })}
      {/* hour hand ticks forward slowly, minute hand sweeps */}
      <g>
        <line x1="50" y1="50" x2="50" y2="32" stroke={T.royal} strokeWidth="4.5" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="8s" repeatCount="indefinite" />
        </line>
      </g>
      <g>
        <line x1="50" y1="50" x2="50" y2="24" stroke={T.sun} strokeWidth="3.5" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="1.6s" repeatCount="indefinite" />
        </line>
      </g>
      <circle cx="50" cy="50" r="4.5" fill={T.royal} />
    </svg>
  );
}

function Discover({ deck, onSwipe, myLoc, onGolden, goldenLeft, likesLeft, isPlus, onUpgrade, onReport, locDenied, loading, onPrimeTime, onUndo, canUndo, admirerCount = 0, onAdmirers, onTimeZones, onInvite, onFilters }) {
  const { t } = useLang();
  const [viewing, setViewing] = useState(null);
  const outOfLikes = !isPlus && likesLeft !== undefined && likesLeft <= 0;

  // The top strip always renders, whatever state the deck is in, so the
  // Prime Time chip never disappears behind an empty deck.
  const strip = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 8 }}>
      <div style={{ ...nu(800, 10.5, T.soft), letterSpacing: ".6px", display: "flex", alignItems: "center", gap: 5 }}>
        <Ic.Pin s={11} c={T.soft} />{t("closest")} · <Ic.Spark s={11} c={T.sun} />{t("mostInCommon")}
      </div>
      <button onClick={onPrimeTime} aria-label={t("primeTime")} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", borderRadius: 999, padding: "5px 10px", background: T.sun, cursor: "pointer", whiteSpace: "nowrap", ...nu(800, 10.5, T.ink), letterSpacing: ".4px" }}>
        <Ic.Rise s={12} c={T.ink} />{t("primeTime")}
      </button>
    </div>
  );

  const banner = locDenied ? (
    <div style={{ background: "#FFF4D6", borderRadius: 14, padding: "9px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 7, ...nu(700, 12, "#8A6400") }}>
      <Ic.Pin s={13} c="#8A6400" />
      {t("locationOff")}
    </div>
  ) : null;

  // Points people at the filters button when the deck runs dry
  const tuneHint = (
    <button onClick={onFilters} style={{ background: T.lilac, border: "none", borderRadius: 14, padding: "11px 13px", display: "flex", alignItems: "center", gap: 8, textAlign: "left", maxWidth: 300, cursor: "pointer", width: "100%", justifyContent: "center" }}>
      <Ic.Sliders s={18} c={T.royal} />
      <span style={{ ...nu(700, 12.5, T.royal) }}>{t("tuneHint")}</span>
    </button>
  );

  let body;
  if (outOfLikes) {
    body = (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
        <Ic.Hourglass s={54} c={T.royal} />
        <h2 style={{ ...fr(600, 22, T.ink), margin: 0 }}>{t("outOfLikes")}</h2>
        <p style={{ ...nu(600, 14, T.soft), margin: 0 }}>{t("likesReset")}</p>
        <div style={{ width: "100%", maxWidth: 240, marginTop: 6 }}>
          <PrimaryBtn onClick={onUpgrade}>{t("getUnlimited")}</PrimaryBtn>
        </div>
      </div>
    );
  } else if (loading) {
    body = (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
        <SearchClock />
        <p style={{ ...nu(700, 14, T.soft), margin: 0 }}>{t("findingPeople")}</p>
      </div>
    );
  } else if (deck.length === 0) {
    body = (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
        <Ic.Hourglass s={54} c={T.royal} />
        <h2 style={{ ...fr(600, 22, T.ink), margin: 0 }}>{t("seenEveryone")}</h2>
        <p style={{ ...nu(600, 14, T.soft), margin: 0 }}>{t("newPeopleDaily")}</p>
        {admirerCount > 0 && (
          <button onClick={onAdmirers} style={{ background: T.sun, border: "none", borderRadius: 14, padding: "11px 13px", display: "flex", alignItems: "center", gap: 8, textAlign: "left", maxWidth: 300, width: "100%", cursor: "pointer", boxShadow: "0 4px 14px rgba(255,197,61,.45)" }}>
            <Ic.Eye s={18} c={T.ink} />
            <span style={{ ...nu(700, 12.5, T.ink) }}>{admirerCount === 1 ? t("emptyAdmirersOne") : t("emptyAdmirers").replace("{n}", admirerCount)}</span>
          </button>
        )}
        <button onClick={onTimeZones} style={{ background: T.royal, border: "none", borderRadius: 14, padding: "11px 13px", display: "flex", alignItems: "center", gap: 8, textAlign: "left", maxWidth: 300, width: "100%", cursor: "pointer" }}>
          <Ic.Globe s={18} c={T.white} />
          <span style={{ ...nu(700, 12.5, T.white) }}>{t("emptyTimeZones")}</span>
        </button>
        {tuneHint}
        <button onClick={onInvite} style={{ background: T.white, border: `2px solid ${T.lilacDeep}`, borderRadius: 14, padding: "11px 13px", display: "flex", alignItems: "center", gap: 8, textAlign: "left", maxWidth: 300, width: "100%", cursor: "pointer" }}>
          <Ic.Heart s={18} c={T.royal} />
          <span style={{ ...nu(700, 12.5, T.royal) }}>{t("emptyInvite")}</span>
        </button>
      </div>
    );
  } else {
    body = (
      <>
        <div style={{ position: "relative", flex: 1, marginBottom: 12 }}>
          {deck.slice(0, 2).map((p, i) => <Card key={p.id} profile={p} isTop={i === 0} onSwipe={onSwipe} myLoc={myLoc} onReport={onReport} onView={setViewing} />).reverse()}
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 16, padding: "4px 0 12px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <button onClick={onUndo} disabled={!canUndo} aria-label={t("undo")} style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: canUndo ? T.white : "rgba(255,255,255,.5)", cursor: canUndo ? "pointer" : "default", boxShadow: canUndo ? "0 4px 12px rgba(42,27,74,.14)" : "none", display: "flex", alignItems: "center", justifyContent: "center", opacity: canUndo ? 1 : 0.45 }}>
              <Ic.Undo s={19} c={T.royal} />
            </button>
            <span style={{ ...nu(800, 10, T.soft), letterSpacing: ".4px" }}>{t("undo")}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <button onClick={() => onSwipe("left")} aria-label={t("pass")} style={{ width: 56, height: 56, borderRadius: "50%", border: "none", background: T.white, cursor: "pointer", boxShadow: "0 6px 16px rgba(42,27,74,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Cross s={20} c={T.ink} /></button>
            <span style={{ ...nu(800, 10.5, T.soft), letterSpacing: ".4px" }}>{t("pass")}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <button onClick={onGolden} aria-label={t("goldenHour")} style={{ position: "relative", width: 50, height: 50, borderRadius: "50%", border: "none", background: T.sun, cursor: "pointer", boxShadow: "0 6px 16px rgba(255,197,61,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ic.Sun s={24} c={T.white} />
              <span style={{ position: "absolute", top: -4, right: -4, background: T.royal, color: T.white, borderRadius: 999, minWidth: 18, height: 18, ...nu(800, 11, T.white), display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{goldenLeft}</span>
            </button>
            <span style={{ ...nu(800, 10.5, "#B8860B"), letterSpacing: ".4px" }}>{t("goldenHour")}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <button onClick={() => onSwipe("right")} aria-label={t("spendTime")} style={{ width: 64, height: 64, borderRadius: "50%", border: "none", background: T.royal, cursor: "pointer", boxShadow: "0 6px 18px rgba(91,33,182,.4)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Hourglass s={26} c={T.white} /></button>
            <span style={{ ...nu(800, 10.5, T.royal), letterSpacing: ".4px" }}>{t("spendTime")}</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "6px 16px 0" }}>
      {strip}
      {banner}
      {body}
      {viewing && (
        <ProfileDetailModal
          profile={viewing}
          myLoc={myLoc}
          onClose={() => setViewing(null)}
          onSwipe={(dir) => { setViewing(null); onSwipe(dir); }}
        />
      )}
    </div>
  );
}

function MatchModal({ profile, onClose, myLoc, onMessage }) {
  const [idea, setIdea] = useState(null);
  const [sending, setSending] = useState(false);
  const go = async () => {
    if (!idea || !profile.matchId) { onClose(); return; }
    setSending(true);
    await api.sendMessage(profile.matchId, `How about this for a free first date: ${idea}?`);
    setSending(false);
    onClose();
    if (onMessage) onMessage(profile);
  };
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: T.white, borderRadius: 26, padding: "26px 22px 22px", width: "100%", maxWidth: 320, textAlign: "center", animation: "popIn .35s ease", boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><ZeroStamp size={64} /></div>
        <h2 style={{ ...fr(700, 27, T.royal), margin: "0 0 4px" }}>Time well matched!</h2>
        <p style={{ ...nu(700, 14, T.ink), margin: "0 0 6px" }}>You and {profile.name} both chose time over money.</p>
        <p style={{ ...nu(800, 13, T.royal), margin: "0 0 14px", background: T.lilac, borderRadius: 999, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}><Ic.Pin s={12} c={T.royal} />{haversineKm(myLoc, profile.loc) === null ? "Distance unavailable" : `You're ${distLabel(myLoc, profile)} apart`}</p>
        <p style={{ ...nu(800, 12, T.soft), margin: "0 0 8px", letterSpacing: ".5px", textTransform: "uppercase" }}>Suggest a free first date (public places only)</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18, maxHeight: 190, overflowY: "auto" }}>
          {DATE_IDEAS.map((s) => (
            <button key={s} onClick={() => setIdea(s)} style={{ ...nu(700, 13.5, idea === s ? T.royal : T.ink), padding: "11px 12px", borderRadius: 14, cursor: "pointer", border: `2px solid ${idea === s ? T.royal : T.lilacDeep}`, background: idea === s ? T.lilac : T.white, textAlign: "left" }}>{s}</button>
          ))}
        </div>
        <PrimaryBtn disabled={sending} onClick={go}>{sending ? "Sending..." : (idea ? "Send this idea" : "Keep swiping")}</PrimaryBtn>
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
        <p style={{ ...nu(700, 12.5, T.soft), margin: "0 0 18px" }}>{goldenLeft > 0 ? `You have ${goldenLeft} left today.` : "You're out for today."}</p>
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
            <PrimaryBtn onClick={() => onConfirm(reason)}>Done</PrimaryBtn>
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

function Chat({ profile, onBack, onDateCompleted, myLoc, isPlus = false, onReport }) {
  const { t } = useLang();
  const ideaText = useIdeaText();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [plan, setPlan] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [planDraft, setPlanDraft] = useState("");
  const [planDate, setPlanDate] = useState("");
  const [planTime, setPlanTime] = useState("");
  const [ideaPicker, setIdeaPicker] = useState(false);
  const [ideaCat, setIdeaCat] = useState("all");
  const [planDouble, setPlanDouble] = useState(false);
  const [viewing, setViewing] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const myId = api.user && api.user.id;

  const refresh = React.useCallback(async () => {
    if (!profile.matchId) { setLoading(false); return; }
    const [rows, p] = await Promise.all([
      api.loadMessages(profile.matchId),
      api.getPlannedDate(profile.matchId),
    ]);
    setMessages(rows);
    setPlan(p && p.status !== "completed" ? p : null);
    setLoading(false);
  }, [profile.matchId]);

  React.useEffect(() => { refresh(); }, [refresh]);

  // Light polling so both sides see new messages without a refresh.
  React.useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  React.useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Accepts optional preset text (mission Accept/Decline/Counter buttons).
  // onClick handlers pass a MouseEvent, so only a real string counts as an
  // override. Everything else falls back to the draft box.
  const send = async (overrideText) => {
    const text = (typeof overrideText === "string" ? overrideText : draft).trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const r = await api.sendMessage(profile.matchId, text);
    setSending(false);
    if (r.error) { setError(r.error); return; }
    if (typeof overrideText !== "string") setDraft("");
    setMessages((m) => [...m, r.message]);
  };

  const propose = async () => {
    const idea = planDraft.trim();
    if (!idea) return;
    // Combine the pickers into a real timestamp in the user's own timezone
    let scheduledAt = null;
    if (planDate && planTime) {
      const local = new Date(`${planDate}T${planTime}`);
      if (!isNaN(local.getTime())) scheduledAt = local.toISOString();
    }
    const r = await api.proposeDate(profile.matchId, idea, scheduledAt, planDouble);
    if (r.ok) {
      setPlan(r.date);
      setPlanning(false);
      setPlanDate(""); setPlanTime(""); setPlanDouble(false);
      const when = scheduledAt ? ` (${whenLabel(scheduledAt)})` : "";
      await api.sendMessage(profile.matchId, `Date proposal: ${idea}${when}`);
      refresh();
    }
  };

  const confirmPlan = async () => {
    const r = await api.confirmDate(plan.id);
    if (r.ok) setPlan({ ...plan, status: "confirmed" });
  };

  const completePlan = async () => {
    const r = await api.completeDate(plan.id);
    if (r.ok) {
      const both = r.result && r.result.status === "completed";
      setPlan(null);
      // Only prompt for a review once BOTH people have confirmed they met
      if (both && onDateCompleted) onDateCompleted();
      refresh();
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${T.lilacDeep}` }}>
        <button onClick={onBack} aria-label="Back" style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "inline-flex" }}>
          <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><Ic.Chevron s={18} c={T.royal} /></span>
        </button>
        <button onClick={() => setViewing(profile)} aria-label={`View ${profile.name}'s profile`} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, border: "none", background: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
          {profile.photo ? <PhotoThumb src={profile.photo} size={34} round /> : (
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg, ${profile.grad[0]}, ${profile.grad[1]})`, display: "flex", alignItems: "center", justifyContent: "center", ...fr(700, 14, T.white) }}>{profile.name[0]}</div>
          )}
          <div style={{ ...fr(600, 16, T.ink), flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.name}</div>
        </button>
        {!plan && profile.matchId && (
          <button onClick={() => { setPlanDraft(profile.idea || ""); setPlanning(true); }} style={{ border: "none", borderRadius: 999, padding: "7px 12px", background: T.lilac, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, ...fr(600, 12, T.royal) }}>
          <Ic.Hourglass s={13} c={T.royal} />{t("planADate")}
          </button>
        )}
      </div>
      <PlanBanner plan={plan} myId={myId} profileName={profile.name} onConfirm={confirmPlan} onComplete={completePlan} />
      {planning && (
        <div style={{ margin: "10px 16px 0", background: T.white, border: `2px solid ${T.lilacDeep}`, borderRadius: 16, padding: "11px 13px" }}>
          <div style={{ ...nu(800, 10.5, T.soft), letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 6 }}>{t("proposeADate")}</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input value={planDraft} onChange={(e) => setPlanDraft(e.target.value)} placeholder={t("whatsThePlan")} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => setIdeaPicker((v) => !v)} style={{ border: `2px solid ${ideaPicker ? T.royal : T.lilacDeep}`, borderRadius: 14, padding: "0 12px", background: ideaPicker ? T.lilac : T.white, cursor: "pointer", whiteSpace: "nowrap", ...fr(600, 12.5, T.royal) }}>
              {t("ideas")}
            </button>
          </div>
          {ideaPicker && (
            <div style={{ border: `2px solid ${T.lilacDeep}`, borderRadius: 14, padding: 10, marginBottom: 8, background: "#FBFAFE" }}>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
                <button onClick={() => setIdeaCat("all")} style={{ whiteSpace: "nowrap", padding: "5px 10px", borderRadius: 999, border: `2px solid ${ideaCat === "all" ? T.royal : T.lilacDeep}`, background: ideaCat === "all" ? T.royal : T.white, cursor: "pointer", ...nu(700, 11.5, ideaCat === "all" ? T.white : T.royal) }}>All {ALL_IDEAS.length}</button>
                {MISSIONS.map((m) => {
                  const on = ideaCat === m.id;
                  const MIcon = Ic[m.icon];
                  return (
                    <button key={m.id} onClick={() => setIdeaCat(m.id)} style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", padding: "5px 10px", borderRadius: 999, border: `2px solid ${on ? T.royal : T.lilacDeep}`, background: on ? T.royal : T.white, cursor: "pointer", ...nu(700, 11.5, on ? T.white : T.royal) }}>
                      <MIcon s={12} c={on ? T.white : T.royal} />{m.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ maxHeight: 168, overflowY: "auto" }}>
                {ALL_IDEAS.filter((i) => ideaCat === "all" || i.cat === ideaCat).map((i) => (
                  <button key={i.idea} onClick={() => { setPlanDraft(ideaText(i.idea)); setIdeaPicker(false); }} style={{ display: "block", width: "100%", textAlign: "left", background: T.white, border: `1px solid ${T.lilac}`, borderRadius: 10, padding: "8px 10px", marginBottom: 5, cursor: "pointer", ...nu(600, 12.5, T.ink) }}>
                    {ideaText(i.idea)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} style={{ ...inputStyle, flex: 1.3 }} />
            <input type="time" value={planTime} onChange={(e) => setPlanTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          </div>
          <div style={{ ...nu(700, 11, T.soft), marginBottom: 8 }}>{t("timeHint")}</div>
          <div style={{ marginBottom: 8 }}>
            <ToggleRow on={planDouble} onToggle={() => setPlanDouble((v) => !v)} label={t("doubleDate")} icon="Users" />
            <div style={{ ...nu(600, 11, T.soft), margin: "5px 2px 0" }}>{t("doubleDateSub")}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={propose} style={{ flex: 1, border: "none", borderRadius: 999, padding: "9px 0", background: T.royal, cursor: "pointer", ...fr(600, 13, T.white) }}>{t("propose")}</button>
            <button onClick={() => setPlanning(false)} style={{ flex: 1, border: `2px solid ${T.lilacDeep}`, borderRadius: 999, padding: "9px 0", background: T.white, cursor: "pointer", ...fr(600, 13, T.soft) }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <p style={{ ...nu(600, 13, T.soft), textAlign: "center" }}>Loading...</p>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <Ic.Hourglass s={40} c={T.royal} />
            <p style={{ ...fr(600, 16, T.ink), margin: "10px 0 4px" }}>You matched with {profile.name}</p>
            <p style={{ ...nu(600, 13, T.soft), margin: 0 }}>Say hi and plan something free.</p>
          </div>
        ) : messages.map((m, i) => {
          const mine = m.sender_id === myId;
          const lastMine = mine && !messages.slice(i + 1).some((x) => x.sender_id === myId);
          const showReceipt = isPlus && lastMine && Boolean(m.read_at);
          
          // Detect mission date ideas in messages
          const isMissionIdea = m.body && m.body.startsWith("Mission Date idea: ");
          const missionIdea = isMissionIdea ? m.body.replace("Mission Date idea: ", "") : null;
          
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "85%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
              {isMissionIdea ? (
                // Mission idea card. The receiver gets action buttons; the
                // sender sees the same card so the thread reads consistently.
                <div style={{ background: T.lilac, borderRadius: 16, padding: "12px 13px", marginBottom: 8, border: `2px solid ${T.lilacDeep}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                    <Ic.Compass s={13} c={T.royal} />
                    <span style={{ ...nu(800, 11, T.royal), letterSpacing: .4, textTransform: "uppercase" }}>
                      {mine ? t("youSentMissionDate") : `${profile.name} ${t("sentMissionDate")}`}
                    </span>
                  </div>
                  <p style={{ ...nu(700, 14, T.ink), margin: mine ? 0 : "0 0 10px" }}>{missionIdea}</p>
                  {!mine && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => send(`I'm in. Let's do: ${missionIdea}`)} disabled={sending} style={{ flex: 1, minWidth: 70, padding: "7px 10px", borderRadius: 8, border: "none", background: T.royal, ...nu(700, 12, T.white), cursor: sending ? "default" : "pointer" }}>{t("accept")}</button>
                      <button onClick={() => send("Not that one, but keep them coming.")} disabled={sending} style={{ flex: 1, minWidth: 70, padding: "7px 10px", borderRadius: 8, border: "none", background: T.soft, ...nu(700, 12, T.ink), cursor: sending ? "default" : "pointer" }}>{t("decline")}</button>
                      <button onClick={() => { setDraft("How about this instead: "); if (inputRef.current) inputRef.current.focus(); }} disabled={sending} style={{ flex: 1, minWidth: 70, padding: "7px 10px", borderRadius: 8, border: "none", background: T.lilacDeep, ...nu(700, 12, T.royal), cursor: sending ? "default" : "pointer" }}>{t("counter")}</button>
                    </div>
                  )}
                </div>
              ) : (
                // Regular message
                <div style={{ background: mine ? T.royal : T.lilac, color: mine ? T.white : T.ink, borderRadius: 16, padding: "9px 13px", ...nu(600, 14, mine ? T.white : T.ink) }}>
                  {m.body}
                </div>
              )}
              {showReceipt && <span style={{ ...nu(700, 10.5, T.soft), marginTop: 3 }}>{t("readReceipt")}</span>}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <p style={{ ...nu(700, 12.5, T.red), margin: "0 16px 6px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 14px", borderTop: `1px solid ${T.lilacDeep}` }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Message"
          style={{ flex: 1, padding: "11px 14px", borderRadius: 999, border: `2px solid ${T.lilacDeep}`, outline: "none", ...nu(600, 14, T.ink) }}
        />
        <button onClick={send} disabled={sending || !draft.trim()} style={{ padding: "0 18px", borderRadius: 999, border: "none", cursor: draft.trim() ? "pointer" : "default", background: draft.trim() ? T.royal : T.lilacDeep, ...nu(800, 13.5, T.white) }}>
          {sending ? "..." : "Send"}
        </button>
      </div>
      {viewing && (
        <ProfileDetailModal
          profile={viewing}
          myLoc={myLoc}
          onClose={() => setViewing(null)}
          onReport={onReport ? (p) => { setViewing(null); onReport(p); } : undefined}
        />
      )}
    </div>
  );
}

// How TOM works. A gold spark travels down a deep purple card, and each
// phrase lights up as the spark reaches it. Meant to feel like a moment,
// not a checklist.
const ROADMAP = ["roadmap1", "roadmap2", "roadmap3", "roadmap4", "roadmap5"];
const SEG_T = 0.34;   // one line segment drawing
const WORD_T = 0.34;  // one phrase lighting up
const STEP = SEG_T + WORD_T;
const LEAD = 0.3;

function Roadmap({ label }) {
  const { t } = useLang();
  const endAt = LEAD + ROADMAP.length * STEP;

  const seg = (delay) => (
    <span style={{
      display: "block", width: 2, height: 24, margin: "0 auto", borderRadius: 2,
      background: `linear-gradient(180deg, ${T.sun}, rgba(255,197,61,.45))`,
      transformOrigin: "top center",
      animation: `tomSeg ${SEG_T}s linear ${delay}s both`,
    }} />
  );

  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: `linear-gradient(155deg, ${T.royal} 0%, ${T.violet} 58%, #8B5CF6 100%)`,
      borderRadius: 28, padding: "26px 20px 28px", margin: "6px 0 12px",
      textAlign: "center", boxShadow: "0 14px 34px rgba(91,33,182,.32)",
    }}>
      <style>{`
        @keyframes tomSeg { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        @keyframes tomWordIn {
          0%   { opacity: 0; transform: translateY(6px) scale(.96); filter: blur(3px) }
          60%  { opacity: 1; filter: blur(0) }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0) }
        }
        @keyframes tomFlare {
          0%   { opacity: 0; transform: scale(.3) }
          40%  { opacity: 1; transform: scale(1.5) }
          100% { opacity: 0; transform: scale(2.6) }
        }
        @keyframes tomHeartBeat {
          0%, 100% { transform: scale(1) }
          14%      { transform: scale(1.2) }
          28%      { transform: scale(1) }
          42%      { transform: scale(1.12) }
          56%      { transform: scale(1) }
        }
        @keyframes tomShimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }
        @keyframes tomGlowOrb {
          0%, 100% { opacity: .28; transform: scale(1) }
          50%      { opacity: .5; transform: scale(1.12) }
        }
      `}</style>

      {/* soft light behind the heart */}
      <span style={{
        position: "absolute", top: -46, left: "50%", marginLeft: -80,
        width: 160, height: 160, borderRadius: "50%", pointerEvents: "none",
        background: "radial-gradient(circle, rgba(255,197,61,.55) 0%, rgba(255,197,61,0) 70%)",
        animation: "tomGlowOrb 3s ease-in-out infinite",
      }} />

      <span style={{
        position: "relative", display: "inline-flex",
        animation: "tomHeartBeat 1.5s ease-in-out infinite", transformOrigin: "center",
        filter: "drop-shadow(0 4px 12px rgba(0,0,0,.28))",
      }}>
        <Ic.Heart s={46} c={T.white} />
      </span>

      {ROADMAP.map((key, i) => {
        const segDelay = LEAD + i * STEP;
        const wordDelay = segDelay + SEG_T;
        return (
          <div key={key} style={{ position: "relative" }}>
            {seg(segDelay)}
            <div style={{ position: "relative", padding: "4px 0" }}>
              {/* gold flare as the spark lands on the phrase */}
              <span style={{
                position: "absolute", left: "50%", top: "50%", width: 54, height: 54,
                marginLeft: -27, marginTop: -27, borderRadius: "50%", pointerEvents: "none",
                background: "radial-gradient(circle, rgba(255,197,61,.7) 0%, rgba(255,197,61,0) 70%)",
                animation: `tomFlare .7s ease ${wordDelay}s both`,
              }} />
              <span style={{
                position: "relative", ...fr(600, 17, T.white),
                textShadow: "0 2px 10px rgba(0,0,0,.22)",
                animation: `tomWordIn ${WORD_T + 0.16}s ease ${wordDelay}s both`,
                display: "inline-block",
              }}>{t(key)}</span>
            </div>
          </div>
        );
      })}

      {seg(endAt)}

      <div style={{
        marginTop: 8,
        ...nu(800, 12.5, T.white), letterSpacing: ".8px", textTransform: "uppercase",
        background: `linear-gradient(90deg, rgba(255,255,255,.55) 20%, ${T.sun} 50%, rgba(255,255,255,.55) 80%)`,
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text", backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        animation: `tomWordIn .4s ease ${endAt + SEG_T}s both, tomShimmer 2.6s linear ${endAt + SEG_T}s infinite`,
      }}>{label}</div>
    </div>
  );
}

function Matches({ matches, myLoc, admirerCount, onUpgrade, onReport, onOpenChat, loading, unreadBy = {}, matchesError = null, onRetry }) {
  const { t } = useLang();
  const [viewing, setViewing] = useState(null);
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "6px 16px 16px" }}>
      {admirerCount > 0 && (
      <button onClick={onUpgrade} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: `linear-gradient(135deg, ${T.royal}, ${T.violet})`, border: "none", borderRadius: 18, padding: 14, marginBottom: 12, cursor: "pointer", textAlign: "left" }}>
        <div style={{ display: "flex" }}>
          {["#B197F0", "#F0ABFC", "#67E8F9"].map((c, i) => (
            <div key={i} style={{ width: 34, height: 34, borderRadius: "50%", background: c, filter: "blur(4px)", marginLeft: i ? -10 : 0, border: `2px solid ${T.white}` }} />
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...nu(800, 14, T.white) }}>{admirerCount} {admirerCount === 1 ? t("personThinks") : t("peopleThink")}</div>
          <div style={{ ...nu(700, 12, "#D9CCF5") }}>{t("seeWhoLikes")}</div>
        </div>
      </button>
      )}
      {loading ? (
        <Roadmap label={t("loadingDates")} />
      ) : matchesError && matches.length === 0 ? (
        <div style={{ background: T.white, border: `2px solid ${T.lilacDeep}`, borderRadius: 18, padding: 20, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 8 }}>
          <Ic.Rain s={34} c={T.soft} />
          <div style={{ ...fr(600, 17, T.ink) }}>{t("connLoadFailed")}</div>
          <div style={{ ...nu(700, 12.5, T.soft) }}>{t("connLoadFailedBody")}</div>
          <button onClick={onRetry} style={{ marginTop: 4, border: "none", background: T.royal, borderRadius: 999, padding: "10px 20px", cursor: "pointer", ...nu(800, 13, T.white) }}>{t("retry")}</button>
        </div>
      ) : matches.length === 0 ? (
        <Roadmap label={t("noDatesYet")} />
      ) : (
        <>
          {matches.map((p) => {
            const u = unreadBy[p.id] || { unread: 0, action: false };
            const waiting = u.unread > 0 || u.action;
            return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, background: waiting ? "#F3EEFF" : T.white, borderRadius: 18, padding: 12, marginBottom: 10, boxShadow: waiting ? `0 4px 16px rgba(91,33,182,.18)` : "0 4px 14px rgba(42,27,74,.08)", border: waiting ? `2px solid ${T.violet}` : "2px solid transparent", animation: "floatUp .3s ease" }}>
              <button onClick={() => setViewing(p)} aria-label={`View ${p.name}'s profile`} style={{ position: "relative", border: "none", background: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
                <div style={{ width: 54, height: 54, borderRadius: "50%", background: p.photo ? `url(${p.photo}) center/cover no-repeat` : `linear-gradient(135deg, ${p.grad[0]}, ${p.grad[1]})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: waiting ? `0 0 0 3px ${T.violet}` : "none", ...fr(700, 22, T.white) }}>{p.photo ? "" : p.name[0]}</div>
                {u.unread > 0 && (
                  <span style={{ position: "absolute", top: -3, right: -3, minWidth: 21, height: 21, borderRadius: 999, background: T.red, border: `2px solid ${T.white}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", ...nu(800, 11.5, T.white) }}>{u.unread > 9 ? "9+" : u.unread}</span>
                )}
              </button>
              <button onClick={() => onOpenChat && onOpenChat(p)} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, border: "none", background: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={fr(waiting ? 700 : 600, 17, T.ink)}>{p.name} <span style={{ ...nu(700, 12, T.soft), display: "inline-flex", alignItems: "center", gap: 3 }}>· <Ic.Pin s={11} c={T.soft} />{distLabel(myLoc, p)}</span></div>
                  {p.freeTonight && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: T.lilac, borderRadius: 999, padding: "2px 8px", margin: "3px 0 1px", ...nu(800, 11, T.royal) }}>
                      <Ic.Moon s={11} c={T.royal} />{t("freeTonightBadge")}
                    </div>
                  )}
                  <div style={{ ...nu(waiting ? 800 : 700, 12.5, waiting ? T.violet : T.royal), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {u.unread > 0 ? (u.unread === 1 ? t("oneNewMessage") : t("newMessages").replace("{n}", u.unread)) : u.action ? t("planWaiting") : t("tapToMessage")}
                  </div>
                </div>
              </button>
              <button onClick={() => onReport(p)} aria-label="Block or report" style={{ border: `1.5px solid ${T.lilacDeep}`, background: T.white, borderRadius: 999, cursor: "pointer", padding: 7, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Flag s={17} c={T.soft} /></button>
              <span style={{ ...fr(700, 13, T.green), background: "#E8F8EF", borderRadius: 999, padding: "5px 10px" }}>$0</span>
            </div>
            );
          })}
        </>
      )}
      {viewing && (
        <ProfileDetailModal
          profile={viewing}
          myLoc={myLoc}
          onClose={() => setViewing(null)}
          onMessage={(p) => { setViewing(null); onOpenChat && onOpenChat(p); }}
          onReport={(p) => { setViewing(null); onReport(p); }}
        />
      )}
    </div>
  );
}

function LanguageModal({ onClose }) {
  const { lang, setLang, t } = useLang();
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "flex-end", zIndex: 60 }} onClick={onClose}>
      <div style={{ width: "100%", background: T.white, borderRadius: "26px 26px 0 0", padding: "20px 20px 24px", animation: "floatUp .25s ease" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ ...fr(700, 20, T.royal), margin: 0, display: "flex", alignItems: "center", gap: 8 }}><Ic.Globe s={20} c={T.royal} />{t("language")}</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><Ic.Cross s={18} /></button>
        </div>
        <p style={{ ...nu(700, 12.5, T.soft), margin: "0 0 14px" }}>{t("languageSub")}</p>
        {LANGS.map((l) => (
          <button key={l.code} onClick={() => { setLang(l.code); onClose(); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: l.code === lang ? T.lilac : T.white, border: `2px solid ${l.code === lang ? T.royal : T.lilacDeep}`, borderRadius: 16, padding: "13px 15px", marginBottom: 8, cursor: "pointer" }}>
            <span style={{ ...fr(700, 12, l.code === lang ? T.royal : T.soft), width: 26 }}>{l.short}</span>
            <span style={{ ...nu(800, 14.5, T.ink), flex: 1, textAlign: "left" }}>{l.name}</span>
            {l.code === lang && <Ic.Check s={16} c={T.royal} />}
          </button>
        ))}
      </div>
    </div>
  );
}

function You({ onSignUp, onUpgrade, verifyStatus, onVerify, onLegal, onDelete, onEditProfile, onLogout, onOffClock, onEmailSettings, onLanguage, myRep, onFreeTonight, onSearchPrefsSaved }) {
  const { t, lang } = useLang();
  const L = useLabel();
  const u = api.user;
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [managingPhotos, setManagingPhotos] = useState(false);
  const [managingSearch, setManagingSearch] = useState(false);
  // Index into [main photo, ...gallery]; null means the viewer is closed
  const [viewingPhoto, setViewingPhoto] = useState(null);
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
      {!profileComplete({ name: u.name, age: u.age, avatar_url: u.profilePhoto, bio: u.bio }) && (
        <div style={{ background: "#FFFBEF", border: `2px solid ${T.sun}`, borderRadius: 18, padding: 14, marginBottom: 14, display: "flex", gap: 11, alignItems: "flex-start" }}>
          <Ic.Eye s={20} c={T.sun} />
          <div style={{ flex: 1 }}>
            <div style={{ ...fr(700, 15, T.ink) }}>{t("hiddenTitle")}</div>
            <div style={{ ...nu(700, 12.5, T.soft), marginTop: 3 }}>
              {t("hiddenBody").replace("{bits}", missingProfileBits({ avatar_url: u.profilePhoto, bio: u.bio, age: u.age }).map((b) => t("bit_" + b)).join(", "))}
            </div>
            <button onClick={onEditProfile} style={{ marginTop: 9, border: "none", background: T.royal, color: T.white, borderRadius: 999, padding: "8px 15px", cursor: "pointer", ...nu(800, 12.5, T.white) }}>{t("hiddenCta")}</button>
          </div>
        </div>
      )}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 10px" }}>
          {u.profilePhoto ? (
            <button onClick={() => setViewingPhoto(0)} aria-label="View profile photo" style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}>
              <PhotoThumb src={u.profilePhoto} size={92} round />
            </button>
          ) : (
            <div style={{ width: 92, height: 92, borderRadius: "50%", background: `linear-gradient(135deg, ${T.royal}, ${T.violet})`, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Person s={44} c={T.white} /></div>
          )}
        </div>
        <h2 style={{ ...fr(600, 24, T.ink), margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>{u.name}, {u.age}{verifyStatus === "verified" && <Ic.ShieldCheck s={21} c={T.green} />}</h2>
        <p style={{ ...nu(700, 13, T.soft), margin: "4px 0 0" }}>{[u.city, heightLabel, chronoLabel].filter(Boolean).join(" · ")}</p>
        <button onClick={() => setManagingPhotos(true)} style={{ marginTop: 8, marginRight: 8, border: `2px solid ${T.lilacDeep}`, background: T.white, borderRadius: 999, padding: "7px 14px", cursor: "pointer", ...nu(800, 12.5, T.royal) }}>Manage photos</button>
        <button onClick={onEditProfile} style={{ marginTop: 8, marginRight: 8, border: `2px solid ${T.lilacDeep}`, background: T.white, borderRadius: 999, padding: "7px 14px", cursor: "pointer", ...nu(800, 12.5, T.royal) }}>Edit profile</button>
        <button onClick={() => setManagingSearch(true)} style={{ marginTop: 8, border: `2px solid ${T.lilacDeep}`, background: T.white, borderRadius: 999, padding: "7px 14px", cursor: "pointer", ...nu(800, 12.5, T.royal) }}>Search preferences</button>
      </div>
      {u.photos.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12 }}>
          {u.photos.map((src, i) => (
            <button key={i} onClick={() => setViewingPhoto(i + 1)} aria-label={`View photo ${i + 2}`} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
              <PhotoThumb src={src} size={70} />
            </button>
          ))}
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
        <div style={fr(700, 18, T.white)}>{t("everyDateCosts")}</div>
        <div style={{ ...fr(700, 40, T.sun), margin: "4px 0" }}>$0.00</div>
        <div style={{ ...nu(700, 12.5, T.white), opacity: 0.9 }}>{t("noBills")}</div>
      </div>
      {verifyStatus !== "verified" && (
        <button onClick={onVerify} disabled={verifyStatus === "review"} style={{ width: "100%", marginTop: 10, borderRadius: 18, padding: "14px 16px", border: `2px solid ${verifyStatus === "review" ? T.lilacDeep : T.green}`, background: verifyStatus === "review" ? "#F7F5FC" : "#F0FBF5", cursor: verifyStatus === "review" ? "default" : "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
          <Ic.ShieldCheck s={26} c={verifyStatus === "review" ? T.soft : T.green} />
          <span style={{ flex: 1 }}>
            <span style={{ ...fr(700, 16, T.ink), display: "block" }}>{verifyStatus === "review" ? t("verifyInReview") : t("verifyProfile")}</span>
            <span style={{ ...nu(700, 12.5, T.soft) }}>{verifyStatus === "review" ? t("verifyReviewSub") : t("verifySub")}</span>
          </span>
          {verifyStatus !== "review" && <Ic.Chevron s={16} c={T.green} />}
        </button>
      )}
      <div style={{ background: T.white, borderRadius: 18, padding: "14px 16px", marginBottom: 10, border: `2px solid ${T.lilacDeep}` }}>
        <div style={{ ...nu(800, 10.5, T.soft), letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 8 }}>{t("yourReputation")}</div>
        {myRep && myRep.total >= 3 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ ...fr(700, 15, T.green), background: "#E8F8EF", borderRadius: 999, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Ic.Hourglass s={14} c={T.green} />{myRep.pct}% {t("timeWellSpentPct")}
            </span>
            {(myRep.traits || []).map((x) => <Pill key={x}>{L(x)}</Pill>)}
            <span style={{ ...nu(700, 11.5, T.soft), width: "100%" }}>{myRep.total} {t("ratedDates")}</span>
          </div>
        ) : (
          <div>
            <div style={{ ...nu(800, 14, T.ink) }}>{myRep && myRep.total ? `${myRep.total} / 3` : t("noReputationYet")}</div>
            <div style={{ ...nu(600, 12.5, T.soft), marginTop: 3 }}>{t("noReputationSub")}</div>
          </div>
        )}
      </div>
      <div style={{ marginBottom: 10 }}>
        <ToggleRow on={freeTonightActive(u.freeTonightUntil)} onToggle={onFreeTonight} label={t("freeTonight")} icon="Moon" />
        <div style={{ ...nu(600, 11.5, T.soft), margin: "5px 2px 0" }}>{t("freeTonightSub")}</div>
      </div>
      <div style={{ marginTop: 10, borderRadius: 18, border: `2px solid ${T.sun}`, background: "#FFFBEF", overflow: "hidden" }}>
        <button onClick={onUpgrade} style={{ width: "100%", padding: "14px 16px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
          <Ic.Sun s={26} c={T.sun} />
          <span style={{ flex: 1 }}>
            <span style={{ ...fr(700, 16, T.royal), display: "block" }}>Get TOM<span style={{ color: T.sun }}>+</span></span>
            <span style={{ ...nu(700, 12.5, T.soft) }}>{t("tomPerks")}</span>
          </span>
          <Ic.Chevron s={16} c={T.royal} />
        </button>
        <div style={{ height: 1, background: T.lilacDeep, opacity: 0.3 }} />
        <button onClick={onOffClock} style={{ width: "100%", padding: "14px 16px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
          <Ic.Moon s={26} c={T.royal} />
          <span style={{ flex: 1 }}>
            <span style={{ ...fr(700, 16, T.ink), display: "block" }}>{t("offTheClock")}{u.offTheClock ? " · ON" : ""}</span>
            {u.offTheClock ? <span style={{ ...nu(700, 12.5, T.green) }}>Resets at midnight</span> : <span style={{ ...nu(700, 12.5, T.soft) }}>{t("offOff")}</span>}
          </span>
          <Ic.Chevron s={16} c={T.royal} />
        </button>
      </div>
      <button onClick={onLanguage} style={{ width: "100%", marginTop: 10, borderRadius: 18, padding: "14px 16px", border: `2px solid ${T.lilacDeep}`, background: T.white, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
        <Ic.Globe s={26} c={T.royal} />
        <span style={{ flex: 1 }}>
          <span style={{ ...fr(700, 16, T.ink), display: "block" }}>{t("language")}</span>
          <span style={{ ...nu(700, 12.5, T.soft) }}>{LANGS.find((l) => l.code === lang)?.name || "English"}</span>
        </span>
        <Ic.Chevron s={16} c={T.royal} />
      </button>
      <button onClick={onEmailSettings} style={{ width: "100%", marginTop: 10, borderRadius: 18, padding: "14px 16px", border: `2px solid ${T.lilacDeep}`, background: T.white, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
        <Ic.Bubble s={26} c={T.royal} />
        <span style={{ flex: 1 }}>
          <span style={{ ...fr(700, 16, T.ink), display: "block" }}>{t("emailNotifs")}</span>
          <span style={{ ...nu(700, 12.5, T.soft) }}>{t("emailNotifsSub")}</span>
        </span>
        <Ic.Chevron s={16} c={T.royal} />
      </button>
      <div style={{ marginTop: 16 }}>
        <div style={{ ...nu(800, 11, T.soft), letterSpacing: ".6px", textTransform: "uppercase", margin: "0 2px 8px" }}>{t("aboutPrivacy")}</div>
        {[
          ["Privacy Policy", () => onLegal("privacy")],
          ["Terms of Service", () => onLegal("terms")],
        ].map(([label, fn]) => (
          <button key={label} onClick={fn} style={{ width: "100%", background: T.white, border: "none", borderRadius: 16, padding: "13px 15px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 3px 10px rgba(42,27,74,.06)" }}>
            <span style={{ ...nu(700, 14.5, T.ink) }}>{label}</span>
            <Ic.Chevron s={14} c={T.soft} />
          </button>
        ))}
        <button onClick={onLogout} style={{ width: "100%", background: T.white, border: "none", borderRadius: 16, padding: "13px 15px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 3px 10px rgba(42,27,74,.06)" }}>
          <span style={{ ...nu(700, 14.5, T.royal) }}>{t("logOut")}</span>
          <Ic.Chevron s={14} c={T.royal} />
        </button>
        <button onClick={onDelete} style={{ width: "100%", background: T.white, border: "none", borderRadius: 16, padding: "13px 15px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 3px 10px rgba(42,27,74,.06)" }}>
          <span style={{ ...nu(700, 14.5, T.red) }}>Delete my account</span>
          <Ic.Chevron s={14} c={T.red} />
        </button>
      </div>
      {viewingPhoto !== null && (
        <MyPhotoViewer
          startIndex={viewingPhoto}
          onClose={() => setViewingPhoto(null)}
          onChanged={rerender}
        />
      )}
      {managingPhotos && (
        <PhotoManagerModal
          onClose={() => setManagingPhotos(false)}
          onSaved={() => { rerender(); setManagingPhotos(false); }}
        />
      )}
      {managingSearch && (
        <SearchPrefsModal
          onClose={() => setManagingSearch(false)}
          onSaved={() => {
            rerender();
            setManagingSearch(false);
            // Tell the app the search area changed so Discover refreshes
            if (onSearchPrefsSaved) onSearchPrefsSaved();
          }}
        />
      )}
    </div>
  );
}

// Full-size viewer for your own photos. Opens from the avatar or any gallery
// thumbnail, steps through the whole set, and edits in place so you don't have
// to go hunting for the Manage photos screen just to delete a bad shot.
function MyPhotoViewer({ startIndex = 0, onClose, onChanged }) {
  const u = api.user;
  const [order, setOrder] = useState([u.profilePhoto, ...(u.photos || [])].filter(Boolean));
  const [idx, setIdx] = useState(Math.min(startIndex, Math.max(0, [u.profilePhoto, ...(u.photos || [])].filter(Boolean).length - 1)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [broken, setBroken] = useState(false);

  const persist = async (next) => {
    setSaving(true);
    setError(null);
    const prevMain = u.profilePhoto;
    const prevGallery = u.photos;
    u.profilePhoto = next[0] || null;
    u.photos = next.slice(1);
    const r = await api.saveProfile();
    setSaving(false);
    if (r.error) {
      // Put it back rather than leaving the screen showing a change that
      // never actually saved.
      u.profilePhoto = prevMain;
      u.photos = prevGallery;
      setOrder([prevMain, ...(prevGallery || [])].filter(Boolean));
      setError(r.error);
      return;
    }
    setOrder(next);
    if (onChanged) onChanged();
  };

  const makeMain = async () => {
    if (idx === 0) return;
    const next = [order[idx], ...order.slice(0, idx), ...order.slice(idx + 1)];
    await persist(next);
    setIdx(0);
  };

  const remove = async () => {
    const next = order.filter((_, j) => j !== idx);
    if (next.length === 0) { setError("Keep at least one photo."); return; }
    await persist(next);
    setIdx((i) => Math.min(i, next.length - 1));
    setBroken(false);
  };

  const go = (delta) => {
    setBroken(false);
    setIdx((i) => (i + delta + order.length) % order.length);
  };

  if (order.length === 0) return null;
  const src = order[idx];

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, background: "rgba(20,12,38,.94)", display: "flex", flexDirection: "column", animation: "popIn .2s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
        <span style={{ ...nu(800, 12.5, "#C9BCE8") }}>{idx === 0 ? "Main photo" : `Photo ${idx + 1} of ${order.length}`}</span>
        <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "rgba(255,255,255,.14)", borderRadius: 999, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Cross s={15} c={T.white} /></button>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px", minHeight: 0, position: "relative" }}>
        {order.length > 1 && (
          <button onClick={() => go(-1)} aria-label="Previous photo" style={{ position: "absolute", left: 10, zIndex: 2, border: "none", background: "rgba(255,255,255,.16)", borderRadius: 999, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><Ic.Chevron s={19} c={T.white} /></span>
          </button>
        )}
        {broken ? (
          <div style={{ ...nu(700, 13, "#C9BCE8"), textAlign: "center", padding: 30 }}>
            <Ic.Camera s={40} c="#C9BCE8" />
            <div style={{ marginTop: 10 }}>This photo can't preview in your browser, but it is saved.</div>
          </div>
        ) : (
          <img src={src} alt="" onError={() => setBroken(true)} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 18, objectFit: "contain" }} />
        )}
        {order.length > 1 && (
          <button onClick={() => go(1)} aria-label="Next photo" style={{ position: "absolute", right: 10, zIndex: 2, border: "none", background: "rgba(255,255,255,.16)", borderRadius: 999, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ic.Chevron s={19} c={T.white} />
          </button>
        )}
      </div>

      {order.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "10px 0 2px" }}>
          {order.map((_, i) => (
            <span key={i} style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 999, background: i === idx ? T.white : "rgba(255,255,255,.34)", transition: "width .2s" }} />
          ))}
        </div>
      )}

      {error && <p style={{ ...nu(700, 12.5, "#FFB4B4"), textAlign: "center", margin: "8px 16px 0" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, padding: "12px 16px 20px" }}>
        <button onClick={makeMain} disabled={idx === 0 || saving} style={{ flex: 1, border: "none", borderRadius: 14, padding: "12px 0", cursor: idx === 0 || saving ? "default" : "pointer", opacity: idx === 0 || saving ? 0.4 : 1, background: T.royal, ...nu(800, 13, T.white) }}>Make main</button>
        <button onClick={remove} disabled={saving} style={{ flex: 1, border: "none", borderRadius: 14, padding: "12px 0", cursor: saving ? "default" : "pointer", opacity: saving ? 0.5 : 1, background: "rgba(255,255,255,.16)", ...nu(800, 13, T.white) }}>{saving ? "Saving..." : "Delete"}</button>
      </div>
    </div>
  );
}

function PhotoManagerModal({ onClose, onSaved }) {
  const u = api.user;
  const [order, setOrder] = useState([u.profilePhoto, ...u.photos].filter(Boolean));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const MAX_TOTAL = MAX_PHOTOS + 1;

  const makeMain = (i) => {
    if (i === 0) return;
    setOrder((o) => [o[i], ...o.slice(0, i), ...o.slice(i + 1)]);
  };
  const moveLeft = (i) => {
    if (i === 0) return;
    setOrder((o) => { const n = [...o]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; });
  };
  const moveRight = (i) => {
    if (i === order.length - 1) return;
    setOrder((o) => { const n = [...o]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; });
  };
  const remove = (i) => setOrder((o) => o.filter((_, j) => j !== i));
  const addFiles = async (files) => {
    setError(null);
    for (const file of Array.from(files)) {
      const err = api.validatePhoto(file);
      if (err) { setError(err); continue; }
      if (order.length >= MAX_TOTAL) { setError(`You can have up to ${MAX_TOTAL} photos total. Remove one first.`); break; }
      setUploading(true);
      const up = await api.uploadPhoto(file);
      setUploading(false);
      if (up.error) { setError(up.error); continue; }
      setOrder((o) => [...o, up.url]);
    }
  };
  const save = async () => {
    if (order.length === 0) { setError("Add at least one photo"); return; }
    setSaving(true);
    u.profilePhoto = order[0];
    u.photos = order.slice(1);
    const r = await api.saveProfile();
    setSaving(false);
    if (r.error) { setError(r.error); return; }
    onSaved();
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: T.white, borderRadius: 26, padding: "22px 20px", width: "100%", maxWidth: 340, maxHeight: "82vh", overflowY: "auto", animation: "popIn .3s ease", boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}>
        <h2 style={{ ...fr(700, 21, T.ink), margin: "0 0 4px" }}>Manage photos</h2>
        <p style={{ ...nu(600, 12.5, T.soft), margin: "0 0 14px" }}>Your first photo is your main profile photo. Use the arrows to reorder, or tap Make main.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {order.map((src, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: T.lilac, borderRadius: 14, padding: 8 }}>
              <PhotoThumb src={src} size={56} round={i === 0} />
              <div style={{ flex: 1 }}>
                <div style={{ ...nu(800, 12, T.royal) }}>{i === 0 ? "Main photo" : `Photo ${i + 1}`}</div>
                {i !== 0 && (
                  <button onClick={() => makeMain(i)} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, ...nu(700, 11.5, T.soft), textDecoration: "underline" }}>Make main</button>
                )}
              </div>
              <button onClick={() => moveLeft(i)} disabled={i === 0} aria-label="Move earlier" style={{ border: "none", background: "none", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 1, padding: 4 }}><span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><Ic.Chevron s={16} c={T.royal} /></span></button>
              <button onClick={() => moveRight(i)} disabled={i === order.length - 1} aria-label="Move later" style={{ border: "none", background: "none", cursor: i === order.length - 1 ? "default" : "pointer", opacity: i === order.length - 1 ? 0.3 : 1, padding: 4 }}><Ic.Chevron s={16} c={T.royal} /></button>
              <button onClick={() => remove(i)} aria-label="Remove photo" style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><Ic.Cross s={15} c={T.red} /></button>
            </div>
          ))}
          {order.length < MAX_TOTAL && (
            <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: `2px dashed ${T.lilacDeep}`, borderRadius: 14, padding: 14, cursor: "pointer", ...fr(600, 15, T.royal) }}>
              + Add photo
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} />
            </label>
          )}
        </div>
        {uploading && <p style={{ ...nu(700, 13, T.royal), margin: "0 0 12px" }}>Uploading photo...</p>}
        {error && <p style={{ ...nu(700, 13, T.red), margin: "0 0 12px" }}>{error}</p>}
        <PrimaryBtn disabled={saving || uploading} onClick={save}>{saving ? "Saving..." : "Save changes"}</PrimaryBtn>
        <button onClick={onClose} style={{ width: "100%", marginTop: 8, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Cancel</button>
      </div>
    </div>
  );
}

function SearchPrefsModal({ onClose, onSaved }) {
  const u = api.user;
  const [unit, setUnit] = useState(u.distanceUnit || "km");
  const [radiusKm, setRadiusKm] = useState(u.searchRadiusKm ?? 50);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const KM_PRESETS = [5, 10, 25, 50, 100, 250];
  const toMi = (km) => Math.round(km * 0.621371);
  const presetLabel = (km) => (unit === "mi" ? `${toMi(km)} mi` : `${km} km`);

  const save = async () => {
    setSaving(true);
    u.distanceUnit = unit;
    u.searchRadiusKm = radiusKm;
    const r = await api.saveProfile();
    setSaving(false);
    if (r.error) { setError(r.error); return; }
    onSaved();
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: T.white, borderRadius: 26, padding: "22px 20px", width: "100%", maxWidth: 340, maxHeight: "82vh", overflowY: "auto", animation: "popIn .3s ease", boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}>
        <h2 style={{ ...fr(700, 21, T.ink), margin: "0 0 4px" }}>Search preferences</h2>
        <p style={{ ...nu(600, 12.5, T.soft), margin: "0 0 14px" }}>Choose your units and how far you're willing to meet.</p>
        <div style={{ ...nu(800, 11, T.soft), letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 8 }}>Units</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {[["km", "Kilometers"], ["mi", "Miles"]].map(([v, label]) => (
            <button key={v} onClick={() => setUnit(v)} style={{ flex: 1, padding: "10px 0", borderRadius: 14, cursor: "pointer", border: `2px solid ${unit === v ? T.royal : T.lilacDeep}`, background: unit === v ? T.lilac : T.white, ...nu(700, 13.5, unit === v ? T.royal : T.ink) }}>{label}</button>
          ))}
        </div>
        <div style={{ ...nu(800, 11, T.soft), letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 8 }}>Maximum distance</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {KM_PRESETS.map((km) => (
            <button key={km} onClick={() => setRadiusKm(km)} style={{ padding: "9px 14px", borderRadius: 999, cursor: "pointer", border: `2px solid ${radiusKm === km ? T.royal : T.lilacDeep}`, background: radiusKm === km ? T.lilac : T.white, ...nu(700, 13, radiusKm === km ? T.royal : T.ink) }}>{presetLabel(km)}</button>
          ))}
        </div>
        {error && <p style={{ ...nu(700, 13, T.red), margin: "0 0 12px" }}>{error}</p>}
        <PrimaryBtn disabled={saving} onClick={save}>{saving ? "Saving..." : "Save changes"}</PrimaryBtn>
        <button onClick={onClose} style={{ width: "100%", marginTop: 8, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Cancel</button>
      </div>
    </div>
  );
}

// ================= App =================
// The TOM loading screen. Separate from the Discover deck clock on purpose.
// Two brand lines, translated like the rest of the interface
const BOOT_LINES = [
  { lead: "bootLead1", emph: "bootEmph1" },
  { lead: "bootLead2", emph: "bootEmph2" },
];

function BootScreen() {
  const { t } = useLang();
  // One line chosen per appearance, so it rotates between loads
  const line = useRef(BOOT_LINES[Math.floor(Math.random() * BOOT_LINES.length)]).current;
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${T.lilac} 0%, #F7F4FD 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 28px", fontFamily: "Nunito, sans-serif" }}>
      {FONT}
      <style>{`
        @keyframes tomBreathe {
          0%, 100% { transform: scale(1); opacity: .88 }
          50%      { transform: scale(1.055); opacity: 1 }
        }
        @keyframes tomDot {
          0%, 80%, 100% { opacity: .22 }
          40%           { opacity: 1 }
        }
        @keyframes tomFadeUp {
          from { opacity: 0; transform: translateY(6px) }
          to   { opacity: 1; transform: translateY(0) }
        }
      `}</style>

      <h1 style={{ ...fr(700, 40, T.royal), letterSpacing: "1px", margin: 0, animation: "tomBreathe 2.6s ease-in-out infinite", transformOrigin: "center" }}>
        TOM<span style={{ color: T.sun }}>.</span>
      </h1>

      <p style={{ margin: "18px 0 0", maxWidth: 300, textAlign: "center", lineHeight: 1.5, animation: "tomFadeUp .6s ease .15s both" }}>
        <span style={{ ...nu(600, 14.5, T.royal), opacity: .82 }}>{t(line.lead)} </span>
        <span style={{ ...nu(800, 14.5, T.royal) }}>{t(line.emph)}</span>
      </p>

      <div style={{ display: "flex", gap: 7, marginTop: 22 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: T.royal, animation: `tomDot 1.4s ease-in-out ${i * 0.18}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

export default function TomApp() {
  return (
    <ToastProvider>
      <LanguageProvider>
        <TomAppInner />
      </LanguageProvider>
    </ToastProvider>
  );
}

function TomAppInner() {
  const { t } = useLang();
  const showToast = useToast();
  const [screen, setScreen] = useState("home"); // home -> welcome -> builder -> main
  const [booting, setBooting] = useState(true);

  const [unsubDone, setUnsubDone] = useState(null);

  React.useEffect(() => {
    (async () => {
      // Unsubscribe links from emails land here. Handled first, because an
      // unsubscribe has to work without being logged in.
      const params = new URLSearchParams(window.location.search);
      const unsub = params.get("unsub");
      if (unsub) {
        const { data } = await supabase.rpc("unsubscribe_by_token", { p_token: unsub });
        window.history.replaceState({}, "", window.location.pathname);
        setUnsubDone(data ? "done" : "failed");
      }
      // A reset link lands here. Supabase puts the recovery token in the URL
      // hash and exchanges it for a temporary session, so this has to be
      // checked BEFORE restoreSession, or the person is dropped straight into
      // the app on that session and never gets to set a password.
      const hash = window.location.hash || "";
      const isRecovery = params.get("recovery") === "1" || hash.includes("type=recovery");
      if (isRecovery) {
        // Give Supabase a moment to turn the link into a session.
        await new Promise((res) => setTimeout(res, 400));
        window.history.replaceState({}, "", window.location.pathname);
        setScreen("reset");
        setBooting(false);
        return;
      }
      const r = await api.restoreSession();
      if (r.ok) setScreen(r.complete ? "main" : "builder");
      setBooting(false);
      // Fire and forget. Converting old photos must never hold up the app.
      if (r.ok) api.migrateBase64Photos().catch(() => {});
    })();
  }, []);
  const [authMode, setAuthMode] = useState("signup");
  const [editingProfile, setEditingProfile] = useState(false);
  const [deck, setDeck] = useState([]);
  const [deckLoading, setDeckLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(true);
  // True once connections have loaded at least once, so revisiting the tab
  // refreshes quietly instead of blanking the list behind a loading screen.
  const hasLoadedMatches = useRef(false);
  const [loadError, setLoadError] = useState(null);
  const [matchesError, setMatchesError] = useState(null);
  const [matches, setMatches] = useState([]);
  const [admirerCount, setAdmirerCount] = useState(0);
  const [tab, setTab] = useState("discover");
  const [matched, setMatched] = useState(null);
  const [paywall, setPaywall] = useState(false);
  const [goldenUsed, setGoldenUsed] = useState(0);
  const [likesUsed, setLikesUsed] = useState(0);
  const [chatWith, setChatWith] = useState(null);
  const [unread, setUnread] = useState({ unread: 0, actions: 0 });
  const [unreadBy, setUnreadBy] = useState({});

  const refreshUnread = React.useCallback(async () => {
    if (!api.user || api.user.isGuest || !api.user.id) return;
    const [summary, byMatch] = await Promise.all([api.unreadSummary(), api.unreadByMatch()]);
    setUnread(summary);
    setUnreadBy(byMatch);
  }, []);

  // Poll while the app is open so the Connections dot appears without a reload.
  React.useEffect(() => {
    if (screen !== "main") return;
    refreshUnread();
    const id = setInterval(refreshUnread, 30000);
    return () => clearInterval(id);
  }, [screen, tab, refreshUnread]);

  // Opening a conversation clears its unread messages.
  React.useEffect(() => {
    if (!chatWith || !chatWith.matchId) return;
    (async () => {
      await api.markRead(chatWith.matchId);
      refreshUnread();
    })();
  }, [chatWith, refreshUnread]);
  const isPlus = Boolean(api.user && api.user.isPlus);
  const goldenLeft = Math.max(0, api.goldenLimit() - goldenUsed);
  const likesLeft = api.likeLimit() - likesUsed;
  const [myLoc, setMyLoc] = useState(null);

  const [goldenIntro, setGoldenIntro] = useState(false);
  const [goldenSeen, setGoldenSeen] = useState(false);
  const [reporting, setReporting] = useState(null); // { profile, from: "deck" | "matches" }
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(null); // null | "review" | "verified"
  const [legal, setLegal] = useState(null); // null | "privacy" | "terms"
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Batch 2: TOM+ feature state
  const [admirers, setAdmirers] = useState([]);
  const [showAdmirers, setShowAdmirers] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ageFilter, setAgeFilter] = useState({ min: 18, max: 99 });
  const [interestFilter, setInterestFilter] = useState([]);
  // Radius must live in state. It used to be read straight off api.user, which
  // is a plain object, so changing it never triggered a re-render.
  const [radiusKm, setRadiusKm] = useState(() => (api.user && api.user.searchRadiusKm) ?? 50);
  const [offClockOpen, setOffClockOpen] = useState(false);
  const [timeZonesOpen, setTimeZonesOpen] = useState(false);
  const [travelCity, setTravelCity] = useState(null); // null = my current area
  const [primeTimeOpen, setPrimeTimeOpen] = useState(false);
  const [boostUntil, setBoostUntil] = useState(null);
  const [plusGate, setPlusGate] = useState(null); // null | { title, blurb }

  // Batch 3: missions and reviews
  const [missionToSend, setMissionToSend] = useState(null); // idea string
  const [pendingReview, setPendingReview] = useState(null);
  const [pendingOutcome, setPendingOutcome] = useState(null);
  const [guestPrompt, setGuestPrompt] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [lastSwipe, setLastSwipe] = useState(null); // enables undo
  const [myRep, setMyRep] = useState(null);
  const [freeTonightOn, setFreeTonightOn] = useState(false);
  const [undoNote, setUndoNote] = useState(null);
  const [emailSettings, setEmailSettings] = useState(false);

  const logout = async () => {
    await api.logout();
    setDeck([]);
    setMatches([]);
    setMatched(null);
    setGoldenUsed(0);
    setLikesUsed(0);
    setChatWith(null);
    setVerifyStatus(null);
    setPaywall(false);
    setTab("discover");
    setScreen("home");
  };

  const deleteAccount = async () => {
    await api.deleteAccount();
    setDeck([]);
    setMatches([]);
    setMatched(null);
    setGoldenUsed(0);
    setLikesUsed(0);
    setChatWith(null);
    setGoldenSeen(false);
    setVerifyStatus(null);
    setPaywall(false);
    setDeleteOpen(false);
    setTab("discover");
    setScreen("home");
  };

  // ===== Batch 2 handlers =====
  const requirePlus = (title, blurb, fn) => {
    if (isPlus) fn();
    else setPlusGate({ title, blurb });
  };

  const openAdmirers = () => requirePlus(
    "See who likes you",
    "TOM+ shows you everyone who already said your time is worth it.",
    () => { setTab("discover"); setShowAdmirers(true); }
  );

  // Pull a fresh deck from the server. Used when the search area changes, so
  // people who were outside the old settings actually show up. Clears undo,
  // since undoing back into a card that no longer matches the search makes
  // no sense once the area has changed.
  const reloadDeck = useCallback(async () => {
    setDeckLoading(true);
    setLastSwipe(null);
    setTab("discover");
    const r = await api.loadDeck();
    setLoadError(r.cards ? null : (r.error || "Failed to load"));
    setDeck(r.cards || []);
    setDeckLoading(false);
  }, []);

  const applyFilters = ({ minAge, maxAge, radius, interests }) => {
    setAgeFilter({ min: minAge, max: maxAge });
    setInterestFilter(interests);
    setRadiusKm(radius);
    setFiltersOpen(false);
    // Refresh Discover first. This used to run after awaiting the profile
    // save, so a slow network delayed the re-search, and a failed save meant
    // it never happened at all.
    reloadDeck();
    if (api.user && !api.user.isGuest) {
      api.user.filterMinAge = minAge;
      api.user.filterMaxAge = maxAge;
      api.user.filterInterests = interests;
      api.user.searchRadiusKm = radius;
      api.saveProfile();
    }
  };

  const toggleOffClock = async () => {
    if (!api.user || api.user.isGuest) { setOffClockOpen(false); return; }
    api.user.offTheClock = !api.user.offTheClock;
    await api.saveProfile();
    setOffClockOpen(false);
  };

  const startPrimeTime = async () => {
    const r = await api.activateWeeklyBoost();
    if (r.ok) setBoostUntil(r.expiresAt);
  };

  const sendMissionTo = async (p, idea) => {
    setMissionToSend(null);
    if (p.matchId) {
      await api.sendMessage(p.matchId, `Mission Date idea: ${idea}`);
    }
    setTab("matches");
    setChatWith(p);
  };

  const onDateCompleted = async () => {
    const pr = await api.loadPendingReview();
    if (pr) setPendingReview(pr);
  };

  // Answered "how did it go?" — only a mutual "we met" opens the review
  const onOutcomeAnswered = async (answer, result) => {
    setPendingOutcome(null);
    if (answer === "met" && result && result.status === "completed") {
      const pr = await api.loadPendingReview();
      if (pr) setPendingReview(pr);
    }
    const [m, d] = await Promise.all([api.loadMatches(), api.loadDeck()]);
    // A failed refresh here used to blank the whole connections list, since
    // m.matches is undefined on error and this wrote an empty array.
    if (!m.error) { setMatches(m.matches || []); hasLoadedMatches.current = true; }
    setDeck(d.cards || []);
  };

  // Undo the last swipe. TOM+ perk: convenience, never the difference
  // between finding someone and not.
  const undoLastSwipe = async () => {
    if (!lastSwipe) return;
    const r = await api.undoLastSwipe();
    if (r.error) { setUndoNote(r.error); setTimeout(() => setUndoNote(null), 2600); return; }
    if (lastSwipe.dir === "right") setLikesUsed((n) => Math.max(0, n - 1));
    setDeck((d) => [lastSwipe.profile, ...d.filter((p) => p.id !== lastSwipe.profile.id)]);
    setLastSwipe(null);
  };

  // Reload connections each time the tab is opened. A single failed fetch
  // should never leave someone staring at an empty list.
  // Connections are already in state from boot, so blanking the list and
  // showing the full loading screen on every tab visit made the app feel slow
  // for data we already had. Show the loader only when there is nothing to
  // show yet; otherwise refresh quietly underneath the existing list.
  //
  // Connections is the only screen that fires several queries at once (the
  // match rows, then the profiles, plus the unread counts), and two of them
  // could be in flight together. A late failure used to overwrite a result
  // that had already succeeded, which is why the error card appeared even
  // though the data was fine and a manual retry always worked.
  const matchesRef = useRef([]);
  const matchReqId = useRef(0);
  React.useEffect(() => { matchesRef.current = matches; }, [matches]);

  const reloadMatches = React.useCallback(async () => {
    if (!api.user || api.user.isGuest || !api.user.id) return;
    const reqId = ++matchReqId.current;
    if (!hasLoadedMatches.current) setMatchesLoading(true);

    const r = await api.loadMatches();

    // A newer request started while this one was in flight. Its answer is the
    // current one, so drop this result instead of overwriting it.
    if (reqId !== matchReqId.current) return;

    if (r.error) {
      // Never replace connections we already have with an error screen.
      if (matchesRef.current.length === 0) setMatchesError(r.error);
    } else {
      setMatchesError(null);
      setMatches(r.matches || []);
      hasLoadedMatches.current = true;
    }
    setMatchesLoading(false);
  }, []);

  React.useEffect(() => {
    if (screen !== "main" || tab !== "matches") return;
    reloadMatches();
  }, [screen, tab, reloadMatches]);

  const inviteFriend = async () => {
    const url = "https://www.tomdates.com";
    const text = "Dating without the bill. Come spend time on TOM.";
    try {
      if (navigator.share) {
        await navigator.share({ title: "TOM", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      showToast(t("inviteCopied"));
    } catch (e) {
      // User cancelled the share sheet, or clipboard was blocked. Nothing to do.
    }
  };

  const toggleFreeTonight = async () => {
    if (!api.user || api.user.isGuest) return;
    const turningOn = !freeTonightActive(api.user.freeTonightUntil);
    await api.setFreeTonight(turningOn);
    setFreeTonightOn(turningOn);
    if (turningOn) {
      showToast("Your profile will show Free tonight until midnight");
    }
  };

  const likeBackAdmirer = (p) => {
    if (likesLeft <= 0 && !isPlus) { setPaywall(true); return; }
    setAdmirers((a) => a.filter((x) => x.id !== p.id));
    setAdmirerCount((n) => Math.max(0, n - 1));
    setLikesUsed((n) => n + 1);
    if (api.user && api.user.id && !api.user.isGuest) {
      api.swipe(p.id, "spend_time").then((r) => {
        if (r.matched) {
          const mp = { ...p, matchId: r.matchId };
          setMatched(mp);
          setMatches((m) => [...m, mp]);
        }
      });
    } else {
      setMatched(p);
      setMatches((m) => [...m, p]);
    }
  };

  React.useEffect(() => {
    if (verifyStatus !== "review") return;
    const t = setTimeout(() => {
      setVerifyStatus("verified");
      if (api.user) {
        api.user.verified = true;
        if (api.user.id) supabase.from("profiles").update({ verified: true }).eq("id", api.user.id);
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [verifyStatus]);

  const confirmReport = (reason) => {
    if (!reporting) return;
    if (reporting.from === "deck") setDeck((d) => d.filter((p) => p.id !== reporting.profile.id));
    else setMatches((m) => m.filter((p) => p.id !== reporting.profile.id));
    // Blocking someone must take you out of their conversation. Otherwise you
    // stay sitting in the thread of a person you just blocked.
    if (chatWith && chatWith.id === reporting.profile.id) setChatWith(null);
    if (api.user && !api.user.isGuest) {
      api.reportAndBlock(reporting.profile.id, reason);
    }
    setReporting(null);
  };

  const fireGolden = () => {
    if (sortedDeck.length === 0) return;
    if (!api.user || api.user.isGuest || !api.user.id) { setGuestPrompt(true); return; }
    if (goldenLeft <= 0) { setPaywall(true); return; }
    const top = sortedDeck[0];
    setGoldenUsed((n) => n + 1);
    setLikesUsed((n) => n + 1);
    setDeck((d) => d.filter((p) => p.id !== top.id));
    api.sendGoldenHour(top.id).then((r) => {
      const mp = { ...top, matchId: r.matchId || null };
      setMatched(mp);
      setMatches((m) => [...m, mp]);
    });
  };
  const onGolden = () => {
    if (sortedDeck.length === 0) return;
    if (!api.user || api.user.isGuest || !api.user.id) { setGuestPrompt(true); return; }
    if (!goldenSeen) { setGoldenIntro(true); return; }
    fireGolden();
  };

  React.useEffect(() => {
    if (screen !== "main") return;
    setLoadError(null);  // Clear any old error banner from previous session
    // This component mounts before login, so pull the saved search settings in
    // once we're on the main screen. Without this, radius would sit at the
    // default 50 and silently override what the user actually saved.
    if (api.user && !api.user.isGuest) {
      setRadiusKm(api.user.searchRadiusKm ?? 50);
      setAgeFilter({ min: api.user.filterMinAge ?? 18, max: api.user.filterMaxAge ?? 99 });
      setInterestFilter(api.user.filterInterests || []);
    }
    const isGuest = !api.user || api.user.isGuest || !api.user.id;
    if (isGuest) {
      // Guests see the real deck, browse only. No invented profiles.
      setDeckLoading(true);
      (async () => {
        const r = await api.loadDeck();
        setLoadError(r.cards ? null : (r.error || "Failed to load"));
        setDeck(r.cards || []);
        setDeckLoading(false);
      })();
      return;
    }
    setDeckLoading(true);
    // Goes through the same guarded loader as the tab, so the boot fetch and a
    // tab visit can no longer overwrite each other's results.
    reloadMatches();
    api.countAdmirers().then(setAdmirerCount);
    api.loadAdmirers().then(setAdmirers);
    api.myReputation().then(setMyRep);
    api.loadDailyUsage().then((usage) => {
      setLikesUsed(usage.likesUsed);
      setGoldenUsed(usage.goldenUsed);
    });
    (async () => {
      const r = await api.loadDeck();
      // If cards array exists (even if empty), clear error. Only show error if cards is missing.
      setLoadError(r.cards ? null : (r.error || "Failed to load"));
      setDeck(r.cards || []);
      setDeckLoading(false);
      if (api.user) {
        setAgeFilter({ min: api.user.filterMinAge ?? 18, max: api.user.filterMaxAge ?? 99 });
        setInterestFilter(api.user.filterInterests || []);
      }
      // Ask what happened first, then ask for a review of a confirmed date
      const po = await api.loadPendingOutcome();
      if (po) { setPendingOutcome(po); return; }
      const pr = await api.loadPendingReview();
      if (pr) setPendingReview(pr);
    })();
  }, [screen]);

  // Location: read the phone's GPS, save it to the profile so OTHER people can
  // measure their distance to us, then refresh the deck with real coordinates.
  // Runs on every visit so a moving user stays accurate. If permission is
  // denied we keep the city-center fallback and never write a location.
  const [locSaved, setLocSaved] = useState(false);
  const [locDenied, setLocDenied] = useState(false);
  React.useEffect(() => {
    if (screen !== "main" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setLocDenied(false);
        setMyLoc({ lat, lng });
        if (api.user && api.user.id && !api.user.isGuest) {
          const r = await api.saveLocation(lat, lng);
          if (r.ok && !locSaved) {
            setLocSaved(true);
            const fresh = await api.loadDeck();
            setLoadError(fresh.cards ? null : (fresh.error || "Failed to load"));
            setDeck(fresh.cards || []);
          }
        }
      },
      () => { setLocDenied(true); setMyLoc(null); }, // denied: show no distance rather than a wrong one
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 }
    );
  }, [screen, locSaved]);

  // Ranking: distance minus shared-interest boost (closest + most in common first)
  // Time Zones: when travelling, rank the deck from the chosen city instead
  const deckOrigin = travelCity ? travelCity.loc : myLoc;
  const sortedDeck = React.useMemo(() => {
    const isReal = api.user && !api.user.isGuest;
    // When travelling with Time Zones, the radius follows the destination city
    const radius = isReal ? radiusKm : Infinity;
    return deck
      .filter((p) => {
        const km = haversineKm(deckOrigin, p.loc);
        // Unknown distance is not a reason to hide someone; it ranks last instead.
        return km === null || km <= radius;
      })
      .filter((p) => !isReal || (p.age >= ageFilter.min && p.age <= ageFilter.max))
      .filter((p) => interestFilter.length === 0 || (p.likes || []).some((l) => interestFilter.includes(l)))
      .sort((a, b) => rankScore(deckOrigin, a) - rankScore(deckOrigin, b));
  }, [deck, myLoc, travelCity, ageFilter, interestFilter, radiusKm]);

  const onSwipe = (dir) => {
    if (sortedDeck.length === 0) return;
    const isRealUser = Boolean(api.user && api.user.id && !api.user.isGuest);
    // Guests browse only. Never fake a match with a real person.
    if (!isRealUser) { setGuestPrompt(true); return; }
    // Passes are always free; only likes count against the daily limit.
    if (dir === "right" && likesLeft <= 0) { setPaywall(true); return; }
    const top = sortedDeck[0];
    setDeck((d) => d.filter((p) => p.id !== top.id));
    setLastSwipe({ profile: top, dir });
    if (dir === "right") setLikesUsed((n) => n + 1);
    api.swipe(top.id, dir === "right" ? "spend_time" : "pass").then((r) => {
      if (r.matched) {
        const matchedProfile = { ...top, matchId: r.matchId };
        setMatched(matchedProfile);
        setMatches((m) => [...m, matchedProfile]);
      }
    });
  };

  const tabs = [
    { id: "discover", icon: Ic.Hourglass, label: t("tabDiscover") },
    { id: "missions", icon: Ic.Compass, label: t("tabMissions") },
    { id: "matches", icon: Ic.Heart, label: t("tabDates") },
    { id: "profile", icon: Ic.Person, label: t("tabYou") },
  ];

  if (booting) {
    return <BootScreen />;
  }

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
            {screen === "main" && tab === "discover" && !showAdmirers && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => setFiltersOpen(true)} aria-label="Fine tune your time" style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: T.lilac, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Ic.Sliders s={19} c={T.royal} />
                </button>
                <button onClick={openAdmirers} aria-label="See who likes you" style={{ position: "relative", width: 38, height: 38, borderRadius: "50%", border: "none", background: T.lilac, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Ic.Eye s={19} c={T.royal} />
                  {admirerCount > 0 && <span style={{ position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 999, background: T.sun, ...fr(700, 10.5, T.ink), display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{admirerCount}</span>}
                </button>
                <button onClick={() => setTimeZonesOpen(true)} aria-label="Time Zones" style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: travelCity ? T.royal : T.lilac, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Ic.Globe s={19} c={travelCity ? T.white : T.royal} />
                </button>
              </div>
            )}
            {screen === "main" && (tab !== "discover" || showAdmirers) && (
              <span style={{ ...fr(700, 12.5, T.royal), background: T.lilac, borderRadius: 999, padding: "6px 12px", textAlign: "center", lineHeight: 1.25 }}>Don't spend money.<br />Spend time.</span>
            )}
          </header>
        )}

        {screen === "home" && <Home onLegal={setLegal} onPick={(mode) => {
          if (mode === "guest") {
            api.user = { name: "Guest", age: null, isGuest: true, heightCm: null, gender: null, orientation: null, interestedIn: null, chronotype: null, bio: "", city: "", thingsILikeToDo: [], interests: [], hobbies: [], profilePhoto: null, photos: [], searchRadiusKm: 50, distanceUnit: "km", availability: [], freeTonightUntil: null, openToDoubles: false };
            setScreen("main");
          } else {
            setAuthMode(mode);
            setScreen("welcome");
          }
        }} />}
        {screen === "reset" && <ResetPasswordScreen onDone={(target) => setScreen(target)} />}
        {screen === "welcome" && <Welcome initialMode={authMode} onDone={(target) => setScreen(target)} />}
        {screen === "builder" && <Builder editMode={editingProfile} onDone={() => { setEditingProfile(false); setScreen("main"); }} />}
        {screen === "main" && (
          <>
            {tab === "discover" && showAdmirers && <AdmirersPanel admirers={admirers} myLoc={deckOrigin} onLikeBack={likeBackAdmirer} onBack={() => setShowAdmirers(false)} onReport={(p) => setReporting({ profile: p, from: "admirers" })} />}
            {tab === "discover" && !showAdmirers && <Discover deck={sortedDeck} onSwipe={onSwipe} myLoc={deckOrigin} onGolden={onGolden} goldenLeft={goldenLeft} likesLeft={likesLeft} isPlus={isPlus} onUpgrade={() => setPaywall(true)} onReport={(p) => setReporting({ profile: p, from: "deck" })} locDenied={locDenied && !travelCity} loading={deckLoading} onPrimeTime={() => requirePlus("Weekly Prime Time", "Rise to the top of nearby decks for 7 days. A TOM+ perk.", () => setPrimeTimeOpen(true))} onUndo={undoLastSwipe} canUndo={Boolean(lastSwipe)} admirerCount={admirerCount} onAdmirers={openAdmirers} onTimeZones={() => setTimeZonesOpen(true)} onInvite={inviteFriend} onFilters={() => setFiltersOpen(true)} />}
            {tab === "missions" && <Missions matches={matches} onSend={(idea) => setMissionToSend(idea)} />}
            {tab === "matches" && (chatWith
              ? <Chat profile={chatWith} onBack={() => setChatWith(null)} onDateCompleted={onDateCompleted} myLoc={myLoc} isPlus={isPlus} onReport={(p) => setReporting({ profile: p, from: "chat" })} />
              : <Matches matchesError={matchesError} onRetry={() => { setMatchesError(null); reloadMatches(); }} unreadBy={unreadBy} matches={matches} myLoc={myLoc} admirerCount={admirerCount} onUpgrade={openAdmirers} onReport={(p) => setReporting({ profile: p, from: "matches" })} onOpenChat={(p) => setChatWith(p)} loading={matchesLoading} />
            )}
            {tab === "profile" && <You onLegal={setLegal} onDelete={() => setDeleteOpen(true)} verifyStatus={verifyStatus} onVerify={() => setVerifyOpen(true)} onUpgrade={() => setPaywall(true)} onSignUp={() => { setAuthMode("signup"); setScreen("welcome"); setTab("discover"); }} onEditProfile={() => { setEditingProfile(true); setScreen("builder"); }} onLogout={logout} onOffClock={() => requirePlus("Off the Clock", "Go invisible without deleting anything. A TOM+ perk.", () => setOffClockOpen(true))} onEmailSettings={() => setEmailSettings(true)} onLanguage={() => setLanguageOpen(true)} myRep={myRep} onFreeTonight={toggleFreeTonight} onSearchPrefsSaved={() => { setRadiusKm((api.user && api.user.searchRadiusKm) ?? 50); reloadDeck(); }} />}
            <nav style={{ display: "flex", justifyContent: "space-around", padding: "10px 8px 16px", background: T.white, borderTop: `1px solid ${T.lilac}` }}>
              {tabs.map((t) => (
                <button key={t.id} onClick={() => { setTab(t.id); setChatWith(null); }} style={{ position: "relative", border: "none", background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 14px" }}>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, opacity: tab === t.id ? 1 : 0.45 }}>
                    {React.createElement(t.icon, { s: 22, c: T.royal })}
                    <span style={nu(800, 11, T.royal)}>{t.label}</span>
                  </span>
                  {t.id === "matches" && (unread.unread > 0 || unread.actions > 0) && (
                    <span aria-label="Something is waiting for you" style={{ position: "absolute", top: -4, right: 4, display: "flex", gap: 1, pointerEvents: "none", filter: "drop-shadow(0 0 2px #FFFFFF) drop-shadow(0 1px 3px rgba(42,27,74,.45))" }}>
                      <span style={{ display: "flex", animation: "heartBlink 1.1s ease-in-out infinite" }}><Ic.Heart s={14} c={T.red} /></span>
                      <span style={{ display: "flex", animation: "heartBlink 1.1s ease-in-out .55s infinite" }}><Ic.Heart s={14} c={T.red} /></span>
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </>
        )}

        {matched && <MatchModal profile={matched} onClose={() => setMatched(null)} myLoc={myLoc} onMessage={(p) => { setTab("matches"); setChatWith(p); }} />}
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
        {filtersOpen && <FiltersModal onClose={() => setFiltersOpen(false)} onApply={applyFilters} />}
        {offClockOpen && <OffTheClockModal onClose={() => setOffClockOpen(false)} onToggle={toggleOffClock} />}
        {timeZonesOpen && <TimeZonesModal current={travelCity} onPick={(c) => { setTravelCity(c); setTimeZonesOpen(false); reloadDeck(); }} onClose={() => setTimeZonesOpen(false)} />}
        {primeTimeOpen && <PrimeTimeModal onClose={() => setPrimeTimeOpen(false)} onActivate={startPrimeTime} boostUntil={boostUntil} />}
        {emailSettings && <EmailSettingsModal onClose={() => setEmailSettings(false)} />}
        {unsubDone && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 24 }}>
            <div style={{ width: "100%", background: T.white, borderRadius: 24, padding: 22, textAlign: "center", animation: "popIn .25s ease" }}>
              <Ic.Check s={34} c={unsubDone === "done" ? T.green : T.soft} />
              <h2 style={{ ...fr(700, 20, T.royal), margin: "8px 0 6px" }}>{unsubDone === "done" ? "Emails turned off" : "Link expired"}</h2>
              <p style={{ ...nu(700, 13.5, T.soft), margin: "0 0 16px" }}>
                {unsubDone === "done"
                  ? "You won't get emails from TOM anymore. You can turn them back on any time under You."
                  : "We couldn't find that unsubscribe link. You can change email settings under You."}
              </p>
              <PrimaryBtn onClick={() => setUnsubDone(null)}>Got it</PrimaryBtn>
            </div>
          </div>
        )}
        {loadError && tab === "discover" && (
          <div style={{ position: "absolute", left: 12, right: 12, top: 8, zIndex: 70, background: "#FFF4D6", border: "1px solid #E8C86A", borderRadius: 14, padding: "9px 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <Ic.Flag s={14} c="#8A6400" />
            <span style={{ flex: 1, ...nu(700, 11.5, "#8A6400") }}>{t("loadTrouble")}</span>
            <button onClick={async () => { setDeckLoading(true); const r = await api.loadDeck(); setLoadError(r.cards ? null : (r.error || "Failed to load")); setDeck(r.cards || []); setDeckLoading(false); }} style={{ border: "none", background: "#8A6400", borderRadius: 999, padding: "5px 10px", cursor: "pointer", ...fr(600, 11, T.white) }}>{t("retry")}</button>
            <button onClick={() => setLoadError(null)} aria-label="Dismiss" style={{ border: "none", background: "none", cursor: "pointer", padding: 2, display: "flex" }}><Ic.Cross s={13} c="#8A6400" /></button>
          </div>
        )}
        {undoNote && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 92, display: "flex", justifyContent: "center", zIndex: 70, pointerEvents: "none" }}>
            <span style={{ background: T.ink, color: T.white, borderRadius: 999, padding: "9px 16px", ...nu(700, 12.5, T.white), boxShadow: "0 6px 18px rgba(42,27,74,.3)" }}>{undoNote}</span>
          </div>
        )}
        {languageOpen && <LanguageModal onClose={() => setLanguageOpen(false)} />}
        {guestPrompt && <GuestPrompt onSignUp={() => { setGuestPrompt(false); setAuthMode("signup"); setScreen("welcome"); }} onClose={() => setGuestPrompt(false)} />}
        {plusGate && <PlusGate title={plusGate.title} blurb={plusGate.blurb} onClose={() => setPlusGate(null)} onUpgrade={() => { setPlusGate(null); setPaywall(true); }} />}
        {missionToSend && <SendMissionModal idea={missionToSend} matches={matches} onPick={(p) => sendMissionTo(p, missionToSend)} onClose={() => setMissionToSend(null)} />}
        {pendingOutcome && <OutcomeModal pending={pendingOutcome} onAnswer={onOutcomeAnswered} onLater={() => setPendingOutcome(null)} />}
        {pendingReview && <ReviewModal pending={pendingReview} onDone={() => { setPendingReview(null); onDateCompleted(); }} onSkip={() => setPendingReview(null)} />}
      </div>
    </div>
  );
}
