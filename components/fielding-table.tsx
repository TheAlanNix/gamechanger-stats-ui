"use client";

import { useState } from "react";
import { FieldingStats } from "@/types/stats";
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

interface FieldingTableProps {
    stats: FieldingStats[];
    minFO?: number;
    minFOThreshold?: number;
    setMinFOThreshold?: (value: number) => void;
    avgFieldingOpportunities?: number;
}

type SortKey = keyof FieldingStats;
type SortDirection = "asc" | "desc";

export function FieldingTable({ stats, minFO = 0, minFOThreshold = 20, setMinFOThreshold, avgFieldingOpportunities = 0 }: FieldingTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("fielding_pct");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

    // Filter stats based on minimum fielding opportunities
    const filteredStats = minFO > 0 ? stats.filter(player => player.fielding_opportunities >= minFO) : stats;

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
            {setMinFOThreshold && (
                <div className="mb-4 flex items-center justify-end gap-4">
                    <div className="w-64">
                        <Label className="text-xs text-muted-foreground mb-2 block">
                            Min. FO: {minFO.toFixed(1)} ({minFOThreshold}% of avg {avgFieldingOpportunities.toFixed(1)})
                        </Label>
                        <Slider
                            value={[minFOThreshold]}
                            onValueChange={(value) => setMinFOThreshold(value[0])}
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
                        <SortableHeader column="games" className="text-right">G</SortableHeader>
                        <SortableHeader column="putouts" className="text-right">PO</SortableHeader>
                        <SortableHeader column="assists" className="text-right">A</SortableHeader>
                        <SortableHeader column="errors" className="text-right">E</SortableHeader>
                        <SortableHeader column="double_plays" className="text-right">DP</SortableHeader>
                        <SortableHeader column="fielding_pct" className="text-right">FLD%</SortableHeader>
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
                            <TableCell className="text-right py-2">{player.games}</TableCell>
                            <TableCell className="text-right">{player.putouts}</TableCell>
                            <TableCell className="text-right">{player.assists}</TableCell>
                            <TableCell className="text-right">{player.errors}</TableCell>
                            <TableCell className="text-right">{player.double_plays}</TableCell>
                            <TableCell className="text-right font-semibold">{formatDecimal(player.fielding_pct)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </>
    );
}
