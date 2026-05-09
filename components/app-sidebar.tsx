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
import { Code2 } from "lucide-react";

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
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Code2 className="h-5 w-5" />
            </span>
            <span className="font-mono font-bold text-lg tracking-tight truncate group-data-[collapsible=icon]:hidden">
              Blog<span className="text-primary">Tonio</span>Code
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
