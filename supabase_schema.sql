-- =============================================
-- Chem Blast - Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- =============================================

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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_scores_score ON public.scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_correct ON public.scores(correct_count DESC);
CREATE INDEX IF NOT EXISTS idx_scores_created ON public.scores(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Allow public reads and inserts (no auth required)
DROP POLICY IF EXISTS "Allow public read players" ON public.players;
CREATE POLICY "Allow public read players" ON public.players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert players" ON public.players;
CREATE POLICY "Allow public insert players" ON public.players FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read scores" ON public.scores;
CREATE POLICY "Allow public read scores" ON public.scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert scores" ON public.scores;
CREATE POLICY "Allow public insert scores" ON public.scores FOR INSERT WITH CHECK (true);
