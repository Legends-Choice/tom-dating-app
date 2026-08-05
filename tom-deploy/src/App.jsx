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

// Maps a Supabase profiles row into the card shape Discover/Matches/Card expect
const CARD_GRADIENTS = [
  ["#7C3AED", "#B197F0"], ["#5B21B6", "#8B5CF6"], ["#9333EA", "#F0ABFC"],
  ["#6D28D9", "#67E8F9"], ["#7E22CE", "#FDA4AF"], ["#6B21A8", "#FDBA74"],
];
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0;
  return h;
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
    bio: row.bio || "Just joined TOM \u2014 say hi!",
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
    isPlus: Boolean(row.is_plus) && (!row.plus_until || new Date(row.plus_until) > new Date()),
    plusUntil: row.plus_until || null,
    offTheClock: Boolean(row.off_the_clock),
    filterMinAge: row.filter_min_age ?? 18,
    filterMaxAge: row.filter_max_age ?? 99,
    filterInterests: row.filter_interests || [],
  };
}

// Free-tier daily limits. TOM+ lifts these.
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
      off_the_clock: Boolean(u.offTheClock),
      filter_min_age: u.filterMinAge ?? 18, filter_max_age: u.filterMaxAge ?? 99,
      filter_interests: u.filterInterests || [],
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
    if (!this.user || !this.user.id) return [];
    const myId = this.user.id;
    const [{ data: allProfiles }, { data: myLikes }, { data: myBlocks }] = await Promise.all([
      supabase.from("profiles").select("*").neq("id", myId).eq("is_deleted", false),
      supabase.from("likes").select("liked_user_id").eq("user_id", myId),
      supabase.from("blocks").select("blocked_user_id").eq("user_id", myId),
    ]);
    const seen = new Set([
      ...(myLikes || []).map((l) => l.liked_user_id),
      ...(myBlocks || []).map((b) => b.blocked_user_id),
    ]);
    let cards = (allProfiles || [])
      .filter((p) => !seen.has(p.id) && !p.off_the_clock)
      .map(dbRowToCard);
    // Batch 3: attach Time Reputation to each card (only 3+ reviews come back)
    const reps = await this.loadReputations(cards.map((c) => c.id));
    cards = cards.map((c) => ({ ...c, rep: reps[c.id] || null }));
    return cards;
  },
  async loadMatches() {
    if (!this.user || !this.user.id) return [];
    const myId = this.user.id;
    const { data: rows } = await supabase.from("matches").select("*")
      .or(`user_id_1.eq.${myId},user_id_2.eq.${myId}`).eq("is_active", true);
    if (!rows || rows.length === 0) return [];
    const otherIds = rows.map((r) => (r.user_id_1 === myId ? r.user_id_2 : r.user_id_1));
    const { data: profs } = await supabase.from("profiles").select("*").in("id", otherIds);
    const matchIdByUser = {};
    rows.forEach((r) => { matchIdByUser[r.user_id_1 === myId ? r.user_id_2 : r.user_id_1] = r.id; });
    return (profs || []).map((p) => ({ ...dbRowToCard(p), matchId: matchIdByUser[p.id] }));
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
    const { data: profs } = await supabase.from("profiles").select("*").in("id", admirerIds).eq("is_deleted", false);
    return (profs || []).map(dbRowToCard);
  },
  // Batch 2: Weekly Prime Time boost (7 days at the top of the deck)
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
  async proposeDate(matchId, idea, scheduledAt) {
    const { data, error } = await supabase.rpc("propose_date", {
      p_match_id: matchId, p_idea: idea, p_scheduled_at: scheduledAt || null,
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
  return base - sharedLikes(p).length * BOOST_KM;
};

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
    <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24 }}>
      <div style={{ width: "100%", background: T.white, borderRadius: 24, padding: 22, textAlign: "center", animation: "popIn .25s ease" }}>
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
  const [viewing, setViewing] = useState(null);
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "6px 16px 16px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "none", cursor: "pointer", padding: "4px 0 10px", ...nu(800, 13, T.royal) }}>
        <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><Ic.Chevron s={14} c={T.royal} /></span> Back to Discover
      </button>
      <h2 style={{ ...fr(700, 21, T.ink), margin: "0 0 3px" }}>Worth their time</h2>
      <p style={{ ...nu(700, 13, T.soft), margin: "0 0 14px" }}>These people already said yes to spending time with you.</p>
      {admirers.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: 60 }}>
          <Ic.Eye s={44} c={T.royal} />
          <h3 style={{ ...fr(600, 19, T.ink), margin: "10px 0 4px" }}>No admirers yet</h3>
          <p style={{ ...nu(600, 13.5, T.soft), margin: 0 }}>When someone likes you, they show up here first.</p>
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
  const u = api.user || {};
  const [minAge, setMinAge] = useState(u.filterMinAge ?? 18);
  const [maxAge, setMaxAge] = useState(u.filterMaxAge ?? 99);
  const [radius, setRadius] = useState(u.searchRadiusKm ?? 50);
  const [picked, setPicked] = useState(u.filterInterests || []);
  const toggle = (i) => setPicked((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  const lo = Math.min(Number(minAge) || 18, Number(maxAge) || 99);
  const hi = Math.max(Number(minAge) || 18, Number(maxAge) || 99);
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "flex-end", zIndex: 60 }}>
      <div style={{ width: "100%", background: T.white, borderRadius: "26px 26px 0 0", padding: "20px 20px 24px", maxHeight: "82%", overflowY: "auto", animation: "floatUp .25s ease" }}>
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
            {INTEREST_POOL.map((i) => <Chip key={i} label={i} active={picked.includes(i)} onClick={() => toggle(i)} />)}
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
    <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24 }}>
      <div style={{ width: "100%", background: T.white, borderRadius: 24, padding: 22, textAlign: "center", animation: "popIn .25s ease" }}>
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
  { id: "london", name: "London", loc: { lat: 51.5074, lng: -0.1278 } },
  { id: "paris", name: "Paris", loc: { lat: 48.8566, lng: 2.3522 } },
  { id: "berlin", name: "Berlin", loc: { lat: 52.52, lng: 13.405 } },
  { id: "newyork", name: "New York", loc: { lat: 40.7128, lng: -74.006 } },
  { id: "losangeles", name: "Los Angeles", loc: { lat: 34.0522, lng: -118.2437 } },
];

function TimeZonesModal({ current, onPick, onClose }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "flex-end", zIndex: 60 }}>
      <div style={{ width: "100%", background: T.white, borderRadius: "26px 26px 0 0", padding: "20px 20px 24px", maxHeight: "82%", overflowY: "auto", animation: "floatUp .25s ease" }}>
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
    <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24 }}>
      <div style={{ width: "100%", background: T.white, borderRadius: 24, padding: 22, textAlign: "center", animation: "popIn .25s ease" }}>
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
    "Follow a street cat and see where it takes you",
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

// Flat list for the date proposal picker
const ALL_IDEAS = MISSIONS.flatMap((m) => m.ideas.map((idea) => ({ idea, cat: m.id, label: m.label, icon: m.icon })));

const REVIEW_TRAITS = ["On time", "Great listener", "Made me laugh", "Felt safe", "Genuine", "Good energy", "Planned it well", "Respectful", "Easy to talk to", "Adventurous"];
const REVIEW_FLAGS = ["They paid or insisted on paying", "Didn't show up", "Made me uncomfortable"];

function Missions({ matches, onSend }) {
  const [cat, setCat] = useState(MISSIONS[0].id);
  const active = MISSIONS.find((m) => m.id === cat);
  const CatIcon = Ic[active.icon];
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "6px 16px 16px" }}>
      <h2 style={{ ...fr(700, 21, T.ink), margin: "0 0 3px" }}>Mission Dates</h2>
      <p style={{ ...nu(700, 13, T.soft), margin: "0 0 12px" }}>Curated $0 dates. Pick one, send it to a match. Always optional.</p>
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
          <span style={{ flex: 1, ...nu(700, 13.5, T.ink) }}>{idea}</span>
          <button onClick={() => onSend(idea)} style={{ border: "none", borderRadius: 999, padding: "8px 12px", background: matches.length ? T.royal : T.lilacDeep, cursor: matches.length ? "pointer" : "default", ...fr(600, 12, T.white) }} disabled={!matches.length}>Send</button>
        </div>
      ))}
      {!matches.length && <p style={{ ...nu(600, 12.5, T.soft), textAlign: "center", marginTop: 8 }}>Match with someone first, then send them a mission.</p>}
    </div>
  );
}

function SendMissionModal({ idea, matches, onPick, onClose }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(42,27,74,.45)", display: "flex", alignItems: "flex-end", zIndex: 60 }}>
      <div style={{ width: "100%", background: T.white, borderRadius: "26px 26px 0 0", padding: "20px 20px 24px", maxHeight: "70%", overflowY: "auto", animation: "floatUp .25s ease" }}>
        <h2 style={{ ...fr(700, 18, T.royal), margin: "0 0 4px" }}>Send this mission to</h2>
        <p style={{ ...nu(700, 12.5, T.soft), margin: "0 0 14px" }}>{idea}</p>
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
      {when && <div style={{ ...nu(800, 12, T.royal), marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}><Ic.Hourglass s={11} c={T.royal} />{when}</div>}
      {!when && <div style={{ marginBottom: 8 }} />}
      {plan.status === "proposed" && mine && <div style={{ ...nu(700, 12, T.soft) }}>Waiting for {profileName} to confirm</div>}
      {plan.status === "proposed" && !mine && (
        <button onClick={onConfirm} style={{ border: "none", borderRadius: 999, padding: "8px 14px", background: T.royal, cursor: "pointer", ...fr(600, 12.5, T.white) }}>Confirm the date</button>
      )}
      {plan.status === "confirmed" && (!when || past) && (
        <button onClick={onComplete} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 999, padding: "8px 14px", background: T.green, cursor: "pointer", ...fr(600, 12.5, T.white) }}>
          <Ic.Check s={13} c={T.white} />We met up
        </button>
      )}
      {plan.status === "confirmed" && when && !past && (
        <div style={{ ...nu(700, 12, T.soft) }}>TOM will check in after to see how it went</div>
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
          {REVIEW_TRAITS.map((t) => <Chip key={t} label={t} active={traits.includes(t)} onClick={() => toggle(t)} />)}
        </div>
        <div style={{ ...nu(800, 11, T.soft), letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 7 }}>Anything to flag? (optional, private)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
          {REVIEW_FLAGS.map((f) => (
            <button key={f} onClick={() => setFlag(flag === f ? null : f)} style={{ textAlign: "left", padding: "9px 12px", borderRadius: 12, border: `2px solid ${flag === f ? T.royal : T.lilacDeep}`, background: flag === f ? T.lilac : T.white, cursor: "pointer", ...nu(700, 12.5, T.ink) }}>{f}</button>
          ))}
        </div>
        <PrimaryBtn disabled={well === null || saving} onClick={submit}>{saving ? "Sending..." : "Submit review"}</PrimaryBtn>
        <button onClick={onSkip} style={{ width: "100%", marginTop: 8, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13, T.soft) }}>Skip for now</button>
      </div>
    </div>
  );
}

// ================= Full profile view (before or after matching) =================
function ProfileDetailModal({ profile, myLoc, onClose, onSwipe, onMessage, onLikeBack }) {
  const [idx, setIdx] = useState(0);
  if (!profile) return null;
  const gallery = [profile.photo, ...(profile.photos || [])].filter(Boolean);
  const hasPhotos = gallery.length > 0;
  const shared = sharedLikes(profile);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(42,27,74,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: T.white, borderRadius: "26px 26px 0 0", width: "100%", maxHeight: "92%", overflowY: "auto", animation: "floatUp .3s ease" }}>
        <div style={{ position: "relative", height: 300, background: hasPhotos ? `url(${gallery[idx]}) center/cover no-repeat` : `linear-gradient(135deg, ${profile.grad[0]}, ${profile.grad[1]})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {!hasPhotos && <span style={{ ...fr(700, 100, "rgba(255,255,255,.95)"), lineHeight: 1 }}>{profile.name[0]}</span>}
          <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 14, right: 14, width: 34, height: 34, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.35)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Cross s={16} c={T.white} /></button>
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
        <div style={{ padding: "16px 20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={fr(700, 26, T.ink)}>{profile.name}, {profile.age}</span>
            {profile.verified && <Ic.ShieldCheck s={20} c={T.green} />}
            <span style={{ ...nu(700, 13, T.soft), marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}><Ic.Pin s={13} c={T.soft} />{distPhrase(myLoc, profile)}</span>
          </div>
          {profile.rep && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ ...fr(700, 12, T.green), background: "#E8F8EF", borderRadius: 999, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}><Ic.Hourglass s={12} c={T.green} />{profile.rep.pct}% time well spent</span>
              {(profile.rep.traits || []).map((t) => <Pill key={t}>{t}</Pill>)}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Pill filled>{profile.vibe}</Pill>
            {(profile.tags || []).map((t) => <Pill key={t}>{t}</Pill>)}
          </div>
          {shared.length > 0 && (
            <div style={{ background: "#FFF4D6", borderRadius: 14, padding: "10px 12px", ...nu(700, 13, "#8A6400"), display: "flex", alignItems: "center", gap: 6 }}>
              <Ic.Spark s={14} c={T.sun} />You both love: {shared.join(", ")}
            </div>
          )}
          <div style={{ background: T.lilac, borderRadius: 14, padding: "11px 13px", ...nu(700, 13.5, T.royal), display: "flex", alignItems: "center", gap: 6 }}><Ic.Bulb s={14} c={T.royal} />Free date idea: {profile.idea}</div>
          {profile.bio && <p style={{ margin: 0, ...nu(600, 14, T.ink), lineHeight: 1.5 }}>{profile.bio}</p>}

          {onSwipe && (
            <div style={{ display: "flex", justifyContent: "center", gap: 18, paddingTop: 8 }}>
              <button onClick={() => onSwipe("left")} aria-label="Pass" style={{ width: 54, height: 54, borderRadius: "50%", border: "none", background: T.lilac, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Cross s={20} c={T.ink} /></button>
              <button onClick={() => onSwipe("right")} aria-label="Spend time" style={{ width: 64, height: 64, borderRadius: "50%", border: "none", background: T.royal, cursor: "pointer", boxShadow: "0 6px 18px rgba(91,33,182,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic.Hourglass s={26} c={T.white} /></button>
            </div>
          )}
          {onLikeBack && <PrimaryBtn onClick={() => onLikeBack(profile)}>Spend time with {profile.name}</PrimaryBtn>}
          {onMessage && <PrimaryBtn onClick={() => onMessage(profile)}>Message {profile.name}</PrimaryBtn>}
        </div>
      </div>
    </div>
  );
}

// ================= Swipe card =================
function Card({ profile, onSwipe, isTop, myLoc, onReport, onView }) {
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
          <button onClick={() => onView(profile)} onPointerDown={(e) => e.stopPropagation()} aria-label="View full profile" style={{ position: "absolute", bottom: 14, right: 14, display: "flex", alignItems: "center", gap: 5, border: "none", borderRadius: 999, padding: "7px 12px", background: "rgba(0,0,0,.35)", cursor: "pointer", ...nu(700, 12, T.white) }}>
            <Ic.Eye s={14} c={T.white} />View profile
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
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async () => {
    setError(null);
    setBusy(true);
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
      <PrimaryBtn disabled={busy} onClick={submit}>{busy ? "Please wait..." : (mode === "signup" ? "Create my account" : "Sign in")}</PrimaryBtn>
      <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }}
        style={{ width: "100%", marginTop: 12, padding: "10px 0", border: "none", background: "none", cursor: "pointer", ...nu(800, 13.5, T.royal) }}>
        {mode === "signup" ? "Already on TOM? Sign in" : "New here? Create an account"}
      </button>
      <p style={{ ...nu(600, 11.5, T.soft), textAlign: "center", marginTop: 8 }}>Public places. Equal basis. $0 always.</p>
    </div>
  );
}

function Builder({ onDone, editMode }) {
  const [step, setStep] = useState(0);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [photoError, setPhotoError] = useState(null);
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
          <PrimaryBtn disabled={!canNext || saving} onClick={async () => {
            if (step < 3) { setStep(step + 1); return; }
            setSaving(true);
            const r = await api.saveProfile();
            setSaving(false);
            if (r.error) { setPhotoError(r.error); return; }
            onDone();
          }}>
            {saving ? "Saving..." : (step < 3 ? "Continue" : (editMode ? "Save changes" : "Start spending time"))}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

function Discover({ deck, onSwipe, myLoc, onGolden, goldenLeft, likesLeft, isPlus, onUpgrade, onReport, locDenied }) {
  const [viewing, setViewing] = useState(null);
  const outOfLikes = !isPlus && likesLeft !== undefined && likesLeft <= 0;
  if (outOfLikes) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32, textAlign: "center" }}>
        <Ic.Hourglass s={54} c={T.royal} />
        <h2 style={{ ...fr(600, 22, T.ink), margin: 0 }}>You're out of likes for today</h2>
        <p style={{ ...nu(600, 14, T.soft), margin: 0 }}>Your likes reset tomorrow. Passing is always unlimited.</p>
        <div style={{ width: "100%", maxWidth: 240, marginTop: 6 }}>
          <PrimaryBtn onClick={onUpgrade}>Get unlimited with TOM+</PrimaryBtn>
        </div>
      </div>
    );
  }
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
      {locDenied && (
        <div style={{ background: "#FFF4D6", borderRadius: 14, padding: "9px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 7, ...nu(700, 12, "#8A6400") }}>
          <Ic.Pin s={13} c="#8A6400" />
          Location is off, so distances are hidden. Turn it on in your browser or phone settings to see who's nearby.
        </div>
      )}
      <div style={{ position: "relative", flex: 1, marginBottom: 12 }}>
        {deck.slice(0, 2).map((p, i) => <Card key={p.id} profile={p} isTop={i === 0} onSwipe={onSwipe} myLoc={myLoc} onReport={onReport} onView={setViewing} />).reverse()}
      </div>
      {viewing && (
        <ProfileDetailModal
          profile={viewing}
          myLoc={myLoc}
          onClose={() => setViewing(null)}
          onSwipe={(dir) => { setViewing(null); onSwipe(dir); }}
        />
      )}
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

function Chat({ profile, onBack, onDateCompleted, myLoc }) {
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
  const [viewing, setViewing] = useState(null);
  const endRef = useRef(null);
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

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const r = await api.sendMessage(profile.matchId, text);
    setSending(false);
    if (r.error) { setError(r.error); return; }
    setDraft("");
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
    const r = await api.proposeDate(profile.matchId, idea, scheduledAt);
    if (r.ok) {
      setPlan(r.date);
      setPlanning(false);
      setPlanDate(""); setPlanTime("");
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
          <Ic.Hourglass s={13} c={T.royal} />Plan a date
          </button>
        )}
      </div>
      <PlanBanner plan={plan} myId={myId} profileName={profile.name} onConfirm={confirmPlan} onComplete={completePlan} />
      {planning && (
        <div style={{ margin: "10px 16px 0", background: T.white, border: `2px solid ${T.lilacDeep}`, borderRadius: 16, padding: "11px 13px" }}>
          <div style={{ ...nu(800, 10.5, T.soft), letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 6 }}>Propose a $0 date</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input value={planDraft} onChange={(e) => setPlanDraft(e.target.value)} placeholder="What's the plan?" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => setIdeaPicker((v) => !v)} style={{ border: `2px solid ${ideaPicker ? T.royal : T.lilacDeep}`, borderRadius: 14, padding: "0 12px", background: ideaPicker ? T.lilac : T.white, cursor: "pointer", whiteSpace: "nowrap", ...fr(600, 12.5, T.royal) }}>
              Ideas
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
                  <button key={i.idea} onClick={() => { setPlanDraft(i.idea); setIdeaPicker(false); }} style={{ display: "block", width: "100%", textAlign: "left", background: T.white, border: `1px solid ${T.lilac}`, borderRadius: 10, padding: "8px 10px", marginBottom: 5, cursor: "pointer", ...nu(600, 12.5, T.ink) }}>
                    {i.idea}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} style={{ ...inputStyle, flex: 1.3 }} />
            <input type="time" value={planTime} onChange={(e) => setPlanTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          </div>
          <div style={{ ...nu(700, 11, T.soft), marginBottom: 8 }}>Adding a time lets TOM check in afterwards. You can skip it.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={propose} style={{ flex: 1, border: "none", borderRadius: 999, padding: "9px 0", background: T.royal, cursor: "pointer", ...fr(600, 13, T.white) }}>Propose</button>
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
        ) : messages.map((m) => {
          const mine = m.sender_id === myId;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "78%", background: mine ? T.royal : T.lilac, color: mine ? T.white : T.ink, borderRadius: 16, padding: "9px 13px", ...nu(600, 14, mine ? T.white : T.ink) }}>
              {m.body}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <p style={{ ...nu(700, 12.5, T.red), margin: "0 16px 6px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 14px", borderTop: `1px solid ${T.lilacDeep}` }}>
        <input
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
        />
      )}
    </div>
  );
}

function Matches({ matches, myLoc, admirerCount, onUpgrade, onReport, onOpenChat }) {
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
          <div style={{ ...nu(800, 14, T.white) }}>{admirerCount} {admirerCount === 1 ? "person thinks" : "people think"} you're worth their time</div>
          <div style={{ ...nu(700, 12, "#D9CCF5") }}>See who likes you with TOM+ →</div>
        </div>
      </button>
      )}
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
              <button onClick={() => setViewing(p)} aria-label={`View ${p.name}'s profile`} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
                <div style={{ width: 54, height: 54, borderRadius: "50%", background: p.photo ? `url(${p.photo}) center/cover no-repeat` : `linear-gradient(135deg, ${p.grad[0]}, ${p.grad[1]})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...fr(700, 22, T.white) }}>{p.photo ? "" : p.name[0]}</div>
              </button>
              <button onClick={() => onOpenChat && onOpenChat(p)} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, border: "none", background: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={fr(600, 17, T.ink)}>{p.name} <span style={{ ...nu(700, 12, T.soft), display: "inline-flex", alignItems: "center", gap: 3 }}>· <Ic.Pin s={11} c={T.soft} />{distLabel(myLoc, p)}</span></div>
                  <div style={{ ...nu(700, 12.5, T.royal), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Tap to message</div>
                </div>
              </button>
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
      {viewing && (
        <ProfileDetailModal
          profile={viewing}
          myLoc={myLoc}
          onClose={() => setViewing(null)}
          onMessage={(p) => { setViewing(null); onOpenChat && onOpenChat(p); }}
        />
      )}
    </div>
  );
}

function You({ onSignUp, onUpgrade, verifyStatus, onVerify, onLegal, onDelete, onEditProfile, onLogout, onOffClock, onPrimeTime }) {
  const u = api.user;
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [managingPhotos, setManagingPhotos] = useState(false);
  const [managingSearch, setManagingSearch] = useState(false);
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
        <button onClick={() => setManagingPhotos(true)} style={{ marginTop: 8, marginRight: 8, border: `2px solid ${T.lilacDeep}`, background: T.white, borderRadius: 999, padding: "7px 14px", cursor: "pointer", ...nu(800, 12.5, T.royal) }}>Manage photos</button>
        <button onClick={onEditProfile} style={{ marginTop: 8, marginRight: 8, border: `2px solid ${T.lilacDeep}`, background: T.white, borderRadius: 999, padding: "7px 14px", cursor: "pointer", ...nu(800, 12.5, T.royal) }}>Edit profile</button>
        <button onClick={() => setManagingSearch(true)} style={{ marginTop: 8, border: `2px solid ${T.lilacDeep}`, background: T.white, borderRadius: 999, padding: "7px 14px", cursor: "pointer", ...nu(800, 12.5, T.royal) }}>Search preferences</button>
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
        <div style={fr(700, 18, T.white)}>Every TOM date is designed to cost</div>
        <div style={{ ...fr(700, 40, T.sun), margin: "4px 0" }}>$0.00</div>
        <div style={{ ...nu(700, 12.5, T.white), opacity: 0.9 }}>No bills. No paying. Just time together.</div>
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
      <button onClick={onPrimeTime} style={{ width: "100%", marginTop: 10, borderRadius: 18, padding: "14px 16px", border: `2px solid ${T.lilacDeep}`, background: T.white, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
        <Ic.Rise s={26} c={T.royal} />
        <span style={{ flex: 1 }}>
          <span style={{ ...fr(700, 16, T.ink), display: "block" }}>Weekly Prime Time</span>
          <span style={{ ...nu(700, 12.5, T.soft) }}>Rise to the top of nearby decks for 7 days</span>
        </span>
        <Ic.Chevron s={16} c={T.royal} />
      </button>
      <button onClick={onOffClock} style={{ width: "100%", marginTop: 10, borderRadius: 18, padding: "14px 16px", border: `2px solid ${T.lilacDeep}`, background: u.offTheClock ? T.lilac : T.white, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
        <Ic.Moon s={26} c={T.royal} />
        <span style={{ flex: 1 }}>
          <span style={{ ...fr(700, 16, T.ink), display: "block" }}>Off the Clock{u.offTheClock ? " · ON" : ""}</span>
          <span style={{ ...nu(700, 12.5, T.soft) }}>{u.offTheClock ? "You're invisible right now" : "Go invisible without deleting anything"}</span>
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
        <button onClick={onLogout} style={{ width: "100%", background: T.white, border: "none", borderRadius: 16, padding: "13px 15px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 3px 10px rgba(42,27,74,.06)" }}>
          <span style={{ ...nu(700, 14.5, T.royal) }}>Log out</span>
          <Ic.Chevron s={14} c={T.royal} />
        </button>
        <button onClick={onDelete} style={{ width: "100%", background: T.white, border: "none", borderRadius: 16, padding: "13px 15px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 3px 10px rgba(42,27,74,.06)" }}>
          <span style={{ ...nu(700, 14.5, T.red) }}>Delete my account</span>
          <Ic.Chevron s={14} c={T.red} />
        </button>
      </div>
      {managingPhotos && (
        <PhotoManagerModal
          onClose={() => setManagingPhotos(false)}
          onSaved={() => { rerender(); setManagingPhotos(false); }}
        />
      )}
      {managingSearch && (
        <SearchPrefsModal
          onClose={() => setManagingSearch(false)}
          onSaved={() => { rerender(); setManagingSearch(false); }}
        />
      )}
    </div>
  );
}

function PhotoManagerModal({ onClose, onSaved }) {
  const u = api.user;
  const [order, setOrder] = useState([u.profilePhoto, ...u.photos].filter(Boolean));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
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
  const addFiles = (files) => {
    setError(null);
    for (const file of Array.from(files)) {
      const err = api.validatePhoto(file);
      if (err) { setError(err); continue; }
      if (order.length >= MAX_TOTAL) { setError(`You can have up to ${MAX_TOTAL} photos total. Remove one first.`); break; }
      const reader = new FileReader();
      reader.onload = () => setOrder((o) => [...o, reader.result]);
      reader.readAsDataURL(file);
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
        {error && <p style={{ ...nu(700, 13, T.red), margin: "0 0 12px" }}>{error}</p>}
        <PrimaryBtn disabled={saving} onClick={save}>{saving ? "Saving..." : "Save changes"}</PrimaryBtn>
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
export default function TomApp() {
  const [screen, setScreen] = useState("home"); // home -> welcome -> builder -> main
  const [booting, setBooting] = useState(true);

  React.useEffect(() => {
    (async () => {
      const r = await api.restoreSession();
      if (r.ok) setScreen(r.complete ? "main" : "builder");
      setBooting(false);
    })();
  }, []);
  const [authMode, setAuthMode] = useState("signup");
  const [editingProfile, setEditingProfile] = useState(false);
  const [deck, setDeck] = useState(PROFILES);
  const [matches, setMatches] = useState([]);
  const [admirerCount, setAdmirerCount] = useState(3);
  const [tab, setTab] = useState("discover");
  const [matched, setMatched] = useState(null);
  const [paywall, setPaywall] = useState(false);
  const [goldenUsed, setGoldenUsed] = useState(0);
  const [likesUsed, setLikesUsed] = useState(0);
  const [chatWith, setChatWith] = useState(null);
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

  const logout = async () => {
    await api.logout();
    setDeck(PROFILES);
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
    setDeck(PROFILES);
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

  const applyFilters = async ({ minAge, maxAge, radius, interests }) => {
    setAgeFilter({ min: minAge, max: maxAge });
    setInterestFilter(interests);
    setFiltersOpen(false);
    if (api.user && !api.user.isGuest) {
      api.user.filterMinAge = minAge;
      api.user.filterMaxAge = maxAge;
      api.user.filterInterests = interests;
      api.user.searchRadiusKm = radius;
      await api.saveProfile();
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
    setMatches(m);
    setDeck(d);
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
    if (api.user && !api.user.isGuest) {
      api.reportAndBlock(reporting.profile.id, reason);
    }
    setReporting(null);
  };

  const fireGolden = () => {
    if (sortedDeck.length === 0) return;
    if (goldenLeft <= 0) { setPaywall(true); return; }
    const top = sortedDeck[0];
    setGoldenUsed((n) => n + 1);
    setLikesUsed((n) => n + 1);
    setDeck((d) => d.filter((p) => p.id !== top.id));
    if (api.user && api.user.id && !api.user.isGuest) {
      api.sendGoldenHour(top.id).then((r) => {
        const mp = { ...top, matchId: r.matchId || null };
        setMatched(mp);
        setMatches((m) => [...m, mp]);
      });
    } else {
      setMatched(top);
      setMatches((m) => [...m, top]);
    }
  };
  const onGolden = () => {
    if (sortedDeck.length === 0) return;
    if (!goldenSeen) { setGoldenIntro(true); return; }
    fireGolden();
  };

  React.useEffect(() => {
    if (screen !== "main") return;
    if (!api.user || api.user.isGuest || !api.user.id) return; // guests keep the demo deck
    (async () => {
      const [d, m, c, usage, adm] = await Promise.all([
        api.loadDeck(), api.loadMatches(), api.countAdmirers(), api.loadDailyUsage(), api.loadAdmirers(),
      ]);
      setDeck(d);
      setMatches(m);
      setAdmirerCount(c);
      setAdmirers(adm);
      setLikesUsed(usage.likesUsed);
      setGoldenUsed(usage.goldenUsed);
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
            setDeck(fresh);
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
    const radiusKm = isReal ? (api.user.searchRadiusKm ?? 50) : Infinity;
    return deck
      .filter((p) => {
        const km = haversineKm(deckOrigin, p.loc);
        // Unknown distance is not a reason to hide someone; it ranks last instead.
        return km === null || km <= radiusKm;
      })
      .filter((p) => !isReal || (p.age >= ageFilter.min && p.age <= ageFilter.max))
      .filter((p) => interestFilter.length === 0 || (p.likes || []).some((l) => interestFilter.includes(l)))
      .sort((a, b) => rankScore(deckOrigin, a) - rankScore(deckOrigin, b));
  }, [deck, myLoc, travelCity, ageFilter, interestFilter]);

  const onSwipe = (dir) => {
    if (sortedDeck.length === 0) return;
    const isRealUser = Boolean(api.user && api.user.id && !api.user.isGuest);
    // Passes are always free; only likes count against the daily limit.
    if (dir === "right" && isRealUser && likesLeft <= 0) { setPaywall(true); return; }
    const top = sortedDeck[0];
    setDeck((d) => d.filter((p) => p.id !== top.id));
    if (isRealUser) {
      if (dir === "right") setLikesUsed((n) => n + 1);
      api.swipe(top.id, dir === "right" ? "spend_time" : "pass").then((r) => {
        if (r.matched) {
          const matchedProfile = { ...top, matchId: r.matchId };
          setMatched(matchedProfile);
          setMatches((m) => [...m, matchedProfile]);
        }
      });
      return;
    }
    // Guest / demo mode: simulate matches against the sample deck
    if (dir === "right") {
      setMatches((m) => {
        if (top.id % 2 === 1 || m.length === 0) { setMatched(top); return [...m, top]; }
        return m;
      });
    }
  };

  const tabs = [
    { id: "discover", icon: Ic.Hourglass, label: "Discover" },
    { id: "missions", icon: Ic.Compass, label: "Missions" },
    { id: "matches", icon: Ic.Heart, label: "Dates" },
    { id: "profile", icon: Ic.Person, label: "You" },
  ];

  if (booting) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${T.lilac} 0%, #F7F4FD 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Nunito, sans-serif" }}>
        {FONT}
        <h1 style={{ ...fr(700, 32, T.royal), letterSpacing: "1px" }}>TOM<span style={{ color: T.sun }}>.</span></h1>
      </div>
    );
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
                <button onClick={openAdmirers} aria-label="See who likes you" style={{ position: "relative", width: 38, height: 38, borderRadius: "50%", border: "none", background: T.lilac, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Ic.Eye s={19} c={T.royal} />
                  {admirerCount > 0 && <span style={{ position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 999, background: T.sun, ...fr(700, 10.5, T.ink), display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{admirerCount}</span>}
                </button>
                <button onClick={() => setFiltersOpen(true)} aria-label="Filters" style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: T.lilac, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Ic.Sliders s={19} c={T.royal} />
                </button>
                <button onClick={() => requirePlus("Time Zones", "Browse and match in other cities before you travel. A TOM+ perk.", () => setTimeZonesOpen(true))} aria-label="Time Zones" style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: travelCity ? T.royal : T.lilac, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
            api.user = { name: "Guest", age: null, isGuest: true, heightCm: null, gender: null, orientation: null, interestedIn: null, chronotype: null, bio: "", city: "", thingsILikeToDo: [], interests: [], hobbies: [], profilePhoto: null, photos: [], searchRadiusKm: 50, distanceUnit: "km" };
            setScreen("main");
          } else {
            setAuthMode(mode);
            setScreen("welcome");
          }
        }} />}
        {screen === "welcome" && <Welcome initialMode={authMode} onDone={(target) => setScreen(target)} />}
        {screen === "builder" && <Builder editMode={editingProfile} onDone={() => { setEditingProfile(false); setScreen("main"); }} />}
        {screen === "main" && (
          <>
            {tab === "discover" && showAdmirers && <AdmirersPanel admirers={admirers} myLoc={deckOrigin} onLikeBack={likeBackAdmirer} onBack={() => setShowAdmirers(false)} onReport={(p) => setReporting({ profile: p, from: "admirers" })} />}
            {tab === "discover" && !showAdmirers && <Discover deck={sortedDeck} onSwipe={onSwipe} myLoc={deckOrigin} onGolden={onGolden} goldenLeft={goldenLeft} likesLeft={likesLeft} isPlus={isPlus} onUpgrade={() => setPaywall(true)} onReport={(p) => setReporting({ profile: p, from: "deck" })} locDenied={locDenied && !travelCity} />}
            {tab === "missions" && <Missions matches={matches} onSend={(idea) => setMissionToSend(idea)} />}
            {tab === "matches" && (chatWith
              ? <Chat profile={chatWith} onBack={() => setChatWith(null)} onDateCompleted={onDateCompleted} myLoc={myLoc} />
              : <Matches matches={matches} myLoc={myLoc} admirerCount={admirerCount} onUpgrade={openAdmirers} onReport={(p) => setReporting({ profile: p, from: "matches" })} onOpenChat={(p) => setChatWith(p)} />
            )}
            {tab === "profile" && <You onLegal={setLegal} onDelete={() => setDeleteOpen(true)} verifyStatus={verifyStatus} onVerify={() => setVerifyOpen(true)} onUpgrade={() => setPaywall(true)} onSignUp={() => { setAuthMode("signup"); setScreen("welcome"); setTab("discover"); }} onEditProfile={() => { setEditingProfile(true); setScreen("builder"); }} onLogout={logout} onOffClock={() => requirePlus("Off the Clock", "Go invisible without deleting anything. A TOM+ perk.", () => setOffClockOpen(true))} onPrimeTime={() => requirePlus("Weekly Prime Time", "Rise to the top of nearby decks for 7 days. A TOM+ perk.", () => setPrimeTimeOpen(true))} />}
            <nav style={{ display: "flex", justifyContent: "space-around", padding: "10px 8px 16px", background: T.white, borderTop: `1px solid ${T.lilac}` }}>
              {tabs.map((t) => (
                <button key={t.id} onClick={() => { setTab(t.id); setChatWith(null); }} style={{ border: "none", background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, opacity: tab === t.id ? 1 : 0.45, padding: "4px 14px" }}>
                  {React.createElement(t.icon, { s: 22, c: T.royal })}
                  <span style={nu(800, 11, T.royal)}>{t.label}</span>
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
        {timeZonesOpen && <TimeZonesModal current={travelCity} onPick={(c) => { setTravelCity(c); setTimeZonesOpen(false); }} onClose={() => setTimeZonesOpen(false)} />}
        {primeTimeOpen && <PrimeTimeModal onClose={() => setPrimeTimeOpen(false)} onActivate={startPrimeTime} boostUntil={boostUntil} />}
        {plusGate && <PlusGate title={plusGate.title} blurb={plusGate.blurb} onClose={() => setPlusGate(null)} onUpgrade={() => { setPlusGate(null); setPaywall(true); }} />}
        {missionToSend && <SendMissionModal idea={missionToSend} matches={matches} onPick={(p) => sendMissionTo(p, missionToSend)} onClose={() => setMissionToSend(null)} />}
        {pendingOutcome && <OutcomeModal pending={pendingOutcome} onAnswer={onOutcomeAnswered} onLater={() => setPendingOutcome(null)} />}
        {pendingReview && <ReviewModal pending={pendingReview} onDone={() => { setPendingReview(null); onDateCompleted(); }} onSkip={() => setPendingReview(null)} />}
      </div>
    </div>
  );
}
