import { friendlyAuthError } from "@/lib/authErrors";

describe("friendlyAuthError", () => {
  it("explains a refused sign-up", () => {
    expect(friendlyAuthError("Database error saving new user")).toBe(
      "Ask the pro to add your email on the Staff screen first.",
    );
  });
  it("explains a wrong password", () => {
    expect(friendlyAuthError("Invalid login credentials")).toBe("That email and password don't match.");
  });
  it("falls back for anything else", () => {
    expect(friendlyAuthError("boom")).toBe("Something went wrong signing in. Try again.");
  });
});
