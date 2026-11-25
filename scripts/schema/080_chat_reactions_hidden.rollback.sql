-- Rollback 080 : supprime les réactions et masquages persistés (le client repasse en stockage local).
BEGIN;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.message_reactions;
  END IF;
END $$;
DROP TABLE IF EXISTS public.message_hidden;
DROP TABLE IF EXISTS public.message_reactions;
COMMIT;
