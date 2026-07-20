-- Harmattan Digest + voix communautaire (idempotent)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS digest_enabled BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS digest_last_sent_at TIMESTAMPTZ;

ALTER TABLE products ADD COLUMN IF NOT EXISTS audio_lang TEXT DEFAULT 'fr';

COMMENT ON COLUMN profiles.digest_enabled IS 'Opt-in Harmattan Digest push quotidien';
COMMENT ON COLUMN products.audio_lang IS 'Langue enregistrement vocal: fr, wo, bm, etc.';
