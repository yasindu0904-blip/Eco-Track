import type { AuthenticationDependencies } from "./auth.types.js";

import { provisionOrSynchronizeProfile } from "./services/provisionOrSynchronizeProfile.service.js";
import { verifyAccessToken } from "./services/verifyAccessToken.service.js";

export const authenticationDependencies: AuthenticationDependencies = {
  verifyAccessToken,
  provisionOrSynchronizeProfile,
};