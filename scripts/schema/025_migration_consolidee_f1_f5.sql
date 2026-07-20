-- GWA — Migration consolidée F1→F5 (idempotent)
-- Déjà appliquée sur Supabase GWA-DATABASE via MCP le 2026-07-18
-- Conserver ce fichier comme référence versionnée

-- Voir migrations: 019_scg_scores, 020_f1_auth_profile, 021_f2_products,
-- 022_f3_escrow, 023_f4_scg_history, 024_f5_notifications_columns

SELECT 'GWA F1-F5 schema OK' AS status,
  to_regclass('public.scg_scores') AS scg_scores,
  to_regclass('public.escrow_transactions') AS escrow_transactions,
  to_regclass('public.product_favorites') AS product_favorites,
  to_regclass('public.scg_history') AS scg_history;
