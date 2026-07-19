import { useAuth } from "@/lib/auth";
import { useListUsers } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useT, useLabels } from "@/lib/i18n";

export function UserSwitcher() {
  const { currentUser, setCurrentUser } = useAuth();
  const { data: users, isLoading } = useListUsers();
  const t = useT();
  const labels = useLabels();

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  if (!users) return null;

  // Manager access is gated behind the passcode (see ManagerAccess); the
  // switcher only ever exposes staff identities so a manager profile cannot be
  // selected directly to bypass the gate.
  const staffUsers = users.filter((u) => u.role !== "manager");

  return (
    <Select
      value={currentUser?.id.toString() || ""}
      onValueChange={(val) => {
        const user = staffUsers.find((u) => u.id.toString() === val);
        if (user) setCurrentUser(user);
      }}
    >
      <SelectTrigger className="w-full bg-sidebar-accent/50 border border-sidebar-border/40 text-sidebar-accent-foreground h-14 rounded-xl hover:bg-sidebar-accent transition-colors shadow-sm font-medium">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 ring-2 ring-primary/20 shadow-sm">
            <AvatarFallback className="text-sm font-bold bg-sidebar-primary text-sidebar-primary-foreground jewel-gradient">
              {currentUser?.name.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
          <SelectValue placeholder={t("common.selectUser")} />
        </div>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-sidebar-border/40 font-medium">
        {staffUsers.map((u) => (
          <SelectItem key={u.id} value={u.id.toString()} className="py-2.5 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="font-semibold">{u.name}</span>
                {u.title && <span className="text-xs text-muted-foreground">{u.title}</span>}
              </div>
              <span className="text-xs text-muted-foreground ml-auto px-2 py-0.5 bg-muted/50 rounded-md border border-border/40">{labels.role(u.role)}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
