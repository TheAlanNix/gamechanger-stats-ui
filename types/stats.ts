export interface BattingStats {
    player_name: string;
    player_number: string;
    player_id: string;
    player_avatar?: string;
    team_name: string;
    team_id: string;
    team_avatar?: string;
    games: number;
    at_bats: number;
    plate_appearances: number;
    hits: number;
    doubles: number;
    triples: number;
    home_runs: number;
    rbi: number;
    walks: number;
    strikeouts: number;
    batting_avg: string;
    on_base_pct: string;
    slugging_pct: string;
}

export interface PitchingStats {
    player_name: string;
    player_number: string;
    player_id: string;
    player_avatar?: string;
    team_name: string;
    team_id: string;
    team_avatar?: string;
    games: number;
    innings_pitched: string;
    hits_allowed: number;
    runs_allowed: number;
    earned_runs: number;
    walks: number;
    strikeouts: number;
    era: string;
    whip: string;
    strike_pct: string;
    wins: number;
    losses: number;
}

export interface FieldingStats {
    player_name: string;
    player_number: string;
    player_id: string;
    player_avatar?: string;
    team_name: string;
    team_id: string;
    team_avatar?: string;
    games: number;
    fielding_opportunities: number;
    putouts: number;
    assists: number;
    errors: number;
    double_plays: number;
    fielding_pct: string;
}

export interface TeamStats {
    team_name: string;
    team_id: string;
    team_avatar?: string;
    games_played: number;
    runs_scored: number;
    runs_allowed: number;
    runs_per_game: string;
    runs_allowed_per_game: string;
}
