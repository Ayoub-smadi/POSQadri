import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, employeesTable } from "@workspace/db";
import {
  CreateEmployeeBody,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
  DeleteEmployeeParams,
  ListEmployeesResponse,
  CreateEmployeeResponse,
  UpdateEmployeeResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function toPublicEmployee(employee: typeof employeesTable.$inferSelect) {
  return {
    id: employee.id,
    nameAr: employee.nameAr,
    email: employee.email,
    phone: employee.phone,
    role: employee.role,
    avatarUrl: employee.avatarUrl,
    createdAt: employee.createdAt.toISOString(),
  };
}

router.get("/employees", requireAuth, async (_req, res): Promise<void> => {
  const employees = await db.select().from(employeesTable).orderBy(employeesTable.id);
  res.json(ListEmployeesResponse.parse(employees.map(toPublicEmployee)));
});

router.post("/employees", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.email, parsed.data.email));
  if (existing) {
    res.status(400).json({ error: "البريد الإلكتروني مستخدم مسبقاً" });
    return;
  }

  const password = parsed.data.password ?? "123456";
  const passwordHash = await bcrypt.hash(password, 10);

  const [employee] = await db
    .insert(employeesTable)
    .values({
      nameAr: parsed.data.nameAr,
      email: parsed.data.email,
      phone: parsed.data.phone,
      role: parsed.data.role,
      avatarUrl: parsed.data.avatarUrl,
      passwordHash,
    })
    .returning();

  if (!employee) {
    res.status(500).json({ error: "Failed to create employee" });
    return;
  }

  res.status(201).json(CreateEmployeeResponse.parse(toPublicEmployee(employee)));
});

router.patch("/employees/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.email) {
    const [existing] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.email, parsed.data.email));
    if (existing && existing.id !== params.data.id) {
      res.status(400).json({ error: "البريد الإلكتروني مستخدم مسبقاً" });
      return;
    }
  }

  const { password, ...rest } = parsed.data;
  const updateValues: Partial<typeof employeesTable.$inferInsert> = { ...rest };
  if (password) {
    updateValues.passwordHash = await bcrypt.hash(password, 10);
  }

  const [employee] = await db
    .update(employeesTable)
    .set(updateValues)
    .where(eq(employeesTable.id, params.data.id))
    .returning();

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  res.json(UpdateEmployeeResponse.parse(toPublicEmployee(employee)));
});

router.delete("/employees/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [employee] = await db
    .delete(employeesTable)
    .where(eq(employeesTable.id, params.data.id))
    .returning();

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
