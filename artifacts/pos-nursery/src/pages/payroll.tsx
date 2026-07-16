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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, FileText, Pencil, TrendingUp, TrendingDown, Wallet, Banknote, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const apiJson = (url: string, opts?: RequestInit) =>
  fetch(`/api${url}`, { headers: { "Content-Type": "application/json" }, credentials: "include", ...opts });

type EmployeePayroll = {
  employeeId: number;
  nameAr: string;
  role: string;
  baseSalary: number;
  totalBonus: number;
  totalDeduction: number;
  totalAdvance: number;
  netSalary: number;
};

type SalaryTransaction = {
  id: number;
  employeeId: number;
  type: "bonus" | "deduction" | "advance";
  amount: number;
  note?: string | null;
  transactionDate: string;
  createdAt: string;
};

function generatePayslipPDF(emp: EmployeePayroll, transactions: SalaryTransaction[], month: string) {
  const lines: string[] = [];
  const fmt = (n: number) => n.toFixed(2);

  lines.push("=========================================");
  lines.push("         مشاتل القادري - كشف راتب        ");
  lines.push("=========================================");
  lines.push(`الموظف   : ${emp.nameAr}`);
  lines.push(`الدور    : ${emp.role === "admin" ? "مدير" : "كاشير"}`);
  lines.push(`الشهر    : ${month}`);
  lines.push("-----------------------------------------");
  lines.push(`الراتب الأساسي       : ${fmt(emp.baseSalary)} د.أ`);

  const bonuses = transactions.filter((t) => t.type === "bonus");
  const deductions = transactions.filter((t) => t.type === "deduction");
  const advances = transactions.filter((t) => t.type === "advance");

  if (bonuses.length > 0) {
    lines.push("-----------------------------------------");
    lines.push("المكافآت:");
    bonuses.forEach((t) => {
      const date = format(new Date(t.transactionDate), "yyyy/MM/dd");
      lines.push(`  + ${fmt(t.amount)} د.أ  |  ${t.note ?? ""}  (${date})`);
    });
  }

  if (deductions.length > 0) {
    lines.push("-----------------------------------------");
    lines.push("الخصومات:");
    deductions.forEach((t) => {
      const date = format(new Date(t.transactionDate), "yyyy/MM/dd");
      lines.push(`  - ${fmt(t.amount)} د.أ  |  ${t.note ?? ""}  (${date})`);
    });
  }

  if (advances.length > 0) {
    lines.push("-----------------------------------------");
    lines.push("السلف:");
    advances.forEach((t) => {
      const date = format(new Date(t.transactionDate), "yyyy/MM/dd");
      lines.push(`  - ${fmt(t.amount)} د.أ  |  ${t.note ?? "سلفة"}  (${date})`);
    });
  }

  lines.push("-----------------------------------------");
  lines.push(`إجمالي المكافآت      : +${fmt(emp.totalBonus)} د.أ`);
  lines.push(`إجمالي الخصومات      : -${fmt(emp.totalDeduction)} د.أ`);
  lines.push(`إجمالي السلف         : -${fmt(emp.totalAdvance)} د.أ`);
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
  const [expandedEmp, setExpandedEmp] = useState<number | null>(null);
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);

  const [salaryValue, setSalaryValue] = useState("");
  const [txType, setTxType] = useState<"bonus" | "deduction">("bonus");
  const [txAmount, setTxAmount] = useState("");
  const [txNote, setTxNote] = useState("");
  const [advAmount, setAdvAmount] = useState("");
  const [advNote, setAdvNote] = useState("");

  const { data: transactions = [] } = useListEmployeeTransactions(selectedEmp?.employeeId ?? 0, {
    query: { enabled: !!selectedEmp },
  });

  const setSalaryMut = useSetEmployeeSalary();
  const createTxMut = useCreateTransaction();
  const deleteTxMut = useDeleteTransaction();

  const payAdvanceMut = useMutation({
    mutationFn: ({ employeeId, amount, note }: { employeeId: number; amount: number; note: string }) =>
      apiJson(`/payroll/${employeeId}/advance`, {
        method: "POST",
        body: JSON.stringify({ amount, note: note || "سلفة راتب", isInCashBox: true }),
      }).then((r) => r.json()),
    onSuccess: (data: any, vars) => {
      if (data.error) { toast({ variant: "destructive", title: data.error }); return; }
      toast({ title: `✅ تم صرف ${vars.amount.toFixed(2)} د.أ كسلفة وخصمها من الراتب` });
      invalidate(vars.employeeId);
      setAdvanceDialogOpen(false);
      setAdvAmount("");
      setAdvNote("");
    },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ أثناء صرف الدفعة" }),
  });

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

  function openAdvanceDialog(emp: EmployeePayroll) {
    setSelectedEmp(emp);
    setAdvAmount("");
    setAdvNote("");
    setAdvanceDialogOpen(true);
  }

  function toggleExpand(empId: number, emp: EmployeePayroll) {
    if (expandedEmp === empId) {
      setExpandedEmp(null);
    } else {
      setExpandedEmp(empId);
      setSelectedEmp(emp);
    }
  }

  function handleSetSalary() {
    if (!selectedEmp) return;
    const val = parseFloat(salaryValue);
    if (isNaN(val) || val < 0) { toast({ variant: "destructive", title: "قيمة غير صالحة" }); return; }
    setSalaryMut.mutate(
      { employeeId: selectedEmp.employeeId, data: { baseSalary: val } },
      {
        onSuccess: () => {
          toast({ title: "تم تحديث الراتب الأساسي" });
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
          toast({ title: txType === "bonus" ? "تمت إضافة المكافأة ✓" : "تم تسجيل الخصم ✓" });
          invalidate(selectedEmp.employeeId);
          setTxDialogOpen(false);
        },
        onError: () => toast({ variant: "destructive", title: "حدث خطأ" }),
      },
    );
  }

  function handlePayAdvance() {
    if (!selectedEmp) return;
    const val = parseFloat(advAmount);
    if (isNaN(val) || val <= 0) { toast({ variant: "destructive", title: "أدخل مبلغاً صحيحاً" }); return; }
    payAdvanceMut.mutate({ employeeId: selectedEmp.employeeId, amount: val, note: advNote });
  }

  function handleDeleteTx(txId: number, empId: number) {
    deleteTxMut.mutate(
      { txId },
      {
        onSuccess: () => { toast({ title: "تم الحذف" }); invalidate(empId); },
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
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">الرواتب</h1>
          <p className="text-muted-foreground mt-1">إدارة رواتب الموظفين والسلف والمكافآت والخصومات</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <div className="grid gap-4">
            {typedList.map((emp) => {
              const isExpanded = expandedEmp === emp.employeeId;
              const empTxs = isExpanded ? (transactions as SalaryTransaction[]) : [];

              return (
                <div
                  key={emp.employeeId}
                  className="bg-card border border-border rounded-2xl p-5 shadow-sm"
                >
                  {/* Header row */}
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-lg font-semibold">{emp.nameAr}</h3>
                    <Badge variant={emp.role === "admin" ? "default" : "secondary"}>
                      {emp.role === "admin" ? "مدير" : "كاشير"}
                    </Badge>
                  </div>

                  {/* Salary cards grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
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

                    <div className="bg-violet-50 dark:bg-violet-950/20 rounded-xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-violet-700 dark:text-violet-400 text-xs mb-1">
                        <Banknote size={13} /> السلف
                      </div>
                      <p className="font-bold text-base text-violet-700 dark:text-violet-400">
                        {emp.totalAdvance > 0 ? `-${emp.totalAdvance.toFixed(2)}` : "0.00"}
                      </p>
                      <p className="text-xs text-muted-foreground">د.أ</p>
                    </div>

                    <div className={`rounded-xl p-3 text-center border ${emp.netSalary >= emp.baseSalary ? "bg-primary/5 border-primary/20" : "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"}`}>
                      <div className={`text-xs mb-1 font-medium ${emp.netSalary >= emp.baseSalary ? "text-primary" : "text-orange-600 dark:text-orange-400"}`}>
                        صافي الراتب
                      </div>
                      <p className={`font-bold text-lg ${emp.netSalary >= emp.baseSalary ? "text-primary" : "text-orange-600 dark:text-orange-400"}`}>
                        {emp.netSalary.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">د.أ</p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openSalaryDialog(emp)}>
                      <Pencil size={14} /> تعديل الراتب
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-violet-700 border-violet-200 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-800 dark:hover:bg-violet-950/30" onClick={() => openAdvanceDialog(emp)}>
                      <Banknote size={14} /> صرف دفعة
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openTxDialog(emp)}>
                      <Plus size={14} /> مكافأة / خصم
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setSelectedEmp(emp); setTimeout(() => handlePrint(emp), 100); }}>
                      <FileText size={14} /> كشف راتب
                    </Button>
                    <button
                      className="mr-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => toggleExpand(emp.employeeId, emp)}
                    >
                      {isExpanded ? <><ChevronUp size={14} /> إخفاء البنود</> : <><ChevronDown size={14} /> عرض البنود</>}
                    </button>
                  </div>

                  {/* Transactions list */}
                  {isExpanded && (
                    <div className="mt-4 border-t border-border pt-4">
                      {empTxs.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">لا توجد بنود مسجّلة</p>
                      ) : (
                        <div className="space-y-2">
                          {empTxs.map((tx) => (
                            <div
                              key={tx.id}
                              className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 text-sm"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                {tx.type === "advance" && (
                                  <span className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full font-medium">💼 سلفة</span>
                                )}
                                {tx.type === "bonus" && (
                                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">🎁 مكافأة</span>
                                )}
                                {tx.type === "deduction" && (
                                  <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full font-medium">✂️ خصم</span>
                                )}
                                <span className={`font-semibold ${tx.type === "bonus" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                  {tx.type === "bonus" ? "+" : "-"}{tx.amount.toFixed(2)} د.أ
                                </span>
                                {tx.note && <span className="text-muted-foreground">{tx.note}</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
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
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Salary Dialog */}
      <Dialog open={salaryDialogOpen} onOpenChange={setSalaryDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-sm w-[95vw]">
          <DialogHeader>
            <DialogTitle>تعديل الراتب الأساسي</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-muted-foreground text-sm">{selectedEmp?.nameAr}</p>
            <div className="space-y-2">
              <Label>الراتب الأساسي (د.أ)</Label>
              <Input
                type="number" min="0" step="0.01" dir="ltr"
                value={salaryValue}
                onChange={(e) => setSalaryValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetSalary()}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSalaryDialogOpen(false)}>إلغاء</Button>
              <Button className="flex-1" onClick={handleSetSalary} disabled={setSalaryMut.isPending}>
                {setSalaryMut.isPending && <Loader2 className="animate-spin ml-2" size={15} />}
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Advance (دفعة) Dialog */}
      <Dialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-sm w-[95vw]">
          <DialogHeader>
            <DialogTitle>💼 صرف دفعة (سلفة)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-violet-50 dark:bg-violet-950/20 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-sm">{selectedEmp?.nameAr}</p>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>الراتب الأساسي</span>
                <span>{selectedEmp?.baseSalary.toFixed(2)} د.أ</span>
              </div>
              <div className="flex justify-between text-xs text-violet-700 dark:text-violet-400">
                <span>السلف المصروفة حتى الآن</span>
                <span>-{(selectedEmp?.totalAdvance ?? 0).toFixed(2)} د.أ</span>
              </div>
              <div className="flex justify-between text-xs font-bold border-t border-violet-200 dark:border-violet-800 pt-1 mt-1">
                <span>صافي الراتب الحالي</span>
                <span className={`${(selectedEmp?.netSalary ?? 0) >= 0 ? "text-primary" : "text-red-600"}`}>
                  {(selectedEmp?.netSalary ?? 0).toFixed(2)} د.أ
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>مبلغ الدفعة (د.أ)</Label>
              <Input
                type="number" min="0.01" step="0.01" dir="ltr"
                placeholder="0.00"
                value={advAmount}
                onChange={(e) => setAdvAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePayAdvance()}
              />
              {advAmount && !isNaN(parseFloat(advAmount)) && selectedEmp && (
                <p className="text-xs text-muted-foreground">
                  صافي الراتب بعد الدفعة:{" "}
                  <span className={`font-semibold ${(selectedEmp.netSalary - parseFloat(advAmount)) >= 0 ? "text-primary" : "text-red-600"}`}>
                    {(selectedEmp.netSalary - parseFloat(advAmount)).toFixed(2)} د.أ
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>ملاحظة (اختياري)</Label>
              <Input
                placeholder="مثال: سلفة شهر يوليو..."
                value={advNote}
                onChange={(e) => setAdvNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setAdvanceDialogOpen(false)}>إلغاء</Button>
              <Button
                className="flex-1 bg-violet-600 hover:bg-violet-700"
                onClick={handlePayAdvance}
                disabled={payAdvanceMut.isPending || !advAmount}
              >
                {payAdvanceMut.isPending && <Loader2 className="animate-spin ml-2" size={15} />}
                صرف الدفعة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bonus / Deduction Dialog */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-sm w-[95vw]">
          <DialogHeader>
            <DialogTitle>إضافة مكافأة / خصم</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-muted-foreground text-sm">{selectedEmp?.nameAr}</p>
            <div className="space-y-2">
              <Label>النوع</Label>
              <Select value={txType} onValueChange={(v) => setTxType(v as "bonus" | "deduction")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonus">🎁 مكافأة</SelectItem>
                  <SelectItem value="deduction">✂️ خصم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المبلغ (د.أ)</Label>
              <Input
                type="number" min="0.01" step="0.01" dir="ltr"
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
              <Button variant="outline" className="flex-1" onClick={() => setTxDialogOpen(false)}>إلغاء</Button>
              <Button className="flex-1" onClick={handleCreateTx} disabled={createTxMut.isPending}>
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
