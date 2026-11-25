-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20261102182852 · nom « 069_commerce_fk_indexes » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

CREATE INDEX IF NOT EXISTS idx_course_modules_course_id ON public.course_modules (course_id);
CREATE INDEX IF NOT EXISTS idx_course_progress_course_id ON public.course_progress (course_id);
CREATE INDEX IF NOT EXISTS idx_course_progress_module_id ON public.course_progress (module_id);
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON public.courses (instructor_id);
CREATE INDEX IF NOT EXISTS idx_custom_orders_artisan_id ON public.custom_orders (artisan_id);
CREATE INDEX IF NOT EXISTS idx_custom_orders_buyer_id ON public.custom_orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_product_favorites_product_id ON public.product_favorites (product_id);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_buyer_id ON public.rfq_requests (buyer_id);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_selected_supplier_id ON public.rfq_requests (selected_supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_responses_supplier_id ON public.rfq_responses (supplier_id);
