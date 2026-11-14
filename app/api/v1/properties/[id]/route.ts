import { createHandlers } from "@/lib/api/handlers";
import { createRuntimeProviders } from "@/lib/providers/runtime";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return createHandlers(createRuntimeProviders).property(
    request,
    (await context.params).id,
  );
}
