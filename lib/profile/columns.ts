/** Colonnes lisibles par le rôle authenticated. email, phone et address sont retirés (migration 037). */
export const PUBLIC_PROFILE_COLUMNS =
  "id, full_name, avatar_url, bio, user_type, city, country, is_verified, rating, total_reviews, scg_score, scg_badge, scg_bancable, created_at, subscription_tier, digest_enabled, preferred_language, profile_completion_pct, sub_type, coop_id"
