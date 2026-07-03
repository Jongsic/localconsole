import {
  CreateFunctionCommand,
  DeleteFunctionCommand,
  DeleteLayerVersionCommand,
  GetFunctionCommand,
  GetFunctionConfigurationCommand,
  LambdaClient,
  ListFunctionsCommand,
  ListLayersCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettings } from "@/store/settings";
import { api } from "./lambda-api";

const lambda = mockClient(LambdaClient);

beforeEach(() => lambda.reset());

describe("listFunctions mapping", () => {
  it("maps config fields + architectures + packageType", async () => {
    lambda.on(ListFunctionsCommand).resolves({
      Functions: [
        {
          FunctionName: "fn-1",
          Runtime: "nodejs20.x",
          Handler: "index.handler",
          MemorySize: 256,
          Timeout: 30,
          CodeSize: 1024,
          LastModified: "2024-01-01T00:00:00.000+0000",
          Architectures: ["x86_64"],
          PackageType: "Zip",
        },
      ],
    });
    const r = await api.listFunctions();
    expect(r[0]).toEqual({
      functionName: "fn-1",
      runtime: "nodejs20.x",
      handler: "index.handler",
      memorySize: 256,
      timeout: 30,
      codeSize: 1024,
      lastModified: "2024-01-01T00:00:00.000+0000",
      architectures: ["x86_64"],
      packageType: "Zip",
    });
  });

  it("returns [] on empty response", async () => {
    lambda.on(ListFunctionsCommand).resolves({});
    await expect(api.listFunctions()).resolves.toEqual([]);
  });
});

describe("getFunction mapping", () => {
  it("maps config detail + environment record + code location", async () => {
    lambda.on(GetFunctionConfigurationCommand).resolves({
      FunctionName: "fn-1",
      Runtime: "python3.12",
      Handler: "app.handler",
      MemorySize: 512,
      Timeout: 60,
      CodeSize: 2048,
      LastModified: "2024-02-02T00:00:00.000+0000",
      Architectures: ["arm64"],
      PackageType: "Zip",
      Role: "arn:aws:iam::000000000000:role/fn-role",
      Description: "my function",
      State: "Active",
      LastUpdateStatus: "Successful",
      Environment: { Variables: { FOO: "bar", LOG_LEVEL: "debug" } },
    });
    lambda.on(GetFunctionCommand).resolves({
      Code: { Location: "https://example.com/code.zip" },
    });
    const r = await api.getFunction("fn-1");
    expect(r).toEqual({
      functionName: "fn-1",
      runtime: "python3.12",
      handler: "app.handler",
      memorySize: 512,
      timeout: 60,
      codeSize: 2048,
      lastModified: "2024-02-02T00:00:00.000+0000",
      architectures: ["arm64"],
      packageType: "Zip",
      role: "arn:aws:iam::000000000000:role/fn-role",
      description: "my function",
      state: "Active",
      lastUpdateStatus: "Successful",
      environment: { FOO: "bar", LOG_LEVEL: "debug" },
      codeLocation: "https://example.com/code.zip",
    });
  });

  it("falls back to empty env + null code location when absent", async () => {
    lambda.on(GetFunctionConfigurationCommand).resolves({ FunctionName: "fn-2" });
    lambda.on(GetFunctionCommand).rejects(new Error("boom"));
    const r = await api.getFunction("fn-2");
    expect(r.environment).toEqual({});
    expect(r.codeLocation).toBeNull();
  });
});

describe("listLayers mapping", () => {
  it("maps name + latest version + compatible runtimes", async () => {
    lambda.on(ListLayersCommand).resolves({
      Layers: [
        {
          LayerName: "layer-1",
          LatestMatchingVersion: {
            Version: 3,
            LayerVersionArn: "arn:aws:lambda:us-east-1:000000000000:layer:layer-1:3",
            CompatibleRuntimes: ["nodejs20.x"],
            CreatedDate: "2024-03-03T00:00:00.000+0000",
          },
        },
      ],
    });
    const r = await api.listLayers();
    expect(r[0]).toEqual({
      layerName: "layer-1",
      latestVersion: 3,
      latestVersionArn: "arn:aws:lambda:us-east-1:000000000000:layer:layer-1:3",
      compatibleRuntimes: ["nodejs20.x"],
      createdDate: "2024-03-03T00:00:00.000+0000",
    });
  });

  it("returns [] on empty response", async () => {
    lambda.on(ListLayersCommand).resolves({});
    await expect(api.listLayers()).resolves.toEqual([]);
  });
});

describe("createFunction command shape", () => {
  it("passes code bytes as Code.ZipFile + core fields", async () => {
    lambda.on(CreateFunctionCommand).resolves({});
    const code = new Uint8Array([80, 75, 3, 4, 1, 2, 3]);
    await api.createFunction({
      functionName: "fn-new",
      runtime: "nodejs20.x",
      handler: "index.handler",
      role: "arn:aws:iam::000000000000:role/fn-role",
      code,
      memorySize: 256,
      timeout: 15,
    });
    const input = lambda.commandCalls(CreateFunctionCommand)[0]?.args[0].input;
    expect(input?.FunctionName).toBe("fn-new");
    expect(input?.Runtime).toBe("nodejs20.x");
    expect(input?.Handler).toBe("index.handler");
    expect(input?.Role).toBe("arn:aws:iam::000000000000:role/fn-role");
    expect(input?.Code?.ZipFile).toBe(code);
    expect(input?.MemorySize).toBe(256);
    expect(input?.Timeout).toBe(15);
    expect(input?.Environment).toBeUndefined();
  });

  it("wraps environment in Environment.Variables when provided", async () => {
    lambda.on(CreateFunctionCommand).resolves({});
    await api.createFunction({
      functionName: "fn-env",
      runtime: "python3.12",
      handler: "lambda_function.lambda_handler",
      role: "arn:aws:iam::000000000000:role/fn-role",
      code: new Uint8Array([1, 2, 3]),
      environment: { FOO: "bar" },
    });
    const input = lambda.commandCalls(CreateFunctionCommand)[0]?.args[0].input;
    expect(input?.Environment).toEqual({ Variables: { FOO: "bar" } });
  });
});

describe("write/command shapes", () => {
  it("updateFunctionConfiguration sends only provided fields", async () => {
    lambda.on(UpdateFunctionConfigurationCommand).resolves({});
    await api.updateFunctionConfiguration({
      functionName: "fn-1",
      memorySize: 256,
      timeout: 30,
      handler: "index.handler",
      description: "updated",
    });
    expect(lambda.commandCalls(UpdateFunctionConfigurationCommand)[0]?.args[0].input).toEqual({
      FunctionName: "fn-1",
      MemorySize: 256,
      Timeout: 30,
      Handler: "index.handler",
      Description: "updated",
    });
  });

  it("updateFunctionEnvironment wraps vars in Environment.Variables", async () => {
    lambda.on(UpdateFunctionConfigurationCommand).resolves({});
    await api.updateFunctionEnvironment("fn-1", { FOO: "bar" });
    expect(lambda.commandCalls(UpdateFunctionConfigurationCommand)[0]?.args[0].input).toEqual({
      FunctionName: "fn-1",
      Environment: { Variables: { FOO: "bar" } },
    });
  });

  it("deleteFunction sends the name", async () => {
    lambda.on(DeleteFunctionCommand).resolves({});
    await api.deleteFunction("fn-1");
    expect(lambda.commandCalls(DeleteFunctionCommand)[0]?.args[0].input).toEqual({
      FunctionName: "fn-1",
    });
  });

  it("deleteLayerVersion sends the layer name + version number", async () => {
    lambda.on(DeleteLayerVersionCommand).resolves({});
    await api.deleteLayerVersion("layer-1", 3);
    expect(lambda.commandCalls(DeleteLayerVersionCommand)[0]?.args[0].input).toEqual({
      LayerName: "layer-1",
      VersionNumber: 3,
    });
  });

  it("updateFunctionCode sends the zip bytes", async () => {
    lambda.on(UpdateFunctionCodeCommand).resolves({});
    const zip = new Uint8Array([80, 75, 3, 4]);
    await api.updateFunctionCode("fn-1", zip);
    expect(lambda.commandCalls(UpdateFunctionCodeCommand)[0]?.args[0].input).toEqual({
      FunctionName: "fn-1",
      ZipFile: zip,
    });
  });
});

describe("getFunctionCode", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("downloads and returns the package bytes from Code.Location", async () => {
    lambda.on(GetFunctionCommand).resolves({ Code: { Location: "https://example.com/code.zip" } });
    const bytes = new Uint8Array([1, 2, 3]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes.buffer }),
    );
    const out = await api.getFunctionCode("fn-1");
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });

  it("throws when there is no code location", async () => {
    lambda.on(GetFunctionCommand).resolves({ Code: {} });
    await expect(api.getFunctionCode("fn-1")).rejects.toThrow(/No downloadable code/);
  });

  it("throws when the download fails (e.g. CORS/non-2xx)", async () => {
    lambda.on(GetFunctionCommand).resolves({ Code: { Location: "https://example.com/code.zip" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(api.getFunctionCode("fn-1")).rejects.toThrow(/Failed to download code \(403\)/);
  });

  it("rewrites the presigned URL host/port to the configured endpoint, keeping path+query", async () => {
    const prev = useSettings.getState().settings;
    useSettings.setState({ settings: { ...prev, endpoint: "http://localhost:4599" } });
    lambda.on(GetFunctionCommand).resolves({
      // LocalStack-style: internal host + SigV2 query the endpoint doesn't serve at :4566.
      Code: {
        Location:
          "http://localhost.localstack.cloud:4566/awslambda-us-east-1-tasks/snap/fn-x?AWSAccessKeyId=abc&Signature=sig%2Fx&Expires=123",
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([9]).buffer });
    vi.stubGlobal("fetch", fetchMock);

    await api.getFunctionCode("fn-x");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4599/awslambda-us-east-1-tasks/snap/fn-x?AWSAccessKeyId=abc&Signature=sig%2Fx&Expires=123",
    );

    useSettings.setState({ settings: prev });
  });

  it("leaves the URL unchanged when no endpoint is set (real AWS)", async () => {
    const prev = useSettings.getState().settings;
    useSettings.setState({ settings: { ...prev, endpoint: "" } });
    lambda
      .on(GetFunctionCommand)
      .resolves({ Code: { Location: "https://real-bucket.s3.amazonaws.com/key?sig=1" } });
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([9]).buffer });
    vi.stubGlobal("fetch", fetchMock);

    await api.getFunctionCode("fn-y");
    expect(fetchMock).toHaveBeenCalledWith("https://real-bucket.s3.amazonaws.com/key?sig=1");

    useSettings.setState({ settings: prev });
  });
});
