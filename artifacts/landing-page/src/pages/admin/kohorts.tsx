import { useState } from "react";
import { AdminLayout } from "@/components/admin/layout";
import { 
  useListKohorts, 
  useCreateKohort, 
  useUpdateKohort,
  getListKohortsQueryKey
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
import { Plus, Edit } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

const kohortSchema = z.object({
  name: z.string().min(1, "Name is required"),
  maxSlots: z.coerce.number().min(1, "Max slots must be at least 1"),
  pricePerApp: z.string().min(1, "Price is required"),
  bundlePrice: z.string().min(1, "Bundle price is required"),
  subscriptionYears: z.coerce.number().min(1, "Must be at least 1 year"),
  isActive: z.boolean().default(true),
});

type KohortFormValues = z.infer<typeof kohortSchema>;

export default function KohortsPage() {
  const queryClient = useQueryClient();
  const { data: kohorts, isLoading } = useListKohorts();
  const updateKohort = useUpdateKohort();

  const handleToggleActive = (id: number, isActive: boolean) => {
    updateKohort.mutate({ id, data: { isActive } }, {
      onSuccess: () => {
        toast.success(isActive ? "Kohort activated" : "Kohort deactivated");
        queryClient.invalidateQueries({ queryKey: getListKohortsQueryKey() });
      }
    });
  };

  return (
    <AdminLayout>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Kohorts</h1>
            <p className="text-muted-foreground mt-1">Manage subscription batches and availability.</p>
          </div>
          <KohortDialog mode="add" />
        </div>

        <div className="border border-border rounded-md bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Kohort Name</TableHead>
                <TableHead>Pricing</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : kohorts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No kohorts found</TableCell>
                </TableRow>
              ) : (
                kohorts?.map((kohort) => {
                  const percentFilled = (kohort.filledSlots / kohort.maxSlots) * 100;
                  return (
                    <TableRow key={kohort.id} className={!kohort.isActive ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{kohort.name}</TableCell>
                      <TableCell>
                        <div className="font-mono text-sm">RM {kohort.pricePerApp} / app</div>
                        <div className="font-mono text-xs text-muted-foreground">RM {kohort.bundlePrice} bundle</div>
                      </TableCell>
                      <TableCell>{kohort.subscriptionYears} Year(s)</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 w-32">
                          <div className="flex justify-between text-xs">
                            <span>{kohort.filledSlots} filled</span>
                            <span>{kohort.maxSlots} max</span>
                          </div>
                          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${percentFilled >= 100 ? "bg-red-500" : percentFilled > 80 ? "bg-yellow-500" : "bg-green-500"}`}
                              style={{ width: `${Math.min(percentFilled, 100)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch 
                          checked={kohort.isActive} 
                          onCheckedChange={(checked) => handleToggleActive(kohort.id, checked)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <KohortDialog mode="edit" kohort={kohort} />
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

function KohortDialog({ mode, kohort }: { mode: "add" | "edit", kohort?: any }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const createKohort = useCreateKohort();
  const updateKohort = useUpdateKohort();

  const form = useForm<KohortFormValues>({
    resolver: zodResolver(kohortSchema),
    defaultValues: {
      name: kohort?.name || "",
      maxSlots: kohort?.maxSlots || 100,
      pricePerApp: kohort?.pricePerApp || "",
      bundlePrice: kohort?.bundlePrice || "",
      subscriptionYears: kohort?.subscriptionYears || 1,
      isActive: kohort?.isActive ?? true,
    }
  });

  const onSubmit = (values: KohortFormValues) => {
    if (mode === "add") {
      createKohort.mutate({ data: values }, {
        onSuccess: () => {
          toast.success("Kohort created");
          setOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListKohortsQueryKey() });
        }
      });
    } else {
      updateKohort.mutate({ id: kohort.id, data: values }, {
        onSuccess: () => {
          toast.success("Kohort updated");
          setOpen(false);
          queryClient.invalidateQueries({ queryKey: getListKohortsQueryKey() });
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "add" ? (
          <Button><Plus className="mr-2 h-4 w-4" /> Add Kohort</Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add New Kohort" : "Edit Kohort"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Kohort Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="maxSlots" render={({ field }) => (
              <FormItem><FormLabel>Max Slots</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="pricePerApp" render={({ field }) => (
                <FormItem><FormLabel>Price Per App (RM)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="bundlePrice" render={({ field }) => (
                <FormItem><FormLabel>Bundle Price (RM)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="subscriptionYears" render={({ field }) => (
              <FormItem><FormLabel>Subscription Years</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createKohort.isPending || updateKohort.isPending}>
                {mode === "add" ? "Save Kohort" : "Update Kohort"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}