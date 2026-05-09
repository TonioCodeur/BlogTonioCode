import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignUpPage from "@/app/[locale]/(public)/(auth)/signup/page";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  signUpEmail: vi.fn(),
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
  signUp: {
    email: mocks.signUpEmail,
  },
  signIn: {
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
      "signUp.title": "Create an account",
      "signUp.description": "Sign up to get started",
      "signUp.name": "Name",
      "signUp.email": "Email",
      "signUp.password": "Password",
      "signUp.passwordHint": "Minimum 8 characters, with uppercase, number and special character",
      "signUp.submit": "Sign up",
      "signUp.loading": "Signing up...",
      "signUp.orContinueWith": "Or continue with",
      "signUp.hasAccount": "Already have an account?",
      "signUp.signInLink": "Sign in now",
      "signUp.error.title": "Sign up failed",
      "signUp.success.title": "Signed up successfully",
      "signUp.success.redirect": "You will be redirected...",
      "signUp.genericError": "An error occurred",
    };
    return translations[key] ?? key;
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_NAME = "Jane Doe";
const VALID_EMAIL = "jane@example.com";
const VALID_PASSWORD = "Secure@123";

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  email: string,
  password: string
) {
  await user.type(screen.getByLabelText("Name"), name);
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign up" }));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signUpEmail.mockResolvedValue({ error: null });
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the page title", () => {
      render(<SignUpPage />);

      // shadcn CardTitle renders as a <div data-slot="card-title">, not a heading
      expect(
        screen.getByText("Create an account", {
          selector: '[data-slot="card-title"]',
        })
      ).toBeInTheDocument();
    });

    it("renders the card description", () => {
      render(<SignUpPage />);

      expect(screen.getByText("Sign up to get started")).toBeInTheDocument();
    });

    it("renders the Name, Email, and Password inputs", () => {
      render(<SignUpPage />);

      expect(screen.getByLabelText("Name")).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
    });

    it("renders the password hint text", () => {
      render(<SignUpPage />);

      expect(screen.getByText("Minimum 8 characters, with uppercase, number and special character")).toBeInTheDocument();
    });

    it("renders the submit button", () => {
      render(<SignUpPage />);

      expect(
        screen.getByRole("button", { name: "Sign up" })
      ).toBeInTheDocument();
    });

    it("renders a link back to sign-in", () => {
      render(<SignUpPage />);

      expect(
        screen.getByRole("link", { name: "Sign in now" })
      ).toHaveAttribute("href", "/signin");
    });

    it("renders social OAuth buttons (GitHub, Google, Apple, Microsoft)", () => {
      render(<SignUpPage />);

      expect(screen.getByRole("button", { name: /GitHub/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Google/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Apple/ })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Microsoft/ })
      ).toBeInTheDocument();
    });
  });

  // ── Form validation ───────────────────────────────────────────────────────

  describe("form validation", () => {
    it("shows error when name is too short (< 2 chars)", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      await user.type(screen.getByLabelText("Name"), "J");
      await user.type(screen.getByLabelText("Email"), VALID_EMAIL);
      await user.type(screen.getByLabelText("Password"), VALID_PASSWORD);
      await user.click(screen.getByRole("button", { name: "Sign up" }));

      await waitFor(() => {
        expect(
          screen.getByText("Le nom doit contenir au moins 2 caractères")
        ).toBeInTheDocument();
      });
    });

    it("shows error for an invalid email", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      await user.type(screen.getByLabelText("Name"), VALID_NAME);
      await user.type(screen.getByLabelText("Email"), "bad-email");
      await user.type(screen.getByLabelText("Password"), VALID_PASSWORD);
      // fireEvent.submit bypasses native HTML5 email constraint validation in jsdom,
      // ensuring react-hook-form's zodResolver runs and sets the "Email invalide" error.
      fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

      await waitFor(() => {
        expect(screen.getByText("Email invalide")).toBeInTheDocument();
      });
    });

    it("shows error when password is shorter than 8 characters", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      await user.type(screen.getByLabelText("Name"), VALID_NAME);
      await user.type(screen.getByLabelText("Email"), VALID_EMAIL);
      await user.type(screen.getByLabelText("Password"), "short");
      await user.click(screen.getByRole("button", { name: "Sign up" }));

      await waitFor(() => {
        expect(
          screen.getByText(
            "Le mot de passe doit contenir au moins 8 caractères"
          )
        ).toBeInTheDocument();
      });
    });

    it("shows error when password exceeds 128 characters", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      await user.type(screen.getByLabelText("Name"), VALID_NAME);
      await user.type(screen.getByLabelText("Email"), VALID_EMAIL);
      await user.type(screen.getByLabelText("Password"), "a".repeat(129));
      await user.click(screen.getByRole("button", { name: "Sign up" }));

      await waitFor(() => {
        expect(
          screen.getByText(
            "Le mot de passe ne peut pas dépasser 128 caractères"
          )
        ).toBeInTheDocument();
      });
    });

    it("does not call signUp.email when the form is invalid", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      await user.click(screen.getByRole("button", { name: "Sign up" }));

      expect(mocks.signUpEmail).not.toHaveBeenCalled();
    });
  });

  // ── Successful sign-up ────────────────────────────────────────────────────

  describe("successful sign-up", () => {
    it("calls signUp.email with correct data", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      await fillAndSubmit(user, VALID_NAME, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => {
        expect(mocks.signUpEmail).toHaveBeenCalledWith({
          name: VALID_NAME,
          email: VALID_EMAIL,
          password: VALID_PASSWORD,
          callbackURL: "/dashboard",
        });
      });
    });

    it("shows a success toast", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      await fillAndSubmit(user, VALID_NAME, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => {
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
          "Signed up successfully",
          expect.objectContaining({ description: "You will be redirected..." })
        );
      });
    });

    it("redirects to /dashboard", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      await fillAndSubmit(user, VALID_NAME, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => {
        expect(mocks.push).toHaveBeenCalledWith("/dashboard");
      });
    });
  });

  // ── Failed sign-up ────────────────────────────────────────────────────────

  describe("failed sign-up", () => {
    beforeEach(() => {
      mocks.signUpEmail.mockResolvedValue({
        error: { message: "Email already in use" },
      });
    });

    it("shows a generic error toast", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      await fillAndSubmit(user, VALID_NAME, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => {
        expect(mocks.toastError).toHaveBeenCalledWith(
          "Sign up failed",
          expect.objectContaining({ description: "An error occurred" })
        );
      });
    });

    it("displays the generic error message inline", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      await fillAndSubmit(user, VALID_NAME, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => {
        expect(screen.getByText("An error occurred")).toBeInTheDocument();
      });
    });

    it("does not redirect on failure", async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      await fillAndSubmit(user, VALID_NAME, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
      expect(mocks.push).not.toHaveBeenCalled();
    });

    it("falls back to generic error when server sends no message", async () => {
      mocks.signUpEmail.mockResolvedValue({ error: {} });
      const user = userEvent.setup();
      render(<SignUpPage />);

      await fillAndSubmit(user, VALID_NAME, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => {
        expect(screen.getByText("An error occurred")).toBeInTheDocument();
      });
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows 'Signing up...' and disables the button while pending", async () => {
      mocks.signUpEmail.mockReturnValue(new Promise(() => {}));

      const user = userEvent.setup();
      render(<SignUpPage />);

      await fillAndSubmit(user, VALID_NAME, VALID_EMAIL, VALID_PASSWORD);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Signing up..." })
        ).toBeDisabled();
      });
    });
  });

  // ── GitHub OAuth ─────────────────────────────────────────────────────────

  describe("GitHub OAuth", () => {
    it("calls signIn.social with 'github' on click", async () => {
      mocks.signInSocial.mockResolvedValue({ error: null });
      const user = userEvent.setup();
      render(<SignUpPage />);

      await user.click(screen.getByRole("button", { name: /GitHub/ }));

      await waitFor(() => {
        expect(mocks.signInSocial).toHaveBeenCalledWith({
          provider: "github",
          callbackURL: "/dashboard",
        });
      });
    });
  });
});
