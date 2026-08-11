import { AdminLayout } from "@/components/admin/layout";
import { 
  useGetDashboardStats, 
  useGetRecentActivity, 
  useGetRevenueByApp,
  useGetDeliveryFailures,
  useResolveDeliveryFailure,
  getGetDeliveryFailuresQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Layers, 
  Ticket,
  AlertTriangle,
  MailX,
  MessageSquareX,
  Check,
} from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity({ limit: 10 });
  const { data: revenue, isLoading: revenueLoading } = useGetRevenueByApp();

  return (
    <AdminLayout>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Overview</h1>
            <p className="text-muted-foreground mt-1">Platform performance at a glance.</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Total Revenue" 
            value={statsLoading ? null : `RM ${stats?.totalRevenue}`}
            icon={<DollarSign className="h-5 w-5 text-primary" />}
            loading={statsLoading}
          />
          <StatCard 
            title="Total Subscribers" 
            value={statsLoading ? null : stats?.totalSubscribers.toString() ?? null}
            icon={<Users className="h-5 w-5 text-muted-foreground" />}
            loading={statsLoading}
          />
          <StatCard 
            title="Confirmed Payments" 
            value={statsLoading ? null : stats?.confirmedSubscribers.toString() ?? null}
            icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
            loading={statsLoading}
          />
          <StatCard 
            title="Pending Payments" 
            value={statsLoading ? null : stats?.pendingSubscribers.toString() ?? null}
            icon={<Clock className="h-5 w-5 text-yellow-500" />}
            loading={statsLoading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue by App */}
          <Card className="lg:col-span-2 border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Revenue by App
              </CardTitle>
            </CardHeader>
            <CardContent>
              {revenueLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  {revenue?.map((item) => (
                    <div key={item.appName} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="font-medium">{item.appName}</span>
                      </div>
                      <div className="flex items-center gap-6">
                        <span className="text-muted-foreground text-sm">{item.subscriberCount} users</span>
                        <span className="font-mono font-medium">RM {item.totalRevenue}</span>
                      </div>
                    </div>
                  ))}
                  {(!revenue || revenue.length === 0) && (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      No revenue data available
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Status */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1 p-3 bg-secondary rounded-md">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Layers className="h-3 w-3" /> Kohort Slots Remaining
                    </span>
                    <span className="text-xl font-medium font-mono">{stats?.kohortSlotsRemaining}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 bg-secondary rounded-md">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Ticket className="h-3 w-3" /> Active Vouchers
                    </span>
                    <span className="text-xl font-medium font-mono">{stats?.activeVouchers}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Delivery Failures */}
        <DeliveryFailuresPanel />

        {/* Activity Feed */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                {activity?.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-4 pb-4 border-b border-border/50 last:border-0 last:pb-0">
                    <div className="mt-1">
                      {entry.type === "subscriber_added" && <Users className="h-4 w-4 text-blue-400" />}
                      {entry.type === "payment_confirmed" && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                      {entry.type === "payment_rejected" && <Clock className="h-4 w-4 text-red-400" />}
                      {entry.type === "voucher_created" && <Ticket className="h-4 w-4 text-purple-400" />}
                      {entry.type === "kohort_updated" && <Layers className="h-4 w-4 text-orange-400" />}
                      {entry.type === "price_changed" && <DollarSign className="h-4 w-4 text-primary" />}
                      {entry.type === "sms_failed" && <MessageSquareX className="h-4 w-4 text-red-400" />}
                      {entry.type === "sms_skipped" && <MessageSquareX className="h-4 w-4 text-yellow-400" />}
                      {entry.type === "email_failed" && <MailX className="h-4 w-4 text-red-400" />}
                      {entry.type === "needs_portal_assignment" && <AlertTriangle className="h-4 w-4 text-red-400" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{entry.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {(!activity || activity.length === 0) && (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No recent activity
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function DeliveryFailuresPanel() {
  const [showResolved, setShowResolved] = useState(false);
  const queryClient = useQueryClient();
  const { data: failures, isLoading } = useGetDeliveryFailures({ includeResolved: showResolved });
  const resolveMutation = useResolveDeliveryFailure({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetDeliveryFailuresQueryKey() });
      },
    },
  });

  const unresolvedCount = failures?.filter((f) => !f.resolved).length ?? 0;

  return (
    <Card className="border-border bg-card shadow-sm" data-testid="card-delivery-failures">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Delivery Failures
              {unresolvedCount > 0 && (
                <Badge variant="destructive" data-testid="badge-failure-count">{unresolvedCount}</Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              Buyers whose access code SMS or email did not go through — follow up manually, then mark handled.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResolved((v) => !v)}
            data-testid="button-toggle-resolved"
          >
            {showResolved ? "Hide handled" : "Show handled"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !failures || failures.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm" data-testid="text-no-failures">
            No delivery failures — every access code reached its buyer.
          </div>
        ) : (
          <div className="space-y-4">
            {failures.map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-4 pb-4 border-b border-border/50 last:border-0 last:pb-0"
                data-testid={`row-failure-${f.id}`}
              >
                <div className="mt-1">
                  {f.type === "email_failed" ? (
                    <MailX className="h-4 w-4 text-red-400" />
                  ) : (
                    <MessageSquareX className={`h-4 w-4 ${f.type === "sms_skipped" ? "text-yellow-400" : "text-red-400"}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={f.type === "sms_skipped" ? "secondary" : "destructive"}>
                      {f.type === "sms_failed" ? "SMS failed" : f.type === "sms_skipped" ? "SMS skipped" : "Email failed"}
                    </Badge>
                    {f.accessCode && (
                      <span className="font-mono text-sm font-medium" data-testid={`text-code-${f.id}`}>{f.accessCode}</span>
                    )}
                    {f.resolved && (
                      <Badge variant="outline" className="text-green-600 border-green-600/40">Handled</Badge>
                    )}
                  </div>
                  <p className="text-sm mt-1 break-words">
                    {f.email && <span className="mr-3">{f.email}</span>}
                    {f.phone && <span className="font-mono">{f.phone}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(f.createdAt).toLocaleString()}
                    {f.resolved && f.resolvedAt && ` — handled ${new Date(f.resolvedAt).toLocaleString()}`}
                  </p>
                </div>
                {!f.resolved && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate({ id: f.id })}
                    data-testid={`button-resolve-${f.id}`}
                  >
                    <Check className="h-4 w-4 mr-1" /> Mark handled
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ title, value, icon, loading }: { title: string, value: string | null, icon: React.ReactNode, loading: boolean }) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="p-2 bg-secondary rounded-full">{icon}</div>
        </div>
        <div className="mt-4">
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-bold font-mono">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
