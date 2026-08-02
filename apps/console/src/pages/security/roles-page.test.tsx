import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RolesPage } from "@/pages/security/roles-page";
import { PERMISSION_ACTIONS, MESH_ROLES } from "@/lib/permissions";

describe("RolesPage", () => {
  it("renders permission matrix headers and sample cells", () => {
    render(<RolesPage />);

    expect(screen.getByRole("heading", { name: "Roles" })).toBeInTheDocument();

    for (const role of MESH_ROLES) {
      expect(screen.getByRole("columnheader", { name: new RegExp(role, "i") })).toBeInTheDocument();
    }

    const firstAction = PERMISSION_ACTIONS[0]!.replace(/_/g, " ");
    expect(screen.getByText(new RegExp(firstAction, "i"))).toBeInTheDocument();

    const allowBadges = screen.getAllByText("Allow");
    const denyBadges = screen.getAllByText("Deny");
    expect(allowBadges.length + denyBadges.length).toBe(
      PERMISSION_ACTIONS.length * MESH_ROLES.length,
    );
  });
});
