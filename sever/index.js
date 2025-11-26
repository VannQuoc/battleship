const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const socketHandler = require('./src/network/socketHandler');
require('dotenv').config();

const app = express();
app.use(express.static(path.join(__dirname, '../client/dist')));
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