// server/src/auth/adminAuth.js
// Admin authentication with MD5 password hashing

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const adminCredentialsPath = path.join(__dirname, '../../../shared/adminCredentials.json');

// Default admin credentials: admin/admin
// MD5 hash of "admin" = 21232f297a57a5a743894a0e4a801fc3
const DEFAULT_CREDENTIALS = {
  username: 'admin',
  passwordHash: '21232f297a57a5a743894a0e4a801fc3' // MD5 of "admin"
};

function md5Hash(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

function loadCredentials() {
  try {
    if (fs.existsSync(adminCredentialsPath)) {
      const data = fs.readFileSync(adminCredentialsPath, 'utf8');
      return JSON.parse(data);
    }
    // Create default credentials file
    saveCredentials(DEFAULT_CREDENTIALS);
    return DEFAULT_CREDENTIALS;
  } catch (error) {
    console.error('[AdminAuth] Error loading credentials:', error);
    return DEFAULT_CREDENTIALS;
  }
}

function saveCredentials(credentials) {
  try {
    // Ensure directory exists
    const dir = path.dirname(adminCredentialsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(adminCredentialsPath, JSON.stringify(credentials, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('[AdminAuth] Error saving credentials:', error);
    return false;
  }
}

function verifyPassword(username, password) {
  const credentials = loadCredentials();
  if (credentials.username !== username) {
    return false;
  }
  const passwordHash = md5Hash(password);
  return credentials.passwordHash === passwordHash;
}

function changePassword(username, oldPassword, newPassword) {
  const credentials = loadCredentials();
  if (credentials.username !== username) {
    return { success: false, error: 'Invalid username' };
  }
  if (!verifyPassword(username, oldPassword)) {
    return { success: false, error: 'Invalid old password' };
  }
  credentials.passwordHash = md5Hash(newPassword);
  if (saveCredentials(credentials)) {
    return { success: true };
  }
  return { success: false, error: 'Failed to save new password' };
}

module.exports = {
  verifyPassword,
  changePassword,
  loadCredentials,
  md5Hash
};

