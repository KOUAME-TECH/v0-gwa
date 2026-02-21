-- List and drop all triggers on the messages table that reference room_id
-- First, drop ALL triggers on messages to clean up, then recreate only what we need

-- Drop all existing triggers on messages
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  FOR trigger_rec IN
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.messages'::regclass
    AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.messages', trigger_rec.tgname);
    RAISE NOTICE 'Dropped trigger: %', trigger_rec.tgname;
  END LOOP;
END $$;

-- Drop all trigger functions that might reference room_id
DO $$
DECLARE
  func_rec RECORD;
BEGIN
  FOR func_rec IN
    SELECT p.proname, n.nspname
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prosrc LIKE '%room_id%'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I() CASCADE', func_rec.nspname, func_rec.proname);
    RAISE NOTICE 'Dropped function with room_id: %.%', func_rec.nspname, func_rec.proname;
  END LOOP;
END $$;

-- Also clean triggers on conversations table
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  FOR trigger_rec IN
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.conversations'::regclass
    AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.conversations', trigger_rec.tgname);
    RAISE NOTICE 'Dropped trigger on conversations: %', trigger_rec.tgname;
  END LOOP;
END $$;
