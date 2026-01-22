import os
import time
from functools import wraps
from typing import Optional

from gamechanger_client import GameChangerClient
from gamechanger_client.exceptions import ApiError
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="GameChanger Stats API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory cache with TTL
cache_store = {}

def cache_with_ttl(ttl_seconds=300):
    """Cache decorator with time-to-live in seconds"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            cache_key = f"{func.__name__}:{args}:{kwargs}"
            
            # Check if cache exists and is still valid
            if cache_key in cache_store:
                cached_data, timestamp = cache_store[cache_key]
                if time.time() - timestamp < ttl_seconds:
                    return cached_data
            
            # Cache miss or expired - call function
            result = await func(*args, **kwargs)
            cache_store[cache_key] = (result, time.time())
            return result
        return wrapper
    return decorator


# Store client instance
gc_client: Optional[GameChangerClient] = None


class TokenUpdate(BaseModel):
    token: str


class AuthenticationError(Exception):
    """Custom exception for authentication errors"""
    pass


def check_auth_error(response_data):
    """Check if response contains authentication error"""
    if isinstance(response_data, dict):
        if response_data.get('missing_authentication') or 'missing user authentication' in response_data.get('message', '').lower():
            raise AuthenticationError("Token expired or invalid")


@app.on_event("startup")
async def startup_event():
    """Initialize the GameChanger client on startup"""
    global gc_client
    try:
        # Initialize client with token from environment
        token = os.getenv('GC_TOKEN')
        gc_client = GameChangerClient(token=token)
        print("GameChanger client initialized successfully")
    except Exception as e:
        print(f"Failed to initialize GameChanger client: {e}")


@app.get("/")
async def root():
    return {
        "message": "GameChanger Stats API",
        "client_available": gc_client is not None
    }


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "client_initialized": gc_client is not None
    }


@app.post("/api/token")
async def update_token(token_data: TokenUpdate):
    """Update the GameChanger API token dynamically"""
    global gc_client, cache_store
    
    try:
        # Create new client with the provided token
        new_client = GameChangerClient(token=token_data.token)
        
        # Test the token by making a simple API call
        test_response = new_client.me.teams()
        check_auth_error(test_response)
        
        # If successful, update the global client and clear cache
        gc_client = new_client
        cache_store.clear()
        
        return {
            "status": "success",
            "message": "Token updated successfully"
        }
    except ApiError as e:
        if e.status_code == 401:
            raise HTTPException(
                status_code=401,
                detail={"auth_error": True, "message": "Invalid token provided"}
            )
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except AuthenticationError:
        raise HTTPException(
            status_code=401,
            detail={"auth_error": True, "message": "Invalid token provided"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@app.get("/api/organizations")
@cache_with_ttl(ttl_seconds=3600)  # Cache for 1 hour
async def get_organizations():
    """Get all organizations/leagues from teams for the authenticated user"""
    if not gc_client:
        raise HTTPException(status_code=503, detail="GameChanger client not available")
    
    try:
        # Get all teams for the user
        teams = gc_client.me.teams()
        check_auth_error(teams)
    except ApiError as e:
        # Check if it's an authentication error
        if e.status_code == 401:
            raise HTTPException(
                status_code=401,
                detail={"auth_error": True, "message": "Authentication failed. Token may be expired or invalid."}
            )
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except AuthenticationError:
        raise HTTPException(
            status_code=401,
            detail={"auth_error": True, "message": "Authentication failed. Token may be expired or invalid."}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    try:
        
        # Extract unique organization IDs from teams
        organization_ids = set()
        
        for team in teams:
            # Check if team has organizations
            orgs = team.get('organizations', [])
            if not orgs:
                continue
                
            for org in orgs:
                org_id = org.get('organization_id')
                if org_id and org.get('status') == 'active':
                    organization_ids.add(org_id)
        
        # Fetch full organization details for each unique organization
        org_list = []
        for org_id in organization_ids:
            try:
                org_data = gc_client.organizations.get(org_id)
                check_auth_error(org_data)
                
                # Try to fetch avatar image
                avatar_url = None
                try:
                    avatar_data = gc_client.organizations.avatar_image(org_id)
                    avatar_url = avatar_data.get('full_media_url') if avatar_data else None
                except Exception as e:
                    pass  # Avatar is optional
                
                org_list.append({
                    "id": org_data.get('id'),
                    "name": org_data.get('name'),
                    "sport": org_data.get('sport'),
                    "season_name": org_data.get('season_name'),
                    "season_year": org_data.get('season_year'),
                    "city": org_data.get('city'),
                    "state": org_data.get('state'),
                    "type": org_data.get('type'),
                    "avatar_url": avatar_url
                })
            except Exception as e:
                print(f"Error fetching organization {org_id}: {e}")
                continue
        
        # Sort by season year (descending) and name
        org_list.sort(key=lambda x: (-x.get('season_year', 0), x.get('name', '')))
        
        return org_list
    except ApiError as e:
        if e.status_code == 401:
            raise HTTPException(
                status_code=401,
                detail={"auth_error": True, "message": "Authentication failed. Token may be expired or invalid."}
            )
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except AuthenticationError:
        raise HTTPException(
            status_code=401,
            detail={"auth_error": True, "message": "Authentication failed. Token may be expired or invalid."}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def format_stat(value, decimal_places=3):
    """Format a stat value for display"""
    if value is None:
        return "0"
    if isinstance(value, float):
        return f"{value:.{decimal_places}f}"
    return str(value)


def format_innings_pitched(ip: float) -> str:
    """Format innings pitched in MLB style (e.g., 5.1 for 5⅓, 5.2 for 5⅔)."""
    whole_innings = int(ip)
    fractional = ip - whole_innings
    # Convert the fractional part (0.333 = 1 out, 0.667 = 2 outs)
    outs = round(fractional * 3)
    return f"{whole_innings}.{outs}"


def calculate_scorer_strictness(all_batting_stats, all_fielding_stats, raw_offense_stats):
    """
    Calculate separate scorer strictness for offense and defense.
    
    Returns two dictionaries:
    1. offensive_strictness: Based on ROE (Reached on Error) and FC (Fielder's Choice) rates
    2. defensive_strictness: Based on error rates
    
    Negative scores = lenient scoring
    Positive scores = strict scoring
    
    Offensive strictness indicators:
    - Low ROE + Low FC = Lenient (scorer calls hits instead of ROE/FC)
    - High ROE + High FC = Strict (scorer properly calls ROE/FC)
    
    Defensive strictness indicators:
    - Low errors = Lenient (scorer calls hits instead of errors)
    - High errors = Strict (scorer properly calls errors)
    """
    from collections import defaultdict
    import statistics
    
    # Track team offensive stats (ROE, FC, PA)
    team_offense = defaultdict(lambda: {'roe': 0, 'fc': 0, 'pa': 0})
    
    for team_id, players in raw_offense_stats.items():
        for player_id, player_stats in players.items():
            roe = player_stats.get('ROE', 0)
            fc = player_stats.get('FC', 0)
            ab = player_stats.get('AB', 0)
            bb = player_stats.get('BB', 0)
            hbp = player_stats.get('HBP', 0)
            sf = player_stats.get('SF', 0)
            pa = ab + bb + hbp + sf
            
            team_offense[team_id]['roe'] += roe
            team_offense[team_id]['fc'] += fc
            team_offense[team_id]['pa'] += pa
    
    # Track team defensive stats (errors, chances)
    team_defense = defaultdict(lambda: {'errors': 0, 'chances': 0})
    
    for stat in all_fielding_stats:
        team_id = stat['team_id']
        team_defense[team_id]['errors'] += stat['errors']
        team_defense[team_id]['chances'] += (stat['putouts'] + stat['assists'] + stat['errors'])
    
    # Calculate offensive strictness
    offensive_strictness = {}
    
    if len(team_offense) >= 2:
        # Calculate rates per PA
        team_off_rates = {}
        for team_id, data in team_offense.items():
            if data['pa'] >= 50:  # Minimum sample size
                roe_rate = data['roe'] / data['pa']
                fc_rate = data['fc'] / data['pa']
                # Combined judgment call rate (higher = more strict)
                team_off_rates[team_id] = roe_rate + fc_rate
        
        if len(team_off_rates) >= 2:
            league_avg_rate = statistics.mean(team_off_rates.values())
            league_std_rate = statistics.stdev(team_off_rates.values()) if len(team_off_rates) > 1 else 0.01
            
            for team_id, rate in team_off_rates.items():
                z_score = (rate - league_avg_rate) / (league_std_rate or 0.01)
                # High rate = strict, low rate = lenient
                strictness = max(-1.0, min(1.0, z_score))
                offensive_strictness[team_id] = round(strictness, 3)
    
    # Calculate defensive strictness
    defensive_strictness = {}
    
    if len(team_defense) >= 2:
        team_def_rates = {}
        for team_id, data in team_defense.items():
            if data['chances'] >= 50:  # Minimum sample size
                error_rate = data['errors'] / data['chances']
                team_def_rates[team_id] = error_rate
        
        if len(team_def_rates) >= 2:
            league_avg_error_rate = statistics.mean(team_def_rates.values())
            league_std_error_rate = statistics.stdev(team_def_rates.values()) if len(team_def_rates) > 1 else 0.01
            
            for team_id, error_rate in team_def_rates.items():
                z_score = (error_rate - league_avg_error_rate) / (league_std_error_rate or 0.01)
                # High error rate = strict, low error rate = lenient
                strictness = max(-1.0, min(1.0, z_score))
                defensive_strictness[team_id] = round(strictness, 3)
    
    return offensive_strictness, defensive_strictness


def normalize_stat(original_value, strictness, normalization_factor=0.5):
    """
    Normalize a stat based on scorer strictness.
    
    Args:
        original_value: The original stat value
        strictness: The strictness score (-1 to 1)
        normalization_factor: How much to adjust (0 to 1, default 0.5 = 50% correction)
    
    Returns:
        Normalized stat value
    
    Logic:
        - Strict scorer (positive strictness): Raw stats are artificially LOW → INCREASE normalized stats
        - Lenient scorer (negative strictness): Raw stats are artificially HIGH → DECREASE normalized stats
    """
    if original_value == 0:
        return 0
    
    # Adjust the stat based on strictness
    # Positive strictness (strict scorer) → increase the stat
    # Negative strictness (lenient scorer) → decrease the stat
    adjustment = strictness * normalization_factor
    normalized = original_value * (1 + adjustment * 0.1)  # Max 10% adjustment
    
    # Ensure normalized value doesn't exceed maximum possible values
    # Batting avg and fielding pct can't exceed 1.000
    return max(0, min(1.0, normalized))


@app.get("/api/stats/{organization_id}")
@cache_with_ttl(ttl_seconds=600)  # Cache for 10 minutes
async def get_all_stats(organization_id: str):
    """Get all batting, pitching, and fielding statistics for all players in an organization"""
    if not gc_client:
        raise HTTPException(status_code=503, detail="GameChanger client not available")
    
    try:
        # Get all teams in the organization
        teams_data = gc_client.organizations.teams(organization_id=organization_id)
        check_auth_error(teams_data)
    except ApiError as e:
        if e.status_code == 401:
            raise HTTPException(
                status_code=401,
                detail={"auth_error": True, "message": "Authentication failed. Token may be expired or invalid."}
            )
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except AuthenticationError:
        raise HTTPException(
            status_code=401,
            detail={"auth_error": True, "message": "Authentication failed. Token may be expired or invalid."}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    try:
        
        batting_stats = []
        pitching_stats = []
        fielding_stats = []
        team_stats = []
        team_info_map = {}
        raw_offense_stats = {}  # Store raw offense stats by team for strictness calculation
        
        for team in teams_data:
            team_id = team.get('root_team_id')
            team_name = team.get('name', 'Unknown Team')
            team_public_id = team.get('team_public_id')
            
            if not team_id:
                continue
            
            # Get team avatar
            team_avatar = None
            try:
                avatar_data = gc_client.teams.avatar_image(team_id)
                team_avatar = avatar_data.get('full_media_url') if avatar_data else None
            except:
                pass
            
            # Store team info for later use with team records
            team_info_map[team_id] = {"name": team_name, "avatar": team_avatar}
            
            try:
                # Get season stats for the team (single API call)
                season_stats = gc_client.teams.season_stats(team_id)
                check_auth_error(season_stats)
                
                # Get players for the team
                try:
                    players = gc_client.teams.public_players(team_public_id) if team_public_id else []
                    check_auth_error(players)
                except:
                    players = []
                
                # Create player lookup map
                player_map = {p.get('id'): p for p in players}
                
                # Extract individual player stats
                players_data = season_stats.get('stats_data', {}).get('players', {})
                
                # Store raw offense stats for this team
                raw_offense_stats[team_id] = {}
                
                for player_id, player_data in players_data.items():
                    player_info = player_map.get(player_id, {})
                    player_name = f"{player_info.get('first_name', '')} {player_info.get('last_name', '')}".strip()
                    
                    # Skip unknown players
                    if not player_name or 'unknown' in player_name.lower():
                        continue
                    
                    # Process batting (offense) stats
                    offense_stats = player_data.get('stats', {}).get('offense', {})
                    if offense_stats:
                        # Store raw offense stats for strictness calculation
                        raw_offense_stats[team_id][player_id] = offense_stats
                        
                        ab = offense_stats.get('AB', 0)
                        h = offense_stats.get('H', 0)
                        avg = (h / ab) if ab > 0 else 0
                        
                        bb = offense_stats.get('BB', 0)
                        hbp = offense_stats.get('HBP', 0)
                        sf = offense_stats.get('SF', 0)
                        pa = ab + bb + hbp + sf
                        obp = ((h + bb + hbp) / pa) if pa > 0 else 0
                        
                        singles = offense_stats.get('1B', 0)
                        doubles = offense_stats.get('2B', 0)
                        triples = offense_stats.get('3B', 0)
                        hr = offense_stats.get('HR', 0)
                        total_bases = singles + (doubles * 2) + (triples * 3) + (hr * 4)
                        slg = (total_bases / ab) if ab > 0 else 0
                        
                        batting_stats.append({
                            "player_name": player_name,
                            "player_number": player_info.get('number', ''),
                            "player_id": player_id,
                            "team_name": team_name,
                            "team_id": team_id,
                            "team_avatar": team_avatar,
                            "games": offense_stats.get('GP', 0),
                            "at_bats": ab,
                            "plate_appearances": pa,
                            "hits": h,
                            "doubles": doubles,
                            "triples": triples,
                            "home_runs": hr,
                            "rbi": offense_stats.get('RBI', 0),
                            "walks": bb,
                            "strikeouts": offense_stats.get('SO', 0),
                            "batting_avg": format_stat(avg),
                            "on_base_pct": format_stat(obp),
                            "slugging_pct": format_stat(slg)
                        })
                    
                    # Process pitching (defense) stats
                    defense_stats = player_data.get('stats', {}).get('defense', {})
                    if defense_stats:
                        ip = defense_stats.get('IP', 0)
                        er = defense_stats.get('ER', 0)
                        era = ((er * 7) / ip) if ip > 0 else 0
                        
                        h = defense_stats.get('H', 0)
                        bb = defense_stats.get('BB', 0)
                        whip = ((h + bb) / ip) if ip > 0 else 0
                        
                        strike_pct = defense_stats.get('S%', 0)
                        
                        pitching_stats.append({
                            "player_name": player_name,
                            "player_number": player_info.get('number', ''),
                            "player_id": player_id,
                            "team_name": team_name,
                            "team_id": team_id,
                            "team_avatar": team_avatar,
                            "games": defense_stats.get('GP:P', 0),
                            "innings_pitched": format_innings_pitched(ip),
                            "hits_allowed": h,
                            "runs_allowed": defense_stats.get('R', 0),
                            "earned_runs": er,
                            "walks": bb,
                            "strikeouts": defense_stats.get('SO', 0),
                            "era": format_stat(era, 2),
                            "whip": format_stat(whip, 2),
                            "strike_pct": format_stat(strike_pct * 100, 1),
                            "wins": 0,
                            "losses": 0
                        })
                        
                        # Fielding stats (also from defense)
                        po = defense_stats.get('PO', 0)
                        a = defense_stats.get('A', 0)
                        e = defense_stats.get('E', 0)
                        chances = po + a + e
                        fpct = ((po + a) / chances) if chances > 0 else 0
                        fielding_opportunities = po + a
                        
                        fielding_stats.append({
                            "player_name": player_name,
                            "player_number": player_info.get('number', ''),
                            "player_id": player_id,
                            "team_name": team_name,
                            "team_id": team_id,
                            "team_avatar": team_avatar,
                            "games": defense_stats.get('GP:F', 0),
                            "fielding_opportunities": fielding_opportunities,
                            "putouts": po,
                            "assists": a,
                            "errors": e,
                            "double_plays": defense_stats.get('DP', 0),
                            "fielding_pct": format_stat(fpct)
                        })
                
            except Exception as e:
                print(f"Error getting stats for team {team_name}: {e}")
                continue
        
        # Get team records for all teams in the organization
        try:
            team_records = gc_client.organizations.team_records(organization_id)
            check_auth_error(team_records)
            
            # team_records is directly an array of records
            if not isinstance(team_records, list):
                team_records = []
            
            # Build team stats from team records
            for record in team_records:
                team_id = record.get('team_id')
                if team_id not in team_info_map:
                    continue
                
                team_info = team_info_map[team_id]
                overall = record.get('overall', {})
                runs = record.get('runs', {})
                
                wins = overall.get('wins', 0)
                losses = overall.get('losses', 0)
                ties = overall.get('ties', 0)
                games_played = wins + losses + ties
                
                runs_scored = runs.get('scored', 0)
                runs_allowed = runs.get('allowed', 0)
                
                runs_per_game = (runs_scored / games_played) if games_played > 0 else 0
                runs_allowed_per_game = (runs_allowed / games_played) if games_played > 0 else 0
                
                team_stats.append({
                    "team_name": team_info["name"],
                    "team_id": team_id,
                    "team_avatar": team_info["avatar"],
                    "games_played": games_played,
                    "runs_scored": runs_scored,
                    "runs_allowed": runs_allowed,
                    "runs_per_game": format_stat(runs_per_game, 2),
                    "runs_allowed_per_game": format_stat(runs_allowed_per_game, 2)
                })
        except Exception as e:
            print(f"Error getting team records: {e}")
        
        # Calculate separate scorer strictness for offense and defense
        offensive_strictness, defensive_strictness = calculate_scorer_strictness(
            batting_stats, fielding_stats, raw_offense_stats
        )
        
        # Add strictness scores and normalized stats to player data
        for stat in batting_stats:
            team_id = stat['team_id']
            strictness = offensive_strictness.get(team_id, 0)
            stat['scorer_strictness'] = strictness
            
            # Calculate normalized stats
            original_avg = float(stat['batting_avg'])
            original_slg = float(stat['slugging_pct'])
            
            normalized_avg = normalize_stat(original_avg, strictness)
            normalized_slg = normalize_stat(original_slg, strictness)
            
            stat['normalized_batting_avg'] = format_stat(normalized_avg)
            stat['normalized_slugging_pct'] = format_stat(normalized_slg)
        
        for stat in fielding_stats:
            team_id = stat['team_id']
            strictness = defensive_strictness.get(team_id, 0)
            stat['scorer_strictness'] = strictness
            
            # Calculate normalized fielding percentage
            original_fpct = float(stat['fielding_pct'])
            normalized_fpct = normalize_stat(original_fpct, strictness)
            stat['normalized_fielding_pct'] = format_stat(normalized_fpct)
        
        for stat in pitching_stats:
            team_id = stat['team_id']
            strictness = defensive_strictness.get(team_id, 0)
            stat['scorer_strictness'] = strictness
        
        return {
            "batting": batting_stats,
            "pitching": pitching_stats,
            "fielding": fielding_stats,
            "teams": team_stats
        }
    except ApiError as e:
        if e.status_code == 401:
            raise HTTPException(
                status_code=401,
                detail={"auth_error": True, "message": "Authentication failed. Token may be expired or invalid."}
            )
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except AuthenticationError:
        raise HTTPException(
            status_code=401,
            detail={"auth_error": True, "message": "Authentication failed. Token may be expired or invalid."}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

