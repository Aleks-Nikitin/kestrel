import { connection } from "next/server";
import { createHandlers } from "@/lib/api/handlers";
import { createRuntimeProviders } from "@/lib/providers/runtime";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await connection();
  return createHandlers(createRuntimeProviders).property(
    request,
    (await context.params).id,
  );
}
