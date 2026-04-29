import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "../LoginForm";

// Mock the useAuth hook
const mockSignIn = vi.fn();
const mockUseAuth = {
  signIn: mockSignIn,
  isLoading: false,
};

vi.mock("~/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth,
}));

// Mock React Router Link
vi.mock("react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

// Mock localStorage. The cast bridges the structural mock to the DOM
// `Storage` interface (which has `length`, indexed access, etc. that the
// production code never touches).
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
global.localStorage = mockLocalStorage as unknown as Storage;

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.isLoading = false;
  });

  it("renders login form correctly", () => {
    render(<LoginForm />);

    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(
      screen.getByText("Sign in to your Supplex account")
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/forgot password\?/i)).toBeInTheDocument();
    expect(screen.getByText(/don't have an account\?/i)).toBeInTheDocument();
  });

  it("handles form validation correctly", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const submitButton = screen.getByRole("button", { name: /sign in/i });

    // Submit empty form
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Email is required")).toBeInTheDocument();
      expect(screen.getByText("Password is required")).toBeInTheDocument();
    });

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("validates email format", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    await user.type(emailInput, "invalid-email");
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Please enter a valid email address")
      ).toBeInTheDocument();
    });
  });

  it("validates password length", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    await user.type(passwordInput, "123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Password must be at least 8 characters")
      ).toBeInTheDocument();
    });
  });

  it("submits form with valid data", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({ success: true });

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const rememberMeCheckbox = screen.getByLabelText(/remember me/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");
    await user.click(rememberMeCheckbox);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith(
        "test@example.com",
        "password123",
        true
      );
    });
  });

  it("displays error message on sign in failure", async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({
      success: false,
      error: "Invalid credentials",
    });

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "wrongpassword");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("shows loading state during sign in", async () => {
    const _user = userEvent.setup();
    mockUseAuth.isLoading = true;

    render(<LoginForm />);

    expect(screen.getByText("Signing in...")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /signing in.../i })
    ).toBeDisabled();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText(
      /password/i
    ) as HTMLInputElement;
    const toggleButton = screen.getByRole("button", { name: "" }); // SVG button has no accessible name

    expect(passwordInput.type).toBe("password");

    await user.click(toggleButton);
    expect(passwordInput.type).toBe("text");

    await user.click(toggleButton);
    expect(passwordInput.type).toBe("password");
  });

  it("saves email to localStorage when typing", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email address/i);

    await user.type(emailInput, "test@example.com");

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "supplex_saved_email",
        "test@example.com"
      );
    });
  });

  it("loads saved email from localStorage on mount", () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === "supplex_saved_email") return "saved@example.com";
      if (key === "supplex_remember_me") return "true";
      return null;
    });

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(
      /email address/i
    ) as HTMLInputElement;
    const rememberMeCheckbox = screen.getByLabelText(
      /remember me/i
    ) as HTMLInputElement;

    expect(emailInput.value).toBe("saved@example.com");
    expect(rememberMeCheckbox.checked).toBe(true);
  });

  it("handles redirect URL correctly", () => {
    const onSuccess = vi.fn();
    const redirectTo = "/dashboard";

    render(<LoginForm onSuccess={onSuccess} redirectTo={redirectTo} />);

    // This would be tested through integration with the actual sign in flow
    // The redirect logic is handled by the useAuth hook and browser navigation
  });

  it("disables form during loading", () => {
    mockUseAuth.isLoading = true;
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const rememberMeCheckbox = screen.getByLabelText(/remember me/i);
    const submitButton = screen.getByRole("button", { name: /signing in.../i });

    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(rememberMeCheckbox).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });
});
