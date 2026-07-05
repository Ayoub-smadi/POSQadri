import bcrypt from "bcryptjs";
import { db, pool } from "./index";
import {
  employeesTable,
  categoriesTable,
  suppliersTable,
  productsTable,
  customersTable,
} from "./schema";

async function seed() {
  console.log("Seeding database...");

  const existingEmployees = await db.select().from(employeesTable);
  if (existingEmployees.length === 0) {
    const adminHash = await bcrypt.hash("admin123", 10);
    const cashierHash = await bcrypt.hash("admin123", 10);
    await db.insert(employeesTable).values([
      {
        nameAr: "مدير النظام",
        email: "admin@nursery.com",
        passwordHash: adminHash,
        phone: "0790000001",
        role: "admin",
      },
      {
        nameAr: "أحمد الكاشير",
        email: "cashier@nursery.com",
        passwordHash: cashierHash,
        phone: "0790000002",
        role: "cashier",
      },
    ]);
    console.log("✓ Employees seeded (admin@nursery.com / cashier@nursery.com, password: admin123)");
  } else {
    console.log("• Employees already exist, skipping");
  }

  const existingCategories = await db.select().from(categoriesTable);
  let categories = existingCategories;
  if (existingCategories.length === 0) {
    categories = await db
      .insert(categoriesTable)
      .values([
        { nameAr: "أشجار", nameEn: "Trees", color: "#2d6a4f", icon: "🌳" },
        { nameAr: "نباتات داخلية", nameEn: "Indoor Plants", color: "#40916c", icon: "🪴" },
        { nameAr: "زهور", nameEn: "Flowers", color: "#e07a5f", icon: "🌸" },
        { nameAr: "أسمدة", nameEn: "Fertilizers", color: "#a68a64", icon: "🌱" },
        { nameAr: "أدوات زراعية", nameEn: "Tools", color: "#495057", icon: "🛠️" },
        { nameAr: "أصص وأواني", nameEn: "Pots", color: "#bc6c25", icon: "🏺" },
      ])
      .returning();
    console.log(`✓ ${categories.length} categories seeded`);
  } else {
    console.log("• Categories already exist, skipping");
  }

  const existingSuppliers = await db.select().from(suppliersTable);
  let suppliers = existingSuppliers;
  if (existingSuppliers.length === 0) {
    suppliers = await db
      .insert(suppliersTable)
      .values([
        { name: "مشتل الأمل للنباتات", phone: "0791234567", email: "amal@example.com", address: "عمان - الجبيهة" },
        { name: "شركة الخير للأسمدة", phone: "0797654321", email: "kheir@example.com", address: "عمان - المقابلين" },
        { name: "مؤسسة الريف للأدوات الزراعية", phone: "0798765432", email: "rif@example.com", address: "الزرقاء" },
      ])
      .returning();
    console.log(`✓ ${suppliers.length} suppliers seeded`);
  } else {
    console.log("• Suppliers already exist, skipping");
  }

  const existingProducts = await db.select().from(productsTable);
  if (existingProducts.length === 0) {
    const catByName = (n: string) => categories.find((c) => c.nameAr === n)?.id;
    const supByIndex = (i: number) => suppliers[i % suppliers.length]?.id;

    await db.insert(productsTable).values([
      { nameAr: "شجرة زيتون", nameEn: "Olive Tree", barcode: "1000000001", categoryId: catByName("أشجار"), supplierId: supByIndex(0), purchasePrice: "15.00", salePrice: "25.00", quantity: 40, lowStockThreshold: 5 },
      { nameAr: "شجرة نخيل صغيرة", nameEn: "Small Palm", barcode: "1000000002", categoryId: catByName("أشجار"), supplierId: supByIndex(0), purchasePrice: "20.00", salePrice: "35.00", quantity: 20, lowStockThreshold: 5 },
      { nameAr: "نبتة الصبار", nameEn: "Cactus", barcode: "1000000003", categoryId: catByName("نباتات داخلية"), supplierId: supByIndex(1), purchasePrice: "2.00", salePrice: "5.00", quantity: 100, lowStockThreshold: 15 },
      { nameAr: "نبتة الزاميا", nameEn: "ZZ Plant", barcode: "1000000004", categoryId: catByName("نباتات داخلية"), supplierId: supByIndex(1), purchasePrice: "6.00", salePrice: "12.00", quantity: 35, lowStockThreshold: 10 },
      { nameAr: "نبتة البوتس", nameEn: "Pothos", barcode: "1000000005", categoryId: catByName("نباتات داخلية"), supplierId: supByIndex(1), purchasePrice: "3.00", salePrice: "7.00", quantity: 50, lowStockThreshold: 10 },
      { nameAr: "باقة ورد جوري", nameEn: "Rose Bouquet", barcode: "1000000006", categoryId: catByName("زهور"), supplierId: supByIndex(0), purchasePrice: "4.00", salePrice: "9.00", quantity: 60, lowStockThreshold: 10 },
      { nameAr: "زهرة الأقحوان", nameEn: "Chrysanthemum", barcode: "1000000007", categoryId: catByName("زهور"), supplierId: supByIndex(0), purchasePrice: "1.50", salePrice: "4.00", quantity: 80, lowStockThreshold: 15 },
      { nameAr: "سماد عضوي 5 كغم", nameEn: "Organic Fertilizer 5kg", barcode: "1000000008", categoryId: catByName("أسمدة"), supplierId: supByIndex(1), purchasePrice: "5.00", salePrice: "9.50", quantity: 3, lowStockThreshold: 10 },
      { nameAr: "سماد NPK", nameEn: "NPK Fertilizer", barcode: "1000000009", categoryId: catByName("أسمدة"), supplierId: supByIndex(1), purchasePrice: "4.00", salePrice: "8.00", quantity: 45, lowStockThreshold: 10 },
      { nameAr: "مجرفة يدوية", nameEn: "Hand Trowel", barcode: "1000000010", categoryId: catByName("أدوات زراعية"), supplierId: supByIndex(2), purchasePrice: "2.50", salePrice: "6.00", quantity: 2, lowStockThreshold: 5 },
      { nameAr: "مقص تقليم", nameEn: "Pruning Shears", barcode: "1000000011", categoryId: catByName("أدوات زراعية"), supplierId: supByIndex(2), purchasePrice: "6.00", salePrice: "13.00", quantity: 25, lowStockThreshold: 5 },
      { nameAr: "خرطوم ري 10م", nameEn: "Garden Hose 10m", barcode: "1000000012", categoryId: catByName("أدوات زراعية"), supplierId: supByIndex(2), purchasePrice: "8.00", salePrice: "16.00", quantity: 18, lowStockThreshold: 5 },
      { nameAr: "أصيص فخاري 20سم", nameEn: "Clay Pot 20cm", barcode: "1000000013", categoryId: catByName("أصص وأواني"), supplierId: supByIndex(2), purchasePrice: "1.80", salePrice: "4.50", quantity: 70, lowStockThreshold: 15 },
      { nameAr: "أصيص بلاستيك 30سم", nameEn: "Plastic Pot 30cm", barcode: "1000000014", categoryId: catByName("أصص وأواني"), supplierId: supByIndex(2), purchasePrice: "1.20", salePrice: "3.00", quantity: 90, lowStockThreshold: 15 },
      { nameAr: "تربة زراعية 20كغم", nameEn: "Potting Soil 20kg", barcode: "1000000015", categoryId: catByName("أسمدة"), supplierId: supByIndex(1), purchasePrice: "3.50", salePrice: "7.50", quantity: 4, lowStockThreshold: 10 },
    ]);
    console.log("✓ 15 products seeded");
  } else {
    console.log("• Products already exist, skipping");
  }

  const existingCustomers = await db.select().from(customersTable);
  if (existingCustomers.length === 0) {
    await db.insert(customersTable).values([
      { name: "زبون عام", phone: null },
      { name: "خالد المصري", phone: "0791112233" },
      { name: "سارة أبو حمدان", phone: "0792223344" },
      { name: "مؤسسة الحدائق الذهبية", phone: "0798887766" },
    ]);
    console.log("✓ Customers seeded");
  } else {
    console.log("• Customers already exist, skipping");
  }

  console.log("Seeding complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
