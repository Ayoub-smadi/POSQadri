import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useListProducts, useListCategories, useCreateInvoice, useListCustomers } from "@workspace/api-client-react";
import { Search, ScanBarcode, Minus, Plus, Trash2, LogOut, Check, ArrowRight, ShoppingBag, Printer, UserCircle, X } from "lucide-react";
import logoImg from "/logo.png";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";

type CartItem = {
  productId: number;
  productName: string;
  price: number;
  quantity: number;
  discount: number;
};

type CompletedInvoice = {
  id?: number;
  items: CartItem[];
  subtotal: number;
  totalDiscount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  cashierName: string;
  customerName?: string;
  date: Date;
};

const paymentLabels: Record<string, string> = {
  cash: "كاش", visa: "فيزا", cliq: "كليك", bank: "حوالة بنكية", credit: "دين (آجل)"
};

export default function Cashier() {
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<CompletedInvoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash"|"visa"|"cliq"|"bank"|"credit">("cash");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const { data: productsData, isLoading: isLoadingProducts } = useListProducts({ search });
  const products = Array.isArray(productsData) ? productsData : [];
  const { data: categoriesData } = useListCategories();
  const categories = Array.isArray(categoriesData) ? categoriesData : [];
  const { data: customersData } = useListCustomers({ search: customerSearch });
  const customers = Array.isArray(customersData) ? customersData : [];
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
      return [...prev, { productId: product.id, productName: product.nameAr, price: 0, quantity: 1, discount: 0 }];
    });
    // auto-open price editor for newly added item
    setTimeout(() => {
      setEditingPriceId(product.id);
      setEditingPriceValue("");
    }, 50);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const term = search.trim();
    if (!term) return;
    const exactMatch = products.find(p => p.barcode === term);
    if (exactMatch) {
      addToCart(exactMatch);
      setSearch("");
      e.preventDefault();
    }
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

  const startEditingPrice = (item: CartItem) => {
    setEditingPriceId(item.productId);
    setEditingPriceValue(item.price === 0 ? "" : item.price.toString());
  };

  const commitPrice = (productId: number) => {
    const parsed = parseFloat(editingPriceValue);
    if (!isNaN(parsed) && parsed >= 0) {
      setCart(prev => prev.map(item =>
        item.productId === productId ? { ...item, price: parsed } : item
      ));
    }
    setEditingPriceId(null);
    setEditingPriceValue("");
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalDiscount = cart.reduce((sum, item) => sum + (item.discount * item.quantity), 0);
  const tax = (subtotal - totalDiscount) * 0.16;
  const total = subtotal - totalDiscount + tax;

  const handleCompleteSale = () => {
    if (cart.length === 0) return;
    if (paymentMethod === "credit" && !selectedCustomer) {
      toast({ variant: "destructive", title: "يجب اختيار الزبون للدفع بالدين" });
      return;
    }
    
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
        employeeId: user.id,
        customerId: selectedCustomer?.id,
      }
    }, {
      onSuccess: (data: any) => {
        const invoice: CompletedInvoice = {
          id: data?.id,
          items: [...cart],
          subtotal,
          totalDiscount,
          tax,
          total,
          paymentMethod,
          cashierName: user.nameAr,
          customerName: selectedCustomer?.name,
          date: new Date(),
        };
        setCompletedInvoice(invoice);
        setCart([]);
        setSelectedCustomer(null);
        setIsPaymentOpen(false);
        setIsSuccessOpen(true);
      },
      onError: () => {
        toast({ variant: "destructive", title: "حدث خطأ أثناء حفظ الفاتورة" });
      }
    });
  };

  const handlePrint = () => {
    if (!completedInvoice) return;
    const printWindow = window.open("", "_blank", "width=400,height=700");
    if (!printWindow) return;

    const dateStr = completedInvoice.date.toLocaleString("ar-JO");
    const itemsHtml = completedInvoice.items.map(item => `
      <tr>
        <td style="padding:4px 8px;border-bottom:1px dashed #ddd">${item.productName}</td>
        <td style="padding:4px 8px;border-bottom:1px dashed #ddd;text-align:center">${item.quantity}</td>
        <td style="padding:4px 8px;border-bottom:1px dashed #ddd;text-align:left">${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة مشاتل القادري</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 13px; color: #111; width: 80mm; padding: 10px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 10px; }
          .header h1 { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
          .header p { font-size: 11px; color: #555; }
          .info { font-size: 11px; color: #444; margin-bottom: 10px; }
          .info span { display: block; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          thead th { background: #f4f4f4; padding: 5px 8px; text-align: right; font-size: 12px; border-bottom: 2px solid #333; }
          thead th:last-child { text-align: left; }
          .totals { border-top: 2px solid #333; padding-top: 8px; }
          .totals .row { display: flex; justify-content: space-between; padding: 3px 8px; font-size: 12px; }
          .totals .row.total { font-weight: bold; font-size: 15px; border-top: 1px dashed #333; margin-top: 5px; padding-top: 5px; }
          .footer { text-align: center; margin-top: 15px; font-size: 11px; color: #666; border-top: 1px dashed #ccc; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>مشاتل القادري</h1>
          <p>فاتورة مبيعات</p>
        </div>
        <div class="info">
          <span>التاريخ: ${dateStr}</span>
          <span>الكاشير: ${completedInvoice.cashierName}</span>
          ${completedInvoice.customerName ? `<span>الزبون: ${completedInvoice.customerName}</span>` : ""}
          <span>طريقة الدفع: ${paymentLabels[completedInvoice.paymentMethod] || completedInvoice.paymentMethod}</span>
          ${completedInvoice.id ? `<span>رقم الفاتورة: #${completedInvoice.id}</span>` : ""}
        </div>
        <table>
          <thead>
            <tr>
              <th>الصنف</th>
              <th style="text-align:center">الكمية</th>
              <th style="text-align:left">المجموع</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div class="totals">
          <div class="row"><span>المجموع الفرعي</span><span>${completedInvoice.subtotal.toFixed(2)} د.أ</span></div>
          ${completedInvoice.totalDiscount > 0 ? `<div class="row"><span>الخصم</span><span>-${completedInvoice.totalDiscount.toFixed(2)} د.أ</span></div>` : ""}
          <div class="row"><span>ضريبة 16%</span><span>${completedInvoice.tax.toFixed(2)} د.أ</span></div>
          <div class="row total"><span>الإجمالي</span><span>${completedInvoice.total.toFixed(2)} د.أ</span></div>
        </div>
        <div class="footer">شكراً لتسوقكم معنا<br>مشاتل القادري</div>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
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
                ref={searchInputRef}
                placeholder="ابحث عن منتج أو امسح الباركود..." 
                className="pl-4 pr-10 rounded-full bg-muted/50 border-none focus-visible:ring-1"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <Button variant="outline" size="icon" className="rounded-full shrink-0" title="مسح الباركود" onClick={() => searchInputRef.current?.focus()}>
              <ScanBarcode size={20} />
            </Button>
          </div>

          <Popover open={isCustomerPickerOpen} onOpenChange={setIsCustomerPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="rounded-full gap-2 shrink-0">
                <UserCircle size={18} />
                {selectedCustomer ? selectedCustomer.name : "زبون عام"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="بحث عن زبون..."
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    className="flex-1"
                  />
                  {selectedCustomer && (
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedCustomer(null); setIsCustomerPickerOpen(false); }}>
                      <X size={16} />
                    </Button>
                  )}
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  <button
                    className="w-full text-right px-3 py-2 rounded-lg hover:bg-muted text-sm"
                    onClick={() => { setSelectedCustomer(null); setIsCustomerPickerOpen(false); }}
                  >
                    زبون عام (بدون تسجيل)
                  </button>
                  {customers.map((c: any) => (
                    <button
                      key={c.id}
                      className="w-full text-right px-3 py-2 rounded-lg hover:bg-muted text-sm flex items-center justify-between"
                      onClick={() => { setSelectedCustomer(c); setIsCustomerPickerOpen(false); }}
                    >
                      <span>{c.name}</span>
                      {c.balance > 0 && <span className="text-xs text-destructive">دين: {c.balance.toFixed(2)}</span>}
                    </button>
                  ))}
                  {customers.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">لا يوجد زبائن</p>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
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
            {isLoadingProducts && (
              <div className="col-span-full text-center py-12 text-muted-foreground">جاري التحميل...</div>
            )}
            {!isLoadingProducts && filteredProducts.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <span className="text-5xl block mb-3 opacity-20">🔍</span>
                لا توجد منتجات
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Cart */}
      <div className="w-96 shrink-0 flex flex-col bg-card border-r border-border shadow-xl">
        <div className="p-4 border-b border-border bg-muted/30">
          <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
            <ShoppingBag size={20} className="text-primary" />
            سلة المشتريات
            {cart.length > 0 && (
              <span className="mr-auto bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">{cart.length}</span>
            )}
          </h2>
        </div>

        <ScrollArea className="flex-1 p-4">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 flex flex-col items-center gap-3">
              <ShoppingBag size={48} className="opacity-20" />
              <p>السلة فارغة</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.productId} className="bg-background rounded-xl p-3 border border-border/50 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-sm leading-tight flex-1 ml-2">{item.productName}</p>
                    <button onClick={() => removeItem(item.productId)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-muted rounded-lg p-0.5">
                      <button onClick={() => updateQuantity(item.productId, -1)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, 1)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      {editingPriceId === item.productId ? (
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingPriceValue}
                          onChange={e => setEditingPriceValue(e.target.value)}
                          onBlur={() => commitPrice(item.productId)}
                          onKeyDown={e => { if (e.key === "Enter") commitPrice(item.productId); if (e.key === "Escape") setEditingPriceId(null); }}
                          className="w-24 text-left font-bold text-primary text-sm border border-primary rounded-md px-2 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="السعر"
                        />
                      ) : (
                        <button
                          onClick={() => startEditingPrice(item)}
                          className={`font-bold text-sm px-2 py-0.5 rounded-md transition-colors ${item.price === 0 ? "text-destructive bg-destructive/10 border border-destructive/30" : "text-primary hover:bg-primary/10"}`}
                          title="اضغط لتعديل السعر"
                        >
                          {item.price === 0 ? "أدخل السعر" : `${item.price.toFixed(2)} د.أ`}
                        </button>
                      )}
                      {item.price > 0 && item.quantity > 1 && (
                        <span className="text-xs text-muted-foreground">{(item.price * item.quantity).toFixed(2)} د.أ</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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

          {cart.some(i => i.price === 0) && (
            <p className="text-xs text-destructive text-center mb-2">يوجد أصناف بدون سعر — اضغط على السعر لتحديده</p>
          )}
          <Button 
            className="w-full h-14 text-lg font-bold rounded-xl shadow-lg" 
            disabled={cart.length === 0 || cart.some(i => i.price === 0)}
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
                { id: "bank", label: "حوالة", icon: "🏦" },
                { id: "credit", label: "دين (آجل)", icon: "🧾" }
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

            {paymentMethod === "credit" && (
              <div className="mt-4 p-3 rounded-xl bg-muted/50 text-sm">
                {selectedCustomer ? (
                  <span>سيتم تسجيل المبلغ كدين على: <strong>{selectedCustomer.name}</strong></span>
                ) : (
                  <span className="text-destructive">يجب اختيار الزبون من الأعلى قبل الدفع بالدين</span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsPaymentOpen(false)}>
              إلغاء
            </Button>
            <Button 
              className="flex-[2] h-12 rounded-xl font-bold" 
              onClick={handleCompleteSale}
              disabled={createInvoice.isPending || (paymentMethod === "credit" && !selectedCustomer)}
            >
              {createInvoice.isPending ? "جاري الحفظ..." : "تأكيد الدفع"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success + Print Dialog */}
      <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <div className="text-center py-4">
            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-primary" />
            </div>
            <h2 className="text-2xl font-bold font-serif mb-1">تم البيع بنجاح!</h2>
            <p className="text-muted-foreground mb-2">
              المبلغ: <span className="font-bold text-primary text-lg">{completedInvoice?.total.toFixed(2)} د.أ</span>
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              طريقة الدفع: {completedInvoice ? paymentLabels[completedInvoice.paymentMethod] : ""}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsSuccessOpen(false)}>
                إغلاق
              </Button>
              <Button className="flex-1 h-12 rounded-xl gap-2" onClick={handlePrint}>
                <Printer size={18} />
                طباعة الفاتورة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
