-- Add message_type and media_url to messages table (like group_messages already has)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES messages(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add conversation_type to conversations for business vs private
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS conversation_type text DEFAULT 'private';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_pinned_1 boolean DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_pinned_2 boolean DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_muted_1 boolean DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_muted_2 boolean DEFAULT false;

-- Enable realtime on group tables too
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;

-- Add update policy for conversations
CREATE POLICY "conversations_update_own" ON conversations FOR UPDATE
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
