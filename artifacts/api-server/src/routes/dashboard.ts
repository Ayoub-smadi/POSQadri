import { Router, type IRouter } from "express";
import { sql, gte, eq } from "drizzle-orm";
import {
  db,
  invoicesTable,
  invoiceItemsTable,
  productsTable,
  customersTable,
  suppliersTable,
  employeesTable,
  categoriesTable,
} from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [todayAgg] = await db
    .select({
      sales: sql<string>`COALESCE(SUM(${invoicesTable.total}), 0)`,
    })
    .from(invoicesTable)
    .where(gte(invoicesTable.createdAt, startOfToday));

  const [monthAgg] = await db
    .select({ sales: sql<string>`COALESCE(SUM(${invoicesTable.total}), 0)` })
    .from(invoicesTable)
    .where(gte(invoicesTable.createdAt, startOfMonth));

  const [todayProfitAgg] = await db
    .select({
      profit: sql<string>`COALESCE(SUM((${invoiceItemsTable.price} - COALESCE(sub.purchase_price, 0)) * ${invoiceItemsTable.quantity} - ${invoiceItemsTable.discount}), 0)`,
    })
    .from(invoiceItemsTable)
    .innerJoin(invoicesTable, eq(invoiceItemsTable.invoiceId, invoicesTable.id))
    .leftJoin(
      sql`(SELECT id, purchase_price FROM products) AS sub`,
      sql`sub.id = ${invoiceItemsTable.productId}`,
    )
    .where(gte(invoicesTable.createdAt, startOfToday));

  const [counts] = await db
    .select({
      invoiceCount: sql<number>`(SELECT COUNT(*) FROM ${invoicesTable})`,
      productCount: sql<number>`(SELECT COUNT(*) FROM ${productsTable})`,
      customerCount: sql<number>`(SELECT COUNT(*) FROM ${customersTable})`,
      supplierCount: sql<number>`(SELECT COUNT(*) FROM ${suppliersTable})`,
      employeeCount: sql<number>`(SELECT COUNT(*) FROM ${employeesTable})`,
    })
    .from(categoriesTable)
    .limit(1);

  const topProducts = await db
    .select({
      productId: productsTable.id,
      nameAr: productsTable.nameAr,
      imageUrl: productsTable.imageUrl,
      totalSold: sql<number>`COALESCE(SUM(${invoiceItemsTable.quantity}), 0)`,
      totalRevenue: sql<string>`COALESCE(SUM(${invoiceItemsTable.price} * ${invoiceItemsTable.quantity}), 0)`,
    })
    .from(invoiceItemsTable)
    .innerJoin(productsTable, eq(invoiceItemsTable.productId, productsTable.id))
    .groupBy(productsTable.id, productsTable.nameAr, productsTable.imageUrl)
    .orderBy(sql`2 DESC`)
    .limit(5);

  const lowStockProducts = await db
    .select({
      productId: productsTable.id,
      nameAr: productsTable.nameAr,
      quantity: productsTable.quantity,
      lowStockThreshold: productsTable.lowStockThreshold,
    })
    .from(productsTable)
    .where(sql`${productsTable.quantity} <= ${productsTable.lowStockThreshold}`)
    .orderBy(productsTable.quantity)
    .limit(10);

  const last7Days = await db
    .select({
      date: sql<string>`TO_CHAR(${invoicesTable.createdAt}, 'YYYY-MM-DD')`,
      sales: sql<string>`COALESCE(SUM(${invoicesTable.total}), 0)`,
      profit: sql<string>`COALESCE(SUM(${invoicesTable.total} - ${invoicesTable.subtotal}), 0)`,
    })
    .from(invoicesTable)
    .where(gte(invoicesTable.createdAt, sevenDaysAgo))
    .groupBy(sql`TO_CHAR(${invoicesTable.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`TO_CHAR(${invoicesTable.createdAt}, 'YYYY-MM-DD')`);

  const recentTransactions = await db
    .select({
      id: invoicesTable.id,
      number: invoicesTable.number,
      customerName: customersTable.name,
      total: invoicesTable.total,
      paymentMethod: invoicesTable.paymentMethod,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .orderBy(sql`${invoicesTable.createdAt} DESC`)
    .limit(10);

  const summary = {
    todaySales: Number(todayAgg?.sales ?? 0),
    todayProfit: Number(todayProfitAgg?.profit ?? 0),
    monthlySales: Number(monthAgg?.sales ?? 0),
    invoiceCount: Number(counts?.invoiceCount ?? 0),
    productCount: Number(counts?.productCount ?? 0),
    customerCount: Number(counts?.customerCount ?? 0),
    supplierCount: Number(counts?.supplierCount ?? 0),
    employeeCount: Number(counts?.employeeCount ?? 0),
    topProducts: topProducts.map((p) => ({ ...p, totalSold: Number(p.totalSold), totalRevenue: Number(p.totalRevenue) })),
    lowStockProducts,
    last7Days: last7Days.map((d) => ({ ...d, sales: Number(d.sales), profit: Number(d.profit) })),
    recentTransactions: recentTransactions.map((t) => ({
      ...t,
      total: Number(t.total),
      createdAt: t.createdAt.toISOString(),
    })),
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

export default router;
