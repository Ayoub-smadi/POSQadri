import { Router, type IRouter } from "express";
import { sql, gte, lte, and, eq } from "drizzle-orm";
import {
  db,
  invoicesTable,
  invoiceItemsTable,
  productsTable,
  customersTable,
  suppliersTable,
  employeesTable,
  categoriesTable,
  financialTransactionsTable,
  expenseCategoriesTable,
} from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  // Support ?date=YYYY-MM-DD to view any day; defaults to today
  const dateParam = String(req.query.date ?? "");
  const targetDate = dateParam.match(/^\d{4}-\d{2}-\d{2}$/)
    ? new Date(dateParam + "T00:00:00")
    : new Date();

  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const endOfDay   = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  // ── Day aggregates ──────────────────────────────────────────────────────────
  const [dayAgg] = await db
    .select({ sales: sql<string>`COALESCE(SUM(${invoicesTable.total}), 0)` })
    .from(invoicesTable)
    .where(and(gte(invoicesTable.createdAt, startOfDay), lte(invoicesTable.createdAt, endOfDay)));

  const [dayProfitAgg] = await db
    .select({
      profit: sql<string>`COALESCE(SUM((${invoiceItemsTable.price} - COALESCE(sub.purchase_price, 0)) * ${invoiceItemsTable.quantity} - ${invoiceItemsTable.discount}), 0)`,
    })
    .from(invoiceItemsTable)
    .innerJoin(invoicesTable, eq(invoiceItemsTable.invoiceId, invoicesTable.id))
    .leftJoin(
      sql`(SELECT id, purchase_price FROM products) AS sub`,
      sql`sub.id = ${invoiceItemsTable.productId}`,
    )
    .where(and(gte(invoicesTable.createdAt, startOfDay), lte(invoicesTable.createdAt, endOfDay)));

  // Day invoice count
  const [dayInvCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(invoicesTable)
    .where(and(gte(invoicesTable.createdAt, startOfDay), lte(invoicesTable.createdAt, endOfDay)));

  // ── Monthly ─────────────────────────────────────────────────────────────────
  const [monthAgg] = await db
    .select({ sales: sql<string>`COALESCE(SUM(${invoicesTable.total}), 0)` })
    .from(invoicesTable)
    .where(gte(invoicesTable.createdAt, startOfMonth));

  // ── Totals ──────────────────────────────────────────────────────────────────
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

  // ── Top products for the selected day ───────────────────────────────────────
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
    .innerJoin(invoicesTable, eq(invoiceItemsTable.invoiceId, invoicesTable.id))
    .where(and(gte(invoicesTable.createdAt, startOfDay), lte(invoicesTable.createdAt, endOfDay)))
    .groupBy(productsTable.id, productsTable.nameAr, productsTable.imageUrl)
    .orderBy(sql`SUM(${invoiceItemsTable.quantity}) DESC`)
    .limit(5);

  // ── Low stock ────────────────────────────────────────────────────────────────
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

  // ── Last 7 days chart ────────────────────────────────────────────────────────
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

  // ── Day invoices list ────────────────────────────────────────────────────────
  const dayInvoices = await db
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
    .where(and(
      gte(invoicesTable.createdAt, startOfDay),
      lte(invoicesTable.createdAt, endOfDay),
      eq(invoicesTable.status, "completed"),
    ))
    .orderBy(sql`${invoicesTable.createdAt} DESC`);

  // ── Day financial transactions ────────────────────────────────────────────────
  const dayTransactions = await db
    .select({
      id: financialTransactionsTable.id,
      type: financialTransactionsTable.type,
      amount: financialTransactionsTable.amount,
      description: financialTransactionsTable.description,
      partyName: financialTransactionsTable.partyName,
      isInCashBox: financialTransactionsTable.isInCashBox,
      categoryName: expenseCategoriesTable.nameAr,
      categoryIcon: expenseCategoriesTable.icon,
      createdAt: financialTransactionsTable.createdAt,
    })
    .from(financialTransactionsTable)
    .leftJoin(expenseCategoriesTable, eq(financialTransactionsTable.categoryId, expenseCategoriesTable.id))
    .where(and(
      gte(financialTransactionsTable.createdAt, startOfDay),
      lte(financialTransactionsTable.createdAt, endOfDay),
    ))
    .orderBy(sql`${financialTransactionsTable.createdAt} DESC`);

  const summary = {
    todaySales: Number(dayAgg?.sales ?? 0),
    todayProfit: Number(dayProfitAgg?.profit ?? 0),
    monthlySales: Number(monthAgg?.sales ?? 0),
    invoiceCount: Number(counts?.invoiceCount ?? 0),
    dayInvoiceCount: Number(dayInvCount?.count ?? 0),
    productCount: Number(counts?.productCount ?? 0),
    customerCount: Number(counts?.customerCount ?? 0),
    supplierCount: Number(counts?.supplierCount ?? 0),
    employeeCount: Number(counts?.employeeCount ?? 0),
    topProducts: topProducts.map((p) => ({ ...p, totalSold: Number(p.totalSold), totalRevenue: Number(p.totalRevenue) })),
    lowStockProducts,
    last7Days: last7Days.map((d) => ({ ...d, sales: Number(d.sales), profit: Number(d.profit) })),
    recentTransactions: dayInvoices.map((t) => ({
      ...t,
      total: Number(t.total),
      createdAt: t.createdAt.toISOString(),
    })),
    dayTransactions: dayTransactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
      createdAt: t.createdAt.toISOString(),
    })),
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

export default router;
