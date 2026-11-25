-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20261102175535 · nom « 067_chat_group_fk_indexes » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

CREATE INDEX IF NOT EXISTS idx_group_conversations_created_by ON public.group_conversations (created_by);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON public.group_messages (group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_reply_to_id ON public.group_messages (reply_to_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id ON public.group_messages (sender_id);
