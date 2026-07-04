import { Layout } from "@/components/layout";
import { useListInvoices } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Invoices() {
  const [search, setSearch] = useState("");
  const { data: invoices = [] } = useListInvoices({ search });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold">المبيعات والفواتير</h1>
          </div>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border">
          <div className="p-4 border-b flex gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input placeholder="بحث برقم الفاتورة..." className="pl-4 pr-10 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الفاتورة</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>الموظف</TableHead>
                <TableHead className="text-center">الإجمالي</TableHead>
                <TableHead className="text-center">طريقة الدفع</TableHead>
                <TableHead>التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono font-medium">#{inv.number}</TableCell>
                  <TableCell>{inv.customerName || 'زبون عام'}</TableCell>
                  <TableCell>{inv.employeeName || '-'}</TableCell>
                  <TableCell className="text-center text-primary font-bold">{inv.total.toFixed(2)} د.أ</TableCell>
                  <TableCell className="text-center">
                    <span className="px-2 py-1 rounded-md text-xs bg-muted uppercase tracking-widest">{inv.paymentMethod}</span>
                  </TableCell>
                  <TableCell dir="ltr" className="text-right text-sm text-muted-foreground">
                    {new Date(inv.createdAt).toLocaleString('ar-JO')}
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    لا توجد فواتير
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
