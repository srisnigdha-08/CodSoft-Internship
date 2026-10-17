import { PrismaClient, Role, OrderStatus, OrderType, ReservationStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding DineDesk database...');

  // 1. Seed Users with hashed passwords
  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('Admin@12345', salt);
  const kitchenPassword = await bcrypt.hash('Kitchen@12345', salt);
  const customerPassword = await bcrypt.hash('Customer@12345', salt);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@dinedesk.local' },
    update: {},
    create: {
      email: 'admin@dinedesk.local',
      name: 'Admin Manager',
      password: adminPassword,
      phone: '+91 98765 43210',
      role: Role.ADMIN,
    },
  });

  const kitchen = await prisma.user.upsert({
    where: { email: 'kitchen@dinedesk.local' },
    update: {},
    create: {
      email: 'kitchen@dinedesk.local',
      name: 'Executive Chef Marco',
      password: kitchenPassword,
      phone: '+91 98765 43211',
      role: Role.KITCHEN_STAFF,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@dinedesk.local' },
    update: {},
    create: {
      email: 'customer@dinedesk.local',
      name: 'Priya Sharma',
      password: customerPassword,
      phone: '+91 98765 43212',
      role: Role.CUSTOMER,
    },
  });

  console.log(`Users seeded: Admin (${admin.email}), Kitchen (${kitchen.email}), Customer (${customer.email})`);

  // 2. Seed Restaurant Tables
  const tablesData = [
    { tableNumber: 'T-01', capacity: 2, locationDescription: 'Window View - Cozy Booth' },
    { tableNumber: 'T-02', capacity: 4, locationDescription: 'Main Dining Hall - Center' },
    { tableNumber: 'T-03', capacity: 4, locationDescription: 'Garden Terrace - Outdoor' },
    { tableNumber: 'T-04', capacity: 6, locationDescription: 'Family Dining Lounge' },
    { tableNumber: 'T-05', capacity: 8, locationDescription: 'VIP Private Dining Suite' },
    { tableNumber: 'T-06', capacity: 2, locationDescription: 'High-Top Bar Counter' },
  ];

  const tables = [];
  for (const table of tablesData) {
    const createdTable = await prisma.restaurantTable.upsert({
      where: { tableNumber: table.tableNumber },
      update: {},
      create: table,
    });
    tables.push(createdTable);
  }
  console.log(`Tables seeded: ${tables.length} tables created.`);

  // 3. Seed Menu Categories
  const categoriesData = [
    {
      name: 'Starters & Appetizers',
      slug: 'starters',
      description: 'Handcrafted appetizers, fresh crispy bites, and oven-fired kebabs.',
      sortOrder: 1,
    },
    {
      name: 'Main Course',
      slug: 'mains',
      description: 'Rich slow-cooked curries, artisanal risottos, and chef grill specialties.',
      sortOrder: 2,
    },
    {
      name: 'Desserts',
      slug: 'desserts',
      description: 'Decadent European confections and traditional celebratory sweets.',
      sortOrder: 3,
    },
    {
      name: 'Beverages & Drinks',
      slug: 'beverages',
      description: 'Cold-pressed mocktails, artisan coffees, and chilled brewed infusions.',
      sortOrder: 4,
    },
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoriesData) {
    const createdCat = await prisma.menuCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    categories[cat.slug] = createdCat.id;
  }
  console.log('Categories seeded.');

  // 4. Seed Menu Items
  const menuItemsData = [
    // Starters
    {
      categoryId: categories['starters'],
      name: 'Truffle Mushroom Bruschetta',
      slug: 'truffle-mushroom-bruschetta',
      description: 'Artisanal sourdough topped with wild portobello mushrooms, garlic thyme glaze, and shaved parmesan.',
      price: 260.00,
      imageUrl: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&w=800&q=80',
      isVegetarian: true,
      isAvailable: true,
      preparationTimeMinutes: 12,
      sortOrder: 1,
    },
    {
      categoryId: categories['starters'],
      name: 'Charred Malai Paneer Tikka',
      slug: 'charred-malai-paneer-tikka',
      description: 'Fresh cottage cheese cubes marinated in cardamom cream, green chili, and slow-roasted in clay tandoor.',
      price: 310.00,
      imageUrl: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=800&q=80',
      isVegetarian: true,
      isAvailable: true,
      preparationTimeMinutes: 15,
      sortOrder: 2,
    },
    {
      categoryId: categories['starters'],
      name: 'Chili Garlic Butter Prawns',
      slug: 'chili-garlic-butter-prawns',
      description: 'Pan-tossed jumbo tiger prawns in roasted garlic confit, bird eye chili, and freshly squeezed key lime.',
      price: 420.00,
      imageUrl: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=800&q=80',
      isVegetarian: false,
      isAvailable: true,
      preparationTimeMinutes: 14,
      sortOrder: 3,
    },
    {
      categoryId: categories['starters'],
      name: 'Smoked Chicken Seekh Kebab',
      slug: 'smoked-chicken-seekh-kebab',
      description: 'Tender minced chicken skewers infused with royal cumin, cilantro, served with house mint chutney.',
      price: 340.00,
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
      isVegetarian: false,
      isAvailable: true,
      preparationTimeMinutes: 18,
      sortOrder: 4,
    },

    // Mains
    {
      categoryId: categories['mains'],
      name: 'Butter Chicken Royale',
      slug: 'butter-chicken-royale',
      description: 'Succulent boneless chicken tikka simmered in a velvet sun-ripened tomato gravy finished with fenugreek and butter.',
      price: 440.00,
      imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=800&q=80',
      isVegetarian: false,
      isAvailable: true,
      preparationTimeMinutes: 20,
      sortOrder: 1,
    },
    {
      categoryId: categories['mains'],
      name: 'Slow-Cooked Dal Makhani',
      slug: 'slow-cooked-dal-makhani',
      description: 'Black lentils slow-cooked overnight with churned white butter, cream, and aromatic Kashmiri spices.',
      price: 320.00,
      imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
      isVegetarian: true,
      isAvailable: true,
      preparationTimeMinutes: 15,
      sortOrder: 2,
    },
    {
      categoryId: categories['mains'],
      name: 'Wild Mushroom Risotto',
      slug: 'wild-mushroom-risotto',
      description: 'Arborio rice cooked in savory vegetable broth with porcini mushrooms, white truffle oil, and aged parmesan.',
      price: 390.00,
      imageUrl: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=800&q=80',
      isVegetarian: true,
      isAvailable: true,
      preparationTimeMinutes: 22,
      sortOrder: 3,
    },
    {
      categoryId: categories['mains'],
      name: 'Pan-Seared Atlantic Salmon',
      slug: 'pan-seared-atlantic-salmon',
      description: 'Crisp skin Atlantic salmon fillet served with asparagus, creamy saffron veloute, and roasted baby potatoes.',
      price: 620.00,
      imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=800&q=80',
      isVegetarian: false,
      isAvailable: true,
      preparationTimeMinutes: 25,
      sortOrder: 4,
    },

    // Desserts
    {
      categoryId: categories['desserts'],
      name: 'Classic Espresso Tiramisu',
      slug: 'classic-espresso-tiramisu',
      description: 'Italian savoiardi dipped in freshly pulled arabica espresso, layered with whipped mascarpone and Valrhona cocoa.',
      price: 270.00,
      imageUrl: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=800&q=80',
      isVegetarian: true,
      isAvailable: true,
      preparationTimeMinutes: 8,
      sortOrder: 1,
    },
    {
      categoryId: categories['desserts'],
      name: 'Molten Belgian Chocolate Lava Cake',
      slug: 'molten-belgian-chocolate-lava-cake',
      description: 'Warm dark chocolate souffle with a flowing center, served alongside Madagascar bourbon vanilla bean gelato.',
      price: 290.00,
      imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80',
      isVegetarian: true,
      isAvailable: true,
      preparationTimeMinutes: 12,
      sortOrder: 2,
    },
    {
      categoryId: categories['desserts'],
      name: 'Saffron & Rose Petal Gulab Jamun',
      slug: 'saffron-rose-gulab-jamun',
      description: 'Warm cottage cheese dumplings steeped in saffron-scented honey syrup, garnished with pistachio slivers.',
      price: 190.00,
      imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
      isVegetarian: true,
      isAvailable: true,
      preparationTimeMinutes: 6,
      sortOrder: 3,
    },

    // Beverages
    {
      categoryId: categories['beverages'],
      name: 'Signature Hibiscus Berry Spritz',
      slug: 'signature-hibiscus-berry-spritz',
      description: 'Brewed Egyptian hibiscus flowers, crushed wild raspberries, sparkling soda, and fresh rosemary sprig.',
      price: 180.00,
      imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
      isVegetarian: true,
      isAvailable: true,
      preparationTimeMinutes: 5,
      sortOrder: 1,
    },
    {
      categoryId: categories['beverages'],
      name: 'Fresh Mint & Lime Mojito',
      slug: 'fresh-mint-lime-mojito',
      description: 'Muddled garden spearmint, raw demerara sugar, Persian lime juice, topped with club soda and crushed ice.',
      price: 170.00,
      imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80',
      isVegetarian: true,
      isAvailable: true,
      preparationTimeMinutes: 5,
      sortOrder: 2,
    },
    {
      categoryId: categories['beverages'],
      name: 'Artisan Cold Brew Coffee',
      slug: 'artisan-cold-brew-coffee',
      description: 'Single-origin Ethiopian Yirgacheffe beans steeped cold for 18 hours, served chilled over rock ice.',
      price: 210.00,
      imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=800&q=80',
      isVegetarian: true,
      isAvailable: true,
      preparationTimeMinutes: 4,
      sortOrder: 3,
    },
  ];

  const seededItems = [];
  for (const item of menuItemsData) {
    const createdItem = await prisma.menuItem.upsert({
      where: { slug: item.slug },
      update: {},
      create: item,
    });
    seededItems.push(createdItem);
  }
  console.log(`Menu Items seeded: ${seededItems.length} items available.`);

  // 5. Seed a Sample Active Order
  const existingOrder = await prisma.order.findUnique({
    where: { orderNumber: 'ORD-20261017-001' },
  });

  if (!existingOrder) {
    const item1 = seededItems.find(i => i.slug === 'butter-chicken-royale') || seededItems[0];
    const item2 = seededItems.find(i => i.slug === 'truffle-mushroom-bruschetta') || seededItems[1];

    const subtotal = Number(item1.price) + Number(item2.price);
    const tax = Number((subtotal * 0.05).toFixed(2));
    const totalAmount = subtotal + tax;

    const sampleOrder = await prisma.order.create({
      data: {
        orderNumber: 'ORD-20261017-001',
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone || '+91 98765 43212',
        orderType: OrderType.DINE_IN,
        tableId: tables[0].id,
        status: OrderStatus.PREPARING,
        subtotal: subtotal,
        tax: tax,
        deliveryFee: 0,
        totalAmount: totalAmount,
        notes: 'Please make it medium spicy. Window table requested.',
        items: {
          create: [
            {
              menuItemId: item1.id,
              name: item1.name,
              price: item1.price,
              quantity: 1,
              subtotal: item1.price,
              notes: 'Boneless tender piece',
            },
            {
              menuItemId: item2.id,
              name: item2.name,
              price: item2.price,
              quantity: 1,
              subtotal: item2.price,
              notes: 'Extra crisp sourdough',
            },
          ],
        },
        payment: {
          create: {
            paymentNumber: 'PAY-20261017-001',
            amount: totalAmount,
            method: PaymentMethod.MOCK_ONLINE,
            status: PaymentStatus.SUCCESSFUL,
            transactionRef: 'TXN-MOCK-98327461',
            gatewayResponse: JSON.stringify({ verified: true, provider: 'DineDesk-MockGateway', code: 'AUTH_SUCCESS' }),
          },
        },
        statusHistory: {
          create: [
            {
              previousStatus: null,
              newStatus: OrderStatus.PENDING,
              changedByUserId: customer.id,
              notes: 'Order placed by customer via digital menu checkout',
            },
            {
              previousStatus: OrderStatus.PENDING,
              newStatus: OrderStatus.CONFIRMED,
              changedByUserId: admin.id,
              notes: 'Payment verified and table allocated',
            },
            {
              previousStatus: OrderStatus.CONFIRMED,
              newStatus: OrderStatus.PREPARING,
              changedByUserId: kitchen.id,
              notes: 'Order accepted by Kitchen Station #2',
            },
          ],
        },
      },
    });

    console.log(`Sample order created: ${sampleOrder.orderNumber} (Status: ${sampleOrder.status})`);
  }

  // 6. Seed a Sample Reservation
  const existingReservation = await prisma.reservation.findUnique({
    where: { reservationNumber: 'RES-20261017-001' },
  });

  if (!existingReservation) {
    const sampleReservation = await prisma.reservation.create({
      data: {
        reservationNumber: 'RES-20261017-001',
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone || '+91 98765 43212',
        tableId: tables[1].id,
        guestCount: 3,
        reservationDate: '2026-10-18',
        reservationTime: '19:30',
        status: ReservationStatus.CONFIRMED,
        specialRequests: 'Celebrating a promotion. Quiet table preferred.',
      },
    });
    console.log(`Sample reservation created: ${sampleReservation.reservationNumber}`);
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
