export type AdminFieldErrors = Record<string, string[]>;

export interface AdminActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: AdminFieldErrors;
}

export const initialAdminActionState: AdminActionState = { status: "idle" };

export class AdminOperationError extends Error {
  constructor(
    readonly code:
      | "CONFLICT"
      | "INVALID_INPUT"
      | "NOT_FOUND"
      | "RELATION_PROTECTED"
      | "STORAGE_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "AdminOperationError";
  }
}
