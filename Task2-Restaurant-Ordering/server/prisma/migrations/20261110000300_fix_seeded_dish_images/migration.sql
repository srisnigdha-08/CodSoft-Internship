-- Replaces three seeded photos that did not match their dishes. Only rows still using the exact
-- original photo are changed, so an image chosen later by an administrator is left alone.
UPDATE "menu_items"
SET "imageUrl" = '/images/saffron-rose-gulab-jamun.svg',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'saffron-rose-gulab-jamun'
  AND "imageUrl" LIKE '%photo-1589301760014%';

UPDATE "menu_items"
SET "imageUrl" = '/images/smoked-chicken-seekh-kebab.svg',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'smoked-chicken-seekh-kebab'
  AND "imageUrl" LIKE '%photo-1544025162%';

UPDATE "menu_items"
SET "imageUrl" = '/images/signature-hibiscus-berry-spritz.svg',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'signature-hibiscus-berry-spritz'
  AND "imageUrl" LIKE '%photo-1513558161293%';
