-- 080 — Chat : réactions emoji persistées et « supprimer pour moi » persistée (Lot D, phase 4).
-- NE PAS APPLIQUER sans le go de Yao. Idempotent. Rollback : 080_chat_reactions_hidden.rollback.sql
-- Tant que 080 n'est pas en prod, le client retombe sur le stockage local (comportement actuel).

BEGIN;

-- Une réaction par utilisateur et par message (comme WhatsApp : la nouvelle remplace l'ancienne).
CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS message_reactions_user_id_idx ON public.message_reactions (user_id);

-- Messages masqués pour un seul utilisateur (l'autre participant les voit toujours).
CREATE TABLE IF NOT EXISTS public.message_hidden (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);
CREATE INDEX IF NOT EXISTS message_hidden_message_id_idx ON public.message_hidden (message_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_hidden ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.message_reactions FROM anon;
REVOKE ALL ON public.message_hidden FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.message_hidden TO authenticated;

-- Réactions : visibles par les deux participants de la conversation, écrites par soi seulement.
DROP POLICY IF EXISTS message_reactions_select_participant ON public.message_reactions;
CREATE POLICY message_reactions_select_participant ON public.message_reactions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.id = message_reactions.message_id
      AND ((SELECT auth.uid()) IN (c.participant_1, c.participant_2))
  ));

DROP POLICY IF EXISTS message_reactions_write_own ON public.message_reactions;
CREATE POLICY message_reactions_write_own ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_reactions.message_id
        AND ((SELECT auth.uid()) IN (c.participant_1, c.participant_2))
    )
  );

DROP POLICY IF EXISTS message_reactions_update_own ON public.message_reactions;
CREATE POLICY message_reactions_update_own ON public.message_reactions
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS message_reactions_delete_own ON public.message_reactions;
CREATE POLICY message_reactions_delete_own ON public.message_reactions
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Masquage : strictement privé.
DROP POLICY IF EXISTS message_hidden_own ON public.message_hidden;
CREATE POLICY message_hidden_own ON public.message_hidden
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_hidden.message_id
        AND ((SELECT auth.uid()) IN (c.participant_1, c.participant_2))
    )
  );

-- Réactions en temps réel (l'autre participant voit la réaction arriver).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'message_reactions'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END $$;

COMMIT;

-- Post-contrôles :
-- SELECT relrowsecurity FROM pg_class WHERE oid IN ('public.message_reactions'::regclass, 'public.message_hidden'::regclass);
-- SELECT policyname FROM pg_policies WHERE tablename IN ('message_reactions','message_hidden');
