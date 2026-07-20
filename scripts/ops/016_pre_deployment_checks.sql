-- Pre-Deployment Verification Script
-- Run this to ensure the database is ready for production

-- Check 1: Verify tables exist
SELECT 'TABLES CHECK' as check_name, 
  COUNT(*) as table_count,
  CASE WHEN COUNT(*) >= 20 THEN 'PASS' ELSE 'FAIL' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- Check 2: Verify critical columns exist (products)
SELECT 'PRODUCTS SCHEMA' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='products' AND column_name='id') THEN 'PASS' 
    ELSE 'FAIL' 
  END as status,
  string_agg(column_name, ', ') as columns
FROM information_schema.columns 
WHERE table_name = 'products' AND table_schema = 'public'
GROUP BY table_name;

-- Check 3: Verify RLS is enabled
SELECT 'RLS ENABLED' as check_name,
  tablename,
  CASE WHEN rowsecurity = true THEN 'PASS' ELSE 'FAIL' END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true
LIMIT 10;

-- Check 4: Verify audit_logs table exists
SELECT 'AUDIT LOGS TABLE' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_name='audit_logs' AND table_schema='public')
    THEN 'PASS' ELSE 'FAIL' 
  END as status;

-- Check 5: Verify storage buckets configured
SELECT 'STORAGE BUCKETS' as check_name,
  COUNT(*) as bucket_count,
  CASE WHEN COUNT(*) >= 3 THEN 'PASS' ELSE 'FAIL' END as status,
  string_agg(name, ', ') as buckets
FROM storage.buckets;

-- Check 6: Count active products
SELECT 'ACTIVE PRODUCTS' as check_name,
  COUNT(*) as count,
  'INFO' as status
FROM products 
WHERE status = 'active';

-- Check 7: Count verified sellers
SELECT 'VERIFIED SELLERS' as check_name,
  COUNT(*) as count,
  'INFO' as status
FROM profiles 
WHERE is_verified = true;

-- Check 8: Summary
SELECT 'DEPLOYMENT READY' as check_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') >= 20
    AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='products' AND table_schema='public') > 0
    AND (SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity=true) > 0
    THEN 'YES - Ready for deployment' 
    ELSE 'NO - Issues found' 
  END as status;
