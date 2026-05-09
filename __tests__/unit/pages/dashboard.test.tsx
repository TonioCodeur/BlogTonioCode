import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardPage from "@/app/[locale]/(protected)/dashboard/page";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  useSession: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => mocks.useSession(),
  signOut: mocks.signOut,
}));

vi.mock("@/locales/client", () => ({
  useI18n:
    () =>
    (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        "dashboard.title": "Dashboard",
        "dashboard.signOut": "Sign out",
        "dashboard.loading": "Loading...",
        "dashboard.welcome": "Welcome, {name}",
        "dashboard.guest": "User",
        "dashboard.email": "Email: {email}",
      };

      let result = translations[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(`{${k}}`, String(v));
        });
      }
      return result;
    },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockSession = {
  data: {
    user: {
      id: "user-1",
      name: "Bob Martin",
      email: "bob@example.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: "session-1",
      userId: "user-1",
      token: "token-123",
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
  isPending: false,
  error: null,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSession.mockReturnValue(mockSession);
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows the loading indicator while the session is pending", () => {
      mocks.useSession.mockReturnValue({ data: null, isPending: true });

      const { container } = render(<DashboardPage />);

      // Loading state renders Skeleton components instead of text
      const skeletons = container.querySelectorAll("[data-slot='skeleton']");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("does not render the dashboard title while loading", () => {
      mocks.useSession.mockReturnValue({ data: null, isPending: true });

      render(<DashboardPage />);

      expect(
        screen.queryByRole("heading", { name: "Dashboard" })
      ).not.toBeInTheDocument();
    });
  });

  // ── Authenticated view ────────────────────────────────────────────────────

  describe("with a session", () => {
    it("renders the Dashboard title", () => {
      render(<DashboardPage />);

      expect(
        screen.getByRole("heading", { name: "Dashboard" })
      ).toBeInTheDocument();
    });

    it("renders a welcome message with the user name", () => {
      render(<DashboardPage />);

      expect(screen.getByText("Welcome, Bob Martin")).toBeInTheDocument();
    });

    it("renders the user email", () => {
      render(<DashboardPage />);

      // Email is rendered directly in the card, not via a translation key
      expect(screen.getAllByText("bob@example.com").length).toBeGreaterThan(0);
    });

    it("renders the Sign Out button", () => {
      render(<DashboardPage />);

      expect(
        screen.getByRole("button", { name: "Sign out" })
      ).toBeInTheDocument();
    });
  });

  // ── Guest fallback ────────────────────────────────────────────────────────

  describe("when session has no user name", () => {
    it("falls back to 'User' in the welcome message", () => {
      mocks.useSession.mockReturnValue({
        ...mockSession,
        data: {
          ...mockSession.data,
          user: { ...mockSession.data.user, name: null },
        },
      });

      render(<DashboardPage />);

      expect(screen.getByText("Welcome, User")).toBeInTheDocument();
    });
  });

  // ── Sign out ──────────────────────────────────────────────────────────────

  describe("sign out", () => {
    it("calls signOut when the Sign Out button is clicked", async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      await user.click(screen.getByRole("button", { name: "Sign out" }));

      expect(mocks.signOut).toHaveBeenCalledOnce();
    });

    it("redirects to /signin after sign out (via onSuccess callback)", async () => {
      mocks.signOut.mockImplementation(
        ({
          fetchOptions,
        }: {
          fetchOptions: { onSuccess: () => void };
        }) => {
          fetchOptions.onSuccess();
          return Promise.resolve(undefined);
        }
      );

      const user = userEvent.setup();
      render(<DashboardPage />);

      await user.click(screen.getByRole("button", { name: "Sign out" }));

      await waitFor(() => {
        expect(mocks.push).toHaveBeenCalledWith("/signin");
      });
    });
  });
});
