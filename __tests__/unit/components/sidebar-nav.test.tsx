import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarNav } from "@/components/sidebar-nav";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUsePathname = vi.fn<() => string>().mockReturnValue("/dashboard");

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));

// Stub shadcn sidebar primitives to avoid SidebarProvider context requirement
vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenu: ({ children }: React.PropsWithChildren) => <ul>{children}</ul>,
  SidebarMenuItem: ({ children }: React.PropsWithChildren) => <li>{children}</li>,
  SidebarMenuButton: ({
    children,
    asChild,
    isActive,
    tooltip,
  }: React.PropsWithChildren<{
    asChild?: boolean;
    isActive?: boolean;
    tooltip?: string;
  }>) =>
    asChild ? (
      <span data-testid="sidebar-btn" data-active={isActive} title={tooltip}>
        {children}
      </span>
    ) : (
      <button data-testid="sidebar-btn" data-active={isActive} title={tooltip}>
        {children}
      </button>
    ),
}));

vi.mock("@/locales/client", () => ({
  useI18n: () => (key: string) => {
    const translations: Record<string, string> = {
      "sidebar.nav.dashboard": "Dashboard",
      "sidebar.nav.profile": "Profile",
      "sidebar.nav.settings": "Settings",
    };
    return translations[key] ?? key;
  },
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SidebarNav", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Rendering ────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders all three navigation items", () => {
      render(<SidebarNav />);

      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Profile")).toBeInTheDocument();
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    it("renders a link to /dashboard", () => {
      render(<SidebarNav />);

      expect(screen.getByRole("link", { name: /Dashboard/i })).toHaveAttribute(
        "href",
        "/dashboard"
      );
    });

    it("renders a link to /profile", () => {
      render(<SidebarNav />);

      expect(screen.getByRole("link", { name: /Profile/i })).toHaveAttribute(
        "href",
        "/profile"
      );
    });

    it("renders a link to /settings", () => {
      render(<SidebarNav />);

      expect(screen.getByRole("link", { name: /Settings/i })).toHaveAttribute(
        "href",
        "/settings"
      );
    });
  });

  // ── Active state ─────────────────────────────────────────────────────────

  describe("active state", () => {
    it("marks Dashboard as active when pathname ends with /dashboard", () => {
      mockUsePathname.mockReturnValue("/dashboard");
      render(<SidebarNav />);

      const buttons = screen.getAllByTestId("sidebar-btn");
      const dashboardBtn = buttons.find((el) =>
        el.innerHTML.includes("Dashboard")
      );
      expect(dashboardBtn).toHaveAttribute("data-active", "true");
    });

    it("marks Profile as active when pathname ends with /profile", () => {
      mockUsePathname.mockReturnValue("/profile");
      render(<SidebarNav />);

      const buttons = screen.getAllByTestId("sidebar-btn");
      const profileBtn = buttons.find((el) =>
        el.innerHTML.includes("Profile")
      );
      expect(profileBtn).toHaveAttribute("data-active", "true");
    });

    it("marks Settings as active when pathname ends with /settings", () => {
      mockUsePathname.mockReturnValue("/settings");
      render(<SidebarNav />);

      const buttons = screen.getAllByTestId("sidebar-btn");
      const settingsBtn = buttons.find((el) =>
        el.innerHTML.includes("Settings")
      );
      expect(settingsBtn).toHaveAttribute("data-active", "true");
    });

    it("does not mark any item as active for an unrelated pathname", () => {
      mockUsePathname.mockReturnValue("/");
      render(<SidebarNav />);

      const activeButtons = screen
        .getAllByTestId("sidebar-btn")
        .filter((el) => el.getAttribute("data-active") === "true");
      expect(activeButtons).toHaveLength(0);
    });

    it("only marks one item as active at a time", () => {
      mockUsePathname.mockReturnValue("/profile");
      render(<SidebarNav />);

      const activeButtons = screen
        .getAllByTestId("sidebar-btn")
        .filter((el) => el.getAttribute("data-active") === "true");
      expect(activeButtons).toHaveLength(1);
    });
  });

  // ── Tooltip ──────────────────────────────────────────────────────────────

  describe("tooltips", () => {
    it("passes the label as tooltip to each button", () => {
      render(<SidebarNav />);

      const buttons = screen.getAllByTestId("sidebar-btn");
      const tooltips = buttons.map((el) => el.getAttribute("title"));
      expect(tooltips).toContain("Dashboard");
      expect(tooltips).toContain("Profile");
      expect(tooltips).toContain("Settings");
    });
  });
});
