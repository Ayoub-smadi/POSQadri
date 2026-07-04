import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import customersRouter from "./customers";
import suppliersRouter from "./suppliers";
import employeesRouter from "./employees";
import invoicesRouter from "./invoices";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(customersRouter);
router.use(suppliersRouter);
router.use(employeesRouter);
router.use(invoicesRouter);
router.use(storageRouter);

export default router;
