"use client";

import { useState } from "react";

/**
 * THE DOCUMENT'S ASSETS — full width of the page, never a thumbnail strip.
 * Shared by Il Cancello and Le Questioni: wherever a row carries a still or
 * a clip, it is read here, at the size a decision needs.
 */

export interface VideoRef { url: string; name?: string; path?: string; ageDays?: number }
export interface MediaRef { kind: "image" | "video"; url: string }

/** The assets are served through the gate's own proxy, never from disk paths. */
export const proxyUrl = (url: string) => url.replace(/^\/(video|media)\?/, "/api/review-dashboard/$1?");

export default function AssetSheet({ media, videos }: { media?: MediaRef[]; videos?: VideoRef[] }) {
    const [zoomed, setZoomed] = useState<string | null>(null);
    const images = media ?? [];
    const reels = [...(videos ?? []), ...images.filter((m) => m.kind === "video").map((m) => ({ url: m.url }))];
    const stills = images.filter((m) => m.kind === "image");
    if (reels.length === 0 && stills.length === 0) {
        return (
            <p className="mt-4 border border-dashed border-paper-edge px-4 py-6 text-center font-condensed text-[11px] uppercase tracking-[0.14em] text-paper-foreground-soft">
                Nessun asset allegato a questo atto
            </p>
        );
    }

    return (
        <div className="mt-4 flex flex-col gap-4">
            {stills.map((m, index) => (
                <figure key={`${m.url}-${index}`} className="border border-paper-edge bg-paper-shade p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={proxyUrl(m.url)}
                        alt={`Asset ${index + 1}`}
                        loading="lazy"
                        onClick={() => setZoomed(proxyUrl(m.url))}
                        className="w-full cursor-zoom-in object-contain"
                        style={{ maxHeight: "70vh" }}
                    />
                    <figcaption className="mt-1.5 flex items-center justify-between px-1">
                        <span className="column-label column-label-paper">Allegato {index + 1}</span>
                        <span className="font-condensed text-[10px] uppercase tracking-[0.12em] text-paper-foreground-soft">
                            tocca per ingrandire
                        </span>
                    </figcaption>
                </figure>
            ))}
            {reels.map((v, index) => (
                <figure key={`${v.url}-${index}`} className="border border-paper-edge bg-plate p-2">
                    <video
                        controls
                        preload="metadata"
                        playsInline
                        src={proxyUrl(v.url)}
                        className="mx-auto w-full"
                        style={{ maxHeight: "70vh" }}
                    />
                    <figcaption className="mt-1.5 px-1">
                        <span className="column-label">Video {index + 1}</span>
                    </figcaption>
                </figure>
            ))}

            {/* The loupe: the asset alone, full screen, one tap to close. */}
            {zoomed && (
                <button
                    type="button"
                    aria-label="Chiudi ingrandimento"
                    className="fixed inset-0 z-[70] flex cursor-zoom-out items-center justify-center bg-plate-deep/95 p-4"
                    onClick={() => setZoomed(null)}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={zoomed} alt="" className="max-h-full max-w-full object-contain" />
                </button>
            )}
        </div>
    );
}
