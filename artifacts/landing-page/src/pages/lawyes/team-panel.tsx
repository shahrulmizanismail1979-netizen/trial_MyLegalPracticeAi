import { useState } from "react";
import { useForm } from "react-hook-form";
import { Copy, Loader2, ShieldCheck, UserMinus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type LawyesRole,
  useLawyesAudit,
  useLawyesGrants,
  useLawyesInvite,
  useLawyesMembers,
  useLawyesRemoveGrant,
  useLawyesRevokeMember,
  useLawyesSetGrant,
  useLawyesUpdateMember,
} from "./api";

type InviteFields = { name: string; email: string; role: LawyesRole };

export function TeamPanel({
  open,
  onOpenChange,
  matterId,
  matterTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matterId?: string;
  matterTitle?: string;
}) {
  const members = useLawyesMembers(open);
  const grants = useLawyesGrants(open ? matterId : undefined);
  const audit = useLawyesAudit(open);
  const invite = useLawyesInvite();
  const updateMember = useLawyesUpdateMember();
  const revoke = useLawyesRevokeMember();
  const setGrant = useLawyesSetGrant(matterId);
  const removeGrant = useLawyesRemoveGrant(matterId);
  const [personalCode, setPersonalCode] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteFields>({
    defaultValues: { name: "", email: "", role: "viewer" },
  });

  const submitInvite = handleSubmit((values) => {
    invite.mutate(
      { name: values.name.trim(), role: values.role, ...(values.email.trim() ? { email: values.email.trim() } : {}) },
      {
        onSuccess: (result) => {
          setPersonalCode(result.personalCode);
          setCopyMessage("");
          reset();
        },
      },
    );
  });

  const copyCode = async () => {
    if (!personalCode) return;
    try {
      await navigator.clipboard.writeText(personalCode);
      setCopyMessage("Code copied.");
    } catch {
      const input = document.createElement("textarea");
      input.value = personalCode;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      setCopyMessage(copied ? "Code copied." : "Copy unavailable. Select and copy the code manually.");
    }
  };

  const activeMembers = members.data?.filter((member) => !member.revokedAt) ?? [];
  const revokedMembers = members.data?.filter((member) => member.revokedAt) ?? [];
  const grantByMember = new Map(grants.data?.map((grant) => [grant.memberId, grant]));
  const pending = updateMember.isPending || revoke.isPending || setGrant.isPending || removeGrant.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2 font-serif text-xl">
            <Users className="h-5 w-5 text-primary" /> Team management
          </DialogTitle>
          <DialogDescription>Invite members and control access to the selected matter.</DialogDescription>
        </DialogHeader>

        <div className="space-y-7 px-6 pb-6">
          <section aria-labelledby="invite-heading">
            <h3 id="invite-heading" className="mb-3 text-sm font-semibold text-slate-900">Invite a member</h3>
            <form onSubmit={submitInvite} className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="team-name">Name</Label>
                <Input id="team-name" data-testid="input-team-name" className="mt-1" {...register("name", { required: "Name is required" })} />
                {errors.name && <p className="mt-1 text-xs text-red-600" role="alert">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="team-email">Email (optional)</Label>
                <Input id="team-email" data-testid="input-team-email" type="email" className="mt-1" {...register("email")} />
              </div>
              <div>
                <Label htmlFor="team-role">Default tenant role</Label>
                <select id="team-role" data-testid="select-team-role" className="mt-1 h-9 w-full rounded-md border bg-white px-3 text-sm" {...register("role")}>
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button data-testid="button-invite-member" type="submit" className="w-full" disabled={invite.isPending}>
                  {invite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Invite member
                </Button>
              </div>
            </form>
            {invite.error && <p className="mt-2 text-sm text-red-600" role="alert" data-testid="status-invite-error">{invite.error.message}</p>}
            {personalCode && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4" data-testid="status-personal-code">
                <p className="text-sm font-semibold text-amber-900">Personal sign-in code</p>
                <p className="mt-1 text-xs text-amber-800">This code is shown once. Copy it now and share it securely.</p>
                <div className="mt-3 flex gap-2">
                  <code className="min-w-0 flex-1 select-all overflow-x-auto rounded border bg-white px-3 py-2 text-sm" data-testid="text-personal-code">{personalCode}</code>
                  <Button type="button" variant="outline" onClick={copyCode} aria-label="Copy personal sign-in code" data-testid="button-copy-personal-code">
                    <Copy className="mr-2 h-4 w-4" /> Copy
                  </Button>
                </div>
                {copyMessage && <p className="mt-2 text-xs text-amber-900" role="status" data-testid="status-copy-code">{copyMessage}</p>}
              </div>
            )}
          </section>

          <section aria-labelledby="members-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 id="members-heading" className="text-sm font-semibold text-slate-900">Members</h3>
              {matterId && <span className="truncate text-xs text-slate-500">Matter: {matterTitle}</span>}
            </div>
            {members.isLoading && <p className="text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading members…</p>}
            {members.error && <p className="text-sm text-red-600" role="alert">{members.error.message}</p>}
            {!members.isLoading && activeMembers.length === 0 && <p className="rounded-lg border p-4 text-sm text-slate-500">No team members yet.</p>}
            <div className="space-y-2">
              {activeMembers.map((member) => {
                const grant = grantByMember.get(member.id);
                return (
                  <div key={member.id} className="rounded-lg border p-3" data-testid={`row-member-${member.id}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-[140px] flex-1">
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-slate-500">{member.email || "No email"}</p>
                      </div>
                      <label className="text-xs text-slate-600">
                        Tenant role
                        <select
                          aria-label={`Tenant role for ${member.name}`}
                          data-testid={`select-member-role-${member.id}`}
                          className="ml-2 h-8 rounded border bg-white px-2 text-xs"
                          value={member.role}
                          disabled={pending}
                          onChange={(event) => updateMember.mutate({ memberId: member.id, role: event.target.value as LawyesRole })}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="owner">Owner</option>
                        </select>
                      </label>
                      {matterId && (
                        <label className="text-xs text-slate-600">
                          Matter access
                          <select
                            aria-label={`Matter access for ${member.name}`}
                            data-testid={`select-matter-grant-${member.id}`}
                            className="ml-2 h-8 rounded border bg-white px-2 text-xs"
                            value={grant?.role ?? "none"}
                            disabled={pending || grants.isLoading}
                            onChange={(event) => {
                              const role = event.target.value;
                              if (role === "none") removeGrant.mutate(member.id);
                              else setGrant.mutate({ memberId: member.id, role: role as LawyesRole });
                            }}
                          >
                            <option value="none">No access</option>
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                            <option value="owner">Owner</option>
                          </select>
                        </label>
                      )}
                      <Button type="button" variant="ghost" size="sm" className="text-red-600" disabled={pending} onClick={() => revoke.mutate(member.id)} data-testid={`button-revoke-member-${member.id}`} aria-label={`Revoke ${member.name}`}>
                        <UserMinus className="mr-1 h-4 w-4" /> Revoke
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {revokedMembers.length > 0 && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-slate-500" data-testid="button-show-revoked">Revoked members ({revokedMembers.length})</summary>
                <div className="mt-2 space-y-1">
                  {revokedMembers.map((member) => <div key={member.id} className="rounded border bg-slate-50 px-3 py-2 text-slate-500">{member.name} · {member.role}</div>)}
                </div>
              </details>
            )}
          </section>

          <section aria-labelledby="audit-heading">
            <h3 id="audit-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> Audit history</h3>
            {audit.isLoading && <p className="text-sm text-slate-500">Loading audit history…</p>}
            {audit.error && <p className="text-sm text-red-600" role="alert">{audit.error.message}</p>}
            {!audit.isLoading && audit.data?.length === 0 && <p className="text-sm text-slate-500">No audit activity yet.</p>}
            <div className="max-h-48 divide-y overflow-y-auto rounded-lg border">
              {audit.data?.map((event) => (
                <div key={event.id} className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 text-xs" data-testid={`row-audit-${event.id}`}>
                  <div>
                    <span className="font-medium">{event.action}</span>
                    <span className="text-slate-500"> · {event.resourceType} {event.resourceId}</span>
                    {(event.details.fromRole || event.details.toRole || event.details.role) && (
                      <span className="ml-2 text-slate-500">
                        {event.details.fromRole ? `${event.details.fromRole} → ` : ""}{event.details.toRole || event.details.role}
                      </span>
                    )}
                  </div>
                  <time className="text-slate-400" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}