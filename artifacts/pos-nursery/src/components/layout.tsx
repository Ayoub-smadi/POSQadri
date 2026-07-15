import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, ShoppingBag, Users, Truck, UserCircle, Receipt, LogOut, Store, Tag, Banknote, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImg from "/logo.png";

const navItems = [
  { href: "/dashboard", label: "اللوحة الرئيسية", icon: LayoutDashboard },
  { href: "/", label: "شاشة الكاشير", icon: Store },
  { href: "/finance", label: "الإدارة المالية", icon: Wallet },
  { href: "/products", label: "المنتجات", icon: ShoppingBag },
  { href: "/categories", label: "التصنيفات", icon: Tag },
  { href: "/invoices", label: "المبيعات", icon: Receipt },
  { href: "/customers", label: "العملاء", icon: Users },
  { href: "/suppliers", label: "الموردين", icon: Truck },
  { href: "/employees", label: "الموظفين", icon: UserCircle },
  { href: "/payroll", label: "الرواتب", icon: Banknote },
];

// Bottom nav shows the most-used 5 items on mobile
const mobileNavItems = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/", label: "الكاشير", icon: Store },
  { href: "/invoices", label: "المبيعات", icon: Receipt },
  { href: "/customers", label: "العملاء", icon: Users },
  { href: "/products", label: "المنتجات", icon: ShoppingBag },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading || !user) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar — desktop only */}
      <aside className="w-64 bg-sidebar border-l border-sidebar-border flex-col hidden md:flex">
        <div className="p-4 border-b border-sidebar-border/50 flex flex-col items-center gap-2">
          <img src={logoImg} alt="مشاتل القادري" className="h-20 w-auto object-contain" />
          <p className="text-sidebar-foreground/60 text-sm">{user.nameAr}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon size={20} className={isActive ? "text-accent" : ""} />
                  <span className="font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border/50">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground gap-3"
            onClick={logout}
          >
            <LogOut size={20} />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <img src={logoImg} alt="مشاتل القادري" className="h-9 w-auto object-contain" />
          <span className="text-sm font-medium text-muted-foreground">{user.nameAr}</span>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={logout}>
            <LogOut size={18} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-background/50 pb-20 md:pb-6">
          {children}
        </div>
      </main>

      {/* Bottom Nav — mobile only */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border z-50 flex">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div className={`flex flex-col items-center gap-0.5 py-2 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
