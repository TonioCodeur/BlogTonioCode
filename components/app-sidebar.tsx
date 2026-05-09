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
          <Link href="/dashboard" className="flex items-center gap-2">
            <svg
              width="24"
              height="24"
              viewBox="0 0 38 38"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="shrink-0"
            >
              <circle
                cx="19"
                cy="19"
                r="18"
                className="fill-primary"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M13 25L25 13M15 13H25V23"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="dark:stroke-background"
              />
            </svg>
            <span className="font-bold text-lg tracking-tight truncate group-data-[collapsible=icon]:hidden">
              Ship<span className="text-muted-foreground">Stack</span>
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
