import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthButtons } from "@/components/auth/auth-buttons";

// ─── Mocks ───────────────────────────────────────────────────────────────────
// vi.mock() is hoisted to the top of the file, so any variables it references
// must also be hoisted via vi.hoisted().

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: React.PropsWithChildren<{ href: string; className?: string }>) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth-client", () => ({
  signOut: mocks.signOut,
}));

vi.mock("@/locales/client", () => ({
  useI18n: () => (key: string) => {
    const translations: Record<string, string> = {
      "auth.signIn": "Sign in",
      "auth.signOut": "Sign out",
      "auth.signUp": "Sign up",
      "auth.dashboard": "Dashboard",
    };
    return translations[key] ?? key;
  },
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AuthButtons", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Unauthenticated ──────────────────────────────────────────────────────

  describe("when unauthenticated", () => {
    it("renders Sign In and Sign Up links", () => {
      render(<AuthButtons isAuthenticated={false} />);

      expect(screen.getByText("Sign in")).toBeInTheDocument();
      expect(screen.getByText("Sign up")).toBeInTheDocument();
    });

    it("Sign In link points to /signin", () => {
      render(<AuthButtons isAuthenticated={false} />);

      expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
        "href",
        "/signin"
      );
    });

    it("Sign Up link points to /signup", () => {
      render(<AuthButtons isAuthenticated={false} />);

      expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
        "href",
        "/signup"
      );
    });

    it("does not render Dashboard link or Sign Out button", () => {
      render(<AuthButtons isAuthenticated={false} />);

      expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
      expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
    });
  });

  // ── Authenticated ────────────────────────────────────────────────────────

  describe("when authenticated", () => {
    it("renders Dashboard link and Sign Out button", () => {
      render(<AuthButtons isAuthenticated={true} />);

      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    });

    it("Dashboard link points to /dashboard", () => {
      render(<AuthButtons isAuthenticated={true} />);

      expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
        "href",
        "/dashboard"
      );
    });

    it("does not render Sign In or Sign Up links", () => {
      render(<AuthButtons isAuthenticated={true} />);

      expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
      expect(screen.queryByText("Sign up")).not.toBeInTheDocument();
    });

    it("calls signOut when the Sign Out button is clicked", async () => {
      const user = userEvent.setup();
      render(<AuthButtons isAuthenticated={true} />);

      await user.click(screen.getByRole("button", { name: "Sign out" }));

      expect(mocks.signOut).toHaveBeenCalledOnce();
    });

    it("redirects to home after sign out", async () => {
      const user = userEvent.setup();
      render(<AuthButtons isAuthenticated={true} />);

      await user.click(screen.getByRole("button", { name: "Sign out" }));

      await waitFor(() => {
        expect(mocks.push).toHaveBeenCalledWith("/");
      });
    });

    it("calls router.refresh after sign out", async () => {
      const user = userEvent.setup();
      render(<AuthButtons isAuthenticated={true} />);

      await user.click(screen.getByRole("button", { name: "Sign out" }));

      await waitFor(() => {
        expect(mocks.refresh).toHaveBeenCalledOnce();
      });
    });
  });
});
