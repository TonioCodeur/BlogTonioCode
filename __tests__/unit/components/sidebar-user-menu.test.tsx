import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidebarUserMenu } from "@/components/sidebar-user-menu";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/auth-client", () => ({
  signOut: mocks.signOut,
}));

vi.mock("@/locales/client", () => ({
  useI18n: () => (key: string) => {
    const translations: Record<string, string> = {
      "sidebar.user.guest": "Guest",
      "sidebar.user.myProfile": "My profile",
      "sidebar.user.settings": "Settings",
      "sidebar.user.signOut": "Sign out",
    };
    return translations[key] ?? key;
  },
}));

// Stub sidebar primitives to avoid SidebarProvider context requirement
vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenu: ({ children }: React.PropsWithChildren) => <ul>{children}</ul>,
  SidebarMenuItem: ({ children }: React.PropsWithChildren) => <li>{children}</li>,
  SidebarMenuButton: ({
    children,
    className,
  }: React.PropsWithChildren<{ size?: string; className?: string }>) => (
    <button className={className}>{children}</button>
  ),
  useSidebar: () => ({ isMobile: false }),
}));

// Stub avatar components
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
  AvatarImage: ({ src, alt }: { src?: string; alt?: string }) => (
    <img src={src ?? ""} alt={alt ?? ""} />
  ),
  AvatarFallback: ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => (
    <span data-testid="avatar-fallback" className={className}>
      {children}
    </span>
  ),
}));

// Stub dropdown to avoid Radix portal issues in jsdom
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser = {
  name: "Alice Dupont",
  email: "alice@example.com",
  image: null,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SidebarUserMenu", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Authenticated user ───────────────────────────────────────────────────

  describe("with a logged-in user", () => {
    it("displays the user name", () => {
      render(<SidebarUserMenu user={mockUser} />);

      expect(screen.getByText("Alice Dupont")).toBeInTheDocument();
    });

    it("displays the user email", () => {
      render(<SidebarUserMenu user={mockUser} />);

      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    });

    it("computes initials from the user name (first 2 words)", () => {
      render(<SidebarUserMenu user={mockUser} />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("AD");
    });

    it("computes initials for a single-word name", () => {
      render(<SidebarUserMenu user={{ ...mockUser, name: "Alice" }} />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("A");
    });

    it("renders the avatar image when user has an image URL", () => {
      render(
        <SidebarUserMenu
          user={{ ...mockUser, image: "https://example.com/avatar.png" }}
        />
      );

      expect(screen.getByRole("img")).toHaveAttribute(
        "src",
        "https://example.com/avatar.png"
      );
    });

    it("renders My profile, Settings, and Sign out menu items", () => {
      render(<SidebarUserMenu user={mockUser} />);

      expect(screen.getByText("My profile")).toBeInTheDocument();
      expect(screen.getByText("Settings")).toBeInTheDocument();
      expect(screen.getByText("Sign out")).toBeInTheDocument();
    });

    it("navigates to /profile when My profile is clicked", async () => {
      const user = userEvent.setup();
      render(<SidebarUserMenu user={mockUser} />);

      await user.click(screen.getByText("My profile"));

      expect(mocks.push).toHaveBeenCalledWith("/profile");
    });

    it("navigates to /settings when Settings is clicked", async () => {
      const user = userEvent.setup();
      render(<SidebarUserMenu user={mockUser} />);

      await user.click(screen.getByText("Settings"));

      expect(mocks.push).toHaveBeenCalledWith("/settings");
    });

    it("calls signOut when Sign out is clicked", async () => {
      const user = userEvent.setup();
      render(<SidebarUserMenu user={mockUser} />);

      await user.click(screen.getByText("Sign out"));

      expect(mocks.signOut).toHaveBeenCalledOnce();
    });

    it("redirects to /signin after sign out (via onSuccess callback)", async () => {
      mocks.signOut.mockImplementation(
        ({ fetchOptions }: { fetchOptions: { onSuccess: () => void } }) => {
          fetchOptions.onSuccess();
          return Promise.resolve(undefined);
        }
      );

      const user = userEvent.setup();
      render(<SidebarUserMenu user={mockUser} />);

      await user.click(screen.getByText("Sign out"));

      await waitFor(() => {
        expect(mocks.push).toHaveBeenCalledWith("/signin");
      });
    });
  });

  // ── No user (guest) ──────────────────────────────────────────────────────

  describe("with no user (guest)", () => {
    it("displays 'Guest' as the display name", () => {
      render(<SidebarUserMenu user={null} />);

      expect(screen.getByText("Guest")).toBeInTheDocument();
    });

    it("computes initials 'G' for the Guest fallback", () => {
      render(<SidebarUserMenu user={null} />);

      expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("G");
    });

    it("does not render an email", () => {
      render(<SidebarUserMenu user={null} />);

      const emailEl = screen.getByText((_content, element) => {
        return (
          element?.classList.contains("text-muted-foreground") &&
          element.textContent === ""
        );
      });
      expect(emailEl).toBeInTheDocument();
    });
  });
});
