"use client";

import { useState, useMemo } from "react";
import { BattingStats, PitchingStats, TeamStats } from "@/types/stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface LeaderboardsProps {
    battingStats: BattingStats[];
    pitchingStats: PitchingStats[];
    teamStats: TeamStats[];
    minPAThreshold: number;
    setMinPAThreshold: (value: number) => void;
    minIPThreshold: number;
    setMinIPThreshold: (value: number) => void;
    avgPlateAppearances: number;
    avgInningsPitched: number;
    minPA: number;
    minIP: number;
}

interface LeaderboardEntry {
    player_name: string;
    player_number: string;
    team_name: string;
    team_avatar?: string;
    value: string | number;
    rawValue?: number;
}

export function Leaderboards({
    battingStats,
    pitchingStats, teamStats, minPAThreshold,
    setMinPAThreshold,
    minIPThreshold,
    setMinIPThreshold,
    avgPlateAppearances,
    avgInningsPitched,
    minPA,
    minIP
}: LeaderboardsProps) {
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

    const toggleCard = (cardId: string) => {
        setExpandedCards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(cardId)) {
                newSet.delete(cardId);
            } else {
                newSet.add(cardId);
            }
            return newSet;
        });
    };

    const getTopPlayers = (
        stats: (BattingStats | PitchingStats)[],
        key: keyof BattingStats | keyof PitchingStats,
        limit: number = 5,
        ascending: boolean = false,
        minThreshold?: number,
        thresholdKey?: 'plate_appearances' | 'innings_pitched'
    ): LeaderboardEntry[] => {
        let filteredStats = [...stats];

        // Apply minimum threshold filter for percentage stats
        if (minThreshold !== undefined && thresholdKey) {
            filteredStats = filteredStats.filter((player) => {
                if (thresholdKey === 'plate_appearances') {
                    return (player as BattingStats).plate_appearances >= minThreshold;
                } else if (thresholdKey === 'innings_pitched') {
                    const ip = String((player as PitchingStats).innings_pitched);
                    const parts = ip.split('.');
                    const whole = parseInt(parts[0]) || 0;
                    const outs = parseInt(parts[1]) || 0;
                    const totalInnings = whole + (outs / 3);
                    return totalInnings >= minThreshold;
                }
                return true;
            });
        }

        return filteredStats
            .map((player) => {
                const value = player[key as keyof typeof player];
                let rawValue: number;

                // Parse string values to numbers for sorting
                if (typeof value === "string") {
                    rawValue = parseFloat(value);
                } else {
                    rawValue = value as number;
                }

                return {
                    player_name: player.player_name,
                    player_number: player.player_number,
                    team_name: player.team_name,
                    team_avatar: player.team_avatar,
                    value: value ?? 0,
                    rawValue,
                };
            })
            .filter((entry) => !isNaN(entry.rawValue) && entry.rawValue > 0)
            .sort((a, b) => (ascending ? a.rawValue - b.rawValue : b.rawValue - a.rawValue))
            .slice(0, limit);
    };

    const LeaderboardCard = ({
        title,
        description,
        entries,
        cardId,
    }: {
        title: string;
        description: string;
        entries: LeaderboardEntry[];
        cardId: string;
    }) => {
        const isExpanded = expandedCards.has(cardId);
        const displayLimit = isExpanded ? 20 : 5;
        const displayedEntries = entries.slice(0, displayLimit);
        const hasMore = entries.length > displayLimit;

        return (
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{title}</CardTitle>
                    <CardDescription className="text-xs">{description}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {displayedEntries.map((entry, index) => (
                            <div key={`${entry.player_name}-${index}`} className="flex items-center justify-between text-sm py-1">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-muted-foreground font-mono w-4 flex-shrink-0">{index + 1}.</span>
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {entry.team_avatar && (
                                            <img
                                                src={entry.team_avatar}
                                                alt={entry.team_name}
                                                className="w-6 rounded flex-shrink-0"
                                                crossOrigin="anonymous"
                                            />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium truncate">
                                                {entry.player_name} #{entry.player_number}
                                            </div>
                                            <div className="text-xs text-muted-foreground truncate">{entry.team_name}</div>
                                        </div>
                                    </div>
                                </div>
                                <span className="font-bold ml-2 flex-shrink-0">{entry.value}</span>
                            </div>
                        ))}
                        {displayedEntries.length === 0 && (
                            <p className="text-center text-muted-foreground text-sm py-4">No data available</p>
                        )}
                    </div>
                    {(hasMore || isExpanded) && displayedEntries.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-3"
                            onClick={() => toggleCard(cardId)}
                        >
                            {isExpanded ? "Show Less" : `Show More (${entries.length} total)`}
                        </Button>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            {/* Batting Section */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Batting Leaders</h2>
                    <div className="flex items-center gap-4">
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
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <LeaderboardCard
                        cardId="batting-avg"
                        title="Batting Average"
                        description="Batting average leaders"
                        entries={getTopPlayers(battingStats, "batting_avg", 20, false, minPA, 'plate_appearances')}
                    />
                    <LeaderboardCard
                        cardId="batting-rbi"
                        title="RBIs"
                        description="Runs batted in leaders"
                        entries={getTopPlayers(battingStats, "rbi", 20)}
                    />
                    <LeaderboardCard
                        cardId="batting-slg"
                        title="Slugging Percentage"
                        description="Slugging percentage leaders"
                        entries={getTopPlayers(battingStats, "slugging_pct", 20, false, minPA, 'plate_appearances')}
                    />
                    <LeaderboardCard
                        cardId="batting-hr"
                        title="Home Runs"
                        description="Home run leaders"
                        entries={getTopPlayers(battingStats, "home_runs", 20)}
                    />
                    <LeaderboardCard
                        cardId="batting-obp"
                        title="On-Base Percentage"
                        description="On-base percentage leaders"
                        entries={getTopPlayers(battingStats, "on_base_pct", 20, false, minPA, 'plate_appearances')}
                    />
                    <LeaderboardCard
                        cardId="batting-hits"
                        title="Hits"
                        description="Hit leaders"
                        entries={getTopPlayers(battingStats, "hits", 20)}
                    />
                </div>
            </div>

            {/* Pitching Section */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Pitching Leaders</h2>
                    <div className="flex items-center gap-4">
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
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <LeaderboardCard
                        cardId="pitching-era"
                        title="ERA"
                        description="Earned run average leaders"
                        entries={getTopPlayers(pitchingStats, "era", 20, true, minIP, 'innings_pitched')}
                    />
                    <LeaderboardCard
                        cardId="pitching-whip"
                        title="WHIP"
                        description="WHIP leaders"
                        entries={getTopPlayers(pitchingStats, "whip", 20, true, minIP, 'innings_pitched')}
                    />
                    <LeaderboardCard
                        cardId="pitching-strike-pct"
                        title="Strike Percentage"
                        description="Strike percentage leaders"
                        entries={getTopPlayers(pitchingStats, "strike_pct", 20, false, minIP, 'innings_pitched').map(entry => ({
                            ...entry,
                            value: `${entry.value}%`
                        }))}
                    />
                    <LeaderboardCard
                        cardId="pitching-strikeouts"
                        title="Strikeouts"
                        description="Strikeout leaders"
                        entries={getTopPlayers(pitchingStats, "strikeouts", 20)}
                    />
                    <LeaderboardCard
                        cardId="pitching-ip"
                        title="Innings Pitched"
                        description="Innings pitched leaders"
                        entries={getTopPlayers(pitchingStats, "innings_pitched", 20).map(entry => {
                            // Parse MLB format innings (5.1 = 5⅓) for proper sorting
                            const parts = String(entry.value).split('.');
                            const whole = parseInt(parts[0]) || 0;
                            const outs = parseInt(parts[1]) || 0;
                            const totalInnings = whole + (outs / 3);
                            return { ...entry, rawValue: totalInnings };
                        }).sort((a, b) => b.rawValue - a.rawValue)}
                    />
                    <LeaderboardCard
                        cardId="pitching-wins"
                        title="Wins"
                        description="Win leaders"
                        entries={getTopPlayers(pitchingStats, "wins", 20)}
                    />
                </div>
            </div>

            {/* Team Stats Section */}
            {teamStats && teamStats.length > 0 && (
                <div>
                    <h2 className="text-2xl font-bold mb-4">Team Leaders</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Runs Per Game</CardTitle>
                                <CardDescription className="text-xs">Teams scoring the most runs per game</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {[...teamStats]
                                        .sort((a, b) => parseFloat(b.runs_per_game) - parseFloat(a.runs_per_game))
                                        .map((team, index) => (
                                            <div key={team.team_id} className="flex items-center justify-between text-sm py-1">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <span className="text-muted-foreground font-mono w-4 flex-shrink-0">{index + 1}.</span>
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        {team.team_avatar && (
                                                            <img
                                                                src={team.team_avatar}
                                                                alt={team.team_name}
                                                                className="w-4 h-4 rounded object-cover flex-shrink-0"
                                                                crossOrigin="anonymous"
                                                            />
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-medium truncate">{team.team_name}</div>
                                                            <div className="text-xs text-muted-foreground">{team.runs_scored} R in {team.games_played} GP</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="font-bold ml-2 flex-shrink-0">{team.runs_per_game}</span>
                                            </div>
                                        ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Runs Allowed Per Game</CardTitle>
                                <CardDescription className="text-xs">Teams allowing the fewest runs per game</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {[...teamStats]
                                        .sort((a, b) => parseFloat(a.runs_allowed_per_game) - parseFloat(b.runs_allowed_per_game))
                                        .map((team, index) => (
                                            <div key={team.team_id} className="flex items-center justify-between text-sm py-1">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <span className="text-muted-foreground font-mono w-4 flex-shrink-0">{index + 1}.</span>
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        {team.team_avatar && (
                                                            <img
                                                                src={team.team_avatar}
                                                                alt={team.team_name}
                                                                className="w-4 h-4 rounded object-cover flex-shrink-0"
                                                                crossOrigin="anonymous"
                                                            />
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-medium truncate">{team.team_name}</div>
                                                            <div className="text-xs text-muted-foreground">{team.runs_allowed} RA in {team.games_played} GP</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="font-bold ml-2 flex-shrink-0">{team.runs_allowed_per_game}</span>
                                            </div>
                                        ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
