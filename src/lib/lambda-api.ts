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
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda";
import { useSettings } from "@/store/settings";
import { getLambdaClient } from "./lambda-client";
import type {
  CreateFunctionInput,
  LambdaFunctionDetail,
  LambdaFunctionSummary,
  LambdaLayerSummary,
  UpdateFunctionConfigInput,
} from "./types";

/**
 * Point a presigned Code.Location at the configured backend endpoint.
 *
 * Local emulators bake their *internal* host/port into the URL: LocalStack
 * always returns `localhost.localstack.cloud:4566` even when mapped to another
 * host port, and Floci returns a bare real-AWS host. Since S3 presigning (SigV2,
 * and LocalStack's SigV4) covers the path + query but not the host, swapping the
 * scheme/host/port to the endpoint we actually talk to makes the download
 * reachable (and CORS-enabled, which emulators send). With no endpoint set (real
 * AWS) the original URL is used unchanged.
 */
function codeUrlForEndpoint(location: string): string {
  const endpoint = useSettings.getState().settings.endpoint.trim();
  if (!endpoint) return location;
  try {
    const target = new URL(location);
    const base = new URL(endpoint);
    target.protocol = base.protocol;
    target.host = base.host; // includes port
    return target.toString();
  } catch {
    return location;
  }
}

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

  /**
   * Download a function's deployment package (zip bytes) via the presigned
   * Code.Location URL, rewritten to the configured endpoint (see
   * codeUrlForEndpoint). May still fail on real AWS if the code bucket doesn't
   * return CORS headers to browsers; callers should treat errors as "code not
   * viewable here" rather than fatal.
   */
  getFunctionCode: async (functionName: string): Promise<Uint8Array> => {
    const fn = await getLambdaClient().send(new GetFunctionCommand({ FunctionName: functionName }));
    const location = fn.Code?.Location;
    if (!location) throw new Error("No downloadable code location for this function");
    const res = await fetch(codeUrlForEndpoint(location));
    if (!res.ok) throw new Error(`Failed to download code (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  },

  updateFunctionCode: async (functionName: string, zip: Uint8Array): Promise<void> => {
    await getLambdaClient().send(
      new UpdateFunctionCodeCommand({ FunctionName: functionName, ZipFile: zip }),
    );
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
