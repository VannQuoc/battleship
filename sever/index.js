const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const socketHandler = require('./src/network/socketHandler');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

socketHandler(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Battleship LAN Server running on port ${PORT}`);
  console.log('Ready for Production Usage.');
});