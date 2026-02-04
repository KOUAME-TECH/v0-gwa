-- =====================================================
-- GWA PLATFORM - TABLES AVANCEES (Cahier des charges)
-- =====================================================

-- 1. TABLE COOPERATIVES
-- Gestion complete des cooperatives avec documents legaux
CREATE TABLE IF NOT EXISTS public.cooperatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  registration_number TEXT, -- SIRET/RCCM
  legal_documents JSONB DEFAULT '[]', -- URLs des documents legaux
  sector TEXT, -- filiere: cacao, cafe, cajou, etc.
  country TEXT NOT NULL,
  region TEXT,
  city TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  founded_year INTEGER,
  is_verified BOOLEAN DEFAULT false,
  verification_date TIMESTAMP WITH TIME ZONE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLE MEMBRES COOPERATIVES
CREATE TABLE IF NOT EXISTS public.cooperative_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  contribution_percentage NUMERIC(5,2) DEFAULT 0, -- pourcentage de contribution
  UNIQUE(cooperative_id, user_id)
);

-- 3. TABLE STOCK COOPERATIVE (centralisation des stocks membres)
CREATE TABLE IF NOT EXISTS public.cooperative_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  harvest_date DATE,
  quality_grade TEXT, -- A, B, C ou specifique
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLE FORMATIONS / COURS
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  category TEXT, -- agriculture, artisanat, business, technologie
  level TEXT CHECK (level IN ('debutant', 'intermediaire', 'avance')),
  duration_minutes INTEGER,
  is_downloadable BOOLEAN DEFAULT true, -- pour mode offline
  instructor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  instructor_name TEXT,
  partner_organization TEXT, -- PNUD, Orange Corners, etc.
  language TEXT DEFAULT 'fr',
  is_published BOOLEAN DEFAULT false,
  is_free BOOLEAN DEFAULT true,
  price NUMERIC(10,2) DEFAULT 0,
  enrollments_count INTEGER DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABLE MODULES DE COURS
CREATE TABLE IF NOT EXISTS public.course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  content_type TEXT CHECK (content_type IN ('video', 'pdf', 'audio', 'text', 'quiz')),
  content_url TEXT, -- URL du fichier media
  content_text TEXT, -- contenu texte si applicable
  duration_minutes INTEGER,
  is_downloadable BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABLE PROGRESSION UTILISATEUR (formations)
CREATE TABLE IF NOT EXISTS public.course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
  progress_percentage INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  quiz_score INTEGER,
  certificate_issued BOOLEAN DEFAULT false,
  certificate_url TEXT,
  UNIQUE(user_id, course_id)
);

-- 7. TABLE POSTS RESEAU SOCIAL
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  media_urls JSONB DEFAULT '[]', -- photos, videos
  post_type TEXT DEFAULT 'post' CHECK (post_type IN ('post', 'story', 'repost')),
  original_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL, -- pour reposts
  is_educational BOOLEAN DEFAULT false, -- boost dans l'algo
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'private')),
  location TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE, -- pour stories (24h)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. TABLE LIKES
CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- 9. TABLE COMMENTAIRES
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. TABLE FOLLOWERS
CREATE TABLE IF NOT EXISTS public.followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- 11. TABLE AUDIT COMMANDES (piste d'audit)
CREATE TABLE IF NOT EXISTS public.order_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- status_change, payment_update, note_added
  old_value TEXT,
  new_value TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. TABLE DEMANDES DE DEVIS B2B (RFQ)
CREATE TABLE IF NOT EXISTS public.rfq_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_number TEXT UNIQUE NOT NULL,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  product_category TEXT,
  quantity_needed NUMERIC(10,2),
  unit TEXT,
  quality_requirements TEXT,
  certifications_required JSONB DEFAULT '[]',
  delivery_location TEXT,
  delivery_deadline DATE,
  budget_min NUMERIC(12,2),
  budget_max NUMERIC(12,2),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_negotiation', 'awarded', 'closed', 'cancelled')),
  selected_supplier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  responses_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. TABLE REPONSES AUX RFQ
CREATE TABLE IF NOT EXISTS public.rfq_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfq_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposed_price NUMERIC(12,2) NOT NULL,
  quantity_available NUMERIC(10,2),
  delivery_time_days INTEGER,
  quality_description TEXT,
  certifications JSONB DEFAULT '[]',
  notes TEXT,
  attachments JSONB DEFAULT '[]', -- documents, photos
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(rfq_id, supplier_id)
);

-- 14. TABLE SIGNALEMENTS (moderation)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_type TEXT NOT NULL CHECK (reported_type IN ('post', 'comment', 'user', 'product', 'message')),
  reported_id UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  evidence_urls JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- 15. TABLE MESSAGES DE GROUPE
CREATE TABLE IF NOT EXISTS public.group_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_type TEXT DEFAULT 'general' CHECK (group_type IN ('general', 'cooperative', 'formation', 'b2b')),
  related_entity_id UUID, -- cooperative_id, course_id, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. TABLE MEMBRES GROUPE
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.group_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_muted BOOLEAN DEFAULT false,
  UNIQUE(group_id, user_id)
);

-- 17. TABLE MESSAGES DE GROUPE
CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.group_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'voice', 'system')),
  media_url TEXT,
  reply_to_id UUID REFERENCES public.group_messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ACTIVATION RLS ET POLITIQUES
-- =====================================================

-- Cooperatives
ALTER TABLE public.cooperatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cooperatives_select_all" ON public.cooperatives FOR SELECT USING (true);
CREATE POLICY "cooperatives_insert_auth" ON public.cooperatives FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "cooperatives_update_admin" ON public.cooperatives FOR UPDATE USING (admin_id = auth.uid());

-- Cooperative Members
ALTER TABLE public.cooperative_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coop_members_select" ON public.cooperative_members FOR SELECT USING (true);
CREATE POLICY "coop_members_insert" ON public.cooperative_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "coop_members_update" ON public.cooperative_members FOR UPDATE USING (user_id = auth.uid());

-- Courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses_select_published" ON public.courses FOR SELECT USING (is_published = true OR instructor_id = auth.uid());
CREATE POLICY "courses_insert_auth" ON public.courses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "courses_update_own" ON public.courses FOR UPDATE USING (instructor_id = auth.uid());

-- Course Progress
ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_select_own" ON public.course_progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "progress_insert_own" ON public.course_progress FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "progress_update_own" ON public.course_progress FOR UPDATE USING (user_id = auth.uid());

-- Posts
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select_visible" ON public.posts FOR SELECT USING (
  visibility = 'public' OR author_id = auth.uid()
);
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE USING (author_id = auth.uid());

-- Post Likes
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_select_all" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_own" ON public.post_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "likes_delete_own" ON public.post_likes FOR DELETE USING (user_id = auth.uid());

-- Post Comments
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_all" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_own" ON public.post_comments FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "comments_update_own" ON public.post_comments FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "comments_delete_own" ON public.post_comments FOR DELETE USING (author_id = auth.uid());

-- Followers
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followers_select_all" ON public.followers FOR SELECT USING (true);
CREATE POLICY "followers_insert_own" ON public.followers FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "followers_delete_own" ON public.followers FOR DELETE USING (follower_id = auth.uid());

-- Order Audit Log
ALTER TABLE public.order_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_participants" ON public.order_audit_log FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);
CREATE POLICY "audit_insert_participants" ON public.order_audit_log FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

-- RFQ Requests
ALTER TABLE public.rfq_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rfq_select_all" ON public.rfq_requests FOR SELECT USING (status = 'open' OR buyer_id = auth.uid());
CREATE POLICY "rfq_insert_own" ON public.rfq_requests FOR INSERT WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "rfq_update_own" ON public.rfq_requests FOR UPDATE USING (buyer_id = auth.uid());

-- RFQ Responses
ALTER TABLE public.rfq_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rfq_resp_select" ON public.rfq_responses FOR SELECT USING (
  supplier_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.rfq_requests r WHERE r.id = rfq_id AND r.buyer_id = auth.uid())
);
CREATE POLICY "rfq_resp_insert" ON public.rfq_responses FOR INSERT WITH CHECK (supplier_id = auth.uid());
CREATE POLICY "rfq_resp_update" ON public.rfq_responses FOR UPDATE USING (supplier_id = auth.uid());

-- Reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_select_own" ON public.reports FOR SELECT USING (reporter_id = auth.uid());
CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- Group Conversations
ALTER TABLE public.group_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups_select_member" ON public.group_conversations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = id AND gm.user_id = auth.uid())
);
CREATE POLICY "groups_insert_auth" ON public.group_conversations FOR INSERT WITH CHECK (created_by = auth.uid());

-- Group Members
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_members_select" ON public.group_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid())
);
CREATE POLICY "group_members_insert" ON public.group_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Group Messages
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_msgs_select" ON public.group_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid())
);
CREATE POLICY "group_msgs_insert" ON public.group_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid())
);

-- Course Modules
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules_select_all" ON public.course_modules FOR SELECT USING (true);

-- Cooperative Stock
ALTER TABLE public.cooperative_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coop_stock_select" ON public.cooperative_stock FOR SELECT USING (
  member_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.cooperative_members cm WHERE cm.cooperative_id = cooperative_id AND cm.user_id = auth.uid())
);
CREATE POLICY "coop_stock_insert" ON public.cooperative_stock FOR INSERT WITH CHECK (member_id = auth.uid());
CREATE POLICY "coop_stock_update" ON public.cooperative_stock FOR UPDATE USING (member_id = auth.uid());

-- =====================================================
-- FONCTIONS ET TRIGGERS
-- =====================================================

-- Fonction pour generer numero RFQ
CREATE OR REPLACE FUNCTION generate_rfq_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.rfq_number := 'RFQ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(NEW.id::text, 1, 8);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_rfq_number
  BEFORE INSERT ON public.rfq_requests
  FOR EACH ROW
  EXECUTE FUNCTION generate_rfq_number();

-- Fonction pour incrementer likes
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_post_like_change
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_post_likes_count();

-- Fonction pour incrementer commentaires
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_post_comment_change
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_comments_count();

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_category ON public.courses(category);
CREATE INDEX IF NOT EXISTS idx_rfq_status ON public.rfq_requests(status);
CREATE INDEX IF NOT EXISTS idx_coop_members ON public.cooperative_members(cooperative_id);
