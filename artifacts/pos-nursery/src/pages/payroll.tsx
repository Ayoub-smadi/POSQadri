import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useListPayroll,
  useListEmployeeTransactions,
  useSetEmployeeSalary,
  useCreateTransaction,
  useDeleteTransaction,
  getListPayrollQueryKey,
  getListEmployeeTransactionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, FileText, Pencil, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

type EmployeePayroll = {
  employeeId: number;
  nameAr: string;
  role: string;
  baseSalary: number;
  totalBonus: number;
  totalDeduction: number;
  netSalary: number;
};

type SalaryTransaction = {
  id: number;
  employeeId: number;
  type: "bonus" | "deduction";
  amount: number;
  note?: string | null;
  transactionDate: string;
  createdAt: string;
};

function generatePayslipPDF(emp: EmployeePayroll, transactions: SalaryTransaction[], month: string) {
  const lines: string[] = [];
  const pad = (s: string, w: number) => s.padEnd(w, " ");
  const fmt = (n: number) => n.toFixed(2);

  lines.push("=========================================");
  lines.push("         مشاتل القادري - كشف راتب        ");
  lines.push("=========================================");
  lines.push(`الموظف   : ${emp.nameAr}`);
  lines.push(`الدور    : ${emp.role === "admin" ? "مدير" : "كاشير"}`);
  lines.push(`الشهر    : ${month}`);
  lines.push("-----------------------------------------");
  lines.push(`الراتب الأساسي       : ${fmt(emp.baseSalary)} د.أ`);

  if (transactions.length > 0) {
    lines.push("-----------------------------------------");
    lines.push("تفاصيل البنود:");
    transactions.forEach((t) => {
      const label = t.type === "bonus" ? "مكافأة  +" : "خصم    -";
      const date = format(new Date(t.transactionDate), "yyyy/MM/dd");
      lines.push(`  ${label} ${fmt(t.amount)} د.أ  |  ${t.note ?? ""}  (${date})`);
    });
  }

  lines.push("-----------------------------------------");
  lines.push(`إجمالي المكافآت      : ${fmt(emp.totalBonus)} د.أ`);
  lines.push(`إجمالي الخصومات      : ${fmt(emp.totalDeduction)} د.أ`);
  lines.push("=========================================");
  lines.push(`صافي الراتب          : ${fmt(emp.netSalary)} د.أ`);
  lines.push("=========================================");

  const content = lines.join("\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payslip-${emp.nameAr}-${month}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Payroll() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: payrollList = [], isLoading } = useListPayroll();

  const [selectedEmp, setSelectedEmp] = useState<EmployeePayroll | null>(null);
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [salaryValue, setSalaryValue] = useState("");
  const [txType, setTxType] = useState<"bonus" | "deduction">("bonus");
  const [txAmount, setTxAmount] = useState("");
  const [txNote, setTxNote] = useState("");

  const { data: transactions = [] } = useListEmployeeTransactions(selectedEmp?.employeeId ?? 0, {
    query: { enabled: !!selectedEmp },
  });

  const setSalaryMut = useSetEmployeeSalary();
  const createTxMut = useCreateTransaction();
  const deleteTxMut = useDeleteTransaction();

  function invalidate(empId: number) {
    qc.invalidateQueries({ queryKey: getListPayrollQueryKey() });
    qc.invalidateQueries({ queryKey: getListEmployeeTransactionsQueryKey(empId) });
  }

  function openSalaryDialog(emp: EmployeePayroll) {
    setSelectedEmp(emp);
    setSalaryValue(String(emp.baseSalary));
    setSalaryDialogOpen(true);
  }

  function openTxDialog(emp: EmployeePayroll) {
    setSelectedEmp(emp);
    setTxType("bonus");
    setTxAmount("");
    setTxNote("");
    setTxDialogOpen(true);
  }

  function handleSetSalary() {
    if (!selectedEmp) return;
    const val = parseFloat(salaryValue);
    if (isNaN(val) || val < 0) { toast({ variant: "destructive", title: "قيمة غير صالحة" }); return; }
    setSalaryMut.mutate(
      { employeeId: selectedEmp.employeeId, data: { baseSalary: val } },
      {
        onSuccess: () => {
          toast({ title: "تم تحديث الراتب" });
          invalidate(selectedEmp.employeeId);
          setSalaryDialogOpen(false);
        },
        onError: () => toast({ variant: "destructive", title: "حدث خطأ" }),
      },
    );
  }

  function handleCreateTx() {
    if (!selectedEmp) return;
    const val = parseFloat(txAmount);
    if (isNaN(val) || val <= 0) { toast({ variant: "destructive", title: "أدخل مبلغاً صحيحاً" }); return; }
    createTxMut.mutate(
      {
        employeeId: selectedEmp.employeeId,
        data: { type: txType, amount: val, note: txNote || null },
      },
      {
        onSuccess: () => {
          toast({ title: txType === "bonus" ? "تمت إضافة المكافأة" : "تم تسجيل الخصم" });
          invalidate(selectedEmp.employeeId);
          setTxDialogOpen(false);
        },
        onError: () => toast({ variant: "destructive", title: "حدث خطأ" }),
      },
    );
  }

  function handleDeleteTx(txId: number, empId: number) {
    deleteTxMut.mutate(
      { txId },
      {
        onSuccess: () => {
          toast({ title: "تم الحذف" });
          invalidate(empId);
        },
        onError: () => toast({ variant: "destructive", title: "فشل الحذف" }),
      },
    );
  }

  function handlePrint(emp: EmployeePayroll) {
    const empTransactions = (transactions as SalaryTransaction[]).filter(
      (t) => t.employeeId === emp.employeeId,
    );
    const month = format(new Date(), "yyyy-MM", { locale: ar });
    generatePayslipPDF(emp, empTransactions, month);
  }

  const typedList = payrollList as EmployeePayroll[];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">الرواتب</h1>
            <p className="text-muted-foreground mt-1">إدارة رواتب الموظفين والمكافآت والخصومات</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <div className="grid gap-4">
            {typedList.map((emp) => (
              <div
                key={emp.employeeId}
                className="bg-card border border-border rounded-2xl p-5 shadow-sm"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Employee info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold">{emp.nameAr}</h3>
                      <Badge variant={emp.role === "admin" ? "default" : "secondary"}>
                        {emp.role === "admin" ? "مدير" : "كاشير"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-muted/40 rounded-xl p-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                          <Wallet size={13} /> الراتب الأساسي
                        </div>
                        <p className="font-bold text-base">{emp.baseSalary.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">د.أ</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-green-700 dark:text-green-400 text-xs mb-1">
                          <TrendingUp size={13} /> المكافآت
                        </div>
                        <p className="font-bold text-base text-green-700 dark:text-green-400">+{emp.totalBonus.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">د.أ</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400 text-xs mb-1">
                          <TrendingDown size={13} /> الخصومات
                        </div>
                        <p className="font-bold text-base text-red-600 dark:text-red-400">-{emp.totalDeduction.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">د.أ</p>
                      </div>
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                        <div className="text-primary text-xs mb-1 font-medium">صافي الراتب</div>
                        <p className="font-bold text-lg text-primary">{emp.netSalary.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">د.أ</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => openSalaryDialog(emp)}
                    >
                      <Pencil size={15} /> تعديل الراتب
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => openTxDialog(emp)}
                    >
                      <Plus size={15} /> إضافة بند
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        setSelectedEmp(emp);
                        setTimeout(() => handlePrint(emp), 100);
                      }}
                    >
                      <FileText size={15} /> كشف راتب
                    </Button>
                  </div>
                </div>

                {/* Transactions list */}
                {selectedEmp?.employeeId === emp.employeeId && (transactions as SalaryTransaction[]).length > 0 && (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-sm font-medium text-muted-foreground mb-2">البنود المسجّلة</p>
                    <div className="space-y-2">
                      {(transactions as SalaryTransaction[]).map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`font-semibold ${
                                tx.type === "bonus"
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {tx.type === "bonus" ? "+" : "-"}{tx.amount.toFixed(2)} د.أ
                            </span>
                            <span className="text-muted-foreground">{tx.note ?? ""}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(tx.transactionDate), "dd/MM/yyyy")}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteTx(tx.id, emp.employeeId)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Click to show transactions */}
                {selectedEmp?.employeeId !== emp.employeeId && (
                  <button
                    className="mt-3 text-xs text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => setSelectedEmp(emp)}
                  >
                    عرض البنود المسجّلة ▼
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Salary Dialog */}
      <Dialog open={salaryDialogOpen} onOpenChange={setSalaryDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تعديل الراتب الأساسي</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-muted-foreground text-sm">{selectedEmp?.nameAr}</p>
            <div className="space-y-2">
              <Label>الراتب الأساسي (د.أ)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                value={salaryValue}
                onChange={(e) => setSalaryValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetSalary()}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSalaryDialogOpen(false)}>
                إلغاء
              </Button>
              <Button
                className="flex-1"
                onClick={handleSetSalary}
                disabled={setSalaryMut.isPending}
              >
                {setSalaryMut.isPending && <Loader2 className="animate-spin ml-2" size={15} />}
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>إضافة مكافأة / خصم</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-muted-foreground text-sm">{selectedEmp?.nameAr}</p>
            <div className="space-y-2">
              <Label>النوع</Label>
              <Select value={txType} onValueChange={(v) => setTxType(v as "bonus" | "deduction")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonus">مكافأة ✅</SelectItem>
                  <SelectItem value="deduction">خصم ❌</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المبلغ (د.أ)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                dir="ltr"
                placeholder="0.00"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>ملاحظة (اختياري)</Label>
              <Input
                placeholder="مثال: بدل نقل، غياب، ..."
                value={txNote}
                onChange={(e) => setTxNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setTxDialogOpen(false)}>
                إلغاء
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateTx}
                disabled={createTxMut.isPending}
              >
                {createTxMut.isPending && <Loader2 className="animate-spin ml-2" size={15} />}
                {txType === "bonus" ? "إضافة مكافأة" : "تسجيل خصم"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
