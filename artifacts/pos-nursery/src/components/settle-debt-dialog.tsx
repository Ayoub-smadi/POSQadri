import { useState } from "react";
import { useUpdateCustomer } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: { id: number; name: string; balance: number } | null;
  onSuccess: () => void;
}

export function SettleDebtDialog({ open, onOpenChange, customer, onSuccess }: Props) {
  const { toast } = useToast();
  const updateCustomer = useUpdateCustomer();
  const [amount, setAmount] = useState("");

  const debt = customer?.balance ?? 0;
  const parsed = parseFloat(amount);
  const isValid = !isNaN(parsed) && parsed > 0 && parsed <= debt;
  const remaining = isValid ? debt - parsed : debt;

  function handleSubmit() {
    if (!customer || !isValid) return;
    updateCustomer.mutate(
      { id: customer.id, data: { name: customer.name, balance: remaining } },
      {
        onSuccess: () => {
          toast({ title: `تم تسجيل دفعة ${parsed.toFixed(2)} د.أ من ${customer.name}` });
          setAmount("");
          onSuccess();
          onOpenChange(false);
        },
        onError: () => toast({ variant: "destructive", title: "حدث خطأ أثناء تسوية الدين" }),
      }
    );
  }

  function handleOpenChange(v: boolean) {
    if (!v) setAmount("");
    onOpenChange(v);
  }

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif flex items-center gap-2">
            <Wallet size={20} className="text-primary" />
            تسوية دين
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Customer info */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">الزبون</span>
              <span className="font-semibold">{customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">الدين الحالي</span>
              <span className="font-bold text-destructive text-base">{debt.toFixed(2)} د.أ</span>
            </div>
          </div>

          {/* Payment amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium">المبلغ المدفوع (د.أ)</label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0.01"
                max={debt}
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="text-left"
                dir="ltr"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter" && isValid) handleSubmit(); }}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0 text-xs px-3"
                onClick={() => setAmount(debt.toFixed(2))}
              >
                كامل الدين
              </Button>
            </div>
            {amount && !isNaN(parsed) && (
              <p className={`text-xs ${parsed > debt ? "text-destructive" : "text-muted-foreground"}`}>
                {parsed > debt
                  ? `المبلغ أكبر من الدين (${debt.toFixed(2)} د.أ)`
                  : `الدين المتبقي بعد الدفع: ${remaining.toFixed(2)} د.أ`}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)}>
              إلغاء
            </Button>
            <Button
              className="flex-1"
              disabled={!isValid || updateCustomer.isPending}
              onClick={handleSubmit}
            >
              {updateCustomer.isPending ? <Loader2 className="animate-spin ml-2" size={16} /> : null}
              تأكيد الدفع
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
