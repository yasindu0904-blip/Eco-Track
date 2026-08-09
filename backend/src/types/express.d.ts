import type { AuthenticationContext } from "../modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface Request {
      authentication: AuthenticationContext;
    }
  }
}

export {};