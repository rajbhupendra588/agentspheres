import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_TENANT_ID } from "@agentsphere/contracts";
import type { MeshRole } from "@/models/mesh";

const AUTH_STORAGE_KEY = "agentsphere.auth";

export interface AuthSession {
  accessToken: string;
  subject: string;
  role: MeshRole;
  tenantId: string;
  projectId?: string;
}

interface AuthState {
  accessToken: string | null;
  subject: string | null;
  role: MeshRole | null;
  tenantId: string;
  projectId: string | null;
  setSession: (session: AuthSession) => void;
  setTenantContext: (tenantId: string, projectId?: string | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      subject: null,
      role: null,
      tenantId: DEFAULT_TENANT_ID,
      projectId: null,
      setSession: ({ accessToken, subject, role, tenantId, projectId }) =>
        set({
          accessToken,
          subject,
          role,
          tenantId,
          projectId: projectId ?? null,
        }),
      setTenantContext: (tenantId, projectId) =>
        set({
          tenantId,
          projectId: projectId ?? null,
        }),
      clearSession: () =>
        set({ accessToken: null, subject: null, role: null }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      partialize: (state) => ({
        accessToken: state.accessToken,
        subject: state.subject,
        role: state.role,
        tenantId: state.tenantId,
        projectId: state.projectId,
      }),
    },
  ),
);
