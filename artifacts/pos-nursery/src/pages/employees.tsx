import { Layout } from "@/components/layout";
import { useListEmployees, useDeleteEmployee } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { EmployeeDialog } from "@/components/employee-dialog";

export default function Employees() {
  const { data: employees = [], refetch } = useListEmployees();
  const deleteMutation = useDeleteEmployee();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);

  const handleAdd = () => {
    setEditingEmployee(null);
    setDialogOpen(true);
  };

  const handleEdit = (employee: any) => {
    setEditingEmployee(employee);
    setDialogOpen(true);
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold">الموظفين</h1>
          </div>
          <Button className="rounded-xl gap-2" onClick={handleAdd}><Plus size={18} />إضافة موظف</Button>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد الإلكتروني</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.nameAr}</TableCell>
                  <TableCell>{e.email}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded-md text-xs bg-muted">
                      {e.role === 'admin' ? 'مدير' : 'كاشير'}
                    </span>
                  </TableCell>
                  <TableCell className="text-left">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(e)}>
                      <Edit size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(e.id)}>
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editingEmployee}
        onSuccess={refetch}
      />
    </Layout>
  );
}
