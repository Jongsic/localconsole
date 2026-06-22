import {
  AddRoleToInstanceProfileCommand,
  AttachRolePolicyCommand,
  CreateInstanceProfileCommand,
  CreatePolicyCommand,
  CreateRoleCommand,
  DeleteInstanceProfileCommand,
  DeleteRoleCommand,
  GetRolePolicyCommand,
  IAMClient,
  ListAttachedRolePoliciesCommand,
  ListInstanceProfilesCommand,
  ListPoliciesCommand,
  ListRolePoliciesCommand,
  ListRolesCommand,
  PutRolePolicyCommand,
  RemoveRoleFromInstanceProfileCommand,
  UpdateAssumeRolePolicyCommand,
} from "@aws-sdk/client-iam";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./iam-api";

// mockClient intercepts the SDK at the client layer, so it works regardless of
// the module-level client cache in iam-client.ts. These tests exercise the
// response→our-type mapping (and command-input shape) entirely offline.
const iam = mockClient(IAMClient);

beforeEach(() => iam.reset());

describe("listRoles mapping", () => {
  it("maps role fields + createDate ISO string", async () => {
    iam.on(ListRolesCommand).resolves({
      Roles: [
        {
          RoleName: "app-role",
          RoleId: "AROAEXAMPLE",
          Arn: "arn:aws:iam::000000000000:role/app-role",
          Path: "/service/",
          CreateDate: new Date("2024-01-01T00:00:00Z"),
          Description: "app role",
          // required SDK field on the shape, irrelevant to our mapping
          AssumeRolePolicyDocument: "{}",
        },
      ],
    });
    const r = await api.listRoles();
    expect(r[0]).toMatchObject({
      roleName: "app-role",
      arn: "arn:aws:iam::000000000000:role/app-role",
      path: "/service/",
      createDate: "2024-01-01T00:00:00.000Z",
      description: "app role",
    });
  });

  it("returns [] on an empty response", async () => {
    iam.on(ListRolesCommand).resolves({});
    await expect(api.listRoles()).resolves.toEqual([]);
  });
});

describe("listInstanceProfiles mapping", () => {
  it("maps profile fields + nested role names", async () => {
    iam.on(ListInstanceProfilesCommand).resolves({
      InstanceProfiles: [
        {
          InstanceProfileName: "web-profile",
          InstanceProfileId: "AIPAEXAMPLE",
          Arn: "arn:aws:iam::000000000000:instance-profile/web-profile",
          Path: "/",
          CreateDate: new Date("2024-02-02T00:00:00Z"),
          Roles: [
            // RoleName-only shape is enough for our mapping
            { RoleName: "app-role" } as never,
            { RoleName: "logs-role" } as never,
          ],
        },
      ],
    });
    const r = await api.listInstanceProfiles();
    expect(r[0]).toMatchObject({
      instanceProfileName: "web-profile",
      arn: "arn:aws:iam::000000000000:instance-profile/web-profile",
      path: "/",
      createDate: "2024-02-02T00:00:00.000Z",
      roleNames: ["app-role", "logs-role"],
    });
  });

  it("returns [] on an empty response", async () => {
    iam.on(ListInstanceProfilesCommand).resolves({});
    await expect(api.listInstanceProfiles()).resolves.toEqual([]);
  });
});

describe("write/command shapes", () => {
  it("createRole sends RoleName + AssumeRolePolicyDocument and omits Path when blank", async () => {
    iam.on(CreateRoleCommand).resolves({});
    await api.createRole({ roleName: "app-role", assumeRolePolicyDocument: "{}" });
    const input = iam.commandCalls(CreateRoleCommand)[0]?.args[0].input;
    expect(input).toEqual({ RoleName: "app-role", AssumeRolePolicyDocument: "{}" });
  });

  it("createRole includes Path when provided", async () => {
    iam.on(CreateRoleCommand).resolves({});
    await api.createRole({
      roleName: "app-role",
      path: "/service/",
      assumeRolePolicyDocument: "{}",
    });
    expect(iam.commandCalls(CreateRoleCommand)[0]?.args[0].input).toMatchObject({
      Path: "/service/",
    });
  });

  it("deleteRole sends the role name", async () => {
    iam.on(DeleteRoleCommand).resolves({});
    await api.deleteRole("app-role");
    expect(iam.commandCalls(DeleteRoleCommand)[0]?.args[0].input).toEqual({ RoleName: "app-role" });
  });

  it("createInstanceProfile sends the name and omits Path when blank", async () => {
    iam.on(CreateInstanceProfileCommand).resolves({});
    await api.createInstanceProfile({ instanceProfileName: "web-profile" });
    expect(iam.commandCalls(CreateInstanceProfileCommand)[0]?.args[0].input).toEqual({
      InstanceProfileName: "web-profile",
    });
  });

  it("deleteInstanceProfile sends the name", async () => {
    iam.on(DeleteInstanceProfileCommand).resolves({});
    await api.deleteInstanceProfile("web-profile");
    expect(iam.commandCalls(DeleteInstanceProfileCommand)[0]?.args[0].input).toEqual({
      InstanceProfileName: "web-profile",
    });
  });

  it("addRoleToInstanceProfile sends profile + role", async () => {
    iam.on(AddRoleToInstanceProfileCommand).resolves({});
    await api.addRoleToInstanceProfile("web-profile", "app-role");
    expect(iam.commandCalls(AddRoleToInstanceProfileCommand)[0]?.args[0].input).toEqual({
      InstanceProfileName: "web-profile",
      RoleName: "app-role",
    });
  });

  it("removeRoleFromInstanceProfile sends profile + role", async () => {
    iam.on(RemoveRoleFromInstanceProfileCommand).resolves({});
    await api.removeRoleFromInstanceProfile("web-profile", "app-role");
    expect(iam.commandCalls(RemoveRoleFromInstanceProfileCommand)[0]?.args[0].input).toEqual({
      InstanceProfileName: "web-profile",
      RoleName: "app-role",
    });
  });
});

describe("role policy mappings + shapes", () => {
  it("listAttachedRolePolicies maps name + arn", async () => {
    iam.on(ListAttachedRolePoliciesCommand).resolves({
      AttachedPolicies: [
        {
          PolicyName: "AmazonS3ReadOnlyAccess",
          PolicyArn: "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess",
        },
      ],
    });
    const r = await api.listAttachedRolePolicies("app-role");
    expect(r).toEqual([
      {
        policyName: "AmazonS3ReadOnlyAccess",
        policyArn: "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess",
      },
    ]);
  });

  it("listAttachedRolePolicies returns [] on empty", async () => {
    iam.on(ListAttachedRolePoliciesCommand).resolves({});
    await expect(api.listAttachedRolePolicies("app-role")).resolves.toEqual([]);
  });

  it("listRolePolicies returns inline names ([] on empty)", async () => {
    iam.on(ListRolePoliciesCommand).resolves({ PolicyNames: ["inline-a", "inline-b"] });
    await expect(api.listRolePolicies("app-role")).resolves.toEqual(["inline-a", "inline-b"]);
    iam.on(ListRolePoliciesCommand).resolves({});
    await expect(api.listRolePolicies("app-role")).resolves.toEqual([]);
  });

  it("getRolePolicy URL-decodes the document", async () => {
    iam.on(GetRolePolicyCommand).resolves({
      PolicyName: "inline-a",
      PolicyDocument: encodeURIComponent('{"Version":"2012-10-17"}'),
    });
    const r = await api.getRolePolicy("app-role", "inline-a");
    expect(r).toEqual({ policyName: "inline-a", document: '{"Version":"2012-10-17"}' });
  });

  it("attachRolePolicy sends RoleName + PolicyArn", async () => {
    iam.on(AttachRolePolicyCommand).resolves({});
    await api.attachRolePolicy("app-role", "arn:aws:iam::aws:policy/X");
    expect(iam.commandCalls(AttachRolePolicyCommand)[0]?.args[0].input).toEqual({
      RoleName: "app-role",
      PolicyArn: "arn:aws:iam::aws:policy/X",
    });
  });

  it("putRolePolicy sends RoleName + PolicyName + PolicyDocument", async () => {
    iam.on(PutRolePolicyCommand).resolves({});
    await api.putRolePolicy("app-role", "inline-a", "{}");
    expect(iam.commandCalls(PutRolePolicyCommand)[0]?.args[0].input).toEqual({
      RoleName: "app-role",
      PolicyName: "inline-a",
      PolicyDocument: "{}",
    });
  });

  it("updateAssumeRolePolicy sends RoleName + PolicyDocument", async () => {
    iam.on(UpdateAssumeRolePolicyCommand).resolves({});
    await api.updateAssumeRolePolicy("app-role", "{}");
    expect(iam.commandCalls(UpdateAssumeRolePolicyCommand)[0]?.args[0].input).toEqual({
      RoleName: "app-role",
      PolicyDocument: "{}",
    });
  });
});

describe("managed policy mappings + shapes", () => {
  it("listPolicies maps fields + flags AWS-managed by arn", async () => {
    iam.on(ListPoliciesCommand).resolves({
      Policies: [
        {
          PolicyName: "my-policy",
          Arn: "arn:aws:iam::000000000000:policy/my-policy",
          Path: "/",
          AttachmentCount: 2,
          CreateDate: new Date("2024-03-03T00:00:00Z"),
        },
        {
          PolicyName: "AmazonS3FullAccess",
          Arn: "arn:aws:iam::aws:policy/AmazonS3FullAccess",
          Path: "/",
          AttachmentCount: 0,
        },
      ],
    });
    const r = await api.listPolicies("All");
    expect(r[0]).toMatchObject({
      policyName: "my-policy",
      arn: "arn:aws:iam::000000000000:policy/my-policy",
      path: "/",
      attachmentCount: 2,
      isAwsManaged: false,
      createDate: "2024-03-03T00:00:00.000Z",
    });
    expect(r[1]?.isAwsManaged).toBe(true);
    expect(iam.commandCalls(ListPoliciesCommand)[0]?.args[0].input).toEqual({ Scope: "All" });
  });

  it("listPolicies defaults scope to Local and returns [] on empty", async () => {
    iam.on(ListPoliciesCommand).resolves({});
    await expect(api.listPolicies()).resolves.toEqual([]);
    expect(iam.commandCalls(ListPoliciesCommand)[0]?.args[0].input).toEqual({ Scope: "Local" });
  });

  it("createPolicy sends name + document and omits Path when blank", async () => {
    iam.on(CreatePolicyCommand).resolves({});
    await api.createPolicy({ policyName: "my-policy", document: "{}" });
    expect(iam.commandCalls(CreatePolicyCommand)[0]?.args[0].input).toEqual({
      PolicyName: "my-policy",
      PolicyDocument: "{}",
    });
  });

  it("createPolicy includes Path when provided", async () => {
    iam.on(CreatePolicyCommand).resolves({});
    await api.createPolicy({ policyName: "my-policy", path: "/team/", document: "{}" });
    expect(iam.commandCalls(CreatePolicyCommand)[0]?.args[0].input).toMatchObject({
      Path: "/team/",
    });
  });
});
