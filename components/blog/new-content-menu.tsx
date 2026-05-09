"use client";

import Link from "next/link";
import { Plus, FileText, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/locales/client";

export function NewContentMenu() {
  const t = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t("nav.write")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href="/blog/new" className="cursor-pointer">
            <FileText className="h-4 w-4" />
            {t("nav.write.newArticle")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/categories/new" className="cursor-pointer">
            <FolderPlus className="h-4 w-4" />
            {t("nav.write.newCategory")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
