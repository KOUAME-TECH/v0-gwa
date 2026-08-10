-- GWA Migration F4 : SCG History + triggers ADDITIVE UNIQUEMENT

ALTER TABLE public.scg_scores
  ADD COLUMN IF NOT EXISTS profil_type TEXT
    CHECK (profil_type IN ('producteur_individuel','cooperative')),
  ADD COLUMN IF NOT EXISTS score_fiabilite INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_qualite INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_engagement INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_volumes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_institutionnel INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_membres_pondere INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taux_livraison_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_membres_actifs INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seuil_bancabilite BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS eligible_credit BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.scg_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_total INT NOT NULL,
  badge TEXT NOT NULL,
  bancable BOOLEAN DEFAULT FALSE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(profile_id, snapshot_date)
);
ALTER TABLE public.scg_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scg_history_owner" ON public.scg_history;
CREATE POLICY "scg_history_owner" ON public.scg_history
  FOR SELECT USING (auth.uid() = profile_id);
CREATE INDEX IF NOT EXISTS idx_scg_history_profile
  ON public.scg_history(profile_id, snapshot_date DESC);

CREATE OR REPLACE FUNCTION snapshot_scg_daily()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.scg_history (profile_id, score_total, badge, bancable, snapshot_date)
  VALUES (NEW.user_id, NEW.score_total, NEW.badge, NEW.bancable, CURRENT_DATE)
  ON CONFLICT (profile_id, snapshot_date)
  DO UPDATE SET
    score_total = EXCLUDED.score_total,
    badge       = EXCLUDED.badge,
    bancable    = EXCLUDED.bancable;
  UPDATE public.profiles SET
    scg_score         = NEW.score_total,
    scg_badge         = NEW.badge,
    scg_bancable      = NEW.bancable,
    scg_calculated_at = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_scg_snapshot ON public.scg_scores;
CREATE TRIGGER trg_scg_snapshot
  AFTER INSERT OR UPDATE ON public.scg_scores
  FOR EACH ROW EXECUTE FUNCTION snapshot_scg_daily();
