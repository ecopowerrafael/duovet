const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./auth');
const db = require('./db');
const fetch = require('node-fetch');

// Helper to refresh Google Token
async function getValidAccessToken(userId) {
  const result = await db.query(
    'SELECT google_access_token, google_refresh_token, google_token_expiry FROM users WHERE id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) return null;
  const user = result.rows[0];
  
  if (!user.google_access_token) return null;
  
  // If token is still valid (with 5 min buffer)
  if (user.google_token_expiry && new Date(user.google_token_expiry) > new Date(Date.now() + 300000)) {
    return user.google_access_token;
  }
  
  // Token expired, need refresh
  if (!user.google_refresh_token) return null;
  
  console.log(`Refreshing Google token for user ${userId}...`);
  
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: user.google_refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    
    const data = await response.json();
    
    if (data.error) {
      console.error('Error refreshing token:', data);
      return null;
    }
    
    const newExpiry = new Date(Date.now() + (data.expires_in - 100) * 1000);
    
    await db.query(
      'UPDATE users SET google_access_token = $1, google_token_expiry = $2 WHERE id = $3',
      [data.access_token, newExpiry, userId]
    );
    
    return data.access_token;
  } catch (err) {
    console.error('Failed to refresh Google token:', err);
    return null;
  }
}

// Sync single event helper
async function syncEventToGoogle(eventId, userId, userEmail) {
  try {
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      console.warn(`User ${userId} not connected to Google Calendar. Skipping sync.`);
      return { skipped: true, error: 'Not connected' };
    }
    
    // Fetch event details and check ownership
    let query = 'SELECT * FROM events WHERE id = $1';
    const params = [eventId];

    if (userEmail && userEmail !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(userEmail);
    }

    const eventResult = await db.query(query, params);
    if (eventResult.rows.length === 0) return { error: 'Event not found or access denied' };
    const event = eventResult.rows[0];
    
    // Prepare Google Event
    const googleEvent = {
      summary: event.title,
      description: event.notes || '',
      start: {
        dateTime: new Date(event.start_datetime).toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: new Date(event.end_datetime).toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      location: event.location || '',
      colorId: event.event_type === 'atendimento' ? '10' : '7',
    };
    
    let googleResponse;
    if (event.google_event_id) {
      // Update
      googleResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.google_event_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googleEvent),
      });
    } else {
      // Create
      googleResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googleEvent),
      });
    }
    
    if (!googleResponse.ok) {
      const errorData = await googleResponse.json();
      console.error('Failed to sync with Google:', errorData);
      return { error: 'Failed to sync with Google', details: errorData };
    }
    
    const googleData = await googleResponse.json();
    
    // Update local event
    await db.query(
      'UPDATE events SET google_event_id = $1, is_synced = true, sync_pending = false WHERE id = $2',
      [googleData.id, eventId]
    );
    
    return { success: true, google_event_id: googleData.id };
  } catch (err) {
    console.error('Sync error helper:', err);
    return { error: 'Internal server error during sync' };
  }
}

// Sync single event
router.post('/sync/:id', authMiddleware, async (req, res, next) => {
  try {
    const result = await syncEventToGoogle(req.params.id, req.user.id, req.user.email);
    if (result.error) {
      const status = result.error === 'Event not found or access denied' ? 404 : 500;
      return res.status(status).json(result);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Bulk sync unsynced events
router.post('/sync-all', authMiddleware, async (req, res, next) => {
  const userId = req.user.id;
  const userEmail = req.user.email;
  
  try {
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) return res.status(401).json({ error: 'Google Calendar not connected.' });
    
    // Fetch unsynced events for this user
    let query = 'SELECT id FROM events WHERE (is_synced = false OR is_synced IS NULL)';
    const params = [];

    if (userEmail && userEmail !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($1)';
      params.push(userEmail);
    }

    const unsyncedResult = await db.query(query, params);
    
    const results = { synced: 0, failed: 0 };
    for (const row of unsyncedResult.rows) {
      const syncResult = await syncEventToGoogle(row.id, userId, userEmail);
      if (syncResult.success) {
        results.synced++;
      } else if (!syncResult.skipped) {
        results.failed++;
      }
    }
    
    res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
});

// Remove sync helper
async function unsyncEventFromGoogle(eventId, userId, userEmail) {
  try {
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      console.warn(`User ${userId} not connected to Google Calendar. Skipping unsync.`);
      return { skipped: true, error: 'Not connected' };
    }
    
    let query = 'SELECT google_event_id FROM events WHERE id = $1';
    const params = [eventId];

    if (userEmail && userEmail !== 'admin@duovet.app') {
      query += ' AND LOWER(created_by) = LOWER($2)';
      params.push(userEmail);
    }

    const eventResult = await db.query(query, params);
    if (eventResult.rows.length === 0) return { error: 'Event not found or access denied' };
    const { google_event_id } = eventResult.rows[0];
    
    if (google_event_id) {
      const googleResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${google_event_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      if (!googleResponse.ok && googleResponse.status !== 404) {
        const errorData = await googleResponse.json();
        console.error('Failed to delete from Google:', errorData);
        return { error: 'Failed to delete from Google', details: errorData };
      }
    }
    
    // Update local event
    await db.query(
      'UPDATE events SET google_event_id = NULL, is_synced = false, sync_pending = false WHERE id = $1',
      [eventId]
    );
    
    return { success: true };
  } catch (err) {
    console.error('Unsync error helper:', err);
    throw err; // Re-throw to be caught by the route handler
  }
}

// Remove sync
router.delete('/sync/:id', authMiddleware, async (req, res, next) => {
  try {
    const result = await unsyncEventFromGoogle(req.params.id, req.user.id, req.user.email);
    if (result.error) {
      const status = result.error === 'Event not found or access denied' ? 404 : 500;
      return res.status(status).json(result);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = { 
  router,
  syncEventToGoogle,
  unsyncEventFromGoogle
};
