import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  db,
  employeesTable,
  categoriesTable,
  suppliersTable,
  productsTable,
  customersTable,
  invoicesTable,
  invoiceItemsTable,
} from "@workspace/db";

const CATEGORY_DATA: Array<{ nameAr: string; nameEn: string; color: string; icon: string }> = [
  { nameAr: "أشجار الزينة", nameEn: "Ornamental Trees", color: "#2f6b3a", icon: "tree" },
  { nameAr: "أشجار الفاكهة", nameEn: "Fruit Trees", color: "#8a5a2b", icon: "apple" },
  { nameAr: "نباتات داخلية", nameEn: "Indoor Plants", color: "#3d7a4a", icon: "leaf" },
  { nameAr: "نباتات خارجية", nameEn: "Outdoor Plants", color: "#4c8c3f", icon: "sun" },
  { nameAr: "صبار وعصاريات", nameEn: "Cacti & Succulents", color: "#a6763f", icon: "cactus" },
  { nameAr: "شجيرات مزهرة", nameEn: "Flowering Shrubs", color: "#c1447e", icon: "flower" },
  { nameAr: "نخيل", nameEn: "Palms", color: "#2b7a4f", icon: "palm" },
  { nameAr: "أعشاب وتوابل", nameEn: "Herbs & Spices", color: "#6b9b37", icon: "herb" },
  { nameAr: "بذور", nameEn: "Seeds", color: "#b98b2c", icon: "seed" },
  { nameAr: "أسمدة", nameEn: "Fertilizers", color: "#7a5230", icon: "bag" },
  { nameAr: "تربة وأتربة", nameEn: "Soil & Compost", color: "#5c4630", icon: "soil" },
  { nameAr: "أدوات تقليم", nameEn: "Pruning Tools", color: "#4a4a4a", icon: "scissors" },
  { nameAr: "أصيص وأوعية", nameEn: "Pots & Planters", color: "#c1622e", icon: "pot" },
  { nameAr: "أنظمة ري", nameEn: "Irrigation", color: "#2f6f8f", icon: "drop" },
  { nameAr: "زينة حدائق", nameEn: "Garden Decor", color: "#8a4fae", icon: "star" },
  { nameAr: "عشب طبيعي", nameEn: "Turf & Grass", color: "#3f8f4f", icon: "grass" },
  { nameAr: "نباتات معلقة", nameEn: "Hanging Plants", color: "#508a3d", icon: "vine" },
  { nameAr: "ورود", nameEn: "Roses", color: "#c23b5a", icon: "rose" },
  { nameAr: "نباتات مائية", nameEn: "Aquatic Plants", color: "#2f7f8f", icon: "water" },
  { nameAr: "مبيدات ومكافحة", nameEn: "Pest Control", color: "#7a7a2f", icon: "spray" },
];

const PRODUCT_NAME_PAIRS: Array<[string, string]> = [
  ["نخلة واشنطونيا", "Washingtonia Palm"],
  ["شجرة الزيتون", "Olive Tree"],
  ["شجرة الليمون", "Lemon Tree"],
  ["شجرة البرتقال", "Orange Tree"],
  ["شجرة الرمان", "Pomegranate Tree"],
  ["نبتة المونسترا", "Monstera"],
  ["نبتة الصبار الذهبي", "Golden Barrel Cactus"],
  ["نبتة الألوفيرا", "Aloe Vera"],
  ["نبتة الزنبق", "Peace Lily"],
  ["نبتة السرخس", "Boston Fern"],
  ["ياسمين عربي", "Arabian Jasmine"],
  ["ورد جوري أحمر", "Red Rose Bush"],
  ["ورد جوري أبيض", "White Rose Bush"],
  ["خزامى", "Lavender"],
  ["ريحان", "Basil"],
  ["نعناع", "Mint"],
  ["روزماري", "Rosemary"],
  ["بقدونس", "Parsley"],
  ["نبتة اللافندر الفرنسي", "French Lavender"],
  ["شجرة الكينا", "Eucalyptus Tree"],
  ["شجيرة الفل", "Jasmine Shrub"],
  ["نبتة الفيكس", "Ficus Plant"],
  ["نبتة اليوكا", "Yucca Plant"],
  ["نبتة السجادة الفارسية", "Persian Carpet Plant"],
  ["نبتة البوتس", "Pothos"],
  ["نبتة سنسيفيريا", "Snake Plant"],
  ["نبتة الكروتون", "Croton Plant"],
  ["نبتة الفيلوديندرون", "Philodendron"],
  ["صبار أذن الأرنب", "Bunny Ear Cactus"],
  ["صبار سان بيدرو", "San Pedro Cactus"],
  ["نبتة الأدينيوم", "Adenium (Desert Rose)"],
  ["نبتة الجهنمية", "Bougainvillea"],
  ["شجرة الجاكرندا", "Jacaranda Tree"],
  ["شجرة الدلب", "Sycamore Tree"],
  ["شجرة السرو", "Cypress Tree"],
  ["شجرة الصنوبر", "Pine Tree"],
  ["نبتة الأوركيد", "Orchid"],
  ["نبتة زنبق الماء", "Water Lily"],
  ["نبتة البردي", "Papyrus Plant"],
  ["عشب الزينة الذهبي", "Golden Ornamental Grass"],
  ["عشب البلماودو", "Pampas Grass"],
  ["تربة عضوية", "Organic Potting Soil"],
  ["تربة الصبار", "Cactus Soil Mix"],
  ["سماد عضوي", "Organic Fertilizer"],
  ["سماد NPK", "NPK Fertilizer"],
  ["سماد سائل", "Liquid Fertilizer"],
  ["أصيص فخاري كبير", "Large Terracotta Pot"],
  ["أصيص فخاري متوسط", "Medium Terracotta Pot"],
  ["أصيص بلاستيك ملون", "Colored Plastic Pot"],
  ["أصيص معلق", "Hanging Planter"],
  ["مقص تقليم", "Pruning Shears"],
  ["مجرفة حديقة", "Garden Trowel"],
  ["قفازات حديقة", "Garden Gloves"],
  ["خرطوم ري", "Watering Hose"],
  ["مرشة رذاذ", "Spray Bottle"],
  ["نظام ري بالتنقيط", "Drip Irrigation Kit"],
  ["إبريق سقاية", "Watering Can"],
  ["حصى ديكوري أبيض", "White Decorative Gravel"],
  ["حصى ديكوري أسود", "Black Decorative Gravel"],
  ["تمثال حديقة", "Garden Statue"],
  ["فانوس حديقة شمسي", "Solar Garden Lantern"],
  ["عشب سنتيبيد طبيعي", "Centipede Natural Turf"],
  ["عشب برمودا طبيعي", "Bermuda Natural Turf"],
  ["نبتة اللوتس", "Lotus Plant"],
  ["نبتة الحياة السرية", "Pilea Plant"],
  ["نبتة الكالاثيا", "Calathea Plant"],
  ["نبتة الزاميا", "ZZ Plant"],
  ["نبتة الدراسينا", "Dracaena Plant"],
  ["شتلة تين شوكي", "Prickly Pear Seedling"],
  ["شتلة موز", "Banana Seedling"],
  ["شتلة عنب", "Grape Vine Seedling"],
  ["شتلة رمان قزم", "Dwarf Pomegranate Seedling"],
  ["شتلة تفاح", "Apple Tree Seedling"],
  ["شتلة مشمش", "Apricot Tree Seedling"],
  ["شتلة خوخ", "Peach Tree Seedling"],
  ["شتلة تمر هندي", "Tamarind Seedling"],
  ["شتلة جوافة", "Guava Seedling"],
  ["بذور طماطم", "Tomato Seeds"],
  ["بذور خيار", "Cucumber Seeds"],
  ["بذور فلفل", "Pepper Seeds"],
  ["بذور خس", "Lettuce Seeds"],
  ["بذور جزر", "Carrot Seeds"],
  ["بذور زهور شمسية", "Sunflower Seeds"],
  ["بذور بابونج", "Chamomile Seeds"],
  ["مبيد حشري عضوي", "Organic Insecticide"],
  ["مبيد فطري", "Fungicide Spray"],
  ["مصيدة حشرات", "Insect Trap"],
  ["زيت النيم", "Neem Oil"],
  ["نبتة القراص الأخضر", "Green Nettle Plant"],
  ["نبتة الفربيون", "Euphorbia Plant"],
  ["نبتة البيغونيا", "Begonia Plant"],
  ["نبتة الجيرانيوم", "Geranium Plant"],
  ["نبتة البنفسج الأفريقي", "African Violet"],
  ["نبتة الأنثوريوم", "Anthurium Plant"],
  ["نبتة الكلانشو", "Kalanchoe Plant"],
  ["نبتة الأسبرجس", "Asparagus Fern"],
  ["نبتة السيكاس", "Cycad Plant"],
  ["شجرة البلوط الزينة", "Ornamental Oak Tree"],
  ["شجرة الدفلة", "Oleander Tree"],
  ["شجيرة الورد الجبلي", "Mountain Rose Shrub"],
  ["نبتة الأقحوان", "Chrysanthemum Plant"],
];

const CUSTOMER_FIRST_NAMES = [
  "محمد", "أحمد", "علي", "خالد", "سلطان", "عبدالله", "فيصل", "ياسر", "طارق", "سامي",
  "فاطمة", "مريم", "نورة", "سارة", "هند", "ريم", "لينا", "عبير", "منى", "رنا",
];
const CUSTOMER_LAST_NAMES = [
  "العتيبي", "الشمري", "القحطاني", "الدوسري", "المطيري", "الحربي", "الزهراني", "العنزي", "السبيعي", "البلوي",
];

const SUPPLIER_NAMES = [
  "مشاتل الواحة الخضراء", "مؤسسة الربيع للنباتات", "شركة الأزهار الذهبية", "مشتل النخيل الملكي",
  "مؤسسة الورد الجوري", "شركة التربة الخصبة", "مشاتل الجنائن المعلقة", "مؤسسة الزيتون الأخضر",
  "شركة الصبار العربي", "مشتل الفل والياسمين", "مؤسسة الأعشاب الطبية", "شركة النخيل للمقاولات الزراعية",
  "مشتل الحدائق الفارهة", "مؤسسة الأسمدة الحديثة", "شركة الري الذكي", "مشتل الأشجار المعمرة",
  "مؤسسة البذور الأصيلة", "شركة الديكور الطبيعي", "مشتل الفاكهة الموسمية", "مؤسسة الزهور البرية",
];

const EMPLOYEE_NAMES = [
  "عبدالرحمن الشهري", "نايف الحارثي", "بندر العسيري", "تركي المالكي", "سعود الجهني",
  "ليلى الغامدي", "أمل الزهراني", "دانة الأحمدي", "شهد القرني", "جواهر السلمي",
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)] as T;
}

async function seed() {
  console.log("Seeding nursery POS database...");

  const passwordHashAdmin = await bcrypt.hash("123456", 10);
  const passwordHashDefault = await bcrypt.hash("123456", 10);

  const employees = await db
    .insert(employeesTable)
    .values([
      {
        nameAr: "مدير النظام",
        email: "admin@pos.com",
        passwordHash: passwordHashAdmin,
        phone: "0501234567",
        role: "admin",
      },
      {
        nameAr: "كاشير المشتل",
        email: "cashier@pos.com",
        passwordHash: passwordHashDefault,
        phone: "0509876543",
        role: "cashier",
      },
      ...EMPLOYEE_NAMES.map((name, i) => ({
        nameAr: name,
        email: `employee${i + 1}@pos.com`,
        passwordHash: passwordHashDefault,
        phone: `05${randomInt(10000000, 99999999)}`,
        role: (i % 4 === 0 ? "admin" : "cashier") as "admin" | "cashier",
      })),
    ])
    .returning();
  console.log(`Inserted ${employees.length} employees`);

  const categories = await db.insert(categoriesTable).values(CATEGORY_DATA).returning();
  console.log(`Inserted ${categories.length} categories`);

  const suppliers = await db
    .insert(suppliersTable)
    .values(
      SUPPLIER_NAMES.map((name, i) => ({
        name,
        phone: `05${randomInt(10000000, 99999999)}`,
        email: `supplier${i + 1}@nursery-supply.com`,
        address: `الرياض، حي ${pick(["النرجس", "الملقا", "الياسمين", "الروضة", "العليا"])}, شارع ${randomInt(1, 40)}`,
      })),
    )
    .returning();
  console.log(`Inserted ${suppliers.length} suppliers`);

  const productValues = Array.from({ length: 100 }, (_, i) => {
    const [nameAr, nameEn] = PRODUCT_NAME_PAIRS[i % PRODUCT_NAME_PAIRS.length] as [string, string];
    const purchasePrice = randomInt(5, 300);
    const salePrice = Math.round(purchasePrice * (1.3 + Math.random() * 0.7));
    const category = pick(categories);
    const supplier = pick(suppliers);
    return {
      nameAr: i < PRODUCT_NAME_PAIRS.length ? nameAr : `${nameAr} ${Math.floor(i / PRODUCT_NAME_PAIRS.length) + 1}`,
      nameEn: i < PRODUCT_NAME_PAIRS.length ? nameEn : `${nameEn} ${Math.floor(i / PRODUCT_NAME_PAIRS.length) + 1}`,
      barcode: `NUR${100000 + i}`,
      categoryId: category.id,
      supplierId: supplier.id,
      purchasePrice: String(purchasePrice),
      salePrice: String(salePrice),
      quantity: randomInt(0, 120),
      lowStockThreshold: randomInt(5, 15),
      description: `منتج مشتل عالي الجودة مستورد من ${supplier.name}`,
      imageUrl: null,
      status: "active" as const,
    };
  });

  const products = await db.insert(productsTable).values(productValues).returning();
  console.log(`Inserted ${products.length} products`);

  const customerValues = Array.from({ length: 50 }, () => ({
    name: `${pick(CUSTOMER_FIRST_NAMES)} ${pick(CUSTOMER_LAST_NAMES)}`,
    phone: `05${randomInt(10000000, 99999999)}`,
    avatarUrl: null,
    balance: "0",
    purchaseCount: 0,
    totalSpent: "0",
  }));

  const customers = await db.insert(customersTable).values(customerValues).returning();
  console.log(`Inserted ${customers.length} customers`);

  const paymentMethods: Array<"cash" | "visa" | "cliq" | "bank" | "split"> = [
    "cash",
    "visa",
    "cliq",
    "bank",
    "split",
  ];

  let invoiceCount = 0;
  for (let i = 0; i < 300; i++) {
    const daysAgo = randomInt(0, 89);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(randomInt(8, 21), randomInt(0, 59), randomInt(0, 59));

    const itemCount = randomInt(1, 5);
    const chosenProducts = Array.from({ length: itemCount }, () => pick(products));
    const items = chosenProducts.map((product) => {
      const quantity = randomInt(1, 4);
      const price = Number(product.salePrice);
      const discount = Math.random() < 0.15 ? Math.round(price * quantity * 0.05) : 0;
      return { productId: product.id, quantity, price, discount };
    });

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity - item.discount, 0);
    const invoiceDiscount = Math.random() < 0.1 ? Math.round(subtotal * 0.03) : 0;
    const tax = Math.round(subtotal * 0.15);
    const total = subtotal - invoiceDiscount + tax;
    const employee = pick(employees);
    const customer = Math.random() < 0.7 ? pick(customers) : null;

    const [invoice] = await db
      .insert(invoicesTable)
      .values({
        number: `INV-${String(i + 1).padStart(5, "0")}`,
        customerId: customer?.id ?? null,
        employeeId: employee.id,
        subtotal: subtotal.toFixed(2),
        discount: invoiceDiscount.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        paymentMethod: pick(paymentMethods),
        status: "completed",
        createdAt,
      })
      .returning();

    if (!invoice) continue;

    await db.insert(invoiceItemsTable).values(
      items.map((item) => ({
        invoiceId: invoice.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price.toFixed(2),
        discount: item.discount.toFixed(2),
        notes: null,
      })),
    );

    if (customer) {
      await db
        .update(customersTable)
        .set({
          purchaseCount: customer.purchaseCount + 1,
          totalSpent: (Number(customer.totalSpent) + total).toFixed(2),
        })
        .where(eq(customersTable.id, customer.id));
    }

    invoiceCount++;
  }
  console.log(`Inserted ${invoiceCount} invoices`);

  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
