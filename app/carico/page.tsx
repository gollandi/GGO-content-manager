"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "../../components/AppShell";
import { Document, RegisterHeading, RoomCrest } from "../../components/Registro";

/**
 * Il Carico — depositare materiale dal telefono, direttamente sul server.
 *
 * JJ gira una clip in clinica e la carica da qui: il file va sul VPS senza
 * passare dal Mac (è la connessione del Mac a far cadere i run notturni).
 * L'upload è a pezzi e riprendibile, perché su 4G un file da mezzo giga in
 * una sola richiesta non è un progetto, è una speranza.
 *
 * Qui si deposita soltanto. Nessuna pubblicazione: il materiale entra in
 * inbox, il worker lo lavora, e i cancelli restano dove sono — con te.
 */

const CHUNK_BYTES = 5 * 1024 * 1024;
const CHUNK_RETRIES = 4;

const KINDS = [
    { id: "dual-roll", label: "Dual roll (Titti)" },
    { id: "talking-head", label: "Talking head (Greta)" },
    { id: "b-roll", label: "B-roll" },
    { id: "voce", label: "Voce / audio" },
    { id: "altro", label: "Altro" },
] as const;

interface Manifest {
    id: string;
    filename: string;
    storedAs: string;
    kind: string;
    note: string;
    operator: string;
    declaredBytes: number;
    receivedBytes: number;
    status: string;
    createdAt: string;
    completedAt: string | null;
}

/** What the worker made of a deposit — read-only, it runs on the server. */
interface Job {
    id: string;
    status: "running" | "ready" | "failed";
    error?: string;
    outputs: { role: string; bytes: number }[];
    notes?: string[];
    probe?: { durationSeconds: number };
}

/** Output roles in the operator's language, not the worker's. */
const OUTPUT_LABELS: Record<string, string> = {
    "roll-a": "roll A",
    "roll-b": "roll B",
    poster: "fermo immagine",
    audio: "audio",
    "transcript-srt": "sottotitoli",
    "transcript-txt": "trascrizione",
};

type Phase = "idle" | "uploading" | "assembling" | "done" | "error" | "paused";

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatWhen(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * What the worker did with a deposit. Absent while the timer has not yet
 * come round to it — silence here means "not yet", never "lost".
 */
function WorkerLine({ job }: { job: Job | undefined }) {
    if (!job) {
        return (
            <div className="column-label mt-1 text-plate-foreground-soft">
                in attesa del worker
            </div>
        );
    }
    if (job.status === "running") {
        return <div className="column-label mt-1 text-plate-foreground-soft">in lavorazione</div>;
    }
    if (job.status === "failed") {
        return (
            <div className="column-label mt-1 text-seal-deep" title={job.error}>
                lavorazione fallita
            </div>
        );
    }

    const made = job.outputs.map((o) => OUTPUT_LABELS[o.role] ?? o.role).join(", ");
    return (
        <div className="column-label mt-1 text-plate-foreground-soft">
            lavorato{made ? ` · ${made}` : ""}
            {job.notes?.length ? ` · ${job.notes.join(" · ")}` : ""}
        </div>
    );
}

export default function CaricoPage() {
    const [file, setFile] = useState<File | null>(null);
    const [kind, setKind] = useState<string>("talking-head");
    const [note, setNote] = useState("");
    const [phase, setPhase] = useState<Phase>("idle");
    const [sent, setSent] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [inbox, setInbox] = useState<Manifest[]>([]);
    const [jobs, setJobs] = useState<Record<string, Job>>({});

    /** Kept across a pause so "Riprendi" resumes instead of restarting. */
    const uploadId = useRef<string | null>(null);
    const cancelled = useRef(false);
    const fileInput = useRef<HTMLInputElement>(null);

    const loadInbox = useCallback(async () => {
        try {
            const res = await fetch("/api/media/uploads");
            if (res.ok) setInbox((await res.json()).uploads ?? []);
        } catch {
            /* the inbox listing is informational — never block the upload */
        }
        try {
            const res = await fetch("/api/media/jobs");
            if (res.ok) {
                const list: Job[] = (await res.json()).jobs ?? [];
                setJobs(Object.fromEntries(list.map((job) => [job.id, job])));
            }
        } catch {
            /* same: what the worker made of it is never load-bearing here */
        }
    }, []);

    useEffect(() => {
        void loadInbox();
        // The worker runs on its own timer; poll so a deposit stops reading
        // "in lavorazione" without JJ having to reload the room. A hidden tab
        // skips the tick and catches up the moment it comes back.
        const tick = setInterval(() => {
            if (!document.hidden) void loadInbox();
        }, 60_000);
        const onVisible = () => {
            if (!document.hidden) void loadInbox();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            clearInterval(tick);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [loadInbox]);

    function reset() {
        uploadId.current = null;
        cancelled.current = false;
        setFile(null);
        setNote("");
        setSent(0);
        setPhase("idle");
        setError(null);
        if (fileInput.current) fileInput.current.value = "";
    }

    /** One chunk, with backoff — a lift dropping to 3G is not a failure. */
    async function putChunk(id: string, index: number, blob: Blob): Promise<void> {
        let wait = 1000;
        for (let attempt = 0; attempt <= CHUNK_RETRIES; attempt += 1) {
            if (cancelled.current) throw new Error("interrotto");
            try {
                const res = await fetch(`/api/media/uploads/${id}?index=${index}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/octet-stream" },
                    body: blob,
                });
                if (res.ok) return;
                // A rejection on our terms (too large, wrong state) will not
                // heal by retrying; only transport trouble will.
                if (res.status < 500) throw new Error((await res.json()).error ?? "Chunk rifiutato");
            } catch (err) {
                if (attempt === CHUNK_RETRIES || cancelled.current) throw err;
            }
            await sleep(wait);
            wait *= 2;
        }
    }

    async function start(resuming = false) {
        if (!file) return;
        cancelled.current = false;
        setError(null);
        setPhase("uploading");

        try {
            // Open the upload, or pick up the one we already opened.
            let id = uploadId.current;
            let firstChunk = 0;

            if (!id) {
                const res = await fetch("/api/media/uploads", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        filename: file.name,
                        kind,
                        note,
                        size: file.size,
                    }),
                });
                if (!res.ok) throw new Error((await res.json()).error ?? "Apertura rifiutata");
                id = (await res.json()).upload.id as string;
                uploadId.current = id;
            } else if (resuming) {
                // Ask the server where it actually stopped — chunks are
                // uniform and sequential, so bytes divide cleanly into an index.
                const res = await fetch(`/api/media/uploads/${id}`);
                if (res.ok) {
                    const received = (await res.json()).upload.receivedBytes as number;
                    firstChunk = Math.floor(received / CHUNK_BYTES);
                    setSent(firstChunk * CHUNK_BYTES);
                }
            }

            const total = Math.ceil(file.size / CHUNK_BYTES);
            for (let index = firstChunk; index < total; index += 1) {
                if (cancelled.current) {
                    setPhase("paused");
                    return;
                }
                const from = index * CHUNK_BYTES;
                const to = Math.min(from + CHUNK_BYTES, file.size);
                await putChunk(id, index, file.slice(from, to));
                setSent(to);
            }

            setPhase("assembling");
            const done = await fetch(`/api/media/uploads/${id}`, { method: "POST" });
            if (!done.ok) throw new Error((await done.json()).error ?? "Assemblaggio fallito");

            setPhase("done");
            uploadId.current = null;
            await loadInbox();
        } catch (err) {
            if (cancelled.current) {
                setPhase("paused");
                return;
            }
            setError(err instanceof Error ? err.message : String(err));
            setPhase("error");
        }
    }

    async function abandon() {
        cancelled.current = true;
        const id = uploadId.current;
        if (id) await fetch(`/api/media/uploads/${id}`, { method: "DELETE" }).catch(() => {});
        reset();
    }

    const pct = file && file.size > 0 ? Math.min(100, Math.round((sent / file.size) * 100)) : 0;
    const busy = phase === "uploading" || phase === "assembling";

    return (
        <AppShell>
            <div className="mx-auto w-full max-w-3xl px-6 py-8 max-sm:px-4 max-sm:py-6">
                <header className="mb-7 border-b border-plate-rule pb-4">
                    <p className="column-label flex items-center gap-2">
                        <RoomCrest room="ernesto" size={16} inked />
                        Il Carico
                    </p>
                    <h1 className="document-title mt-1.5 text-[30px] text-plate-foreground-strong max-sm:text-[24px]">
                        Il Carico
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-plate-foreground-soft">
                        Deposita il girato dal telefono direttamente sul server. Il file arriva a
                        pezzi — se la linea cade riprende da dove si era fermata — e resta in inbox
                        finché Ernesto e le ragazze lo lavorano. Qui non si pubblica nulla.
                    </p>
                </header>

                <section className="mb-9">
                    <RegisterHeading label="Nuovo deposito" />

                    <Document className="p-5 max-sm:p-4">
                        <label className="column-label mb-2 block text-paper-foreground-soft">
                            Il file
                        </label>
                        <input
                            ref={fileInput}
                            type="file"
                            accept="video/*,audio/*"
                            disabled={busy}
                            onChange={(e) => {
                                setFile(e.target.files?.[0] ?? null);
                                uploadId.current = null;
                                setSent(0);
                                setPhase("idle");
                                setError(null);
                            }}
                            className="w-full border border-paper-edge bg-paper-shade px-3 py-3 text-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm file:text-plate-foreground disabled:opacity-50"
                        />
                        {file && (
                            <p className="mt-1.5 text-xs text-paper-foreground-soft">
                                {file.name} · {formatBytes(file.size)}
                            </p>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                            <div>
                                <label className="column-label mb-2 block text-paper-foreground-soft">
                                    Che materiale è
                                </label>
                                <select
                                    value={kind}
                                    onChange={(e) => setKind(e.target.value)}
                                    disabled={busy}
                                    className="w-full border border-paper-edge bg-paper-shade px-3 py-2.5 text-sm disabled:opacity-50"
                                >
                                    {KINDS.map((k) => (
                                        <option key={k.id} value={k.id}>
                                            {k.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="column-label mb-2 block text-paper-foreground-soft">
                                    Nota per chi lo lavora
                                </label>
                                <input
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    disabled={busy}
                                    placeholder='Es. "seconda take, taglia i primi 4s"'
                                    className="w-full border border-paper-edge bg-paper-shade px-3 py-2.5 text-sm disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {(busy || phase === "paused") && (
                            <div className="mt-5">
                                <div className="mb-1.5 flex items-baseline justify-between">
                                    <span className="column-label text-paper-foreground-soft">
                                        {phase === "assembling"
                                            ? "Ricomposizione sul server"
                                            : phase === "paused"
                                              ? "In pausa"
                                              : "In salita"}
                                    </span>
                                    <span className="serial text-xs">
                                        {formatBytes(sent)} / {file ? formatBytes(file.size) : "—"} ·{" "}
                                        {pct}%
                                    </span>
                                </div>
                                <div
                                    className="h-1.5 w-full border border-paper-edge bg-paper-shade"
                                    role="progressbar"
                                    aria-valuenow={pct}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                >
                                    <div
                                        className="h-full bg-plate-foreground transition-[width] duration-200"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {phase === "done" && (
                            <p className="mt-4 border-l-2 border-engraving-bright pl-3 text-sm text-paper-foreground">
                                Depositato. È in inbox sul server — il worker lo prende da lì.
                            </p>
                        )}
                        {error && (
                            <p className="mt-4 border-l-2 border-seal pl-3 text-sm text-paper-foreground">
                                {error}
                                {uploadId.current && " — i pezzi già saliti restano, puoi riprendere."}
                            </p>
                        )}

                        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-paper-edge pt-4">
                            {phase === "done" ? (
                                <button onClick={reset} className="act-seal" type="button">
                                    Deposita un altro
                                </button>
                            ) : (
                                <button
                                    onClick={() => void start(phase === "paused" || phase === "error")}
                                    disabled={!file || busy}
                                    className="act-seal"
                                    type="button"
                                >
                                    {phase === "uploading"
                                        ? "In salita…"
                                        : phase === "assembling"
                                          ? "Ricompone…"
                                          : phase === "paused" || phase === "error"
                                            ? "Riprendi"
                                            : "Deposita"}
                                </button>
                            )}
                            {busy && (
                                <button
                                    onClick={() => {
                                        cancelled.current = true;
                                    }}
                                    className="act-quiet"
                                    type="button"
                                >
                                    Pausa
                                </button>
                            )}
                            {(phase === "paused" || phase === "error") && (
                                <button onClick={() => void abandon()} className="act-quiet" type="button">
                                    Abbandona
                                </button>
                            )}
                        </div>
                    </Document>
                </section>

                <section>
                    <RegisterHeading label="In inbox sul server" count={inbox.length} />
                    {inbox.length === 0 ? (
                        <p className="py-6 text-sm text-plate-foreground-soft">
                            Niente depositato, per ora.
                        </p>
                    ) : (
                        <div className="flex flex-col">
                            {inbox.map((m) => (
                                <div
                                    key={m.id}
                                    className="flex items-baseline justify-between gap-4 border-b border-plate-rule py-3 max-sm:flex-col max-sm:gap-1"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate text-sm text-plate-foreground">
                                            {m.filename}
                                        </div>
                                        <div className="column-label mt-1 text-plate-foreground-soft">
                                            {m.kind} · {formatBytes(m.declaredBytes)} ·{" "}
                                            {formatWhen(m.completedAt)}
                                        </div>
                                        {m.note && (
                                            <div className="mt-1 text-xs italic text-plate-foreground-soft">
                                                {m.note}
                                            </div>
                                        )}
                                        <WorkerLine job={jobs[m.id]} />
                                    </div>
                                    <span className="serial whitespace-nowrap text-xs text-plate-foreground-soft">
                                        {m.status === "ready" ? "pronto" : m.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </AppShell>
    );
}
