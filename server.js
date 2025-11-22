// server.js

// === Dependencies and Setup ===
// 1. Load environment variables from .env file
require('dotenv').config(); 

const express = require('express');
const path = require('path'); // Used for resolving file paths
const { Pool } = require('pg');
const { customAlphabet } = require('nanoid'); 

// Function to generate a random short code (7 alphanumeric characters)
const generateShortCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 7);

// Regex for code validation: 6-8 alphanumeric characters
const CODE_REGEX = /^[A-Za-z0-9]{6,8}$/; 

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON requests
app.use(express.json());

// Tell Express to serve the frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));


// === Database Connection Pool ===
const pool = new Pool({
    // IMPORTANT: This line reads the secret connection string from the .env file!
    connectionString: process.env.DATABASE_URL, 
    ssl: {
        rejectUnauthorized: false // Required for some cloud-hosted Postgres
    }
});

pool.on('connect', () => {
    console.log('Successfully connected to the PostgreSQL database.');
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1); 
});


// ===================================
// CORE APPLICATION ROUTES (Pages & Redirect)
// ===================================

// === Redirect Route: /:code (302 Redirect) ===
/**
 * Visiting /{code} performs an HTTP 302 redirect to the original URL.
 * [cite_start]Each redirect increments the total-click count and updates the "last clicked" time. [cite: 25, 26]
 * [cite_start]Returns 404 if link not found. [cite: 29]
 */
app.get('/:code', async (req, res) => {
    const { code } = req.params;

    try {
        // 1. Find the link by short_code
        const selectQuery = 'SELECT target_url FROM links WHERE short_code = $1;';
        const result = await pool.query(selectQuery, [code]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Link not found.' });
        }

        const { target_url } = result.rows[0];

        // 2. Update clicks and last_clicked time
        const updateQuery = `
            UPDATE links
            SET total_clicks = total_clicks + 1,
                last_clicked = CURRENT_TIMESTAMP
            WHERE short_code = $1;
        `;
        await pool.query(updateQuery, [code]);

        // 3. Perform the HTTP 302 redirect
        res.redirect(302, target_url);

    } catch (error) {
        console.error('Database error during redirect:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// === Stats Page Route: /code/:code ===
/**
 * [cite_start]Serves the static stats.html page for the client-side JavaScript to render the stats. [cite: 39]
 */
app.get('/code/:code', (req, res) => {
    [cite_start]// Serves the stats page for viewing details of a single link. [cite: 39]
    res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});


// === Healthcheck Route: GET /healthz ===
/**
 * [cite_start]Returns status 200 with system details. [cite: 66]
 */
app.get('/healthz', (req, res) => {
    // Returns status 200
    res.status(200).json({ 
        "ok": true, 
        "version": "1.0", 
        "uptime": process.uptime() 
    });
});


// ===================================
// API Endpoints: /api/links
// ===================================

// === API 1: POST /api/links (Create link) ===
/**
 * [cite_start]Create link[cite: 70]. [cite_start]Returns 409 if code exists[cite: 70].
 */
app.post('/api/links', async (req, res) => {
    const { target_url, short_code } = req.body;

    [cite_start]// Validate the URL before saving. [cite: 22]
    if (!target_url) {
        return res.status(400).json({ error: 'Target URL is required.' });
    }

    let code = short_code ? short_code.trim() : generateShortCode();

    [cite_start]// Custom codes are globally unique; if a code already exists, show an error. [cite: 23]
    [cite_start]// Codes follow [A-Za-z0-9]{6,8}. [cite: 72]
    if (short_code && !CODE_REGEX.test(code)) {
        return res.status(400).json({ 
            error: 'Short code must be 6 to 8 alphanumeric characters.' 
        });
    }

    try {
        const query = `
            INSERT INTO links (short_code, target_url)
            VALUES ($1, $2)
            RETURNING short_code, target_url, total_clicks, created_at, last_clicked;
        `;
        const result = await pool.query(query, [code, target_url]);
        
        res.status(201).json(result.rows[0]);

    } catch (error) {
        [cite_start]// Return 409 if duplicate code exists. [cite: 75]
        if (error.code === '23505') {
            return res.status(409).json({ 
                error: `Short code "${code}" already exists.` 
            });
        }
        
        console.error('Database error during link creation:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// === API 2: GET /api/links (List all links) ===
/**
 * [cite_start]List all links[cite: 70].
 */
app.get('/api/links', async (req, res) => {
    try {
        const query = `
            SELECT 
                short_code, 
                target_url, 
                total_clicks, 
                created_at, 
                last_clicked
            FROM links
            ORDER BY created_at DESC;
        `;
        const result = await pool.query(query);
        
        res.status(200).json(result.rows);

    } catch (error) {
        console.error('Database error during link listing:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// === API 3: GET /api/links/:code (Stats for one code) ===
/**
 * [cite_start]Stats for one code[cite: 70].
 */
app.get('/api/links/:code', async (req, res) => {
    const { code } = req.params;

    try {
        const query = `
            SELECT 
                short_code, 
                target_url, 
                total_clicks, 
                created_at, 
                last_clicked
            FROM links
            WHERE short_code = $1;
        `;
        const result = await pool.query(query, [code]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Link not found.' });
        }
        
        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error('Database error during link stats retrieval:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// === API 4: DELETE /api/links/:code (Delete link) ===
/**
 * [cite_start]Delete link[cite: 70]. [cite_start]After deletion, /{code} must return 404 and no longer redirect. [cite: 29]
 */
app.delete('/api/links/:code', async (req, res) => {
    const { code } = req.params;

    try {
        const query = 'DELETE FROM links WHERE short_code = $1 RETURNING short_code;';
        const result = await pool.query(query, [code]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Link not found or already deleted.' });
        }
        
        // Success: 204 No Content is standard for successful deletion
        res.status(204).send();

    } catch (error) {
        console.error('Database error during link deletion:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});


// === Start the Server ===
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});