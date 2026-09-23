"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

// Loaded via next/dynamic from the portineria page so recharts (and its D3
// dependencies) stay out of the route's critical-path bundle.

export interface WeeklyTrendPoint { week: string; clicks: number; sessions: number }
export interface ChannelMixPoint { channel: string; clicks: number; sessions: number }

export default function PortineriaCharts({
    weeklyTrend,
    channelMix,
    chartBoxClassName,
}: {
    weeklyTrend: WeeklyTrendPoint[];
    channelMix: ChannelMixPoint[];
    chartBoxClassName: string;
}) {
    return (
        <>
            <div className={chartBoxClassName}>
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <LineChart data={weeklyTrend}>
                        <CartesianGrid stroke="var(--paper-edge)" strokeDasharray="3 3" />
                        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line
                            type="monotone"
                            dataKey="clicks"
                            stroke="var(--seal)"
                            strokeWidth={2}
                            name="Clicks"
                        />
                        <Line
                            type="monotone"
                            dataKey="sessions"
                            stroke="var(--engraving)"
                            strokeWidth={2}
                            name="Sessions"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className={chartBoxClassName}>
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={channelMix}>
                        <CartesianGrid stroke="var(--paper-edge)" strokeDasharray="3 3" />
                        <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="clicks" fill="var(--seal)" name="Clicks" />
                        <Bar dataKey="sessions" fill="var(--engraving)" name="Sessions" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </>
    );
}
