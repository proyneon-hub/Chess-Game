import { afterEach, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));
import { withGuest } from "@/lib/serverHttp";
import { IncompatibleStateError } from "@/lib/game/validation";
afterEach(() => vi.restoreAllMocks());
const request = () =>
  new Request("https://chess.test/api/matches/abc", { method: "POST" });

it("failures return the public message and log one line with the request id", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await withGuest(request(), async () => {
    throw new Error("secret detail");
  });
  const id = response.headers.get("x-request-id")!;
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: "Unable to process this match.",
  });
  expect(log).toHaveBeenCalledTimes(1);
  const entry = JSON.parse(log.mock.calls[0][0] as string);
  expect(entry).toMatchObject({
    level: "error",
    requestId: id,
    method: "POST",
    path: "/api/matches/abc",
    status: 500,
    message: "secret detail",
  });
});

it("incompatible saves warn with 409; successes carry an id and no log", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const conflict = await withGuest(request(), async () => {
    throw new IncompatibleStateError();
  });
  expect(conflict.status).toBe(409);
  expect(warn).toHaveBeenCalledTimes(1);
  const ok = await withGuest(request(), async () => NextResponse.json({}));
  expect(ok.status).toBe(200);
  expect(ok.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  expect(error).not.toHaveBeenCalled();
});
