/** Fictional demo data. All people, businesses and products are invented. */
export const DEMO_PASSWORDS = {
  ADMIN: 'Admin@12345',
  VENDOR: 'Vendor@12345',
  CUSTOMER: 'Customer@12345',
} as const;

const cityAddress = (line1: string, city: string, state: string, postalCode: string) => ({
  line1,
  city,
  state,
  postalCode,
  country: 'India',
});

export const seedCategories = [
  ['Electronics', 'Headphones, chargers, smart devices and more.'],
  ['Fashion', 'Everyday clothing, footwear and accessories.'],
  ['Home & Kitchen', 'Cookware, decor and useful things for home.'],
  ['Beauty', 'Skincare and personal care essentials.'],
  ['Books', 'Fiction, non-fiction and notebooks.'],
  ['Sports', 'Gear for training, yoga and the outdoors.'],
  ['Groceries', 'Pantry staples, snacks and beverages.'],
].map(([name, description]) => ({
  name,
  description,
  image: `/catalog/categories/${name.toLowerCase().replace(/[^a-z]+/g, '-')}.svg`,
}));

export const seedAdmin = { name: 'Asha Admin', email: 'admin@example.com', phone: '+91 90000 00001' };

export const seedCustomers = [
  { name: 'Riya Customer', email: 'customer@example.com', phone: '+91 90000 00010' },
  { name: 'Kabir Shopper', email: 'customer2@example.com', phone: '+91 90000 00011' },
];

export const seedVendors = [
  {
    key: 'aurora',
    owner: { name: 'Meera Nair', email: 'vendor1@example.com', phone: '+91 90000 00101' },
    businessName: 'Aurora Electronics',
    description: 'Thoughtfully chosen audio, charging and smart-home gear.',
    logo: '/catalog/vendors/aurora.svg',
    address: cityAddress('14 Circuit Lane', 'Bengaluru', 'Karnataka', '560001'),
    approvalStatus: 'APPROVED',
  },
  {
    key: 'thread',
    owner: { name: 'Dev Malhotra', email: 'vendor2@example.com', phone: '+91 90000 00102' },
    businessName: 'Urban Thread Co.',
    description: 'Comfortable everyday fashion and small-batch skincare.',
    logo: '/catalog/vendors/thread.svg',
    address: cityAddress('8 Loom Street', 'Jaipur', 'Rajasthan', '302001'),
    approvalStatus: 'APPROVED',
  },
  {
    key: 'hearth',
    owner: { name: 'Lata Iyer', email: 'vendor3@example.com', phone: '+91 90000 00103' },
    businessName: 'Hearth & Home Goods',
    description: 'Kitchenware, home decor and honest pantry staples.',
    logo: '/catalog/vendors/hearth.svg',
    address: cityAddress('22 Spice Market Road', 'Kochi', 'Kerala', '682001'),
    approvalStatus: 'APPROVED',
  },
  {
    key: 'trailhead',
    owner: { name: 'Arjun Bose', email: 'vendor4@example.com', phone: '+91 90000 00104' },
    businessName: 'Trailhead Sports',
    description: 'Training and outdoor gear, plus books for the journey.',
    logo: '/catalog/vendors/trailhead.svg',
    address: cityAddress('5 Ridge View', 'Pune', 'Maharashtra', '411001'),
    approvalStatus: 'APPROVED',
  },
  {
    key: 'paperleaf',
    owner: { name: 'Tara Sen', email: 'vendor5@example.com', phone: '+91 90000 00105' },
    businessName: 'Paperleaf Stationers',
    description: 'A new store awaiting marketplace approval.',
    logo: '/catalog/vendors/paperleaf.svg',
    address: cityAddress('3 College Road', 'Kolkata', 'West Bengal', '700001'),
    approvalStatus: 'PENDING',
  },
  {
    key: 'quickdeal',
    owner: { name: 'Nikhil Rao', email: 'vendor6@example.com', phone: '+91 90000 00106' },
    businessName: 'QuickDeal Outlet',
    description: 'Suspended demo store. Its products stay hidden from customers.',
    logo: '/catalog/vendors/quickdeal.svg',
    address: cityAddress('77 Bazaar Road', 'Hyderabad', 'Telangana', '500001'),
    approvalStatus: 'SUSPENDED',
  },
] as const;

type VendorKey = (typeof seedVendors)[number]['key'];

interface SeedProduct {
  vendor: VendorKey;
  category: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  stock: number;
}

const product = (
  vendor: VendorKey,
  category: string,
  sku: string,
  name: string,
  price: number,
  stock: number,
  description: string,
): SeedProduct => ({ vendor, category, sku, name, price, stock, description });

export const seedProducts: SeedProduct[] = [
  product('aurora', 'Electronics', 'AUR-HP-01', 'Aurora Wave Wireless Headphones', 3499, 25, 'Over-ear Bluetooth headphones with active noise reduction and 40-hour battery life.'),
  product('aurora', 'Electronics', 'AUR-SP-02', 'Pulse Mini Bluetooth Speaker', 1299, 40, 'Pocket-size waterproof speaker with surprisingly warm sound and a 12-hour battery.'),
  product('aurora', 'Electronics', 'AUR-CH-03', 'VoltDock 65W GaN Charger', 1899, 60, 'Compact three-port fast charger that powers a laptop, phone and earbuds at once.'),
  product('aurora', 'Electronics', 'AUR-KB-04', 'Quill Low-Profile Mechanical Keyboard', 4299, 3, 'Slim wireless mechanical keyboard with quiet tactile switches and white backlight.'),
  product('aurora', 'Electronics', 'AUR-LM-05', 'Lumen Smart Desk Lamp', 2199, 18, 'Dimmable LED lamp with colour-temperature control and a built-in wireless charger.'),
  product('aurora', 'Sports', 'AUR-WT-06', 'Stride Fitness Watch', 2799, 0, 'Lightweight tracker with heart-rate sensing, GPS pairing and a seven-day battery.'),
  product('thread', 'Fashion', 'UTC-TS-01', 'Everyday Organic Cotton T-Shirt', 699, 120, 'Soft, breathable crew-neck tee cut from certified organic cotton.'),
  product('thread', 'Fashion', 'UTC-DN-02', 'Slim Indigo Stretch Jeans', 1899, 45, 'Mid-rise slim jeans with just enough stretch for all-day comfort.'),
  product('thread', 'Fashion', 'UTC-JK-03', 'Canvas Field Jacket', 3299, 16, 'Water-resistant cotton jacket with four utility pockets and a soft lining.'),
  product('thread', 'Fashion', 'UTC-SN-04', 'Cloudstep Canvas Sneakers', 1599, 34, 'Lightweight everyday sneakers with a cushioned insole and durable rubber sole.'),
  product('thread', 'Fashion', 'UTC-BG-05', 'Weekender Tote Bag', 1199, 28, 'Heavy canvas tote with leather handles, a zip pocket and room for a laptop.'),
  product('thread', 'Beauty', 'UTC-FW-06', 'Neem & Tulsi Face Wash', 349, 80, 'A gentle gel cleanser with neem and tulsi extracts for daily use.'),
  product('thread', 'Beauty', 'UTC-SR-07', 'Vitamin C Glow Serum', 899, 50, 'Lightweight brightening serum with 10% vitamin C and hyaluronic acid.'),
  product('hearth', 'Home & Kitchen', 'HHG-CK-01', 'Cast Iron Skillet 26cm', 1749, 22, 'Pre-seasoned skillet that moves from stove to oven and lasts for decades.'),
  product('hearth', 'Home & Kitchen', 'HHG-KN-02', 'Santoku Chef Knife', 1399, 30, 'Balanced 18cm stainless steel knife with a comfortable pakkawood handle.'),
  product('hearth', 'Home & Kitchen', 'HHG-MG-03', 'Stoneware Mug Set of 4', 899, 36, 'Hand-glazed 350ml mugs in earthy tones. Microwave and dishwasher safe.'),
  product('hearth', 'Home & Kitchen', 'HHG-BD-04', 'Acacia Cutting Board', 1099, 26, 'A thick end-grain board with juice groove and easy-grip side handles.'),
  product('hearth', 'Beauty', 'HHG-SP-05', 'Cold-Pressed Coconut Soap Trio', 449, 70, 'Three handmade soaps with coconut oil, oats and natural essential oils.'),
  product('hearth', 'Groceries', 'HHG-TE-06', 'Single-Estate Assam Tea 250g', 399, 90, 'Malty, full-bodied whole-leaf black tea from a single Assam garden.'),
  product('hearth', 'Groceries', 'HHG-HN-07', 'Wild Forest Honey 500g', 549, 55, 'Raw unfiltered honey collected from forest hives in the Western Ghats.'),
  product('hearth', 'Groceries', 'HHG-CF-08', 'Medium Roast Coffee Beans 500g', 699, 44, 'Arabica beans from Chikmagalur with notes of cocoa and caramel.'),
  product('trailhead', 'Sports', 'THS-YM-01', 'GripFlow Yoga Mat', 1299, 42, 'Non-slip 6mm natural rubber mat with alignment lines and a carry strap.'),
  product('trailhead', 'Sports', 'THS-BP-02', 'Ridgeline 40L Trekking Backpack', 3899, 15, 'Ventilated back panel, integrated rain cover and plenty of compartments.'),
  product('trailhead', 'Sports', 'THS-BT-03', 'ThermoPeak Steel Bottle 1L', 799, 75, 'Double-walled bottle that keeps water cold for 24 hours and tea hot for 12.'),
  product('trailhead', 'Sports', 'THS-RB-04', 'Resistance Band Set', 649, 5, 'Five latex bands from light to extra heavy, with handles and a door anchor.'),
  product('trailhead', 'Books', 'THS-BK-05', 'The Long Trail: Field Notes', 499, 38, 'Essays and practical advice collected from a decade of Himalayan treks.'),
  product('trailhead', 'Books', 'THS-BK-06', 'Strength for Beginners', 599, 24, 'A clear 12-week progression for building strength at home or in the gym.'),
  product('trailhead', 'Groceries', 'THS-GR-07', 'Trail Mix Energy Pack', 299, 100, 'Roasted nuts, seeds and dried fruit in a resealable 300g pouch.'),
  product('quickdeal', 'Electronics', 'QDO-EB-01', 'Budget Wired Earbuds', 199, 200, 'Hidden from shoppers while this demo store remains suspended.'),
];

export const seedCatalogImage = (sku: string): string => `/catalog/products/${sku.toLowerCase()}.svg`;

/** Historic orders that give dashboards and reviews real data to show. */
export const seedOrders = [
  {
    orderNumber: 'MKT-DEMO-0001',
    customer: 'customer@example.com',
    daysAgo: 12,
    shipments: [
      { vendor: 'aurora', status: 'DELIVERED', items: [['AUR-CH-03', 1], ['AUR-SP-02', 1]] },
      { vendor: 'thread', status: 'DELIVERED', items: [['UTC-TS-01', 2]] },
    ],
  },
  {
    orderNumber: 'MKT-DEMO-0002',
    customer: 'customer@example.com',
    daysAgo: 4,
    shipments: [
      { vendor: 'hearth', status: 'DELIVERED', items: [['HHG-MG-03', 1], ['HHG-TE-06', 2]] },
      { vendor: 'trailhead', status: 'SHIPPED', items: [['THS-YM-01', 1]] },
    ],
  },
  {
    orderNumber: 'MKT-DEMO-0003',
    customer: 'customer2@example.com',
    daysAgo: 7,
    shipments: [
      { vendor: 'aurora', status: 'DELIVERED', items: [['AUR-CH-03', 1]] },
      { vendor: 'thread', status: 'PROCESSING', items: [['UTC-SN-04', 1]] },
    ],
  },
  {
    orderNumber: 'MKT-DEMO-0004',
    customer: 'customer2@example.com',
    daysAgo: 1,
    shipments: [
      { vendor: 'aurora', status: 'PENDING', items: [['AUR-LM-05', 1]] },
      { vendor: 'hearth', status: 'CONFIRMED', items: [['HHG-CK-01', 1]] },
    ],
  },
] as const;

export const seedReviews = [
  { customer: 'customer@example.com', order: 'MKT-DEMO-0001', sku: 'AUR-CH-03', rating: 5, title: 'Tiny and powerful', comment: 'Charges my laptop and phone together and barely gets warm.' },
  { customer: 'customer@example.com', order: 'MKT-DEMO-0001', sku: 'AUR-SP-02', rating: 4, title: 'Great for the size', comment: 'Lovely sound for a small speaker. Bass is modest, as expected.' },
  { customer: 'customer@example.com', order: 'MKT-DEMO-0001', sku: 'UTC-TS-01', rating: 5, title: 'So soft', comment: 'Washes well and has kept its shape after many wears.' },
  { customer: 'customer@example.com', order: 'MKT-DEMO-0002', sku: 'HHG-MG-03', rating: 4, title: 'Beautiful glaze', comment: 'Each mug is a little different, which I like. Well packed too.' },
  { customer: 'customer2@example.com', order: 'MKT-DEMO-0003', sku: 'AUR-CH-03', rating: 4, title: 'Reliable charger', comment: 'Replaced three chargers in my bag. Very happy with it.' },
] as const;
