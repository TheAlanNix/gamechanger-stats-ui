"use client";

import { useState } from "react";
import { PitchingStats } from "@/types/stats";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface PitchingTableProps {
    stats: PitchingStats[];
    minIP?: number;
    minIPThreshold?: number;
    setMinIPThreshold?: (value: number) => void;
    avgInningsPitched?: number;
}

type SortKey = keyof PitchingStats;
type SortDirection = "asc" | "desc";

export function PitchingTable({ stats, minIP = 0, minIPThreshold = 20, setMinIPThreshold, avgInningsPitched = 0 }: PitchingTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("era");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

    // Filter stats based on minimum IP
    const filteredStats = minIP > 0 ? stats.filter(player => {
        const ip = String(player.innings_pitched);
        const parts = ip.split('.');
        const whole = parseInt(parts[0]) || 0;
        const outs = parseInt(parts[1]) || 0;
        const totalInnings = whole + (outs / 3);
        return totalInnings >= minIP;
    }) : stats;

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    const sortedStats = [...filteredStats].sort((a, b) => {
        const aValue = a[sortKey];
        const bValue = b[sortKey];

        // Try to parse as numbers first
        const aNum = typeof aValue === "number" ? aValue : parseFloat(aValue as string);
        const bNum = typeof bValue === "number" ? bValue : parseFloat(bValue as string);

        // If both parse successfully as numbers, sort numerically
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
        }

        // Otherwise sort as strings
        return sortDirection === "asc"
            ? String(aValue).localeCompare(String(bValue))
            : String(bValue).localeCompare(String(aValue));
    });

    const formatDecimal = (value: string | number): string => {
        const num = typeof value === "number" ? value : parseFloat(value);
        return isNaN(num) ? "0.000" : num.toFixed(3);
    };

    const formatStrictness = (strictness?: number): string => {
        if (strictness === undefined || strictness === null) return "";
        if (strictness < -0.3) return "🟢"; // Lenient
        if (strictness > 0.3) return "🔴"; // Strict
        return "⚪"; // Neutral
    };

    const getStrictnessTooltip = (strictness?: number): string => {
        if (strictness === undefined || strictness === null) return "No data";
        if (strictness < -0.3) return `Lenient scorer (${strictness.toFixed(2)})`;
        if (strictness > 0.3) return `Strict scorer (${strictness.toFixed(2)})`;
        return `Neutral scorer (${strictness.toFixed(2)})`;
    };

    const SortableHeader = ({ column, children, className }: { column: SortKey; children: React.ReactNode; className?: string }) => (
        <TableHead
            className={`cursor-pointer hover:bg-muted/50 ${className || ""}`}
            onClick={() => handleSort(column)}
        >
            <div className="flex items-center gap-1">
                {children}
                {sortKey === column && (
                    <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
            </div>
        </TableHead>
    );

    return (
        <>
            {setMinIPThreshold && (
                <div className="mb-4 flex items-center justify-end gap-4">
                    <div className="w-64">
                        <Label className="text-xs text-muted-foreground mb-2 block">
                            Min. IP: {minIP.toFixed(1)} ({minIPThreshold}% of avg {avgInningsPitched.toFixed(1)})
                        </Label>
                        <Slider
                            value={[minIPThreshold]}
                            onValueChange={(value) => setMinIPThreshold(value[0])}
                            min={0}
                            max={100}
                            step={5}
                            className="w-full"
                        />
                    </div>
                </div>
            )}
            <Table>
                <TableHeader>
                    <TableRow>
                        <SortableHeader column="player_name">Player</SortableHeader>
                        <SortableHeader column="team_name">Team</SortableHeader>
                        <TableHead className="text-center" title="Scorer Strictness: 🟢=Lenient 🔴=Strict ⚪=Neutral">📊</TableHead>
                        <SortableHeader column="games" className="text-right">GP</SortableHeader>
                        <SortableHeader column="innings_pitched" className="text-right">IP</SortableHeader>
                        <SortableHeader column="hits_allowed" className="text-right">H</SortableHeader>
                        <SortableHeader column="runs_allowed" className="text-right">R</SortableHeader>
                        <SortableHeader column="earned_runs" className="text-right">ER</SortableHeader>
                        <SortableHeader column="walks" className="text-right">BB</SortableHeader>
                        <SortableHeader column="strikeouts" className="text-right">K</SortableHeader>
                        <SortableHeader column="wins" className="text-right">W</SortableHeader>
                        <SortableHeader column="losses" className="text-right">L</SortableHeader>
                        <SortableHeader column="era" className="text-right">ERA</SortableHeader>
                        <SortableHeader column="whip" className="text-right">WHIP</SortableHeader>
                        <SortableHeader column="strike_pct" className="text-right">S%</SortableHeader>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedStats.map((player) => (
                        <TableRow key={player.player_id}>
                            <TableCell className="font-medium py-2">
                                <span>{player.player_name} #{player.player_number}</span>
                            </TableCell>
                            <TableCell className="py-2">
                                <div className="flex items-center gap-2">
                                    {player.team_avatar && (
                                        <img
                                            src={player.team_avatar}
                                            alt={player.team_name}
                                            className="w-5 h-5 rounded object-cover flex-shrink-0"
                                            crossOrigin="anonymous"
                                        />
                                    )}
                                    <span className="truncate">{player.team_name}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-center" title={getStrictnessTooltip(player.scorer_strictness)}>
                                {formatStrictness(player.scorer_strictness)}
                            </TableCell>
                            <TableCell className="text-right">{player.games}</TableCell>
                            <TableCell className="text-right">{player.innings_pitched}</TableCell>
                            <TableCell className="text-right">{player.hits_allowed}</TableCell>
                            <TableCell className="text-right">{player.runs_allowed}</TableCell>
                            <TableCell className="text-right">{player.earned_runs}</TableCell>
                            <TableCell className="text-right">{player.walks}</TableCell>
                            <TableCell className="text-right">{player.strikeouts}</TableCell>
                            <TableCell className="text-right">{player.wins}</TableCell>
                            <TableCell className="text-right">{player.losses}</TableCell>
                            <TableCell className="text-right font-semibold">{formatDecimal(player.era)}</TableCell>
                            <TableCell className="text-right">{formatDecimal(player.whip)}</TableCell>
                            <TableCell className="text-right">{player.strike_pct}%</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </>
    );
}
