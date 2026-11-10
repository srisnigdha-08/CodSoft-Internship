-- CreateIndex
CREATE INDEX "menu_items_categoryId_idx" ON "menu_items"("categoryId");

-- CreateIndex
CREATE INDEX "menu_items_isAvailable_idx" ON "menu_items"("isAvailable");

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- CreateIndex
CREATE INDEX "orders_tableId_idx" ON "orders"("tableId");

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_menuItemId_idx" ON "order_items"("menuItemId");

-- CreateIndex
CREATE INDEX "reservations_customerId_idx" ON "reservations"("customerId");

-- CreateIndex
CREATE INDEX "reservations_tableId_reservationDate_reservationTime_idx" ON "reservations"("tableId", "reservationDate", "reservationTime");

-- CreateIndex
CREATE INDEX "reservations_reservationDate_reservationTime_idx" ON "reservations"("reservationDate", "reservationTime");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "order_status_history_orderId_createdAt_idx" ON "order_status_history"("orderId", "createdAt");


-- Double-booking guard (hand-written: Prisma schema syntax cannot express partial indexes).
-- A table can hold at most one active (PENDING or CONFIRMED) reservation per exact date and time.
-- Cancelled and completed reservations do not occupy the slot.
-- This migration fails if duplicates already exist; resolve them first rather than deleting data blindly.
CREATE UNIQUE INDEX "reservations_active_table_slot_key"
  ON "reservations" ("tableId", "reservationDate", "reservationTime")
  WHERE "status" IN ('PENDING', 'CONFIRMED') AND "tableId" IS NOT NULL;
