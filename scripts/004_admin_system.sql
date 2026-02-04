-- Admin system for GWA Back Office

-- Table for admin roles
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'moderator', 'support')),
  permissions JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id)
);

-- Admin activity logs
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verification requests for users/cooperatives
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cooperative_id UUID REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('user', 'cooperative', 'product')),
  documents JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'more_info_needed')),
  notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dispute management
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL CHECK (reason IN ('product_not_received', 'product_damaged', 'wrong_product', 'quality_issue', 'other')),
  description TEXT NOT NULL,
  evidence_urls JSONB DEFAULT '[]',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved_buyer', 'resolved_seller', 'escalated', 'closed')),
  resolution TEXT,
  refund_amount NUMERIC(12,2),
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Announcements/Banners
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'promotion', 'maintenance')),
  target_audience JSONB DEFAULT '["all"]',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  link_url TEXT,
  link_text TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Admin roles policies (only admins can see/modify)
CREATE POLICY "admin_roles_select" ON public.admin_roles FOR SELECT 
  USING (auth.uid() IN (SELECT user_id FROM public.admin_roles WHERE is_active = true));

CREATE POLICY "admin_roles_insert" ON public.admin_roles FOR INSERT 
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.admin_roles WHERE role = 'super_admin' AND is_active = true));

CREATE POLICY "admin_roles_update" ON public.admin_roles FOR UPDATE 
  USING (auth.uid() IN (SELECT user_id FROM public.admin_roles WHERE role = 'super_admin' AND is_active = true));

-- Admin logs policies
CREATE POLICY "admin_logs_select" ON public.admin_logs FOR SELECT 
  USING (auth.uid() IN (SELECT user_id FROM public.admin_roles WHERE is_active = true));

CREATE POLICY "admin_logs_insert" ON public.admin_logs FOR INSERT 
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.admin_roles WHERE is_active = true));

-- Platform settings policies
CREATE POLICY "settings_select_all" ON public.platform_settings FOR SELECT USING (true);

CREATE POLICY "settings_update_admin" ON public.platform_settings FOR UPDATE 
  USING (auth.uid() IN (SELECT user_id FROM public.admin_roles WHERE role IN ('super_admin', 'admin') AND is_active = true));

-- Verification requests policies
CREATE POLICY "verification_select_admin" ON public.verification_requests FOR SELECT 
  USING (
    auth.uid() = user_id OR
    auth.uid() IN (SELECT user_id FROM public.admin_roles WHERE is_active = true)
  );

CREATE POLICY "verification_insert" ON public.verification_requests FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "verification_update_admin" ON public.verification_requests FOR UPDATE 
  USING (auth.uid() IN (SELECT user_id FROM public.admin_roles WHERE is_active = true));

-- Disputes policies
CREATE POLICY "disputes_select" ON public.disputes FOR SELECT 
  USING (
    auth.uid() = opened_by OR
    auth.uid() IN (SELECT buyer_id FROM public.orders WHERE id = order_id) OR
    auth.uid() IN (SELECT seller_id FROM public.orders WHERE id = order_id) OR
    auth.uid() IN (SELECT user_id FROM public.admin_roles WHERE is_active = true)
  );

CREATE POLICY "disputes_insert" ON public.disputes FOR INSERT 
  WITH CHECK (auth.uid() = opened_by);

CREATE POLICY "disputes_update_admin" ON public.disputes FOR UPDATE 
  USING (auth.uid() IN (SELECT user_id FROM public.admin_roles WHERE is_active = true));

-- Announcements policies
CREATE POLICY "announcements_select_all" ON public.announcements FOR SELECT USING (true);

CREATE POLICY "announcements_insert_admin" ON public.announcements FOR INSERT 
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.admin_roles WHERE is_active = true));

CREATE POLICY "announcements_update_admin" ON public.announcements FOR UPDATE 
  USING (auth.uid() IN (SELECT user_id FROM public.admin_roles WHERE is_active = true));

-- Add is_admin column to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id);

-- Add moderation status to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS moderation_notes TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES auth.users(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;

-- Insert default platform settings
INSERT INTO public.platform_settings (key, value, description) VALUES
('commission_rate', '{"agriculture": 5, "artisanat": 7, "default": 6}', 'Commission rates by category (%)'),
('min_withdrawal', '{"XOF": 5000, "EUR": 10, "USD": 10}', 'Minimum withdrawal amounts'),
('max_images_per_product', '10', 'Maximum images per product'),
('auto_approve_verified_sellers', 'true', 'Auto-approve products from verified sellers'),
('maintenance_mode', 'false', 'Platform maintenance mode'),
('supported_countries', '["CI", "SN", "CM", "ML", "BF", "GH", "NG", "TZ", "KE", "MA", "DZ"]', 'Supported countries'),
('supported_currencies', '["XOF", "XAF", "EUR", "USD", "GHS", "NGN", "KES", "TZS", "MAD", "DZD"]', 'Supported currencies'),
('payment_methods', '["orange_money", "mtn_money", "moov_money", "wave", "bank_transfer"]', 'Available payment methods')
ON CONFLICT (key) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON public.verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON public.disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_products_moderation ON public.products(moderation_status);
CREATE INDEX IF NOT EXISTS idx_profiles_suspended ON public.profiles(is_suspended);
