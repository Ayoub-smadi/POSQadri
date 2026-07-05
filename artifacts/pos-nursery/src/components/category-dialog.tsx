import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateCategory, useUpdateCategory } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const schema = z.object({
  nameAr: z.string().min(1, "الاسم مطلوب"),
  nameEn: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category?: any;
  onSuccess: () => void;
}

const colorOptions = ["#16a34a", "#ea580c", "#0ea5e9", "#a855f7", "#dc2626", "#ca8a04", "#0d9488", "#64748b"];

export function CategoryDialog({ open, onOpenChange, category, onSuccess }: Props) {
  const { toast } = useToast();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const isEdit = !!category;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nameAr: "", nameEn: "", color: colorOptions[0], icon: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        nameAr: category?.nameAr ?? "",
        nameEn: category?.nameEn ?? "",
        color: category?.color ?? colorOptions[0],
        icon: category?.icon ?? "",
      });
    }
  }, [open, category]);

  function onSubmit(values: FormValues) {
    const payload = {
      nameAr: values.nameAr,
      nameEn: values.nameEn || undefined,
      color: values.color || undefined,
      icon: values.icon || undefined,
    };

    if (isEdit) {
      updateCategory.mutate({ id: category.id, data: payload }, {
        onSuccess: () => { toast({ title: "تم تحديث التصنيف" }); onSuccess(); onOpenChange(false); },
        onError: () => toast({ variant: "destructive", title: "حدث خطأ أثناء التحديث" }),
      });
    } else {
      createCategory.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "تم إضافة التصنيف" }); onSuccess(); onOpenChange(false); },
        onError: () => toast({ variant: "destructive", title: "حدث خطأ أثناء الإضافة" }),
      });
    }
  }

  const isPending = createCategory.isPending || updateCategory.isPending;
  const selectedColor = form.watch("color");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif">
            {isEdit ? "تعديل التصنيف" : "إضافة تصنيف جديد"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField control={form.control} name="nameAr" render={({ field }) => (
              <FormItem>
                <FormLabel>الاسم بالعربية *</FormLabel>
                <FormControl><Input placeholder="نباتات داخلية" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="nameEn" render={({ field }) => (
              <FormItem>
                <FormLabel>الاسم بالإنجليزية</FormLabel>
                <FormControl><Input dir="ltr" placeholder="Indoor Plants" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormItem>
              <FormLabel>اللون</FormLabel>
              <div className="flex gap-2 flex-wrap">
                {colorOptions.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => form.setValue("color", c)}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${selectedColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </FormItem>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin ml-2" size={16} /> : null}
                {isEdit ? "حفظ التعديلات" : "إضافة التصنيف"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
