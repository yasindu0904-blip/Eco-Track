import { prisma } from "../../database/prisma.js";
import { authorizationDependencies } from "../../authorization/authorization.dependencies.js";
export const dashboardDependencies = { prisma, authorization: authorizationDependencies };
