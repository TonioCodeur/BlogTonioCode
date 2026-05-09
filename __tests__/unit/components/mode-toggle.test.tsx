import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModeToggle } from "@/components/mode-toggle";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSetTheme = vi.fn();
let mockResolvedTheme = "light";

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: mockSetTheme, resolvedTheme: mockResolvedTheme }),
}));

vi.mock("@/locales/client", () => ({
  useI18n: () => (key: string) => {
    const translations: Record<string, string> = {
      "theme.toggle": "Toggle theme",
    };
    return translations[key] ?? key;
  },
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ModeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolvedTheme = "light";
  });

  it("renders the toggle button", () => {
    render(<ModeToggle />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders an accessible aria-label for screen readers", () => {
    render(<ModeToggle />);

    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Toggle theme"
    );
  });

  it("toggles to dark when current theme is light", async () => {
    const user = userEvent.setup();
    render(<ModeToggle />);

    await user.click(screen.getByRole("button"));

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("toggles to light when current theme is dark", async () => {
    mockResolvedTheme = "dark";

    const user = userEvent.setup();
    render(<ModeToggle />);

    await user.click(screen.getByRole("button"));

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("only calls setTheme once per click", async () => {
    const user = userEvent.setup();
    render(<ModeToggle />);

    await user.click(screen.getByRole("button"));

    expect(mockSetTheme).toHaveBeenCalledOnce();
  });

  it("renders Sun and Moon icons", () => {
    render(<ModeToggle />);

    const button = screen.getByRole("button");
    const svgs = button.querySelectorAll("svg");
    expect(svgs).toHaveLength(2);
  });

  it("sets both icons to aria-hidden", () => {
    render(<ModeToggle />);

    const button = screen.getByRole("button");
    const svgs = button.querySelectorAll("svg");
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  });
});
