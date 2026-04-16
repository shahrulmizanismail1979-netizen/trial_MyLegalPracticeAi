import { useState } from "react";
import { AdminLayout } from "@/components/admin/layout";
import { 
  useListPricing, 
  useCreatePricing, 
  useUpdatePricing,
  useDeletePricing,
  getListPricingQueryKey
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
import { Plus, Edit, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

const ALL_APPS = [
  "MyLitAI", "MySyalitAI", "MyCorpAI", "MyConveyAI", "MyCrimAI", "MyCCBLitAI", "MyAPIRDAI"
];

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

const pricingSchema = z.object({
  appName: z.string().min(1, "App name is required"),
  appSlug: z.string().min(1, "App slug is required"),
  standardPrice: z.string().min(1, "Price is required"),
  standardDurationYears: z.coerce.number().min(1, "Must be at least 1 year"),
  isActive: z.boolean().default(true),
});

type PricingFormValues = z.infer<typeof pricingSchema>;

export default function PricingPage() {
  const queryClient = useQueryClient();
  const { data: pricing, isLoading } = useListPricing();
  const updatePricing = useUpdatePricing();
  const deletePricing = useDeletePricing();

  const handleToggleActive = (id: number, isActive: boolean) => {
    updatePricing.mutate({ id, data: { isActive } }, {
      onSuccess: () => {
        toast.success(isActive ? "Pricing activated" : "Pricing deactivated");
        queryClient.invalidateQueries({ queryKey: getListPricingQueryKey() });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this pricing tier?")) {
      deletePricing.mutate({ id }, {
        onSuccess: () => {
          toast.success("Pricing deleted");
          queryClient.invalidateQueries({ queryKey: getListPricingQueryKey() });
        }
      });
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Standard Pricing</h1>
            <p className="text-muted-foreground mt-1">Manage individual app pricing tiers outside of kohorts.</p>
          </div>
          <PricingDialog mode="add" />
        </div>

        <div className="border border-border rounded-md bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>App Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : pricing?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No pricing entries found</TableCell>
                </TableRow>
              ) : (
                pricing?.map((entry) => (
                  <TableRow key={entry.id} className={!entry.isActive ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{entry.appName}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{entry.appSlug}</TableCell>
                    <TableCell className="font-mono">RM {entry.standardPrice}</TableCell>
                    <TableCell>{entry.standardDurationYears} Year(s)</TableCell>
                    <TableCell>
                      <Switch 
                        checked={entry.isActive} 
                        onCheckedChange={(checked) => handleToggleActive(entry.id, checked)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        <PricingDialog mode="edit" pricing={entry} />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(entry.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}

function PricingDialog({ mode, pricing }: { mode: "add" | "edit", pricing?: any }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const createPricing = useCreatePricing();
  const updatePricing = useUpdatePricing();

  const form = useForm<PricingFormValues>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      appName: pricing?.appName || "",
      appSlug: pricing?.appSlug || "",
      standardPrice: pricing?.standardPrice || "",
      standardDurationYears: pricing?.standardDurationYears || 1,
      isActive: pricing?.isActive ?? true,
    }
  });

  const onSubmit = (values: PricingFormValues) => {
    if (mode === "add") {
      createPricing.mutate({ data: values }, {
        onSuccess: () => {
          toast.success("Pricing entry created");
          setOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListPricingQueryKey() });
        }
      });
    } else {
      updatePricing.mutate({ id: pricing.id, data: values }, {
        onSuccess: () => {
          toast.success("Pricing updated");
          setOpen(false);
          queryClient.invalidateQueries({ queryKey: getListPricingQueryKey() });
        }
      });
    }
  };

  const handleAppChange = (appName: string) => {
    form.setValue("appName", appName);
    form.setValue("appSlug", slugify(appName));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "add" ? (
          <Button><Plus className="mr-2 h-4 w-4" /> Add Pricing</Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add New Pricing" : "Edit Pricing"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="appName" render={({ field }) => (
              <FormItem>
                <FormLabel>App Name</FormLabel>
                <Select onValueChange={handleAppChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an app" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ALL_APPS.map(app => <SelectItem key={app} value={app}>{app}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            
            <FormField control={form.control} name="appSlug" render={({ field }) => (
              <FormItem>
                <FormLabel>App Slug</FormLabel>
                <FormControl><Input {...field} readOnly className="bg-secondary" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="standardPrice" render={({ field }) => (
                <FormItem><FormLabel>Price (RM)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="standardDurationYears" render={({ field }) => (
                <FormItem><FormLabel>Duration (Years)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createPricing.isPending || updatePricing.isPending}>
                {mode === "add" ? "Save Pricing" : "Update Pricing"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}