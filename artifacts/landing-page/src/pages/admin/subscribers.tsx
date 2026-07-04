import { useState } from "react";
import { AdminLayout } from "@/components/admin/layout";
import { 
  useListSubscribers, 
  useCreateSubscriber, 
  useUpdateSubscriber, 
  useDeleteSubscriber,
  getListSubscribersQueryKey
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
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MoreVertical, Plus, CheckCircle, XCircle, Trash2, Edit, Ticket, ShieldCheck, GraduationCap } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const ALL_APPS = [
  "MyLitAI", "MySyalitAI", "MyCorpAI", "MyConveyAI", "MyCrimAI", "MyCorpCommBankLitAi", "MyAccidentAi"
];

const subscriberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Phone is required"),
  apps: z.array(z.string()).min(1, "Select at least one app"),
  tier: z.enum(["bundle", "single", "standard"]).nullable().optional(),
  paymentAmount: z.string().min(1, "Amount is required"),
  insuranceEntitled: z.boolean(),
  coursesPerYear: z.coerce.number().int().min(0),
  coursesUsed: z.coerce.number().int().min(0),
  voucherCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type SubscriberFormValues = z.infer<typeof subscriberSchema>;

export default function SubscribersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [appFilter, setAppFilter] = useState<string>("all");
  
  const queryClient = useQueryClient();
  
  const { data: subscribers, isLoading } = useListSubscribers({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter as any : undefined,
    app: appFilter !== "all" ? appFilter : undefined
  });

  const updateSubscriber = useUpdateSubscriber();
  const deleteSubscriber = useDeleteSubscriber();
  
  const handleStatusChange = (id: number, status: "confirmed" | "rejected") => {
    updateSubscriber.mutate({ id, data: { paymentStatus: status } }, {
      onSuccess: () => {
        toast.success(`Payment ${status}`);
        queryClient.invalidateQueries({ queryKey: getListSubscribersQueryKey() });
      },
      onError: () => {
        toast.error("Failed to update status");
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this subscriber?")) {
      deleteSubscriber.mutate({ id }, {
        onSuccess: () => {
          toast.success("Subscriber deleted");
          queryClient.invalidateQueries({ queryKey: getListSubscribersQueryKey() });
        }
      });
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Subscribers</h1>
            <p className="text-muted-foreground mt-1">Manage user subscriptions and payments.</p>
          </div>
          <SubscriberDialog mode="add" />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-md border border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, email or phone..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={appFilter} onValueChange={setAppFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Apps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Apps</SelectItem>
                {ALL_APPS.map(app => (
                  <SelectItem key={app} value={app}>{app}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border border-border rounded-md bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Subscriber</TableHead>
                <TableHead>Apps</TableHead>
                <TableHead>Benefits</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : subscribers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No subscribers found</TableCell>
                </TableRow>
              ) : (
                subscribers?.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div className="font-medium">{sub.name}</div>
                      <div className="text-xs text-muted-foreground">{sub.email}</div>
                      <div className="text-xs text-muted-foreground">{sub.phone}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {sub.apps.map(app => (
                          <Badge key={app} variant="secondary" className="text-[10px] px-1 py-0">{app}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        {sub.tier && (
                          <Badge variant="outline" className="w-fit text-[10px] px-1 py-0 capitalize">{sub.tier}</Badge>
                        )}
                        <div className={`flex items-center gap-1 ${sub.insuranceEntitled ? "text-green-500" : "text-muted-foreground"}`}>
                          <ShieldCheck className="w-3 h-3 shrink-0" />
                          {sub.insuranceEntitled ? "Takaful insured" : "No insurance"}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <GraduationCap className="w-3 h-3 shrink-0" />
                          {sub.coursesUsed}/{sub.coursesPerYear} courses used
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono">RM {sub.paymentAmount}</div>
                      {sub.voucherCode && (
                        <div className="text-xs text-primary mt-1 flex items-center gap-1">
                          <Ticket className="w-3 h-3" /> {sub.voucherCode}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={sub.paymentStatus === "confirmed" ? "default" : sub.paymentStatus === "rejected" ? "destructive" : "outline"}
                        className={sub.paymentStatus === "confirmed" ? "bg-green-500/10 text-green-500 border-green-500/20" : sub.paymentStatus === "pending" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : ""}
                      >
                        {sub.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {sub.paymentStatus === "pending" && (
                            <>
                              <DropdownMenuItem onClick={() => handleStatusChange(sub.id, "confirmed")}>
                                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                                Confirm Payment
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(sub.id, "rejected")}>
                                <XCircle className="mr-2 h-4 w-4 text-red-500" />
                                Reject Payment
                              </DropdownMenuItem>
                            </>
                          )}
                          <SubscriberDialog mode="edit" subscriber={sub} asDropdownItem />
                          <DropdownMenuItem onClick={() => handleDelete(sub.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

function SubscriberDialog({ mode, subscriber, asDropdownItem }: { mode: "add" | "edit", subscriber?: any, asDropdownItem?: boolean }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const createSubscriber = useCreateSubscriber();
  const updateSubscriber = useUpdateSubscriber();

  const form = useForm<SubscriberFormValues>({
    resolver: zodResolver(subscriberSchema),
    defaultValues: {
      name: subscriber?.name || "",
      email: subscriber?.email || "",
      phone: subscriber?.phone || "",
      apps: subscriber?.apps || [],
      tier: subscriber?.tier ?? null,
      paymentAmount: subscriber?.paymentAmount || "",
      insuranceEntitled: subscriber?.insuranceEntitled ?? false,
      coursesPerYear: subscriber?.coursesPerYear ?? 0,
      coursesUsed: subscriber?.coursesUsed ?? 0,
      voucherCode: subscriber?.voucherCode || "",
      notes: subscriber?.notes || "",
    }
  });

  const onSubmit = (values: SubscriberFormValues) => {
    if (mode === "add") {
      createSubscriber.mutate({ data: values }, {
        onSuccess: () => {
          toast.success("Subscriber created");
          setOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListSubscribersQueryKey() });
        }
      });
    } else {
      updateSubscriber.mutate({ id: subscriber.id, data: values }, {
        onSuccess: () => {
          toast.success("Subscriber updated");
          setOpen(false);
          queryClient.invalidateQueries({ queryKey: getListSubscribersQueryKey() });
        }
      });
    }
  };

  const trigger = asDropdownItem ? (
    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
      <Edit className="mr-2 h-4 w-4" /> Edit
    </DropdownMenuItem>
  ) : (
    <Button onClick={() => setOpen(true)}>
      <Plus className="mr-2 h-4 w-4" /> Add Subscriber
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add New Subscriber" : "Edit Subscriber"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            
            <FormField control={form.control} name="apps" render={() => (
              <FormItem>
                <FormLabel>Apps</FormLabel>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {ALL_APPS.map((app) => (
                    <FormField
                      key={app}
                      control={form.control}
                      name="apps"
                      render={({ field }) => {
                        return (
                          <FormItem key={app} className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(app)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, app])
                                    : field.onChange(field.value?.filter((value) => value !== app))
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">{app}</FormLabel>
                          </FormItem>
                        )
                      }}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="tier" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tier</FormLabel>
                  <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? null : v)}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="bundle">Bundle</SelectItem>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="paymentAmount" render={({ field }) => (
                <FormItem><FormLabel>Payment Amount (RM)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <div className="rounded-md border border-border p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" /> Membership Benefits
              </div>
              <FormField control={form.control} name="insuranceEntitled" render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(!!checked)} />
                  </FormControl>
                  <FormLabel className="font-normal text-sm">Entitled to Prudential Takaful life insurance</FormLabel>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="coursesPerYear" render={({ field }) => (
                  <FormItem><FormLabel>Courses / year</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="coursesUsed" render={({ field }) => (
                  <FormItem><FormLabel>Courses used</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <FormField control={form.control} name="voucherCode" render={({ field }) => (
              <FormItem><FormLabel>Voucher Code (Optional)</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createSubscriber.isPending || updateSubscriber.isPending}>
                {mode === "add" ? "Save Subscriber" : "Update Subscriber"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}