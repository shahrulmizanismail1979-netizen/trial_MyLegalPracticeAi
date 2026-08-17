import { useState } from "react";
import { AdminLayout } from "@/components/admin/layout";
import { 
  useListVouchers, 
  useCreateVoucher, 
  useUpdateVoucher,
  useDeleteVoucher,
  getListVouchersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Ticket } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

const voucherSchema = z.object({
  code: z.string().min(1, "Code is required").toUpperCase(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.string().min(1, "Discount value is required"),
  maxUses: z.coerce.number().min(1, "Must be at least 1"),
  appFilter: z.string().optional().nullable(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

type VoucherFormValues = z.infer<typeof voucherSchema>;

export default function VouchersPage() {
  const queryClient = useQueryClient();
  const { data: vouchers, isLoading } = useListVouchers();
  const updateVoucher = useUpdateVoucher();
  const deleteVoucher = useDeleteVoucher();

  const handleToggleActive = (id: number, isActive: boolean) => {
    updateVoucher.mutate({ id, data: { isActive } }, {
      onSuccess: () => {
        toast.success(isActive ? "Voucher activated" : "Voucher deactivated");
        queryClient.invalidateQueries({ queryKey: getListVouchersQueryKey() });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this voucher?")) {
      deleteVoucher.mutate({ id }, {
        onSuccess: () => {
          toast.success("Voucher deleted");
          queryClient.invalidateQueries({ queryKey: getListVouchersQueryKey() });
        }
      });
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Vouchers</h1>
            <p className="text-muted-foreground mt-1">Manage discount codes and promotional campaigns.</p>
          </div>
          <VoucherDialog mode="add" />
        </div>

        <div className="border border-border rounded-md bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>App Limit</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : vouchers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No vouchers found</TableCell>
                </TableRow>
              ) : (
                vouchers?.map((voucher) => {
                  const isExpired = voucher.validUntil && new Date(voucher.validUntil) < new Date();
                  const isExhausted = voucher.usedCount >= voucher.maxUses;
                  const effectivelyInactive = !voucher.isActive || isExpired || isExhausted;
                  
                  return (
                    <TableRow key={voucher.id} className={effectivelyInactive ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-primary" />
                          <span className="font-mono font-bold tracking-wider">{voucher.code}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {voucher.discountType === "percentage" ? `${voucher.discountValue}%` : `RM ${voucher.discountValue}`}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {voucher.usedCount} / {voucher.maxUses}
                        </div>
                      </TableCell>
                      <TableCell>
                        {voucher.appFilter ? (
                          <Badge variant="secondary" className="font-mono text-[10px]">{voucher.appFilter}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Any App</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {voucher.validUntil ? new Date(voucher.validUntil).toLocaleDateString('en-GB') : "Never"}
                        {isExpired && <Badge variant="destructive" className="ml-2 text-[10px] px-1 h-4">Expired</Badge>}
                      </TableCell>
                      <TableCell>
                        <Switch 
                          checked={voucher.isActive} 
                          onCheckedChange={(checked) => handleToggleActive(voucher.id, checked)}
                          disabled={isExpired || isExhausted}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          <VoucherDialog mode="edit" voucher={voucher} />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(voucher.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}

function VoucherDialog({ mode, voucher }: { mode: "add" | "edit", voucher?: any }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const createVoucher = useCreateVoucher();
  const updateVoucher = useUpdateVoucher();

  const form = useForm<VoucherFormValues>({
    resolver: zodResolver(voucherSchema),
    defaultValues: {
      code: voucher?.code || "",
      discountType: voucher?.discountType || "percentage",
      discountValue: voucher?.discountValue || "",
      maxUses: voucher?.maxUses || 100,
      appFilter: voucher?.appFilter || "",
      validUntil: voucher?.validUntil ? new Date(voucher.validUntil).toISOString().slice(0,10) : "",
      isActive: voucher?.isActive ?? true,
    }
  });

  const onSubmit = (values: VoucherFormValues) => {
    // Clean up empty strings to null for backend
    const payload = {
      ...values,
      appFilter: values.appFilter || null,
      validUntil: values.validUntil ? new Date(values.validUntil).toISOString() : null,
    };

    if (mode === "add") {
      createVoucher.mutate({ data: payload }, {
        onSuccess: () => {
          toast.success("Voucher created");
          setOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListVouchersQueryKey() });
        }
      });
    } else {
      updateVoucher.mutate({ id: voucher.id, data: payload }, {
        onSuccess: () => {
          toast.success("Voucher updated");
          setOpen(false);
          queryClient.invalidateQueries({ queryKey: getListVouchersQueryKey() });
        }
      });
    }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    form.setValue('code', result);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "add" ? (
          <Button><Plus className="mr-2 h-4 w-4" /> Create Voucher</Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Create New Voucher" : "Edit Voucher"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="code" render={({ field }) => (
              <FormItem>
                <FormLabel>Voucher Code</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input {...field} className="font-mono uppercase" placeholder="e.g. WELCOME20" onChange={e => field.onChange(e.target.value.toUpperCase())} />
                  </FormControl>
                  <Button type="button" variant="outline" onClick={generateCode}>Generate</Button>
                </div>
                <FormMessage />
              </FormItem>
            )} />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="discountType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Discount Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount (RM)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="discountValue" render={({ field }) => (
                <FormItem><FormLabel>Value</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="maxUses" render={({ field }) => (
                <FormItem><FormLabel>Max Uses</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="validUntil" render={({ field }) => (
                <FormItem><FormLabel>Expiry Date (Optional)</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="appFilter" render={({ field }) => (
              <FormItem><FormLabel>App Restriction (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g. MyLitAI" value={field.value || ""} /></FormControl><FormMessage /></FormItem>
            )} />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createVoucher.isPending || updateVoucher.isPending}>
                {mode === "add" ? "Save Voucher" : "Update Voucher"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}