import { Layout } from "@/components/layout";
import { useListCategories, useDeleteCategory } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { CategoryDialog } from "@/components/category-dialog";

export default function Categories() {
  const { data: categories = [], refetch } = useListCategories();
  const deleteMutation = useDeleteCategory();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  const handleAdd = () => {
    setEditingCategory(null);
    setDialogOpen(true);
  };

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا التصنيف؟")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "تم الحذف" });
          refetch();
        },
        onError: () => toast({ variant: "destructive", title: "تعذر حذف التصنيف، تأكد من عدم ارتباطه بمنتجات" }),
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold">التصنيفات</h1>
            <p className="text-muted-foreground mt-1">إدارة تصنيفات المنتجات</p>
          </div>
          <Button className="rounded-xl gap-2" onClick={handleAdd}><Plus size={18} />إضافة تصنيف</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-card rounded-2xl border border-border shadow-sm p-4 flex flex-col gap-3 group">
              <div className="flex items-center justify-between">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: cat.color || "#16a34a" }}
                >
                  <Tag size={18} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(cat)}>
                    <Edit size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(cat.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <div>
                <p className="font-bold text-foreground">{cat.nameAr}</p>
                {cat.nameEn && <p className="text-sm text-muted-foreground">{cat.nameEn}</p>}
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              لا توجد تصنيفات بعد
            </div>
          )}
        </div>
      </div>

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editingCategory}
        onSuccess={refetch}
      />
    </Layout>
  );
}
