import bcrypt from 'bcryptjs';
import { randomObjectId } from '../models/shared';
import { runAtomic } from '../db';
import {
  MenuCategory,
  MenuItem,
  Order,
  OrderStatus,
  OrderStatusHistory,
  OrderType,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Reservation,
  ReservationStatus,
  RestaurantTable,
  Role,
  User,
} from '../models';
import { categoriesData, menuItemsData, tablesData } from './data';

const SAMPLE_ORDER_NUMBER = 'ORD-20261017-001';
const SAMPLE_RESERVATION_NUMBER = 'RES-20261017-001';

/** Creates missing demo records. Existing records are left unchanged, so it is safe to re-run. */
export async function seedDatabase(log: (message: string) => void = () => undefined): Promise<void> {
  // The seed creates accounts with publicly documented passwords
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo accounts when NODE_ENV=production.');
  }

  const upsert = <T>(model: any, filter: object, values: object): Promise<T> =>
    model.findOneAndUpdate(filter, { $setOnInsert: values }, { upsert: true, new: true });

  // 1. Users with hashed passwords
  const salt = await bcrypt.genSalt(10);
  const seedUser = async (email: string, name: string, password: string, phone: string, role: Role) =>
    upsert<any>(User, { email }, { name, passwordHash: await bcrypt.hash(password, salt), phone, role });

  const admin = await seedUser('admin@dinedesk.local', 'Admin Manager', 'Admin@12345', '+91 98765 43210', Role.ADMIN);
  const kitchen = await seedUser('kitchen@dinedesk.local', 'Executive Chef Marco', 'Kitchen@12345', '+91 98765 43211', Role.KITCHEN_STAFF);
  const customer = await seedUser('customer@dinedesk.local', 'Priya Sharma', 'Customer@12345', '+91 98765 43212', Role.CUSTOMER);
  log(`Users seeded: ${admin.email}, ${kitchen.email}, ${customer.email}`);

  // 2. Restaurant tables
  const tables: any[] = [];
  for (const table of tablesData) {
    tables.push(await upsert(RestaurantTable, { tableNumber: table.tableNumber }, table));
  }
  log(`Tables seeded: ${tables.length}`);

  // 3. Menu categories
  const categories: Record<string, any> = {};
  for (const category of categoriesData) {
    categories[category.slug] = await upsert(MenuCategory, { slug: category.slug }, category);
  }
  log(`Categories seeded: ${Object.keys(categories).length}`);

  // 4. Menu items
  const items: any[] = [];
  for (const { categorySlug, ...item } of menuItemsData) {
    items.push(await upsert(MenuItem, { slug: item.slug }, { ...item, categoryId: categories[categorySlug]._id }));
  }
  log(`Menu items seeded: ${items.length}`);

  // 5. A sample active order, with its payment and status history
  if (!(await Order.exists({ orderNumber: SAMPLE_ORDER_NUMBER }))) {
    const item1 = items.find((i) => i.slug === 'butter-chicken-royale') ?? items[0];
    const item2 = items.find((i) => i.slug === 'truffle-mushroom-bruschetta') ?? items[1];
    const subtotal = item1.price + item2.price;
    const tax = Number((subtotal * 0.05).toFixed(2));
    const totalAmount = Number((subtotal + tax).toFixed(2));
    const orderId = randomObjectId();

    await runAtomic(
      async (session) => {
        await Order.create(
          [
            {
              _id: orderId,
              orderNumber: SAMPLE_ORDER_NUMBER,
              customerId: customer._id,
              customerName: customer.name,
              customerEmail: customer.email,
              customerPhone: customer.phone,
              orderType: OrderType.DINE_IN,
              tableId: tables[0]._id,
              status: OrderStatus.PREPARING,
              subtotal,
              tax,
              deliveryFee: 0,
              totalAmount,
              notes: 'Please make it medium spicy. Window table requested.',
              items: [
                { menuItemId: item1._id, name: item1.name, price: item1.price, quantity: 1, subtotal: item1.price, notes: 'Boneless tender piece' },
                { menuItemId: item2._id, name: item2.name, price: item2.price, quantity: 1, subtotal: item2.price, notes: 'Extra crisp sourdough' },
              ],
            },
          ],
          { session }
        );
        await Payment.create(
          [
            {
              paymentNumber: 'PAY-20261017-001',
              orderId,
              customerId: customer._id,
              amount: totalAmount,
              method: PaymentMethod.MOCK_ONLINE,
              status: PaymentStatus.SUCCESSFUL,
              transactionRef: 'TXN-MOCK-98327461',
              gatewayResponse: JSON.stringify({ verified: true, provider: 'DineDesk-MockGateway', code: 'AUTH_SUCCESS' }),
            },
          ],
          { session }
        );
        await OrderStatusHistory.insertMany(
          [
            { orderId, previousStatus: null, newStatus: OrderStatus.PENDING, changedByUserId: customer._id, notes: 'Order placed by customer via digital menu checkout' },
            { orderId, previousStatus: OrderStatus.PENDING, newStatus: OrderStatus.CONFIRMED, changedByUserId: admin._id, notes: 'Payment verified and table allocated' },
            { orderId, previousStatus: OrderStatus.CONFIRMED, newStatus: OrderStatus.PREPARING, changedByUserId: kitchen._id, notes: 'Order accepted by Kitchen Station #2' },
          ],
          { session }
        );
      },
      async () => {
        await Promise.all([
          Order.deleteOne({ _id: orderId }),
          Payment.deleteOne({ orderId }),
          OrderStatusHistory.deleteMany({ orderId }),
        ]);
      }
    );
    log(`Sample order created: ${SAMPLE_ORDER_NUMBER}`);
  }

  // 6. A sample reservation
  if (!(await Reservation.exists({ reservationNumber: SAMPLE_RESERVATION_NUMBER }))) {
    await Reservation.create({
      reservationNumber: SAMPLE_RESERVATION_NUMBER,
      customerId: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      tableId: tables[1]._id,
      guestCount: 3,
      reservationDate: '2026-10-18',
      reservationTime: '19:30',
      status: ReservationStatus.CONFIRMED,
      specialRequests: 'Celebrating a promotion. Quiet table preferred.',
    });
    log(`Sample reservation created: ${SAMPLE_RESERVATION_NUMBER}`);
  }
}
