-- Insertion des categories de base pour GWA
-- Note: Les categories de base sont deja inserees dans 001_create_tables.sql
-- Ce script ajoute des categories supplementaires si necessaire

-- Categories Agriculture supplementaires
INSERT INTO public.categories (name, slug, category_type, description) VALUES
('Cacao et Cafe', 'cacao-cafe', 'agriculture', 'Feves de cacao et grains de cafe'),
('Epices', 'epices', 'agriculture', 'Poivre, gingembre, curcuma et autres epices')
ON CONFLICT (slug) DO NOTHING;

-- Categories Artisanat supplementaires
INSERT INTO public.categories (name, slug, category_type, description) VALUES
('Peinture', 'peinture', 'artisanat', 'Tableaux et oeuvres d art contemporain africain'),
('Instruments', 'instruments', 'artisanat', 'Instruments de musique traditionnels')
ON CONFLICT (slug) DO NOTHING;
