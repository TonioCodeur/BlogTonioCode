import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignInPage from "@/app/[locale]/(public)/(auth)/signin/page";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  signInEmail: vi.fn(),
  signInSocial: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
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
  signIn: {
    email: mocks.signInEmail,
    social: mocks.signInSocial,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("@/locales/client", () => ({
  useI18n: () => (key: string) => {
    const translations: Record<string, string> = {
      "signIn.title": "Sign in",
      "signIn.description": "Sign in to your account",
      "signIn.email": "Email",
      "signIn.password": "Password",
      "signIn.submit": "Sign in",
      "signIn.loading": "Signing in...",
      "signIn.orContinueWith": "Or continue with",
      "signIn.noAccount": "Don't have an account?",
      "signIn.signUpLink": "Sign up now",
      "signIn.error.title": "Sign in failed",
      "signIn.success.title": "Signed in successfully",
      "signIn.success.redirect": "You will be redirected...",
      "signIn.genericError": "An error occurred",
    };
    return translations[key] ?? key;
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_EMAIL = "user@example.com";
const VALID_PASSWORD = "securepassword";

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  password: string
) {
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signInEmail.mockResolvedValue({ error: null });
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the page title", () => {
      render(<SignInPage />);

      // shadcn CardTitle renders as a <div data-slot="card-title">, not a heading
      expect(
        screen.getByText("Sign in", { selector: '[data-slot="card-title"]' })
      ).toBeInTheDocument();
    });

    it("renders the card description", () => {
      render(<SignInPage />);

      expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
    });

    it("renders the email input", () => {
      render(<SignInPage />);

      expect(screen.getByLabelText("Email")).toBeInTheDocument();
    });

    it("renders the password input", () => {
      render(<SignInPage />);

      expect(screen.getByLabelText("Password")).toBeInTheDocument();
    });

    it("renders the submit button", () => {
      render(<SignInPage />);

      expect(
        screen.getByRole("button", { name: "Sign in" })
      ).toBeInTheDocument();
    });

    it("renders GitHub, Google, Apple and Microsoft buttons", () => {
      render(<SignInPage />);

      expect(screen.getByRole("button", { name: /GitHub/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Google/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Apple/ })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Microsoft/ })
      ).toBeInTheDocument();
    });

    it("renders a link to the sign up page", () => {
      render(<SignInPage />);

      expect(
        screen.getByRole("link", { name: "Sign up now" })
      ).toHaveAttribute("href", "/signup");
    });
  });

  // ── Form validation ───────────────────────────────────────────────────────

  describe("form validation", () => {
    it("shows a required error when email is empty on submit", async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(screen.getByText("L'email est requis")).toBeInTheDocument();
      });
    });

    it("shows an invalid email error for a malformed email", async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      await user.type(screen.getByLabelText("Email"), "not-an-email");
      // fireEvent.submit bypasses native HTML5 email constraint validation in jsdom,
      // ensuring react-hook-form's zodResolver runs and sets the "Email invalide" error.
      fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

      await waitFor(() => {
        expect(screen.getByText("Email invalide")).toBeInTheDocument();
      });
    });

    it("shows a required error when password is empty on submit", async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      await user.type(screen.getByLabelText("Email"), VALID_EMAIL);
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(
          screen.getByText("Le mot de passe est requis")
        ).toBeInTheDocument();
      });
    });

    it("does not call signIn.email when the form is invalid", async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      await user.click(screen.getByRole("button", { name: "Sign in" }));

      expect(mocks.signInEmail).not.toHaveBeenCalled();
    });
  });

  // ── Successful sign-in ────────────────────────────────────────────────────

  describe("successful sign-in", () => {
    it("calls signIn.email with correct credentials", async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      await fillAndSubmit(user, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => {
        expect(mocks.signInEmail).toHaveBeenCalledWith({
          email: VALID_EMAIL,
          password: VALID_PASSWORD,
          callbackURL: "/dashboard",
        });
      });
    });

    it("shows a success toast", async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      await fillAndSubmit(user, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => {
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
          "Signed in successfully",
          expect.objectContaining({ description: "You will be redirected..." })
        );
      });
    });

    it("redirects to /dashboard on success", async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      await fillAndSubmit(user, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => {
        expect(mocks.push).toHaveBeenCalledWith("/dashboard");
      });
    });
  });

  // ── Failed sign-in ────────────────────────────────────────────────────────

  describe("failed sign-in", () => {
    beforeEach(() => {
      mocks.signInEmail.mockResolvedValue({
        error: { message: "Invalid credentials" },
      });
    });

    it("shows a generic error toast on auth failure", async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      await fillAndSubmit(user, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => {
        expect(mocks.toastError).toHaveBeenCalledWith(
          "Sign in failed",
          expect.objectContaining({ description: "An error occurred" })
        );
      });
    });

    it("displays the generic error message inline", async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      await fillAndSubmit(user, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => {
        expect(screen.getByText("An error occurred")).toBeInTheDocument();
      });
    });

    it("does not redirect on auth failure", async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      await fillAndSubmit(user, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
      expect(mocks.push).not.toHaveBeenCalled();
    });

    it("uses the generic error message when server sends no message", async () => {
      mocks.signInEmail.mockResolvedValue({ error: {} });
      const user = userEvent.setup();
      render(<SignInPage />);

      await fillAndSubmit(user, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => {
        expect(screen.getByText("An error occurred")).toBeInTheDocument();
      });
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows 'Signing in...' and disables the button while pending", async () => {
      mocks.signInEmail.mockReturnValue(new Promise(() => {}));

      const user = userEvent.setup();
      render(<SignInPage />);

      await fillAndSubmit(user, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Signing in..." })
        ).toBeDisabled();
      });
    });

    it("disables inputs while the request is pending", async () => {
      mocks.signInEmail.mockReturnValue(new Promise(() => {}));

      const user = userEvent.setup();
      render(<SignInPage />);

      await fillAndSubmit(user, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => {
        expect(screen.getByLabelText("Email")).toBeDisabled();
        expect(screen.getByLabelText("Password")).toBeDisabled();
      });
    });
  });

  // ── GitHub OAuth ─────────────────────────────────────────────────────────

  describe("GitHub OAuth", () => {
    it("calls signIn.social with provider 'github'", async () => {
      mocks.signInSocial.mockResolvedValue({ error: null });
      const user = userEvent.setup();
      render(<SignInPage />);

      await user.click(screen.getByRole("button", { name: /GitHub/ }));

      await waitFor(() => {
        expect(mocks.signInSocial).toHaveBeenCalledWith({
          provider: "github",
          callbackURL: "/dashboard",
        });
      });
    });

    it("shows an error toast if GitHub OAuth fails", async () => {
      mocks.signInSocial.mockResolvedValue({
        error: { message: "GitHub OAuth error" },
      });
      const user = userEvent.setup();
      render(<SignInPage />);

      await user.click(screen.getByRole("button", { name: /GitHub/ }));

      await waitFor(() => {
        expect(mocks.toastError).toHaveBeenCalled();
      });
    });
  });
});
