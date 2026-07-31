-- 055 — Drop unused indexes on hors-scope / legacy tables only
-- (courses, groups, RFQ, artisan custom_orders, product_favorites)
-- Ne PAS toucher aux index products/orders/profiles/messages : trafic bêta faible ≠ faux « unused ».

DROP INDEX IF EXISTS public.idx_fk_course_modules_course_id;
DROP INDEX IF EXISTS public.idx_fk_course_progress_course_id;
DROP INDEX IF EXISTS public.idx_fk_course_progress_module_id;
DROP INDEX IF EXISTS public.idx_courses_category;
DROP INDEX IF EXISTS public.idx_fk_courses_instructor_id;
DROP INDEX IF EXISTS public.idx_fk_custom_orders_artisan_id;
DROP INDEX IF EXISTS public.idx_fk_custom_orders_buyer_id;
DROP INDEX IF EXISTS public.idx_fk_group_conversations_created_by;
DROP INDEX IF EXISTS public.idx_fk_group_members_user_id;
DROP INDEX IF EXISTS public.idx_fk_group_messages_group_id;
DROP INDEX IF EXISTS public.idx_fk_group_messages_reply_to_id;
DROP INDEX IF EXISTS public.idx_fk_group_messages_sender_id;
DROP INDEX IF EXISTS public.idx_fk_product_favorites_product_id;
DROP INDEX IF EXISTS public.idx_fk_rfq_requests_buyer_id;
DROP INDEX IF EXISTS public.idx_fk_rfq_requests_selected_supplier_id;
DROP INDEX IF EXISTS public.idx_fk_rfq_responses_supplier_id;
