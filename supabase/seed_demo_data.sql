-- ============================================================
-- OPTIONAL DEMO DATA — clearly flagged is_demo = true / unverified.
-- Run after schema.sql if you want the site to feel populated before
-- real community reviews exist. Safe to delete later with:
--   delete from strains where is_demo = true;
--   delete from brands where is_demo = true;
-- Reviews are NOT seeded here because they must belong to a real
-- auth.users row — they'll appear naturally as people sign up and post.
-- ============================================================

insert into brands (name, slug, description, country, is_demo, verification_status)
values
  ('Oasis Cultivars', 'oasis-cultivars', 'Demo record — boutique indoor cultivator example.', 'California, US', true, 'unverified'),
  ('Northline Farms', 'northline-farms', 'Demo record — craft outdoor-to-light-dep grower example.', 'Ontario, CA', true, 'unverified'),
  ('Coastal Genetics', 'coastal-genetics', 'Demo record — breeder-first operation example.', 'California, US', true, 'unverified'),
  ('Hazeport', 'hazeport', 'Demo record — European cultivar house example.', 'Amsterdam, NL', true, 'unverified'),
  ('Sunroot Co.', 'sunroot-co', 'Demo record — vertically integrated brand example.', 'Michigan, US', true, 'unverified')
on conflict (slug) do nothing;

insert into strains (name, slug, brand_id, genetics_text, is_demo, verification_status)
select v.name, v.slug, b.id, v.genetics, true, 'unverified'
from (values
  ('Govern Mint Oasis', 'govern-mint-oasis', 'Kush Mints x Animal Mints', 'oasis-cultivars'),
  ('Violet Runtz', 'violet-runtz', 'Runtz x Grape Gas', 'coastal-genetics'),
  ('Hazeport Sunset', 'hazeport-sunset', 'Orange Sherbet x Haze', 'hazeport'),
  ('Lemon Cherry Gelato', 'lemon-cherry-gelato', 'Lemon Cherry x Gelato 41', 'northline-farms'),
  ('Sunroot Z', 'sunroot-z', 'Zkittlez x Dosidos', 'sunroot-co')
) as v(name, slug, genetics, brand_slug)
join brands b on b.slug = v.brand_slug
on conflict (slug) do nothing;

insert into strain_flavour_tags (strain_id, tag)
select id, tag from strains, unnest(array['Mint','Gas']) as tag where slug = 'govern-mint-oasis'
union all
select id, tag from strains, unnest(array['Candy','Grape']) as tag where slug = 'violet-runtz'
on conflict do nothing;

-- example battle pairing two demo strains (edit strain_a_id/strain_b_id as needed)
insert into blaze_battles (strain_a_id, strain_b_id, round)
select a.id, b.id, 'Round of 16'
from strains a, strains b
where a.slug = 'violet-runtz' and b.slug = 'lemon-cherry-gelato'
limit 1;
