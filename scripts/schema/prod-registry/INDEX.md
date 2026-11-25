# Registre des migrations prod ↔ dépôt (reconstitution du 25/11/2026)

Source : `supabase_migrations.schema_migrations` du projet prod `frorfexbcyfbydkiwxqv`, lu le 25/11/2026 vers 12:20 (Africa/Abidjan). 79 entrées.

- **Présent** : un fichier `scripts/schema/NNN_*.sql` porte la même migration.
- **Reconstitué** : aucun fichier équivalent. Le SQL **exact tel qu'appliqué** (colonne `statements` du registre) est copié dans `scripts/schema/prod-registry/<version>_<nom>.sql`. Ces fichiers sont **documentaires** : ils sont déjà en prod, il ne faut **pas** les rejouer.
- « Recoupe » : un fichier consolidé du dépôt couvre une partie des mêmes objets.

| Version (UTC) | Nom au registre | Statut | Fichier |
|---|---|---|---|
| 20260718114407 | 019_scg_scores | Présent | `019_scg_scores.sql` |
| 20260718114410 | 020_f1_auth_profile | Présent | `020_f1_auth_profile.sql` |
| 20260718114416 | 021_f2_products | Reconstitué (recoupe 025_migration_consolidee_f1_f5) | `prod-registry/20260718114416_021_f2_products.sql` |
| 20260718114418 | 022_f3_escrow | Reconstitué (recoupe 025_migration_consolidee_f1_f5) | `prod-registry/20260718114418_022_f3_escrow.sql` |
| 20260718114420 | 023_f4_scg_history | Reconstitué (recoupe 025_migration_consolidee_f1_f5) | `prod-registry/20260718114420_023_f4_scg_history.sql` |
| 20260718114427 | 024_f5_notifications_columns | Reconstitué (recoupe 025_migration_consolidee_f1_f5) | `prod-registry/20260718114427_024_f5_notifications_columns.sql` |
| 20260718121902 | 026_ocpv_prices_realtime | Reconstitué | `prod-registry/20260718121902_026_ocpv_prices_realtime.sql` |
| 20260718131656 | 027_drop_ocpv_prices | Reconstitué | `prod-registry/20260718131656_027_drop_ocpv_prices.sql` |
| 20260718223557 | saas_security_hardening | Présent | `026_saas_security_hardening.sql` |
| 20260718223809 | revoke_trigger_fn_execute | Reconstitué | `prod-registry/20260718223809_revoke_trigger_fn_execute.sql` |
| 20260718223929 | profiles_pii_select_hardening | Présent | `027_profiles_pii_hardening.sql` |
| 20260718223954 | profiles_select_restore_directory | Reconstitué | `prod-registry/20260718223954_profiles_select_restore_directory.sql` |
| 20260718235001 | 028_protect_phone | Présent | `028_protect_phone.sql` |
| 20260719001331 | 030_invoices | Présent | `030_invoices.sql` |
| 20260719001334 | 029_factoring | Présent | `029_factoring.sql` |
| 20260719011425 | fix_verified_badge | Présent | `031_fix_verified_badge.sql` |
| 20260719011547 | media_video_audio | Présent | `032_media_video_audio.sql` |
| 20260719014838 | consolidate_user_types | Présent | `033_consolidate_user_types.sql` |
| 20260719033106 | 034_fix_admin_roles_rls_recursion | Présent | `034_fix_admin_roles_rls_recursion.sql` |
| 20260720013710 | 035_security_hardening_storage_rpc_audit | Présent | `035_security_hardening_storage_rpc_audit.sql` |
| 20260721183055 | harmattan_digest_pg_cron | Présent | `041_harmattan_digest_pg_cron.sql` |
| 20260722224939 | user_places_link_cooldown | Présent | `042_user_places_link_cooldown.sql` |
| 20260723011939 | contact_messages | Présent | `043_contact_messages.sql` |
| 20260723012306 | fix_harmattan_digest_044 | Présent | `044_fix_harmattan_digest.sql` |
| 20260723012322 | notifications_allow_digest_type | Reconstitué | `prod-registry/20260723012322_notifications_allow_digest_type.sql` |
| 20260723015851 | comment_likes_and_verification_type | Reconstitué | `prod-registry/20260723015851_comment_likes_and_verification_type.sql` |
| 20260723023554 | 046a_review_parent_likes | Reconstitué | `prod-registry/20260723023554_046a_review_parent_likes.sql` |
| 20260723023609 | 046c_comment_count_triggers | Reconstitué | `prod-registry/20260723023609_046c_comment_count_triggers.sql` |
| 20260723023635 | 046d_digest_novelty_only | Reconstitué | `prod-registry/20260723023635_046d_digest_novelty_only.sql` |
| 20260724050113 | 047_yelly_conversations | Présent | `047_yelly_conversations.sql` |
| 20260724160710 | 048_advisor_hardening | Présent | `048_advisor_hardening.sql` |
| 20260728032548 | coop_validation_account_lock | Présent | `049_coop_validation_account_lock.sql` |
| 20260728034801 | coop_multi_managers | Présent | `050_coop_multi_managers.sql` |
| 20260728043153 | platform_secrets | Présent | `051_platform_secrets.sql` |
| 20260728052656 | subscription_requests | Présent | `052_subscription_requests.sql` |
| 20260728060723 | 053_payout_withdrawals_entitlements | Présent | `053_payout_withdrawals_entitlements.sql` |
| 20260731002852 | 054_advisor_hardening_jul31 | Présent | `054_advisor_hardening_jul31.sql` |
| 20260731003054 | 054b_coop_helpers_private_schema | Présent | `054b_coop_helpers_private_schema.sql` |
| 20260731010346 | 055_drop_unused_indexes_legacy | Présent | `055_drop_unused_indexes_legacy.sql` |
| 20260803164413 | protect_privileged_service_role_only | Présent | `056_protect_privileged_service_role_only.sql` |
| 20260810024651 | anti_speculation_hardening_057 | Reconstitué | `prod-registry/20260810024651_anti_speculation_hardening_057.sql` |
| 20260810024720 | profiles_self_pii_security_definer | Reconstitué | `prod-registry/20260810024720_profiles_self_pii_security_definer.sql` |
| 20260810040347 | expert_hacker_hardening | Reconstitué | `prod-registry/20260810040347_expert_hacker_hardening.sql` |
| 20260810043300 | self_regulate_money_offers | Reconstitué | `prod-registry/20260810043300_self_regulate_money_offers.sql` |
| 20260810160711 | insert_path_hardening | Reconstitué | `prod-registry/20260810160711_insert_path_hardening.sql` |
| 20260810165130 | messages_reviews_hardening | Reconstitué | `prod-registry/20260810165130_messages_reviews_hardening.sql` |
| 20260810165712 | 062_money_insert_products_factoring | Reconstitué | `prod-registry/20260810165712_062_money_insert_products_factoring.sql` |
| 20260810170526 | 063_escrow_insert_service_only | Reconstitué | `prod-registry/20260810170526_063_escrow_insert_service_only.sql` |
| 20260810185918 | 064_freeze_social_counters | Reconstitué | `prod-registry/20260810185918_064_freeze_social_counters.sql` |
| 20260820113728 | product_like_dislike_064 | Reconstitué | `prod-registry/20260820113728_product_like_dislike_064.sql` |
| 20261021155510 | geniuspay_naming | Présent | `054_geniuspay_naming.sql` |
| 20261022101951 | 060_private_kyc_storage | Présent | `060_private_kyc_storage.sql` |
| 20261102140231 | 066_security_advisors_hardening | Reconstitué | `prod-registry/20261102140231_066_security_advisors_hardening.sql` |
| 20261102154743 | 066_chat_media_security | Présent | `066_chat_media_security.sql` |
| 20261102175535 | 067_chat_group_fk_indexes | Reconstitué | `prod-registry/20261102175535_067_chat_group_fk_indexes.sql` |
| 20261102182649 | 068_chat_media_private_bucket | Reconstitué | `prod-registry/20261102182649_068_chat_media_private_bucket.sql` |
| 20261102182852 | 069_commerce_fk_indexes | Reconstitué | `prod-registry/20261102182852_069_commerce_fk_indexes.sql` |
| 20261102192945 | profiles_anon_hide_pii_columns | Reconstitué | `prod-registry/20261102192945_profiles_anon_hide_pii_columns.sql` |
| 20261103102411 | 058_order_currency | Présent | `058_order_currency.sql` |
| 20261103182700 | pricing_plans_two_grids | Reconstitué (recoupe 067_pricing_plans (partiel)) | `prod-registry/20261103182700_pricing_plans_two_grids.sql` |
| 20261103182718 | pricing_plans_tables_seed | Reconstitué (recoupe 067_pricing_plans (partiel)) | `prod-registry/20261103182718_pricing_plans_tables_seed.sql` |
| 20261103182726 | pricing_quote_function_and_trigger | Reconstitué (recoupe 067_pricing_plans (partiel)) | `prod-registry/20261103182726_pricing_quote_function_and_trigger.sql` |
| 20261103182731 | pricing_rls_and_profile_lock | Reconstitué (recoupe 067_pricing_plans (partiel)) | `prod-registry/20261103182731_pricing_rls_and_profile_lock.sql` |
| 20261103182755 | pricing_private_tables_explicit_deny | Reconstitué (recoupe 067_pricing_plans (partiel)) | `prod-registry/20261103182755_pricing_private_tables_explicit_deny.sql` |
| 20261103191445 | order_lifecycle_history | Reconstitué (recoupe 068_order_lifecycle (partiel)) | `prod-registry/20261103191445_order_lifecycle_history.sql` |
| 20261103191533 | fix_order_protect_drop_feexpay_ref | Reconstitué (recoupe 068_order_lifecycle (partiel)) | `prod-registry/20261103191533_fix_order_protect_drop_feexpay_ref.sql` |
| 20261103191541 | order_lifecycle_triggers_backfill | Reconstitué (recoupe 068_order_lifecycle (partiel)) | `prod-registry/20261103191541_order_lifecycle_triggers_backfill.sql` |
| 20261104072143 | profile_privacy_and_conversation_gate | Reconstitué | `prod-registry/20261104072143_profile_privacy_and_conversation_gate.sql` |
| 20261104072236 | profile_column_grants | Reconstitué | `prod-registry/20261104072236_profile_column_grants.sql` |
| 20261104074122 | notify_channel_prefs | Reconstitué | `prod-registry/20261104074122_notify_channel_prefs.sql` |
| 20261105095945 | vision100_schema_mission1 | Reconstitué (recoupe 073_vision100_pricing (partiel)) | `prod-registry/20261105095945_vision100_schema_mission1.sql` |
| 20261105101223 | vision100_mission2_preorder_ledger | Reconstitué (recoupe 073_vision100_pricing (partiel)) | `prod-registry/20261105101223_vision100_mission2_preorder_ledger.sql` |
| 20261105103122 | vision100_pricing_nov5 | Présent | `073_vision100_pricing.sql` |
| 20261105103129 | vision100_pricing_quote_fn | Reconstitué (recoupe 073_vision100_pricing (partiel)) | `prod-registry/20261105103129_vision100_pricing_quote_fn.sql` |
| 20261105104836 | vision100_payout_fee | Présent | `074_vision100_payout.sql` |
| 20261105110723 | vision100_franchise_surplus | Reconstitué (recoupe 075_franchise_surplus (partiel)) | `prod-registry/20261105110723_vision100_franchise_surplus.sql` |
| 20261125112135 | 078_security_modules | Présent | `078_security_modules.sql` |
| 20261125114449 | 080_chat_reactions_hidden | Présent | `080_chat_reactions_hidden.sql` |
| 20261125114508 | 081_payout_fk_indexes | Présent | `081_payout_fk_indexes.sql` |

## Objets en prod hors registre

Appliqués par l'éditeur SQL ou par `execute_sql` sans entrée au registre. Tous ont une source dans le dépôt, sauf mention contraire :

- Scripts 001 à 018 (création initiale, appliqués avant l'adoption du registre).
- **065_manual_seller_payouts, 077_gwa_post_release_split, 079_payout_ledger** (appliqués le 25/11/2026 par execute_sql) : fichiers présents dans `scripts/schema/`, **non inscrits au registre**. Inscription à faire (métadonnée seulement).

- table hors registre : 2 — `admin_logs` (004_admin_system.sql), `withdrawal_request_events` (065_manual_seller_payouts.rollback.sql, 065_manual_seller_payouts.sql, 079_payout_ledger.rollback.sql)
- index hors registre : 20 — `idx_products_moderation` (004_admin_system.sql), `idx_withdrawal_events_request_created` (065_manual_seller_payouts.sql), `idx_disputes_order_id` (004_admin_system.sql), `idx_audit_logs_severity` (015_create_audit_logs.sql), `financial_ledger_reversal_of_idx` (**aucun fichier**), `idx_audit_logs_target` (015_create_audit_logs.sql), `financial_ledger_payout_leg_uidx` (079_payout_ledger.rollback.sql, 079_payout_ledger.sql), `idx_audit_logs_user_id` (015_create_audit_logs.sql), `idx_posts_author` (003_advanced_tables.sql), `idx_announcements_active` (004_admin_system.sql), `idx_coop_members` (003_advanced_tables.sql), `idx_audit_logs_created_at` (015_create_audit_logs.sql), `idx_verification_requests_status` (004_admin_system.sql), `idx_audit_logs_action` (015_create_audit_logs.sql), `idx_rfq_status` (003_advanced_tables.sql), `idx_profiles_suspended` (004_admin_system.sql), `idx_disputes_status` (004_admin_system.sql), `idx_posts_created` (003_advanced_tables.sql), `idx_admin_logs_created_at` (004_admin_system.sql), `idx_admin_logs_admin_id` (004_admin_system.sql)
- function hors registre : 8 — `orders_freeze_payout_fee` (077_gwa_post_release_split.rollback.sql, 077_gwa_post_release_split.sql), `gwa_post_release_split` (077_gwa_post_release_split.rollback.sql, 077_gwa_post_release_split.sql, 079_payout_ledger.sql), `gwa_seller_wallet_balance` (079_payout_ledger.rollback.sql, 079_payout_ledger.sql), `gwa_payout_eligible_orders` (065_manual_seller_payouts.rollback.sql, 065_manual_seller_payouts.sql, 079_payout_ledger.sql), `request_manual_payout` (065_manual_seller_payouts.rollback.sql, 065_manual_seller_payouts.sql, 079_payout_ledger.sql), `get_seller_eligible_proceeds` (065_manual_seller_payouts.rollback.sql, 065_manual_seller_payouts.sql, 079_payout_ledger.sql), `get_seller_earnings_summary` (065_manual_seller_payouts.rollback.sql, 065_manual_seller_payouts.sql), `admin_update_manual_payout` (065_manual_seller_payouts.rollback.sql, 065_manual_seller_payouts.sql, 079_payout_ledger.rollback.sql)
- trigger hors registre : 4 — `on_post_like_change` (003_advanced_tables.sql), `set_rfq_number` (003_advanced_tables.sql), `on_post_comment_change` (003_advanced_tables.sql), `trg_z_orders_freeze_payout_fee` (077_gwa_post_release_split.rollback.sql, 077_gwa_post_release_split.sql)
- policy hors registre : 80 — `cart_items_delete_own` (001_create_tables.sql), `cart_items_insert_own` (001_create_tables.sql), `cart_items_select_own` (001_create_tables.sql), `cart_items_update_own` (001_create_tables.sql), `favorites_delete_own` (001_create_tables.sql), `favorites_insert_own` (001_create_tables.sql), `favorites_select_own` (001_create_tables.sql), `custom_orders_insert_buyer` (001_create_tables.sql), `custom_orders_select_own` (001_create_tables.sql), `custom_orders_update_participants` (001_create_tables.sql), `categories_select_all` (001_create_tables.sql), `reviews_delete_own` (001_create_tables.sql), `reviews_select_all` (001_create_tables.sql), `reviews_update_own` (001_create_tables.sql), `coop_members_select` (003_advanced_tables.sql), `courses_insert_auth` (003_advanced_tables.sql), `courses_select_published` (003_advanced_tables.sql), `courses_update_own` (003_advanced_tables.sql), `progress_insert_own` (003_advanced_tables.sql), `progress_select_own` (003_advanced_tables.sql), `progress_update_own` (003_advanced_tables.sql), `followers_delete_own` (003_advanced_tables.sql), `followers_insert_own` (003_advanced_tables.sql), `followers_select_all` (003_advanced_tables.sql), `audit_insert_participants` (003_advanced_tables.sql) …

Sans aucune source dans le dépôt : l'index `financial_ledger_reversal_of_idx`.

Fichiers du dépôt sans entrée correspondante au registre (appliqués hors registre, fusionnés dans une autre entrée ou jamais appliqués ; à vérifier objet par objet) : `001_create_tables`, `002_seed_categories`, `003_advanced_tables`, `004_admin_system`, `006_seed_categories_settings`, `007_enable_realtime`, `008_enhance_messages`, `009_create_storage_buckets`, `010_fix_messages_triggers`, `011_fix_post_type_and_cleanup`, `012_fix_posts_fk`, `013_fix_admin_rls`, `015_create_audit_logs`, `025_migration_consolidee_f1_f5`, `036_partner_foundation`, `037_profiles_pii_restrict`, `038_whatsapp_audio_rich_media`, `039_comment_voice_listen`, `040_harmattan_digest`, `045_comment_likes_verification_notif`, `046_comments_sync_digest_novelty`, `057_geniuspay_payment_reference`, `059_server_owned_order_creation`, `061_agriculture_product_rls`, `065_manual_seller_payouts`, `067_pricing_plans`, `068_order_lifecycle`, `075_franchise_surplus`, `076_profile_self_owner_read`, `077_gwa_post_release_split`, `079_payout_ledger`.
