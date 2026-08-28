const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const uri = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

const app = express();

const clientUrl = process.env.CLIENT_URL 
  ? process.env.CLIENT_URL.replace(/\/$/, "") 
  : "https://studybook-sand.vercel.app";

// 1. CORS Setup
const allowedOrigins = [
  clientUrl,
  "https://studybook-sand.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || origin.includes("localhost")) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"],
  })
);

app.options("*", cors());
app.use(express.json());

// 2. Serverless Friendly MongoDB Connection With Timeout (হ্যাং হওয়া রোধ করবে)
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!uri) {
    throw new Error("MONGODB_URI is not defined in environment variables.");
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    connectTimeoutMS: 5000, // ৫ সেকেন্ডের বেশি কানেকশনে সময় নিলে ক্যানসেল করবে
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  const db = client.db("studynook");

  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

const getJWKS = () => {
  if (!clientUrl) return null;
  try {
    return createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));
  } catch (err) {
    return null;
  }
};

// 3. Fast Verification Middleware (With Fetch Controller Timeout)
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    const hasValidToken = token && token !== "undefined" && token !== "null" && token.trim() !== "";
    const hasCookie = !!req.headers.cookie;

    if (!hasValidToken && !hasCookie) {
      return res.status(401).json({ message: "Unauthorized: Access denied, token or cookie missing" });
    }

    // ১. JWKS / JWT ভ্যালিডেশন
    if (hasValidToken) {
      try {
        const JWKS = getJWKS();
        if (JWKS) {
          const { payload } = await jwtVerify(token, JWKS, {
            algorithms: ["EdDSA", "RS256", "ES256", "HS256"],
          });
          if (payload) {
            req.user = payload;
            return next();
          }
        }
      } catch (jwtErr) {
        console.log("JWT Verification bypassed, checking session fallback...");
      }
    }

    // ২. Better Auth Session API (অতিরিক্ত ৩ সেকেন্ডের Timeout যুক্ত করা হলো)
    if (clientUrl) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // ৩ সেকেন্ডে রেসপন্স না পেলে Abort করবে

      try {
        const authRes = await fetch(`${clientUrl}/api/auth/get-session`, {
          headers: {
            cookie: req.headers.cookie || "",
            authorization: hasValidToken ? `Bearer ${token}` : "",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (authRes.ok) {
          const sessionData = await authRes.json();
          const currentUser = sessionData?.user || sessionData?.session?.user;

          if (currentUser) {
            req.user = currentUser;
            return next();
          }
        }
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        console.error("Session Fetch Timeout/Error:", fetchErr.message);
      }
    }

    return res.status(403).json({ message: "Forbidden: Token verification failed" });
  } catch (error) {
    console.error("Auth Middleware Error:", error.message);
    return res.status(403).json({ message: "Forbidden: Internal auth error" });
  }
};

const getUserIdentifier = (user) => {
  return user?.id || user?.sub || user?.email || null;
};

// Database connection injection middleware
app.use(async (req, res, next) => {
  try {
    const { db } = await connectToDatabase();
    req.db = db;
    next();
  } catch (err) {
    console.error("Database connection failed:", err.message);
    res.status(500).json({ message: "Database connection failed", error: err.message });
  }
});

// 4. API Routes
app.get("/featured", async (req, res) => {
  try {
    const roomsCollection = req.db.collection("rooms");
    const result = await roomsCollection.find().sort({ _id: -1 }).limit(6).toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch featured rooms" });
  }
});

app.get("/rooms", async (req, res) => {
  try {
    const roomsCollection = req.db.collection("rooms");
    const { search, amenity } = req.query;
    let query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    if (amenity) {
      query.amenities = { $in: [amenity] };
    }

    const result = await roomsCollection.find(query).toArray();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch rooms" });
  }
});

app.get("/rooms/my-rooms", verifyToken, async (req, res) => {
  try {
    const roomsCollection = req.db.collection("rooms");
    const userId = getUserIdentifier(req.user);
    const userEmail = req.user?.email;

    const result = await roomsCollection
      .find({
        $or: [{ ownerId: userId }, { userEmail: userEmail }],
      })
      .toArray();

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user listings" });
  }
});

app.get("/rooms/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const roomsCollection = req.db.collection("rooms");
    const result = await roomsCollection.findOne({ _id: new ObjectId(id) });
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: "Invalid Room ID" });
  }
});

app.post("/rooms", verifyToken, async (req, res) => {
  try {
    const roomsCollection = req.db.collection("rooms");
    const roomData = req.body;
    const userId = getUserIdentifier(req.user);

    const newRoom = {
      ...roomData,
      ownerId: userId,
      userEmail: req.user?.email || "",
      bookingCount: 0,
      createdAt: new Date(),
    };
    const result = await roomsCollection.insertOne(newRoom);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to create room", error: error.message });
  }
});

app.patch("/rooms/:id", verifyToken, async (req, res) => {
  try {
    const roomsCollection = req.db.collection("rooms");
    const { id } = req.params;
    const updatedData = req.body;
    const userId = getUserIdentifier(req.user);

    const room = await roomsCollection.findOne({ _id: new ObjectId(id) });
    if (!room || (room.ownerId !== userId && room.userEmail !== req.user?.email)) {
      return res.status(403).json({ message: "Forbidden: Not room owner" });
    }

    const result = await roomsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to update room" });
  }
});

app.delete("/rooms/:id", verifyToken, async (req, res) => {
  try {
    const roomsCollection = req.db.collection("rooms");
    const { id } = req.params;
    const userId = getUserIdentifier(req.user);

    const room = await roomsCollection.findOne({ _id: new ObjectId(id) });
    if (!room || (room.ownerId !== userId && room.userEmail !== req.user?.email)) {
      return res.status(403).json({ message: "Forbidden: Not room owner" });
    }

    const result = await roomsCollection.deleteOne({ _id: new ObjectId(id) });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to delete room" });
  }
});

app.get("/bookings/my-bookings", verifyToken, async (req, res) => {
  try {
    const bookingCollection = req.db.collection("bookings");
    const userId = getUserIdentifier(req.user);
    const userEmail = req.user?.email;

    const bookings = await bookingCollection
      .find({
        $or: [{ userId: userId }, { userEmail: userEmail }],
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching bookings", error: error.message });
  }
});

app.post("/bookings", verifyToken, async (req, res) => {
  try {
    const bookingCollection = req.db.collection("bookings");
    const roomsCollection = req.db.collection("rooms");
    const { roomId, roomName, date, startTime, endTime, totalCost } = req.body;
    const userId = getUserIdentifier(req.user);

    if (!roomId || !date || !startTime || !endTime) {
      return res.status(400).json({ message: "All booking details are required" });
    }

    const existingConflict = await bookingCollection.findOne({
      roomId,
      date,
      status: "confirmed",
      $or: [
        { startTime: { $lt: endTime, $gte: startTime } },
        { endTime: { $gt: startTime, $lte: endTime } },
      ],
    });

    if (existingConflict) {
      return res.status(400).json({ message: "Slot already booked for this room." });
    }

    const bookingData = {
      roomId,
      roomName: roomName || "Study Room",
      userId: userId,
      userEmail: req.user?.email || "",
      date,
      startTime,
      endTime,
      timeSlot: `${startTime} - ${endTime}`,
      totalCost: Number(totalCost) || 0,
      status: "confirmed",
      createdAt: new Date(),
    };

    const result = await bookingCollection.insertOne(bookingData);

    await roomsCollection.updateOne(
      { _id: new ObjectId(roomId) },
      { $inc: { bookingCount: 1 } }
    );

    res.status(201).json({ success: true, message: "Booking confirmed", result });
  } catch (error) {
    res.status(500).json({ message: "Failed to book room", error: error.message });
  }
});

app.patch("/bookings/:id", verifyToken, async (req, res) => {
  try {
    const bookingCollection = req.db.collection("bookings");
    const { id } = req.params;
    const { date, startTime, endTime } = req.body;
    const userId = getUserIdentifier(req.user);

    const booking = await bookingCollection.findOne({ _id: new ObjectId(id) });
    if (!booking || (booking.userId !== userId && booking.userEmail !== req.user?.email)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updateFields = {};
    if (date) updateFields.date = date;
    if (startTime && endTime) {
      updateFields.startTime = startTime;
      updateFields.endTime = endTime;
      updateFields.timeSlot = `${startTime} - ${endTime}`;
    }

    const result = await bookingCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ message: "Failed to update booking" });
  }
});

app.delete("/bookings/:id", verifyToken, async (req, res) => {
  try {
    const bookingCollection = req.db.collection("bookings");
    const { id } = req.params;
    const userId = getUserIdentifier(req.user);

    const booking = await bookingCollection.findOne({ _id: new ObjectId(id) });
    if (!booking || (booking.userId !== userId && booking.userEmail !== req.user?.email)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await bookingCollection.deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete booking" });
  }
});

app.get("/", (req, res) => {
  res.send("StudyNook Server is running fine!");
});

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;