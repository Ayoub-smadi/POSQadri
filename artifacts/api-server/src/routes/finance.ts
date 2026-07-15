import { Router, type IRouter } from "express";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import {
  db,
  expenseCategoriesTable,
  financialTransactionsTable,
  purchaseOrdersTable,
  invoicesTable,
  customersTable,
  employeesTable,
  suppliersTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { z } from "zod";

const router: IRouter = Router();

// ─── Default Categories ──────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { nameAr: "رواتب", icon: "👔", color: "#7c3aed", categoryType: "expense" as const, isDefault: true },
  { nameAr: "فطور وضيافة", icon: "☕", color: "#d97706", categoryType: "expense" as const, isDefault: true },
  { nameAr: "دفعة موردين", icon: "🏭", color: "#0891b2", categoryType: "expense" as const, isDefault: true },
  { nameAr: "مصاريف تشغيلية", icon: "⚙️", color: "#6b7280", categoryType: "expense" as const, isDefault: true },
  { nameAr: "إيجار", icon: "🏠", color: "#dc2626", categoryType: "expense" as const, isDefault: true },
  { nameAr: "مواصلات", icon: "🚗", color: "#ea580c", categoryType: "expense" as const, isDefault: true },
  { nameAr: "صيانة", icon: "🔧", color: "#65a30d", categoryType: "expense" as const, isDefault: true },
  { nameAr: "كهرباء وماء", icon: "💡", color: "#0284c7", categoryType: "expense" as const, isDefault: true },
  { nameAr: "قبض من عميل", icon: "💳", color: "#16a34a", categoryType: "income" as const, isDefault: true },
  { nameAr: "إيراد متنوع", icon: "💰", color: "#15803d", categoryType: "income" as const, isDefault: true },
  { nameAr: "قرض أو سلفة", icon: "🏦", color: "#7c2d12", categoryType: "both" as const, isDefault: true },
  { nameAr: "مبيعات", icon: "🛒", color: "#059669", categoryType: "income" as const, isDefault: true },
];

async function ensureDefaultCategories() {
  const existing = await db.select({ nameAr: expenseCategoriesTable.nameAr }).from(expenseCategoriesTable);
  const existingNames = new Set(existing.map(c => c.nameAr));
  const missing = DEFAULT_CATEGORIES.filter(c => !existingNames.has(c.nameAr));
  if (missing.length > 0) {
    await db.insert(expenseCategoriesTable).values(missing);
  }
}

// ─── Categories ──────────────────────────────────────────────────────────────

router.get("/finance/categories", requireAuth, async (_req, res): Promise<void> => {
  await ensureDefaultCategories();
  const rows = await db.select().from(expenseCategoriesTable).orderBy(expenseCategoriesTable.id);
  res.json(rows);
});

const CategoryBody = z.object({
  nameAr: z.string().min(1),
  icon: z.string().default("💰"),
  color: z.string().default("#6b7280"),
  categoryType: z.enum(["expense", "income", "both"]).default("expense"),
});

router.post("/finance/categories", requireAuth, async (req, res): Promise<void> => {
  const parsed = CategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [row] = await db.insert(expenseCategoriesTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.delete("/finance/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [cat] = await db.select().from(expenseCategoriesTable).where(eq(expenseCategoriesTable.id, id));
  if (!cat) { res.status(404).json({ error: "Not found" }); return; }
  if (cat.isDefault) { res.status(400).json({ error: "Cannot delete default category" }); return; }

  await db.delete(expenseCategoriesTable).where(eq(expenseCategoriesTable.id, id));
  res.sendStatus(204);
});

// ─── Financial Transactions ──────────────────────────────────────────────────

const TxBody = z.object({
  type: z.enum(["receipt", "payment"]),
  amount: z.coerce.number().positive(),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  description: z.string().optional().nullable(),
  partyName: z.string().optional().nullable(),
  isInCashBox: z.boolean().default(true),
  purchaseOrderId: z.coerce.number().int().positive().optional().nullable(),
  createdAt: z.string().optional().nullable(),
});

router.get("/finance/transactions", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: financialTransactionsTable.id,
      number: financialTransactionsTable.number,
      type: financialTransactionsTable.type,
      amount: financialTransactionsTable.amount,
      categoryId: financialTransactionsTable.categoryId,
      categoryName: expenseCategoriesTable.nameAr,
      categoryIcon: expenseCategoriesTable.icon,
      categoryColor: expenseCategoriesTable.color,
      description: financialTransactionsTable.description,
      partyName: financialTransactionsTable.partyName,
      isInCashBox: financialTransactionsTable.isInCashBox,
      purchaseOrderId: financialTransactionsTable.purchaseOrderId,
      employeeId: financialTransactionsTable.employeeId,
      createdAt: financialTransactionsTable.createdAt,
    })
    .from(financialTransactionsTable)
    .leftJoin(expenseCategoriesTable, eq(financialTransactionsTable.categoryId, expenseCategoriesTable.id))
    .orderBy(desc(financialTransactionsTable.createdAt));

  res.json(rows.map(r => ({ ...r, amount: Number(r.amount), createdAt: r.createdAt.toISOString() })));
});

router.post("/finance/transactions", requireAuth, async (req, res): Promise<void> => {
  const parsed = TxBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const prefix = parsed.data.type === "receipt" ? "RCV" : "PAY";
  const number = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const insertData: typeof financialTransactionsTable.$inferInsert = {
    number,
    type: parsed.data.type,
    amount: String(parsed.data.amount),
    categoryId: parsed.data.categoryId ?? null,
    description: parsed.data.description ?? null,
    partyName: parsed.data.partyName ?? null,
    isInCashBox: parsed.data.isInCashBox,
    purchaseOrderId: parsed.data.purchaseOrderId ?? null,
    employeeId: req.session.employeeId ?? null,
  };

  if (parsed.data.createdAt) {
    insertData.createdAt = new Date(parsed.data.createdAt);
  }

  const [row] = await db.insert(financialTransactionsTable).values(insertData).returning();
  res.status(201).json({ ...row, amount: Number(row!.amount), createdAt: row!.createdAt.toISOString() });
});

router.delete("/finance/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [tx] = await db.delete(financialTransactionsTable).where(eq(financialTransactionsTable.id, id)).returning();
  if (!tx) { res.status(404).json({ error: "Not found" }); return; }

  // If linked to a purchase order, reduce paidAmount
  if (tx.purchaseOrderId && tx.type === "payment") {
    const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, tx.purchaseOrderId));
    if (po) {
      const newPaid = Math.max(0, Number(po.paidAmount) - Number(tx.amount));
      const newStatus = newPaid === 0 ? "pending" : newPaid >= Number(po.totalAmount) ? "paid" : "partial";
      await db.update(purchaseOrdersTable).set({ paidAmount: String(newPaid), status: newStatus }).where(eq(purchaseOrdersTable.id, po.id));
    }
  }

  res.sendStatus(204);
});

// ─── Purchase Orders ─────────────────────────────────────────────────────────

const PurchaseBody = z.object({
  supplierId: z.coerce.number().int().positive().optional().nullable(),
  supplierName: z.string().optional().nullable(),
  totalAmount: z.coerce.number().positive(),
  description: z.string().optional().nullable(),
  purchaseType: z.enum(["cash", "credit"]).default("cash"),
  createdAt: z.string().optional().nullable(),
});

const PayPurchaseBody = z.object({
  amount: z.coerce.number().positive(),
  description: z.string().optional().nullable(),
  isInCashBox: z.boolean().default(true),
});

router.get("/finance/purchases", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: purchaseOrdersTable.id,
      number: purchaseOrdersTable.number,
      supplierId: purchaseOrdersTable.supplierId,
      supplierName: purchaseOrdersTable.supplierName,
      dbSupplierName: suppliersTable.name,
      totalAmount: purchaseOrdersTable.totalAmount,
      paidAmount: purchaseOrdersTable.paidAmount,
      description: purchaseOrdersTable.description,
      purchaseType: purchaseOrdersTable.purchaseType,
      status: purchaseOrdersTable.status,
      employeeId: purchaseOrdersTable.employeeId,
      createdAt: purchaseOrdersTable.createdAt,
    })
    .from(purchaseOrdersTable)
    .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
    .orderBy(desc(purchaseOrdersTable.createdAt));

  res.json(rows.map(r => ({
    ...r,
    displayName: r.dbSupplierName ?? r.supplierName ?? "غير محدد",
    totalAmount: Number(r.totalAmount),
    paidAmount: Number(r.paidAmount),
    remaining: Number(r.totalAmount) - Number(r.paidAmount),
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/finance/purchases", requireAuth, async (req, res): Promise<void> => {
  const parsed = PurchaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const poNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Get supplier name if supplierId provided
  let resolvedName = parsed.data.supplierName ?? null;
  if (parsed.data.supplierId) {
    const [s] = await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, parsed.data.supplierId));
    if (s) resolvedName = s.name;
  }

  const isCredit = parsed.data.purchaseType === "credit";
  const initialPaid = isCredit ? "0" : String(parsed.data.totalAmount);
  const initialStatus = isCredit ? "pending" : "paid";

  // Find "دفعة موردين" category upfront
  const [cat] = await db.select().from(expenseCategoriesTable).where(eq(expenseCategoriesTable.nameAr, "دفعة موردين"));

  const createdAt = parsed.data.createdAt ? new Date(parsed.data.createdAt) : undefined;

  // Wrap in DB transaction for atomicity
  const po = await db.transaction(async (tx) => {
    const poValues: typeof purchaseOrdersTable.$inferInsert = {
      number: poNumber,
      supplierId: parsed.data.supplierId ?? null,
      supplierName: resolvedName,
      totalAmount: String(parsed.data.totalAmount),
      paidAmount: initialPaid,
      description: parsed.data.description ?? null,
      purchaseType: parsed.data.purchaseType,
      status: initialStatus,
      employeeId: req.session.employeeId ?? null,
    };
    if (createdAt) poValues.createdAt = createdAt;

    const [newPo] = await tx.insert(purchaseOrdersTable).values(poValues).returning();

    if (!newPo) throw new Error("Failed to create purchase");

    // For cash purchase: auto-create payment transaction atomically
    if (!isCredit) {
      const txNumber = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const txValues: typeof financialTransactionsTable.$inferInsert = {
        number: txNumber,
        type: "payment",
        amount: String(parsed.data.totalAmount),
        categoryId: cat?.id ?? null,
        description: parsed.data.description ?? `شراء نقدي - ${resolvedName ?? ""}`,
        partyName: resolvedName,
        isInCashBox: true,
        purchaseOrderId: newPo.id,
        employeeId: req.session.employeeId ?? null,
      };
      if (createdAt) txValues.createdAt = createdAt;
      await tx.insert(financialTransactionsTable).values(txValues);
    }

    return newPo;
  });

  res.status(201).json({
    ...po,
    displayName: resolvedName ?? "غير محدد",
    totalAmount: Number(po.totalAmount),
    paidAmount: Number(po.paidAmount),
    remaining: Number(po.totalAmount) - Number(po.paidAmount),
    createdAt: po.createdAt.toISOString(),
  });
});

router.post("/finance/purchases/:id/pay", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = PayPurchaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!po) { res.status(404).json({ error: "Purchase not found" }); return; }

  const remaining = Number(po.totalAmount) - Number(po.paidAmount);
  const payAmt = Math.min(parsed.data.amount, remaining);
  if (payAmt <= 0) { res.status(400).json({ error: "Already fully paid" }); return; }

  const newPaid = Number(po.paidAmount) + payAmt;
  const newStatus = newPaid >= Number(po.totalAmount) ? "paid" : "partial";

  const [cat] = await db.select().from(expenseCategoriesTable).where(eq(expenseCategoriesTable.nameAr, "دفعة موردين"));
  const txNumber = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Atomic: update purchase + create transaction together
  await db.transaction(async (tx) => {
    await tx.update(purchaseOrdersTable)
      .set({ paidAmount: String(newPaid), status: newStatus })
      .where(eq(purchaseOrdersTable.id, id));

    await tx.insert(financialTransactionsTable).values({
      number: txNumber,
      type: "payment",
      amount: String(payAmt),
      categoryId: cat?.id ?? null,
      description: parsed.data.description ?? `دفعة آجلة - ${po.supplierName ?? ""}`,
      partyName: po.supplierName,
      isInCashBox: parsed.data.isInCashBox,
      purchaseOrderId: po.id,
      employeeId: req.session.employeeId ?? null,
    });
  });

  res.json({ success: true, newPaid, newStatus });
});

router.delete("/finance/purchases/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(financialTransactionsTable).where(eq(financialTransactionsTable.purchaseOrderId, id));
  const [po] = await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id)).returning();
  if (!po) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

// ─── Cash Box Balance ────────────────────────────────────────────────────────

router.get("/finance/cash-box", requireAuth, async (_req, res): Promise<void> => {
  // Cash IN: cash/visa/cliq/bank/split invoices + receipt transactions in cash box
  const invoiceCash = await db
    .select({ total: sql<string>`coalesce(sum(total), 0)` })
    .from(invoicesTable)
    .where(sql`payment_method != 'credit' AND status = 'completed'`);

  const receipts = await db
    .select({ total: sql<string>`coalesce(sum(amount), 0)` })
    .from(financialTransactionsTable)
    .where(and(
      eq(financialTransactionsTable.type, "receipt"),
      eq(financialTransactionsTable.isInCashBox, true),
    ));

  const payments = await db
    .select({ total: sql<string>`coalesce(sum(amount), 0)` })
    .from(financialTransactionsTable)
    .where(and(
      eq(financialTransactionsTable.type, "payment"),
      eq(financialTransactionsTable.isInCashBox, true),
    ));

  const cashIn = Number(invoiceCash[0]?.total ?? 0) + Number(receipts[0]?.total ?? 0);
  const cashOut = Number(payments[0]?.total ?? 0);

  res.json({
    balance: cashIn - cashOut,
    totalIn: cashIn,
    totalOut: cashOut,
    invoiceCash: Number(invoiceCash[0]?.total ?? 0),
    receipts: Number(receipts[0]?.total ?? 0),
    payments: cashOut,
  });
});

// ─── Combined Statement ───────────────────────────────────────────────────────

router.get("/finance/statement", requireAuth, async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "200"));
  const offset = parseInt(String(req.query.offset ?? "0"));

  // Sales invoices
  const invoices = await db
    .select({
      id: invoicesTable.id,
      number: invoicesTable.number,
      amount: invoicesTable.total,
      paymentMethod: invoicesTable.paymentMethod,
      customerName: customersTable.name,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(eq(invoicesTable.status, "completed"))
    .orderBy(desc(invoicesTable.createdAt));

  // Financial transactions
  const txRows = await db
    .select({
      id: financialTransactionsTable.id,
      number: financialTransactionsTable.number,
      type: financialTransactionsTable.type,
      amount: financialTransactionsTable.amount,
      categoryName: expenseCategoriesTable.nameAr,
      categoryIcon: expenseCategoriesTable.icon,
      categoryColor: expenseCategoriesTable.color,
      description: financialTransactionsTable.description,
      partyName: financialTransactionsTable.partyName,
      isInCashBox: financialTransactionsTable.isInCashBox,
      purchaseOrderId: financialTransactionsTable.purchaseOrderId,
      createdAt: financialTransactionsTable.createdAt,
    })
    .from(financialTransactionsTable)
    .leftJoin(expenseCategoriesTable, eq(financialTransactionsTable.categoryId, expenseCategoriesTable.id))
    .orderBy(desc(financialTransactionsTable.createdAt));

  // Purchase orders (credit purchases - the order itself, not payments)
  const creditPurchases = await db
    .select({
      id: purchaseOrdersTable.id,
      number: purchaseOrdersTable.number,
      totalAmount: purchaseOrdersTable.totalAmount,
      paidAmount: purchaseOrdersTable.paidAmount,
      supplierName: purchaseOrdersTable.supplierName,
      purchaseType: purchaseOrdersTable.purchaseType,
      status: purchaseOrdersTable.status,
      description: purchaseOrdersTable.description,
      createdAt: purchaseOrdersTable.createdAt,
    })
    .from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.purchaseType, "credit"))
    .orderBy(desc(purchaseOrdersTable.createdAt));

  // Merge and sort
  const entries: any[] = [];

  for (const inv of invoices) {
    const isCredit = inv.paymentMethod === "credit";
    entries.push({
      source: "invoice",
      id: `inv-${inv.id}`,
      number: inv.number,
      direction: "in",
      amount: Number(inv.amount),
      label: isCredit ? "بيع آجل" : "بيع نقدي",
      icon: isCredit ? "🔄" : "🛍️",
      color: isCredit ? "#7c3aed" : "#16a34a",
      description: inv.customerName ? `عميل: ${inv.customerName}` : "عميل عام",
      isInCashBox: !isCredit,
      type: isCredit ? "credit_sale" : "cash_sale",
      createdAt: inv.createdAt.toISOString(),
    });
  }

  for (const tx of txRows) {
    entries.push({
      source: "transaction",
      id: `tx-${tx.id}`,
      dbId: tx.id,
      number: tx.number,
      direction: tx.type === "receipt" ? "in" : "out",
      amount: Number(tx.amount),
      label: tx.type === "receipt" ? "قبض" : "صرف",
      icon: tx.categoryIcon ?? (tx.type === "receipt" ? "💚" : "💸"),
      color: tx.categoryColor ?? (tx.type === "receipt" ? "#16a34a" : "#dc2626"),
      description: tx.description ?? tx.partyName ?? "",
      categoryName: tx.categoryName,
      isInCashBox: tx.isInCashBox,
      type: tx.type,
      partyName: tx.partyName,
      purchaseOrderId: tx.purchaseOrderId,
      createdAt: tx.createdAt.toISOString(),
    });
  }

  for (const po of creditPurchases) {
    entries.push({
      source: "purchase",
      id: `po-${po.id}`,
      dbId: po.id,
      number: po.number,
      direction: "out",
      amount: Number(po.totalAmount),
      paidAmount: Number(po.paidAmount),
      remaining: Number(po.totalAmount) - Number(po.paidAmount),
      label: "شراء آجل",
      icon: "🏭",
      color: "#dc2626",
      description: po.description ?? po.supplierName ?? "",
      isInCashBox: false,
      type: "credit_purchase",
      status: po.status,
      createdAt: po.createdAt.toISOString(),
    });
  }

  // Sort by date desc
  entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = entries.length;
  const page = entries.slice(offset, offset + limit);

  res.json({ total, entries: page });
});

// ─── Treasury Movements (with running balance) ───────────────────────────────

router.get("/finance/treasury", requireAuth, async (req, res): Promise<void> => {
  const fromStr = String(req.query.from ?? "");
  const toStr   = String(req.query.to   ?? "");
  const search  = String(req.query.search ?? "");

  const now = new Date();
  const from = fromStr
    ? new Date(fromStr + "T00:00:00")
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const to = toStr
    ? new Date(toStr + "T23:59:59")
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // ── Opening balance (everything BEFORE 'from') ──
  const [oi] = await db
    .select({ t: sql<string>`coalesce(sum(total),0)` })
    .from(invoicesTable)
    .where(sql`payment_method != 'credit' AND status = 'completed' AND created_at < ${from}`);
  const [or_] = await db
    .select({ t: sql<string>`coalesce(sum(amount),0)` })
    .from(financialTransactionsTable)
    .where(and(eq(financialTransactionsTable.type, "receipt"), eq(financialTransactionsTable.isInCashBox, true), sql`created_at < ${from}`));
  const [op] = await db
    .select({ t: sql<string>`coalesce(sum(amount),0)` })
    .from(financialTransactionsTable)
    .where(and(eq(financialTransactionsTable.type, "payment"), eq(financialTransactionsTable.isInCashBox, true), sql`created_at < ${from}`));

  const openingBalance = Number(oi?.t ?? 0) + Number(or_?.t ?? 0) - Number(op?.t ?? 0);

  // ── Period invoices ──
  const periodInvoices = await db
    .select({
      id: invoicesTable.id,
      number: invoicesTable.number,
      amount: invoicesTable.total,
      paymentMethod: invoicesTable.paymentMethod,
      customerName: customersTable.name,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(sql`invoices.payment_method != 'credit' AND invoices.status = 'completed' AND invoices.created_at >= ${from} AND invoices.created_at <= ${to}`);

  // ── Period transactions (in cash box) ──
  const periodTx = await db
    .select({
      id: financialTransactionsTable.id,
      number: financialTransactionsTable.number,
      type: financialTransactionsTable.type,
      amount: financialTransactionsTable.amount,
      categoryName: expenseCategoriesTable.nameAr,
      description: financialTransactionsTable.description,
      partyName: financialTransactionsTable.partyName,
      purchaseOrderId: financialTransactionsTable.purchaseOrderId,
      createdAt: financialTransactionsTable.createdAt,
    })
    .from(financialTransactionsTable)
    .leftJoin(expenseCategoriesTable, eq(financialTransactionsTable.categoryId, expenseCategoriesTable.id))
    .where(and(
      eq(financialTransactionsTable.isInCashBox, true),
      gte(financialTransactionsTable.createdAt, from),
      lte(financialTransactionsTable.createdAt, to),
    ));

  // ── Merge ──
  const rows: any[] = [];
  for (const inv of periodInvoices) {
    rows.push({
      id: `inv-${inv.id}`, dbId: inv.id,
      number: inv.number,
      in: Number(inv.amount), out: 0,
      category: inv.paymentMethod === "cash" ? "مبيعات نقدية" : inv.paymentMethod,
      reference: inv.number,
      account: inv.customerName ?? "زبون عام",
      description: "",
      type: "invoice",
      createdAt: inv.createdAt,
    });
  }
  for (const tx of periodTx) {
    rows.push({
      id: `tx-${tx.id}`, dbId: tx.id,
      number: tx.number,
      in: tx.type === "receipt" ? Number(tx.amount) : 0,
      out: tx.type === "payment" ? Number(tx.amount) : 0,
      category: tx.categoryName ?? (tx.type === "receipt" ? "قبض" : "صرف"),
      reference: tx.number,
      account: tx.partyName ?? "",
      description: tx.description ?? "",
      type: tx.type,
      createdAt: tx.createdAt,
    });
  }

  // ── Apply search ──
  const filtered = search
    ? rows.filter(r =>
        r.account?.includes(search) ||
        r.category?.includes(search) ||
        r.reference?.includes(search) ||
        r.description?.includes(search))
    : rows;

  // ── Sort ASC for running balance ──
  filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let runningBalance = openingBalance;
  let netPeriod = 0;
  const withBalance = filtered.map((row, i) => {
    runningBalance += row.in - row.out;
    netPeriod      += row.in - row.out;
    return {
      ...row, balance: runningBalance, rowNum: i + 1,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    };
  });

  const totalIn  = filtered.reduce((s, r) => s + r.in,  0);
  const totalOut = filtered.reduce((s, r) => s + r.out, 0);

  res.json({ openingBalance, netPeriod, closingBalance: openingBalance + netPeriod, totalIn, totalOut, rows: withBalance });
});

// ─── Accounts (Parties) List ──────────────────────────────────────────────────

router.get("/finance/accounts", requireAuth, async (_req, res): Promise<void> => {
  const [txParties, customers, suppliers, employees] = await Promise.all([
    db.selectDistinct({ name: financialTransactionsTable.partyName })
      .from(financialTransactionsTable)
      .where(sql`party_name IS NOT NULL AND party_name != ''`),
    db.select({ name: customersTable.name }).from(customersTable),
    db.select({ name: suppliersTable.name }).from(suppliersTable),
    db.select({ name: employeesTable.nameAr }).from(employeesTable),
  ]);

  const all = new Set([
    ...txParties.map(a => a.name!),
    ...customers.map(c => c.name),
    ...suppliers.map(s => s.name),
    ...employees.map(e => e.name),
  ]);

  res.json([...all].filter(Boolean).sort());
});

// ─── Account Statement ────────────────────────────────────────────────────────

router.get("/finance/account-statement", requireAuth, async (req, res): Promise<void> => {
  const account = String(req.query.account ?? "").trim();
  if (!account) { res.json({ account: "", openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0, rows: [] }); return; }

  const fromStr = String(req.query.from ?? "");
  const toStr   = String(req.query.to   ?? "");
  const now     = new Date();
  const from = fromStr
    ? new Date(fromStr + "T00:00:00")
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = toStr
    ? new Date(toStr + "T23:59:59")
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Transactions linked to this party
  const txRows = await db
    .select({
      id: financialTransactionsTable.id,
      number: financialTransactionsTable.number,
      type: financialTransactionsTable.type,
      amount: financialTransactionsTable.amount,
      categoryName: expenseCategoriesTable.nameAr,
      description: financialTransactionsTable.description,
      createdAt: financialTransactionsTable.createdAt,
    })
    .from(financialTransactionsTable)
    .leftJoin(expenseCategoriesTable, eq(financialTransactionsTable.categoryId, expenseCategoriesTable.id))
    .where(eq(financialTransactionsTable.partyName, account));

  // Customer invoices for this account name
  const invRows = await db
    .select({
      id: invoicesTable.id,
      number: invoicesTable.number,
      total: invoicesTable.total,
      paymentMethod: invoicesTable.paymentMethod,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(and(eq(customersTable.name, account), eq(invoicesTable.status, "completed")));

  const allEntries: any[] = [];
  for (const tx of txRows) {
    allEntries.push({
      id: `tx-${tx.id}`, dbId: tx.id, number: tx.number,
      // Receipt = money came IN to us FROM party → له (credit for us, debit for party)
      debit:  tx.type === "payment" ? Number(tx.amount) : 0,  // عليه
      credit: tx.type === "receipt" ? Number(tx.amount) : 0,  // له
      description: tx.description ?? tx.categoryName ?? "",
      type: tx.type, source: "transaction",
      createdAt: tx.createdAt,
    });
  }
  for (const inv of invRows) {
    const isCredit = inv.paymentMethod === "credit";
    allEntries.push({
      id: `inv-${inv.id}`, dbId: inv.id, number: inv.number,
      debit:  isCredit ? Number(inv.total) : 0,   // آجل = customer owes us = عليه
      credit: !isCredit ? Number(inv.total) : 0,  // نقدي = received = له
      description: `فاتورة مبيعات (${isCredit ? "آجل" : "نقدي"})`,
      type: "invoice", source: "invoice",
      createdAt: inv.createdAt,
    });
  }

  allEntries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const openingBalance = allEntries
    .filter(e => new Date(e.createdAt) < from)
    .reduce((s, e) => s + e.credit - e.debit, 0);

  const period = allEntries.filter(e => { const d = new Date(e.createdAt); return d >= from && d <= to; });

  let bal = openingBalance;
  const rows = period.map((e, i) => {
    bal += e.credit - e.debit;
    return { ...e, balance: bal, rowNum: i + 1, createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt };
  });

  res.json({
    account, openingBalance,
    totalDebit:  period.reduce((s, e) => s + e.debit,  0),
    totalCredit: period.reduce((s, e) => s + e.credit, 0),
    closingBalance: bal, rows,
  });
});

// ─── Edit Transaction ─────────────────────────────────────────────────────────

const TxUpdateBody = z.object({
  type: z.enum(["receipt", "payment"]).optional(),
  amount: z.coerce.number().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  description: z.string().optional().nullable(),
  partyName: z.string().optional().nullable(),
  isInCashBox: z.boolean().optional(),
});

router.put("/finance/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = TxUpdateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const upd: Record<string, unknown> = {};
  if (parsed.data.type        !== undefined) upd.type        = parsed.data.type;
  if (parsed.data.amount      !== undefined) upd.amount      = String(parsed.data.amount);
  if (parsed.data.categoryId  !== undefined) upd.categoryId  = parsed.data.categoryId;
  if (parsed.data.description !== undefined) upd.description = parsed.data.description;
  if (parsed.data.partyName   !== undefined) upd.partyName   = parsed.data.partyName;
  if (parsed.data.isInCashBox !== undefined) upd.isInCashBox = parsed.data.isInCashBox;

  const [row] = await db
    .update(financialTransactionsTable)
    .set(upd)
    .where(eq(financialTransactionsTable.id, id))
    .returning();

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...row, amount: Number(row.amount), createdAt: row.createdAt.toISOString() });
});

export default router;
