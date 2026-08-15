import type { Ability } from "@casl/ability";

import type { Action } from "./actions.js";
import type { Subject } from "./subjects.js";

export type AuthorizationCondition =
  Record<string, unknown>;

export type AppAbility = Ability<
  [Action, Subject],
  AuthorizationCondition
>;
