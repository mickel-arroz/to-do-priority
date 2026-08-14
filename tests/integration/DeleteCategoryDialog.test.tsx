import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteCategoryDialog } from "@/components/categories/DeleteCategoryDialog";
import type { Category } from "@/lib/types";
import { renderWithProviders, routerMock } from "./helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
}));

const removeMock = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/api/client", () => ({
  api: { categories: { remove: (...args: unknown[]) => removeMock(...args) } },
  ApiError: class extends Error {},
}));

const category: Category = {
  id: "cat-1",
  user_id: "u1",
  name: "Trabajo",
  is_default: false,
  position: 1,
  icon: "list",
  color: null,
  created_at: "",
};

beforeEach(() => removeMock.mockClear());

describe("DeleteCategoryDialog", () => {
  it("offers move-to-General and delete-all when the list has tasks", async () => {
    renderWithProviders(
      <DeleteCategoryDialog
        category={category}
        hasTasks
        open
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByText(/¿Qué quieres hacer con ellas\?/)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("delete-move"));
    expect(removeMock).toHaveBeenCalledWith("cat-1", "move");
  });

  it("deletes tasks along with the list", async () => {
    renderWithProviders(
      <DeleteCategoryDialog
        category={category}
        hasTasks
        open
        onOpenChange={vi.fn()}
      />
    );
    await userEvent.click(screen.getByTestId("delete-all"));
    expect(removeMock).toHaveBeenCalledWith("cat-1", "delete");
  });

  it("skips the strategy question when the list is empty", () => {
    renderWithProviders(
      <DeleteCategoryDialog
        category={category}
        hasTasks={false}
        open
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.queryByTestId("delete-move")).not.toBeInTheDocument();
    expect(screen.getByTestId("delete-all")).toBeInTheDocument();
  });
});
