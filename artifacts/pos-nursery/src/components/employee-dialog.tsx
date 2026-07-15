import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateEmployee, useUpdateEmployee } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const schema = z.object({
  nameAr: z.string().min(1, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  phone: z.string().optional(),
  role: z.enum(["admin", "cashier"]),
  jobTitle: z.string().optional(),
  password: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee?: any;
  onSuccess: () => void;
}

export function EmployeeDialog({ open, onOpenChange, employee, onSuccess }: Props) {
  const { toast } = useToast();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const isEdit = !!employee;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nameAr: "", email: "", phone: "", role: "cashier", jobTitle: "", password: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        nameAr: employee?.nameAr ?? "",
        email: employee?.email ?? "",
        phone: employee?.phone ?? "",
        role: employee?.role ?? "cashier",
        jobTitle: employee?.jobTitle ?? "",
        password: "",
      });
    }
  }, [open, employee]);

  function onSubmit(values: FormValues) {
    if (isEdit) {
      const payload: any = {
        nameAr: values.nameAr,
        email: values.email,
        phone: values.phone || undefined,
        role: values.role,
      };
      if (values.password) payload.password = values.password;

      updateEmployee.mutate({ id: employee.id, data: payload }, {
        onSuccess: () => { toast({ title: "تم تحديث بيانات الموظف" }); onSuccess(); onOpenChange(false); },
        onError: (err: any) => toast({ variant: "destructive", title: "حدث خطأ أثناء التحديث", description: err?.data?.error || err?.message }),
      });
    } else {
      createEmployee.mutate({
        data: {
          nameAr: values.nameAr,
          email: values.email,
          phone: values.phone || undefined,
          role: values.role,
          password: values.password || undefined,
        }
      }, {
        onSuccess: () => { toast({ title: "تم إضافة الموظف" }); onSuccess(); onOpenChange(false); },
        onError: (err: any) => toast({ variant: "destructive", title: "حدث خطأ أثناء الإضافة", description: err?.data?.error || err?.message }),
      });
    }
  }

  const isPending = createEmployee.isPending || updateEmployee.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif">
            {isEdit ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField control={form.control} name="nameAr" render={({ field }) => (
              <FormItem>
                <FormLabel>الاسم *</FormLabel>
                <FormControl><Input placeholder="اسم الموظف" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>البريد الإلكتروني *</FormLabel>
                <FormControl><Input dir="ltr" placeholder="employee@example.com" {...field} /></FormControl>
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

            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel>الدور الوظيفي *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="admin">مدير</SelectItem>
                    <SelectItem value="cashier">كاشير</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>{isEdit ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"}</FormLabel>
                <FormControl><Input dir="ltr" type="password" placeholder={isEdit ? "اتركه فارغاً للإبقاء عليها" : "••••••••"} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin ml-2" size={16} /> : null}
                {isEdit ? "حفظ التعديلات" : "إضافة الموظف"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
