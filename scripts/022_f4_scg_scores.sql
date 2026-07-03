-- ============================================================
-- GWA PLATFORM — Migration F4 : SCG Score de Confiance GWA
-- Moteur : Supabase Edge Function (TypeScript)
-- ADDITIVE — ne modifie pas les colonnes existantes
-- ============================================================

-- ============================================================
-- Table scg_scores (créer si inexistante, étendre sinon)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scg_scores (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_total      INT NOT NULL DEFAULT 0 CHECK (score_total BETWEEN 0 AND 1000),
  badge            TEXT NOT NULL DEFAULT 'debut',
  calculated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);

-- Étendre scg_scores avec les dimensions F4
ALTER TABLE public.scg_scores
  ADD COLUMN IF NOT EXISTS profil_type TEXT
    CHECK (profil_type IN ('producteur_individuel','cooperative')),
  ADD COLUMN IF NOT EXISTS score_fiabilite          INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_qualite            INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_volumes            INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_engagement         INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_institutionnel     INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_membres_pondere    INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taux_livraison_pct       NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_membres_actifs        INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seuil_bancabilite        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS eligible_credit          BOOLEAN DEFAULT FALSE;

-- Contrainte badge compatible producteur + cooperative
ALTER TABLE public.scg_scores DROP CONSTRAINT IF EXISTS scg_scores_badge_check;
ALTER TABLE public.scg_scores ADD CONSTRAINT scg_scores_badge_check
  CHECK (badge IN (
    'debut','actif','fiable','expert','elite',
    'cooperative_debutante','cooperative_active',
    'cooperative_confiance','cooperative_elite'
  ));

ALTER TABLE public.scg_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS scg_select_own ON public.scg_scores
  FOR SELECT USING (auth.uid() = profile_id);

-- Admin peut lire tous les scores
CREATE POLICY IF NOT EXISTS scg_select_admin ON public.scg_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_scg_profile    ON public.scg_scores(profile_id);
CREATE INDEX IF NOT EXISTS idx_scg_badge      ON public.scg_scores(badge);
CREATE INDEX IF NOT EXISTS idx_scg_total      ON public.scg_scores(score_total DESC);

-- ============================================================
-- Table scg_history (snapshot quotidien pour courbe 30 jours)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scg_history (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_total    INT NOT NULL,
  badge          TEXT NOT NULL,
  snapshot_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(profile_id, snapshot_date)
);

ALTER TABLE public.scg_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY scg_history_owner ON public.scg_history
  FOR SELECT USING (auth.uid() = profile_id);

CREATE INDEX IF NOT EXISTS idx_scg_history_profile ON public.scg_history(profile_id);
CREATE INDEX IF NOT EXISTS idx_scg_history_date    ON public.scg_history(snapshot_date DESC);

-- ============================================================
-- Trigger : snapshot SCG quotidien après chaque recalcul
-- ============================================================
CREATE OR REPLACE FUNCTION snapshot_scg_daily()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.scg_history (profile_id, score_total, badge, snapshot_date)
  VALUES (NEW.profile_id, NEW.score_total, NEW.badge, CURRENT_DATE)
  ON CONFLICT (profile_id, snapshot_date)
  DO UPDATE SET
    score_total = EXCLUDED.score_total,
    badge       = EXCLUDED.badge;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scg_snapshot ON public.scg_scores;
CREATE TRIGGER trg_scg_snapshot
  AFTER INSERT OR UPDATE ON public.scg_scores
  FOR EACH ROW EXECUTE FUNCTION snapshot_scg_daily();

-- ============================================================
-- Trigger : mettre à jour seuils après chaque recalcul
-- ============================================================
CREATE OR REPLACE FUNCTION update_scg_seuils()
RETURNS TRIGGER AS $$
BEGIN
  NEW.seuil_bancabilite := (NEW.score_total >= 500);
  NEW.eligible_credit   := (NEW.score_total >= 600);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scg_seuils ON public.scg_scores;
CREATE TRIGGER trg_scg_seuils
  BEFORE INSERT OR UPDATE ON public.scg_scores
  FOR EACH ROW EXECUTE FUNCTION update_scg_seuils();

-- ============================================================
-- Fonction helper : recalculer badge selon score
-- ============================================================
CREATE OR REPLACE FUNCTION compute_scg_badge(
  p_score   INT,
  p_sub_type TEXT
)
RETURNS TEXT AS $$
BEGIN
  IF p_sub_type = 'cooperative' THEN
    IF    p_score >= 800 THEN RETURN 'cooperative_elite';
    ELSIF p_score >= 600 THEN RETURN 'cooperative_confiance';
    ELSIF p_score >= 300 THEN RETURN 'cooperative_active';
    ELSE                      RETURN 'cooperative_debutante';
    END IF;
  ELSE
    IF    p_score >= 800 THEN RETURN 'elite';
    ELSIF p_score >= 600 THEN RETURN 'expert';
    ELSIF p_score >= 400 THEN RETURN 'fiable';
    ELSIF p_score >= 200 THEN RETURN 'actif';
    ELSE                      RETURN 'debut';
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- Trigger : recalcul SCG automatique après livraison confirmée
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_scg_recalculate_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
  -- Déclencher recalcul quand commande passe à 'livre'
  IF NEW.order_status = 'livre' AND
     (OLD.order_status IS NULL OR OLD.order_status != 'livre') THEN
    -- Appel de la Edge Function via net.http_post (pg_net)
    -- La Edge Function calculate-scg reçoit le profile_id et recalcule
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) ||
             '/functions/v1/calculate-scg',
      body := json_build_object(
        'profile_id', NEW.seller_id::text,
        'trigger_event', 'order_delivered',
        'order_id', NEW.id::text
      )::text,
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_scg_on_delivery ON public.orders;
CREATE TRIGGER trg_scg_on_delivery
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION trigger_scg_recalculate_on_delivery();
