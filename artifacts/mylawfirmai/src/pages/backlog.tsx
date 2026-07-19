import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListTasks, useListUsers } from "@/lib/api-client";
import { TaskGrid } from "@/components/TaskGrid";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Inbox } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export default function BacklogPage() {
  const { currentUser, isManager } = useAuth();
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState(() =>
    !isManager && currentUser ? currentUser.id.toString() : "all"
  );
  useEffect(() => {
    setOwnerFilter(!isManager && currentUser ? currentUser.id.toString() : "all");
  }, [currentUser?.id, isManager]);
  const t = useT();
  const { data: users } = useListUsers();
  const { data: tasks, isLoading } = useListTasks({
    category: "backlog",
    search: search || undefined,
    ownerId: ownerFilter !== "all" ? parseInt(ownerFilter) : undefined,
  });

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-serif font-bold tracking-tight text-foreground flex items-center gap-3 drop-shadow-sm jewel-gradient-text">
              <Inbox className="w-8 h-8 text-secondary" />
              {t("backlog.title")}
            </h1>
            <p className="text-muted-foreground mt-2 text-base font-medium">{t("backlog.subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 bg-card/60 p-2.5 rounded-2xl border border-border/40 shadow-inner">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t("backlog.search")}
                className="pl-10 bg-background border-border/60 focus-visible:ring-primary shadow-sm font-medium rounded-xl h-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-48 bg-background border-border/60 shadow-sm font-medium rounded-xl h-10" aria-label={t("filter.owner.label")}>
                <SelectValue placeholder={t("filter.owner.all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-medium">{t("filter.owner.all")}</SelectItem>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={u.id.toString()} className="font-medium">{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CreateTaskDialog />
          </div>
        </header>

        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 rounded-2xl bg-card/40 animate-pulse border border-border/40 shadow-sm" />
            ))}
          </div>
        ) : tasks?.length === 0 ? (
          <div className="glass-card border-dashed border-2 border-border/60 rounded-3xl p-16 text-center flex flex-col items-center justify-center bg-gradient-to-b from-card/40 to-transparent shadow-sm">
            <div className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6 shadow-inner ring-2 ring-primary/20">
              <Inbox className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-serif font-bold mb-3 text-foreground tracking-tight">{t("backlog.emptyTitle")}</h2>
            <p className="text-muted-foreground max-w-sm text-base font-medium">
              {t("backlog.emptyBody")}
            </p>
          </div>
        ) : (
          <TaskGrid
            tasks={[
              ...(tasks?.filter(t => t.staleFlag && t.status !== "done") ?? []),
              ...(tasks?.filter(t => !t.staleFlag && t.status !== "done") ?? []),
            ]}
          />
        )}
      </div>
    </AppLayout>
  );
}
