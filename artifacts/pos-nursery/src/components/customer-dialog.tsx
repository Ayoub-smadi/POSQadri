import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateCustomer, useUpdateCustomer } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  phone: z.string().optional(),
  balance: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer?: any;
  onSuccess: () => void;
}

export function CustomerDialog({ open, onOpenChange, customer, onSuccess }: Props) {
  const { toast } = useToast();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const isEdit = !!customer;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", balance: 0 },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: customer?.name ?? "",
        phone: customer?.phone ?? "",
        balance: customer?.balance ?? 0,
      });
    }
  }, [open, customer]);

  function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      phone: values.phone || undefined,
      balance: values.balance ?? 0,
    };

    if (isEdit) {
      updateCustomer.mutate({ id: customer.id, data: payload }, {
        onSuccess: () => { toast({ title: "تم تحديث بيانات العميل" }); onSuccess(); onOpenChange(false); },
        onError: () => toast({ variant: "destructive", title: "حدث خطأ أثناء التحديث" }),
      });
    } else {
      createCustomer.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "تم إضافة العميل" }); onSuccess(); onOpenChange(false); },
        onError: () => toast({ variant: "destructive", title: "حدث خطأ أثناء الإضافة" }),
      });
    }
  }

  const isPending = createCustomer.isPending || updateCustomer.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif">
            {isEdit ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>الاسم *</FormLabel>
                <FormControl><Input placeholder="اسم العميل" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>رقم الهاتف</FormLabel>
                <FormControl><Input dir="ltr" placeholder="07XXXXXXXX" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="balance" render={({ field }) => (
              <FormItem>
                <FormLabel>الرصيد (له/عليه)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin ml-2" size={16} /> : null}
                {isEdit ? "حفظ التعديلات" : "إضافة العميل"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
