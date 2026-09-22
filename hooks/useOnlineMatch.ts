"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Intention } from "@/lib/game/types";
import type { PublicMatch } from "@/lib/game/publicState";
type RequestBody = (
  | {
      from: Intention["from"];
      to: Intention["to"];
      promotion?: Intention["promotion"];
    }
  | { type: "claim-draw" }
) & { actionId: string; expectedVersion: number };
export const newerMatch = (
  current: PublicMatch | null,
  incoming: PublicMatch,
  id: string | null,
) =>
  incoming.id === id &&
  (!current || current.id !== id || incoming.version > current.version);
export function useOnlineMatch() {
  const [remote, setRemote] = useState<PublicMatch | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [retryable, setRetryable] = useState(false);
  const active = useRef<string | null>(null),
    generation = useRef(0),
    latest = useRef<PublicMatch | null>(null),
    controllers = useRef(new Set<AbortController>()),
    pending = useRef<RequestBody | null>(null),
    inFlight = useRef(false);
  const receive = useCallback((m: PublicMatch) => {
    if (newerMatch(latest.current, m, active.current)) {
      latest.current = m;
      setRemote(m);
    }
  }, []);
  const leave = useCallback(() => {
    generation.current++;
    active.current = null;
    latest.current = null;
    pending.current = null;
    inFlight.current = false;
    for (const c of controllers.current) c.abort();
    controllers.current.clear();
    setRemote(null);
    setBusy(false);
    setError("");
    setRetryable(false);
  }, []);
  const request = useCallback(
    async (
      path: string,
      method = "GET",
      body?: unknown,
      knownVersion?: number,
    ) => {
      const controller = new AbortController();
      controllers.current.add(controller);
      try {
        const response = await fetch(path, {
          method,
          signal: controller.signal,
          cache: "no-store",
          headers:
            method === "POST"
              ? { "content-type": "application/json" }
              : knownVersion !== undefined
                ? { "if-none-match": `"${knownVersion}"` }
                : undefined,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const payload = response.status === 304 ? null : await response.json();
        return { response, payload };
      } finally {
        controllers.current.delete(controller);
      }
    },
    [],
  );
  const open = useCallback(
    async (id?: string) => {
      leave();
      const epoch = generation.current;
      setBusy(true);
      try {
        const { response, payload } = await request(
          id ? `/api/matches/${id}` : "/api/matches",
          id ? "GET" : "POST",
          id ? undefined : {},
        );
        if (epoch !== generation.current) return;
        if (!response.ok)
          throw Error(payload.error ?? "Unable to open the match.");
        active.current = payload.id;
        receive(payload);
        const url = new URL(location.href);
        url.searchParams.set("match", payload.id);
        history.replaceState({}, "", url);
      } catch (e) {
        if (epoch === generation.current)
          setError(
            e instanceof Error ? e.message : "Unable to open the match.",
          );
      } finally {
        if (epoch === generation.current) setBusy(false);
      }
    },
    [leave, receive, request],
  );
  useEffect(() => {
    if (!remote?.id) return;
    const id = remote.id,
      epoch = generation.current;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const poll = async () => {
      try {
        // Unchanged matches answer 304 with no body.
        const { response, payload } = await request(
          `/api/matches/${id}`,
          "GET",
          undefined,
          latest.current?.id === id ? latest.current.version : undefined,
        );
        if (response.ok && !cancelled && epoch === generation.current)
          receive(payload);
      } catch {
        /* Next serialized poll recovers. */
      } finally {
        if (!cancelled) timer = setTimeout(poll, 1500);
      }
    };
    timer = setTimeout(poll, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [remote?.id, receive, request]);
  useEffect(
    () => () => {
      generation.current++;
      for (const c of controllers.current) c.abort();
    },
    [],
  );
  const send = useCallback(
    async (intent?: Intention | { type: "claim-draw" }) => {
      const id = active.current,
        m = latest.current;
      if (!id || !m || inFlight.current) return;
      if (intent && pending.current) return;
      const body =
        pending.current ??
        (intent
          ? {
              ...intent,
              actionId: crypto.randomUUID(),
              expectedVersion: m.version,
            }
          : null);
      if (!body) return;
      pending.current = body;
      inFlight.current = true;
      setBusy(true);
      setError("");
      const epoch = generation.current;
      try {
        const { response, payload } = await request(
          `/api/matches/${id}`,
          "POST",
          body,
        );
        if (epoch !== generation.current) return;
        if (payload.id) receive(payload);
        // A received response settles this transport intent, including conflicts.
        if (response.status >= 500)
          throw Error(
            payload.error ?? "Connection interrupted. Retry the same move.",
          );
        pending.current = null;
        setRetryable(false);
        if (!response.ok)
          setError(payload.error ?? "Move could not be submitted.");
      } catch (e) {
        if (epoch === generation.current) {
          setRetryable(true);
          setError(
            e instanceof Error
              ? e.message
              : "Connection interrupted. Retry the same move.",
          );
        }
      } finally {
        if (epoch === generation.current) {
          inFlight.current = false;
          setBusy(false);
        }
      }
    },
    [receive, request],
  );
  const join = useCallback(async () => {
    if (!active.current || inFlight.current) return;
    const epoch = generation.current;
    inFlight.current = true;
    setBusy(true);
    try {
      const { response, payload } = await request(
        `/api/matches/${active.current}/join`,
        "POST",
        {},
      );
      if (epoch !== generation.current) return;
      if (!response.ok) throw Error(payload.error ?? "Unable to join.");
      receive(payload);
      setError("");
    } catch (e) {
      if (epoch === generation.current)
        setError(e instanceof Error ? e.message : "Unable to join.");
    } finally {
      if (epoch === generation.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }, [receive, request]);
  return { remote, busy, error, retryable, open, leave, send, join };
}
