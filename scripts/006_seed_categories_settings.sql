-- ================================================
-- SCRIPT DE SEED - PLATEFORME GWA MVP COMMERCIAL
-- Categories et Parametres uniquement
-- Aucune donnee fictive - Les utilisateurs creent leur propre contenu
-- ================================================

-- ================================================
-- 1. CATEGORIES AGRICULTURE - Chaine de valeur complete
-- ================================================

INSERT INTO categories (name, slug, description, category_type, icon, parent_id) 
VALUES
-- Cereales et feculents
('Cereales', 'cereales', 'Riz, mais, mil, sorgho, ble, fonio', 'agriculture', 'wheat', NULL),
('Tubercules', 'tubercules', 'Manioc, igname, patate douce, taro', 'agriculture', 'carrot', NULL),
('Legumineuses', 'legumineuses', 'Haricots, niebe, arachides, soja, lentilles', 'agriculture', 'bean', NULL),

-- Cultures de rente
('Cacao', 'cacao', 'Feves de cacao, beurre de cacao', 'agriculture', 'coffee', NULL),
('Cafe', 'cafe', 'Cafe arabica, cafe robusta', 'agriculture', 'coffee', NULL),
('Coton', 'coton', 'Coton brut, fibre de coton', 'agriculture', 'flower', NULL),
('Noix de cajou', 'noix-cajou', 'Noix brutes et transformees', 'agriculture', 'nut', NULL),
('Karite', 'karite', 'Noix de karite, beurre de karite', 'agriculture', 'droplet', NULL),
('Palmier a huile', 'palmier-huile', 'Huile de palme, huile de palmiste', 'agriculture', 'palm-tree', NULL),
('Hevea', 'hevea', 'Caoutchouc naturel, latex', 'agriculture', 'tree', NULL),

-- Fruits
('Fruits tropicaux', 'fruits-tropicaux', 'Mangue, ananas, papaye, banane, avocat', 'agriculture', 'apple', NULL),
('Agrumes', 'agrumes', 'Orange, citron, mandarine, pamplemousse', 'agriculture', 'citrus', NULL),
('Fruits secs', 'fruits-secs', 'Dattes, figues, raisins secs', 'agriculture', 'grape', NULL),

-- Legumes
('Legumes feuilles', 'legumes-feuilles', 'Epinard, amarante, oseille, gombo', 'agriculture', 'leaf', NULL),
('Legumes fruits', 'legumes-fruits', 'Tomate, aubergine, piment, poivron', 'agriculture', 'tomato', NULL),
('Legumes racines', 'legumes-racines', 'Carotte, oignon, ail, gingembre', 'agriculture', 'carrot', NULL),

-- Epices et aromates
('Epices', 'epices', 'Piment, poivre, gingembre, curcuma', 'agriculture', 'flame', NULL),
('Aromates', 'aromates', 'Basilic, persil, coriandre, menthe', 'agriculture', 'leaf', NULL),

-- Elevage
('Bovins', 'bovins', 'Viande bovine, lait, cuir', 'agriculture', 'cow', NULL),
('Ovins et caprins', 'ovins-caprins', 'Mouton, chevre, laine', 'agriculture', 'sheep', NULL),
('Volaille', 'volaille', 'Poulet, pintade, canard, oeufs', 'agriculture', 'bird', NULL),
('Pisciculture', 'pisciculture', 'Tilapia, carpe, silure', 'agriculture', 'fish', NULL),
('Apiculture', 'apiculture', 'Miel, cire, propolis, pollen', 'agriculture', 'flower', NULL),

-- Transformation agricole
('Farines et semoules', 'farines-semoules', 'Farine de ble, semoule de mais, farine de manioc', 'agriculture', 'wheat', NULL),
('Huiles vegetales', 'huiles-vegetales', 'Huile d''arachide, de palme, de coco', 'agriculture', 'droplet', NULL),
('Produits laitiers', 'produits-laitiers', 'Lait, yaourt, fromage, beurre', 'agriculture', 'milk', NULL),
('Boissons', 'boissons-agriculture', 'Jus de fruits, bissap, gingembre', 'agriculture', 'glass', NULL),
('Conserves', 'conserves', 'Confitures, sauces, condiments', 'agriculture', 'jar', NULL),

-- Intrants et equipements
('Semences', 'semences', 'Semences certifiees, plants', 'agriculture', 'sprout', NULL),
('Engrais', 'engrais', 'Engrais organiques et mineraux', 'agriculture', 'package', NULL),
('Produits phytosanitaires', 'phytosanitaires', 'Pesticides biologiques, traitements', 'agriculture', 'shield', NULL),
('Materiel agricole', 'materiel-agricole', 'Outils, machines, irrigation', 'agriculture', 'tractor', NULL),
('Emballages agricoles', 'emballages-agricoles', 'Sacs, caisses, conteneurs', 'agriculture', 'package', NULL)
ON CONFLICT (slug) DO UPDATE SET description = EXCLUDED.description, category_type = EXCLUDED.category_type;

-- ================================================
-- 2. CATEGORIES ARTISANAT - Chaine de valeur complete
-- ================================================

INSERT INTO categories (name, slug, description, category_type, icon, parent_id) 
VALUES
-- Textile et mode
('Tissage', 'tissage', 'Kente, bogolan, batik, tissu traditionnel', 'artisanat', 'fabric', NULL),
('Couture', 'couture', 'Vetements traditionnels, boubous, robes', 'artisanat', 'scissors', NULL),
('Broderie', 'broderie', 'Broderie main, perlage, ornements', 'artisanat', 'needle', NULL),
('Teinture', 'teinture', 'Indigo, teinture vegetale, wax', 'artisanat', 'palette', NULL),

-- Bijouterie et accessoires
('Bijouterie', 'bijouterie', 'Or, argent, bronze, perles', 'artisanat', 'gem', NULL),
('Perles et ornements', 'perles-ornements', 'Perles de verre, cauris, bijoux fantaisie', 'artisanat', 'bead', NULL),
('Maroquinerie', 'maroquinerie', 'Sacs, ceintures, portefeuilles en cuir', 'artisanat', 'handbag', NULL),
('Vannerie', 'vannerie', 'Paniers, chapeaux, nattes', 'artisanat', 'basket', NULL),

-- Travail du bois
('Sculpture bois', 'sculpture-bois', 'Masques, statuettes, objets decoratifs', 'artisanat', 'tree', NULL),
('Menuiserie artisanale', 'menuiserie', 'Meubles, portes, cadres', 'artisanat', 'hammer', NULL),
('Instruments musique', 'instruments-musique', 'Djembe, balafon, kora, tambours', 'artisanat', 'music', NULL),

-- Ceramique et poterie
('Poterie', 'poterie', 'Jarres, canaris, pots decoratifs', 'artisanat', 'cup', NULL),
('Ceramique', 'ceramique', 'Vaisselle, carrelage, objets d''art', 'artisanat', 'plate', NULL),

-- Forge et metal
('Forge', 'forge', 'Outils, armes traditionnelles, objets d''art', 'artisanat', 'anvil', NULL),
('Bronzier', 'bronzier', 'Statuettes, bijoux, objets en bronze', 'artisanat', 'medal', NULL),
('Ferronnerie', 'ferronnerie', 'Grilles, portails, mobilier metal', 'artisanat', 'wrench', NULL),

-- Cosmetiques naturels
('Cosmetiques naturels', 'cosmetiques-naturels', 'Savons, cremes, huiles de beaute', 'artisanat', 'heart', NULL),
('Parfums traditionnels', 'parfums-traditionnels', 'Encens, huiles parfumees', 'artisanat', 'droplet', NULL),

-- Decoration et maison
('Decoration interieure', 'decoration-interieure', 'Tableaux, tapis, coussins', 'artisanat', 'home', NULL),
('Luminaires', 'luminaires', 'Lampes, lanternes, photophores', 'artisanat', 'lamp', NULL)
ON CONFLICT (slug) DO UPDATE SET description = EXCLUDED.description, category_type = EXCLUDED.category_type;

-- ================================================
-- 3. CATEGORIES ARTS - Chaine de valeur complete
-- ================================================

INSERT INTO categories (name, slug, description, category_type, icon, parent_id) 
VALUES
-- Arts plastiques
('Peinture', 'peinture', 'Acrylique, huile, aquarelle, art contemporain', 'art', 'palette', NULL),
('Sculpture', 'sculpture-art', 'Pierre, metal, bois, art moderne', 'art', 'hammer', NULL),
('Art numerique', 'art-numerique', 'Digital art, NFT, design graphique', 'art', 'monitor', NULL),

-- Photographie
('Photographie artistique', 'photographie', 'Portraits, paysages, reportages', 'art', 'camera', NULL),
('Videographie', 'videographie', 'Films, documentaires, clips', 'art', 'video', NULL),

-- Artisanat d''art
('Tapisserie art', 'tapisserie-art', 'Tapisseries murales, art textile', 'art', 'fabric', NULL),
('Ceramique art', 'ceramique-art', 'Pieces uniques, art contemporain', 'art', 'cup', NULL),
('Verrerie art', 'verrerie-art', 'Vitraux, objets en verre souffle', 'art', 'glass', NULL),

-- Arts vivants
('Musique', 'musique', 'Compositions, performances, enregistrements', 'art', 'music', NULL),
('Danse', 'danse', 'Spectacles, choregraphies, cours', 'art', 'activity', NULL),
('Theatre', 'theatre', 'Pieces, marionnettes, contes', 'art', 'drama', NULL),

-- Mode et design
('Mode creatrice', 'mode-creatrice', 'Haute couture africaine, pieces uniques', 'art', 'shirt', NULL)
ON CONFLICT (slug) DO UPDATE SET description = EXCLUDED.description, category_type = EXCLUDED.category_type;

-- ================================================
-- 4. PARAMETRES PLATEFORME
-- ================================================

INSERT INTO platform_settings (key, value, description) VALUES
('commission_rate', '"5"'::jsonb, 'Taux de commission sur les ventes (%)'),
('min_withdrawal', '"10000"'::jsonb, 'Montant minimum de retrait (XOF)'),
('currency', '"XOF"'::jsonb, 'Devise par defaut'),
('maintenance_mode', 'false'::jsonb, 'Mode maintenance'),
('auto_approve_products', 'false'::jsonb, 'Approbation automatique des produits'),
('max_images_per_product', '5'::jsonb, 'Nombre max d''images par produit'),
('featured_products_count', '8'::jsonb, 'Nombre de produits en vedette'),
('support_email', '"support@gwa-platform.com"'::jsonb, 'Email du support'),
('support_phone', '"+225 07 00 00 00 00"'::jsonb, 'Telephone du support'),
('platform_name', '"Green World Agriculture"'::jsonb, 'Nom de la plateforme'),
('platform_slogan', '"La Marketplace de la Chaine de Valeurs Agricole et Artisanale"'::jsonb, 'Slogan de la plateforme')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ================================================
-- FIN DU SCRIPT
-- La plateforme est prete pour la production
-- Les utilisateurs peuvent creer leurs propres contenus
-- ================================================
