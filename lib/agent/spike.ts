import "server-only";
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { ChatGoogle } from "@langchain/google";
import { ChatOpenRouter } from "@langchain/openrouter";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { isAIMessage, isToolMessage } from "@langchain/core/messages";
import {
  createDeepAgent,
  createFilesystemMiddleware,
  createSubAgentMiddleware,
  StateBackend,
} from "deepagents";
import {
  createMiddleware,
  modelCallLimitMiddleware,
  todoListMiddleware,
  tool,
  toolCallLimitMiddleware,
} from "langchain";
import { type AgentConfig, fallbackAvailability } from "./config";
import {
  AgentExecutionError,
  safeAgentError,
  modelErrorStatus,
} from "./errors";
import {
  modelReliabilityMiddleware,
  type AttemptAudit,
} from "./model-middleware";
import {
  SyntheticSampleInput,
  SyntheticSampleResult,
  SyntheticSpikeResponse,
  type SyntheticSpikeResponseDTO,
} from "./spike-contract";
const Arithmetic = Decimal.clone({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});
const ALLOWED_TOOLS = ["calculateSample", "write_todos", "read_file"] as const;
const allowed = new Set<string>(ALLOWED_TOOLS);
const SAMPLE = Object.freeze({
  areaSqft: "10000",
  annualRentPerSqft: "30",
  occupancyRatio: "0.9",
  annualExpenses: "80000",
});
export interface SpikeOptions {
  config: AgentConfig;
  signal: AbortSignal;
  requestId?: string;
  /** Test injection only; production constructs the approved provider integrations. */
  models?: { primary: BaseChatModel; secondary?: BaseChatModel };
  /** Server-only diagnostics never contain provider messages, prompts or values. */
  onDiagnostic?: (diagnostic: {
    phase: "construct" | "invoke" | "assemble";
    name: string;
    status?: number;
    code?: string;
  }) => void;
}
export async function runSyntheticSpike({
  config,
  signal: callerSignal,
  requestId = randomUUID(),
  models,
  onDiagnostic,
}: SpikeOptions): Promise<SyntheticSpikeResponseDTO> {
  if (!config.analysisEnabled)
    throw new AgentExecutionError(
      "ANALYSIS_UNAVAILABLE",
      "AI analysis is disabled by configuration.",
    );
  if (!models && !config.googleApiKey)
    throw new AgentExecutionError(
      "UPSTREAM_AUTH",
      "GOOGLE_API_KEY is required for the synthetic agent proof.",
    );
  if (
    ["LANGSMITH_TRACING", "LANGCHAIN_TRACING_V2", "LANGCHAIN_TRACING"].some(
      (key) => ["true", "1"].includes(process.env[key]?.toLowerCase() ?? ""),
    )
  )
    throw new AgentExecutionError(
      "ANALYSIS_UNAVAILABLE",
      "External tracing must be disabled for this runtime proof.",
    );
  callerSignal.throwIfAborted();
  const started = Date.now();
  const signal = AbortSignal.any([callerSignal, AbortSignal.timeout(60000)]);
  const primary =
    models?.primary ??
    new ChatGoogle({
      model: config.primaryModelId,
      apiHandler: "generateContent",
      apiVersion: "v1beta",
      apiKey: config.googleApiKey,
      maxRetries: 0,
      temperature: 0,
      maxOutputTokens: 1500,
      ...(config.primaryModelId.startsWith("gemini-2.5") ? { thinkingBudget: 0 } : { thinkingLevel: "low" as const }),
    });
  const secondary =
    models?.secondary ??
    (config.fallbackEnabled && config.openRouterApiKey
      ? new ChatOpenRouter({
          model: config.fallbackModelId,
          apiKey: config.openRouterApiKey,
          maxRetries: 0,
          temperature: 0,
          maxTokens: 1500,
          provider: {
            only: ["Anthropic"],
            allow_fallbacks: false,
            data_collection: "deny",
            require_parameters: true,
          },
        })
      : undefined);
  const audit: AttemptAudit = {
    attempts: 0,
    successfulProvider: "gemini",
    fallbackUsed: false,
  };
  const completed: {
    name: (typeof ALLOWED_TOOLS)[number];
    toolCallId: string;
  }[] = [];
  const inventory = new Set<(typeof ALLOWED_TOOLS)[number]>();
  let nativePlanningExecuted = false;
  let canonicalResult:
    ReturnType<typeof SyntheticSampleResult.parse> | undefined;
  const calculateSample = tool(
    async (input) => {
      signal.throwIfAborted();
      if (!nativePlanningExecuted)
        throw new AgentExecutionError(
          "INVALID_INPUT",
          "Use native write_todos planning before the sample calculation.",
        );
      const value = SyntheticSampleInput.parse(input);
      if (
        Object.keys(SAMPLE).some(
          (key) =>
            value[key as keyof typeof SAMPLE] !==
            SAMPLE[key as keyof typeof SAMPLE],
        )
      )
        throw new AgentExecutionError(
          "INVALID_INPUT",
          "The spike accepts only its disclosed fixed synthetic sample.",
        );
      const potentialRent = new Arithmetic(value.areaSqft).times(
        value.annualRentPerSqft,
      );
      const effectiveGrossIncome = potentialRent.times(value.occupancyRatio);
      canonicalResult = SyntheticSampleResult.parse({
        potentialRent: potentialRent.toFixed(),
        effectiveGrossIncome: effectiveGrossIncome.toFixed(),
        noi: effectiveGrossIncome.minus(value.annualExpenses).toFixed(),
        currency: "USD",
        period: "stabilized_annual",
        dataMode: "synthetic",
      });
      return JSON.stringify(canonicalResult);
    },
    {
      name: "calculateSample",
      description:
        "Calculate the disclosed synthetic annual sample. Use exactly areaSqft=10000, annualRentPerSqft=30, occupancyRatio=0.9, annualExpenses=80000 as decimal strings. This is not sponsor data or investment advice.",
      schema: SyntheticSampleInput,
    },
  );
  const safety = createMiddleware({
    name: "KestrelToolBoundary",
    wrapModelCall: (request, handler) => {
      signal.throwIfAborted();
      const tools = request.tools.filter(
        (candidate) =>
          "name" in candidate &&
          typeof candidate.name === "string" &&
          allowed.has(candidate.name),
      );
      for (const candidate of tools)
        if ("name" in candidate)
          inventory.add(candidate.name as (typeof ALLOWED_TOOLS)[number]);
      return handler({ ...request, tools });
    },
    wrapToolCall: async (request, handler) => {
      signal.throwIfAborted();
      const name = request.toolCall.name;
      if (!allowed.has(name))
        throw new AgentExecutionError(
          "INVALID_INPUT",
          "The requested tool is not permitted.",
        );
      const result = await handler(request);
      if (name === "write_todos") nativePlanningExecuted = true;
      const toolCallId = request.toolCall.id;
      if (!toolCallId)
        throw new AgentExecutionError(
          "ANALYSIS_UNAVAILABLE",
          "The tool execution did not provide a verifiable call identifier.",
        );
      completed.push({
        name: name as (typeof ALLOWED_TOOLS)[number],
        toolCallId,
      });
      return result;
    },
  });
  let phase: "construct" | "invoke" | "assemble" = "construct";
  try {
    const backend = new StateBackend();
    const agent = createDeepAgent({
      name: "kestrel-synthetic-spike",
      model: primary,
      tools: [calculateSample],
      backend,
      subagents: [],
      middleware: [
        createFilesystemMiddleware({ backend, tools: ["read_file"] }),
        createSubAgentMiddleware({
          defaultModel: primary,
          subagents: [],
          generalPurposeAgent: false,
        }),
        todoListMiddleware(),
        modelCallLimitMiddleware({ runLimit: 8, exitBehavior: "error" }),
        toolCallLimitMiddleware({ runLimit: 16, exitBehavior: "error" }),
        safety,
        ...modelReliabilityMiddleware(primary, secondary, signal, audit),
      ],
      systemPrompt:
        "You run one fixed synthetic integration proof. First call native write_todos to plan the sample calculation. Then, in a separate turn, call calculateSample using exactly the disclosed decimal-string inputs. Reconcile the todo as completed, then explain the actual tool result briefly including annual NOI. Do not use task, delegation, filesystem, external data, memory, skills or any other capability. All numbers are fictional. Never claim a calculation ran unless its tool returned successfully.",
    });
    phase = "invoke";
    const output = await agent.invoke(
      {
        messages: [
          {
            role: "user",
            content:
              "Run the synthetic annual sample: 10000 sqft, annual gross rent 30 USD/sqft/year, occupancy ratio 0.9, annual operating expenses 80000 USD. Use native planning and calculateSample; report the canonical annual NOI.",
          },
        ],
      },
      { signal, recursionLimit: 64, callbacks: [] },
    );
    phase = "assemble";
    signal.throwIfAborted();
    const messages = output.messages;
    const actualToolIds = new Set(
      messages
        .filter(isToolMessage)
        .filter((message) => message.status !== "error")
        .map((message) => message.tool_call_id),
    );
    const observed = completed.filter((item) =>
      actualToolIds.has(item.toolCallId),
    );
    if (
      !canonicalResult ||
      !observed.some((item) => item.name === "write_todos") ||
      !observed.some((item) => item.name === "calculateSample")
    )
      throw new AgentExecutionError(
        "ANALYSIS_UNAVAILABLE",
        "The agent did not complete the required native planning and calculation tools.",
      );
    const last = messages.findLast(isAIMessage);
    const text = typeof last?.content === "string" ? last.content : "";
    if (!text.replace(/[,$\s]/g, "").includes(canonicalResult.noi))
      throw new AgentExecutionError(
        "ANALYSIS_UNAVAILABLE",
        "The model did not use the canonical tool result in its final response.",
      );
    return SyntheticSpikeResponse.parse({
      contractVersion: "1",
      dataMode: "synthetic",
      canonicalResult,
      explanation: `Synthetic annual NOI is USD ${canonicalResult.noi}, returned by the executed deterministic sample tool.`,
      modelUsage: {
        provider: audit.successfulProvider,
        modelId: audit.fallbackUsed
          ? config.fallbackModelId
          : config.primaryModelId,
        fallbackUsed: audit.fallbackUsed,
        attempts: audit.attempts,
      },
      execution: {
        requestId,
        elapsedMs: Date.now() - started,
        completedTools: observed,
        effectiveToolInventory: [...inventory].sort(),
        modelAttempts: audit.attempts,
        nativePlanningObserved: true,
        fallbackAvailability: fallbackAvailability(config),
      },
    });
  } catch (error) {
    const detail =
      error && typeof error === "object"
        ? (error as Record<string, unknown>)
        : {};
    const diagnosticName =
      typeof detail.name === "string" &&
      /^[A-Za-z0-9_.:-]{1,80}$/.test(detail.name)
        ? detail.name
        : "UnknownError";
    const code =
      typeof detail.code === "string" &&
      /^[A-Za-z0-9_.:-]{1,80}$/.test(detail.code)
        ? detail.code
        : undefined;
    onDiagnostic?.({
      phase,
      name: diagnosticName,
      status: modelErrorStatus(error),
      code,
    });
    if (callerSignal.aborted) throw callerSignal.reason;
    throw safeAgentError(error, signal.aborted);
  }
}
