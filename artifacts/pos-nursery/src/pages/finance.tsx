import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Plus, Trash2, ArrowDownCircle, ArrowUpCircle,
  Wallet, TrendingUp, TrendingDown, ShoppingCart, Tag,
  Building2, CheckCircle2, Clock, AlertCircle, Receipt,
  CreditCard, Banknote, Store, RefreshCw, Search, Filter,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

// ─── Types ───────────────────────────────────────────────────────────────────

type Category = {
  id: number; nameAr: string; icon: string; color: string;
  categoryType: "expense" | "income" | "both"; isDefault: boolean;
};

type FinanceTx = {
  id: number; number: string; type: "receipt" | "payment";
  amount: number; categoryId?: number | null;
  categoryName?: string | null; categoryIcon?: string | null; categoryColor?: string | null;
  description?: string | null; partyName?: string | null;
  isInCashBox: boolean; purchaseOrderId?: number | null;
  createdAt: string;
};

type PurchaseOrder = {
  id: number; number: string; supplierId?: number | null;
  displayName: string; totalAmount: number; paidAmount: number;
  remaining: number; description?: string | null;
  purchaseType: "cash" | "credit"; status: "pending" | "partial" | "paid";
  createdAt: string;
};

type StatementEntry = {
  source: string; id: string; dbId?: number; number: string;
  direction: "in" | "out"; amount: number; paidAmount?: number; remaining?: number;
  label: string; icon: string; color: string;
  description: string; categoryName?: string; isInCashBox: boolean;
  type: string; partyName?: string; purchaseOrderId?: number;
  status?: string; createdAt: string;
};

type CashBox = {
  balance: number; totalIn: number; totalOut: number;
  invoiceCash: number; receipts: number; payments: number;
};

// ─── API Helpers ─────────────────────────────────────────────────────────────

const apiFetch = async (path: string, opts?: RequestInit) => {
  const r = await fetch(`/api${path}`, { credentials: "include", ...opts });
  if (!r.ok) throw new Error(`${r.status}`);
  return r;
};

const apiJson = (path: string, opts?: RequestInit) =>
  apiFetch(path, { headers: { "Content-Type": "application/json" }, ...opts });

function useCategories() {
  return useQuery<Category[]>({
    queryKey: ["finance", "categories"],
    queryFn: () => apiFetch("/finance/categories").then(r => r.json()),
  });
}

function useTransactions() {
  return useQuery<FinanceTx[]>({
    queryKey: ["finance", "transactions"],
    queryFn: () => apiFetch("/finance/transactions").then(r => r.json()),
  });
}

function usePurchases() {
  return useQuery<PurchaseOrder[]>({
    queryKey: ["finance", "purchases"],
    queryFn: () => apiFetch("/finance/purchases").then(r => r.json()),
  });
}

function useCashBox() {
  return useQuery<CashBox>({
    queryKey: ["finance", "cash-box"],
    queryFn: () => apiFetch("/finance/cash-box").then(r => r.json()),
    refetchInterval: 30000,
  });
}

function useStatement() {
  return useQuery<{ total: number; entries: StatementEntry[] }>({
    queryKey: ["finance", "statement"],
    queryFn: () => apiFetch("/finance/statement?limit=300").then(r => r.json()),
  });
}

// ─── Utils ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") return <Badge className="bg-green-100 text-green-700 border-green-200">مدفوع ✓</Badge>;
  if (status === "partial") return <Badge className="bg-amber-100 text-amber-700 border-amber-200">جزئي ◑</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200">معلق ○</Badge>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Finance() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: cashBox, isLoading: cashLoading } = useCashBox();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [], isLoading: txLoading } = useTransactions();
  const { data: purchases = [], isLoading: poLoading } = usePurchases();
  const { data: statement, isLoading: stmtLoading } = useStatement();

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["finance"] });
  };

  // ─── Quick Transaction Dialog ─────────────────────────────────────────────
  const [txDialog, setTxDialog] = useState<{ open: boolean; type: "receipt" | "payment" }>({ open: false, type: "receipt" });
  const [txForm, setTxForm] = useState({ amount: "", categoryId: "", description: "", partyName: "", isInCashBox: true });

  const createTxMut = useMutation({
    mutationFn: (data: object) => apiJson("/finance/transactions", { method: "POST", body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => { toast({ title: "تم التسجيل بنجاح ✓" }); invalidateAll(); setTxDialog({ open: false, type: "receipt" }); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ" }),
  });

  const deleteTxMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/finance/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "تم الحذف" }); invalidateAll(); },
    onError: () => toast({ variant: "destructive", title: "فشل الحذف" }),
  });

  function openTxDialog(type: "receipt" | "payment") {
    setTxForm({ amount: "", categoryId: "", description: "", partyName: "", isInCashBox: true });
    setTxDialog({ open: true, type });
  }

  function submitTx() {
    const amt = parseFloat(txForm.amount);
    if (isNaN(amt) || amt <= 0) { toast({ variant: "destructive", title: "أدخل مبلغاً صحيحاً" }); return; }
    createTxMut.mutate({
      type: txDialog.type,
      amount: amt,
      categoryId: txForm.categoryId ? parseInt(txForm.categoryId) : null,
      description: txForm.description || null,
      partyName: txForm.partyName || null,
      isInCashBox: txForm.isInCashBox,
    });
  }

  const filteredCategories = categories.filter(c =>
    txDialog.type === "receipt" ? c.categoryType === "income" || c.categoryType === "both"
      : c.categoryType === "expense" || c.categoryType === "both"
  );

  // ─── Purchase Dialog ──────────────────────────────────────────────────────
  const [poDialog, setPoDialog] = useState(false);
  const [poForm, setPoForm] = useState({ supplierName: "", totalAmount: "", purchaseType: "cash" as "cash" | "credit", description: "" });

  const createPoMut = useMutation({
    mutationFn: (data: object) => apiJson("/finance/purchases", { method: "POST", body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => { toast({ title: "تم تسجيل الشراء ✓" }); invalidateAll(); setPoDialog(false); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ" }),
  });

  const deletePoMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/finance/purchases/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "تم الحذف" }); invalidateAll(); },
  });

  function submitPo() {
    const amt = parseFloat(poForm.totalAmount);
    if (isNaN(amt) || amt <= 0) { toast({ variant: "destructive", title: "أدخل مبلغاً صحيحاً" }); return; }
    if (!poForm.supplierName.trim()) { toast({ variant: "destructive", title: "أدخل اسم المورد" }); return; }
    createPoMut.mutate({ supplierName: poForm.supplierName, totalAmount: amt, purchaseType: poForm.purchaseType, description: poForm.description || null });
  }

  // ─── Pay Credit Purchase ──────────────────────────────────────────────────
  const [payDialog, setPayDialog] = useState<{ open: boolean; po: PurchaseOrder | null }>({ open: false, po: null });
  const [payAmount, setPayAmount] = useState("");
  const [payInBox, setPayInBox] = useState(true);

  const payPoMut = useMutation({
    mutationFn: ({ id, amount, isInCashBox }: { id: number; amount: number; isInCashBox: boolean }) =>
      apiJson(`/finance/purchases/${id}/pay`, { method: "POST", body: JSON.stringify({ amount, isInCashBox }) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => { toast({ title: "تم تسجيل الدفعة ✓" }); invalidateAll(); setPayDialog({ open: false, po: null }); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ" }),
  });

  function submitPay() {
    const amt = parseFloat(payAmount);
    if (!payDialog.po || isNaN(amt) || amt <= 0) { toast({ variant: "destructive", title: "أدخل مبلغاً صحيحاً" }); return; }
    payPoMut.mutate({ id: payDialog.po.id, amount: amt, isInCashBox: payInBox });
  }

  // ─── Category Dialog ──────────────────────────────────────────────────────
  const [catDialog, setCatDialog] = useState(false);
  const [catForm, setCatForm] = useState({ nameAr: "", icon: "💰", color: "#6b7280", categoryType: "expense" as "expense" | "income" | "both" });

  const createCatMut = useMutation({
    mutationFn: (data: object) => apiJson("/finance/categories", { method: "POST", body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => { toast({ title: "تم إضافة البند ✓" }); qc.invalidateQueries({ queryKey: ["finance", "categories"] }); setCatDialog(false); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ" }),
  });

  const deleteCatMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/finance/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "تم الحذف" }); qc.invalidateQueries({ queryKey: ["finance", "categories"] }); },
    onError: () => toast({ variant: "destructive", title: "لا يمكن حذف البند الافتراضي" }),
  });

  // ─── Statement Filter ─────────────────────────────────────────────────────
  const [stmtFilter, setStmtFilter] = useState<"all" | "in" | "out" | "credit_sale" | "credit_purchase" | "cash_sale">("all");
  const [stmtSearch, setStmtSearch] = useState("");

  const filteredEntries = useMemo(() => {
    let entries = statement?.entries ?? [];
    if (stmtFilter !== "all") entries = entries.filter(e => {
      if (stmtFilter === "in") return e.direction === "in" && e.type !== "credit_sale";
      if (stmtFilter === "out") return e.direction === "out" && e.type !== "credit_purchase";
      return e.type === stmtFilter;
    });
    if (stmtSearch) entries = entries.filter(e =>
      e.description?.includes(stmtSearch) || e.number?.includes(stmtSearch) || e.partyName?.includes(stmtSearch) || e.label?.includes(stmtSearch)
    );
    return entries;
  }, [statement?.entries, stmtFilter, stmtSearch]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
              <span className="text-3xl">💼</span> الإدارة المالية
            </h1>
            <p className="text-muted-foreground mt-1">المصاريف، الإيرادات، المشتريات، وكشف الحسابات</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => openTxDialog("receipt")} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
              <ArrowDownCircle size={18} /> قبض
            </Button>
            <Button onClick={() => openTxDialog("payment")} variant="destructive" className="gap-2">
              <ArrowUpCircle size={18} /> صرف
            </Button>
          </div>
        </div>

        {/* Cash Box Summary */}
        {cashLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : cashBox ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-5 col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 text-primary text-sm font-medium mb-2">
                <Wallet size={16} /> رصيد الصندوق
              </div>
              <p className={`text-2xl font-bold ${cashBox.balance >= 0 ? "text-primary" : "text-destructive"}`}>
                {fmt(cashBox.balance)}
              </p>
              <p className="text-xs text-muted-foreground">دينار</p>
            </div>
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium mb-2">
                <TrendingUp size={16} /> إجمالي الدخل
              </div>
              <p className="text-xl font-bold text-green-700 dark:text-green-400">{fmt(cashBox.totalIn)}</p>
              <p className="text-xs text-muted-foreground">دينار</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-medium mb-2">
                <TrendingDown size={16} /> إجمالي الصرف
              </div>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{fmt(cashBox.totalOut)}</p>
              <p className="text-xs text-muted-foreground">دينار</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-medium mb-2">
                <Store size={16} /> مبيعات الكاشير
              </div>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{fmt(cashBox.invoiceCash)}</p>
              <p className="text-xs text-muted-foreground">دينار</p>
            </div>
          </div>
        ) : null}

        {/* Tabs */}
        <Tabs defaultValue="statement" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 bg-muted/50 rounded-xl h-auto p-1">
            <TabsTrigger value="statement" className="gap-2 rounded-lg py-2.5">
              <Receipt size={16} /> كشف الحسابات
            </TabsTrigger>
            <TabsTrigger value="cashbox" className="gap-2 rounded-lg py-2.5">
              <Wallet size={16} /> الصندوق
            </TabsTrigger>
            <TabsTrigger value="purchases" className="gap-2 rounded-lg py-2.5">
              <ShoppingCart size={16} /> المشتريات
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2 rounded-lg py-2.5">
              <Tag size={16} /> البنود
            </TabsTrigger>
          </TabsList>

          {/* ── STATEMENT TAB ────────────────────────────────────────────── */}
          <TabsContent value="statement" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  className="pr-9"
                  placeholder="بحث في الحركات..."
                  value={stmtSearch}
                  onChange={e => setStmtSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { key: "all", label: "الكل", icon: "📋" },
                  { key: "in", label: "نقدي داخل", icon: "💵" },
                  { key: "cash_sale", label: "بيع نقدي", icon: "🛍️" },
                  { key: "credit_sale", label: "بيع آجل", icon: "🔄" },
                  { key: "out", label: "صرف نقدي", icon: "💸" },
                  { key: "credit_purchase", label: "شراء آجل", icon: "🏭" },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setStmtFilter(f.key)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium flex items-center gap-1 ${
                      stmtFilter === f.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {f.icon} {f.label}
                  </button>
                ))}
              </div>
            </div>

            {stmtLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={28} /></div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Receipt className="mx-auto mb-3 opacity-30" size={48} />
                <p>لا توجد حركات مالية</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{filteredEntries.length} حركة</p>
                {filteredEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-colors"
                  >
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ backgroundColor: entry.color + "20" }}
                    >
                      {entry.icon}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{entry.label}</span>
                        {entry.categoryName && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                            {entry.categoryName}
                          </span>
                        )}
                        {entry.type === "credit_purchase" && entry.status && <StatusBadge status={entry.status} />}
                        {!entry.isInCashBox && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">خارج الصندوق</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.description}</p>
                      <p className="text-xs text-muted-foreground/60">{entry.number} • {format(new Date(entry.createdAt), "dd/MM/yyyy hh:mm a", { locale: ar })}</p>
                    </div>
                    {/* Amount */}
                    <div className="text-left flex-shrink-0">
                      <p className={`text-base font-bold ${entry.direction === "in" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {entry.direction === "in" ? "+" : "-"}{fmt(entry.amount)}
                      </p>
                      {entry.type === "credit_purchase" && entry.remaining !== undefined && entry.remaining > 0 && (
                        <p className="text-xs text-amber-600">متبقي {fmt(entry.remaining)}</p>
                      )}
                      <p className="text-xs text-muted-foreground/60">دينار</p>
                    </div>
                    {/* Delete (only for manual transactions) */}
                    {entry.source === "transaction" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                        onClick={() => deleteTxMut.mutate(entry.dbId!)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── CASH BOX TAB ─────────────────────────────────────────────── */}
          <TabsContent value="cashbox" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Quick Actions */}
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Banknote size={20} className="text-primary" /> حركات الصندوق
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => openTxDialog("receipt")} className="gap-2 bg-green-600 hover:bg-green-700 text-white h-16 flex-col text-base">
                    <ArrowDownCircle size={22} />
                    قبض
                  </Button>
                  <Button onClick={() => openTxDialog("payment")} variant="destructive" className="gap-2 h-16 flex-col text-base">
                    <ArrowUpCircle size={22} />
                    صرف
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  يمكنك تحديد هل الحركة داخل الصندوق أو خارجه عند التسجيل
                </p>
              </div>
              {/* Cash Breakdown */}
              <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Wallet size={20} className="text-primary" /> تفاصيل الرصيد
                </h3>
                {cashBox && (
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground flex items-center gap-2"><Store size={14} /> مبيعات الكاشير</span>
                      <span className="font-medium text-green-600">+{fmt(cashBox.invoiceCash)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground flex items-center gap-2"><ArrowDownCircle size={14} /> قبض يدوي</span>
                      <span className="font-medium text-green-600">+{fmt(cashBox.receipts)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground flex items-center gap-2"><ArrowUpCircle size={14} /> صرف</span>
                      <span className="font-medium text-red-600">-{fmt(cashBox.payments)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 bg-primary/5 rounded-xl px-3">
                      <span className="font-semibold flex items-center gap-2"><Wallet size={15} /> الرصيد الحالي</span>
                      <span className={`text-lg font-bold ${cashBox.balance >= 0 ? "text-primary" : "text-destructive"}`}>
                        {fmt(cashBox.balance)} د
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Cash Transactions */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <RefreshCw size={16} className="text-muted-foreground" /> آخر الحركات اليدوية
              </h3>
              {txLoading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div> : (
                <div className="space-y-2">
                  {transactions.slice(0, 15).map(tx => (
                    <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
                      <span className="text-xl w-8 text-center">{tx.categoryIcon ?? (tx.type === "receipt" ? "💚" : "💸")}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{tx.categoryName ?? (tx.type === "receipt" ? "قبض" : "صرف")}</p>
                        <p className="text-xs text-muted-foreground truncate">{tx.description ?? tx.partyName ?? tx.number}</p>
                      </div>
                      <div className="text-left">
                        <p className={`text-sm font-bold ${tx.type === "receipt" ? "text-green-600" : "text-red-600"}`}>
                          {tx.type === "receipt" ? "+" : "-"}{fmt(tx.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">{format(new Date(tx.createdAt), "dd/MM/yyyy")}</p>
                      </div>
                      {!tx.isInCashBox && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">خارج</span>}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteTxMut.mutate(tx.id)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <p className="text-center py-8 text-muted-foreground text-sm">لا توجد حركات يدوية بعد</p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── PURCHASES TAB ────────────────────────────────────────────── */}
          <TabsContent value="purchases" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">
                  {purchases.filter(p => p.purchaseType === "credit" && p.status !== "paid").length} مشتريات آجلة معلقة
                </p>
              </div>
              <Button onClick={() => { setPoForm({ supplierName: "", totalAmount: "", purchaseType: "cash", description: "" }); setPoDialog(true); }} className="gap-2">
                <Plus size={16} /> شراء جديد
              </Button>
            </div>

            {/* Summary */}
            {purchases.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">إجمالي المشتريات</p>
                  <p className="text-lg font-bold">{fmt(purchases.reduce((s, p) => s + p.totalAmount, 0))}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">المدفوع</p>
                  <p className="text-lg font-bold text-green-600">{fmt(purchases.reduce((s, p) => s + p.paidAmount, 0))}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">المتبقي (آجل)</p>
                  <p className="text-lg font-bold text-red-600">{fmt(purchases.filter(p => p.purchaseType === "credit").reduce((s, p) => s + p.remaining, 0))}</p>
                </div>
              </div>
            )}

            {poLoading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={28} /></div> : purchases.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShoppingCart className="mx-auto mb-3 opacity-30" size={48} />
                <p>لا توجد مشتريات مسجلة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {purchases.map(po => (
                  <div key={po.id} className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${po.purchaseType === "cash" ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
                          {po.purchaseType === "cash" ? "💵" : "🏭"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{po.displayName}</span>
                            <StatusBadge status={po.status} />
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${po.purchaseType === "cash" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                              {po.purchaseType === "cash" ? "نقدي" : "آجل"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {po.number} • {format(new Date(po.createdAt), "dd/MM/yyyy")}
                            {po.description && ` • ${po.description}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">الإجمالي</p>
                          <p className="font-bold">{fmt(po.totalAmount)}</p>
                        </div>
                        {po.purchaseType === "credit" && (
                          <>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">المدفوع</p>
                              <p className="font-bold text-green-600">{fmt(po.paidAmount)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">المتبقي</p>
                              <p className={`font-bold ${po.remaining > 0 ? "text-red-600" : "text-green-600"}`}>{fmt(po.remaining)}</p>
                            </div>
                          </>
                        )}
                        <div className="flex gap-2">
                          {po.purchaseType === "credit" && po.status !== "paid" && (
                            <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => { setPayAmount(""); setPayInBox(true); setPayDialog({ open: true, po }); }}>
                              <CreditCard size={14} /> دفع
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deletePoMut.mutate(po.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── CATEGORIES TAB ───────────────────────────────────────────── */}
          <TabsContent value="categories" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{categories.length} بند مسجل</p>
              <Button onClick={() => { setCatForm({ nameAr: "", icon: "💰", color: "#6b7280", categoryType: "expense" }); setCatDialog(true); }} className="gap-2">
                <Plus size={16} /> بند جديد
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {categories.map(cat => (
                <div
                  key={cat.id}
                  className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-primary/30 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: cat.color + "20" }}>
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{cat.nameAr}</p>
                    <p className="text-xs text-muted-foreground">
                      {cat.categoryType === "expense" ? "📤 صرف" : cat.categoryType === "income" ? "📥 قبض" : "🔄 كلاهما"}
                    </p>
                  </div>
                  {!cat.isDefault && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 flex-shrink-0"
                      onClick={() => deleteCatMut.mutate(cat.id)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Transaction Dialog ──────────────────────────────────────────────── */}
      <Dialog open={txDialog.open} onOpenChange={open => setTxDialog(d => ({ ...d, open }))}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              {txDialog.type === "receipt"
                ? <><ArrowDownCircle size={20} className="text-green-600" /> تسجيل قبض</>
                : <><ArrowUpCircle size={20} className="text-red-600" /> تسجيل صرف</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>المبلغ (دينار) *</Label>
              <Input type="number" min="0.01" step="0.01" dir="ltr" placeholder="0.00" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>البند</Label>
              <Select value={txForm.categoryId} onValueChange={v => setTxForm(f => ({ ...f, categoryId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر البند..." /></SelectTrigger>
                <SelectContent>
                  {filteredCategories.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.icon} {c.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الجهة / البيان</Label>
              <Input placeholder="مثال: محمد الموظف، فاتورة كهرباء..." value={txForm.partyName} onChange={e => setTxForm(f => ({ ...f, partyName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>ملاحظة (اختياري)</Label>
              <Input placeholder="تفاصيل إضافية..." value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
              <button
                type="button"
                onClick={() => setTxForm(f => ({ ...f, isInCashBox: !f.isInCashBox }))}
                className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${txForm.isInCashBox ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 shadow ${txForm.isInCashBox ? "translate-x-5" : "translate-x-0"}`} />
              </button>
              <div>
                <p className="text-sm font-medium">{txForm.isInCashBox ? "داخل الصندوق" : "خارج الصندوق"}</p>
                <p className="text-xs text-muted-foreground">{txForm.isInCashBox ? "يؤثر على رصيد الصندوق" : "للتوثيق فقط - لا يؤثر على رصيد الصندوق"}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setTxDialog(d => ({ ...d, open: false }))}>إلغاء</Button>
              <Button
                className={`flex-1 ${txDialog.type === "receipt" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} text-white`}
                onClick={submitTx}
                disabled={createTxMut.isPending}
              >
                {createTxMut.isPending && <Loader2 className="animate-spin ml-2" size={15} />}
                {txDialog.type === "receipt" ? "تسجيل قبض" : "تسجيل صرف"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Purchase Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={poDialog} onOpenChange={setPoDialog}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShoppingCart size={20} className="text-primary" /> شراء جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPoForm(f => ({ ...f, purchaseType: "cash" }))}
                className={`py-3 rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${poForm.purchaseType === "cash" ? "border-green-500 bg-green-50 text-green-700" : "border-border text-muted-foreground"}`}
              >
                💵 شراء نقدي
              </button>
              <button
                onClick={() => setPoForm(f => ({ ...f, purchaseType: "credit" }))}
                className={`py-3 rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${poForm.purchaseType === "credit" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-border text-muted-foreground"}`}
              >
                🏭 شراء آجل
              </button>
            </div>
            <div className="space-y-2">
              <Label>اسم المورد *</Label>
              <Input placeholder="مثال: شركة الخير للأسمدة" value={poForm.supplierName} onChange={e => setPoForm(f => ({ ...f, supplierName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>المبلغ الإجمالي (دينار) *</Label>
              <Input type="number" min="0.01" step="0.01" dir="ltr" placeholder="0.00" value={poForm.totalAmount} onChange={e => setPoForm(f => ({ ...f, totalAmount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>ملاحظة (اختياري)</Label>
              <Input placeholder="وصف المشتريات..." value={poForm.description} onChange={e => setPoForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            {poForm.purchaseType === "cash" && (
              <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-3 text-sm text-green-700 dark:text-green-400">
                💵 سيتم خصم المبلغ من الصندوق تلقائياً
              </div>
            )}
            {poForm.purchaseType === "credit" && (
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 text-sm text-amber-700 dark:text-amber-400">
                🏭 شراء بالأجل — يمكنك تسجيل الدفعات لاحقاً من قائمة المشتريات
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setPoDialog(false)}>إلغاء</Button>
              <Button className="flex-1" onClick={submitPo} disabled={createPoMut.isPending}>
                {createPoMut.isPending && <Loader2 className="animate-spin ml-2" size={15} />}
                تسجيل الشراء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Pay Credit Purchase Dialog ──────────────────────────────────────── */}
      <Dialog open={payDialog.open} onOpenChange={open => setPayDialog(d => ({ ...d, open }))}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard size={20} className="text-amber-600" /> تسجيل دفعة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {payDialog.po && (
              <div className="bg-muted/40 rounded-xl p-3 text-sm space-y-1">
                <p className="font-medium">{payDialog.po.displayName}</p>
                <p className="text-muted-foreground">المتبقي: <span className="text-red-600 font-bold">{fmt(payDialog.po.remaining)} دينار</span></p>
              </div>
            )}
            <div className="space-y-2">
              <Label>مبلغ الدفعة (دينار)</Label>
              <Input type="number" min="0.01" step="0.01" dir="ltr" placeholder="0.00" value={payAmount} onChange={e => setPayAmount(e.target.value)} autoFocus />
            </div>
            <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
              <button
                type="button"
                onClick={() => setPayInBox(!payInBox)}
                className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${payInBox ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 shadow ${payInBox ? "translate-x-5" : "translate-x-0"}`} />
              </button>
              <p className="text-sm">{payInBox ? "من الصندوق" : "خارج الصندوق"}</p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setPayDialog({ open: false, po: null })}>إلغاء</Button>
              <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={submitPay} disabled={payPoMut.isPending}>
                {payPoMut.isPending && <Loader2 className="animate-spin ml-2" size={15} />}
                تسجيل الدفعة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Category Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tag size={20} className="text-primary" /> بند جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>اسم البند *</Label>
              <Input placeholder="مثال: مصاريف السيارة" value={catForm.nameAr} onChange={e => setCatForm(f => ({ ...f, nameAr: e.target.value }))} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>الأيقونة (إيموجي)</Label>
                <Input placeholder="💰" value={catForm.icon} onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>اللون</Label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))} className="h-10 w-10 rounded cursor-pointer border border-border" />
                  <Input value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))} dir="ltr" className="text-xs" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>النوع</Label>
              <Select value={catForm.categoryType} onValueChange={v => setCatForm(f => ({ ...f, categoryType: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">📤 صرف (مصاريف)</SelectItem>
                  <SelectItem value="income">📥 قبض (إيرادات)</SelectItem>
                  <SelectItem value="both">🔄 كلاهما</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {catForm.nameAr && catForm.icon && (
              <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: catForm.color + "20" }}>
                  {catForm.icon}
                </div>
                <p className="font-medium">{catForm.nameAr}</p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCatDialog(false)}>إلغاء</Button>
              <Button className="flex-1" onClick={() => createCatMut.mutate(catForm)} disabled={createCatMut.isPending || !catForm.nameAr.trim()}>
                {createCatMut.isPending && <Loader2 className="animate-spin ml-2" size={15} />}
                إضافة البند
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
