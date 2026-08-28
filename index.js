const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const uri = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

const app = express();

const clientUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, "") : "";

// 1. Dynamic Cors Setup (Credentials Supported)
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || (clientUrl && origin.startsWith(clientUrl)) || origin.includes("localhost")) {
        callback(null, true);
      } else {
        callback(null, true); // CORS issue এড়াতে flexible origin allow
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);

app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const getJWKS = () => {
  if (!clientUrl) return null;
  return createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));
};

// 2. Fixed verifyToken Middleware
const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers?.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  // token অথবা cookie কোনোটিই না থাকলে 401
  if ((!token || token === "undefined" || token === "null") && !req.headers.cookie) {
    return res.status(401).json({ message: "Unauthorized: Access denied, token or cookie missing" });
  }

  // Path 1: JWKS দিয়ে JWT ভ্যালিডেশন চেক
  if (token && token !== "undefined" && token !== "null") {
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
    } catch (error) {
      // JWT verify fail করলে শান্তভাবে সেশন চেক-এ চলে যাবে
    }
  }

  // Path 2: Better Auth Session Fallback API
  try {
    if (clientUrl) {
      const authRes = await fetch(`${clientUrl}/api/auth/get-session`, {
        headers: {
          cookie: req.headers.cookie || "",
          authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (authRes.ok) {
        const sessionData = await authRes.json();
        const currentUser = sessionData?.user || sessionData?.session?.user;

        if (currentUser) {
          req.user = currentUser;
          return next();
        }
      }
    }
  } catch (sessionErr) {
    console.error("Session fetch failed:", sessionErr.message);
  }

  return res.status(403).json({ message: "Forbidden: Token verification failed" });
};

async function run() {
  try {
    const db = client.db("studynook");
    const roomsCollection = db.collection("rooms");
    const bookingCollection = db.collection("bookings");

    const getUserIdentifier = (user) => {
      return user?.id || user?.sub || user?.email || null;
    };

    app.get("/featured", async (req, res) => {
      const result = await roomsCollection
        .find()
        .sort({ _id: -1 })
        .limit(6)
        .toArray();
      res.json(result);
    });

    app.get("/rooms", async (req, res) => {
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
    });

    app.get("/rooms/my-rooms", verifyToken, async (req, res) => {
      try {
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
        const result = await roomsCollection.findOne({
          _id: new ObjectId(id),
        });
        res.json(result);
      } catch (err) {
        res.status(400).json({ message: "Invalid Room ID" });
      }
    });

    app.post("/rooms", verifyToken, async (req, res) => {
      try {
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
    });

    app.delete("/rooms/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const userId = getUserIdentifier(req.user);

      const room = await roomsCollection.findOne({ _id: new ObjectId(id) });
      if (!room || (room.ownerId !== userId && room.userEmail !== req.user?.email)) {
        return res.status(403).json({ message: "Forbidden: Not room owner" });
      }

      const result = await roomsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });

    app.get("/bookings/my-bookings", verifyToken, async (req, res) => {
      try {
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
    });

    app.delete("/bookings/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const userId = getUserIdentifier(req.user);

      const booking = await bookingCollection.findOne({ _id: new ObjectId(id) });
      if (!booking || (booking.userId !== userId && booking.userEmail !== req.user?.email)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const result = await bookingCollection.deleteOne({ _id: new ObjectId(id) });
      res.json({ success: true, result });
    });

    console.log("Connected successfully to MongoDB!");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("StudyNook Server is running fine!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});