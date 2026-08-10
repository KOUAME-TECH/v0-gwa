-- ============================================================
-- GWA — Migration consolidée F1 à F5
-- Regroupe les scripts 020 à 024
-- ADDITIVE UNIQUEMENT — safe à ré-exécuter
-- ============================================================


-- === PRÉREQUIS : scg_scores (si pas encore créée) ===
CREATE TABLE IF NOT EXISTS public.scg_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_total INTEGER NOT NULL DEFAULT 0,
  badge TEXT NOT NULL DEFAULT 'insuffisant',
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
ALTER TABLE public.scg_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scg_scores_select_own" ON public.scg_scores;
CREATE POLICY "scg_scores_select_own" ON public.scg_scores FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "scg_scores_insert_service" ON public.scg_scores;
CREATE POLICY "scg_scores_insert_service" ON public.scg_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "scg_scores_update_service" ON public.scg_scores;
CREATE POLICY "scg_scores_update_service" ON public.scg_scores FOR UPDATE USING (auth.uid() = user_id);

-- Colonnes SCG sur profiles (prérequis)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scg_score INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scg_badge TEXT DEFAULT 'insuffisant';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scg_bancable BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scg_calculated_at TIMESTAMPTZ;


-- === MIGRATION TABLE notifications EXISTANTE ===
-- La table notifications existe déjà (001_create_tables.sql) avec colonnes message/is_read/link
-- On ajoute les colonnes manquantes pour la compatibilité F5
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;

-- Synchroniser body = message pour compatibilité
UPDATE public.notifications SET body = message WHERE body IS NULL AND message IS NOT NULL;
UPDATE public.notifications SET read = is_read WHERE read IS NULL;

-- Recréer la contrainte type avec les nouvelles valeurs acceptées
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('order','message','review','system','promotion',
                  'order_status','payment','scg_change','coop_join','coop_creation','yelly_alert'));

CREATE INDEX IF NOT EXISTS idx_notif_user_read
  ON public.notifications(user_id, read, created_at DESC);


-- === F1 PROFILES ===
-- ============================================================
-- GWA — Migration F1 : Extension table profiles
-- ADDITIVE UNIQUEMENT — n'affecte pas les colonnes existantes
-- ============================================================

-- 1. Colonnes sous-type et completion
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sub_type TEXT
    CHECK (sub_type IN ('producteur_individuel','cooperative'))
    DEFAULT 'producteur_individuel',
  ADD COLUMN IF NOT EXISTS profile_completion_pct INT DEFAULT 0
    CHECK (profile_completion_pct BETWEEN 0 AND 100);

-- 2. Colonnes spécifiques PRODUCTEUR INDIVIDUEL
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS surface_ha NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS filieres TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mode_culture TEXT
    CHECK (mode_culture IN ('traditionnel','semi-intensif','intensif') OR mode_culture IS NULL),
  ADD COLUMN IF NOT EXISTS certif_bio BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS certif_fairtrade BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS annee_debut_activite INT,
  ADD COLUMN IF NOT EXISTS coordonnees_gps TEXT;

-- 3. Colonnes spécifiques COOPERATIVE
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rccm_numero TEXT,
  ADD COLUMN IF NOT EXISTS rccm_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nb_membres INT,
  ADD COLUMN IF NOT EXISTS nb_hectares_total NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS president_name TEXT,
  ADD COLUMN IF NOT EXISTS secretary_name TEXT,
  ADD COLUMN IF NOT EXISTS commercial_contact TEXT,
  ADD COLUMN IF NOT EXISTS coop_type TEXT
    CHECK (coop_type IN ('GIE','SCOOP','SA','SARL','association') OR coop_type IS NULL),
  ADD COLUMN IF NOT EXISTS zones_production TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS capacite_stockage_tonnes NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS a_vehicule_transport BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS coop_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Abonnement
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free'
    CHECK (subscription_tier IN ('free','starter','pro','enterprise'));

-- 5. OneSignal player ID (F4 push)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT;

-- 6. Index
CREATE INDEX IF NOT EXISTS idx_profiles_sub_type ON public.profiles(sub_type);
CREATE INDEX IF NOT EXISTS idx_profiles_filieres ON public.profiles USING gin(filieres);
CREATE INDEX IF NOT EXISTS idx_profiles_coop_id ON public.profiles(coop_id);

-- 7. Trigger calcul automatique profile_completion_pct
CREATE OR REPLACE FUNCTION calc_profile_completion()
RETURNS TRIGGER AS $$
DECLARE v_pct INT := 0;
BEGIN
  IF NEW.full_name IS NOT NULL THEN v_pct := v_pct + 10; END IF;
  IF NEW.phone    IS NOT NULL THEN v_pct := v_pct + 10; END IF;
  IF NEW.city     IS NOT NULL THEN v_pct := v_pct + 5;  END IF;
  IF NEW.avatar_url IS NOT NULL THEN v_pct := v_pct + 10; END IF;
  IF NEW.bio IS NOT NULL AND length(NEW.bio) > 20 THEN v_pct := v_pct + 5; END IF;
  IF NEW.sub_type IS NOT NULL THEN v_pct := v_pct + 10; END IF;

  IF NEW.sub_type = 'producteur_individuel' THEN
    IF NEW.surface_ha IS NOT NULL THEN v_pct := v_pct + 15; END IF;
    IF array_length(NEW.filieres, 1) > 0 THEN v_pct := v_pct + 20; END IF;
    IF NEW.coordonnees_gps IS NOT NULL THEN v_pct := v_pct + 15; END IF;
  ELSIF NEW.sub_type = 'cooperative' THEN
    IF NEW.president_name IS NOT NULL THEN v_pct := v_pct + 10; END IF;
    IF NEW.nb_membres IS NOT NULL THEN v_pct := v_pct + 10; END IF;
    IF NEW.rccm_numero IS NOT NULL THEN v_pct := v_pct + 15; END IF;
    IF array_length(NEW.zones_production, 1) > 0 THEN v_pct := v_pct + 15; END IF;
  END IF;

  NEW.profile_completion_pct := LEAST(v_pct, 100);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profile_completion ON public.profiles;
CREATE TRIGGER trg_profile_completion
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION calc_profile_completion();


-- === F2 PRODUCTS ===
-- ============================================================
-- GWA — Migration F2 : Extension table products
-- ADDITIVE UNIQUEMENT
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sub_type_vendeur TEXT
    CHECK (sub_type_vendeur IN ('producteur_individuel','cooperative')),
  ADD COLUMN IF NOT EXISTS filiere TEXT DEFAULT 'autre'
    CHECK (filiere IN ('manioc','riz','cacao','cajou','tomate','oignon',
                       'banane_plantain','piment','attieke','autre')),
  ADD COLUMN IF NOT EXISTS quantite_disponible_kg NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS quantite_min_commande_kg NUMERIC(10,2) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS prix_unitaire_fcfa INT,
  ADD COLUMN IF NOT EXISTS prix_negocie BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS conditionnement TEXT,
  ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS ville TEXT,
  ADD COLUMN IF NOT EXISTS coordonnees_gps TEXT,
  ADD COLUMN IF NOT EXISTS product_status TEXT DEFAULT 'brouillon'
    CHECK (product_status IN ('brouillon','actif','rupture','archive')),
  ADD COLUMN IF NOT EXISTS favoris_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prix_ocpv_ref_fcfa INT;

-- Table favoris produits
CREATE TABLE IF NOT EXISTS public.product_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.product_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fav_owner" ON public.product_favorites;
CREATE POLICY "fav_owner" ON public.product_favorites FOR ALL USING (auth.uid() = user_id);

-- Index performances catalogue
CREATE INDEX IF NOT EXISTS idx_products_filiere   ON public.products(filiere);
CREATE INDEX IF NOT EXISTS idx_products_region    ON public.products(region);
CREATE INDEX IF NOT EXISTS idx_products_prix_fcfa ON public.products(prix_unitaire_fcfa);
CREATE INDEX IF NOT EXISTS idx_products_search
  ON public.products USING gin(to_tsvector('french', COALESCE(name,'') || ' ' || COALESCE(description,'')));

-- Trigger : passer en rupture si quantite <= 0
CREATE OR REPLACE FUNCTION check_stock_rupture()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantite_disponible_kg IS NOT NULL AND NEW.quantite_disponible_kg <= 0 THEN
    NEW.product_status := 'rupture';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_rupture ON public.products;
CREATE TRIGGER trg_stock_rupture
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION check_stock_rupture();


-- === F3 ESCROW ===
-- ============================================================
-- GWA — Migration F3 : Escrow + Paiement Feexpay
-- ADDITIVE UNIQUEMENT
-- ============================================================

-- 1. Extension table orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT 'pending'
    CHECK (escrow_status IN ('pending','held','released','refunded','disputed','partially_released')),
  ADD COLUMN IF NOT EXISTS paiement_schema TEXT DEFAULT 'full'
    CHECK (paiement_schema IN ('full','acompte_solde','tranches')),
  ADD COLUMN IF NOT EXISTS paiement_type TEXT
    CHECK (paiement_type IN ('orange_money','mtn_money','moov_money','wave','virement_bancaire') OR paiement_type IS NULL),
  ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(4,2) DEFAULT 6.00,
  ADD COLUMN IF NOT EXISTS commission_fcfa INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendeur_recoit_fcfa INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feexpay_ref TEXT,
  ADD COLUMN IF NOT EXISTS bon_commande_url TEXT,
  ADD COLUMN IF NOT EXISTS proof_of_shipment_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by_buyer_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS litige_photos TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS litige_description TEXT,
  ADD COLUMN IF NOT EXISTS litige_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seller_sub_type TEXT
    CHECK (seller_sub_type IN ('producteur_individuel','cooperative') OR seller_sub_type IS NULL);

-- 2. Extension contrainte statuts commande
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_status_check
  CHECK (status IN (
    'draft','pending','confirmed','processing','shipped','delivered','cancelled',
    'en_attente','paiement_escrow','confirme','en_preparation','en_transit',
    'livre','litige','annule_rembourse'
  ));

-- 3. Table escrow_transactions (paiements par tranches)
CREATE TABLE IF NOT EXISTS public.escrow_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tranche_numero INT NOT NULL DEFAULT 1,
  montant_fcfa INT NOT NULL,
  pourcentage NUMERIC(5,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','held','released','refunded')),
  feexpay_ref TEXT,
  due_event TEXT NOT NULL DEFAULT 'a_la_commande'
    CHECK (due_event IN ('a_la_commande','a_l_expedition','a_la_livraison','a_x_jours_livraison')),
  due_days INT,
  paid_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, tranche_numero)
);
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "escrow_parties" ON public.escrow_transactions;
CREATE POLICY "escrow_parties" ON public.escrow_transactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);
DROP POLICY IF EXISTS "escrow_insert_system" ON public.escrow_transactions;
CREATE POLICY "escrow_insert_system" ON public.escrow_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.buyer_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_escrow_order  ON public.escrow_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON public.escrow_transactions(status);

-- 4. Index commandes pour libération auto 72h
CREATE INDEX IF NOT EXISTS idx_orders_escrow_status   ON public.orders(escrow_status);
CREATE INDEX IF NOT EXISTS idx_orders_confirmed_buyer ON public.orders(confirmed_by_buyer_at)
  WHERE confirmed_by_buyer_at IS NOT NULL;

-- 5. Fonction numéro de commande GWA
CREATE OR REPLACE FUNCTION generate_gwa_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'GWA-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
      UPPER(SUBSTRING(MD5(NEW.id::text), 1, 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gwa_order_number ON public.orders;
CREATE TRIGGER trg_gwa_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION generate_gwa_order_number();


-- === F4 SCG HISTORY ===
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


-- === F5 MESSAGES & NOTIFICATIONS ===
-- GWA Migration F5 : Messages ADDITIVE UNIQUEMENT
-- NOTE : la table notifications est déjà migrée en tête de ce script

-- Extension table messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent'
    CHECK (status IN ('queued','sent','delivered','read')),
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS order_ref_id UUID REFERENCES public.orders(id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "msg_parties" ON public.messages;
CREATE POLICY "msg_parties" ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
DROP POLICY IF EXISTS "msg_insert" ON public.messages;
CREATE POLICY "msg_insert" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "msg_update_read" ON public.messages;
CREATE POLICY "msg_update_read" ON public.messages FOR UPDATE
  USING (auth.uid() = recipient_id);

CREATE INDEX IF NOT EXISTS idx_messages_conv
  ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient
  ON public.messages(recipient_id, status);

-- ============================================================
-- Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS public.notifications;

-- ============================================================
-- FIN MIGRATION CONSOLIDÉE F1-F5
-- ============================================================
SELECT 'Migration GWA F1-F5 appliquée avec succès' AS status,
       NOW() AS applied_at;
