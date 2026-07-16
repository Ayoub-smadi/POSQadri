import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, ShoppingBag, Receipt, DollarSign, TrendingUp, AlertCircle,
  ChevronRight, ChevronLeft, CalendarDays, ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addDays, isToday, isTomorrow } from "date-fns";
import { ar } from "date-fns/locale";

// ── helpers ──────────────────────────────────────────────────────────────────

const toYMD = (d: Date) => format(d, "yyyy-MM-dd");
const todayYMD = () => toYMD(new Date());

function dayLabel(d: Date) {
  if (isToday(d)) return "اليوم";
  // check yesterday manually
  const diff = Math.round((new Date().setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000);
  if (diff === 1) return "أمس";
  if (isTomorrow(d)) return "غداً";
  return format(d, "EEEE", { locale: ar });
}

function payMethodLabel(m: string) {
  const map: Record<string, string> = {
    cash: "نقداً", visa: "فيزا", cliq: "كليك", bank: "تحويل", credit: "آجل", split: "مقسّم",
  };
  return map[m] ?? m;
}

function payMethodColor(m: string) {
  const map: Record<string, string> = {
    cash: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    visa: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    cliq: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    bank: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    credit: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    split: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  };
  return map[m] ?? "bg-muted text-muted-foreground";
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [date, setDate] = useState<Date>(() => new Date());

  const dateStr = toYMD(date);
  const isFuture = date > new Date();

  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary", dateStr],
    queryFn: () =>
      fetch(`/api/dashboard/summary?date=${dateStr}`, { credentials: "include" })
        .then((r) => r.json()),
  });

  const prevDay = () => setDate((d) => addDays(d, -1));
  const nextDay = () => setDate((d) => addDays(d, 1));
  const goToday = () => setDate(new Date());

  const statCards = summary
    ? [
        { title: `مبيعات ${dayLabel(new Date(dateStr))}`, value: `${summary.todaySales.toFixed(2)} د.أ`, icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
        { title: "أرباح اليوم", value: `${summary.todayProfit.toFixed(2)} د.أ`, icon: TrendingUp, color: "text-accent", bg: "bg-accent/10" },
        { title: "فواتير اليوم", value: summary.dayInvoiceCount ?? 0, icon: Receipt, color: "text-blue-500", bg: "bg-blue-500/10" },
        { title: "إجمالي العملاء", value: summary.customerCount, icon: Users, color: "text-purple-500", bg: "bg-purple-500/10" },
      ]
    : [];

  const dayInvoices: any[] = summary?.recentTransactions ?? [];
  const dayTxs: any[] = summary?.dayTransactions ?? [];

  const dayTotal = dayInvoices.reduce((s: number, i: any) => s + i.total, 0);
  const txIn  = dayTxs.filter((t: any) => t.type === "receipt").reduce((s: number, t: any) => s + t.amount, 0);
  const txOut = dayTxs.filter((t: any) => t.type === "payment").reduce((s: number, t: any) => s + t.amount, 0);

  return (
    <Layout>
      <div className="space-y-6">

        {/* ── Day navigator ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">اليومية</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">مبيعات وحركات كل يوم</p>
          </div>

          <div className="flex items-center gap-2 bg-card border border-border rounded-2xl p-1 shadow-sm">
            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" onClick={prevDay}>
              <ChevronRight size={18} />
            </Button>

            <div className="text-center min-w-[130px]">
              <p className="font-semibold text-sm leading-tight">
                {dayLabel(new Date(dateStr + "T12:00:00"))}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(dateStr + "T12:00:00"), "dd MMMM yyyy", { locale: ar })}
              </p>
            </div>

            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" onClick={nextDay} disabled={!isFuture && isToday(date)}>
              <ChevronLeft size={18} />
            </Button>

            {/* Date picker input */}
            <input
              type="date"
              value={dateStr}
              max={todayYMD()}
              onChange={(e) => e.target.value && setDate(new Date(e.target.value + "T12:00:00"))}
              className="sr-only"
              id="date-picker"
            />
            <label
              htmlFor="date-picker"
              className="h-9 w-9 rounded-xl flex items-center justify-center cursor-pointer hover:bg-accent transition-colors"
              title="اختر تاريخ"
            >
              <CalendarDays size={16} className="text-muted-foreground" />
            </label>

            {!isToday(date) && (
              <Button size="sm" variant="outline" className="h-9 rounded-xl text-xs px-3" onClick={goToday}>
                اليوم
              </Button>
            )}
          </div>
        </div>

        {/* ── Stat cards ── */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <Card key={i} className="border-none shadow-sm">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${stat.bg} ${stat.color}`}>
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground leading-tight">{stat.title}</p>
                      <h3 className="text-xl font-bold mt-0.5 truncate">{stat.value}</h3>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Main two columns ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Invoices of the day */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="text-primary" size={18} />
                  فواتير اليوم
                </div>
                {!isLoading && (
                  <span className="text-sm font-normal text-primary">
                    {dayTotal.toFixed(2)} د.أ
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
              ) : dayInvoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">لا توجد فواتير في هذا اليوم</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {dayInvoices.map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2.5 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground font-mono shrink-0">{inv.number}</span>
                        <span className="truncate text-muted-foreground">{inv.customerName ?? "عميل عام"}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${payMethodColor(inv.paymentMethod)}`}>
                          {payMethodLabel(inv.paymentMethod)}
                        </span>
                        <span className="font-bold text-primary">{Number(inv.total).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Financial movements of the day */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="text-emerald-600" size={18} />
                  حركات الخزينة
                </div>
                {!isLoading && dayTxs.length > 0 && (
                  <div className="text-xs font-normal flex gap-2">
                    <span className="text-green-600">+{txIn.toFixed(2)}</span>
                    <span className="text-red-500">-{txOut.toFixed(2)}</span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
              ) : dayTxs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">لا توجد حركات مالية في هذا اليوم</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {dayTxs.map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2.5 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        {tx.type === "receipt" ? (
                          <ArrowUpCircle size={15} className="text-green-600 shrink-0" />
                        ) : (
                          <ArrowDownCircle size={15} className="text-red-500 shrink-0" />
                        )}
                        <span className="text-base shrink-0">{tx.categoryIcon ?? ""}</span>
                        <div className="min-w-0">
                          <p className="truncate leading-tight">{tx.description ?? tx.categoryName ?? "—"}</p>
                          {tx.partyName && <p className="text-xs text-muted-foreground truncate">{tx.partyName}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!tx.isInCashBox && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">خارج الخزينة</span>
                        )}
                        <span className={`font-bold ${tx.type === "receipt" ? "text-green-600" : "text-red-500"}`}>
                          {tx.type === "receipt" ? "+" : "-"}{tx.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Bottom row: top products + low stock ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif flex items-center gap-2 text-base">
                <ShoppingBag className="text-primary" size={18} />
                الأكثر مبيعاً {!isToday(date) ? `(${format(new Date(dateStr + "T12:00:00"), "dd/MM", { locale: ar })})` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>
              ) : (summary?.topProducts ?? []).length === 0 ? (
                <p className="text-center text-muted-foreground py-6 text-sm">لا توجد مبيعات في هذا اليوم</p>
              ) : (
                <div className="space-y-3">
                  {(summary?.topProducts ?? []).map((product: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30">
                      <div className="h-10 w-10 rounded-lg bg-card border flex items-center justify-center overflow-hidden shrink-0">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-muted-foreground text-xs">🌿</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{product.nameAr}</p>
                        <p className="text-xs text-muted-foreground">{product.totalSold} وحدة</p>
                      </div>
                      <div className="font-bold text-primary text-sm">{product.totalRevenue.toFixed(2)} د.أ</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif flex items-center gap-2 text-base text-destructive">
                <AlertCircle size={18} />
                تنبيهات المخزون
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-12" />)}</div>
              ) : (summary?.lowStockProducts ?? []).length === 0 ? (
                <p className="text-center text-muted-foreground py-6 text-sm">المخزون بحالة جيدة ✓</p>
              ) : (
                <div className="space-y-2">
                  {(summary?.lowStockProducts ?? []).map((product: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-destructive/20 bg-destructive/5">
                      <span className="font-medium text-sm">{product.nameAr}</span>
                      <span className="font-bold text-destructive px-2 py-1 bg-destructive/10 rounded-md text-sm">
                        {product.quantity} متبقي
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
