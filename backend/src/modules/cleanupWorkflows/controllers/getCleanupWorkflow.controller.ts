import type { NextFunction, Request, Response } from "express";
import type { CleanupWorkflowDependencies } from "../cleanupWorkflow.dependencies.js";
import { initializeAndGetCleanupWorkflow } from "../services/cleanupWorkflow.service.js";

export function getCleanupWorkflowController(dependencies: CleanupWorkflowDependencies) {
  return async function getCleanupWorkflow(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = request.tenant!.organization.id;
      response.status(200).json({ data: await initializeAndGetCleanupWorkflow(dependencies, organizationId) });
    } catch (error) { next(error); }
  };
}

