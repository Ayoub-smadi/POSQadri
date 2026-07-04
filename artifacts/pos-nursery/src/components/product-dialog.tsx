import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateProduct, useUpdateProduct, useListCategories } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";

const schema = z.object({
  nameAr: z.string().min(1, "الاسم مطلوب"),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  purchasePrice: z.coerce.number().min(0, "يجب أن يكون موجباً"),
  salePrice: z.coerce.number().min(0.01, "يجب أن يكون أكبر من صفر"),
  quantity: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  imageUrl: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product?: any;
  onSuccess: () => void;
}

export function ProductDialog({ open, onOpenChange, product, onSuccess }: Props) {
  const { toast } = useToast();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: categoriesData } = useListCategories();
  const categories = Array.isArray(categoriesData) ? categoriesData : [];

  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!product;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nameAr: "",
      barcode: "",
      categoryId: "",
      purchasePrice: 0,
      salePrice: 0,
      quantity: 0,
      lowStockThreshold: 5,
      imageUrl: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (product) {
        form.reset({
          nameAr: product.nameAr ?? "",
          barcode: product.barcode ?? "",
          categoryId: product.categoryId ? String(product.categoryId) : "",
          purchasePrice: product.purchasePrice ?? 0,
          salePrice: product.salePrice ?? 0,
          quantity: product.quantity ?? 0,
          lowStockThreshold: product.lowStockThreshold ?? 5,
          imageUrl: product.imageUrl ?? "",
        });
        setImagePreview(product.imageUrl ?? "");
      } else {
        form.reset({
          nameAr: "", barcode: "", categoryId: "",
          purchasePrice: 0, salePrice: 0, quantity: 0, lowStockThreshold: 5, imageUrl: "",
        });
        setImagePreview("");
      }
    }
  }, [open, product]);

  async function handleImageUpload(file: File) {
    setIsUploading(true);
    try {
      const metaRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "image/jpeg" }),
      });
      if (!metaRes.ok) throw new Error("فشل طلب رابط الرفع");
      const { uploadURL, objectPath } = await metaRes.json();

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      });
      if (!putRes.ok) throw new Error("فشل رفع الصورة");

      const displayUrl = `/api/storage/objects${objectPath.replace(/^\/objects/, "")}`;
      form.setValue("imageUrl", displayUrl);
      setImagePreview(displayUrl);
      toast({ title: "تم رفع الصورة بنجاح" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ في رفع الصورة", description: e.message });
    } finally {
      setIsUploading(false);
    }
  }

  function onSubmit(values: FormValues) {
    const payload = {
      nameAr: values.nameAr,
      barcode: values.barcode || undefined,
      categoryId: values.categoryId ? Number(values.categoryId) : undefined,
      purchasePrice: values.purchasePrice,
      salePrice: values.salePrice,
      quantity: values.quantity,
      lowStockThreshold: values.lowStockThreshold ?? 5,
      imageUrl: values.imageUrl || undefined,
    };

    if (isEdit) {
      updateProduct.mutate({ id: product.id, data: payload }, {
        onSuccess: () => { toast({ title: "تم تحديث المنتج" }); onSuccess(); onOpenChange(false); },
        onError: () => toast({ variant: "destructive", title: "حدث خطأ أثناء التحديث" }),
      });
    } else {
      createProduct.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "تم إضافة المنتج" }); onSuccess(); onOpenChange(false); },
        onError: () => toast({ variant: "destructive", title: "حدث خطأ أثناء الإضافة" }),
      });
    }
  }

  const isPending = createProduct.isPending || updateProduct.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif">
            {isEdit ? "تعديل المنتج" : "إضافة منتج جديد"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">

            {/* Image Upload */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-32 h-32 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors relative"
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="animate-spin text-primary" size={28} />
                ) : imagePreview ? (
                  <>
                    <img src={imagePreview} alt="صورة المنتج" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      className="absolute top-1 left-1 bg-destructive text-white rounded-full p-0.5"
                      onClick={(e) => { e.stopPropagation(); setImagePreview(""); form.setValue("imageUrl", ""); }}
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Upload size={24} />
                    <span className="text-xs">رفع صورة</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
              />
              <p className="text-xs text-muted-foreground">اضغط لرفع صورة المنتج</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="nameAr" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>اسم المنتج *</FormLabel>
                  <FormControl><Input placeholder="مثال: شجرة الزيتون" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="barcode" render={({ field }) => (
                <FormItem>
                  <FormLabel>الباركود</FormLabel>
                  <FormControl><Input dir="ltr" placeholder="123456789" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="categoryId" render={({ field }) => (
                <FormItem>
                  <FormLabel>التصنيف</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="اختر تصنيفاً" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.nameAr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>سعر الشراء (د.أ) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="salePrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>سعر البيع (د.أ) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>الكمية *</FormLabel>
                  <FormControl><Input type="number" min="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (
                <FormItem>
                  <FormLabel>حد التنبيه للمخزون</FormLabel>
                  <FormControl><Input type="number" min="0" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending || isUploading}>
                {isPending ? <Loader2 className="animate-spin ml-2" size={16} /> : null}
                {isEdit ? "حفظ التعديلات" : "إضافة المنتج"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
