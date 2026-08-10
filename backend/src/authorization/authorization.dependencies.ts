import type { AuthorizationDependencies } from "./authorization.types.js";

import { findActiveTenantContext } from "./repositories/authorization.repository.js";

export const authorizationDependencies:
  AuthorizationDependencies = {
    findActiveTenantContext,
  };
