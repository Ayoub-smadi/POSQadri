import { useState, useMemo, useEffect, useRef } from "react";
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
  Loader2, Plus, Trash2, Pencil, ArrowDownCircle, ArrowUpCircle,
  Wallet, TrendingUp, TrendingDown, Tag, RefreshCw, Search,
  ShoppingCart, CreditCard, BookOpen, ClipboardList, CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

// ─── API ──────────────────────────────────────────────────────────────────────

const apiFetch = async (path: string, opts?: RequestInit) => {
  const r = await fetch(`/api${path}`, { credentials: "include", ...opts });
  if (!r.ok) throw new Error(`${r.status}`);
  return r;
};
const apiJson = (path: string, opts?: RequestInit) =>
  apiFetch(path, { headers: { "Content-Type": "application/json" }, ...opts });

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = { id: number; nameAr: string; icon: string; color: string; categoryType: "expense" | "income" | "both"; isDefault: boolean };
type TxRow = {
  id: number; number: string; type: "receipt" | "payment";
  amount: number; categoryId?: number | null; categoryName?: string | null;
  categoryIcon?: string | null; categoryColor?: string | null;
  description?: string | null; partyName?: string | null;
  isInCashBox: boolean; purchaseOrderId?: number | null; createdAt: string;
};
type TreasuryRow = {
  id: string; dbId: number; number: string; rowNum: number;
  in: number; out: number; balance: number;
  category: string; reference: string; account: string;
  description: string; type: string; createdAt: string;
};
type TreasuryData = {
  openingBalance: number; netPeriod: number; closingBalance: number;
  totalIn: number; totalOut: number; rows: TreasuryRow[];
};
type AccountStmtRow = {
  id: string; dbId: number; number: string; rowNum: number;
  debit: number; credit: number; balance: number;
  description: string; type: string; source: string; createdAt: string;
};
type AccountStatement = {
  account: string; openingBalance: number;
  totalDebit: number; totalCredit: number; closingBalance: number;
  rows: AccountStmtRow[];
};
type PurchaseOrder = {
  id: number; number: string; displayName: string;
  totalAmount: number; paidAmount: number; remaining: number;
  purchaseType: "cash" | "credit"; status: "pending" | "partial" | "paid";
  description?: string | null; createdAt: string;
};

// ─── Utils ────────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const todayStr = () => format(new Date(), "yyyy-MM-dd");

function DateInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
      <Input type="date" value={value} onChange={e => onChange(e.target.value)} className="h-8 text-xs w-36" dir="ltr" />
    </div>
  );
}

function BalanceCard({ label, value, color }: { label: string; value: number; color: "green" | "yellow" | "blue" | "red" }) {
  const cls = {
    green:  "bg-green-600 text-white",
    yellow: "bg-amber-500 text-white",
    blue:   "bg-blue-600 text-white",
    red:    "bg-red-600 text-white",
  }[color];
  return (
    <div className={`rounded-lg px-5 py-3 min-w-[150px] ${cls}`}>
      <p className="text-xs opacity-90 mb-0.5">{label}</p>
      <p className="text-2xl font-bold">{fmt(value)}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid")    return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">مدفوع</Badge>;
  if (status === "partial") return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">جزئي</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">معلق</Badge>;
}

// ─── Autocomplete Input ───────────────────────────────────────────────────────

function AccountInput({ value, onChange, accounts, placeholder }: { value: string; onChange: (v: string) => void; accounts: string[]; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = accounts.filter(a => a.includes(value) && a !== value).slice(0, 10);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? "اسم الحساب..."}
        className="h-8 text-sm"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(a => (
            <div key={a} className="px-3 py-2 text-sm hover:bg-accent cursor-pointer" onClick={() => { onChange(a); setOpen(false); }}>
              {a}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Finance() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mainTab, setMainTab] = useState("treasury");

  const inv = () => qc.invalidateQueries({ queryKey: ["finance"] });

  // ─── Shared state ─────────────────────────────────────────────────────────
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["finance", "categories"],
    queryFn: () => apiFetch("/finance/categories").then(r => r.json()),
  });
  const { data: accounts = [] } = useQuery<string[]>({
    queryKey: ["finance", "accounts"],
    queryFn: () => apiFetch("/finance/accounts").then(r => r.json()),
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 1 — حركة الخزينة
  // ═══════════════════════════════════════════════════════════════════════════
  const [tFrom, setTFrom] = useState(todayStr);
  const [tTo,   setTTo]   = useState(todayStr);
  const [tSearch, setTSearch] = useState("");
  const [tSubTab, setTSubTab] = useState<"movements" | "summary">("movements");
  const [selectedRow, setSelectedRow] = useState<TreasuryRow | null>(null);

  const { data: treasury, isLoading: tLoading, refetch: tRefetch } = useQuery<TreasuryData>({
    queryKey: ["finance", "treasury", tFrom, tTo, tSearch],
    queryFn: () => apiFetch(`/finance/treasury?from=${tFrom}&to=${tTo}&search=${encodeURIComponent(tSearch)}`).then(r => r.json()),
  });

  // ─── Transaction dialog (قبض / صرف) ──────────────────────────────────────
  const [txDlg, setTxDlg] = useState<{ open: boolean; mode: "create" | "edit"; type: "receipt" | "payment"; row?: TreasuryRow }>({ open: false, mode: "create", type: "receipt" });
  const [txF, setTxF] = useState({ amount: "", categoryId: "", description: "", partyName: "", isInCashBox: true });

  function openTxDlg(type: "receipt" | "payment", row?: TreasuryRow) {
    if (row && row.type !== "invoice") {
      setTxF({ amount: String(row.out || row.in), categoryId: "", description: row.description, partyName: row.account, isInCashBox: true });
      setTxDlg({ open: true, mode: "edit", type: row.type as any, row });
    } else {
      setTxF({ amount: "", categoryId: "", description: "", partyName: "", isInCashBox: true });
      setTxDlg({ open: true, mode: "create", type });
    }
  }

  const createTxMut = useMutation({
    mutationFn: (d: object) => apiJson("/finance/transactions", { method: "POST", body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم التسجيل ✓" }); inv(); setTxDlg(d => ({ ...d, open: false })); setSelectedRow(null); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ" }),
  });
  const editTxMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: object }) => apiJson(`/finance/transactions/${id}`, { method: "PUT", body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم التعديل ✓" }); inv(); setTxDlg(d => ({ ...d, open: false })); setSelectedRow(null); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ" }),
  });
  const deleteTxMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/finance/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "تم الحذف" }); inv(); setSelectedRow(null); },
    onError: () => toast({ variant: "destructive", title: "لا يمكن الحذف" }),
  });

  function submitTx() {
    const amt = parseFloat(txF.amount);
    if (isNaN(amt) || amt <= 0) { toast({ variant: "destructive", title: "أدخل مبلغاً صحيحاً" }); return; }
    const payload = { type: txDlg.type, amount: amt, categoryId: txF.categoryId ? parseInt(txF.categoryId) : null, description: txF.description || null, partyName: txF.partyName || null, isInCashBox: txF.isInCashBox };
    if (txDlg.mode === "edit" && txDlg.row) {
      editTxMut.mutate({ id: txDlg.row.dbId, d: payload });
    } else {
      createTxMut.mutate(payload);
    }
  }

  const filteredCats = categories.filter(c =>
    txDlg.type === "receipt" ? c.categoryType === "income" || c.categoryType === "both"
      : c.categoryType === "expense" || c.categoryType === "both"
  );

  // Summary breakdown
  const summaryData = useMemo(() => {
    if (!treasury) return { topExpenses: [], topReceipts: [] };
    const expMap = new Map<string, number>();
    const recMap = new Map<string, number>();
    for (const r of treasury.rows) {
      if (r.out > 0) expMap.set(r.category, (expMap.get(r.category) ?? 0) + r.out);
      if (r.in  > 0) recMap.set(r.category, (recMap.get(r.category) ?? 0) + r.in);
    }
    return {
      topExpenses: [...expMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      topReceipts: [...recMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
  }, [treasury]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 2 — اليومية (Daily Entry)
  // ═══════════════════════════════════════════════════════════════════════════
  const [dType, setDType] = useState<"receipt" | "payment">("payment");
  const [dAmt, setDAmt] = useState("");
  const [dAccount, setDAccount] = useState("");
  const [dCat, setDCat] = useState("");
  const [dNotes, setDNotes] = useState("");
  const [dInBox, setDInBox] = useState(true);

  const { data: daily } = useQuery<TreasuryData>({
    queryKey: ["finance", "treasury", todayStr(), todayStr(), ""],
    queryFn: () => apiFetch(`/finance/treasury?from=${todayStr()}&to=${todayStr()}`).then(r => r.json()),
    refetchInterval: 5000,
  });

  const dailyCreateMut = useMutation({
    mutationFn: (d: object) => apiJson("/finance/transactions", { method: "POST", body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "تم الحفظ ✓" });
      inv();
      setDAmt(""); setDAccount(""); setDCat(""); setDNotes("");
    },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ" }),
  });

  function submitDaily() {
    const amt = parseFloat(dAmt);
    if (isNaN(amt) || amt <= 0) { toast({ variant: "destructive", title: "أدخل مبلغاً صحيحاً" }); return; }
    dailyCreateMut.mutate({ type: dType, amount: amt, categoryId: dCat ? parseInt(dCat) : null, description: dNotes || null, partyName: dAccount || null, isInCashBox: dInBox });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 3 — كشف الحساب
  // ═══════════════════════════════════════════════════════════════════════════
  const [stmtAccount, setStmtAccount] = useState("");
  const [stmtFrom, setStmtFrom] = useState(() => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"));
  const [stmtTo,   setStmtTo]   = useState(todayStr);
  const [stmtQuery, setStmtQuery] = useState<{ account: string; from: string; to: string } | null>(null);

  const { data: stmt, isLoading: stmtLoading } = useQuery<AccountStatement>({
    queryKey: ["finance", "account-statement", stmtQuery?.account, stmtQuery?.from, stmtQuery?.to],
    queryFn: () => apiFetch(`/finance/account-statement?account=${encodeURIComponent(stmtQuery!.account)}&from=${stmtQuery!.from}&to=${stmtQuery!.to}`).then(r => r.json()),
    enabled: !!stmtQuery,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 4 — المشتريات
  // ═══════════════════════════════════════════════════════════════════════════
  const { data: purchases = [], isLoading: poLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["finance", "purchases"],
    queryFn: () => apiFetch("/finance/purchases").then(r => r.json()),
  });

  const [poDlg, setPoDlg] = useState(false);
  const [poF, setPoF] = useState({ supplierName: "", totalAmount: "", purchaseType: "cash" as "cash" | "credit", description: "", date: todayStr() });

  const createPoMut = useMutation({
    mutationFn: (d: object) => apiJson("/finance/purchases", { method: "POST", body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم ✓" }); inv(); setPoDlg(false); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ" }),
  });
  const deletePoMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/finance/purchases/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "تم الحذف" }); inv(); },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // بيع — Daily Sales Quick Entry
  // ═══════════════════════════════════════════════════════════════════════════
  const [sellDlg, setSellDlg] = useState(false);
  const [sellF, setSellF] = useState({ date: todayStr(), amount: "", note: "", saleType: "cash" as "cash" | "credit", account: "" });

  const salesCategoryId = useMemo(
    () => categories.find(c => c.nameAr === "مبيعات")?.id ?? null,
    [categories]
  );

  const createSaleMut = useMutation({
    mutationFn: (d: object) => apiJson("/finance/transactions", { method: "POST", body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم تسجيل البيع ✓" }); inv(); setSellDlg(false); setSellF({ date: todayStr(), amount: "", note: "", saleType: "cash", account: "" }); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ" }),
  });

  const createCustomerFromSaleMut = useMutation({
    mutationFn: (name: string) => apiJson("/customers", { method: "POST", body: JSON.stringify({ name, balance: 0 }) }).then(r => r.json()),
    onSuccess: (data: any) => {
      setSellF(f => ({ ...f, account: data.name }));
      qc.invalidateQueries({ queryKey: ["finance", "accounts"] });
      toast({ title: `تم إضافة الحساب: ${data.name} ✓` });
    },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ أثناء إضافة الحساب" }),
  });

  function submitSale() {
    const amt = parseFloat(sellF.amount);
    if (isNaN(amt) || amt <= 0) { toast({ variant: "destructive", title: "أدخل مبلغاً صحيحاً" }); return; }
    if (sellF.saleType === "credit" && !sellF.account.trim()) {
      toast({ variant: "destructive", title: "اختر حساباً للبيع الآجل" }); return;
    }
    createSaleMut.mutate({
      type: "receipt",
      amount: amt,
      categoryId: salesCategoryId,
      description: sellF.note || (sellF.saleType === "credit" ? `مبيعات آجل — ${sellF.account}` : `مبيعات يوم ${sellF.date}`),
      isInCashBox: sellF.saleType === "cash",
      partyName: sellF.account.trim() || null,
      createdAt: new Date(`${sellF.date}T12:00:00`).toISOString(),
    });
  }

  const [payDlg, setPayDlg] = useState<{ open: boolean; po: PurchaseOrder | null }>({ open: false, po: null });
  const [payAmt, setPayAmt] = useState("");
  const [payInBox, setPayInBox] = useState(true);

  const payPoMut = useMutation({
    mutationFn: ({ id, a, b }: { id: number; a: number; b: boolean }) =>
      apiJson(`/finance/purchases/${id}/pay`, { method: "POST", body: JSON.stringify({ amount: a, isInCashBox: b }) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم ✓" }); inv(); setPayDlg({ open: false, po: null }); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ" }),
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 5 — البنود
  // ═══════════════════════════════════════════════════════════════════════════
  const [catDlg, setCatDlg] = useState(false);
  const [catF, setCatF] = useState({ nameAr: "", icon: "💰", color: "#6b7280", categoryType: "expense" as "expense" | "income" | "both" });

  const createCatMut = useMutation({
    mutationFn: (d: object) => apiJson("/finance/categories", { method: "POST", body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم ✓" }); qc.invalidateQueries({ queryKey: ["finance", "categories"] }); setCatDlg(false); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ" }),
  });
  const deleteCatMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/finance/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "categories"] }),
    onError: () => toast({ variant: "destructive", title: "لا يمكن حذف البند الافتراضي" }),
  });

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="space-y-4">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <span className="text-3xl">📊</span>
              <span>ايوب محاسبة</span>
            </h1>
            <p className="text-muted-foreground text-sm">نظام محاسبي متكامل — الخزينة، الحسابات، المشتريات</p>
          </div>
          <div className="text-left text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
            <p className="font-medium">الرصيد الحالي</p>
            <p className={`text-xl font-bold ${(treasury?.closingBalance ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
              {fmt(treasury?.closingBalance)} د
            </p>
          </div>
        </div>

        {/* ── Main Tabs ── */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-0">
          <TabsList className="w-full justify-start bg-muted/40 rounded-xl h-auto p-1 gap-1 flex-wrap">
            <TabsTrigger value="treasury" className="gap-2 rounded-lg py-2 px-4 text-sm">
              <Wallet size={15} /> حركة الخزينة
            </TabsTrigger>
            <TabsTrigger value="daily" className="gap-2 rounded-lg py-2 px-4 text-sm">
              <ClipboardList size={15} /> إدخال اليومية
            </TabsTrigger>
            <TabsTrigger value="statement" className="gap-2 rounded-lg py-2 px-4 text-sm">
              <BookOpen size={15} /> كشف الحساب
            </TabsTrigger>
            <TabsTrigger value="purchases" className="gap-2 rounded-lg py-2 px-4 text-sm">
              <ShoppingCart size={15} /> المشتريات
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2 rounded-lg py-2 px-4 text-sm">
              <Tag size={15} /> البنود
            </TabsTrigger>
          </TabsList>

          {/* ════════════════════════════════════════════════════════════════
              TAB 1 — حركة الخزينة
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="treasury" className="mt-3 space-y-3">
            {/* Balance Cards + Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <BalanceCard label="رصيد الخزينة الحالي" value={treasury?.closingBalance ?? 0} color="green" />
              <BalanceCard label="صافي حركة الفترة" value={treasury?.netPeriod ?? 0} color="yellow" />
              <BalanceCard label="إجمالي الوارد" value={treasury?.totalIn ?? 0} color="blue" />
              <BalanceCard label="إجمالي الصرف" value={treasury?.totalOut ?? 0} color="red" />
            </div>

            {/* Filters + Actions bar */}
            <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-3 items-center">
                <DateInput label="من" value={tFrom} onChange={setTFrom} />
                <DateInput label="إلى" value={tTo}   onChange={setTTo} />
                <div className="relative">
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <Input className="h-8 text-sm pr-8 w-44" placeholder="بحث..." value={tSearch} onChange={e => setTSearch(e.target.value)} />
                </div>
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => { tRefetch(); setSelectedRow(null); }}>
                  <RefreshCw size={13} /> تحديث
                </Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white" onClick={() => openTxDlg("receipt")}>
                  <ArrowDownCircle size={14} /> قبض
                </Button>
                <Button size="sm" className="h-8 gap-1.5 bg-red-600 hover:bg-red-700 text-white" onClick={() => openTxDlg("payment")}>
                  <ArrowUpCircle size={14} /> صرف
                </Button>
                {selectedRow && selectedRow.type !== "invoice" && (
                  <>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 border-blue-500 text-blue-600 hover:bg-blue-50" onClick={() => openTxDlg(selectedRow.type as any, selectedRow)}>
                      <Pencil size={13} /> تعديل
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 border-red-400 text-red-600 hover:bg-red-50" onClick={() => deleteTxMut.mutate(selectedRow.dbId)}>
                      <Trash2 size={13} /> حذف
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 border-b border-border">
              <button onClick={() => setTSubTab("movements")} className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${tSubTab === "movements" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                حركات
              </button>
              <button onClick={() => setTSubTab("summary")} className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${tSubTab === "summary" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                ملخص
              </button>
            </div>

            {/* ── Movements Table ── */}
            {tSubTab === "movements" && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {tLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={28} /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-green-700 text-white">
                          {["#","الحركة","التاريخ","الوقت","وارد","منصرف","الرصيد","البند","رقم المرجع","الحساب"].map(h => (
                            <th key={h} className="px-3 py-2.5 text-center font-semibold text-xs whitespace-nowrap border-l border-green-600 last:border-0">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Opening balance row */}
                        <tr className="bg-green-50 dark:bg-green-900/20 border-b border-border">
                          <td className="px-3 py-2 text-center text-xs text-muted-foreground">—</td>
                          <td className="px-3 py-2 text-center font-medium text-green-700 dark:text-green-400 text-xs">رصيد سابق</td>
                          <td className="px-3 py-2 text-center text-xs">{tFrom}</td>
                          <td className="px-3 py-2 text-center text-xs">—</td>
                          <td className="px-3 py-2 text-center text-green-600 font-bold text-sm">{treasury?.openingBalance && treasury.openingBalance > 0 ? fmt(treasury.openingBalance) : ""}</td>
                          <td className="px-3 py-2 text-center text-red-600 font-bold text-sm">{treasury?.openingBalance && treasury.openingBalance < 0 ? fmt(Math.abs(treasury.openingBalance)) : ""}</td>
                          <td className="px-3 py-2 text-center font-bold text-sm">{fmt(treasury?.openingBalance)}</td>
                          <td colSpan={3} className="px-3 py-2 text-center text-xs text-muted-foreground"></td>
                        </tr>

                        {/* Movement rows */}
                        {(treasury?.rows ?? []).map(row => {
                          const isSelected = selectedRow?.id === row.id;
                          const d = new Date(row.createdAt);
                          return (
                            <tr
                              key={row.id}
                              onClick={() => setSelectedRow(isSelected ? null : row)}
                              className={`border-b border-border/50 cursor-pointer transition-colors ${isSelected ? "bg-primary/10 border-primary/30" : "hover:bg-muted/40"} ${row.type === "invoice" ? "opacity-85" : ""}`}
                            >
                              <td className="px-3 py-2 text-center text-xs text-muted-foreground">{row.rowNum}</td>
                              <td className="px-3 py-2 text-center text-xs">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${row.type === "receipt" ? "bg-green-100 text-green-700" : row.type === "invoice" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                                  {row.type === "receipt" ? "قبض" : row.type === "invoice" ? "بيع" : "صرف"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center text-xs" dir="ltr">{format(d, "dd/MM/yyyy")}</td>
                              <td className="px-3 py-2 text-center text-xs" dir="ltr">{format(d, "hh:mm a")}</td>
                              <td className="px-3 py-2 text-center font-semibold text-green-600 dark:text-green-400 text-sm">
                                {row.in > 0 ? fmt(row.in) : ""}
                              </td>
                              <td className="px-3 py-2 text-center font-semibold text-red-600 dark:text-red-400 text-sm">
                                {row.out > 0 ? fmt(row.out) : ""}
                              </td>
                              <td className={`px-3 py-2 text-center font-bold text-sm ${row.balance >= 0 ? "text-foreground" : "text-red-600"}`}>
                                {fmt(row.balance)}
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-muted-foreground max-w-[120px] truncate">{row.category}</td>
                              <td className="px-3 py-2 text-center text-xs text-muted-foreground" dir="ltr">{row.reference}</td>
                              <td className="px-3 py-2 text-center text-xs max-w-[120px] truncate">{row.account}</td>
                            </tr>
                          );
                        })}

                        {(treasury?.rows?.length ?? 0) === 0 && (
                          <tr><td colSpan={10} className="py-12 text-center text-muted-foreground text-sm">لا توجد حركات في هذه الفترة</td></tr>
                        )}

                        {/* Totals row */}
                        {(treasury?.rows?.length ?? 0) > 0 && (
                          <tr className="bg-green-700 text-white font-bold">
                            <td colSpan={4} className="px-3 py-2.5 text-center text-xs">المجموع</td>
                            <td className="px-3 py-2.5 text-center text-sm">{fmt(treasury?.totalIn)}</td>
                            <td className="px-3 py-2.5 text-center text-sm">{fmt(treasury?.totalOut)}</td>
                            <td className="px-3 py-2.5 text-center text-sm">{fmt(treasury?.closingBalance)}</td>
                            <td colSpan={3}></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Summary ── */}
            {tSubTab === "summary" && (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Expenses breakdown */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-600">
                    <TrendingDown size={16} /> تحليل المصروفات
                  </h3>
                  {summaryData.topExpenses.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">لا توجد مصروفات في هذه الفترة</p>
                  ) : (
                    <div className="space-y-2">
                      {summaryData.topExpenses.map(([cat, amt]) => {
                        const pct = treasury?.totalOut ? (amt / treasury.totalOut) * 100 : 0;
                        return (
                          <div key={cat}>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{cat}</span>
                              <span className="font-semibold text-red-600">{fmt(amt)}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2 border-t border-border flex justify-between font-bold">
                        <span>الإجمالي</span>
                        <span className="text-red-600">{fmt(treasury?.totalOut)}</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* Receipts breakdown */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-600">
                    <TrendingUp size={16} /> تحليل المقبوضات
                  </h3>
                  {summaryData.topReceipts.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">لا توجد إيرادات في هذه الفترة</p>
                  ) : (
                    <div className="space-y-2">
                      {summaryData.topReceipts.map(([cat, amt]) => {
                        const pct = treasury?.totalIn ? (amt / treasury.totalIn) * 100 : 0;
                        return (
                          <div key={cat}>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{cat}</span>
                              <span className="font-semibold text-green-600">{fmt(amt)}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2 border-t border-border flex justify-between font-bold">
                        <span>الإجمالي</span>
                        <span className="text-green-600">{fmt(treasury?.totalIn)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════
              TAB 2 — إدخال اليومية
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="daily" className="mt-3">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Entry Form */}
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <ClipboardList size={18} className="text-primary" /> إدخال حركة الخزينة
                </h3>

                {/* نوع الحركة */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDType("payment")}
                    className={`py-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center gap-1 ${dType === "payment" ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700" : "border-border text-muted-foreground"}`}
                  >
                    <ArrowUpCircle size={20} /> صرف
                  </button>
                  <button
                    onClick={() => setDType("receipt")}
                    className={`py-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center gap-1 ${dType === "receipt" ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700" : "border-border text-muted-foreground"}`}
                  >
                    <ArrowDownCircle size={20} /> قبض
                  </button>
                </div>

                {/* بيع / شراء — quick shortcuts */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setSellF({ date: todayStr(), amount: "", note: "" }); setSellDlg(true); }}
                    className="py-3 rounded-xl border-2 border-border text-sm font-bold transition-all flex flex-col items-center gap-1 text-muted-foreground hover:border-green-500 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-900/20"
                  >
                    <ShoppingCart size={20} /> بيع
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMainTab("purchases"); setPoDlg(true); }}
                    className="py-3 rounded-xl border-2 border-border text-sm font-bold transition-all flex flex-col items-center gap-1 text-muted-foreground hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/20"
                  >
                    <CreditCard size={20} /> شراء
                  </button>
                </div>

                {/* المبلغ */}
                <div className="space-y-1.5">
                  <Label className="text-sm">المبلغ (دينار) *</Label>
                  <Input
                    type="number" min="0.01" step="0.01" dir="ltr"
                    placeholder="0.00" value={dAmt}
                    onChange={e => setDAmt(e.target.value)}
                    className="text-lg font-bold h-11"
                    autoFocus
                  />
                </div>

                {/* الحساب */}
                <div className="space-y-1.5">
                  <Label className="text-sm">الحساب / الجهة</Label>
                  <AccountInput value={dAccount} onChange={setDAccount} accounts={accounts} placeholder="اسم الموظف، المورد..." />
                </div>

                {/* البند */}
                <div className="space-y-1.5">
                  <Label className="text-sm">بند المصروف / الإيراد</Label>
                  <Select value={dCat} onValueChange={setDCat}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="اختر البند..." /></SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => dType === "receipt" ? c.categoryType !== "expense" : c.categoryType !== "income").map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.icon} {c.nameAr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* ملاحظات */}
                <div className="space-y-1.5">
                  <Label className="text-sm">ملاحظات</Label>
                  <Input placeholder="ملاحظات اختيارية..." value={dNotes} onChange={e => setDNotes(e.target.value)} className="h-8 text-sm" />
                </div>

                {/* داخل الصندوق */}
                <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
                  <button
                    type="button" onClick={() => setDInBox(!dInBox)}
                    className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative ${dInBox ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow ${dInBox ? "right-0.5" : "left-0.5"}`} />
                  </button>
                  <span className="text-sm">{dInBox ? "داخل الصندوق" : "خارج الصندوق"}</span>
                </div>

                <Button
                  className={`w-full h-11 font-bold text-base ${dType === "receipt" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} text-white`}
                  onClick={submitDaily}
                  disabled={dailyCreateMut.isPending}
                >
                  {dailyCreateMut.isPending && <Loader2 className="animate-spin ml-2" size={16} />}
                  {dType === "receipt" ? "حفظ قبض" : "حفظ صرف"}
                </Button>
              </div>

              {/* Daily Summary + Table */}
              <div className="md:col-span-2 space-y-3">
                {/* Day summary cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-amber-500 text-white rounded-xl p-4 text-center">
                    <p className="text-xs opacity-90 mb-1">رصيد بداية اليوم</p>
                    <p className="text-xl font-bold">{fmt(daily?.openingBalance)}</p>
                  </div>
                  <div className="bg-blue-600 text-white rounded-xl p-4 text-center">
                    <p className="text-xs opacity-90 mb-1">صافي حركة الخزينة</p>
                    <p className="text-xl font-bold">{fmt(daily?.netPeriod)}</p>
                  </div>
                  <div className="bg-green-600 text-white rounded-xl p-4 text-center">
                    <p className="text-xs opacity-90 mb-1">رصيد نهاية اليوم</p>
                    <p className="text-xl font-bold">{fmt(daily?.closingBalance)}</p>
                  </div>
                </div>

                {/* Today's table */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="bg-green-700 text-white px-4 py-2 text-sm font-semibold">
                    حركات اليوم — {format(new Date(), "dd/MM/yyyy", { locale: ar })}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border">
                          {["الحركة","وارد","منصرف","الرصيد","الحساب","البند","الوقت"].map(h => (
                            <th key={h} className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(daily?.rows ?? []).map(row => (
                          <tr key={row.id} className="border-b border-border/40 hover:bg-muted/30">
                            <td className="px-3 py-2 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${row.type === "receipt" ? "bg-green-100 text-green-700" : row.type === "invoice" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                                {row.type === "receipt" ? "قبض" : row.type === "invoice" ? "بيع" : "صرف"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center font-semibold text-green-600 text-sm">{row.in > 0 ? fmt(row.in) : ""}</td>
                            <td className="px-3 py-2 text-center font-semibold text-red-600 text-sm">{row.out > 0 ? fmt(row.out) : ""}</td>
                            <td className="px-3 py-2 text-center font-bold text-sm">{fmt(row.balance)}</td>
                            <td className="px-3 py-2 text-center text-xs text-muted-foreground max-w-[100px] truncate">{row.account}</td>
                            <td className="px-3 py-2 text-center text-xs text-muted-foreground max-w-[100px] truncate">{row.category}</td>
                            <td className="px-3 py-2 text-center text-xs" dir="ltr">{format(new Date(row.createdAt), "hh:mm a")}</td>
                          </tr>
                        ))}
                        {(daily?.rows?.length ?? 0) === 0 && (
                          <tr><td colSpan={7} className="py-10 text-center text-muted-foreground text-sm">لا توجد حركات اليوم</td></tr>
                        )}
                      </tbody>
                      {(daily?.rows?.length ?? 0) > 0 && (
                        <tfoot>
                          <tr className="bg-green-700 text-white font-bold">
                            <td className="px-3 py-2 text-center text-xs">المجموع</td>
                            <td className="px-3 py-2 text-center text-sm">{fmt(daily?.totalIn)}</td>
                            <td className="px-3 py-2 text-center text-sm">{fmt(daily?.totalOut)}</td>
                            <td className="px-3 py-2 text-center text-sm">{fmt(daily?.closingBalance)}</td>
                            <td colSpan={3}></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════
              TAB 3 — كشف الحساب
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="statement" className="mt-3 space-y-4">
            {/* Search bar */}
            <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <Label className="text-sm font-semibold">اختر الحساب</Label>
                <AccountInput value={stmtAccount} onChange={setStmtAccount} accounts={accounts} placeholder="ابحث عن حساب (موظف، عميل، مورد...)"/>
              </div>
              <DateInput label="من" value={stmtFrom} onChange={setStmtFrom} />
              <DateInput label="إلى" value={stmtTo}   onChange={setStmtTo} />
              <Button
                className="gap-2 h-9"
                onClick={() => setStmtQuery({ account: stmtAccount, from: stmtFrom, to: stmtTo })}
                disabled={!stmtAccount.trim()}
              >
                <Search size={15} /> عرض التقرير
              </Button>
            </div>

            {/* Common accounts quick select */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground self-center">حسابات سريعة:</span>
              {accounts.slice(0, 12).map(a => (
                <button key={a} onClick={() => { setStmtAccount(a); setStmtQuery({ account: a, from: stmtFrom, to: stmtTo }); }}
                  className="text-xs px-3 py-1.5 bg-muted hover:bg-primary/10 hover:text-primary rounded-full border border-border transition-colors">
                  {a}
                </button>
              ))}
            </div>

            {/* Account balance card */}
            {stmt && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">رصيد بداية الفترة</p>
                  <p className={`text-lg font-bold ${stmt.openingBalance >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(stmt.openingBalance)}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">عليه (مدين)</p>
                  <p className="text-lg font-bold text-red-600">{fmt(stmt.totalDebit)}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">له (دائن)</p>
                  <p className="text-lg font-bold text-green-600">{fmt(stmt.totalCredit)}</p>
                </div>
                <div className={`${stmt.closingBalance >= 0 ? "bg-green-600" : "bg-red-600"} text-white rounded-xl p-4 text-center`}>
                  <p className="text-xs opacity-90 mb-1">رصيد الحساب</p>
                  <p className="text-lg font-bold">{fmt(stmt.closingBalance)}</p>
                </div>
              </div>
            )}

            {/* Statement table */}
            {stmtLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={28} /></div>
            ) : !stmtQuery ? (
              <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-muted-foreground">
                <BookOpen className="mx-auto mb-3 opacity-30" size={48} />
                <p>اختر حساباً وانقر "عرض التقرير" لعرض كشف الحساب</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="bg-green-700 text-white px-4 py-2 flex justify-between items-center">
                  <span className="font-semibold text-sm">كشف حساب: {stmt?.account}</span>
                  <span className="text-xs opacity-80">{stmtFrom} — {stmtTo}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        {["#","التاريخ","الوقت","الحركة","عليه","له","الرصيد","رقم الحركة","ملاحظات"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Opening row */}
                      <tr className="bg-green-50 dark:bg-green-900/20 border-b border-border">
                        <td className="px-3 py-2 text-center text-xs text-muted-foreground">—</td>
                        <td className="px-3 py-2 text-center text-xs">{stmtFrom}</td>
                        <td className="px-3 py-2 text-center text-xs">—</td>
                        <td className="px-3 py-2 text-center font-medium text-green-700 dark:text-green-400 text-xs">رصيد سابق</td>
                        <td colSpan={2}></td>
                        <td className="px-3 py-2 text-center font-bold text-sm">{fmt(stmt?.openingBalance)}</td>
                        <td colSpan={2}></td>
                      </tr>

                      {(stmt?.rows ?? []).map(row => {
                        const d = new Date(row.createdAt);
                        return (
                          <tr key={row.id} className="border-b border-border/40 hover:bg-muted/30">
                            <td className="px-3 py-2 text-center text-xs text-muted-foreground">{row.rowNum}</td>
                            <td className="px-3 py-2 text-center text-xs" dir="ltr">{format(d, "dd/MM/yyyy")}</td>
                            <td className="px-3 py-2 text-center text-xs" dir="ltr">{format(d, "hh:mm a")}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${row.type === "invoice" ? "bg-blue-100 text-blue-700" : row.type === "receipt" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {row.type === "invoice" ? "فاتورة" : row.type === "receipt" ? "قبض" : "صرف"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center font-semibold text-red-600 text-sm">{row.debit > 0 ? fmt(row.debit) : ""}</td>
                            <td className="px-3 py-2 text-center font-semibold text-green-600 text-sm">{row.credit > 0 ? fmt(row.credit) : ""}</td>
                            <td className={`px-3 py-2 text-center font-bold text-sm ${row.balance >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>{fmt(row.balance)}</td>
                            <td className="px-3 py-2 text-center text-xs text-muted-foreground" dir="ltr">{row.number}</td>
                            <td className="px-3 py-2 text-center text-xs text-muted-foreground max-w-[150px] truncate">{row.description}</td>
                          </tr>
                        );
                      })}

                      {(stmt?.rows?.length ?? 0) === 0 && (
                        <tr><td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">لا توجد حركات لهذا الحساب في الفترة المحددة</td></tr>
                      )}
                    </tbody>
                    {(stmt?.rows?.length ?? 0) > 0 && (
                      <tfoot>
                        <tr className="bg-green-700 text-white font-bold">
                          <td colSpan={4} className="px-3 py-2.5 text-center text-xs">المجموع</td>
                          <td className="px-3 py-2.5 text-center text-sm">{fmt(stmt?.totalDebit)}</td>
                          <td className="px-3 py-2.5 text-center text-sm">{fmt(stmt?.totalCredit)}</td>
                          <td className="px-3 py-2.5 text-center text-sm">{fmt(stmt?.closingBalance)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════
              TAB 4 — المشتريات
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="purchases" className="mt-3 space-y-4">
            <div className="flex justify-between items-center">
              <div className="grid grid-cols-3 gap-3 flex-1 ml-4">
                <div className="bg-card border rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">إجمالي المشتريات</p>
                  <p className="text-lg font-bold">{fmt(purchases.reduce((s,p)=>s+p.totalAmount,0))}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">المدفوع</p>
                  <p className="text-lg font-bold text-green-600">{fmt(purchases.reduce((s,p)=>s+p.paidAmount,0))}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">المتبقي (آجل)</p>
                  <p className="text-lg font-bold text-red-600">{fmt(purchases.filter(p=>p.purchaseType==="credit").reduce((s,p)=>s+p.remaining,0))}</p>
                </div>
              </div>
              <Button onClick={() => { setPoF({ supplierName: "", totalAmount: "", purchaseType: "cash", description: "", date: todayStr() }); setPoDlg(true); }} className="gap-2 h-10">
                <Plus size={15} /> شراء جديد
              </Button>
            </div>

            {poLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={28} /></div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-green-700 text-white">
                      {["المورد","التاريخ","النوع","الإجمالي","المدفوع","المتبقي","الحالة","إجراء"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-center text-xs font-semibold border-l border-green-600 last:border-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map(po => (
                      <tr key={po.id} className="border-b border-border/40 hover:bg-muted/30">
                        <td className="px-3 py-2.5 text-center font-medium">{po.displayName}</td>
                        <td className="px-3 py-2.5 text-center text-xs" dir="ltr">{format(new Date(po.createdAt), "dd/MM/yyyy")}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${po.purchaseType === "cash" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                            {po.purchaseType === "cash" ? "نقدي" : "آجل"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-sm">{fmt(po.totalAmount)}</td>
                        <td className="px-3 py-2.5 text-center font-semibold text-green-600 text-sm">{fmt(po.paidAmount)}</td>
                        <td className="px-3 py-2.5 text-center font-semibold text-red-600 text-sm">{po.remaining > 0 ? fmt(po.remaining) : <CheckCircle2 size={16} className="text-green-500 mx-auto" />}</td>
                        <td className="px-3 py-2.5 text-center"><StatusBadge status={po.status} /></td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {po.purchaseType === "credit" && po.status !== "paid" && (
                              <Button size="sm" className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => { setPayAmt(""); setPayInBox(true); setPayDlg({ open: true, po }); }}>
                                <CreditCard size={11} /> دفع
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deletePoMut.mutate(po.id)}>
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {purchases.length === 0 && (
                      <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">لا توجد مشتريات مسجلة</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════
              TAB 5 — البنود
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="categories" className="mt-3 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{categories.length} بند مسجل</p>
              <Button onClick={() => { setCatF({ nameAr: "", icon: "💰", color: "#6b7280", categoryType: "expense" }); setCatDlg(true); }} className="gap-2 h-9">
                <Plus size={15} /> بند جديد
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {categories.map(cat => (
                <div key={cat.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 hover:border-primary/30 transition-colors group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: cat.color + "20" }}>
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{cat.nameAr}</p>
                    <p className="text-xs text-muted-foreground">{cat.categoryType === "expense" ? "📤 صرف" : cat.categoryType === "income" ? "📥 قبض" : "🔄 كلاهما"}</p>
                  </div>
                  {!cat.isDefault && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => deleteCatMut.mutate(cat.id)}>
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Quick Transaction Dialog ─────────────────────────────────────────── */}
      <Dialog open={txDlg.open} onOpenChange={open => setTxDlg(d => ({ ...d, open }))}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              {txDlg.type === "receipt"
                ? <><ArrowDownCircle size={20} className="text-green-600" /> {txDlg.mode === "edit" ? "تعديل قبض" : "تسجيل قبض"}</>
                : <><ArrowUpCircle size={20} className="text-red-600" /> {txDlg.mode === "edit" ? "تعديل صرف" : "تسجيل صرف"}</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>المبلغ (دينار) *</Label>
              <Input type="number" min="0.01" step="0.01" dir="ltr" placeholder="0.00" value={txF.amount} onChange={e => setTxF(f => ({ ...f, amount: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>الحساب / الجهة</Label>
              <AccountInput value={txF.partyName} onChange={v => setTxF(f => ({ ...f, partyName: v }))} accounts={accounts} />
            </div>
            <div className="space-y-1.5">
              <Label>البند</Label>
              <Select value={txF.categoryId} onValueChange={v => setTxF(f => ({ ...f, categoryId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر البند..." /></SelectTrigger>
                <SelectContent>
                  {filteredCats.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.icon} {c.nameAr}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظة</Label>
              <Input placeholder="تفاصيل إضافية..." value={txF.description} onChange={e => setTxF(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
              <button type="button" onClick={() => setTxF(f => ({ ...f, isInCashBox: !f.isInCashBox }))}
                className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative ${txF.isInCashBox ? "bg-primary" : "bg-muted-foreground/30"}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow ${txF.isInCashBox ? "right-0.5" : "left-0.5"}`} />
              </button>
              <span className="text-sm">{txF.isInCashBox ? "داخل الصندوق" : "خارج الصندوق"}</span>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setTxDlg(d => ({ ...d, open: false }))}>إلغاء</Button>
              <Button
                className={`flex-1 text-white ${txDlg.type === "receipt" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                onClick={submitTx}
                disabled={createTxMut.isPending || editTxMut.isPending}
              >
                {(createTxMut.isPending || editTxMut.isPending) && <Loader2 className="animate-spin ml-2" size={15} />}
                {txDlg.mode === "edit" ? "حفظ التعديل" : txDlg.type === "receipt" ? "تسجيل قبض" : "تسجيل صرف"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Purchase Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={poDlg} onOpenChange={setPoDlg}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShoppingCart size={20} className="text-primary" /> شراء جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPoF(f => ({ ...f, purchaseType: "cash" }))}
                className={`py-3 rounded-xl border-2 text-sm font-medium flex items-center justify-center gap-2 transition-all ${poF.purchaseType === "cash" ? "border-green-500 bg-green-50 text-green-700" : "border-border text-muted-foreground"}`}>
                💵 نقدي
              </button>
              <button onClick={() => setPoF(f => ({ ...f, purchaseType: "credit" }))}
                className={`py-3 rounded-xl border-2 text-sm font-medium flex items-center justify-center gap-2 transition-all ${poF.purchaseType === "credit" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-border text-muted-foreground"}`}>
                🏭 آجل
              </button>
            </div>
            <div className="space-y-1.5">
              <Label>اسم المورد *</Label>
              <AccountInput value={poF.supplierName} onChange={v => setPoF(f => ({ ...f, supplierName: v }))} accounts={accounts} placeholder="مثال: شركة الخير للأسمدة" />
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ الإجمالي *</Label>
              <Input type="number" min="0.01" step="0.01" dir="ltr" placeholder="0.00" value={poF.totalAmount} onChange={e => setPoF(f => ({ ...f, totalAmount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظة</Label>
              <Input placeholder="وصف المشتريات..." value={poF.description} onChange={e => setPoF(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input type="date" dir="ltr" value={poF.date} onChange={e => setPoF(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setPoDlg(false)}>إلغاء</Button>
              <Button className="flex-1" onClick={() => {
                const amt = parseFloat(poF.totalAmount);
                if (isNaN(amt) || amt <= 0) { toast({ variant: "destructive", title: "أدخل مبلغاً صحيحاً" }); return; }
                if (!poF.supplierName.trim()) { toast({ variant: "destructive", title: "أدخل اسم المورد" }); return; }
                createPoMut.mutate({ supplierName: poF.supplierName, totalAmount: amt, purchaseType: poF.purchaseType, description: poF.description || null, createdAt: new Date(`${poF.date}T12:00:00`).toISOString() });
              }} disabled={createPoMut.isPending}>
                {createPoMut.isPending && <Loader2 className="animate-spin ml-2" size={15} />} تسجيل
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Daily Sale Dialog ────────────────────────────────────────────────── */}
      <Dialog open={sellDlg} onOpenChange={setSellDlg}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShoppingCart size={20} className="text-green-600" /> بيع (إجمالي مبيعات اليوم)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">سجّل إجمالي ما تم بيعه في يوم معيّن، ليظهر في حركة الخزينة كإيراد.</p>

            {/* نوع البيع: نقدي / آجل */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSellF(f => ({ ...f, saleType: "cash" }))}
                className={`py-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center gap-1 ${sellF.saleType === "cash" ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700" : "border-border text-muted-foreground"}`}
              >
                💵 نقدي
              </button>
              <button
                onClick={() => setSellF(f => ({ ...f, saleType: "credit" }))}
                className={`py-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center gap-1 ${sellF.saleType === "credit" ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700" : "border-border text-muted-foreground"}`}
              >
                🧾 آجل
              </button>
            </div>

            {/* الحساب — يظهر دائماً، إلزامي عند الآجل */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                الحساب {sellF.saleType === "credit" && <span className="text-destructive">*</span>}
              </Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <AccountInput
                    value={sellF.account}
                    onChange={v => setSellF(f => ({ ...f, account: v }))}
                    accounts={accounts}
                    placeholder={sellF.saleType === "credit" ? "اختر أو أدخل اسم العميل..." : "اختياري..."}
                  />
                </div>
                {/* زر إضافة حساب جديد إذا ما موجود */}
                {sellF.account.trim() && !accounts.includes(sellF.account.trim()) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 px-3 text-xs border-primary text-primary hover:bg-primary/10 whitespace-nowrap"
                    onClick={() => createCustomerFromSaleMut.mutate(sellF.account.trim())}
                    disabled={createCustomerFromSaleMut.isPending}
                  >
                    {createCustomerFromSaleMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    إضافة
                  </Button>
                )}
              </div>
              {sellF.account.trim() && !accounts.includes(sellF.account.trim()) && (
                <p className="text-xs text-amber-600">الحساب غير موجود — اضغط "إضافة" لإنشائه كعميل جديد</p>
              )}
              {sellF.saleType === "credit" && (
                <p className="text-xs text-muted-foreground">البيع الآجل لن يُسجَّل في الخزينة حتى يُسدَّد الدين</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input type="date" dir="ltr" value={sellF.date} onChange={e => setSellF(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ (دينار) *</Label>
              <Input
                type="number" min="0.01" step="0.01" dir="ltr"
                placeholder="0.00" value={sellF.amount}
                onChange={e => setSellF(f => ({ ...f, amount: e.target.value }))}
                className="text-lg font-bold h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظة (اختياري)</Label>
              <Input placeholder="مثال: مبيعات نقدية..." value={sellF.note} onChange={e => setSellF(f => ({ ...f, note: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setSellDlg(false)}>إلغاء</Button>
              <Button
                className={`flex-1 text-white ${sellF.saleType === "credit" ? "bg-amber-600 hover:bg-amber-700" : "bg-green-600 hover:bg-green-700"}`}
                onClick={submitSale}
                disabled={createSaleMut.isPending || !sellF.amount || (sellF.saleType === "credit" && !sellF.account.trim())}
              >
                {createSaleMut.isPending && <Loader2 className="animate-spin ml-2" size={15} />}
                {sellF.saleType === "credit" ? "تسجيل بيع آجل" : "تسجيل البيع"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Pay Purchase Dialog ──────────────────────────────────────────────── */}
      <Dialog open={payDlg.open} onOpenChange={open => setPayDlg(d => ({ ...d, open }))}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard size={20} className="text-amber-600" /> تسجيل دفعة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {payDlg.po && (
              <div className="bg-muted/40 rounded-xl p-3 text-sm">
                <p className="font-medium">{payDlg.po.displayName}</p>
                <p className="text-muted-foreground">المتبقي: <span className="text-red-600 font-bold">{fmt(payDlg.po.remaining)} دينار</span></p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>مبلغ الدفعة</Label>
              <Input type="number" min="0.01" step="0.01" dir="ltr" placeholder="0.00" value={payAmt} onChange={e => setPayAmt(e.target.value)} autoFocus />
            </div>
            <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
              <button type="button" onClick={() => setPayInBox(!payInBox)}
                className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative ${payInBox ? "bg-primary" : "bg-muted-foreground/30"}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow ${payInBox ? "right-0.5" : "left-0.5"}`} />
              </button>
              <span className="text-sm">{payInBox ? "من الصندوق" : "خارج الصندوق"}</span>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setPayDlg({ open: false, po: null })}>إلغاء</Button>
              <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => {
                const a = parseFloat(payAmt);
                if (!payDlg.po || isNaN(a) || a <= 0) { toast({ variant: "destructive", title: "أدخل مبلغاً صحيحاً" }); return; }
                payPoMut.mutate({ id: payDlg.po.id, a, b: payInBox });
              }} disabled={payPoMut.isPending}>
                {payPoMut.isPending && <Loader2 className="animate-spin ml-2" size={15} />} تسجيل الدفعة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Category Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={catDlg} onOpenChange={setCatDlg}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tag size={20} className="text-primary" /> بند جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>اسم البند *</Label>
              <Input placeholder="مثال: مصاريف السيارة" value={catF.nameAr} onChange={e => setCatF(f => ({ ...f, nameAr: e.target.value }))} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>الأيقونة (إيموجي)</Label>
                <Input placeholder="💰" value={catF.icon} onChange={e => setCatF(f => ({ ...f, icon: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>اللون</Label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={catF.color} onChange={e => setCatF(f => ({ ...f, color: e.target.value }))} className="h-9 w-9 rounded cursor-pointer border border-border" />
                  <Input value={catF.color} onChange={e => setCatF(f => ({ ...f, color: e.target.value }))} dir="ltr" className="text-xs" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select value={catF.categoryType} onValueChange={v => setCatF(f => ({ ...f, categoryType: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">📤 صرف (مصاريف)</SelectItem>
                  <SelectItem value="income">📥 قبض (إيرادات)</SelectItem>
                  <SelectItem value="both">🔄 كلاهما</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {catF.nameAr && (
              <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: catF.color + "20" }}>{catF.icon}</div>
                <p className="font-medium">{catF.nameAr}</p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCatDlg(false)}>إلغاء</Button>
              <Button className="flex-1" onClick={() => createCatMut.mutate(catF)} disabled={createCatMut.isPending || !catF.nameAr.trim()}>
                {createCatMut.isPending && <Loader2 className="animate-spin ml-2" size={15} />} إضافة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
