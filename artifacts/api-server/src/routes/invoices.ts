import { Router, type IRouter } from "express";
import { eq, ilike, sql } from "drizzle-orm";
import {
  db,
  invoicesTable,
  invoiceItemsTable,
  customersTable,
  employeesTable,
  productsTable,
} from "@workspace/db";
import {
  ListInvoicesQueryParams,
  CreateInvoiceBody,
  GetInvoiceParams,
  ListInvoicesResponse,
  CreateInvoiceResponse,
  GetInvoiceResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function loadInvoiceWithItems(invoiceId: number) {
  const [row] = await db
    .select({
      id: invoicesTable.id,
      number: invoicesTable.number,
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      employeeId: invoicesTable.employeeId,
      employeeName: employeesTable.nameAr,
      subtotal: invoicesTable.subtotal,
      discount: invoicesTable.discount,
      tax: invoicesTable.tax,
      total: invoicesTable.total,
      paymentMethod: invoicesTable.paymentMethod,
      status: invoicesTable.status,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .leftJoin(employeesTable, eq(invoicesTable.employeeId, employeesTable.id))
    .where(eq(invoicesTable.id, invoiceId));

  if (!row) {
    return null;
  }

  const items = await db
    .select({
      id: invoiceItemsTable.id,
      productId: invoiceItemsTable.productId,
      productNameAr: productsTable.nameAr,
      quantity: invoiceItemsTable.quantity,
      price: invoiceItemsTable.price,
      discount: invoiceItemsTable.discount,
      notes: invoiceItemsTable.notes,
    })
    .from(invoiceItemsTable)
    .leftJoin(productsTable, eq(invoiceItemsTable.productId, productsTable.id))
    .where(eq(invoiceItemsTable.invoiceId, invoiceId));

  return {
    ...row,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    tax: Number(row.tax),
    total: Number(row.total),
    createdAt: row.createdAt.toISOString(),
    items: items.map((item) => ({
      ...item,
      productNameAr: item.productNameAr ?? "",
      price: Number(item.price),
      discount: Number(item.discount),
    })),
  };
}

router.get("/invoices", requireAuth, async (req, res): Promise<void> => {
  const query = ListInvoicesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db
    .select({
      id: invoicesTable.id,
      number: invoicesTable.number,
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      employeeId: invoicesTable.employeeId,
      employeeName: employeesTable.nameAr,
      subtotal: invoicesTable.subtotal,
      discount: invoicesTable.discount,
      tax: invoicesTable.tax,
      total: invoicesTable.total,
      paymentMethod: invoicesTable.paymentMethod,
      status: invoicesTable.status,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .leftJoin(employeesTable, eq(invoicesTable.employeeId, employeesTable.id))
    .where(query.data.search ? ilike(invoicesTable.number, `%${query.data.search}%`) : undefined)
    .orderBy(sql`${invoicesTable.createdAt} DESC`);

  const withItems = await Promise.all(
    rows.map(async (row) => {
      const items = await db
        .select({
          id: invoiceItemsTable.id,
          productId: invoiceItemsTable.productId,
          productNameAr: productsTable.nameAr,
          quantity: invoiceItemsTable.quantity,
          price: invoiceItemsTable.price,
          discount: invoiceItemsTable.discount,
          notes: invoiceItemsTable.notes,
        })
        .from(invoiceItemsTable)
        .leftJoin(productsTable, eq(invoiceItemsTable.productId, productsTable.id))
        .where(eq(invoiceItemsTable.invoiceId, row.id));

      return {
        ...row,
        subtotal: Number(row.subtotal),
        discount: Number(row.discount),
        tax: Number(row.tax),
        total: Number(row.total),
        createdAt: row.createdAt.toISOString(),
        items: items.map((item) => ({
          ...item,
          productNameAr: item.productNameAr ?? "",
          price: Number(item.price),
          discount: Number(item.discount),
        })),
      };
    }),
  );

  res.json(ListInvoicesResponse.parse(withItems));
});

router.post("/invoices", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { items, discount = 0, tax = 0, customerId, employeeId, paymentMethod } = parsed.data;

  if (items.length === 0) {
    res.status(400).json({ error: "Invoice must contain at least one item" });
    return;
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity - (item.discount ?? 0), 0);
  const total = subtotal - discount + tax;
  const number = `INV-${Date.now()}`;

  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      number,
      customerId: customerId ?? null,
      employeeId: employeeId ?? req.session.employeeId ?? null,
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      paymentMethod,
    })
    .returning();

  if (!invoice) {
    res.status(500).json({ error: "Failed to create invoice" });
    return;
  }

  await db.insert(invoiceItemsTable).values(
    items.map((item) => ({
      invoiceId: invoice.id,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price.toFixed(2),
      discount: (item.discount ?? 0).toFixed(2),
      notes: item.notes ?? null,
    })),
  );

  for (const item of items) {
    await db
      .update(productsTable)
      .set({ quantity: sql`${productsTable.quantity} - ${item.quantity}` })
      .where(eq(productsTable.id, item.productId));
  }

  if (customerId) {
    if (paymentMethod === "credit") {
      await db
        .update(customersTable)
        .set({
          purchaseCount: sql`${customersTable.purchaseCount} + 1`,
          totalSpent: sql`${customersTable.totalSpent} + ${total.toFixed(2)}`,
          balance: sql`${customersTable.balance} + ${total.toFixed(2)}`,
        })
        .where(eq(customersTable.id, customerId));
    } else {
      await db
        .update(customersTable)
        .set({
          purchaseCount: sql`${customersTable.purchaseCount} + 1`,
          totalSpent: sql`${customersTable.totalSpent} + ${total.toFixed(2)}`,
        })
        .where(eq(customersTable.id, customerId));
    }
  }

  const full = await loadInvoiceWithItems(invoice.id);
  res.status(201).json(CreateInvoiceResponse.parse(full));
});

router.get("/invoices/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const full = await loadInvoiceWithItems(params.data.id);
  if (!full) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.json(GetInvoiceResponse.parse(full));
});

export default router;
