import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Radar, AlertCircle, Inbox, User as UserIcon, BarChart2, CalendarDays, Target, BookOpen, Languages, FileText, Mic, Inbox as InboxIcon, Trophy, MessageCircle, History, Users, Landmark } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useT, useLanguage, LANGUAGES, type Lang } from "@/lib/i18n";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UserSwitcher } from "../UserSwitcher";
import { ManagerAccess } from "../ManagerAccess";
import { ContactReminderDialog } from "../ContactReminderDialog";
import { ExportPageButton } from "../ExportPageButton";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isManager, currentUser } = useAuth();
  const t = useT();
  const { lang, setLang } = useLanguage();
  const [contactOpen, setContactOpen] = useState(false);
  const remindersOn = Boolean(currentUser?.whatsappOptIn);
  const contentRef = useRef<HTMLDivElement>(null);
  const exportName = location.replace(/^\//, "").replace(/\//g, "-") || "urgent";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <Sidebar className="border-r border-sidebar-border bg-sidebar shadow-[0_0_40px_rgba(0,0,0,0.5)] z-20">
          <SidebarHeader className="h-16 flex items-center px-4 border-b border-sidebar-border/50 bg-gradient-to-b from-sidebar to-sidebar/90">
            <div className="flex items-center gap-3 font-serif font-bold text-xl text-sidebar-primary-foreground group">
              <div className="p-1.5 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.5)] jewel-gradient group-hover:scale-105 transition-transform">
                <Radar className="w-5 h-5 animate-pulse" />
              </div>
              <span className="tracking-widest uppercase text-sm drop-shadow-md">{t("brand.name")}</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="py-4 px-2">
            <SidebarGroup>
              <SidebarGroupLabel>{t("nav.group.tasks")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/urgent" || location === "/"}>
                      <Link href="/urgent" className="flex items-center gap-3">
                        <AlertCircle className="w-4 h-4" />
                        <span>{t("nav.urgent")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/backlog"}>
                      <Link href="/backlog" className="flex items-center gap-3">
                        <Inbox className="w-4 h-4" />
                        <span>{t("nav.backlog")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/mine"}>
                      <Link href="/mine" className="flex items-center gap-3">
                        <UserIcon className="w-4 h-4" />
                        <span>{t("nav.mine")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/digest"}>
                      <Link href="/digest" className="flex items-center gap-3">
                        <CalendarDays className="w-4 h-4" />
                        <span>{t("nav.digest")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>{t("nav.group.capture")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/meetings" || location.startsWith("/meeting/")}>
                      <Link href="/meetings" className="flex items-center gap-3">
                        <FileText className="w-4 h-4" />
                        <span>{t("nav.meetings")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/voice"}>
                      <Link href="/voice" className="flex items-center gap-3">
                        <Mic className="w-4 h-4" />
                        <span>{t("nav.voice")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/inbox"}>
                      <Link href="/inbox" className="flex items-center gap-3">
                        <InboxIcon className="w-4 h-4" />
                        <span>{t("nav.inbox")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>{t("nav.group.manage")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/goals"}>
                      <Link href="/goals" className="flex items-center gap-3">
                        <Target className="w-4 h-4" />
                        <span>{t("nav.goals")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/recognition"}>
                      <Link href="/recognition" className="flex items-center gap-3">
                        <Trophy className="w-4 h-4" />
                        <span>{t("nav.recognition")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {isManager && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/dashboard"}>
                        <Link href="/dashboard" className="flex items-center gap-3">
                          <BarChart2 className="w-4 h-4" />
                          <span>{t("nav.dashboard")}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {isManager && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/activity"}>
                        <Link href="/activity" className="flex items-center gap-3">
                          <History className="w-4 h-4" />
                          <span>{t("nav.activity")}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {isManager && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/hr"}>
                        <Link href="/hr" className="flex items-center gap-3">
                          <Users className="w-4 h-4" />
                          <span>{t("nav.hr")}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {isManager && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/accounts"}>
                        <Link href="/accounts" className="flex items-center gap-3">
                          <Landmark className="w-4 h-4" />
                          <span>{t("nav.accounts")}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>{t("nav.group.help")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/manual"}>
                      <Link href="/manual" className="flex items-center gap-3">
                        <BookOpen className="w-4 h-4" />
                        <span>{t("nav.manual")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border space-y-3">
            <ManagerAccess />
            {!isManager && <UserSwitcher />}
            {currentUser && (
              <Button
                variant="outline"
                className="w-full justify-start h-10 rounded-xl text-xs font-semibold border-sidebar-border/50 bg-sidebar-accent/30 text-sidebar-accent-foreground hover:bg-sidebar-accent"
                onClick={() => setContactOpen(true)}
              >
                <MessageCircle className="w-4 h-4 mr-2 text-primary" />
                <span className="flex-1 text-left">{t("contact.button")}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    remindersOn
                      ? "bg-primary/20 text-primary"
                      : "bg-muted-foreground/15 text-muted-foreground"
                  }`}
                >
                  {remindersOn ? t("contact.on") : t("contact.off")}
                </span>
              </Button>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground/70 px-1">
                <Languages className="w-3.5 h-3.5" />
                <span>{t("nav.language")}</span>
              </div>
              <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SidebarFooter>
        </Sidebar>
        <main ref={contentRef} className="flex-1 overflow-auto">
          <div
            data-export-hide
            className="sticky top-0 z-30 flex justify-end px-4 py-2 border-b border-border/40 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60"
          >
            <ExportPageButton targetRef={contentRef} name={exportName} />
          </div>
          <div>{children}</div>
        </main>
      </div>
      <ContactReminderDialog open={contactOpen} onOpenChange={setContactOpen} />
    </SidebarProvider>
  );
}
