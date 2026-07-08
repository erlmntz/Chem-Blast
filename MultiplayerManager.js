/**
 * MultiplayerManager – 1v1 matchmaking and match management via Supabase
 */
class MultiplayerManager {
  constructor() {
    this._queueId = null;
    this._matchId = null;
    this._matchData = null;
    this._subscription = null;
    this._onMatchFound = null;
    this._onMatchUpdate = null;
    this._onMatchEnd = null;
    this._isInQueue = false;
    this._isInMatch = false;
    this._pollInterval = null;
  }

  /**
   * Enter the matchmaking queue
   * @param {string} playerId - UUID from Supabase
   * @param {string} username
   * @param {Function} onMatchFound - callback(matchData)
   * @param {Function} onMatchUpdate - callback(matchData)
   * @param {Function} onMatchEnd - callback(matchData)
   */
  async joinQueue(playerId, username, onMatchFound, onMatchUpdate, onMatchEnd) {
    if (this._isInQueue || this._isInMatch) return;

    this._onMatchFound = onMatchFound;
    this._onMatchUpdate = onMatchUpdate;
    this._onMatchEnd = onMatchEnd;

    // Create queue entry
    const { data, error } = await SupabaseClient._client
      .from('matchmaking_queue')
      .insert({ player_id: playerId, username, status: 'waiting' })
      .select('id')
      .single();

    if (error) throw error;

    this._queueId = data.id;
    this._isInQueue = true;

    // Subscribe to queue updates (to detect when we are matched)
    this._subscribeQueue();

    // Start polling for match (fallback if realtime fails)
    this._startPolling(playerId);
  }

  _subscribeQueue() {
    if (this._subscription) return;
    this._subscription = SupabaseClient._client
      .channel('matchmaking')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matchmaking_queue',
          filter: `id=eq.${this._queueId}`
        },
        (payload) => {
          const record = payload.new;
          if (record.status === 'matched') {
            // We've been matched! Fetch the match details
            this._fetchMatch(record.match_id);
          }
        }
      )
      .subscribe();
  }

  _startPolling(playerId) {
    if (this._pollInterval) clearInterval(this._pollInterval);
    this._pollInterval = setInterval(async () => {
      if (!this._isInQueue) {
        clearInterval(this._pollInterval);
        return;
      }
      try {
        const { data } = await SupabaseClient._client
          .from('matchmaking_queue')
          .select('status, match_id')
          .eq('id', this._queueId)
          .single();

        if (data && data.status === 'matched') {
          this._fetchMatch(data.match_id);
          clearInterval(this._pollInterval);
        }
      } catch (e) { /* ignore */ }
    }, 2000);
  }

  async _fetchMatch(matchId) {
    const { data, error } = await SupabaseClient._client
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (error) return;

    this._matchId = matchId;
    this._matchData = data;
    this._isInQueue = false;
    this._isInMatch = true;

    // Unsubscribe from queue
    if (this._subscription) {
      this._subscription.unsubscribe();
      this._subscription = null;
    }

    // Subscribe to match updates
    this._subscribeMatch();

    if (this._onMatchFound) this._onMatchFound(data);
  }

  _subscribeMatch() {
    if (this._matchSubscription) return;
    this._matchSubscription = SupabaseClient._client
      .channel('match-' + this._matchId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${this._matchId}`
        },
        (payload) => {
          const updated = payload.new;
          this._matchData = updated;
          if (updated.status === 'finished') {
            if (this._onMatchEnd) this._onMatchEnd(updated);
            this.leaveMatch();
          } else {
            if (this._onMatchUpdate) this._onMatchUpdate(updated);
          }
        }
      )
      .subscribe();
  }

  /**
   * Update match progress (called after each correct/attempt)
   */
  async updateMatch(playerId, score, correct, total) {
    if (!this._matchId || !this._isInMatch) return;

    const update = {};
    // Determine which player
    const isPlayer1 = this._matchData.player1_id === playerId;
    if (isPlayer1) {
      update.player1_score = score;
      update.player1_correct = correct;
      update.player1_total = total;
    } else {
      update.player2_score = score;
      update.player2_correct = correct;
      update.player2_total = total;
    }

    // Also update updated_at
    update.updated_at = new Date().toISOString();

    const { error } = await SupabaseClient._client
      .from('matches')
      .update(update)
      .eq('id', this._matchId);

    if (error) console.warn('Failed to update match:', error);
  }

  /**
   * Finish the match (called when both players finish or time runs out)
   */
  async finishMatch(winnerId) {
    if (!this._matchId || !this._isInMatch) return;
    const { error } = await SupabaseClient._client
      .from('matches')
      .update({ status: 'finished', winner: winnerId, updated_at: new Date().toISOString() })
      .eq('id', this._matchId);
    if (error) console.warn('Failed to finish match:', error);
  }

  /**
   * Leave match / clean up
   */
  leaveMatch() {
    this._isInQueue = false;
    this._isInMatch = false;
    if (this._queueId) {
      // Remove from queue
      SupabaseClient._client
        .from('matchmaking_queue')
        .update({ status: 'cancelled' })
        .eq('id', this._queueId)
        .then(() => {});
      this._queueId = null;
    }
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
    if (this._subscription) {
      this._subscription.unsubscribe();
      this._subscription = null;
    }
    if (this._matchSubscription) {
      this._matchSubscription.unsubscribe();
      this._matchSubscription = null;
    }
    this._matchId = null;
    this._matchData = null;
  }
}

// Singleton
const Multiplayer = new MultiplayerManager();