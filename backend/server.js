const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const dotenv = require("dotenv");
const colors = require("colors"); // For colored console logs

const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

// Load environment variables
dotenv.config({ path: __dirname + "/.env" });

console.log("🔍 MONGO_URI:", process.env.MONGO_URI || "Not Defined");

const PORT = process.env.PORT || 4000;

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();
app.use(express.json()); // Accept JSON data

// Routes
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

// -------------------------- Deployment ------------------------------
const __dirname1 = path.resolve();
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "/frontend/build")));
  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("🚀 API is running...");
  });
}
// -------------------------- Deployment ------------------------------

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

// Create HTTP server and attach socket.io
const server = http.createServer(app);
const io = socketIo(server, {
  pingTimeout: 60000,
  cors: { origin: "http://localhost:3000" },
});

// -------------------------- Socket.io Logic ------------------------------
io.on("connection", (socket) => {
  console.log("⚡ New client connected to socket.io");

  socket.on("setup", (userData) => {
    if (!userData?._id) return;
    socket.join(userData._id);
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log(`📢 User Joined Room: ${room}`);
  });

  socket.on("typing", (room) => socket.to(room).emit("typing"));
  socket.on("stop typing", (room) => socket.to(room).emit("stop typing"));

  socket.on("new message", (newMessageRecieved) => {
    if (!newMessageRecieved?.chat?.users) return console.error("⚠️ chat.users not defined");

    newMessageRecieved.chat.users.forEach((user) => {
      if (user._id === newMessageRecieved.sender._id) return;
      socket.to(user._id).emit("message received", newMessageRecieved);
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected from socket.io");
  });
});

// -------------------------- Start Server ------------------------------
server.listen(PORT, () => {
  console.log(`🚀 Server running on PORT ${PORT}...`.yellow.bold);
});
