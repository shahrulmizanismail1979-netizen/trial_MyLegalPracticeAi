import { Route, Switch } from "wouter";
import { useAuth } from "./use-auth";
import { AuthView } from "./auth-view";
import { WorkspaceShell } from "./workspace-shell";

export default function LawYesApp() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="animate-pulse font-serif text-2xl font-medium tracking-tight">
          LAW<span className="italic text-primary">Yes</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthView />;
  }

  return (
    <Switch>
      <Route path="/lawyes" component={WorkspaceShell} />
      <Route path="/lawyes/:matterId" component={WorkspaceShell} />
    </Switch>
  );
}
