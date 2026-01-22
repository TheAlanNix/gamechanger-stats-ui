"use client";

import { useState } from "react";
import { BattingStats } from "@/types/stats";
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

interface BattingTableProps {
    stats: BattingStats[];
    minPA?: number;
    minPAThreshold?: number;
    setMinPAThreshold?: (value: number) => void;
    avgPlateAppearances?: number;
}

type SortKey = keyof BattingStats;
type SortDirection = "asc" | "desc";

export function BattingTable({ stats, minPA = 0, minPAThreshold = 20, setMinPAThreshold, avgPlateAppearances = 0 }: BattingTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("batting_avg");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

    // Filter stats based on minimum PA
    const filteredStats = minPA > 0 ? stats.filter(player => player.plate_appearances >= minPA) : stats;

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
            {setMinPAThreshold && (
                <div className="mb-4 flex items-center justify-end gap-4">
                    <div className="w-64">
                        <Label className="text-xs text-muted-foreground mb-2 block">
                            Min. PA: {minPA.toFixed(1)} ({minPAThreshold}% of avg {avgPlateAppearances.toFixed(1)})
                        </Label>
                        <Slider
                            value={[minPAThreshold]}
                            onValueChange={(value) => setMinPAThreshold(value[0])}
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
                        <SortableHeader column="games" className="text-right">G</SortableHeader>
                        <SortableHeader column="at_bats" className="text-right">AB</SortableHeader>
                        <SortableHeader column="hits" className="text-right">H</SortableHeader>
                        <SortableHeader column="doubles" className="text-right">2B</SortableHeader>
                        <SortableHeader column="triples" className="text-right">3B</SortableHeader>
                        <SortableHeader column="home_runs" className="text-right">HR</SortableHeader>
                        <SortableHeader column="rbi" className="text-right">RBI</SortableHeader>
                        <SortableHeader column="walks" className="text-right">BB</SortableHeader>
                        <SortableHeader column="strikeouts" className="text-right">K</SortableHeader>
                        <SortableHeader column="batting_avg" className="text-right">AVG</SortableHeader>
                        <SortableHeader column="normalized_batting_avg" className="text-right" title="Normalized AVG (adjusted for scorer)">nAVG</SortableHeader>
                        <SortableHeader column="on_base_pct" className="text-right">OBP</SortableHeader>
                        <SortableHeader column="slugging_pct" className="text-right">SLG</SortableHeader>
                        <SortableHeader column="normalized_slugging_pct" className="text-right" title="Normalized SLG (adjusted for scorer)">nSLG</SortableHeader>
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
                                            className="w-7 rounded flex-shrink-0"
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
                            <TableCell className="text-right">{player.at_bats}</TableCell>
                            <TableCell className="text-right">{player.hits}</TableCell>
                            <TableCell className="text-right">{player.doubles}</TableCell>
                            <TableCell className="text-right">{player.triples}</TableCell>
                            <TableCell className="text-right">{player.home_runs}</TableCell>
                            <TableCell className="text-right">{player.rbi}</TableCell>
                            <TableCell className="text-right">{player.walks}</TableCell>
                            <TableCell className="text-right">{player.strikeouts}</TableCell>
                            <TableCell className="text-right font-semibold">{formatDecimal(player.batting_avg)}</TableCell>
                            <TableCell className="text-right font-semibold text-blue-600">{player.normalized_batting_avg ? formatDecimal(player.normalized_batting_avg) : "-"}</TableCell>
                            <TableCell className="text-right">{formatDecimal(player.on_base_pct)}</TableCell>
                            <TableCell className="text-right">{formatDecimal(player.slugging_pct)}</TableCell>
                            <TableCell className="text-right text-blue-600">{player.normalized_slugging_pct ? formatDecimal(player.normalized_slugging_pct) : "-"}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </>
    );
}
