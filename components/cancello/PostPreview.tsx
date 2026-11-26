"use client";

import { useEffect, useState } from "react";
import { proxyUrl } from "./AssetSheet";
import type { PostPreview as Preview, Problem } from "../../lib/cancello/post-preview";

/**
 * The post as it will go out: its images or video in their order, then its
 * text exactly as published — caption and hashtags together, line breaks
 * kept. No file names, no system names, no internal labels: what the
 * audience will see, and where and when.
 */

type Lang = "it" | "en";
const T = {
    goesTo: { it: "Esce su", en: "Goes to" },
    planned: { it: "Previsto per", en: "Planned for" },
    noDate: { it: "Data non ancora fissata", en: "No date set yet" },
    elsewhere: { it: "{x}: non si pubblica da qui", en: "{x}: not published from here" },
    slide: { it: "Immagine {n} di {t}", en: "Image {n} of {t}" },
    text: { it: "Il testo, esattamente come esce", en: "The text, exactly as it goes out" },
    noText: { it: "Il testo non c'è ancora.", en: "There is no text yet." },
    link: { it: "Link nella storia", en: "Link in the story" },
    noMedia: { it: "Nessuna immagine o video ancora.", en: "No image or video yet." },
    stops: { it: "Cosa la ferma così com'è", en: "What would stop it as it stands" },
    zoomClose: { it: "Chiudi", en: "Close" },
    kinds: {
        carousel: { it: "Carosello", en: "Carousel" },
        reel: { it: "Reel", en: "Reel" },
        post: { it: "Immagine", en: "Image post" },
        story: { it: "Storia", en: "Story" },
    },
} as const;

function problemText(p: Problem, lang: Lang): string {
    const en = lang === "en";
    switch (p.code) {
        case "no-text": return en ? "There is no text yet: the post cannot go out without it." : "Manca il testo: senza non può uscire.";
        case "no-kind": return en ? "The kind of post (carousel, reel, image, story) is not set." : "Non è indicato che tipo di post è (carosello, reel, immagine, storia).";
        case "no-channel": return en ? "No channel is set for this post." : "Non è indicato su quale canale esce.";
        case "kind-not-published": return en ? `A "${p.kind}" is not published from here.` : `Un "${p.kind}" non si pubblica da qui.`;
        case "channel-refuses": return en ? `${p.channel} does not take this kind of post.` : `${p.channel} non accetta questo tipo di post.`;
        case "reel-no-video": return en ? "The reel has no video yet." : "Il reel non ha ancora il video.";
        case "carousel-count": return en ? `A carousel needs 2 to 10 images; this one has ${p.count}.` : `Un carosello vuole da 2 a 10 immagini; questo ne ha ${p.count}.`;
        case "post-too-many": return en ? `An image post takes one image; this one has ${p.count}. Make it a carousel.` : `Un post immagine ne prende una; questo ne ha ${p.count}. Va fatto carosello.`;
        case "story-one-frame": return en ? `A story takes exactly one image; this one has ${p.count}.` : `Una storia prende una sola immagine; questa ne ha ${p.count}.`;
        case "video-unused": return en ? "A video is attached but this kind of post does not carry it: it will not go out." : "C'è un video allegato ma questo tipo di post non lo porta: non uscirà.";
        case "assets-unavailable": return en ? `${p.count} attached file(s) cannot be shown here yet, so what you see may be incomplete.` : `${p.count} file allegati non si vedono qui, quindi quello che vedi può essere incompleto.`;
        case "staged-unreadable": return en
            ? "The version prepared for publishing cannot be read right now: this is the calendar's version, which may differ. Check again before it goes out."
            : "La versione preparata per la pubblicazione ora non si legge: questa è quella del calendario, che può differire. Ricontrolla prima che esca.";
        case "assets-ignored": return en ? `${p.count} attached file(s) are not an image or video the post can carry: they will not go out.` : `${p.count} file allegati non sono immagini o video che il post può portare: non usciranno.`;
        case "story-no-card": return en ? "The story has no card yet." : "La storia non ha ancora la card.";
        case "story-no-link": return en ? "The story has no link to send people to." : "La storia non ha il link a cui portare le persone.";
    }
}

function fill(s: string, vars: Record<string, string | number>): string {
    return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

function longDate(iso: string | null, lang: Lang): string | null {
    if (!iso) return null;
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(lang === "en" ? "en-GB" : "it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function PostPreview({ post, date, lang }: { post: Preview; date: string | null; lang: Lang }) {
    const [zoomed, setZoomed] = useState<string | null>(null);
    useEffect(() => {
        if (!zoomed) return;
        const close = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomed(null); };
        window.addEventListener("keydown", close);
        return () => window.removeEventListener("keydown", close);
    }, [zoomed]);
    const when = longDate(date, lang);
    const kind = post.format ? T.kinds[post.format][lang] : null;
    const portrait = post.format === "story" || post.format === "reel";

    return (
        <section aria-label={T.text[lang]} className="flex flex-col gap-4">
            <p className="text-[13px] leading-relaxed text-paper-foreground">
                {post.channels.length > 0 && (
                    <>
                        {T.goesTo[lang]} <strong>{post.channels.join(" · ")}</strong>
                        {kind ? <> — {kind}</> : null}
                        {post.elsewhere.length > 0 && <> ({fill(T.elsewhere[lang], { x: post.elsewhere.join(", ") })})</>}
                        <br />
                    </>
                )}
                {when ? <>{T.planned[lang]} <strong>{when}</strong></> : T.noDate[lang]}
            </p>

            {post.video ? (
                <video
                    controls
                    preload="metadata"
                    playsInline
                    src={proxyUrl(post.video.url)}
                    className="mx-auto block max-h-[70vh] w-full max-w-[420px] bg-plate object-contain"
                />
            ) : post.images.length > 0 ? (
                <div
                    className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
                    role={post.images.length > 1 ? "region" : undefined}
                    aria-roledescription={post.images.length > 1 ? "carousel" : undefined}
                >
                    {post.images.map((m, i) => (
                        <figure key={`${m.url}-${i}`} className={`shrink-0 snap-center ${post.images.length > 1 ? "w-[85%]" : "w-full"}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={proxyUrl(m.url)}
                                alt={post.images.length > 1 ? fill(T.slide[lang], { n: i + 1, t: post.images.length }) : ""}
                                loading="lazy"
                                onClick={() => setZoomed(proxyUrl(m.url))}
                                className={`mx-auto block w-full cursor-zoom-in object-contain ${portrait ? "max-h-[70vh] max-w-[420px]" : "max-h-[60vh]"}`}
                            />
                            {post.images.length > 1 && (
                                <figcaption className="mt-1 text-center font-condensed text-[10px] uppercase tracking-[0.12em] text-paper-foreground-soft">
                                    {i + 1} / {post.images.length}
                                </figcaption>
                            )}
                        </figure>
                    ))}
                </div>
            ) : (
                <p className="border border-dashed border-paper-edge px-4 py-6 text-center text-[13px] text-paper-foreground-soft">
                    {T.noMedia[lang]}
                </p>
            )}

            <div>
                <p className="column-label column-label-paper mb-1.5">{T.text[lang]}</p>
                {post.text ? (
                    <div className="whitespace-pre-wrap break-words border border-paper-edge bg-paper-shade px-4 py-3 text-[14px] leading-relaxed text-paper-foreground">
                        {post.text}
                    </div>
                ) : (
                    <p className="text-[13px] text-paper-foreground-soft">{T.noText[lang]}</p>
                )}
            </div>

            {post.storyLink && (
                <p className="text-[13px] text-paper-foreground">
                    {T.link[lang]}: <a href={post.storyLink} target="_blank" rel="noreferrer" className="underline">{post.storyLink}</a>
                </p>
            )}

            {post.problems.length > 0 && (
                <div className="border border-seal px-3 py-2 text-[13px] text-seal" role="note">
                    <p className="column-label mb-1" style={{ color: "var(--seal)" }}>{T.stops[lang]}</p>
                    <ul className="list-disc pl-5">
                        {post.problems.map((p) => <li key={JSON.stringify(p)}>{problemText(p, lang)}</li>)}
                    </ul>
                </div>
            )}

            {zoomed && (
                <button
                    type="button"
                    aria-label={T.zoomClose[lang]}
                    className="fixed inset-0 z-[70] flex cursor-zoom-out items-center justify-center bg-plate-deep/95 p-4"
                    onClick={() => setZoomed(null)}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={zoomed} alt="" className="max-h-full max-w-full object-contain" />
                </button>
            )}
        </section>
    );
}
