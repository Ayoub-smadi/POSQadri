import { Layout } from "@/components/layout";
import { useListCustomers, useDeleteCustomer } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Search, Edit, Trash2, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { CustomerDialog } from "@/components/customer-dialog";
import { SettleDebtDialog } from "@/components/settle-debt-dialog";

export default function Customers() {
  const [search, setSearch] = useState("");
  const { data: customers = [], refetch } = useListCustomers({ search });
  const deleteMutation = useDeleteCustomer();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);

  const [settleOpen, setSettleOpen] = useState(false);
  const [settlingCustomer, setSettlingCustomer] = useState<{ id: number; name: string; balance: number } | null>(null);

  const handleAdd = () => {
    setEditingCustomer(null);
    setDialogOpen(true);
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setDialogOpen(true);
  };

  const handleSettle = (customer: any) => {
    setSettlingCustomer({ id: customer.id, name: customer.name, balance: Number(customer.balance) });
    setSettleOpen(true);
  };

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

  const totalDebt = customers.reduce((sum: number, c: any) => sum + Math.max(0, Number(c.balance)), 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold">العملاء</h1>
            {totalDebt > 0 && (
              <p className="text-sm text-destructive mt-1">
                إجمالي الديون المستحقة: <span className="font-bold">{totalDebt.toFixed(2)} د.أ</span>
              </p>
            )}
          </div>
          <Button className="rounded-xl gap-2" onClick={handleAdd}><Plus size={18} />إضافة عميل</Button>
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
                <TableHead className="text-center">الدين</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell dir="ltr" className="text-right">{c.phone || '-'}</TableCell>
                  <TableCell className="text-center">{c.purchaseCount}</TableCell>
                  <TableCell className="text-center text-primary font-bold">{Number(c.totalSpent).toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    {Number(c.balance) > 0 ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-lg text-sm">
                        {Number(c.balance).toFixed(2)} د.أ
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-left">
                    {Number(c.balance) > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-1 gap-1 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleSettle(c)}
                      >
                        <Wallet size={13} />
                        تسوية
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                      <Edit size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(c.id)}>
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">لا يوجد عملاء</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customer={editingCustomer}
        onSuccess={refetch}
      />

      <SettleDebtDialog
        open={settleOpen}
        onOpenChange={setSettleOpen}
        customer={settlingCustomer}
        onSuccess={refetch}
      />
    </Layout>
  );
}
