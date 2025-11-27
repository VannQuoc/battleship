const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const socketHandler = require('./src/network/socketHandler');
require('dotenv').config();

const app = express();

// CORS middleware - Allow all origins for API routes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow all origins (if origin is present, use it; otherwise allow all)
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json()); // For parsing JSON request bodies
app.use(express.urlencoded({ extended: true })); // For form data
app.use(express.static(path.join(__dirname, '../client/dist')));

// API Routes (before catch-all route)
const fs = require('fs');
const configPath = path.join(__dirname, '../shared/gameConfig.json');
const adminAuth = require('./src/auth/adminAuth');

// Admin authentication middleware
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.substring(7);
  // Simple token = base64(username:password)
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [username, password] = decoded.split(':');
    if (!adminAuth.verifyPassword(username, password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.adminUsername = username;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/config - Read game config (public)
app.get('/api/config', (req, res) => {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.json(config);
  } catch (error) {
    console.error('Error reading config:', error);
    res.status(500).json({ error: 'Failed to read config' });
  }
});

// PUT /api/config - Update game config (admin only)
app.put('/api/config', requireAdmin, (req, res) => {
  try {
    const newConfig = req.body;
    // Validate config structure
    if (!newConfig.constants || !newConfig.units || !newConfig.items) {
      return res.status(400).json({ error: 'Invalid config structure' });
    }
    // Write to file
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
    
    // Reload config in server
    const definitions = require('./src/config/definitions');
    if (definitions.reload) {
      definitions.reload();
    }
    
    res.json({ success: true, message: 'Config updated successfully' });
  } catch (error) {
    console.error('Error writing config:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// POST /api/admin/login - Admin login
app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    if (adminAuth.verifyPassword(username, password)) {
      // Return token (base64 encoded username:password)
      const token = Buffer.from(`${username}:${password}`).toString('base64');
      res.json({ success: true, token });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error in admin login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/admin/change-password - Change admin password (admin only)
app.post('/api/admin/change-password', requireAdmin, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old and new password required' });
    }
    const result = adminAuth.changePassword(req.adminUsername, oldPassword, newPassword);
    if (result.success) {
      res.json({ success: true, message: 'Password changed successfully' });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Catch-all route for client-side routing (must be last)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const server = http.createServer(app);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN }
});

socketHandler(io);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Battleship LAN Server running on ${HOST}:${PORT}`);
  console.log('Ready for Production Usage.');
});