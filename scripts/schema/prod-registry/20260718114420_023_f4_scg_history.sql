-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20260718114420 · nom « 023_f4_scg_history » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

CREATE TABLE IF NOT EXISTS public.scg_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_total INT NOT NULL,
  badge TEXT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(profile_id, snapshot_date)
);
ALTER TABLE public.scg_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scg_history_owner ON public.scg_history;
CREATE POLICY scg_history_owner ON public.scg_history FOR SELECT USING (auth.uid() = profile_id);
CREATE OR REPLACE FUNCTION public.snapshot_scg_daily()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.scg_history (profile_id, score_total, badge, snapshot_date)
  VALUES (NEW.user_id, NEW.score_total, NEW.badge, CURRENT_DATE)
  ON CONFLICT (profile_id, snapshot_date)
  DO UPDATE SET score_total = EXCLUDED.score_total, badge = EXCLUDED.badge;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_scg_snapshot ON public.scg_scores;
CREATE TRIGGER trg_scg_snapshot AFTER INSERT OR UPDATE ON public.scg_scores FOR EACH ROW EXECUTE FUNCTION public.snapshot_scg_daily();
