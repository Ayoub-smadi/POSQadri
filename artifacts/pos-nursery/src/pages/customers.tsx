import { Layout } from "@/components/layout";
import { useListCustomers, useDeleteCustomer } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Customers() {
  const [search, setSearch] = useState("");
  const { data: customers = [], refetch } = useListCustomers({ search });
  const deleteMutation = useDeleteCustomer();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد؟")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "تم الحذف" });
          refetch();
        }
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold">العملاء</h1>
          </div>
          <Button className="rounded-xl gap-2"><Plus size={18} />إضافة عميل</Button>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border">
          <div className="p-4 border-b flex gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input placeholder="بحث..." className="pl-4 pr-10 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>رقم الهاتف</TableHead>
                <TableHead className="text-center">عدد المشتريات</TableHead>
                <TableHead className="text-center">إجمالي الإنفاق</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell dir="ltr" className="text-right">{c.phone || '-'}</TableCell>
                  <TableCell className="text-center">{c.purchaseCount}</TableCell>
                  <TableCell className="text-center text-primary font-bold">{c.totalSpent.toFixed(2)}</TableCell>
                  <TableCell className="text-left">
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(c.id)}>
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
