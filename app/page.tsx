"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BattingTable } from "@/components/batting-table";
import { PitchingTable } from "@/components/pitching-table";
import { FieldingTable } from "@/components/fielding-table";
import { Leaderboards } from "@/components/leaderboards";
import { BattingStats, PitchingStats, FieldingStats, TeamStats } from "@/types/stats";

interface Organization {
    id: string;
    name: string;
    sport: string;
    season_name: string;
    season_year: number;
    avatar_url?: string;
}

export default function Home() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string>("");
    const [battingStats, setBattingStats] = useState<BattingStats[]>([]);
    const [pitchingStats, setPitchingStats] = useState<PitchingStats[]>([]);
    const [fieldingStats, setFieldingStats] = useState<FieldingStats[]>([]);
    const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
    const [loadingOrgs, setLoadingOrgs] = useState(true);
    const [loadingStats, setLoadingStats] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [minPAThreshold, setMinPAThreshold] = useState(20);
    const [minIPThreshold, setMinIPThreshold] = useState(20);
    const [minFOThreshold, setMinFOThreshold] = useState(20);
    const [normalizationFactor, setNormalizationFactor] = useState(50); // 0-100 scale

    // Token update dialog state
    const [showTokenDialog, setShowTokenDialog] = useState(false);
    const [newToken, setNewToken] = useState("");
    const [tokenError, setTokenError] = useState<string | null>(null);
    const [updatingToken, setUpdatingToken] = useState(false);

    // Calculate league averages
    const avgPlateAppearances = useMemo(() => {
        if (!battingStats || battingStats.length === 0) return 0;
        const playersWithPA = battingStats.filter(p => p.plate_appearances > 0);
        if (playersWithPA.length === 0) return 0;
        const total = playersWithPA.reduce((sum, player) => sum + player.plate_appearances, 0);
        return total / playersWithPA.length;
    }, [battingStats]);

    const avgInningsPitched = useMemo(() => {
        if (!pitchingStats || pitchingStats.length === 0) return 0;
        const playersWithIP = pitchingStats.filter(p => {
            const ip = String(p.innings_pitched);
            const parts = ip.split('.');
            const whole = parseInt(parts[0]) || 0;
            const outs = parseInt(parts[1]) || 0;
            return (whole + (outs / 3)) > 0;
        });
        if (playersWithIP.length === 0) return 0;
        const total = playersWithIP.reduce((sum, player) => {
            const ip = String(player.innings_pitched);
            const parts = ip.split('.');
            const whole = parseInt(parts[0]) || 0;
            const outs = parseInt(parts[1]) || 0;
            return sum + whole + (outs / 3);
        }, 0);
        return total / playersWithIP.length;
    }, [pitchingStats]);

    const avgFieldingOpportunities = useMemo(() => {
        if (!fieldingStats || fieldingStats.length === 0) return 0;
        const playersWithFO = fieldingStats.filter(p => p.fielding_opportunities > 0);
        if (playersWithFO.length === 0) return 0;
        const total = playersWithFO.reduce((sum, player) => sum + player.fielding_opportunities, 0);
        return total / playersWithFO.length;
    }, [fieldingStats]);

    const minPA = useMemo(() => (avgPlateAppearances * minPAThreshold) / 100, [avgPlateAppearances, minPAThreshold]);
    const minIP = useMemo(() => (avgInningsPitched * minIPThreshold) / 100, [avgInningsPitched, minIPThreshold]);
    const minFO = useMemo(() => (avgFieldingOpportunities * minFOThreshold) / 100, [avgFieldingOpportunities, minFOThreshold]);

    // Helper function to normalize a stat based on strictness
    const normalizeStat = (originalValue: number, strictness: number): number => {
        if (originalValue === 0) return 0;
        const factor = normalizationFactor / 100; // Convert 0-100 to 0-1
        const adjustment = strictness * factor;
        const normalized = originalValue * (1 + adjustment * 0.1); // Max 10% adjustment
        return Math.max(0, normalized);
    };

    // Recalculate normalized stats when normalization factor changes
    const normalizedBattingStats = useMemo(() => {
        return battingStats.map(stat => {
            const strictness = stat.scorer_strictness || 0;
            const originalAvg = parseFloat(stat.batting_avg);
            const originalSlg = parseFloat(stat.slugging_pct);
            return {
                ...stat,
                normalized_batting_avg: Math.min(1.0, normalizeStat(originalAvg, strictness)).toFixed(3),
                normalized_slugging_pct: normalizeStat(originalSlg, strictness).toFixed(3)
            };
        });
    }, [battingStats, normalizationFactor]);

    const normalizedFieldingStats = useMemo(() => {
        return fieldingStats.map(stat => {
            const strictness = stat.scorer_strictness || 0;
            const originalFpct = parseFloat(stat.fielding_pct);
            return {
                ...stat,
                normalized_fielding_pct: Math.min(1.0, normalizeStat(originalFpct, strictness)).toFixed(3)
            };
        });
    }, [fieldingStats, normalizationFactor]);

    // Fetch organizations on mount
    useEffect(() => {
        fetchOrganizations();
    }, []);

    // Fetch stats when organization is selected
    useEffect(() => {
        if (selectedOrgId) {
            fetchStats(selectedOrgId);
        }
    }, [selectedOrgId]);

    const handleAuthError = (errorDetail: any) => {
        // Check if the error response indicates an auth error
        if (errorDetail && errorDetail.auth_error) {
            setShowTokenDialog(true);
            return true;
        }
        return false;
    };

    const fetchOrganizations = async () => {
        try {
            setLoadingOrgs(true);
            setError(null);

            const response = await fetch('/api/organizations');

            if (response.status === 401) {
                const errorData = await response.json();
                if (handleAuthError(errorData.detail)) {
                    return;
                }
            }

            if (!response.ok) {
                throw new Error("Failed to fetch organizations");
            }

            const data = await response.json();
            setOrganizations(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoadingOrgs(false);
        }
    };

    const fetchStats = async (orgId: string) => {
        try {
            setLoadingStats(true);
            setError(null);

            const response = await fetch(`/api/stats/${orgId}`);

            if (response.status === 401) {
                const errorData = await response.json();
                if (handleAuthError(errorData.detail)) {
                    return;
                }
            }

            if (!response.ok) {
                throw new Error("Failed to fetch stats");
            }

            const data = await response.json();

            setBattingStats(data.batting);
            setPitchingStats(data.pitching);
            setFieldingStats(data.fielding);
            setTeamStats(data.teams || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoadingStats(false);
        }
    };

    const handleTokenUpdate = async () => {
        if (!newToken.trim()) {
            setTokenError("Please enter a token");
            return;
        }

        try {
            setUpdatingToken(true);
            setTokenError(null);

            const response = await fetch('/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token: newToken.trim() }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail?.message || errorData.detail || 'Failed to update token');
            }

            // Token updated successfully
            setShowTokenDialog(false);
            setNewToken("");
            setTokenError(null);

            // Refresh organizations
            fetchOrganizations();
        } catch (err) {
            setTokenError(err instanceof Error ? err.message : "Failed to update token");
        } finally {
            setUpdatingToken(false);
        }
    };

    const selectedOrg = organizations.find(org => org.id === selectedOrgId);

    return (
        <main className="container mx-auto py-10">
            {/* Token Update Dialog */}
            <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update GameChanger Token</DialogTitle>
                        <DialogDescription>
                            Your GameChanger token has expired or is invalid. Please enter a new token to continue.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="token">GameChanger Token</Label>
                            <Input
                                id="token"
                                type="text"
                                placeholder="Paste your token here"
                                value={newToken}
                                onChange={(e) => setNewToken(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleTokenUpdate();
                                    }
                                }}
                            />
                            {tokenError && (
                                <p className="text-sm text-destructive">{tokenError}</p>
                            )}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-2">
                            <p><strong>To get your token:</strong></p>
                            <ol className="list-decimal list-inside space-y-1 ml-2">
                                <li>Log into gc.com in your browser</li>
                                <li>Open Developer Tools (F12)</li>
                                <li>Go to Application/Storage → Cookies</li>
                                <li>Find the &quot;token&quot; cookie and copy its value</li>
                            </ol>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowTokenDialog(false);
                                setNewToken("");
                                setTokenError(null);
                            }}
                            disabled={updatingToken}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleTokenUpdate} disabled={updatingToken}>
                            {updatingToken ? "Updating..." : "Update Token"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">GameChanger League Stats</h1>
                <p className="text-muted-foreground">
                    View player batting, pitching, and fielding statistics
                </p>
            </div>

            {loadingOrgs ? (
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">Loading organizations...</p>
                    </CardContent>
                </Card>
            ) : error ? (
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-destructive">Error: {error}</p>
                        <p className="text-center text-sm text-muted-foreground mt-2">
                            Make sure the backend server is running on port 8000
                        </p>
                    </CardContent>
                </Card>
            ) : organizations.length === 0 ? (
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">No organizations found</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Select League/Organization</CardTitle>
                            <CardDescription>
                                Choose a league to view player statistics
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a league">
                                        {selectedOrg && (
                                            <div className="flex items-center gap-2">
                                                {selectedOrg.avatar_url && (
                                                    <img
                                                        src={selectedOrg.avatar_url}
                                                        alt={selectedOrg.name}
                                                        className="w-8 rounded"
                                                        crossOrigin="anonymous"
                                                    />
                                                )}
                                                <span>
                                                    {selectedOrg.name} - {selectedOrg.season_name.charAt(0).toUpperCase() + selectedOrg.season_name.slice(1)} {selectedOrg.season_year}
                                                </span>
                                            </div>
                                        )}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {organizations.map((org) => (
                                        <SelectItem key={org.id} value={org.id}>
                                            {org.name} - {org.season_name.charAt(0).toUpperCase() + org.season_name.slice(1)} {org.season_year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedOrg && (
                                <div className="mt-4 flex items-start gap-3">
                                    {selectedOrg.avatar_url && (
                                        <img
                                            src={selectedOrg.avatar_url}
                                            alt={selectedOrg.name}
                                            className="w-16 rounded" crossOrigin="anonymous" />
                                    )}
                                    <div className="text-sm text-muted-foreground">
                                        <p><strong>Selected:</strong> {selectedOrg.name}</p>
                                        <p><strong>Sport:</strong> {selectedOrg.sport}</p>
                                        <p><strong>Season:</strong> {selectedOrg.season_name} {selectedOrg.season_year}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {loadingStats ? (
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-center text-muted-foreground">Loading stats...</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Tabs defaultValue="leaderboards" className="space-y-4">
                            <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
                                <TabsTrigger value="leaderboards">Leaders</TabsTrigger>
                                <TabsTrigger value="batting">Batting</TabsTrigger>
                                <TabsTrigger value="pitching">Pitching</TabsTrigger>
                                <TabsTrigger value="fielding">Fielding</TabsTrigger>
                            </TabsList>

                            {/* Normalization Factor Slider */}
                            <Card className="bg-muted/30">
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <Label className="text-sm font-medium mb-2 block">
                                                Scorer Strictness Adjustment: {normalizationFactor}%
                                            </Label>
                                            <p className="text-xs text-muted-foreground mb-3">
                                                Controls how much normalized stats are adjusted for scorer bias (0% = no adjustment, 100% = full adjustment)
                                            </p>
                                        </div>
                                        <div className="w-64">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-muted-foreground">0%</span>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="5"
                                                    value={normalizationFactor}
                                                    onChange={(e) => setNormalizationFactor(Number(e.target.value))}
                                                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                                />
                                                <span className="text-xs text-muted-foreground">100%</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <TabsContent value="leaderboards">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>League Leaderboards</CardTitle>
                                        <CardDescription>
                                            Top performers across key statistical categories
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {(battingStats && battingStats.length > 0) || (pitchingStats && pitchingStats.length > 0) ? (
                                            <Leaderboards
                                                battingStats={battingStats}
                                                pitchingStats={pitchingStats}
                                                teamStats={teamStats}
                                                minPAThreshold={minPAThreshold}
                                                setMinPAThreshold={setMinPAThreshold}
                                                minIPThreshold={minIPThreshold}
                                                setMinIPThreshold={setMinIPThreshold}
                                                avgPlateAppearances={avgPlateAppearances}
                                                avgInningsPitched={avgInningsPitched}
                                                minPA={minPA}
                                                minIP={minIP}
                                            />
                                        ) : (
                                            <p className="text-center text-muted-foreground py-8">
                                                No stats available
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="batting">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Player Batting Statistics</CardTitle>
                                        <CardDescription>
                                            Offensive performance metrics for all players
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {battingStats && battingStats.length > 0 ? (
                                            <BattingTable
                                                stats={normalizedBattingStats}
                                                minPA={minPA}
                                                minPAThreshold={minPAThreshold}
                                                setMinPAThreshold={setMinPAThreshold}
                                                avgPlateAppearances={avgPlateAppearances}
                                            />
                                        ) : (
                                            <p className="text-center text-muted-foreground py-8">
                                                No batting stats available
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="pitching">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Player Pitching Statistics</CardTitle>
                                        <CardDescription>
                                            Pitching performance metrics for all players
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {pitchingStats && pitchingStats.length > 0 ? (
                                            <PitchingTable
                                                stats={pitchingStats}
                                                minIP={minIP}
                                                minIPThreshold={minIPThreshold}
                                                setMinIPThreshold={setMinIPThreshold}
                                                avgInningsPitched={avgInningsPitched}
                                            />
                                        ) : (
                                            <p className="text-center text-muted-foreground py-8">
                                                No pitching stats available
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="fielding">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Player Fielding Statistics</CardTitle>
                                        <CardDescription>
                                            Defensive performance metrics for all players
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {fieldingStats && fieldingStats.length > 0 ? (
                                            <FieldingTable
                                                stats={normalizedFieldingStats}
                                                minFO={minFO}
                                                minFOThreshold={minFOThreshold}
                                                setMinFOThreshold={setMinFOThreshold}
                                                avgFieldingOpportunities={avgFieldingOpportunities}
                                            />
                                        ) : (
                                            <p className="text-center text-muted-foreground py-8">
                                                No fielding stats available
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    )}
                </>
            )}
        </main>
    );
}
