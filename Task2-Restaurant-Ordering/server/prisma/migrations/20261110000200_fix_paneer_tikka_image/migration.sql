-- Replaces a seeded photo that showed an aquarium. Only rows still using that exact photo are changed,
-- so an image chosen later by an administrator is left alone.
UPDATE "menu_items"
SET "imageUrl" = '/images/charred-malai-paneer-tikka.svg',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'charred-malai-paneer-tikka'
  AND "imageUrl" LIKE '%photo-1599488615731%';
