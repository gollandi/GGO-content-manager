"use client";
import { useCallback, useEffect, useRef, useState } from "react";

function pause(signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        signal.throwIfAborted();
        const abort = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 5000);
        signal.addEventListener("abort", abort, { once: true });
    });
}
/** Show the factual account immediately; replace it when prepared prose is ready.
 * A reread/unmount cancels both polling and stale responses. */
export function usePreparedBrief<T>(url: string, pending: (data: T) => boolean) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const active = useRef<AbortController | null>(null);
    const reload = useCallback(async () => {
        active.current?.abort();
        const controller = new AbortController(); active.current = controller;
        setLoading(true); setError(null);
        try {
            for (let attempt = 0; attempt < 24; attempt += 1) {
                const response = await fetch(url, { cache: "no-store", signal: controller.signal });
                if (!response.ok) throw new Error("La fonte non risponde. L'eventuale resoconto già visibile non è stato aggiornato.");
                const body = await response.json() as T;
                if (controller.signal.aborted) return;
                setData(body); setLoading(false);
                if (!pending(body)) break;
                await pause(controller.signal);
            }
        } catch (cause) {
            if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Il resoconto non è disponibile.");
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }, [url, pending]);
    useEffect(() => { void reload(); return () => active.current?.abort(); }, [reload]);
    return { data, loading, error, reload };
}
