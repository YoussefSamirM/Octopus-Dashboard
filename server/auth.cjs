const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

let sheets;
try {
  // Initialize Google Sheets API using Service Account
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  sheets = google.sheets({ version: 'v4', auth });
} catch (error) {
  console.error("Warning: Failed to initialize GoogleAuth. Check ENV vars.", error.message);
}

/**
 * Checks if the given email exists in the Google Sheet whitelist.
 * @param {string} email
 * @returns {Promise<boolean>}
 */
async function checkEmailInWhitelist(email) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Users_Whitelist!A:A', // Assumes emails are in Column A
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return false;
    }

    // Check if the email exists in any row of Column A
    return rows.some(row => row[0] && row[0].toLowerCase() === email.toLowerCase());
  } catch (error) {
    console.error('Error checking Google Sheets whitelist:', error);
    // Fail closed for security
    return false;
  }
}

/**
 * Express handler for Google OAuth login
 */
const googleAuthHandler = async (req, res) => {
  try {
    if (!JWT_SECRET) {
      console.error("Backend Error: Missing JWT_SECRET.");
      return res.status(500).json({ error: 'Server configuration missing. Please check .env file.' });
    }
    
    // [TEMPORARILY DISABLED BY REQUEST]
    // if (!SHEET_ID || SHEET_ID === 'insert_your_sheet_id_here') {
    //   return res.status(400).json({ error: 'Please add your GOOGLE_SHEET_ID to the .env file to enable whitelist verification.' });
    // }

    // if (!sheets || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL === 'insert_your_service_account_email_here') {
    //   return res.status(400).json({ error: 'Please add your Google Service Account credentials to the .env file.' });
    // }

    const { access_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ error: 'Missing Google access_token' });
    }

    // 1. Fetch user info using the access_token
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    
    if (!userInfoResponse.ok) {
      return res.status(401).json({ error: 'Failed to verify Google access token' });
    }

    const payload = await userInfoResponse.json();
    const email = payload.email.toLowerCase();

    // 2. Strict Domain Check [TEMPORARILY DISABLED]
    // if (!email.endsWith('@talabat.com')) {
    //   return res.status(401).json({ error: 'Unauthorized domain. Only @talabat.com is allowed.' });
    // }

    // 3. Google Sheets Whitelist Check [TEMPORARILY DISABLED]
    // const isWhitelisted = await checkEmailInWhitelist(email);
    // if (!isWhitelisted) {
    //   return res.status(401).json({ error: 'Email is not on the approved whitelist.' });
    // }

    // 4. Generate Custom JWT for our backend
    const token = jwt.sign(
      { 
        email: email, 
        name: payload.name, 
        picture: payload.picture 
      },
      JWT_SECRET,
      { expiresIn: '8h' } // Token expires in 8 hours
    );

    res.json({ token, user: { email, name: payload.name, picture: payload.picture } });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ error: 'Authentication failed.' });
  }
};

module.exports = { googleAuthHandler };
