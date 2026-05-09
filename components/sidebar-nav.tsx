"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, User, Settings, ShieldAlert, MessageSquare, Bot } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useI18n } from "@/locales/client";
import { useSession } from "@/lib/auth-client";
import {
  MessagesUnreadBadge,
  MessagesUnreadDot,
} from "@/components/messages-unread-badge";

type SidebarUser = {
  role?: string;
};

type SidebarSession = {
  user?: SidebarUser;
};

export function SidebarNav() {
  const t = useI18n();
  const pathname = usePathname();
  const { data: session } = useSession() as { data: SidebarSession | null };
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  type NavItem = {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    showUnreadBadge?: boolean;
  };

  const items: NavItem[] = [
    {
      href: "/dashboard",
      label: t("sidebar.nav.dashboard"),
      icon: LayoutDashboard,
    },
    {
      href: "/messages",
      label: t("messages.nav"),
      icon: MessageSquare,
      showUnreadBadge: true,
    },
    {
      href: "/profile",
      label: t("sidebar.nav.profile"),
      icon: User,
    },
    {
      href: "/settings",
      label: t("sidebar.nav.settings"),
      icon: Settings,
    },
    ...(isAdmin
      ? [
          {
            href: "/admin",
            label: t("sidebar.nav.admin"),
            icon: ShieldAlert,
          },
          {
            href: "/admin/bots",
            label: t("sidebar.nav.adminBots"),
            icon: Bot,
          },
        ]
      : []),
  ];

  return (
    <SidebarMenu>
      {items.map((item) => {
        const isActive = pathname.endsWith(item.href);
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
              <Link href={item.href}>
                {item.showUnreadBadge ? (
                  <span className="relative flex shrink-0 items-center">
                    <item.icon />
                    <MessagesUnreadDot />
                  </span>
                ) : (
                  <item.icon />
                )}
                <span>{item.label}</span>
                {item.showUnreadBadge && <MessagesUnreadBadge />}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
