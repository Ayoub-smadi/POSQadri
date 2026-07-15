import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LayoutDashboard, ShoppingCart } from "lucide-react";
import logoImg from "/logo.png";

const loginSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const loginMutation = useLogin();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (user) {
      setLocation(user.role === "admin" ? "/dashboard" : "/");
    }
  }, [user, setLocation]);

  if (user) return null;

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetCurrentUserQueryKey(), data);
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

  function fillCredentials(role: "admin" | "cashier") {
    const email = role === "admin" ? "admin@nursery.com" : "cashier@nursery.com";
    form.setValue("email", email, { shouldValidate: true });
    form.setValue("password", "", { shouldValidate: false });
    setTimeout(() => {
      const passwordInput = document.querySelector<HTMLInputElement>('input[type="password"]');
      if (passwordInput) passwordInput.focus();
    }, 50);
  }

  return (
    <div className="min-h-screen flex w-full">
      <div className="flex-1 flex flex-col justify-center items-center px-4 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center">
            <img src={logoImg} alt="مشاتل القادري" className="h-32 w-auto mb-4 object-contain" />
            <p className="text-muted-foreground">تسجيل الدخول للنظام</p>
          </div>

          {/* Quick Login */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-14 flex flex-col gap-1 border-2 hover:border-primary hover:bg-primary/5"
              onClick={() => fillCredentials("admin")}
              disabled={loginMutation.isPending}
            >
              <LayoutDashboard size={20} className="text-primary" />
              <span className="text-sm font-medium">دخول كمدير</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-14 flex flex-col gap-1 border-2 hover:border-primary hover:bg-primary/5"
              onClick={() => fillCredentials("cashier")}
              disabled={loginMutation.isPending}
            >
              <ShoppingCart size={20} className="text-primary" />
              <span className="text-sm font-medium">دخول ككاشير</span>
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
        <div className="absolute inset-0 bg-[url('/nursery-hero.jpg')] bg-cover bg-center"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/20 to-transparent flex items-end p-12">
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
