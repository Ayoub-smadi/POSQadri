import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, employeesTable, salariesTable, salaryTransactionsTable, expenseCategoriesTable, financialTransactionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { z } from "zod";

const router: IRouter = Router();

const SetSalaryBody = z.object({ baseSalary: z.coerce.number().min(0) });
const CreateTxBody = z.object({
  type: z.enum(["bonus", "deduction"]),
  amount: z.coerce.number().min(0.01),
  note: z.string().optional().nullable(),
  transactionDate: z.string().optional().nullable(),
});
const IdParam = z.object({ id: z.coerce.number().int().positive() });
const TxIdParam = z.object({ txId: z.coerce.number().int().positive() });
const EmpIdParam = z.object({ employeeId: z.coerce.number().int().positive() });

async function buildPayrollRow(emp: typeof employeesTable.$inferSelect) {
  const [salary] = await db.select().from(salariesTable).where(eq(salariesTable.employeeId, emp.id));
  const transactions = await db
    .select()
    .from(salaryTransactionsTable)
    .where(eq(salaryTransactionsTable.employeeId, emp.id));

  const baseSalary = Number(salary?.baseSalary ?? 0);
  const totalBonus = transactions
    .filter((t) => t.type === "bonus")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalDeduction = transactions
    .filter((t) => t.type === "deduction")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalAdvance = transactions
    .filter((t) => t.type === "advance")
    .reduce((s, t) => s + Number(t.amount), 0);

  return {
    employeeId: emp.id,
    nameAr: emp.nameAr,
    role: emp.role,
    baseSalary,
    totalBonus,
    totalDeduction,
    totalAdvance,
    netSalary: baseSalary + totalBonus - totalDeduction - totalAdvance,
  };
}

router.get("/payroll", requireAuth, async (_req, res): Promise<void> => {
  const employees = await db.select().from(employeesTable).orderBy(employeesTable.id);
  const rows = await Promise.all(employees.map(buildPayrollRow));
  res.json(rows);
});

router.put("/payroll/:employeeId/salary", requireAuth, async (req, res): Promise<void> => {
  const params = EmpIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid employeeId" }); return; }

  const parsed = SetSalaryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, params.data.employeeId));
  if (!emp) { res.status(404).json({ error: "Employee not found" }); return; }

  await db
    .insert(salariesTable)
    .values({ employeeId: emp.id, baseSalary: String(parsed.data.baseSalary) })
    .onConflictDoUpdate({
      target: salariesTable.employeeId,
      set: { baseSalary: String(parsed.data.baseSalary), updatedAt: new Date() },
    });

  const row = await buildPayrollRow(emp);
  res.json(row);
});

router.get("/payroll/:employeeId/transactions", requireAuth, async (req, res): Promise<void> => {
  const params = EmpIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid employeeId" }); return; }

  const transactions = await db
    .select()
    .from(salaryTransactionsTable)
    .where(eq(salaryTransactionsTable.employeeId, params.data.employeeId))
    .orderBy(salaryTransactionsTable.transactionDate);

  res.json(
    transactions.map((t) => ({
      id: t.id,
      employeeId: t.employeeId,
      type: t.type,
      amount: Number(t.amount),
      note: t.note,
      transactionDate: t.transactionDate.toISOString(),
      createdAt: t.createdAt.toISOString(),
    })),
  );
});

router.post("/payroll/:employeeId/transactions", requireAuth, async (req, res): Promise<void> => {
  const params = EmpIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid employeeId" }); return; }

  const parsed = CreateTxBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, params.data.employeeId));
  if (!emp) { res.status(404).json({ error: "Employee not found" }); return; }

  const txDate = parsed.data.transactionDate ? new Date(parsed.data.transactionDate) : new Date();

  const [tx] = await db
    .insert(salaryTransactionsTable)
    .values({
      employeeId: emp.id,
      type: parsed.data.type,
      amount: String(parsed.data.amount),
      note: parsed.data.note ?? null,
      transactionDate: txDate,
    })
    .returning();

  if (!tx) { res.status(500).json({ error: "Failed to create transaction" }); return; }

  res.status(201).json({
    id: tx.id,
    employeeId: tx.employeeId,
    type: tx.type,
    amount: Number(tx.amount),
    note: tx.note,
    transactionDate: tx.transactionDate.toISOString(),
    createdAt: tx.createdAt.toISOString(),
  });
});

const AdvanceBody = z.object({
  amount: z.coerce.number().min(0.01),
  note: z.string().optional().nullable(),
  isInCashBox: z.boolean().default(true),
});

router.post("/payroll/:employeeId/advance", requireAuth, async (req, res): Promise<void> => {
  const params = EmpIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid employeeId" }); return; }

  const parsed = AdvanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, params.data.employeeId));
  if (!emp) { res.status(404).json({ error: "Employee not found" }); return; }

  // 1. Record advance as a salary deduction
  const [tx] = await db.insert(salaryTransactionsTable).values({
    employeeId: emp.id,
    type: "advance",
    amount: String(parsed.data.amount),
    note: parsed.data.note ?? "سلفة راتب",
    transactionDate: new Date(),
  }).returning();

  // 2. Find or create "سلف الرواتب" expense category
  let [cat] = await db.select().from(expenseCategoriesTable).where(eq(expenseCategoriesTable.nameAr, "سلف الرواتب"));
  if (!cat) {
    [cat] = await db.insert(expenseCategoriesTable).values({
      nameAr: "سلف الرواتب",
      icon: "💼",
      color: "#7c3aed",
      categoryType: "expense",
      isDefault: true,
    }).returning();
  }

  // 3. Record a financial payment transaction in the cashbox
  const number = `ADV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await db.insert(financialTransactionsTable).values({
    number,
    type: "payment",
    amount: String(parsed.data.amount),
    categoryId: cat!.id,
    description: parsed.data.note ?? `سلفة راتب`,
    partyName: emp.nameAr,
    isInCashBox: parsed.data.isInCashBox,
    employeeId: emp.id,
  });

  res.status(201).json({
    id: tx!.id,
    employeeId: tx!.employeeId,
    type: tx!.type,
    amount: Number(tx!.amount),
    note: tx!.note,
    message: "تم صرف الدفعة وخصمها من الراتب",
  });
});

router.delete("/payroll/transactions/:txId", requireAuth, async (req, res): Promise<void> => {
  const params = TxIdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid txId" }); return; }

  const [tx] = await db
    .delete(salaryTransactionsTable)
    .where(eq(salaryTransactionsTable.id, params.data.txId))
    .returning();

  if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }

  res.sendStatus(204);
});

export default router;
