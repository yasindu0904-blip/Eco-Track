import {
  accessibleBy,
  createPrismaAbility,
  ParsingQueryError,
  prismaQuery,
  type PrismaModel,
  type PrismaQueryOf,
  type Subjects as RuntimePrismaSubjects,
  type WhereInputOf,
} from "@casl/prisma/runtime";

import type { Prisma } from "../generated/prisma/client.js";

export {
  accessibleBy,
  createPrismaAbility,
  ParsingQueryError,
  prismaQuery,
};

export type PrismaQuery<
  Model extends PrismaModel = PrismaModel,
> = PrismaQueryOf<Prisma.TypeMap, Model>;

export type WhereInput<
  ModelName extends Prisma.ModelName,
> = WhereInputOf<Prisma.TypeMap, ModelName>;

export type PrismaSubjects<
  Models extends Partial<
    Record<string, Record<string, unknown>>
  >,
> = RuntimePrismaSubjects<Models>;
