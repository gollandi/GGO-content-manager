"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StatusBadge from "./StatusBadge";


interface ActivityRow {
  id: string;
  run: string;
  job: string | null;
  status: string | null;
  startedAt: string | null;
  durationMs: number | null;
  rowsWritten: number | null;
  errors: number | null;
  summary: string;
  errorMessage: string;
  triggeredBy: string | null;
}

interface MediaAsset {
  id: string;
  title: string;
  status: string | null;
  assetType: string | null;
  format: string | null;
  roll: string | null;
  sourceSkill: string | null;
  shootingDate: string | null;
  fileLocation: string | null;
  calendarIds: string[];
}

interface DeskItem {
  id: string;
  item: string;
  type: string | null;
  status: string | null;
  priority: string | null;
  due: string | null;
  createdAt?: string;
  url?: string;
}






const DESK_TYPE_LABEL: Record<string, string> = {
  question: "Domanda",
  "budget-request": "Richiesta budget",
  recommendation: "Proposta",
  "plan-proposal": "Piano",
  "clip-script": "Script clip",
  "long-video-proposal": "Long video",
  "publish-approval": "Da pubblicare",
};

interface OperationsData {
  activity: ActivityRow[];
  media: MediaAsset[];
  desk: DeskItem[];
  errors: string[];
  generatedAt: string;
}

const AGENTS = [
  "Ernesto - orchestration",
  "Samantha - social",
  "Edmondo - website",
  "Greta - video",
  "Natascia - analytics",
  "Berenice - research",
  "Emily - newsletter",
  "Ettore - maintenance",
];

const DIRECTIVE_TYPES = [
  ["recommendation", "Recommendation"],
  ["question", "Question"],
  ["clip-script", "Clip script"],
  ["long-video-proposal", "Long video"],
  ["publish-approval", "Publish approval"],
  ["budget-request", "Budget request"],
  ["plan-proposal", "Plan proposal"],
] as const;




function previewKind(asset: MediaAsset): "image" | "video" | null {
  const value =
    `${asset.assetType ?? ""} ${asset.format ?? ""} ${asset.fileLocation ?? ""}`.toLowerCase();
  if (/video|reel|mov|mp4|webm|m4v/.test(value)) return "video";
  if (/image|photo|png|jpe?g|webp|gif|avif/.test(value)) return "image";
  return null;
}

export default function ErnestoOperationsBoard() {
  const [data, setData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [assetFilter, setAssetFilter] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [agent, setAgent] = useState(AGENTS[0]);
  const [type, setType] = useState<(typeof DIRECTIVE_TYPES)[number][0]>("recommendation");
  const [priority, setPriority] = useState<"Urgent" | "Normal" | "Low">("Normal");
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** Quick directive anchored to one asset — opened from the card itself. */
  const [quickAsset, setQuickAsset] = useState<MediaAsset | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickText, setQuickText] = useState("");
  const [quickAgent, setQuickAgent] = useState(AGENTS[0]);
  const [quickSending, setQuickSending] = useState(false);
  const [quickNotice, setQuickNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ernesto/operations", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to read operational state");
      setData((await response.json()) as OperationsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to read operational state");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleAssets = useMemo(() => {
    const query = assetFilter.trim().toLowerCase();
    if (!query) return data?.media ?? [];
    return (data?.media ?? []).filter((asset) =>
      `${asset.title} ${asset.assetType ?? ""} ${asset.roll ?? ""} ${asset.sourceSkill ?? ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [assetFilter, data]);

  function toggleAsset(assetId: string) {
    setSelectedAssetIds((ids) =>
      ids.includes(assetId) ? ids.filter((id) => id !== assetId) : [...ids, assetId]
    );
  }

  async function sendQuickDirective(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quickAsset) return;
    setQuickSending(true);
    setQuickNotice(null);
    try {
      const response = await fetch("/api/ernesto/directives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quickTitle,
          instruction: quickText,
          agent: quickAgent,
          type: "recommendation",
          priority: "Normal",
          mediaAssetIds: [quickAsset.id],
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to file directive");
      setQuickNotice("Registrata sul Desk come Pending — la sigilli nel Cancello.");
      setQuickTitle("");
      setQuickText("");
      await load();
    } catch (err) {
      setQuickNotice(err instanceof Error ? err.message : "Unable to file directive");
    } finally {
      setQuickSending(false);
    }
  }

  async function sendDirective(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/ernesto/directives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          instruction,
          agent,
          type,
          priority,
          mediaAssetIds: selectedAssetIds,
        }),
      });
      const result = (await response.json()) as { error?: string; rowId?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to file directive");
      setNotice(
        "Direttiva registrata sul Desk come Pending. Ora aspetta il tuo sigillo nel Cancello."
      );
      setTitle("");
      setInstruction("");
      setSelectedAssetIds([]);
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to file directive");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mb-6 border-t border-plate-rule pt-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="column-label">Operations wall</div>
          <h2 className="mt-1 font-serif text-[24px] font-bold text-plate-foreground-strong">
            Quello che la casa ha prodotto, quello che le chiedi ora.
          </h2>
        </div>
        <button type="button" onClick={() => void load()} className="act-quiet" disabled={loading}>
          Rileggi
        </button>
      </div>

      {error && (
        <div className="mb-4 border border-seal px-4 py-3 text-sm text-seal-bright">{error}</div>
      )}
      {data?.errors.length ? (
        <div className="mb-4 border border-sepia px-4 py-3 text-sm text-sepia">
          Una fonte non risponde: {data.errors.join(" | ")}
        </div>
      ) : null}

      <div>
        <form
          onSubmit={sendDirective}
          className="paper border border-paper-edge p-5 text-paper-foreground"
        >
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <div className="column-label column-label-paper">Bidirectional control</div>
              <h3 className="mt-1 text-base font-bold">Nuova direttiva</h3>
            </div>
            <StatusBadge tone="warning" label="Pending until sealed" />
          </div>
          <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
            <label className="text-xs font-semibold">
              Agente
              <select
                value={agent}
                onChange={(event) => setAgent(event.target.value)}
                className="mt-1 w-full border border-paper-edge bg-paper px-2.5 py-2 text-sm font-normal"
              >
                {AGENTS.map((entry) => (
                  <option key={entry}>{entry}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold">
              Tipo
              <select
                value={type}
                onChange={(event) => setType(event.target.value as typeof type)}
                className="mt-1 w-full border border-paper-edge bg-paper px-2.5 py-2 text-sm font-normal"
              >
                {DIRECTIVE_TYPES.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold">
              Priorita
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as typeof priority)}
                className="mt-1 w-full border border-paper-edge bg-paper px-2.5 py-2 text-sm font-normal"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent</option>
              </select>
            </label>
          </div>
          <label className="mt-3 block text-xs font-semibold">
            Titolo operativo
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={190}
              placeholder="Es. Ricontrolla il cut di vasectomy reversal"
              className="mt-1 w-full border border-paper-edge bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-engraving"
            />
          </label>
          <label className="mt-3 block text-xs font-semibold">
            Direttiva precisa
            <textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              required
              rows={5}
              placeholder="Obiettivo, vincoli, esito che vuoi vedere e cosa non deve fare."
              className="mt-1 w-full resize-y border border-paper-edge bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-engraving"
            />
          </label>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-paper-foreground-soft">
              {selectedAssetIds.length
                ? `${selectedAssetIds.length} asset collegati`
                : "Collega asset dalla parete a destra"}
            </span>
            <button
              type="submit"
              disabled={sending || !title.trim() || !instruction.trim()}
              className="act-seal"
            >
              {sending ? "Registro..." : "Invia al Desk"}
            </button>
          </div>
          {notice && (
            <p className="mt-3 border-t border-paper-edge pt-3 text-xs text-paper-foreground-soft">
              {notice}
            </p>
          )}
        </form>

      </div>

      <section className="mt-4 paper border border-paper-edge p-5 text-paper-foreground">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="column-label column-label-paper">Media assets</div>
            <h3 className="mt-1 text-base font-bold">Asset wall</h3>
            <p className="mt-1 text-xs text-paper-foreground-soft">
              Apri, guarda e collega gli asset direttamente alla direttiva.
            </p>
          </div>
          <input
            value={assetFilter}
            onChange={(event) => setAssetFilter(event.target.value)}
            placeholder="Filtra asset"
            className="border border-paper-edge bg-paper px-3 py-2 text-sm outline-none focus:border-engraving"
          />
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          {visibleAssets.map((asset) => {
            const kind = previewKind(asset);
            const selected = selectedAsset?.id === asset.id;
            const linked = selectedAssetIds.includes(asset.id);
            return (
              <article
                key={asset.id}
                className={`min-w-0 border ${selected ? "border-engraving" : "border-paper-edge"} bg-paper-shade`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedAsset(asset)}
                  className="block w-full text-left"
                >
                  <div className="aspect-[4/3] overflow-hidden border-b border-paper-edge bg-plate-raised">
                    {asset.fileLocation && kind === "image" && (
                      <img
                        src={asset.fileLocation}
                        alt={asset.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                    {asset.fileLocation && kind === "video" && (
                      <video
                        src={asset.fileLocation}
                        muted
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    )}
                    {(!asset.fileLocation || !kind) && (
                      <div className="flex h-full items-center justify-center px-3 text-center text-xs text-plate-foreground-soft">
                        Preview non disponibile
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="line-clamp-2 text-xs font-semibold">
                      {asset.title || "Untitled asset"}
                    </div>
                    <div className="mt-1 text-[10px] text-paper-foreground-soft">
                      {[asset.assetType, asset.format, asset.status].filter(Boolean).join(" | ") ||
                        "Media asset"}
                    </div>
                  </div>
                </button>
                {/* The card's own menu — every act happens here, at this level. */}
                <div className="flex items-center gap-2 border-t border-paper-edge px-2.5 py-2 text-[11px]">
                  <label className="flex cursor-pointer items-center gap-1.5 text-paper-foreground-soft">
                    <input type="checkbox" checked={linked} onChange={() => toggleAsset(asset.id)} /> Collega
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAsset(asset);
                      setQuickNotice(null);
                    }}
                    className="ml-auto font-semibold text-engraving-ink hover:underline"
                  >
                    Direttiva
                  </button>
                </div>
              </article>
            );
          })}
          {!loading && visibleAssets.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-paper-foreground-soft">
              Nessun asset corrisponde al filtro.
            </p>
          )}
        </div>
      </section>

      {/* The directives already in the house are decided at Il Cancello and
          counted once, in the house state — this room does not re-render the
          queue. */}
      <p className="mt-4 border-t border-plate-rule pt-3 text-[12px] text-plate-foreground-soft">
        Le direttive già depositate si decidono e si seguono a{" "}
        <Link href="/review" className="font-semibold text-engraving-ink hover:underline">
          Il Cancello
        </Link>
        ; quel che è successo stanotte si legge nell’Atrio.
      </p>

      {/* Quick directive: opened from an asset card, filed without leaving it. */}
      {quickAsset && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-plate/90 p-4"
          onClick={() => setQuickAsset(null)}
        >
          <form
            onSubmit={sendQuickDirective}
            className="w-full max-w-lg border border-paper-edge bg-paper p-5 text-paper-foreground"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="column-label column-label-paper">Direttiva su questo asset</div>
                <h3 className="mt-1 text-base font-bold line-clamp-1">{quickAsset.title || "Asset"}</h3>
              </div>
              <button type="button" className="act-quiet" onClick={() => setQuickAsset(null)}>
                Chiudi
              </button>
            </div>
            <label className="block text-xs font-semibold">
              Agente
              <select
                value={quickAgent}
                onChange={(event) => setQuickAgent(event.target.value)}
                className="mt-1 w-full border border-paper-edge bg-paper px-2.5 py-2 text-sm font-normal"
              >
                {AGENTS.map((entry) => (
                  <option key={entry}>{entry}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-semibold">
              Titolo
              <input
                value={quickTitle}
                onChange={(event) => setQuickTitle(event.target.value)}
                required
                maxLength={190}
                className="mt-1 w-full border border-paper-edge bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-engraving"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold">
              Cosa va fatto
              <textarea
                value={quickText}
                onChange={(event) => setQuickText(event.target.value)}
                required
                rows={4}
                className="mt-1 w-full resize-y border border-paper-edge bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-engraving"
              />
            </label>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-paper-foreground-soft">Asset collegato automaticamente</span>
              <button
                type="submit"
                disabled={quickSending || !quickTitle.trim() || !quickText.trim()}
                className="act-seal"
              >
                {quickSending ? "Registro…" : "Invia al Desk"}
              </button>
            </div>
            {quickNotice && (
              <p className="mt-3 border-t border-paper-edge pt-3 text-xs text-paper-foreground-soft">{quickNotice}</p>
            )}
          </form>
        </div>
      )}

      {selectedAsset && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-plate/90 p-4"
          onClick={() => setSelectedAsset(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto border border-paper-edge bg-paper p-4 text-paper-foreground"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold">{selectedAsset.title}</h3>
                <p className="mt-1 text-xs text-paper-foreground-soft">
                  {[
                    selectedAsset.assetType,
                    selectedAsset.format,
                    selectedAsset.roll,
                    selectedAsset.sourceSkill,
                  ]
                    .filter(Boolean)
                    .join(" | ")}
                </p>
              </div>
              <button type="button" className="act-quiet" onClick={() => setSelectedAsset(null)}>
                Chiudi
              </button>
            </div>
            {selectedAsset.fileLocation && previewKind(selectedAsset) === "image" && (
              <img
                src={selectedAsset.fileLocation}
                alt={selectedAsset.title}
                className="mx-auto max-h-[68vh] w-auto max-w-full object-contain"
              />
            )}
            {selectedAsset.fileLocation && previewKind(selectedAsset) === "video" && (
              <video
                src={selectedAsset.fileLocation}
                controls
                autoPlay
                className="mx-auto max-h-[68vh] max-w-full"
              />
            )}
            {selectedAsset.fileLocation ? (
              <a
                href={selectedAsset.fileLocation}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs font-semibold text-engraving-ink hover:underline"
              >
                Apri asset originale
              </a>
            ) : (
              <p className="text-sm text-paper-foreground-soft">
                Questo asset non ha una posizione file visualizzabile.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
