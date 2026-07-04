import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useListProducts, useListCategories, useCreateInvoice } from "@workspace/api-client-react";
import { Search, ScanBarcode, Minus, Plus, Trash2, LogOut, Check, ArrowRight } from "lucide-react";
import logoImg from "/logo.png";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";

type CartItem = {
  productId: number;
  productName: string;
  price: number;
  quantity: number;
  discount: number;
};

export default function Cashier() {
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash"|"visa"|"cliq"|"bank"|"split">("cash");
  
  const { data: productsData, isLoading: isLoadingProducts } = useListProducts({ search });
  const products = Array.isArray(productsData) ? productsData : [];
  const { data: categoriesData } = useListCategories();
  const categories = Array.isArray(categoriesData) ? categoriesData : [];
  const createInvoice = useCreateInvoice();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      setLocation("/login");
    }
  }, [isAuthLoading, user, setLocation]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => !selectedCategory || p.categoryId === selectedCategory);
  }, [products, selectedCategory]);

  if (isAuthLoading || !user) return null;

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId: product.id, productName: product.nameAr, price: product.salePrice, quantity: 1, discount: 0 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalDiscount = cart.reduce((sum, item) => sum + (item.discount * item.quantity), 0);
  const tax = (subtotal - totalDiscount) * 0.16; // 16% tax
  const total = subtotal - totalDiscount + tax;

  const handleCompleteSale = () => {
    if (cart.length === 0) return;
    
    createInvoice.mutate({
      data: {
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount
        })),
        paymentMethod: paymentMethod,
        discount: totalDiscount,
        tax: tax,
        employeeId: user.id
      }
    }, {
      onSuccess: () => {
        toast({ title: "تم إتمام البيع بنجاح" });
        setCart([]);
        setIsPaymentOpen(false);
      },
      onError: () => {
        toast({ variant: "destructive", title: "حدث خطأ أثناء حفظ الفاتورة" });
      }
    });
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Products Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card px-4 flex items-center justify-between shadow-sm z-10">
          <img src={logoImg} alt="مشاتل القادري" className="h-10 w-auto object-contain" />
          <div className="flex items-center gap-4 flex-1 max-w-xl mx-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <Input 
                placeholder="ابحث عن منتج..." 
                className="pl-4 pr-10 rounded-full bg-muted/50 border-none focus-visible:ring-1"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="rounded-full shrink-0">
              <ScanBarcode size={20} />
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            {user.role === "admin" && (
              <Button variant="ghost" onClick={() => setLocation("/dashboard")}>
                لوحة التحكم
                <ArrowRight className="mr-2" size={16} />
              </Button>
            )}
            <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
              {user.nameAr.charAt(0)}
            </div>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={logout} title="تسجيل الخروج">
              <LogOut size={20} />
            </Button>
          </div>
        </header>

        {/* Categories */}
        <div className="px-4 py-3 bg-card border-b border-border overflow-x-auto flex gap-2 hide-scrollbar">
          <Button 
            variant={selectedCategory === null ? "default" : "outline"} 
            className="rounded-full whitespace-nowrap"
            onClick={() => setSelectedCategory(null)}
          >
            الكل
          </Button>
          {categories.map(cat => (
            <Button 
              key={cat.id} 
              variant={selectedCategory === cat.id ? "default" : "outline"}
              className="rounded-full whitespace-nowrap"
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.nameAr}
            </Button>
          ))}
        </div>

        {/* Product Grid */}
        <ScrollArea className="flex-1 p-4 bg-muted/20">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
            {filteredProducts.map(product => (
              <div 
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-card rounded-2xl p-3 border border-border/50 shadow-sm cursor-pointer hover:shadow-md hover:border-primary/30 transition-all hover:-translate-y-1 group active:scale-95"
              >
                <div className="aspect-square bg-muted rounded-xl mb-3 overflow-hidden flex items-center justify-center">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.nameAr} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <span className="text-4xl text-muted-foreground/30">🌿</span>
                  )}
                </div>
                <h3 className="font-medium text-sm line-clamp-2 min-h-[40px] text-card-foreground leading-tight">
                  {product.nameAr}
                </h3>
                <p className="font-bold text-primary mt-2 flex justify-between items-center">
                  <span>{product.salePrice.toFixed(2)} د.أ</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-normal">{product.quantity} متوفر</span>
                </p>
              </div>
            ))}
            {filteredProducts.length === 0 && !isLoadingProducts && (
              <div className="col-span-full py-20 text-center text-muted-foreground">
                لا توجد منتجات
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Cart Sidebar */}
      <div className="w-96 bg-card border-r border-border flex flex-col shadow-xl z-20">
        <div className="p-4 border-b border-border bg-primary text-primary-foreground flex justify-between items-center">
          <h2 className="font-serif font-bold text-xl">سلة المشتريات</h2>
          <span className="bg-primary-foreground/20 px-2 py-1 rounded-md text-sm">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} عنصر
          </span>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {cart.map(item => (
              <div key={item.productId} className="flex gap-3 bg-background p-3 rounded-xl border border-border/50 group">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{item.productName}</h4>
                  <div className="text-primary font-bold text-sm mt-1">{item.price.toFixed(2)} د.أ</div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.productId)}>
                    <Trash2 size={14} />
                  </Button>
                  <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                    <button className="h-6 w-6 rounded-md bg-background flex items-center justify-center shadow-sm" onClick={() => updateQuantity(item.productId, -1)}>
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                    <button className="h-6 w-6 rounded-md bg-background flex items-center justify-center shadow-sm" onClick={() => updateQuantity(item.productId, 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="text-center text-muted-foreground py-12 flex flex-col items-center gap-3">
                <ShoppingBag size={48} className="opacity-20" />
                <p>السلة فارغة</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 bg-muted/30 border-t border-border mt-auto">
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>المجموع الفرعي</span>
              <span>{subtotal.toFixed(2)} د.أ</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-destructive">
                <span>الخصم</span>
                <span>-{totalDiscount.toFixed(2)} د.أ</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>الضريبة (16%)</span>
              <span>{tax.toFixed(2)} د.أ</span>
            </div>
            <div className="pt-2 border-t border-border flex justify-between font-bold text-xl text-foreground">
              <span>الإجمالي</span>
              <span className="text-primary">{total.toFixed(2)} د.أ</span>
            </div>
          </div>

          <Button 
            className="w-full h-14 text-lg font-bold rounded-xl shadow-lg" 
            disabled={cart.length === 0}
            onClick={() => setIsPaymentOpen(true)}
          >
            إتمام الدفع
          </Button>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif">طريقة الدفع</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <div className="text-center mb-8">
              <div className="text-sm text-muted-foreground mb-1">المبلغ المطلوب</div>
              <div className="text-4xl font-bold text-primary">{total.toFixed(2)} د.أ</div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "cash", label: "كاش", icon: "💵" },
                { id: "visa", label: "فيزا", icon: "💳" },
                { id: "cliq", label: "كليك", icon: "📱" },
                { id: "bank", label: "حوالة", icon: "🏦" }
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as any)}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    paymentMethod === method.id 
                      ? "border-primary bg-primary/5 text-primary shadow-sm" 
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <span className="text-2xl">{method.icon}</span>
                  <span className="font-medium">{method.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsPaymentOpen(false)}>
              إلغاء
            </Button>
            <Button 
              className="flex-[2] h-12 rounded-xl font-bold" 
              onClick={handleCompleteSale}
              disabled={createInvoice.isPending}
            >
              تأكيد الدفع
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
