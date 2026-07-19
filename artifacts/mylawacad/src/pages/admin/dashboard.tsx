import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Crown,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  ScrollText,
  KeyRound,
  ChevronRight,
} from "lucide-react";
import {
  useListAdminUsers,
  useUpdateAdminUser,
  useDeleteAdminUser,
  useResetAdminUserPassword,
  useListAdminExamTemplates,
  useDeleteAdminExamTemplate,
  useGetAdminStats,
  getListAdminUsersQueryKey,
  getListAdminExamTemplatesQueryKey,
  getGetAdminStatsQueryKey,
  type AuthUser,
} from "@/lib/api-client";
import {
  CinematicShell,
  PageHeader,
  SpotlightCard,
  StatPill,
  GhostButton,
  VioletButton,
  FlickerBadge,
} from "@/components/cinematic";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";

type Tab = "teachers" | "templates";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("teachers");

  const stats = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey() },
  });

  return (
    <CinematicShell>
      <PageHeader
        eyebrow={`Admin · ${user?.name ?? ""}`}
        title="Mission Control"
        description="Manage every teacher account and every exam blueprint on the platform."
        right={
          <div className="flex flex-wrap gap-3 items-center">
            <FlickerBadge tone="warning">Superuser</FlickerBadge>
            <Link
              href="/admin/health"
              data-testid="admin-health-link"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 text-xs font-bold uppercase tracking-widest hover:bg-fuchsia-500/20"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Platform Health
            </Link>
            <GhostButton
              onClick={async () => {
                await logout();
                navigate("/");
              }}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </GhostButton>
          </div>
        }
      />

      <section className="container mx-auto px-6 pb-10">
        <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-4">
          <StatPill
            label="Users total"
            value={stats.data?.users.total ?? 0}
          />
          <StatPill
            label="Admins"
            value={stats.data?.users.admins ?? 0}
            accent="warn"
          />
          <StatPill
            label="Suspended"
            value={stats.data?.users.suspended ?? 0}
            accent="bad"
          />
          <StatPill
            label="Templates"
            value={stats.data?.templates ?? 0}
          />
          <StatPill
            label="Sessions"
            value={stats.data?.sessions.total ?? 0}
            accent="good"
          />
        </div>
      </section>

      <section className="container mx-auto px-6 pb-20 space-y-6">
        <div className="flex items-center gap-2">
          <TabButton active={tab === "teachers"} onClick={() => setTab("teachers")} testId="tab-teachers">
            <Users className="h-4 w-4" /> Teachers
          </TabButton>
          <TabButton active={tab === "templates"} onClick={() => setTab("templates")} testId="tab-templates">
            <ScrollText className="h-4 w-4" /> Exam templates
          </TabButton>
        </div>

        {tab === "teachers" ? <TeachersPanel selfId={user?.id ?? ""} /> : <TemplatesPanel />}
      </section>
    </CinematicShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm uppercase tracking-[0.2em] border transition ${
        active
          ? "bg-gradient-to-r from-fuchsia-500/30 to-amber-400/30 border-white/30 text-white"
          : "border-white/10 text-muted-foreground hover:text-white hover:border-white/25"
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Teachers panel
// ---------------------------------------------------------------------------

function TeachersPanel({ selfId }: { selfId: string }) {
  const qc = useQueryClient();
  const users = useListAdminUsers({
    query: { queryKey: getListAdminUsersQueryKey() },
  });
  const update = useUpdateAdminUser();
  const remove = useDeleteAdminUser();
  const resetPw = useResetAdminUserPassword();
  const stats = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey() },
  });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [tempPw, setTempPw] = useState<{ id: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    await Promise.all([users.refetch(), stats.refetch()]);
    await qc.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
  };

  const wrap = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SpotlightCard className="!p-0 overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
        <h2 className="font-display text-xl font-bold flex items-center gap-2">
          <UserCog className="h-5 w-5 text-fuchsia-300" /> Teacher accounts
        </h2>
        <GhostButton type="button" onClick={refresh}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </GhostButton>
      </div>

      {error ? (
        <div
          data-testid="text-teachers-error"
          className="mx-6 mt-4 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2"
        >
          {error}
        </div>
      ) : null}

      {tempPw ? (
        <div
          data-testid="text-temp-password"
          className="mx-6 mt-4 text-sm bg-amber-500/10 border border-amber-400/40 text-amber-100 rounded-lg px-4 py-3"
        >
          <div className="font-semibold mb-1 inline-flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> One-time temp password (shown once)
          </div>
          <div className="font-mono text-base tracking-[0.2em] select-all">
            {tempPw.password}
          </div>
          <button
            type="button"
            className="mt-2 text-xs underline"
            onClick={() => setTempPw(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[0.6rem] uppercase tracking-[0.25em] text-muted-foreground">
            <tr className="border-b border-white/5">
              <th className="text-left px-6 py-3">Account</th>
              <th className="text-left px-3 py-3">Role</th>
              <th className="text-left px-3 py-3">Status</th>
              <th className="text-left px-3 py-3">Last login</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : users.data && users.data.users.length > 0 ? (
              users.data.users.map((u: AuthUser) => {
                const isSelf = u.id === selfId;
                const isBusy = busyId === u.id;
                return (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-white/5 last:border-0"
                    data-testid={`row-user-${u.id}`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`text-[0.6rem] uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${
                          u.role === "admin"
                            ? "border-amber-400/40 text-amber-200 bg-amber-500/10"
                            : "border-white/10 text-muted-foreground"
                        }`}
                      >
                        {u.role === "admin" ? (
                          <span className="inline-flex items-center gap-1">
                            <Crown className="h-3 w-3" /> admin
                          </span>
                        ) : (
                          "teacher"
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`text-[0.6rem] uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${
                          u.status === "active"
                            ? "border-emerald-400/40 text-emerald-200 bg-emerald-500/10"
                            : "border-rose-400/40 text-rose-200 bg-rose-500/10"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-xs text-muted-foreground">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2 justify-end">
                        {!isSelf ? (
                          <>
                            <SmallButton
                              testId={`button-toggle-status-${u.id}`}
                              disabled={isBusy}
                              onClick={() =>
                                wrap(u.id, () =>
                                  update.mutateAsync({
                                    id: u.id,
                                    data: {
                                      status:
                                        u.status === "active"
                                          ? "suspended"
                                          : "active",
                                    },
                                  }),
                                )
                              }
                            >
                              {u.status === "active" ? (
                                <>
                                  <ShieldAlert className="h-3.5 w-3.5" /> Suspend
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="h-3.5 w-3.5" /> Activate
                                </>
                              )}
                            </SmallButton>
                            <SmallButton
                              testId={`button-toggle-role-${u.id}`}
                              disabled={isBusy}
                              onClick={() =>
                                wrap(u.id, () =>
                                  update.mutateAsync({
                                    id: u.id,
                                    data: {
                                      role:
                                        u.role === "admin" ? "teacher" : "admin",
                                    },
                                  }),
                                )
                              }
                            >
                              {u.role === "admin" ? "Demote" : "Promote"}
                            </SmallButton>
                            <SmallButton
                              testId={`button-reset-pw-${u.id}`}
                              disabled={isBusy}
                              onClick={() =>
                                wrap(u.id, async () => {
                                  const r = await resetPw.mutateAsync({ id: u.id });
                                  setTempPw({ id: u.id, password: r.tempPassword });
                                })
                              }
                            >
                              <KeyRound className="h-3.5 w-3.5" /> Reset password
                            </SmallButton>
                            <SmallButton
                              testId={`button-delete-user-${u.id}`}
                              tone="danger"
                              disabled={isBusy}
                              onClick={() => {
                                if (
                                  !confirm(
                                    `Delete ${u.email}? Their templates will become unowned (admin-only access).`,
                                  )
                                )
                                  return;
                                void wrap(u.id, () =>
                                  remove.mutateAsync({ id: u.id }),
                                );
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </SmallButton>
                          </>
                        ) : (
                          <span className="text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                  No accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SpotlightCard>
  );
}

// ---------------------------------------------------------------------------
// Templates panel
// ---------------------------------------------------------------------------

function TemplatesPanel() {
  const qc = useQueryClient();
  const templates = useListAdminExamTemplates({
    query: { queryKey: getListAdminExamTemplatesQueryKey() },
  });
  const remove = useDeleteAdminExamTemplate();
  const stats = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey() },
  });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    await Promise.all([templates.refetch(), stats.refetch()]);
    await qc.invalidateQueries({ queryKey: getListAdminExamTemplatesQueryKey() });
  };

  return (
    <SpotlightCard className="!p-0 overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
        <h2 className="font-display text-xl font-bold flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-amber-300" /> Every exam template
        </h2>
        <GhostButton type="button" onClick={refresh}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </GhostButton>
      </div>

      {error ? (
        <div className="mx-6 mt-4 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[0.6rem] uppercase tracking-[0.25em] text-muted-foreground">
            <tr className="border-b border-white/5">
              <th className="text-left px-6 py-3">Title</th>
              <th className="text-left px-3 py-3">Creator</th>
              <th className="text-left px-3 py-3">Code</th>
              <th className="text-left px-3 py-3">Status</th>
              <th className="text-right px-3 py-3">Attempts</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : templates.data && templates.data.templates.length > 0 ? (
              templates.data.templates.map((t) => {
                const isBusy = busyId === t.id;
                return (
                  <tr
                    key={t.id}
                    className="border-b border-white/5 last:border-0"
                    data-testid={`row-template-${t.id}`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold">{t.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.appSlugs.length} apps · {t.totalQuestions} questions
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-sm">
                        {t.creatorName ?? (
                          <span className="text-muted-foreground italic">
                            unowned
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.creatorEmail ?? "—"}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <span className="font-mono text-amber-300 text-sm tracking-[0.2em] select-all">
                        {t.code}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`text-[0.6rem] uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${
                          t.status === "open"
                            ? "border-emerald-400/40 text-emerald-200 bg-emerald-500/10"
                            : "border-white/10 text-muted-foreground"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums">
                      {t.attemptCount}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          href={`/examiner/templates/${t.id}`}
                          data-testid={`link-admin-template-${t.id}`}
                        >
                          <SmallButton type="button">
                            Open <ChevronRight className="h-3.5 w-3.5" />
                          </SmallButton>
                        </Link>
                        <SmallButton
                          testId={`button-admin-delete-template-${t.id}`}
                          tone="danger"
                          disabled={isBusy}
                          onClick={async () => {
                            if (
                              !confirm(
                                `Force-delete "${t.title}"? All attempts will be wiped.`,
                              )
                            )
                              return;
                            setBusyId(t.id);
                            setError(null);
                            try {
                              await remove.mutateAsync({ id: t.id });
                              await refresh();
                            } catch (e) {
                              setError(
                                e instanceof Error ? e.message : String(e),
                              );
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </SmallButton>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                  No templates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between text-xs text-muted-foreground">
        <span>Click any row to open the template detail view.</span>
        <Link href="/examiner/dashboard" data-testid="link-back-to-studio">
          <VioletButton type="button">Open studio</VioletButton>
        </Link>
      </div>
    </SpotlightCard>
  );
}

function SmallButton({
  children,
  onClick,
  disabled,
  testId,
  tone = "default",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  testId?: string;
  tone?: "default" | "danger";
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs uppercase tracking-[0.18em] border transition disabled:opacity-50 ${
        tone === "danger"
          ? "border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
          : "border-white/15 text-muted-foreground hover:text-white hover:border-white/30"
      }`}
    >
      {children}
    </button>
  );
}
