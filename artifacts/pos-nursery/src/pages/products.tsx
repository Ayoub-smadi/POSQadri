import { Layout } from "@/components/layout";
import { useListProducts, useDeleteProduct } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Search, Edit, Trash2, ImageOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ProductDialog } from "@/components/product-dialog";

export default function Products() {
  const [search, setSearch] = useState("");
  const { data: products = [], refetch } = useListProducts({ search });
  const deleteMutation = useDeleteProduct();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const handleAdd = () => {
    setEditingProduct(null);
    setDialogOpen(true);
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "تم الحذف بنجاح" });
          refetch();
        },
        onError: () => toast({ variant: "destructive", title: "حدث خطأ أثناء الحذف" }),
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">المنتجات</h1>
            <p className="text-muted-foreground mt-1">إدارة مخزون المشتل</p>
          </div>
          <Button className="rounded-xl gap-2" onClick={handleAdd}>
            <Plus size={18} />
            إضافة منتج
          </Button>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex gap-4 bg-muted/20">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="بحث بالاسم أو الباركود..."
                className="pl-4 pr-10 rounded-xl"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-16 text-right">الصورة</TableHead>
                <TableHead className="text-right">المنتج</TableHead>
                <TableHead className="text-right">الباركود</TableHead>
                <TableHead className="text-right">التصنيف</TableHead>
                <TableHead className="text-right">سعر الشراء</TableHead>
                <TableHead className="text-right">سعر البيع</TableHead>
                <TableHead className="text-center">الكمية</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(Array.isArray(products) ? products : []).map((product: any) => (
                <TableRow key={product.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="h-12 w-12 rounded-lg bg-muted border overflow-hidden flex items-center justify-center">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageOff size={18} className="text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{product.nameAr}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{product.barcode || '—'}</TableCell>
                  <TableCell>{product.categoryNameAr || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{product.purchasePrice?.toFixed(2)} د.أ</TableCell>
                  <TableCell className="font-bold text-primary">{product.salePrice?.toFixed(2)} د.أ</TableCell>
                  <TableCell className="text-center">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                      product.quantity <= product.lowStockThreshold
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {product.quantity}
                    </span>
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(Array.isArray(products) ? products : []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    لا توجد منتجات
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editingProduct}
        onSuccess={refetch}
      />
    </Layout>
  );
}
