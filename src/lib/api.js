import { supabase } from "./supabaseClient.js";

/* ============================================================
   AUTH
   ============================================================ */
export async function signUp({ email, password, username }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase.from("profiles").update(updates).eq("id", userId).select().single();
  if (error) throw error;
  return data;
}

/* ============================================================
   STRAINS + STATS
   ============================================================ */
export async function fetchStrains() {
  const { data, error } = await supabase
    .from("strains")
    .select(`*, brands(id,name,slug), strain_flavour_tags(tag), strain_aroma_tags(tag)`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(normalizeStrain);
}

export async function fetchStrainBySlug(slug) {
  const { data, error } = await supabase
    .from("strains")
    .select(`*, brands(id,name,slug,logo_url), strain_flavour_tags(tag), strain_aroma_tags(tag)`)
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return normalizeStrain(data);
}

function normalizeStrain(row) {
  return {
    ...row,
    flavourTags: (row.strain_flavour_tags || []).map((t) => t.tag),
    aromaTags: (row.strain_aroma_tags || []).map((t) => t.tag),
    brand: row.brands,
  };
}

// Single call for a strain's live Blaze Score + component averages.
// Backed by the `strain_stats` SQL view (see supabase/schema.sql) so the
// math lives in one place and can't drift between client and server.
export async function fetchStrainStats(strainId) {
  const { data, error } = await supabase.rpc("get_strain_stats", { p_strain_id: strainId });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return { score: null, flavour: 0, aroma: 0, appearance: 0, overall: 0, wouldAgainPct: 0, reviewCount: 0 };
  return {
    score: row.blaze_score,
    flavour: Number(row.avg_flavour),
    aroma: Number(row.avg_aroma),
    appearance: Number(row.avg_appearance),
    overall: Number(row.avg_overall),
    wouldAgainPct: Number(row.would_again_pct),
    reviewCount: Number(row.review_count),
  };
}

// Bulk stats for every strain in one round trip (used on Home / What's Smoking / Discover)
export async function fetchAllStrainStats() {
  const { data, error } = await supabase.from("strain_stats").select("*");
  if (error) throw error;
  const map = {};
  data.forEach((row) => {
    map[row.strain_id] = {
      score: row.blaze_score,
      flavour: Number(row.avg_flavour),
      aroma: Number(row.avg_aroma),
      appearance: Number(row.avg_appearance),
      overall: Number(row.avg_overall),
      wouldAgainPct: Number(row.would_again_pct),
      reviewCount: Number(row.review_count),
    };
  });
  return map;
}

// Ranking movement (↑ / ↓ / NEW) — compares the live rank order to the
// most recent snapshot row written by snapshot_rankings() (run daily via
// pg_cron or a scheduled Edge Function).
export async function fetchRankingMovement(period = "daily") {
  const { data, error } = await supabase.rpc("get_ranking_movement", { p_period: period });
  if (error) throw error;
  const map = {};
  data.forEach((row) => {
    map[row.strain_id] = row.previous_rank ?? null; // null => NEW
  });
  return map;
}

/* ============================================================
   REVIEWS
   ============================================================ */
export async function fetchReviewsForStrain(strainId) {
  const { data, error } = await supabase
    .from("reviews")
    .select(`*, profiles(username,avatar_url), review_flavour_tags(tag), review_aroma_tags(tag), helpful_votes(user_id)`)
    .eq("strain_id", strainId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    ...r,
    author: r.profiles?.username || "blazer",
    flavourTags: (r.review_flavour_tags || []).map((t) => t.tag),
    aromaTags: (r.review_aroma_tags || []).map((t) => t.tag),
    helpful: (r.helpful_votes || []).length,
  }));
}

export async function fetchReviewsByUser(userId) {
  const { data, error } = await supabase
    .from("reviews")
    .select(`*, strains(name,slug,id)`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Upserts because the schema enforces one review per (user, strain) —
// resubmitting is treated as "updating your review", same as most
// review platforms (Letterboxd, Untappd, etc).
export async function submitReview(strainId, userId, { flavour, aroma, appearance, overall, wouldAgain, text, flavourTags, aromaTags }) {
  const { data: review, error } = await supabase
    .from("reviews")
    .upsert(
      {
        strain_id: strainId,
        user_id: userId,
        flavour_rating: flavour,
        aroma_rating: aroma,
        appearance_rating: appearance,
        overall_rating: overall,
        would_blaze_again: wouldAgain,
        written_review: text,
      },
      { onConflict: "user_id,strain_id" }
    )
    .select()
    .single();
  if (error) throw error;

  // replace tag rows for this review
  await supabase.from("review_flavour_tags").delete().eq("review_id", review.id);
  await supabase.from("review_aroma_tags").delete().eq("review_id", review.id);
  if (flavourTags?.length) {
    await supabase.from("review_flavour_tags").insert(flavourTags.map((tag) => ({ review_id: review.id, tag })));
  }
  if (aromaTags?.length) {
    await supabase.from("review_aroma_tags").insert(aromaTags.map((tag) => ({ review_id: review.id, tag })));
  }
  return review;
}

export async function uploadReviewImage(reviewId, file) {
  const path = `${reviewId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from("review-images").upload(path, file);
  if (upErr) throw upErr;
  const { data } = supabase.storage.from("review-images").getPublicUrl(path);
  const { error } = await supabase.from("review_images").insert({ review_id: reviewId, image_url: data.publicUrl });
  if (error) throw error;
  return data.publicUrl;
}

export async function markHelpful(reviewId, userId) {
  const { error } = await supabase.from("helpful_votes").upsert({ review_id: reviewId, user_id: userId });
  if (error) throw error;
}

export async function reportContent(reporterId, targetType, targetId, reason) {
  const { error } = await supabase.from("reports").insert({ reporter_id: reporterId, target_type: targetType, target_id: targetId, reason });
  if (error) throw error;
}

/* ============================================================
   BRANDS
   ============================================================ */
export async function fetchBrands() {
  const { data, error } = await supabase.from("brands").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function fetchBrandBySlug(slug) {
  const { data, error } = await supabase.from("brands").select("*").eq("slug", slug).single();
  if (error) throw error;
  return data;
}

export async function toggleFollowBrand(userId, brandId, isFollowing) {
  if (isFollowing) {
    const { error } = await supabase.from("followed_brands").delete().eq("user_id", userId).eq("brand_id", brandId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("followed_brands").insert({ user_id: userId, brand_id: brandId });
    if (error) throw error;
  }
}

export async function fetchFollowedBrandIds(userId) {
  const { data, error } = await supabase.from("followed_brands").select("brand_id").eq("user_id", userId);
  if (error) throw error;
  return data.map((r) => r.brand_id);
}

export async function claimBrand(userId, brandId, evidence) {
  const { error } = await supabase.from("brand_claims").insert({ user_id: userId, brand_id: brandId, evidence });
  if (error) throw error;
}

/* ============================================================
   SAVED STRAINS
   ============================================================ */
export async function toggleSaveStrain(userId, strainId, isSaved) {
  if (isSaved) {
    const { error } = await supabase.from("saved_strains").delete().eq("user_id", userId).eq("strain_id", strainId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("saved_strains").insert({ user_id: userId, strain_id: strainId });
    if (error) throw error;
  }
}

export async function fetchSavedStrainIds(userId) {
  const { data, error } = await supabase.from("saved_strains").select("strain_id").eq("user_id", userId);
  if (error) throw error;
  return data.map((r) => r.strain_id);
}

/* ============================================================
   SEARCH
   ============================================================ */
export async function searchAll(query) {
  if (!query.trim()) return { strains: [], brands: [] };
  const [{ data: strains, error: e1 }, { data: brands, error: e2 }] = await Promise.all([
    supabase.from("strains").select("id,name,slug,genetics_text").ilike("name", `%${query}%`).limit(6),
    supabase.from("brands").select("id,name,slug,country").ilike("name", `%${query}%`).limit(4),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return { strains, brands };
}

/* ============================================================
   BLAZE BATTLES
   ============================================================ */
export async function fetchActiveBattles() {
  const { data, error } = await supabase
    .from("blaze_battles")
    .select(`*, a:strain_a_id(id,name,slug,image_url), b:strain_b_id(id,name,slug,image_url)`)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data;
}

export async function fetchBattleVoteCounts(battleId) {
  const { data, error } = await supabase.from("battle_votes").select("strain_id").eq("battle_id", battleId);
  if (error) throw error;
  return data;
}

export async function voteBattle(battleId, userId, strainId) {
  const { error } = await supabase.from("battle_votes").insert({ battle_id: battleId, user_id: userId, strain_id: strainId });
  if (error) throw error; // unique(battle_id,user_id) blocks a second vote
}

/* ============================================================
   ADMIN
   ============================================================ */
export async function adminAddBrand(payload) {
  const { data, error } = await supabase.from("brands").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function adminAddStrain(payload, flavourTags = [], aromaTags = []) {
  const { data: strain, error } = await supabase.from("strains").insert(payload).select().single();
  if (error) throw error;
  if (flavourTags.length) await supabase.from("strain_flavour_tags").insert(flavourTags.map((tag) => ({ strain_id: strain.id, tag })));
  if (aromaTags.length) await supabase.from("strain_aroma_tags").insert(aromaTags.map((tag) => ({ strain_id: strain.id, tag })));
  return strain;
}

export async function adminDeleteReview(reviewId) {
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
  if (error) throw error;
}

export async function fetchOpenReports() {
  const { data, error } = await supabase.from("reports").select("*").eq("status", "open").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function resolveReport(reportId, adminId, status) {
  const { error } = await supabase.from("reports").update({ status, resolved_at: new Date().toISOString(), resolved_by: adminId }).eq("id", reportId);
  if (error) throw error;
}
