export function friendlyAuthError(message: string): string {
  if (message === "Database error saving new user") {
    return "Ask the pro to add your email on the Staff screen first.";
  }
  if (message === "User already registered") {
    return "That email already has a password. Sign in instead.";
  }
  if (message === "Invalid login credentials") {
    return "That email and password don't match.";
  }
  return "Something went wrong signing in. Try again.";
}
