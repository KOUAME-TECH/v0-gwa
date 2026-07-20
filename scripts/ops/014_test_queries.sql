-- Test queries to verify all column references are valid
-- This script tests if the queries in the code will work with the actual schema

-- Test 1: Products table exists and has all needed columns
SELECT 
  id, name, price, unit, images, description, origin_country, origin_region,
  is_organic, is_fair_trade, is_bulk_available, min_bulk_quantity, product_type,
  seller_id, category_id, status, likes_count, comments_count, shares_count,
  created_at, updated_at, stock_quantity
FROM products
LIMIT 1;

-- Test 2: Posts table foreign key to profiles
SELECT p.id, p.content, p.author_id, pr.id as profile_id, pr.full_name
FROM posts p
LEFT JOIN profiles pr ON p.author_id = pr.id
WHERE p.visibility = 'public'
LIMIT 1;

-- Test 3: Post comments with correct FK
SELECT pc.id, pc.content, pc.author_id, pr.id as profile_id, pr.full_name
FROM post_comments pc
LEFT JOIN profiles pr ON pc.author_id = pr.id
LIMIT 1;

-- Test 4: Reviews with correct FK
SELECT r.id, r.comment, r.reviewer_id, pr.id as profile_id, pr.full_name
FROM reviews r
LEFT JOIN profiles pr ON r.reviewer_id = pr.id
LIMIT 1;

-- Test 5: Check admin_roles RLS is working (should not infinitely recurse)
SELECT COUNT(*) as admin_count FROM admin_roles LIMIT 1;

-- Test 6: Marketplace products query
SELECT 
  p.id, p.name, p.price, p.unit, p.images, p.origin_country, p.origin_region,
  p.is_organic, p.is_fair_trade, p.product_type, p.category_id, p.seller_id,
  pr.full_name, pr.avatar_url, pr.is_verified,
  c.name as category_name, c.slug
FROM products p
LEFT JOIN profiles pr ON p.seller_id = pr.id
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.status = 'active'
LIMIT 1;
