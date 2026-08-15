import type { AuthenticationContext } from "../modules/auth/auth.types.js";
import type { AppAbility } from "../authorization/ability.types.js";
import type { ActiveTenantContext } from "../authorization/authorization.types.js";
import type { EventAuthorizationContext } from "../authorization/authorization.types.js";

declare global {
  namespace Express {
    interface Request {
      authentication: AuthenticationContext;
      ability?: AppAbility;
      tenant?: ActiveTenantContext;
      eventAuthorization?: EventAuthorizationContext;
    }
  }
}

export {};
