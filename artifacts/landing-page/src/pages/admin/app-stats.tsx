import { useState } from "react";
import { AdminLayout } from "@/components/admin/layout";
import { useListAppStats, useUpdateAppStat } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, TrendingUp, Users } from "lucide-react";

const APP_META: Record<string, { label: string; color: string }> = {
  MyLitAI: { label: "Litigation", color: "#D4AF37" },
  MySyalitAI: { label: "Syariah Litigation", color: "#C8A02A" },
  MyCorpAI: { label: "Corporate Secretary", color: "#E0C050" },
  MyConveyAI: { label: "Conveyancing", color: "#D4AF37" },
  MyCrimAI: { label: "Criminal Law", color: "#C8A02A" },
  MyCorpCommBankLitAi: { label: "Corp / Comm / Banking", color: "#E0C050" },
  MyAccidentAi: { label: "Accident & PI", color: "#D4AF37" },
};

export default function AdminAppStats() {
  const { data: stats, isLoading } = useListAppStats();
  const updateMutation = useUpdateAppStat();

  const [editing, setEditing] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const total = stats?.reduce((sum, s) => sum + s.subscriberCount, 0) ?? 0;

  const handleUpdate = async (appName: string) => {
    const count = editing[appName];
    if (typeof count !== "number") return;

    setSaving((prev) => ({ ...prev, [appName]: true }));
    try {
      await updateMutation.mutateAsync({ appName, data: { subscriberCount: count } });
      setEditing((prev) => {
        const next = { ...prev };
        delete next[appName];
        return next;
      });
    } finally {
      setSaving((prev) => ({ ...prev, [appName]: false }));
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">App Subscriber Counts</h1>
            <p className="text-muted-foreground mt-1">
              Manage real subscriber counts from each individual app&apos;s admin board.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Total Subscribers</p>
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-4">
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold font-mono">{total.toLocaleString()}</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Apps Tracked</p>
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-4">
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold font-mono">{stats?.length ?? 0}</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Landing Page Purchases</p>
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold font-mono text-muted-foreground">0</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Per-App Counts</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {stats?.map((stat) => {
                  const meta = APP_META[stat.appName] ?? { label: stat.appName, color: "#D4AF37" };
                  const isEditing = stat.appName in editing;
                  const value = isEditing ? editing[stat.appName] : stat.subscriberCount;
                  return (
                    <div
                      key={stat.appName}
                      className="flex items-center justify-between p-3 bg-secondary/40 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        <div>
                          <p className="font-medium text-sm">{stat.appName}</p>
                          <p className="text-xs text-muted-foreground">{meta.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          value={value}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [stat.appName]: Math.max(0, parseInt(e.target.value, 10) || 0),
                            }))
                          }
                          className="w-24 text-right font-mono"
                        />
                        {isEditing ? (
                          <Button
                            size="sm"
                            onClick={() => handleUpdate(stat.appName)}
                            disabled={saving[stat.appName]}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            {saving[stat.appName] ? "Saving..." : "Save"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
