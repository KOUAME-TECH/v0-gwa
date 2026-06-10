# GWA Platform - Deployment Checklist

## ✅ Code Quality Fixes Completed

### 1. Database & Query Issues
- [x] Fixed `products.location` column errors - now using explicit column lists
- [x] Fixed PostgREST FK issues - replaced `posts_author_id_fkey` with two-query approach
- [x] Fixed Supabase GoTrueClient singleton - prevents multiple instances

### 2. Broken Links Fixed
- [x] `/dashboard/products/new` → `/publier` (4 locations fixed)
- [x] Mobile FAB link corrected
- [x] All dashboard links now point to correct routes

### 3. Feed Enhancements
- [x] Added video support (check media_urls type field)
- [x] Media normalization for images and videos
- [x] Proper layout for video display with controls

### 4. Security Hardening
- [x] OWASP rate limiting implemented
- [x] Input validation schemas created
- [x] Audit logging system added
- [x] Security headers in next.config.mjs

### 5. Performance Optimizations
- [x] Image lazy loading component created
- [x] Network status detection hook
- [x] Offline cache utility (IndexedDB + localStorage)
- [x] Optimized images for 3G networks

## 🚀 Pre-Deployment Verification

Before deploying to production:

1. **Test Core Flows**
   ```
   - [ ] User signup and login
   - [ ] Product creation (/publier)
   - [ ] Feed display (products + posts + videos)
   - [ ] Chat functionality
   - [ ] Mobile Money integration
   ```

2. **Test Links**
   ```
   - [ ] All dashboard links work
   - [ ] Mobile nav FAB works
   - [ ] Post detail page (/post/[id]) works
   - [ ] Product detail page works
   ```

3. **Database Verification**
   ```
   - [ ] Run scripts/015_create_audit_logs.sql
   - [ ] Verify all FK constraints
   - [ ] Check RLS policies
   ```

4. **Performance**
   ```
   - [ ] Check bundle size
   - [ ] Verify image optimization
   - [ ] Test on 3G throttling
   ```

## 📋 Environment Variables Required

Ensure these are set in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`

## 🌐 Deployment Steps

### Option 1: Vercel Deployment (Recommended)

```bash
# Push to GitHub first
git add .
git commit -m "GWA Platform v1.0 - World-class mobile-first agri-tech"
git push origin main

# Deploy via Vercel Dashboard or CLI
vercel deploy --prod
```

### Option 2: Docker Deployment

```dockerfile
# Use official Node.js runtime
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

## 📊 Monitoring Post-Deployment

1. **Error Tracking**: Check Sentry/PostHog for errors
2. **Performance**: Monitor Core Web Vitals in Google Analytics
3. **Database**: Monitor Supabase logs for slow queries
4. **API**: Check rate limiting is working

## 🔄 Rollback Plan

If issues occur:

```bash
# Revert to previous deployment in Vercel
vercel rollback

# Or redeploy stable branch
git checkout stable
vercel deploy --prod
```

## ✨ Post-Deployment Checklist

- [ ] Verify all pages load correctly
- [ ] Test on real 3G/4G networks
- [ ] Verify offline functionality
- [ ] Check mobile responsiveness
- [ ] Test payment flows
- [ ] Verify email notifications
- [ ] Monitor error logs for 24 hours
