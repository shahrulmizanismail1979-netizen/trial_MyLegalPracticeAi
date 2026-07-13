import type { User } from "@workspace/db/schema";

declare global {
  namespace Express {
    interface Request {
      userId?: number | null;
      currentUser?: User | null;
    }
  }
}

export {};
