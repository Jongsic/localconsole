import {
  AddRoleToInstanceProfileCommand,
  AttachRolePolicyCommand,
  CreateInstanceProfileCommand,
  CreatePolicyCommand,
  CreateRoleCommand,
  DeleteInstanceProfileCommand,
  DeletePolicyCommand,
  DeleteRoleCommand,
  DeleteRolePolicyCommand,
  DetachRolePolicyCommand,
  GetPolicyCommand,
  GetPolicyVersionCommand,
  GetRolePolicyCommand,
  ListAttachedRolePoliciesCommand,
  ListInstanceProfilesCommand,
  ListPoliciesCommand,
  ListRolePoliciesCommand,
  ListRolesCommand,
  PutRolePolicyCommand,
  RemoveRoleFromInstanceProfileCommand,
  UpdateAssumeRolePolicyCommand,
} from "@aws-sdk/client-iam";
import { getIamClient } from "./iam-client";
import type {
  AttachedPolicy,
  CreateInstanceProfileInput,
  CreatePolicyInput,
  CreateRoleInput,
  IamInstanceProfileSummary,
  IamPolicyDetail,
  IamPolicySummary,
  IamRoleSummary,
  InlinePolicyDocument,
  PolicyScope,
} from "./types";

/**
 * IAM returns policy documents URL-encoded in some calls (GetRolePolicy,
 * GetPolicyVersion). Decode best-effort; if it isn't encoded, return as-is.
 */
function decodePolicyDocument(doc: string | undefined): string {
  if (!doc) return "";
  try {
    return decodeURIComponent(doc);
  } catch {
    return doc;
  }
}

export const api = {
  listRoles: async (): Promise<IamRoleSummary[]> => {
    const out = await getIamClient().send(new ListRolesCommand({}));
    return (out.Roles ?? []).map((r) => ({
      roleName: r.RoleName ?? "",
      arn: r.Arn ?? "",
      path: r.Path ?? "/",
      createDate: r.CreateDate ? r.CreateDate.toISOString() : null,
      description: r.Description ?? null,
      assumeRolePolicyDocument: r.AssumeRolePolicyDocument
        ? decodePolicyDocument(r.AssumeRolePolicyDocument)
        : null,
    }));
  },

  createRole: async (input: CreateRoleInput): Promise<void> => {
    await getIamClient().send(
      new CreateRoleCommand({
        RoleName: input.roleName,
        AssumeRolePolicyDocument: input.assumeRolePolicyDocument,
        ...(input.path ? { Path: input.path } : {}),
      }),
    );
  },

  deleteRole: async (roleName: string): Promise<void> => {
    await getIamClient().send(new DeleteRoleCommand({ RoleName: roleName }));
  },

  listInstanceProfiles: async (): Promise<IamInstanceProfileSummary[]> => {
    const out = await getIamClient().send(new ListInstanceProfilesCommand({}));
    return (out.InstanceProfiles ?? []).map((p) => ({
      instanceProfileName: p.InstanceProfileName ?? "",
      arn: p.Arn ?? "",
      path: p.Path ?? "/",
      createDate: p.CreateDate ? p.CreateDate.toISOString() : null,
      roleNames: (p.Roles ?? []).map((r) => r.RoleName ?? "").filter(Boolean),
    }));
  },

  createInstanceProfile: async (input: CreateInstanceProfileInput): Promise<void> => {
    await getIamClient().send(
      new CreateInstanceProfileCommand({
        InstanceProfileName: input.instanceProfileName,
        ...(input.path ? { Path: input.path } : {}),
      }),
    );
  },

  deleteInstanceProfile: async (name: string): Promise<void> => {
    await getIamClient().send(new DeleteInstanceProfileCommand({ InstanceProfileName: name }));
  },

  addRoleToInstanceProfile: async (profileName: string, roleName: string): Promise<void> => {
    await getIamClient().send(
      new AddRoleToInstanceProfileCommand({
        InstanceProfileName: profileName,
        RoleName: roleName,
      }),
    );
  },

  removeRoleFromInstanceProfile: async (profileName: string, roleName: string): Promise<void> => {
    await getIamClient().send(
      new RemoveRoleFromInstanceProfileCommand({
        InstanceProfileName: profileName,
        RoleName: roleName,
      }),
    );
  },

  /* ── Role permissions: trust / attached (managed) / inline ── */

  updateAssumeRolePolicy: async (roleName: string, document: string): Promise<void> => {
    await getIamClient().send(
      new UpdateAssumeRolePolicyCommand({ RoleName: roleName, PolicyDocument: document }),
    );
  },

  listAttachedRolePolicies: async (roleName: string): Promise<AttachedPolicy[]> => {
    const out = await getIamClient().send(
      new ListAttachedRolePoliciesCommand({ RoleName: roleName }),
    );
    return (out.AttachedPolicies ?? []).map((p) => ({
      policyName: p.PolicyName ?? "",
      policyArn: p.PolicyArn ?? "",
    }));
  },

  attachRolePolicy: async (roleName: string, policyArn: string): Promise<void> => {
    await getIamClient().send(
      new AttachRolePolicyCommand({ RoleName: roleName, PolicyArn: policyArn }),
    );
  },

  detachRolePolicy: async (roleName: string, policyArn: string): Promise<void> => {
    await getIamClient().send(
      new DetachRolePolicyCommand({ RoleName: roleName, PolicyArn: policyArn }),
    );
  },

  listRolePolicies: async (roleName: string): Promise<string[]> => {
    const out = await getIamClient().send(new ListRolePoliciesCommand({ RoleName: roleName }));
    return (out.PolicyNames ?? []).filter(Boolean);
  },

  getRolePolicy: async (roleName: string, policyName: string): Promise<InlinePolicyDocument> => {
    const out = await getIamClient().send(
      new GetRolePolicyCommand({ RoleName: roleName, PolicyName: policyName }),
    );
    return {
      policyName: out.PolicyName ?? policyName,
      document: decodePolicyDocument(out.PolicyDocument),
    };
  },

  putRolePolicy: async (roleName: string, policyName: string, document: string): Promise<void> => {
    await getIamClient().send(
      new PutRolePolicyCommand({
        RoleName: roleName,
        PolicyName: policyName,
        PolicyDocument: document,
      }),
    );
  },

  deleteRolePolicy: async (roleName: string, policyName: string): Promise<void> => {
    await getIamClient().send(
      new DeleteRolePolicyCommand({ RoleName: roleName, PolicyName: policyName }),
    );
  },

  /* ── Managed policies ── */

  listPolicies: async (scope: PolicyScope = "Local"): Promise<IamPolicySummary[]> => {
    const out = await getIamClient().send(new ListPoliciesCommand({ Scope: scope }));
    return (out.Policies ?? []).map((p) => {
      const arn = p.Arn ?? "";
      return {
        policyName: p.PolicyName ?? "",
        arn,
        path: p.Path ?? "/",
        attachmentCount: p.AttachmentCount ?? 0,
        isAwsManaged: arn.startsWith("arn:aws:iam::aws:"),
        createDate: p.CreateDate ? p.CreateDate.toISOString() : null,
      };
    });
  },

  createPolicy: async (input: CreatePolicyInput): Promise<void> => {
    await getIamClient().send(
      new CreatePolicyCommand({
        PolicyName: input.policyName,
        PolicyDocument: input.document,
        ...(input.path ? { Path: input.path } : {}),
      }),
    );
  },

  deletePolicy: async (arn: string): Promise<void> => {
    await getIamClient().send(new DeletePolicyCommand({ PolicyArn: arn }));
  },

  getPolicy: async (arn: string): Promise<IamPolicyDetail> => {
    const out = await getIamClient().send(new GetPolicyCommand({ PolicyArn: arn }));
    const p = out.Policy ?? {};
    const defaultVersionId = p.DefaultVersionId ?? null;
    let document: string | null = null;
    if (defaultVersionId) {
      const ver = await getIamClient().send(
        new GetPolicyVersionCommand({ PolicyArn: arn, VersionId: defaultVersionId }),
      );
      document = decodePolicyDocument(ver.PolicyVersion?.Document) || null;
    }
    return {
      policyName: p.PolicyName ?? "",
      arn: p.Arn ?? arn,
      path: p.Path ?? "/",
      defaultVersionId,
      attachmentCount: p.AttachmentCount ?? 0,
      isAwsManaged: (p.Arn ?? arn).startsWith("arn:aws:iam::aws:"),
      createDate: p.CreateDate ? p.CreateDate.toISOString() : null,
      updateDate: p.UpdateDate ? p.UpdateDate.toISOString() : null,
      document,
    };
  },
};
