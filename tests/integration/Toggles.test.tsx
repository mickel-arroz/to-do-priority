import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { useT } from "@/lib/i18n/locale-context";
import { renderWithProviders } from "./helpers";

function Probe() {
  const t = useT();
  return (
    <>
      <LanguageToggle />
      <span data-testid="probe">{t.nav.home}</span>
    </>
  );
}

describe("LanguageToggle", () => {
  it("switches the whole dictionary ES <-> EN and persists to localStorage", async () => {
    renderWithProviders(<Probe />, { locale: "es" });
    expect(screen.getByTestId("probe")).toHaveTextContent("Inicio");
    expect(screen.getByTestId("language-toggle")).toHaveTextContent("ES");

    await userEvent.click(screen.getByTestId("language-toggle"));
    expect(screen.getByTestId("probe")).toHaveTextContent("Home");
    expect(screen.getByTestId("language-toggle")).toHaveTextContent("EN");
    expect(localStorage.getItem("locale")).toBe("en");
    expect(document.cookie).toContain("locale=en");

    await userEvent.click(screen.getByTestId("language-toggle"));
    expect(screen.getByTestId("probe")).toHaveTextContent("Inicio");
    expect(localStorage.getItem("locale")).toBe("es");
  });
});
