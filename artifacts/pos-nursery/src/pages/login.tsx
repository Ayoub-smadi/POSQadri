import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Leaf } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const loginMutation = useLogin();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (user) {
      setLocation(user.role === "admin" ? "/dashboard" : "/");
    }
  }, [user, setLocation]);

  if (user) {
    return null;
  }

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values }, {
      onSuccess: (data) => {
        setLocation(data.role === "admin" ? "/dashboard" : "/");
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "خطأ في تسجيل الدخول",
          description: "تأكد من صحة البريد الإلكتروني وكلمة المرور",
        });
      }
    });
  }

  return (
    <div className="min-h-screen flex w-full">
      <div className="flex-1 flex flex-col justify-center items-center px-4 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mb-4 text-primary-foreground">
              <Leaf size={32} />
            </div>
            <h1 className="text-3xl font-serif font-bold text-foreground">مشتل الأوركيد</h1>
            <p className="text-muted-foreground mt-2">تسجيل الدخول للنظام</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>البريد الإلكتروني</FormLabel>
                    <FormControl>
                      <Input dir="ltr" placeholder="admin@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>كلمة المرور</FormLabel>
                    <FormControl>
                      <Input dir="ltr" type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full text-lg h-12 rounded-xl" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? <Loader2 className="animate-spin ml-2" /> : null}
                دخول
              </Button>
            </form>
          </Form>
        </div>
      </div>
      <div className="hidden lg:block flex-1 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-40 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-transparent flex items-end p-12">
          <div className="text-primary-foreground max-w-lg">
            <h2 className="text-4xl font-serif font-bold mb-4 leading-tight">نظام إدارة متكامل للمشاتل الزراعية</h2>
            <p className="text-primary-foreground/80 text-lg leading-relaxed">
              إدارة المبيعات، المخزون، العملاء، والموظفين في مكان واحد وبواجهة عصرية وسهلة الاستخدام.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
