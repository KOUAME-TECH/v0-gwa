-- Create first admin user
-- IMPORTANT: Replace 'YOUR_USER_ID' with the actual user ID after signing up

-- To find your user ID, run this query after signing up:
-- SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- Then insert the admin role:
-- INSERT INTO public.admin_roles (user_id, role, permissions)
-- VALUES ('YOUR_USER_ID', 'super_admin', '{"all": true}');

-- For now, we'll create a function to easily promote a user to admin
CREATE OR REPLACE FUNCTION public.promote_to_admin(user_email TEXT, admin_role TEXT DEFAULT 'admin')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Find user by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  -- Insert or update admin role
  INSERT INTO public.admin_roles (user_id, role, permissions, is_active)
  VALUES (target_user_id, admin_role, '{"all": true}', true)
  ON CONFLICT (user_id) 
  DO UPDATE SET role = admin_role, is_active = true, updated_at = NOW();
  
  -- Update profile to mark as verified
  UPDATE public.profiles
  SET is_verified = true
  WHERE id = target_user_id;
  
END;
$$;

-- Example usage (uncomment and replace with your email):
-- SELECT public.promote_to_admin('your.email@example.com', 'super_admin');
