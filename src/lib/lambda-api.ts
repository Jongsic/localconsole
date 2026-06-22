import {
  CreateFunctionCommand,
  DeleteFunctionCommand,
  DeleteLayerVersionCommand,
  type FunctionConfiguration,
  GetFunctionCommand,
  GetFunctionConfigurationCommand,
  ListFunctionsCommand,
  ListLayersCommand,
  type Runtime,
  UpdateFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda";
import { getLambdaClient } from "./lambda-client";
import type {
  CreateFunctionInput,
  LambdaFunctionDetail,
  LambdaFunctionSummary,
  LambdaLayerSummary,
  UpdateFunctionConfigInput,
} from "./types";

/** Shared mapping of the fields common to ListFunctions / GetFunctionConfiguration. */
function summarize(f: FunctionConfiguration): LambdaFunctionSummary {
  return {
    functionName: f.FunctionName ?? "",
    runtime: f.Runtime ?? null,
    handler: f.Handler ?? null,
    memorySize: f.MemorySize ?? null,
    timeout: f.Timeout ?? null,
    codeSize: f.CodeSize ?? null,
    lastModified: f.LastModified ?? null,
    architectures: f.Architectures ?? [],
    packageType: f.PackageType ?? null,
  };
}

export const api = {
  listFunctions: async (): Promise<LambdaFunctionSummary[]> => {
    const out = await getLambdaClient().send(new ListFunctionsCommand({}));
    return (out.Functions ?? []).map(summarize);
  },

  getFunction: async (functionName: string): Promise<LambdaFunctionDetail> => {
    const cfg = await getLambdaClient().send(
      new GetFunctionConfigurationCommand({ FunctionName: functionName }),
    );
    // The code location lives on GetFunction; treat it as best-effort.
    let codeLocation: string | null = null;
    try {
      const fn = await getLambdaClient().send(
        new GetFunctionCommand({ FunctionName: functionName }),
      );
      codeLocation = fn.Code?.Location ?? null;
    } catch {
      codeLocation = null;
    }
    return {
      ...summarize(cfg),
      role: cfg.Role ?? null,
      description: cfg.Description ?? null,
      state: cfg.State ?? null,
      lastUpdateStatus: cfg.LastUpdateStatus ?? null,
      environment: cfg.Environment?.Variables ?? {},
      codeLocation,
    };
  },

  createFunction: async (input: CreateFunctionInput): Promise<void> => {
    await getLambdaClient().send(
      new CreateFunctionCommand({
        FunctionName: input.functionName,
        Runtime: input.runtime as Runtime,
        Handler: input.handler,
        Role: input.role,
        Code: { ZipFile: input.code },
        ...(input.memorySize != null ? { MemorySize: input.memorySize } : {}),
        ...(input.timeout != null ? { Timeout: input.timeout } : {}),
        ...(input.description != null ? { Description: input.description } : {}),
        ...(input.environment ? { Environment: { Variables: input.environment } } : {}),
      }),
    );
  },

  updateFunctionConfiguration: async (input: UpdateFunctionConfigInput): Promise<void> => {
    await getLambdaClient().send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: input.functionName,
        ...(input.memorySize != null ? { MemorySize: input.memorySize } : {}),
        ...(input.timeout != null ? { Timeout: input.timeout } : {}),
        ...(input.handler != null ? { Handler: input.handler } : {}),
        ...(input.description != null ? { Description: input.description } : {}),
      }),
    );
  },

  updateFunctionEnvironment: async (
    functionName: string,
    vars: Record<string, string>,
  ): Promise<void> => {
    await getLambdaClient().send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: functionName,
        Environment: { Variables: vars },
      }),
    );
  },

  deleteFunction: async (functionName: string): Promise<void> => {
    await getLambdaClient().send(new DeleteFunctionCommand({ FunctionName: functionName }));
  },

  listLayers: async (): Promise<LambdaLayerSummary[]> => {
    const out = await getLambdaClient().send(new ListLayersCommand({}));
    return (out.Layers ?? []).map((l) => ({
      layerName: l.LayerName ?? "",
      latestVersion: l.LatestMatchingVersion?.Version ?? null,
      latestVersionArn: l.LatestMatchingVersion?.LayerVersionArn ?? null,
      compatibleRuntimes: l.LatestMatchingVersion?.CompatibleRuntimes ?? [],
      createdDate: l.LatestMatchingVersion?.CreatedDate ?? null,
    }));
  },

  deleteLayerVersion: async (layerName: string, versionNumber: number): Promise<void> => {
    await getLambdaClient().send(
      new DeleteLayerVersionCommand({ LayerName: layerName, VersionNumber: versionNumber }),
    );
  },
};
