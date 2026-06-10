-- GWA — Stockage des scores SCG (Score de Confiance GWA) v1.0
-- Ref: GWA-TECH-SCG-014

-- Colonnes SCG sur profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scg_score INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scg_badge TEXT DEFAULT 'insuffisant';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scg_bancable BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scg_calculated_at TIMESTAMPTZ;

-- Table snapshot des scores (pour graphe historique + audit)
CREATE TABLE IF NOT EXISTS public.scg_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_total INTEGER NOT NULL,
  badge TEXT NOT NULL,
  bancable BOOLEAN DEFAULT FALSE,
  dim_fiabilite INTEGER DEFAULT 0,
  dim_qualite INTEGER DEFAULT 0,
  dim_engagement INTEGER DEFAULT 0,
  dim_volumes INTEGER DEFAULT 0,
  dim_stabilite INTEGER DEFAULT 0,
  recommandation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scg_scores_user ON public.scg_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scg_scores_created ON public.scg_scores(created_at DESC);

-- RLS : un utilisateur voit ses propres scores, tout le monde voit les scores publics des profils (lecture)
ALTER TABLE public.scg_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scg_scores_select_own" ON public.scg_scores;
CREATE POLICY "scg_scores_select_own" ON public.scg_scores
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "scg_scores_insert_own" ON public.scg_scores;
CREATE POLICY "scg_scores_insert_own" ON public.scg_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);
