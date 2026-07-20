-- Setup admin access for GWA backoffice
-- Run this after creating your user account through the signup page

-- To make yourself an admin:
-- 1. First create an account via /auth/signup
-- 2. Find your user ID in the profiles table
-- 3. Run the INSERT below with your user ID

-- Example: Make the first user an admin (uncomment and run)
DO $$
DECLARE
  first_user_id uuid;
BEGIN
  -- Get the first user in the system
  SELECT id INTO first_user_id FROM profiles ORDER BY created_at ASC LIMIT 1;
  
  IF first_user_id IS NOT NULL THEN
    -- Check if already admin
    IF NOT EXISTS (SELECT 1 FROM admin_roles WHERE user_id = first_user_id) THEN
      INSERT INTO admin_roles (user_id, role, is_active, permissions)
      VALUES (
        first_user_id,
        'super_admin',
        true,
        '{"all": true}'::jsonb
      );
      RAISE NOTICE 'Admin role created for user: %', first_user_id;
    ELSE
      RAISE NOTICE 'User already has admin role: %', first_user_id;
    END IF;
  ELSE
    RAISE NOTICE 'No users found in the system. Create an account first via /auth/signup';
  END IF;
END $$;

-- Verify admin setup
SELECT 
  p.email,
  p.full_name,
  ar.role,
  ar.is_active
FROM admin_roles ar
JOIN profiles p ON p.id = ar.user_id
WHERE ar.is_active = true;
