import { useGetInvoice } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

interface Props {
  invoiceId: number | null;
  onOpenChange: (v: boolean) => void;
}

const paymentLabels: Record<string, string> = {
  cash: "كاش", visa: "فيزا", cliq: "كليك", bank: "حوالة بنكية", split: "دفع مقسّم", credit: "دين (آجل)",
};

export function InvoiceDetailDialog({ invoiceId, onOpenChange }: Props) {
  const { data: invoice, isLoading } = useGetInvoice(invoiceId ?? 0, {
    query: { enabled: !!invoiceId } as any,
  });

  return (
    <Dialog open={!!invoiceId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif">
            فاتورة #{invoice?.number ?? ""}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !invoice ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-muted-foreground" size={28} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">العميل</p>
                <p className="font-medium">{invoice.customerName || "زبون عام"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">الكاشير</p>
                <p className="font-medium">{invoice.employeeName || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">طريقة الدفع</p>
                <p className="font-medium">{paymentLabels[invoice.paymentMethod] || invoice.paymentMethod}</p>
              </div>
              <div>
                <p className="text-muted-foreground">التاريخ</p>
                <p className="font-medium" dir="ltr">{new Date(invoice.createdAt).toLocaleString('ar-JO')}</p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الصنف</TableHead>
                  <TableHead className="text-center">الكمية</TableHead>
                  <TableHead className="text-center">السعر</TableHead>
                  <TableHead className="text-left">المجموع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.productNameAr}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-center">{item.price.toFixed(2)}</TableCell>
                    <TableCell className="text-left font-bold text-primary">
                      {(item.price * item.quantity - item.discount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="space-y-1 text-sm border-t border-border pt-3">
              <div className="flex justify-between text-muted-foreground">
                <span>المجموع الفرعي</span>
                <span>{invoice.subtotal.toFixed(2)} د.أ</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>الخصم</span>
                  <span>-{invoice.discount.toFixed(2)} د.أ</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>الضريبة</span>
                <span>{invoice.tax.toFixed(2)} د.أ</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-1">
                <span>الإجمالي</span>
                <span className="text-primary">{invoice.total.toFixed(2)} د.أ</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
