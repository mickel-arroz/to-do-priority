import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";
import { CLIENT_ID_HEADER, getTabClientId } from "@/lib/live-sync";

function mockFetch() {
  const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function headersOf(fetchMock: ReturnType<typeof mockFetch>) {
  const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
  return new Headers(init.headers);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clientId de la pestaña en las peticiones", () => {
  it("lo envía en las que modifican algo", async () => {
    const fetchMock = mockFetch();
    await api.tasks.complete("t1", "yes");
    expect(headersOf(fetchMock).get(CLIENT_ID_HEADER)).toBe(getTabClientId());
  });

  it("también al subir una imagen", async () => {
    const fetchMock = mockFetch();
    await api.tasks.uploadImage("t1", new File(["x"], "a.png", { type: "image/png" }));
    expect(headersOf(fetchMock).get(CLIENT_ID_HEADER)).toBe(getTabClientId());
  });

  it("no en las lecturas", async () => {
    const fetchMock = mockFetch();
    await api.tasks.board({ kind: "home" });
    expect(headersOf(fetchMock).has(CLIENT_ID_HEADER)).toBe(false);
  });

  it("es el mismo en toda la pestaña", () => {
    expect(getTabClientId()).toBe(getTabClientId());
  });
});
