import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";
import { suppliersTable } from "./suppliers";

// ─── Expense/Income Categories (البنود) ─────────────────────────────────────

export const financeCategoryTypeEnum = pgEnum("finance_category_type", [
  "expense",
  "income",
  "both",
]);

export const expenseCategoriesTable = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  icon: text("icon").notNull().default("💰"),
  color: text("color").notNull().default("#6b7280"),
  categoryType: financeCategoryTypeEnum("category_type")
    .notNull()
    .default("expense"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ExpenseCategory = typeof expenseCategoriesTable.$inferSelect;

// ─── Purchase Orders (المشتريات) ────────────────────────────────────────────

export const purchaseTypeEnum = pgEnum("purchase_type", ["cash", "credit"]);
export const purchaseStatusEnum = pgEnum("purchase_status", [
  "pending",
  "partial",
  "paid",
]);

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  supplierId: integer("supplier_id").references(() => suppliersTable.id),
  supplierName: text("supplier_name"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  description: text("description"),
  purchaseType: purchaseTypeEnum("purchase_type").notNull().default("cash"),
  status: purchaseStatusEnum("status").notNull().default("pending"),
  employeeId: integer("employee_id").references(() => employeesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;

// ─── Financial Transactions (الحركات المالية) ─────────────────────────────

export const financeTransactionTypeEnum = pgEnum("finance_transaction_type", [
  "receipt", // قبض
  "payment", // صرف
]);

export const financialTransactionsTable = pgTable("financial_transactions", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  type: financeTransactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  categoryId: integer("category_id").references(
    () => expenseCategoriesTable.id,
  ),
  description: text("description"),
  partyName: text("party_name"),
  isInCashBox: boolean("is_in_cash_box").notNull().default(true),
  purchaseOrderId: integer("purchase_order_id").references(
    () => purchaseOrdersTable.id,
    { onDelete: "set null" },
  ),
  employeeId: integer("employee_id").references(() => employeesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type FinancialTransaction =
  typeof financialTransactionsTable.$inferSelect;
