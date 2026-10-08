// Turn database errors into plain messages for users.
// The technical detail is written to the server log only.
type DbError = { code?: string; message?: string } | null | undefined;

export function friendlyError(error: DbError, context: string): string {
  console.error(`[${context}]`, error?.code, error?.message);
  switch (error?.code) {
    case "23505":
      return "That already exists.";
    case "23514":
    case "22023":
      // Our own validation messages from the database are safe to show
      return error?.message && error.code === "22023" ? error.message : "Please check what you entered.";
    case "42501":
      return "You are not allowed to do this.";
    default:
      return "Something went wrong. Please try again.";
  }
}
