/**
 * SupabaseClient — handles all database operations (players, scores, leaderboard).
 * 
 * Usage:
 *   1. Create a Supabase project at https://supabase.com
 *   2. Copy your project URL and anon key into the config below
 *   3. Run the SQL in the Supabase SQL editor to create tables
 */
const SUPABASE_CONFIG = {
  url: 'https://ozsoyfyjjdepubiqxrrq.supabase.co',
  anonKey: 'sb_publishable_12JB9bjtt7--L39VMwVrUg__gnhlqfA'
};

const SupabaseClient = {
  _client: null,
  _currentPlayer: null, // { id, username }
  _initialized: false,

  /** SQL to run in Supabase SQL Editor */
  SCHEMA_SQL: `
-- Players table
CREATE TABLE IF NOT EXISTS public.players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scores table (leaderboard entries)
CREATE TABLE IF NOT EXISTS public.scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  total_attempted INTEGER NOT NULL DEFAULT 0,
  level_id INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'learn',
  streak INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_scores_score ON public.scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_correct ON public.scores(correct_count DESC);
CREATE INDEX IF NOT EXISTS idx_scores_created ON public.scores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_mode ON public.scores(mode);

-- Enable Row Level Security (optional, public read / authenticated insert)
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Allow public reads
DROP POLICY IF EXISTS "Allow public read players" ON public.players;
CREATE POLICY "Allow public read players" ON public.players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert players" ON public.players;
CREATE POLICY "Allow public insert players" ON public.players FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read scores" ON public.scores;
CREATE POLICY "Allow public read scores" ON public.scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert scores" ON public.scores;
CREATE POLICY "Allow public insert scores" ON public.scores FOR INSERT WITH CHECK (true);
`,

  /** Initialize — load supabase-js from CDN and set up client */
  async init(config) {
    if (this._initialized) return;

    const url = (config && config.url) || SUPABASE_CONFIG.url;
    const key = (config && config.anonKey) || SUPABASE_CONFIG.anonKey;

    if (!url || url.includes('YOUR_PROJECT')) {
      console.warn('SupabaseClient: No valid Supabase URL configured. Using localStorage fallback.');
      this._useLocalFallback = true;
      this._localData = this._loadLocal();
      this._initialized = true;
      return;
    }

    try {
      // Load supabase-js from CDN
      if (typeof supabase === 'undefined') {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load supabase-js'));
          document.head.appendChild(script);
        });
      }

      this._client = supabase.createClient(url, key, {
        auth: { persistSession: false }
      });

      // Quick connectivity test
      const { error } = await this._client.from('players').select('id').limit(1);
      if (error && error.code === '42P01') {
        console.warn('SupabaseClient: Tables not found. Run the SCHEMA_SQL in Supabase SQL Editor.');
      }

      this._initialized = true;
      this._useLocalFallback = false;
      console.log('SupabaseClient: Connected');
    } catch (e) {
      console.warn('SupabaseClient: Init failed, using localStorage fallback:', e.message);
      this._useLocalFallback = true;
      this._localData = this._loadLocal();
      this._initialized = true;
    }
  },

  /** Get or create a player by username */
  async getOrCreatePlayer(username) {
    const trimmed = username.trim();
    if (!trimmed) throw new Error('Username is required');

    if (this._useLocalFallback) {
      const players = this._localData.players;
      let player = players.find(p => p.username.toLowerCase() === trimmed.toLowerCase());
      if (!player) {
        player = { id: 'local_' + Date.now(), username: trimmed, created_at: new Date().toISOString() };
        players.push(player);
      }
      this._currentPlayer = player;
      this._saveLocal();
      return player;
    }

    // Try to find existing player
    const { data: existing } = await this._client
      .from('players')
      .select('id, username, created_at')
      .ilike('username', trimmed)
      .maybeSingle();

    if (existing) {
      this._currentPlayer = existing;
      return existing;
    }

    // Create new player
    const { data: newPlayer, error } = await this._client
      .from('players')
      .insert({ username: trimmed })
      .select('id, username, created_at')
      .single();

    if (error) throw error;
    this._currentPlayer = newPlayer;
    return newPlayer;
  },

  /** Save a game score to the leaderboard */
  async saveScore(scoreData) {
    if (!this._currentPlayer) throw new Error('No player logged in');

    const entry = {
      player_id: this._currentPlayer.id,
      username: this._currentPlayer.username,
      score: scoreData.score || 0,
      correct_count: scoreData.correctCount || 0,
      total_attempted: scoreData.totalAttempted || 0,
      level_id: scoreData.levelId || 0,
      mode: scoreData.mode || 'learn',
      streak: scoreData.streak || 0
    };

    if (this._useLocalFallback) {
      this._localData.scores.push({ ...entry, id: 'local_' + Date.now(), created_at: new Date().toISOString() });
      this._saveLocal();
      return entry;
    }

    const { error } = await this._client.from('scores').insert(entry);
    if (error) throw error;
  },

  /** Get leaderboard — top 10 by score (for time/learn mode) */
  async getLeaderboardByScore(limit = 10) {
    if (this._useLocalFallback) {
      const scores = this._localData.scores.filter(s => s.mode !== 'rank');
      const grouped = {};
      for (const s of scores) {
        const key = s.username;
        if (!grouped[key] || s.score > grouped[key].score) {
          grouped[key] = s;
        }
      }
      return Object.values(grouped)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s, i) => ({ rank: i + 1, ...s }));
    }

    // Get best score per player (non-rank mode)
    const { data, error } = await this._client
      .rpc('get_leaderboard_by_score', { limit_count: limit });

    if (error) {
      // Fallback: raw query
      const { data: raw } = await this._client
        .from('scores')
        .select('username, score, correct_count, mode, level_id, created_at')
        .neq('mode', 'rank')
        .order('score', { ascending: false })
        .limit(50);

      if (!raw) return [];

      // Deduplicate: keep best score per player
      const best = new Map();
      for (const s of raw) {
        if (!best.has(s.username) || s.score > best.get(s.username).score) {
          best.set(s.username, s);
        }
      }
      return Array.from(best.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s, i) => ({ rank: i + 1, ...s }));
    }

    return (data || []).map((s, i) => ({ rank: i + 1, ...s }));
  },

  /** Get leaderboard — top 10 by correct count */
  async getLeaderboardByCorrect(limit = 10) {
    if (this._useLocalFallback) {
      const scores = this._localData.scores.filter(s => s.mode !== 'rank');
      const grouped = {};
      for (const s of scores) {
        const key = s.username;
        if (!grouped[key] || s.correct_count > grouped[key].correct_count) {
          grouped[key] = s;
        }
      }
      return Object.values(grouped)
        .sort((a, b) => b.correct_count - a.correct_count)
        .slice(0, limit)
        .map((s, i) => ({ rank: i + 1, ...s }));
    }

    const { data, error } = await this._client
      .rpc('get_leaderboard_by_correct', { limit_count: limit });

    if (error) {
      const { data: raw } = await this._client
        .from('scores')
        .select('username, score, correct_count, mode, level_id, created_at')
        .neq('mode', 'rank')
        .order('correct_count', { ascending: false })
        .limit(50);

      if (!raw) return [];

      const best = new Map();
      for (const s of raw) {
        if (!best.has(s.username) || s.correct_count > best.get(s.username).correct_count) {
          best.set(s.username, s);
        }
      }
      return Array.from(best.values())
        .sort((a, b) => b.correct_count - a.correct_count)
        .slice(0, limit)
        .map((s, i) => ({ rank: i + 1, ...s }));
    }

    return (data || []).map((s, i) => ({ rank: i + 1, ...s }));
  },

  /** Get Rank Mode leaderboard — Top 8 by score */
  async getLeaderboardRank(limit = 8) {\n    if (this._useLocalFallback) {\n      const scores = this._localData.scores.filter(s => s.mode === 'rank');\n      const grouped = {};\n      for (const s of scores) {\n        const key = s.username;\n        if (!grouped[key] || s.score > grouped[key].score) {\n          grouped[key] = s;\n        }\n      }\n      return Object.values(grouped)\n        .sort((a, b) => b.score - a.score)\n        .slice(0, limit)\n        .map((s, i) => ({ rank: i + 1, ...s }));\n    }\n\n    const { data, error } = await this._client\n      .rpc('get_leaderboard_rank_mode', { limit_count: limit });\n\n    if (error) {\n      // Fallback: raw query\n      const { data: raw } = await this._client\n        .from('scores')\n        .select('username, score, streak, correct_count, created_at')\n        .eq('mode', 'rank')\n        .order('score', { ascending: false })\n        .limit(50);\n\n      if (!raw) return [];\n\n      // Deduplicate: keep best score per player\n      const best = new Map();\n      for (const s of raw) {\n        if (!best.has(s.username) || s.score > best.get(s.username).score) {\n          best.set(s.username, s);\n        }\n      }\n      return Array.from(best.values())\n        .sort((a, b) => b.score - a.score)\n        .slice(0, limit)\n        .map((s, i) => ({ rank: i + 1, ...s }));\n    }\n\n    return (data || []).map((s, i) => ({ rank: i + 1, ...s }));\n  },\n\n  /** Get player's rank in Rank Mode */\n  async getPlayerRankMode(username) {\n    if (this._useLocalFallback) {\n      const rankScores = this._localData.scores.filter(s => s.mode === 'rank');\n      const grouped = {};\n      for (const s of rankScores) {\n        const key = s.username;\n        if (!grouped[key] || s.score > grouped[key].score) {\n          grouped[key] = s;\n        }\n      }\n      const sorted = Object.values(grouped).sort((a, b) => b.score - a.score);\n      const playerScore = grouped[username]?.score || -1;\n      const rank = sorted.findIndex(s => s.score === playerScore) + 1 || null;\n      return { playerRank: rank > 0 ? rank : null, totalPlayers: Object.keys(grouped).length };\n    }\n\n    const { data, error } = await this._client\n      .rpc('get_player_rank_mode', { player_username: username });\n\n    if (error || !data || data.length === 0) {\n      return { playerRank: null, totalPlayers: 0 };\n    }\n\n    return { playerRank: data[0].player_rank, totalPlayers: data[0].total_players };\n  },\n\n  /** Get total players in Rank Mode */\n  async getTotalPlayersRankMode() {\n    if (this._useLocalFallback) {\n      const rankScores = this._localData.scores.filter(s => s.mode === 'rank');\n      const uniqueUsers = new Set(rankScores.map(s => s.username));\n      return uniqueUsers.size;\n    }\n\n    try {\n      const { data } = await this._client\n        .from('scores')\n        .select('username')\n        .eq('mode', 'rank');\n\n      if (!data) return 0;\n      const unique = new Set(data.map(s => s.username));\n      return unique.size;\n    } catch (e) {\n      return 0;\n    }\n  },\n\n  /** Get player's own best score and rank */\n  async getPlayerRank(username) {\n    const byScore = await this.getLeaderboardByScore(100);\n    const byCorrect = await this.getLeaderboardByCorrect(100);\n\n    const scoreRank = byScore.findIndex(s => s.username.toLowerCase() === username.toLowerCase());\n    const correctRank = byCorrect.findIndex(s => s.username.toLowerCase() === username.toLowerCase());\n\n    return {\n      score: scoreRank >= 0 ? byScore[scoreRank] : null,\n      scoreRank: scoreRank >= 0 ? scoreRank + 1 : null,\n      correct: correctRank >= 0 ? byCorrect[correctRank] : null,\n      correctRank: correctRank >= 0 ? correctRank + 1 : null\n    };\n  },\n\n  /** Check if current player has a new personal best */\n  async isNewPersonalBest(score, mode) {\n    if (!this._currentPlayer) return true;\n    if (this._useLocalFallback) {\n      const playerScores = this._localData.scores.filter(\n        s => s.player_id === this._currentPlayer.id && s.mode === mode\n      );\n      if (playerScores.length === 0) return true;\n      const best = Math.max(...playerScores.map(s => s.score));\n      return score > best;\n    }\n\n    const { data } = await this._client\n      .from('scores')\n      .select('score')\n      .eq('player_id', this._currentPlayer.id)\n      .eq('mode', mode)\n      .order('score', { ascending: false })\n      .limit(1);\n\n    if (!data || data.length === 0) return true;\n    return score > data[0].score;\n  },\n\n  // ---- LocalStorage fallback ----\n  _loadLocal() {\n    try {\n      const raw = localStorage.getItem('chemblast_data');\n      if (raw) return JSON.parse(raw);\n    } catch (e) { /* ignore */ }\n    return { players: [], scores: [] };\n  },\n\n  _saveLocal() {\n    try {\n      localStorage.setItem('chemblast_data', JSON.stringify(this._localData));\n    } catch (e) { /* ignore */ }\n  }\n};\n