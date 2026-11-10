/**
 * One-time copy of an existing DineDesk PostgreSQL database into MongoDB.
 *
 * The source database is only read: every query runs in a read-only session through the psql
 * command-line client, so the application itself has no PostgreSQL dependency.
 *
 * Usage (from server/):
 *   POSTGRES_MIGRATION_URL=postgresql://USER:PASSWORD@localhost:5432/dinedesk_db npm run migrate:postgres -- --dry-run
 *   POSTGRES_MIGRATION_URL=postgresql://USER:PASSWORD@localhost:5432/dinedesk_db npm run migrate:postgres
 *
 * Options:
 *   --dry-run         Read and transform only. Nothing is written to MongoDB.
 *   --allow-existing  Permit writing to a non-empty database, needed to re-run the migration.
 *
 * Set PSQL_PATH if psql is not on your PATH. Re-running is safe: ids are derived from the old
 * UUIDs, so each source row always maps to the same document.
 */
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../db';
import { MenuCategory, MenuItem, Order, OrderStatusHistory, Payment, Reservation, ReservationStatus, RestaurantTable, User } from '../models';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

type Row = Record<string, any>;

const toObjectId = (uuid: string) => new Types.ObjectId(createHash('sha256').update(uuid).digest().subarray(0, 12));
const optionalId = (uuid: string | null | undefined) => (uuid ? toObjectId(uuid) : null);
// json_agg returns Prisma's UTC timestamps without a zone suffix
const toDate = (value: string) => new Date(/[zZ]|[+-]\d\d(:?\d\d)?$/.test(value) ? value : `${value}Z`);
const toMoney = (value: string | number) => Number(Number(value).toFixed(2));

function readTable(url: URL, table: string): Row[] {
  const output = execFileSync(
    process.env.PSQL_PATH || 'psql',
    ['-w', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', `SELECT COALESCE(json_agg(t), '[]'::json) FROM "${table}" t`],
    {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 512,
      // Credentials travel through the environment so they never appear in a process listing
      env: {
        ...process.env,
        PGHOST: url.hostname,
        PGPORT: url.port || '5432',
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        PGDATABASE: url.pathname.slice(1),
        PGCLIENTENCODING: 'UTF8',
        PGOPTIONS: '-c default_transaction_read_only=on',
      },
    }
  );
  return JSON.parse(output);
}

function transform(source: Record<string, Row[]>) {
  const stamps = (r: Row) => ({ createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt ?? r.createdAt) });

  const itemsByOrder = new Map<string, Row[]>();
  for (const item of source.order_items) {
    itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
  }
  const ordersById = new Map(source.orders.map((o) => [o.id, o]));

  return {
    users: source.users.map((r) => ({
      _id: toObjectId(r.id),
      email: r.email,
      passwordHash: r.password,
      name: r.name,
      phone: r.phone,
      role: r.role,
      ...stamps(r),
    })),
    menuCategories: source.menu_categories.map((r) => ({
      _id: toObjectId(r.id),
      name: r.name,
      slug: r.slug,
      description: r.description,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
      ...stamps(r),
    })),
    menuItems: source.menu_items.map((r) => ({
      _id: toObjectId(r.id),
      categoryId: toObjectId(r.categoryId),
      name: r.name,
      slug: r.slug,
      description: r.description,
      price: toMoney(r.price),
      imageUrl: r.imageUrl,
      isVegetarian: r.isVegetarian,
      isAvailable: r.isAvailable,
      preparationTimeMinutes: r.preparationTimeMinutes,
      sortOrder: r.sortOrder,
      ...stamps(r),
    })),
    restaurantTables: source.restaurant_tables.map((r) => ({
      _id: toObjectId(r.id),
      tableNumber: r.tableNumber,
      capacity: r.capacity,
      locationDescription: r.locationDescription,
      isActive: r.isActive,
      ...stamps(r),
    })),
    orders: source.orders.map((r) => ({
      _id: toObjectId(r.id),
      orderNumber: r.orderNumber,
      customerId: optionalId(r.customerId),
      customerName: r.customerName,
      customerEmail: r.customerEmail,
      customerPhone: r.customerPhone,
      orderType: r.orderType,
      tableId: optionalId(r.tableId),
      deliveryAddress: r.deliveryAddress,
      status: r.status,
      subtotal: toMoney(r.subtotal),
      tax: toMoney(r.tax),
      deliveryFee: toMoney(r.deliveryFee),
      totalAmount: toMoney(r.totalAmount),
      notes: r.notes,
      items: (itemsByOrder.get(r.id) ?? []).map((item) => ({
        _id: toObjectId(item.id),
        menuItemId: optionalId(item.menuItemId),
        name: item.name,
        price: toMoney(item.price),
        quantity: item.quantity,
        subtotal: toMoney(item.subtotal),
        notes: item.notes,
        createdAt: toDate(item.createdAt),
      })),
      ...stamps(r),
    })),
    reservations: source.reservations.map((r) => ({
      _id: toObjectId(r.id),
      reservationNumber: r.reservationNumber,
      customerId: optionalId(r.customerId),
      customerName: r.customerName,
      customerEmail: r.customerEmail,
      customerPhone: r.customerPhone,
      tableId: optionalId(r.tableId),
      guestCount: r.guestCount,
      reservationDate: r.reservationDate,
      reservationTime: r.reservationTime,
      status: r.status,
      specialRequests: r.specialRequests,
      holdsSlot: Boolean(r.tableId) && [ReservationStatus.PENDING, ReservationStatus.CONFIRMED].includes(r.status),
      ...stamps(r),
    })),
    payments: source.payments.map((r) => ({
      _id: toObjectId(r.id),
      paymentNumber: r.paymentNumber,
      orderId: toObjectId(r.orderId),
      customerId: optionalId(ordersById.get(r.orderId)?.customerId),
      amount: toMoney(r.amount),
      method: r.method,
      status: r.status,
      transactionRef: r.transactionRef,
      gatewayResponse: r.gatewayResponse,
      ...stamps(r),
    })),
    orderStatusHistory: source.order_status_history.map((r) => ({
      _id: toObjectId(r.id),
      orderId: toObjectId(r.orderId),
      previousStatus: r.previousStatus,
      newStatus: r.newStatus,
      changedByUserId: optionalId(r.changedByUserId),
      notes: r.notes,
      createdAt: toDate(r.createdAt),
    })),
  };
}

const MODELS: Record<string, mongoose.Model<any>> = {
  users: User,
  menuCategories: MenuCategory,
  menuItems: MenuItem,
  restaurantTables: RestaurantTable,
  orders: Order,
  reservations: Reservation,
  payments: Payment,
  orderStatusHistory: OrderStatusHistory,
};

async function validate(documents: ReturnType<typeof transform>, source: Record<string, Row[]>): Promise<string[]> {
  const problems: string[] = [];

  for (const [name, docs] of Object.entries(documents)) {
    const count = await MODELS[name].countDocuments({ _id: { $in: docs.map((d) => d._id) } });
    console.log(`  ${name}: ${docs.length} source, ${count} in MongoDB`);
    if (count !== docs.length) {
      problems.push(`${name}: expected ${docs.length}, found ${count}`);
    }
  }

  const sum = (rows: Row[]) => Number(rows.reduce((total, r) => total + Number(r.totalAmount), 0).toFixed(2));
  const orders = await Order.find({ _id: { $in: documents.orders.map((o) => o._id) } }).lean();
  if (sum(orders) !== sum(source.orders)) {
    problems.push(`order total mismatch: ${sum(source.orders)} source, ${sum(orders)} in MongoDB`);
  }
  const embeddedItems = orders.reduce((total, o) => total + o.items.length, 0);
  console.log(`  embedded order items: ${source.order_items.length} source, ${embeddedItems} in MongoDB`);
  if (embeddedItems !== source.order_items.length) {
    problems.push('embedded order item count mismatch');
  }

  const missing = async (label: string, ids: unknown[], model: mongoose.Model<any>) => {
    const unique = [...new Set(ids.filter(Boolean).map(String))];
    const found = await model.countDocuments({ _id: { $in: unique } });
    if (found !== unique.length) {
      problems.push(`${label}: ${unique.length - found} broken reference(s)`);
    }
  };
  await missing('menuItems.categoryId', documents.menuItems.map((d) => d.categoryId), MenuCategory);
  await missing('orders.customerId', documents.orders.map((d) => d.customerId), User);
  await missing('orders.tableId', documents.orders.map((d) => d.tableId), RestaurantTable);
  await missing('orders.items.menuItemId', documents.orders.flatMap((d) => d.items.map((i: Row) => i.menuItemId)), MenuItem);
  await missing('reservations.tableId', documents.reservations.map((d) => d.tableId), RestaurantTable);
  await missing('payments.orderId', documents.payments.map((d) => d.orderId), Order);
  await missing('orderStatusHistory.orderId', documents.orderStatusHistory.map((d) => d.orderId), Order);

  return problems;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const allowExisting = args.includes('--allow-existing');

  const sourceUrl = process.env.POSTGRES_MIGRATION_URL;
  const targetUri = process.env.MONGODB_URI;
  if (!sourceUrl) throw new Error('POSTGRES_MIGRATION_URL is required.');
  if (!targetUri) throw new Error('MONGODB_URI is required.');

  const url = new URL(sourceUrl);
  const source: Record<string, Row[]> = {};
  for (const table of ['users', 'menu_categories', 'menu_items', 'restaurant_tables', 'orders', 'order_items', 'reservations', 'payments', 'order_status_history']) {
    source[table] = readTable(url, table);
    console.log(`Read ${table}: ${source[table].length} rows`);
  }

  const documents = transform(source);

  if (dryRun) {
    console.log('Dry run complete. Nothing was written to MongoDB.');
    return;
  }

  await connectDatabase(targetUri);

  if (!allowExisting && (await User.estimatedDocumentCount()) > 0) {
    throw new Error('The target database is not empty. Use an empty database, or pass --allow-existing to re-run a previous migration.');
  }

  // Parents first. Raw writes keep the original timestamps.
  for (const [name, docs] of Object.entries(documents)) {
    if (docs.length > 0) {
      await MODELS[name].collection.bulkWrite(
        docs.map((doc: Row) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } })),
        { ordered: true }
      );
    }
  }

  console.log('Validating...');
  const problems = await validate(documents, source);
  if (problems.length > 0) {
    throw new Error(`Validation failed:\n- ${problems.join('\n- ')}`);
  }
  console.log('Migration completed and validated. The PostgreSQL database was not changed.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
