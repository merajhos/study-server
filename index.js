const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const uri = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

const app = express();

app.use(
  cors({
    origin: [process.env.CLIENT_URL],
    credentials: true,
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

// JWKS Verification Reference
const clientUrl = process.env.CLIENT_URL ;
const JWKS = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));

// Safe verifyToken Middleware
const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers?.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token || token === "undefined" || token === "null") {
    return res.status(401).json({ message: "Unauthorized: Invalid token format" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ["EdDSA", "RS256", "ES256", "HS256"],
    });
    req.user = payload;
    return next();
  } catch (error) {
    try {
      const authRes = await fetch(`${clientUrl}/api/auth/get-session`, {
        headers: {
          cookie: req.headers.cookie || "",
          authorization: `Bearer ${token}`,
        },
      });

      if (authRes.ok) {
        const sessionData = await authRes.json();
        if (sessionData?.user) {
          req.user = sessionData.user;
          return next();
        }
      }
    } catch (sessionErr) {
      console.error("Session fetch failed:", sessionErr.message);
    }

    console.error("JWT Verification Error:", error.message);
    return res.status(403).json({ message: "Forbidden: Token verification failed" });
  }
};

async function run() {
  try {
    const db = client.db("studyNookDB");
    const roomsCollection = db.collection("rooms");
    const bookingCollection = db.collection("bookings");

    // Helper function: User ID or Email Identifier
    const getUserIdentifier = (user) => {
      return user?.id || user?.sub || user?.email || null;
    };

   

    // 1. Featured Rooms
    app.get("/featured", async (req, res) => {
      const result = await roomsCollection
        .find()
        .sort({ _id: -1 })
        .limit(6)
        .toArray();
      res.json(result);
    });

    // 2. All Rooms
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

    // 3. My Listings 
    app.get("/rooms/my-rooms", verifyToken, async (req, res) => {
      try {
        const userId = getUserIdentifier(req.user);
        const userEmail = req.user?.email;

        // ID or Email 
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

    // 4. Single Room Details
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

    // 5. Add Room (Protected)
    app.post("/rooms", verifyToken, async (req, res) => {
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
    });

    // 6. Update Room
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

    // 7. Delete Room
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

  

    // 8. Get My Bookings 
    app.get("/bookings/my-bookings", verifyToken, async (req, res) => {
      try {
        const userId = getUserIdentifier(req.user);
        const userEmail = req.user?.email;

        // ID or Email 
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

    // 9. Create Booking
    app.post("/bookings", verifyToken, async (req, res) => {
      try {
        const { roomId, roomName, date, startTime, endTime, totalCost } = req.body;
        const userId = getUserIdentifier(req.user);

        if (!roomId || !date || !startTime || !endTime) {
          return res.status(400).json({ message: "All booking details are required" });
        }

        // Booking
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

    // 10. Update / Edit Booking
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

    // 11. Delete Booking
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
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("StudyNook Server is running fine!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});