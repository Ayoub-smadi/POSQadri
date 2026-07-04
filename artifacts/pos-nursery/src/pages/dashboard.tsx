import { Layout } from "@/components/layout";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ShoppingBag, Receipt, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();

  if (isLoading || !summary) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </Layout>
    );
  }

  const statCards = [
    { title: "مبيعات اليوم", value: `${summary.todaySales.toFixed(2)} د.أ`, icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
    { title: "أرباح اليوم", value: `${summary.todayProfit.toFixed(2)} د.أ`, icon: TrendingUp, color: "text-accent", bg: "bg-accent/10" },
    { title: "فواتير اليوم", value: summary.invoiceCount, icon: Receipt, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "العملاء", value: summary.customerCount, icon: Users, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">نظرة عامة</h1>
          <p className="text-muted-foreground mt-1">ملخص أداء المشتل والمبيعات</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i} className="border-none shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
                    <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <ShoppingBag className="text-primary" size={20} />
                المنتجات الأكثر مبيعاً
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {summary.topProducts.map((product, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30">
                    <div className="h-12 w-12 rounded-lg bg-card border flex items-center justify-center overflow-hidden shrink-0">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-muted-foreground text-xs">صورة</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.nameAr}</p>
                      <p className="text-sm text-muted-foreground">{product.totalSold} وحدة مباعة</p>
                    </div>
                    <div className="font-bold text-primary">
                      {product.totalRevenue.toFixed(2)} د.أ
                    </div>
                  </div>
                ))}
                {summary.topProducts.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">لا توجد بيانات</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2 text-destructive">
                <AlertCircle size={20} />
                تنبيهات المخزون
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary.lowStockProducts.map((product, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-destructive/20 bg-destructive/5">
                    <span className="font-medium">{product.nameAr}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">الكمية:</span>
                      <span className="font-bold text-destructive px-2 py-1 bg-destructive/10 rounded-md">
                        {product.quantity}
                      </span>
                    </div>
                  </div>
                ))}
                {summary.lowStockProducts.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">المخزون بحالة جيدة</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
