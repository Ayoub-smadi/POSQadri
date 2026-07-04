import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, employeesTable } from "@workspace/db";
import { LoginBody, GetCurrentUserResponse } from "@workspace/api-zod";
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

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.email, parsed.data.email));

  if (!employee) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, employee.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  req.session.employeeId = employee.id;
  res.json(GetCurrentUserResponse.parse(toPublicEmployee(employee)));
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.sendStatus(204);
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, req.session.employeeId as number));

  if (!employee) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json(GetCurrentUserResponse.parse(toPublicEmployee(employee)));
});

export default router;
