import { Router, type IRouter } from "express";
import { eq, and, or, ilike } from "drizzle-orm";
import { db, productsTable, categoriesTable } from "@workspace/db";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
  ListProductsResponse,
  CreateProductResponse,
  GetProductResponse,
  UpdateProductResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function toProductShape(row: {
  id: number;
  nameAr: string;
  nameEn: string | null;
  barcode: string;
  categoryId: number | null;
  categoryNameAr: string | null;
  supplierId: number | null;
  purchasePrice: string;
  salePrice: string;
  quantity: number;
  lowStockThreshold: number;
  description: string | null;
  imageUrl: string | null;
  status: string;
  createdAt: Date;
}) {
  return {
    ...row,
    purchasePrice: Number(row.purchasePrice),
    salePrice: Number(row.salePrice),
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/products", requireAuth, async (req, res): Promise<void> => {
  const query = ListProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.search) {
    conditions.push(
      or(
        ilike(productsTable.nameAr, `%${query.data.search}%`),
        ilike(productsTable.nameEn, `%${query.data.search}%`),
        ilike(productsTable.barcode, `%${query.data.search}%`),
      ),
    );
  }
  if (query.data.categoryId) {
    conditions.push(eq(productsTable.categoryId, query.data.categoryId));
  }

  const rows = await db
    .select({
      id: productsTable.id,
      nameAr: productsTable.nameAr,
      nameEn: productsTable.nameEn,
      barcode: productsTable.barcode,
      categoryId: productsTable.categoryId,
      categoryNameAr: categoriesTable.nameAr,
      supplierId: productsTable.supplierId,
      purchasePrice: productsTable.purchasePrice,
      salePrice: productsTable.salePrice,
      quantity: productsTable.quantity,
      lowStockThreshold: productsTable.lowStockThreshold,
      description: productsTable.description,
      imageUrl: productsTable.imageUrl,
      status: productsTable.status,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(productsTable.id);

  res.json(ListProductsResponse.parse(rows.map(toProductShape)));
});

router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const barcode = parsed.data.barcode ?? `NUR${Date.now()}`;

  const [product] = await db
    .insert(productsTable)
    .values({
      ...parsed.data,
      barcode,
      purchasePrice: String(parsed.data.purchasePrice),
      salePrice: String(parsed.data.salePrice),
    })
    .returning();

  if (!product) {
    res.status(500).json({ error: "Failed to create product" });
    return;
  }

  res.status(201).json(CreateProductResponse.parse(toProductShape({ ...product, categoryNameAr: null })));
});

router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({
      id: productsTable.id,
      nameAr: productsTable.nameAr,
      nameEn: productsTable.nameEn,
      barcode: productsTable.barcode,
      categoryId: productsTable.categoryId,
      categoryNameAr: categoriesTable.nameAr,
      supplierId: productsTable.supplierId,
      purchasePrice: productsTable.purchasePrice,
      salePrice: productsTable.salePrice,
      quantity: productsTable.quantity,
      lowStockThreshold: productsTable.lowStockThreshold,
      description: productsTable.description,
      imageUrl: productsTable.imageUrl,
      status: productsTable.status,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(GetProductResponse.parse(toProductShape(row)));
});

router.patch("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { purchasePrice, salePrice, barcode, ...rest } = parsed.data;
  const updateValues: Partial<typeof productsTable.$inferInsert> = { ...rest };
  if (purchasePrice !== undefined) {
    updateValues.purchasePrice = String(purchasePrice);
  }
  if (salePrice !== undefined) {
    updateValues.salePrice = String(salePrice);
  }
  if (barcode != null) {
    updateValues.barcode = barcode;
  }

  const [product] = await db
    .update(productsTable)
    .set(updateValues)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(UpdateProductResponse.parse(toProductShape({ ...product, categoryNameAr: null })));
});

router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
