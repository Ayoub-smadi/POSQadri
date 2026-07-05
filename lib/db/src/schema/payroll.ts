import { pgTable, serial, integer, numeric, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const transactionTypeEnum = pgEnum("transaction_type", ["bonus", "deduction"]);

export const salariesTable = pgTable("salaries", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().unique().references(() => employeesTable.id, { onDelete: "cascade" }),
  baseSalary: numeric("base_salary", { precision: 10, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const salaryTransactionsTable = pgTable("salary_transactions", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  type: transactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Salary = typeof salariesTable.$inferSelect;
export type SalaryTransaction = typeof salaryTransactionsTable.$inferSelect;
