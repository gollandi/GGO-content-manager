"use client";

import { useMemo, useState } from "react";
import * as Icons from "../../components/Icons";
import SearchBar from "../../components/SearchBar";
import FilterBar from "../../components/FilterBar";
import StatusBadge, { getStatusTone } from "../../components/StatusBadge";
import { useNotionData } from "../../lib/hooks/useNotionData";
import type { ContentItem } from "../../lib/notion/types";

function normaliseYoutubeId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) return url.pathname.replace("/", "");
    if (url.searchParams.has("v")) return url.searchParams.get("v") ?? "";
    const embedMatch = url.pathname.match(/\/embed\/([^/?#]+)/);
    if (embedMatch) return embedMatch[1];
  } catch {
    // Not a URL: treat the value as an already-normalised video ID.
  }

  return trimmed;
}

function isYoutubeAsset(item: ContentItem): boolean {
  return normaliseYoutubeId(item.youtubeId).length > 0 ||
    item.platform.some((platform) => platform.toLowerCase().includes("youtube"));
}

function getYoutubeUrl(item: ContentItem): string | null {
  const id = normaliseYoutubeId(item.youtubeId);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

function needsTranscript(item: ContentItem): boolean {
  const status = item.transcriptStatus?.toLowerCase() ?? "";
  return !status || status.includes("missing") || status.includes("needed") || status.includes("todo");
}

export default function YoutubePage() {
  const { data: contentItems, loading, error } = useNotionData<ContentItem>("/api/notion/content");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const youtubeItems = useMemo(
    () => contentItems.filter(isYoutubeAsset),
    [contentItems]
  );

  const connected = youtubeItems.filter((item) => getYoutubeUrl(item)).length;
  const missingVideoId = youtubeItems.length - connected;
  const transcriptNeeded = youtubeItems.filter(needsTranscript).length;

  const filteredItems = youtubeItems.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      item.title.toLowerCase().includes(q) ||
      item.pathway.join(" ").toLowerCase().includes(q) ||
      item.youtubeId.toLowerCase().includes(q);

    const matchesFilter =
      activeFilter === "All" ||
      (activeFilter === "Connected" && !!getYoutubeUrl(item)) ||
      (activeFilter === "Missing ID" && !getYoutubeUrl(item)) ||
      (activeFilter === "Needs Transcript" && needsTranscript(item));

    return matchesSearch && matchesFilter;
  });

  return (
    <>
      <div className="p-8 max-lg:p-4">
        <header className="page-header">
          <div>
            <h1 className="page-title">YouTube</h1>
            <p className="page-subtitle">
              Video assets connected through Notion Content Assets via Platform and YouTube Video ID.
            </p>
          </div>
          <a
            href="https://studio.youtube.com"
            target="_blank"
            rel="noopener"
            className="btn-pill"
          >
            <Icons.IconYoutube className="w-4 h-4" />
            YouTube Studio
          </a>
        </header>

        <section className="page-section">
          {error && (
            <div className="mb-6 p-4  border border-seal px-4 py-3 text-[13px] text-seal-bright">
              {error}
            </div>
          )}

          <div className="grid grid-cols-4 max-xl:grid-cols-2 max-md:grid-cols-1 gap-4 mb-6">
            {[
              { label: "YouTube assets", value: youtubeItems.length, tone: "text-plate-foreground-soft" },
              { label: "Linked videos", value: connected, tone: "text-engraving-bright" },
              { label: "Missing video ID", value: missingVideoId, tone: "text-sepia-bright" },
              { label: "Transcript check", value: transcriptNeeded, tone: "bg-ggo-purple/10 text-ggo-purple" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-2">
                <div className={`w-10 h-10  flex items-center justify-center mb-4 ${stat.tone}`}>
                  <Icons.IconYoutube className="w-5 h-5" />
                </div>
                <div className="tabular font-serif text-[26px] font-bold text-plate-foreground-strong">{loading ? "..." : stat.value}</div>
                <div className="column-label">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 mb-5">
            <SearchBar placeholder="Search videos, pathways or IDs..." value={searchTerm} onChange={setSearchTerm} />
            <FilterBar
              filters={["All", "Connected", "Missing ID", "Needs Transcript"]}
              active={activeFilter}
              onChange={setActiveFilter}
            />
          </div>

          <div className="paper border border-paper-edge overflow-x-auto text-paper-foreground">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-[3px] border-double border-paper-edge text-left">
                  <th className="column-label column-label-paper px-4 py-3 font-bold">Asset</th>
                  <th className="column-label column-label-paper px-4 py-3 font-bold">Status</th>
                  <th className="column-label column-label-paper px-4 py-3 font-bold">Pathway</th>
                  <th className="column-label column-label-paper px-4 py-3 font-bold">Transcript</th>
                  <th className="column-label column-label-paper px-4 py-3 font-bold">PIF Reviews</th>
                  <th className="column-label column-label-paper px-4 py-3 font-bold text-right">Links</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-paper-foreground-soft">Loading YouTube assets...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-paper-foreground-soft">No YouTube assets match the current filter.</td></tr>
                ) : filteredItems.map((item) => {
                  const youtubeUrl = getYoutubeUrl(item);
                  return (
                    <tr key={item.id} className="border-b border-paper-edge hover:bg-[var(--engraving-wash)]">
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.title}</div>
                        <div className="text-xs text-paper-foreground-soft">{item.youtubeId ? `YouTube ID: ${normaliseYoutubeId(item.youtubeId)}` : "No YouTube ID stored"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={getStatusTone(item.status)} label={item.status} />
                      </td>
                      <td className="px-4 py-3 text-paper-foreground-soft">
                        {item.pathway.length > 0 ? item.pathway.join(", ") : "-"}
                      </td>
                      <td className="px-4 py-3 text-paper-foreground-soft">
                        {item.transcriptStatus ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          tone={item.pifReviewIds.length > 0 ? "success" : "secondary"}
                          label={`${item.pifReviewIds.length} linked`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {youtubeUrl && (
                            <a className="btn-pill text-xs" href={youtubeUrl} target="_blank" rel="noopener">
                              Watch
                            </a>
                          )}
                          {item.liveUrl && (
                            <a className="btn-pill text-xs" href={item.liveUrl} target="_blank" rel="noopener">
                              Page
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
