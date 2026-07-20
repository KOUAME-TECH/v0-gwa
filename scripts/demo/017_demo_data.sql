-- GWA Demo Data for Investor Presentation
-- Execute this script to populate demo content

-- Create demo products (using existing seller or create demo seller)
DO $$
DECLARE
  demo_seller_id uuid;
  demo_category_id uuid;
BEGIN
  -- Get or create a demo seller profile
  SELECT id INTO demo_seller_id FROM profiles WHERE user_type = 'farmer' LIMIT 1;
  
  IF demo_seller_id IS NULL THEN
    -- Use first existing profile as demo seller
    SELECT id INTO demo_seller_id FROM profiles LIMIT 1;
  END IF;
  
  -- Get a category
  SELECT id INTO demo_category_id FROM categories LIMIT 1;
  
  -- Only insert demo products if we have a seller
  IF demo_seller_id IS NOT NULL THEN
    -- Insert demo products if none exist
    IF NOT EXISTS (SELECT 1 FROM products WHERE status = 'active' LIMIT 1) THEN
      INSERT INTO products (name, description, price, unit, images, origin_country, origin_region, product_type, status, seller_id, category_id, is_organic, is_fair_trade, stock_quantity)
      VALUES 
        ('Cacao Premium Cote d''Ivoire', 'Feves de cacao de qualite superieure, cultivees de maniere durable dans les forets ivoiriennes. Certifie bio et commerce equitable.', 4500, 'kg', ARRAY['https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=800'], 'CI', 'San Pedro', 'agriculture', 'active', demo_seller_id, demo_category_id, true, true, 500),
        ('Cafe Arabica Robusta', 'Melange unique de cafe arabica et robusta, torrefie artisanalement. Aromes intenses avec notes de chocolat.', 3200, 'kg', ARRAY['https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800'], 'CI', 'Man', 'agriculture', 'active', demo_seller_id, demo_category_id, true, false, 200),
        ('Noix de Cajou Bio', 'Noix de cajou entieres, selectionnees a la main. Riches en proteines et mineraux. Culture biologique certifiee.', 5800, 'kg', ARRAY['https://images.unsplash.com/photo-1563292795-8a0d1a8a1b5c?w=800'], 'CI', 'Bouake', 'agriculture', 'active', demo_seller_id, demo_category_id, true, true, 300),
        ('Mangues Kent Sechees', 'Mangues Kent sechees au soleil, sans sucre ajoute. Provenant des vergers de Korhogo. Snack sain et delicieux.', 2800, 'kg', ARRAY['https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=800'], 'CI', 'Korhogo', 'agriculture', 'active', demo_seller_id, demo_category_id, true, false, 150),
        ('Panier Artisanal Baoulé', 'Panier tresse a la main par les artisans Baoule. Technique traditionnelle transmise de generation en generation.', 15000, 'piece', ARRAY['https://images.unsplash.com/photo-1595231776515-ddffb1f4eb73?w=800'], 'CI', 'Bouake', 'artisanat', 'active', demo_seller_id, demo_category_id, false, true, 25),
        ('Tissu Bogolan Authentique', 'Tissu bogolan teint naturellement avec des pigments vegetaux et de la boue fermentee. Art textile millénaire.', 35000, 'metre', ARRAY['https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=800'], 'ML', 'Bamako', 'artisanat', 'active', demo_seller_id, demo_category_id, false, true, 40);
    END IF;
    
    -- Insert demo posts if none exist
    IF NOT EXISTS (SELECT 1 FROM posts WHERE visibility = 'public' LIMIT 1) THEN
      INSERT INTO posts (author_id, content, post_type, visibility, likes_count, comments_count)
      VALUES 
        (demo_seller_id, 'Nouvelle recolte de cacao disponible ! Cette annee, nous avons reussi a augmenter notre rendement de 20% grace aux techniques agroecologiques. Fier de contribuer a une agriculture durable en Afrique. #GWA #CacaoCI #AgricultureDurable', 'agriculture', 'public', 45, 12),
        (demo_seller_id, 'Conseil du jour : Pour conserver vos feves de cacao, stockez-les dans un endroit frais et sec, a l''abri de la lumiere. La temperature ideale est entre 18 et 22 degres. #ConseilsAgri', 'conseil', 'public', 28, 5),
        (demo_seller_id, 'Bienvenue a tous les nouveaux membres de notre communaute ! GWA connecte les producteurs africains avec les acheteurs du monde entier. Ensemble, valorisons nos richesses agricoles et artisanales.', 'general', 'public', 67, 23);
    END IF;
  END IF;
END $$;

-- Insert demo categories if none exist
INSERT INTO categories (name, slug, description, category_type)
SELECT * FROM (VALUES
  ('Cacao & Cafe', 'cacao-cafe', 'Feves de cacao, cafe vert et torrefie', 'agriculture'),
  ('Fruits & Legumes', 'fruits-legumes', 'Produits frais et transformes', 'agriculture'),
  ('Cereales & Graines', 'cereales-graines', 'Riz, mil, sorgho, arachides', 'agriculture'),
  ('Textile & Tissage', 'textile-tissage', 'Bogolan, kente, batik', 'artisanat'),
  ('Vannerie & Bois', 'vannerie-bois', 'Paniers, sculptures, meubles', 'artisanat')
) AS v(name, slug, description, category_type)
WHERE NOT EXISTS (SELECT 1 FROM categories LIMIT 1);

-- Verify data was inserted
DO $$
BEGIN
  RAISE NOTICE 'Demo data check:';
  RAISE NOTICE 'Products: %', (SELECT COUNT(*) FROM products WHERE status = 'active');
  RAISE NOTICE 'Posts: %', (SELECT COUNT(*) FROM posts WHERE visibility = 'public');
  RAISE NOTICE 'Categories: %', (SELECT COUNT(*) FROM categories);
  RAISE NOTICE 'Profiles: %', (SELECT COUNT(*) FROM profiles);
END $$;
