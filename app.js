import dotenv from 'dotenv';
import 'express-async-errors';
import EventEmitter from 'events';
import express from 'express';
import http from 'http';
import { Server as socketIo } from 'socket.io'; 
import connectDB from './config/connect.js';
import notFoundMiddleware from './middleware/not-found.js';
import errorHandlerMiddleware from './middleware/error-handler.js';
import authMiddleware from './middleware/authentication.js';

// Routers
import authRouter from './routes/auth.js';
import rideRouter from './routes/ride.js';
import ratingRouter from './routes/rating.js';
import adminRouter from './routes/admin.js';

// Import socket handler
import handleSocketConnection from './controllers/sockets.js';

dotenv.config();

EventEmitter.defaultMaxListeners = 20;

const app = express();
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const server = http.createServer(app);

const io = new socketIo(server, { cors: { origin: "*" } });

// Attach the WebSocket instance to the request object
app.use((req, res, next) => {
  req.io = io;
  return next();
});

// Initialize the WebSocket handling logic
handleSocketConnection(io);

// Routes
app.use("/auth", authRouter);
app.use("/ride", authMiddleware, rideRouter);
app.use("/rating", authMiddleware, ratingRouter);
app.use("/admin", adminRouter);

// Middleware
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, "0.0.0.0", () =>
      console.log(`HTTP server is running on port http://localhost:${PORT}`)
    );
  } catch (error) {
    console.log(error);
  }
};

start();
