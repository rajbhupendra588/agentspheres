import { z } from "zod";

/** Organization / hard isolation boundary. */
export const TenantIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, "Invalid tenant id");

export type TenantId = z.infer<typeof TenantIdSchema>;

/** Optional project scope within a tenant. */
export const ProjectIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, "Invalid project id");

export type ProjectId = z.infer<typeof ProjectIdSchema>;

export const DEFAULT_TENANT_ID = "default" as const;

export const TENANT_HEADER = "x-tenant-id" as const;
export const PROJECT_HEADER = "x-project-id" as const;

export const MeshRoleSchema = z.enum(["admin", "developer", "agent", "viewer"]);
export type MeshRole = z.infer<typeof MeshRoleSchema>;

export const JwtClaimsSchema = z.object({
  sub: z.string().min(1),
  role: MeshRoleSchema,
  tenantId: TenantIdSchema,
  projectId: ProjectIdSchema.optional(),
});

export type JwtClaims = z.infer<typeof JwtClaimsSchema>;

export const TokenRequestSchema = z.object({
  subject: z.string().min(1),
  role: MeshRoleSchema.optional(),
  tenantId: TenantIdSchema,
  projectId: ProjectIdSchema.optional(),
});

export type TokenRequest = z.infer<typeof TokenRequestSchema>;

export const TokenResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  tokenType: z.literal("Bearer"),
  tenantId: TenantIdSchema,
  projectId: ProjectIdSchema.optional(),
  role: MeshRoleSchema,
  subject: z.string().min(1),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;

export const TenantStatusSchema = z.enum(["active", "suspended"]);
export type TenantStatus = z.infer<typeof TenantStatusSchema>;

export const TenantRecordSchema = z.object({
  tenantId: TenantIdSchema,
  displayName: z.string().min(1).max(200),
  status: TenantStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  agentCount: z.number().int().nonnegative().optional(),
  memberCount: z.number().int().nonnegative().optional(),
});

export type TenantRecord = z.infer<typeof TenantRecordSchema>;

export const CreateTenantRequestSchema = z.object({
  tenantId: TenantIdSchema,
  displayName: z.string().min(1).max(200).optional(),
});

export type CreateTenantRequest = z.infer<typeof CreateTenantRequestSchema>;

export const TenantMemberSchema = z.object({
  subject: z.string().min(1),
  role: MeshRoleSchema,
  tenantId: TenantIdSchema,
  createdAt: z.string().datetime(),
});

export type TenantMember = z.infer<typeof TenantMemberSchema>;

export const InviteTenantMemberRequestSchema = z.object({
  subject: z.string().min(1),
  role: MeshRoleSchema.optional(),
});

export type InviteTenantMemberRequest = z.infer<
  typeof InviteTenantMemberRequestSchema
>;
