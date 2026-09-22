/* Temporary local codegen output. `npx convex dev` regenerates this file. */
import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import { anyApi } from "convex/server";
import type * as integrations from "../integrations.js";
import type * as repairs from "../repairs.js";

const fullApi: ApiFromModules<{
  integrations: typeof integrations;
  repairs: typeof repairs;
}> = anyApi as never;

export const api: FilterApi<typeof fullApi, FunctionReference<"query" | "mutation" | "action", "public">> = anyApi as never;
export const internal: FilterApi<typeof fullApi, FunctionReference<"query" | "mutation" | "action", "internal">> = anyApi as never;
