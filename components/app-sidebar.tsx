import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/sidebar-nav";
import { SidebarUserMenu } from "@/components/sidebar-user-menu";
import Link from "next/link";
import { Zap } from "lucide-react";

interface AppSidebarProps {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    role?: string;
  } | null;
}

export function AppSidebar({ user }: AppSidebarProps) {

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <Link href="/" className="group flex items-center gap-3">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
              style={{
                background:
                  "linear-gradient(135deg, rgb(var(--accent-rgb)), rgb(var(--accent-rgb-2)))",
                boxShadow:
                  "0 0 calc(28px * var(--glow)) rgba(var(--accent-rgb) / calc(0.7 * var(--glow))), inset 0 1px 0 rgba(255,255,255,0.3)",
              }}
            >
              <Zap className="h-[17px] w-[17px]" fill="currentColor" />
            </span>
            <span className="font-display text-lg font-bold tracking-[-0.02em] truncate group-data-[collapsible=icon]:hidden">
              BlogTonio<span className="grad-text">.code</span>
            </span>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarNav />
      </SidebarContent>

      <SidebarFooter>
        <SidebarUserMenu
          user={
            user
              ? {
                  name: user.name,
                  email: user.email,
                  image: user.image,
                }
              : null
          }
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
