import { describe, it, expect } from "vitest";
import { signInSchema, signUpSchema } from "@/lib/validations/auth";

describe("signInSchema", () => {
  it("should validate correct signin data", () => {
    const result = signInSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = signInSchema.safeParse({
      email: "invalid-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty password", () => {
    const result = signInSchema.safeParse({
      email: "test@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("should validate correct signup data", () => {
    const result = signUpSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "Secure@123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject short name", () => {
    const result = signUpSchema.safeParse({
      name: "J",
      email: "john@example.com",
      password: "Secure@123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject short password", () => {
    const result = signUpSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("should reject password without uppercase", () => {
    const result = signUpSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "secure@123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject password without number", () => {
    const result = signUpSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "Secure@abc",
    });
    expect(result.success).toBe(false);
  });

  it("should reject password without special character", () => {
    const result = signUpSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "Secure1234",
    });
    expect(result.success).toBe(false);
  });

  it("should reject password exceeding max length", () => {
    const result = signUpSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "a".repeat(129),
    });
    expect(result.success).toBe(false);
  });
});
