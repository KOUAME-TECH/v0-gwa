-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20260810165130 · nom « messages_reviews_hardening » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
CREATE POLICY "messages_insert_participant" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())));

CREATE OR REPLACE FUNCTION public.protect_review_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), auth.role()); BEGIN IF jwt_role = 'service_role' THEN RETURN NEW; END IF; NEW.rating := OLD.rating; NEW.seller_id := OLD.seller_id; NEW.order_id := OLD.order_id; NEW.reviewer_id := OLD.reviewer_id; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_protect_review_update ON public.reviews;
CREATE TRIGGER trg_protect_review_update BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.protect_review_update();

CREATE OR REPLACE FUNCTION public.protect_review_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), auth.role()); v_seller uuid; BEGIN IF jwt_role = 'service_role' THEN RETURN NEW; END IF; IF NEW.order_id IS NOT NULL THEN SELECT seller_id INTO v_seller FROM public.orders WHERE id = NEW.order_id; IF v_seller IS NOT NULL THEN NEW.seller_id := v_seller; END IF; END IF; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_protect_review_insert ON public.reviews;
CREATE TRIGGER trg_protect_review_insert BEFORE INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.protect_review_insert();
