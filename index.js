
// const express = require("express");
// const dotenv = require("dotenv");
// const cors = require("cors");
// const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

// dotenv.config();

// const uri = process.env.MONGODB_URI;
// const PORT = process.env.PORT || 5000;

// const app = express();

// app.use(
//   cors({
//     origin: [process.env.CLIENT_URL],
//     credentials: true,
//   })
// );
// app.use(express.json());

// const client = new MongoClient(uri, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   },
// });

// // JWKS Verification Reference
// const clientUrl = process.env.CLIENT_URL ;
// const JWKS = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));

// // Safe verifyToken Middleware
// // const verifyToken = async (req, res, next) => {
// //   try {
// //     const authHeader = req.headers.authorization;

// //     console.log("Authorization:", authHeader);

// //     if (!authHeader) {
// //       return res.status(401).json({
// //         message: "Unauthorized: No token provided",
// //       });
// //     }

// //     const [type, token] = authHeader.split(" ");

// //     if (type !== "Bearer" || !token) {
// //       return res.status(401).json({
// //         message: "Unauthorized: Invalid token format",
// //       });
// //     }

// //     const { payload } = await jwtVerify(token, JWKS, {
// //       algorithms: ["EdDSA", "RS256", "ES256", "HS256"],
// //     });

// //     console.log("JWT Payload:", payload);

// //     req.user = payload;

// //     next();
// //   } catch (error) {
// //     console.error("JWT ERROR:", error);

// //     return res.status(401).json({
// //       message: "Unauthorized: Invalid or expired token",
// //     });
// //   }
// // };
// const verifyToken = async (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     console.log("AUTH HEADER:", authHeader ? "Token received" : "NO TOKEN");

//     if (!authHeader) {
//       return res.status(401).json({
//         message: "Unauthorized: No token provided",
//       });
//     }

//     const [type, token] = authHeader.split(" ");

//     if (type !== "Bearer" || !token) {
//       return res.status(401).json({
//         message: "Unauthorized: Invalid token format",
//       });
//     }

//     const { payload } = await jwtVerify(token, JWKS, {
//       algorithms: ["EdDSA", "RS256", "ES256", "HS256"],
//       issuer: process.env.CLIENT_URL,
//       audience: process.env.CLIENT_URL,
//     });

//     console.log("JWT PAYLOAD:", payload);

//     req.user = payload;
//     next();

//   } catch (error) {
//     console.error("========== JWT ERROR ==========");
//     console.error("NAME:", error.name);
//     console.error("MESSAGE:", error.message);
//     console.error("CODE:", error.code);
//     console.error("==============================");

//     return res.status(401).json({
//       message: "Unauthorized: Invalid or expired token",
//       error: error.message,
//     });
//   }
// };

// async function run() {
//   try {
//     const db = client.db("studynook");
//     const roomsCollection = db.collection("rooms");
//     const bookingCollection = db.collection("bookings");

//     //  User ID or Email Identifier
//     const getUserIdentifier = (user) => {
//       return user?.id || user?.sub || user?.email || null;
//     };

   
//     // 1. Featured Rooms
//     app.get("/featured", async (req, res) => {
//       const result = await roomsCollection
//         .find()
//         .sort({ _id: -1 })
//         .limit(6)
//         .toArray();
//       res.json(result);
//     });

//     // 2. All Rooms
//     app.get("/rooms", async (req, res) => {
//       const { search, amenity } = req.query;
//       let query = {};

//       if (search) {
//         query.name = { $regex: search, $options: "i" };
//       }
//       if (amenity) {
//         query.amenities = { $in: [amenity] };
//       }

//       const result = await roomsCollection.find(query).toArray();
//       res.json(result);
//     });

//     // 3. My Listings 
//     app.get("/rooms/my-rooms", verifyToken, async (req, res) => {
//       try {
//         const userId = getUserIdentifier(req.user);
//         const userEmail = req.user?.email;

//         // ID or Email 
//         const result = await roomsCollection
//           .find({
//             $or: [{ ownerId: userId }, { userEmail: userEmail }],
//           })
//           .toArray();

//         res.json(result);
//       } catch (err) {
//         res.status(500).json({ message: "Failed to fetch user listings" });
//       }
//     });

//     // 4. Single Room Details
//     app.get("/rooms/:id", async (req, res) => {
//       const { id } = req.params;
//       try {
//         const result = await roomsCollection.findOne({
//           _id: new ObjectId(id),
//         });
//         res.json(result);
//       } catch (err) {
//         res.status(400).json({ message: "Invalid Room ID" });
//       }
//     });

//     // 5. Add Room (Protected)
//  app.post("/rooms", verifyToken, async (req, res) => {
//   try {
//     const roomData = req.body;

//     if (!roomData.name || !roomData.description) {
//       return res.status(400).json({
//         success: false,
//         message: "Room name and description are required",
//       });
//     }

//     const userId = getUserIdentifier(req.user);

//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "User information not found",
//       });
//     }

//     const newRoom = {
//       ...roomData,
//       ownerId: userId,
//       userEmail: req.user?.email || "",
//       bookingCount: 0,
//       createdAt: new Date(),
//     };

//     const result = await roomsCollection.insertOne(newRoom);

//     return res.status(201).json({
//       success: true,
//       message: "Room added successfully",
//       insertedId: result.insertedId,
//     });
//   } catch (error) {
//     console.error("POST /rooms ERROR:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to add room",
//       error: error.message,
//     });
//   }
// });

//     // 6. Update Room
//     app.patch("/rooms/:id", verifyToken, async (req, res) => {
//       const { id } = req.params;
//       const updatedData = req.body;
//       const userId = getUserIdentifier(req.user);

//       const room = await roomsCollection.findOne({ _id: new ObjectId(id) });
//       if (!room || (room.ownerId !== userId && room.userEmail !== req.user?.email)) {
//         return res.status(403).json({ message: "Forbidden: Not room owner" });
//       }

//       const result = await roomsCollection.updateOne(
//         { _id: new ObjectId(id) },
//         { $set: updatedData }
//       );
//       res.json(result);
//     });

//     // 7. Delete Room
//     app.delete("/rooms/:id", verifyToken, async (req, res) => {
//       const { id } = req.params;
//       const userId = getUserIdentifier(req.user);

//       const room = await roomsCollection.findOne({ _id: new ObjectId(id) });
//       if (!room || (room.ownerId !== userId && room.userEmail !== req.user?.email)) {
//         return res.status(403).json({ message: "Forbidden: Not room owner" });
//       }

//       const result = await roomsCollection.deleteOne({
//         _id: new ObjectId(id),
//       });
//       res.json(result);
//     });

  

//     // 8.  Bookings from my-bookings
//     app.get("/bookings/my-bookings", verifyToken, async (req, res) => {
//       try {
//         const userId = getUserIdentifier(req.user);
//         const userEmail = req.user?.email;

//         // ID or Email 
//         const bookings = await bookingCollection
//           .find({
//             $or: [{ userId: userId }, { userEmail: userEmail }],
//           })
//           .sort({ createdAt: -1 })
//           .toArray();

//         res.json(bookings);
//       } catch (error) {
//         res.status(500).json({ message: "Error fetching bookings", error: error.message });
//       }
//     });

//     // 9. Create Booking
//     app.post("/bookings", verifyToken, async (req, res) => {
//       try {
//         const { roomId, roomName, date, startTime, endTime, totalCost } = req.body;
//         const userId = getUserIdentifier(req.user);

//         if (!roomId || !date || !startTime || !endTime) {
//           return res.status(400).json({ message: "All booking details are required" });
//         }

//         // Booking
//         const existingConflict = await bookingCollection.findOne({
//           roomId,
//           date,
//           status: "confirmed",
//           $or: [
//             { startTime: { $lt: endTime, $gte: startTime } },
//             { endTime: { $gt: startTime, $lte: endTime } },
//           ],
//         });

//         if (existingConflict) {
//           return res.status(400).json({ message: "Slot already booked for this room." });
//         }

//         const bookingData = {
//           roomId,
//           roomName: roomName || "Study Room",
//           userId: userId,
//           userEmail: req.user?.email || "",
//           date,
//           startTime,
//           endTime,
//           timeSlot: `${startTime} - ${endTime}`,
//           totalCost: Number(totalCost) || 0,
//           status: "confirmed",
//           createdAt: new Date(),
//         };

//         const result = await bookingCollection.insertOne(bookingData);

//         await roomsCollection.updateOne(
//           { _id: new ObjectId(roomId) },
//           { $inc: { bookingCount: 1 } }
//         );

//         res.status(201).json({ success: true, message: "Booking confirmed", result });
//       } catch (error) {
//         res.status(500).json({ message: "Failed to book room", error: error.message });
//       }
//     });

//     // 10. Update / Edit Booking
//     app.patch("/bookings/:id", verifyToken, async (req, res) => {
//       const { id } = req.params;
//       const { date, startTime, endTime } = req.body;
//       const userId = getUserIdentifier(req.user);

//       const booking = await bookingCollection.findOne({ _id: new ObjectId(id) });
//       if (!booking || (booking.userId !== userId && booking.userEmail !== req.user?.email)) {
//         return res.status(403).json({ message: "Forbidden" });
//       }

//       const updateFields = {};
//       if (date) updateFields.date = date;
//       if (startTime && endTime) {
//         updateFields.startTime = startTime;
//         updateFields.endTime = endTime;
//         updateFields.timeSlot = `${startTime} - ${endTime}`;
//       }

//       const result = await bookingCollection.updateOne(
//         { _id: new ObjectId(id) },
//         { $set: updateFields }
//       );

//       res.json({ success: true, result });
//     });

//     // 11. Delete Booking
//     app.delete("/bookings/:id", verifyToken, async (req, res) => {
//       const { id } = req.params;
//       const userId = getUserIdentifier(req.user);

//       const booking = await bookingCollection.findOne({ _id: new ObjectId(id) });
//       if (!booking || (booking.userId !== userId && booking.userEmail !== req.user?.email)) {
//         return res.status(403).json({ message: "Forbidden" });
//       }

//       const result = await bookingCollection.deleteOne({ _id: new ObjectId(id) });
//       res.json({ success: true, result });
//     });

//     console.log("Connected successfully to MongoDB!");
//   } finally {
//   }
// }
// run().catch(console.dir);

// app.get("/", (req, res) => {
//   res.status(200).json({
//     message: "studentno backend is running!",
//   });
// });

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });


















// const express = require("express");
// const dotenv = require("dotenv");
// const cors = require("cors");
// const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

// dotenv.config();

// const uri = process.env.MONGODB_URI;
// const PORT = process.env.PORT || 5000;

// const app = express();

// const clientUrl = process.env.CLIENT_URL || "https://studybook-sand.vercel.app";

// // CORS Configuration
// app.use(
//   cors({
//     origin: [
//       clientUrl,
//       "https://studybook-sand.vercel.app",
//       "http://localhost:3000",
//       "http://localhost:5173",
//     ],
//     credentials: true,
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );
// app.use(express.json());

// // MongoDB Client
// const client = new MongoClient(uri, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   },
// });

// // JWKS Verification Helper
// const cleanClientUrl = clientUrl.replace(/\/$/, "");
// let JWKS;

// try {
//   JWKS = createRemoteJWKSet(new URL(`${cleanClientUrl}/api/auth/jwks`));
// } catch (err) {
//   console.error("Failed to initialize JWKS remote URL:", err.message);
// }

// // Safe verifyToken Middleware
// const verifyToken = async (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader) {
//       return res.status(401).json({ message: "Unauthorized: No token provided" });
//     }

//     const [type, token] = authHeader.split(" ");

//     if (type !== "Bearer" || !token || token === "undefined" || token === "null") {
//       return res.status(401).json({ message: "Unauthorized: Invalid token format" });
//     }

//     // fallback set dynamically if JWKS failed initially
//     const currentJwks = JWKS || createRemoteJWKSet(new URL(`${cleanClientUrl}/api/auth/jwks`));

//     // JWKS দিয়ে ভেরিফাই করুন
//     const { payload } = await jwtVerify(token, currentJwks, {
//       algorithms: ["EdDSA", "RS256", "ES256", "HS256"],
//     });

//     req.user = payload;
//     next();
//   } catch (error) {
//     console.error("JWT ERROR:", error.message);
//     return res.status(401).json({
//       message: "Unauthorized: Invalid or expired token",
//       error: error.message,
//     });
//   }
// };

// async function run() {
//   try {
//     await client.connect();
//     const db = client.db("studynook");
//     const roomsCollection = db.collection("rooms");
//     const bookingCollection = db.collection("bookings");

//     // Helper: User ID or Email Identifier
//     const getUserIdentifier = (user) => {
//       return user?.id || user?.sub || user?.email || null;
//     };

//     // 1. Featured Rooms
//     app.get("/featured", async (req, res) => {
//       try {
//         const result = await roomsCollection
//           .find()
//           .sort({ _id: -1 })
//           .limit(6)
//           .toArray();
//         res.json(result);
//       } catch (err) {
//         res.status(500).json({ message: "Error fetching featured rooms" });
//       }
//     });

//     // 2. All Rooms
//     app.get("/rooms", async (req, res) => {
//       try {
//         const { search, amenity } = req.query;
//         let query = {};

//         if (search) {
//           query.name = { $regex: search, $options: "i" };
//         }
//         if (amenity) {
//           query.amenities = { $in: [amenity] };
//         }

//         const result = await roomsCollection.find(query).toArray();
//         res.json(result);
//       } catch (err) {
//         res.status(500).json({ message: "Error fetching rooms" });
//       }
//     });

//     // 3. My Listings 
//     app.get("/rooms/my-rooms", verifyToken, async (req, res) => {
//       try {
//         const userId = getUserIdentifier(req.user);
//         const userEmail = req.user?.email;

//         const result = await roomsCollection
//           .find({
//             $or: [{ ownerId: userId }, { userEmail: userEmail }],
//           })
//           .toArray();

//         res.json(result);
//       } catch (err) {
//         res.status(500).json({ message: "Failed to fetch user listings" });
//       }
//     });

//     // 4. Single Room Details
//     app.get("/rooms/:id", async (req, res) => {
//       const { id } = req.params;
//       if (!ObjectId.isValid(id)) {
//         return res.status(400).json({ message: "Invalid Room ID" });
//       }
//       try {
//         const result = await roomsCollection.findOne({
//           _id: new ObjectId(id),
//         });
//         if (!result) return res.status(404).json({ message: "Room not found" });
//         res.json(result);
//       } catch (err) {
//         res.status(500).json({ message: "Error fetching room details" });
//       }
//     });

//     // 5. Add Room (Protected)
//     app.post("/rooms", verifyToken, async (req, res) => {
//       try {
//         const roomData = req.body;

//         if (!roomData.name || !roomData.description) {
//           return res.status(400).json({
//             success: false,
//             message: "Room name and description are required",
//           });
//         }

//         const userId = getUserIdentifier(req.user);

//         if (!userId) {
//           return res.status(401).json({
//             success: false,
//             message: "User information not found",
//           });
//         }

//         const newRoom = {
//           ...roomData,
//           ownerId: userId,
//           userEmail: req.user?.email || "",
//           bookingCount: 0,
//           createdAt: new Date(),
//         };

//         const result = await roomsCollection.insertOne(newRoom);

//         return res.status(201).json({
//           success: true,
//           message: "Room added successfully",
//           insertedId: result.insertedId,
//         });
//       } catch (error) {
//         console.error("POST /rooms ERROR:", error);

//         return res.status(500).json({
//           success: false,
//           message: "Failed to add room",
//           error: error.message,
//         });
//       }
//     });

//     // 6. Update Room
//     app.patch("/rooms/:id", verifyToken, async (req, res) => {
//       const { id } = req.params;
//       if (!ObjectId.isValid(id)) {
//         return res.status(400).json({ message: "Invalid Room ID" });
//       }
//       const updatedData = req.body;
//       const userId = getUserIdentifier(req.user);

//       const room = await roomsCollection.findOne({ _id: new ObjectId(id) });
//       if (!room || (room.ownerId !== userId && room.userEmail !== req.user?.email)) {
//         return res.status(403).json({ message: "Forbidden: Not room owner" });
//       }

//       const result = await roomsCollection.updateOne(
//         { _id: new ObjectId(id) },
//         { $set: updatedData }
//       );
//       res.json(result);
//     });

//     // 7. Delete Room
//     app.delete("/rooms/:id", verifyToken, async (req, res) => {
//       const { id } = req.params;
//       if (!ObjectId.isValid(id)) {
//         return res.status(400).json({ message: "Invalid Room ID" });
//       }
//       const userId = getUserIdentifier(req.user);

//       const room = await roomsCollection.findOne({ _id: new ObjectId(id) });
//       if (!room || (room.ownerId !== userId && room.userEmail !== req.user?.email)) {
//         return res.status(403).json({ message: "Forbidden: Not room owner" });
//       }

//       const result = await roomsCollection.deleteOne({
//         _id: new ObjectId(id),
//       });
//       res.json(result);
//     });

//     // 8. Bookings from my-bookings
//     app.get("/bookings/my-bookings", verifyToken, async (req, res) => {
//       try {
//         const userId = getUserIdentifier(req.user);
//         const userEmail = req.user?.email;

//         const bookings = await bookingCollection
//           .find({
//             $or: [{ userId: userId }, { userEmail: userEmail }],
//           })
//           .sort({ createdAt: -1 })
//           .toArray();

//         res.json(bookings);
//       } catch (error) {
//         res.status(500).json({ message: "Error fetching bookings", error: error.message });
//       }
//     });

//     // 9. Create Booking
//     app.post("/bookings", verifyToken, async (req, res) => {
//       try {
//         const { roomId, roomName, date, startTime, endTime, totalCost } = req.body;
//         const userId = getUserIdentifier(req.user);

//         if (!roomId || !date || !startTime || !endTime) {
//           return res.status(400).json({ message: "All booking details are required" });
//         }

//         const existingConflict = await bookingCollection.findOne({
//           roomId,
//           date,
//           status: "confirmed",
//           $or: [
//             { startTime: { $lt: endTime, $gte: startTime } },
//             { endTime: { $gt: startTime, $lte: endTime } },
//           ],
//         });

//         if (existingConflict) {
//           return res.status(400).json({ message: "Slot already booked for this room." });
//         }

//         const bookingData = {
//           roomId,
//           roomName: roomName || "Study Room",
//           userId: userId,
//           userEmail: req.user?.email || "",
//           date,
//           startTime,
//           endTime,
//           timeSlot: `${startTime} - ${endTime}`,
//           totalCost: Number(totalCost) || 0,
//           status: "confirmed",
//           createdAt: new Date(),
//         };

//         const result = await bookingCollection.insertOne(bookingData);

//         if (ObjectId.isValid(roomId)) {
//           await roomsCollection.updateOne(
//             { _id: new ObjectId(roomId) },
//             { $inc: { bookingCount: 1 } }
//           );
//         }

//         res.status(201).json({ success: true, message: "Booking confirmed", result });
//       } catch (error) {
//         res.status(500).json({ message: "Failed to book room", error: error.message });
//       }
//     });

//     // 10. Update / Edit Booking
//     app.patch("/bookings/:id", verifyToken, async (req, res) => {
//       const { id } = req.params;
//       if (!ObjectId.isValid(id)) {
//         return res.status(400).json({ message: "Invalid Booking ID" });
//       }
//       const { date, startTime, endTime } = req.body;
//       const userId = getUserIdentifier(req.user);

//       const booking = await bookingCollection.findOne({ _id: new ObjectId(id) });
//       if (!booking || (booking.userId !== userId && booking.userEmail !== req.user?.email)) {
//         return res.status(403).json({ message: "Forbidden" });
//       }

//       const updateFields = {};
//       if (date) updateFields.date = date;
//       if (startTime && endTime) {
//         updateFields.startTime = startTime;
//         updateFields.endTime = endTime;
//         updateFields.timeSlot = `${startTime} - ${endTime}`;
//       }

//       const result = await bookingCollection.updateOne(
//         { _id: new ObjectId(id) },
//         { $set: updateFields }
//       );

//       res.json({ success: true, result });
//     });

//     // 11. Delete Booking
//     app.delete("/bookings/:id", verifyToken, async (req, res) => {
//       const { id } = req.params;
//       if (!ObjectId.isValid(id)) {
//         return res.status(400).json({ message: "Invalid Booking ID" });
//       }
//       const userId = getUserIdentifier(req.user);

//       const booking = await bookingCollection.findOne({ _id: new ObjectId(id) });
//       if (!booking || (booking.userId !== userId && booking.userEmail !== req.user?.email)) {
//         return res.status(403).json({ message: "Forbidden" });
//       }

//       const result = await bookingCollection.deleteOne({ _id: new ObjectId(id) });
//       res.json({ success: true, result });
//     });

//     console.log("Connected successfully to MongoDB!");
//   } catch (error) {
//     console.error("MongoDB Connection Error:", error);
//   }
// }

// run().catch(console.dir);

// app.get("/", (req, res) => {
//   res.status(200).json({
//     message: "studentno backend is running!",
//   });
// });

// module.exports = app;









const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
} = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;

const clientUrl =
  process.env.CLIENT_URL || "https://studybook-sand.vercel.app";

const cleanClientUrl = clientUrl.replace(/\/$/, "");

app.use(
  cors({
    origin: [
      cleanClientUrl,
      "https://studybook-sand.vercel.app",
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());


// ===============================
// MongoDB
// ===============================

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


// ===============================
// Better Auth JWT
// ===============================

let JWKS;

try {
  JWKS = createRemoteJWKSet(
    new URL(`${cleanClientUrl}/api/auth/jwks`)
  );

  console.log(
    "JWKS URL:",
    `${cleanClientUrl}/api/auth/jwks`
  );
} catch (error) {
  console.error("JWKS initialization error:", error.message);
}


// ===============================
// Verify Token Middleware
// ===============================

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Unauthorized: No token provided",
      });
    }

    const [type, token] = authHeader.split(" ");

    if (
      type !== "Bearer" ||
      !token ||
      token === "undefined" ||
      token === "null"
    ) {
      return res.status(401).json({
        message: "Unauthorized: Invalid token format",
      });
    }

    const currentJwks =
      JWKS ||
      createRemoteJWKSet(
        new URL(`${cleanClientUrl}/api/auth/jwks`)
      );

    const { payload } = await jwtVerify(
      token,
      currentJwks,
      {
        algorithms: ["EdDSA"],
      }
    );

    req.user = payload;

    next();
  } catch (error) {
    console.error("JWT ERROR:", error.message);

    return res.status(401).json({
      message: "Unauthorized: Invalid or expired token",
      error: error.message,
    });
  }
};


// ===============================
// Database
// ===============================

async function run() {
  try {
    await client.connect();

    const db = client.db("studynook");

    const roomsCollection = db.collection("rooms");
    const bookingCollection = db.collection("bookings");

    console.log("Connected successfully to MongoDB!");


    // ===============================
    // Helper
    // ===============================

    const getUserIdentifier = (user) => {
      return (
        user?.id ||
        user?.sub ||
        user?.email ||
        null
      );
    };


    // ===============================
    // HOME
    // ===============================

    app.get("/", (req, res) => {
      res.status(200).json({
        success: true,
        message: "StudyNook backend is running!",
      });
    });


    // ===============================
    // FEATURED ROOMS
    // ===============================

    app.get("/featured", async (req, res) => {
      try {
        const result = await roomsCollection
          .find()
          .sort({ _id: -1 })
          .limit(6)
          .toArray();

        res.json(result);
      } catch (error) {
        console.error(error);

        res.status(500).json({
          message: "Error fetching featured rooms",
        });
      }
    });


    // ===============================
    // ALL ROOMS
    // ===============================

    app.get("/rooms", async (req, res) => {
      try {
        const { search, amenity } = req.query;

        const query = {};

        if (search) {
          query.name = {
            $regex: search,
            $options: "i",
          };
        }

        if (amenity) {
          query.amenities = {
            $in: [amenity],
          };
        }

        const result = await roomsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.json(result);
      } catch (error) {
        console.error(error);

        res.status(500).json({
          message: "Error fetching rooms",
        });
      }
    });


    // ===============================
    // MY ROOMS
    // ===============================

    app.get(
      "/rooms/my-rooms",
      verifyToken,
      async (req, res) => {
        try {
          const userId = getUserIdentifier(req.user);
          const userEmail = req.user?.email;

          const result = await roomsCollection
            .find({
              $or: [
                { ownerId: userId },
                { userEmail: userEmail },
              ],
            })
            .sort({ createdAt: -1 })
            .toArray();

          res.json(result);
        } catch (error) {
          console.error(error);

          res.status(500).json({
            message: "Failed to fetch user listings",
          });
        }
      }
    );


    // ===============================
    // SINGLE ROOM
    // ===============================

    app.get("/rooms/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            message: "Invalid Room ID",
          });
        }

        const room = await roomsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!room) {
          return res.status(404).json({
            message: "Room not found",
          });
        }

        res.json(room);
      } catch (error) {
        console.error(error);

        res.status(500).json({
          message: "Error fetching room details",
        });
      }
    });


    // ===============================
    // ADD ROOM
    // ===============================

    app.post(
      "/rooms",
      verifyToken,
      async (req, res) => {
        try {
          const roomData = req.body;

          if (
            !roomData.name ||
            !roomData.description
          ) {
            return res.status(400).json({
              success: false,
              message:
                "Room name and description are required",
            });
          }

          const userId = getUserIdentifier(req.user);

          if (!userId) {
            return res.status(401).json({
              success: false,
              message: "User information not found",
            });
          }

          const newRoom = {
            name: roomData.name,
            description: roomData.description,
            image: roomData.image || "",
            floor: roomData.floor || "",
            capacity: Number(roomData.capacity) || 0,
            hourlyRate:
              Number(roomData.hourlyRate) || 0,
            amenities: Array.isArray(roomData.amenities)
              ? roomData.amenities
              : [],

            ownerId: userId,
            userEmail: req.user?.email || "",

            bookingCount: 0,
            createdAt: new Date(),
          };

          const result =
            await roomsCollection.insertOne(newRoom);

          return res.status(201).json({
            success: true,
            message: "Room added successfully",
            insertedId: result.insertedId,
          });
        } catch (error) {
          console.error("POST /rooms ERROR:", error);

          return res.status(500).json({
            success: false,
            message: "Failed to add room",
            error: error.message,
          });
        }
      }
    );


    // ===============================
    // UPDATE ROOM
    // ===============================

    app.patch(
      "/rooms/:id",
      verifyToken,
      async (req, res) => {
        try {
          const { id } = req.params;

          if (!ObjectId.isValid(id)) {
            return res.status(400).json({
              message: "Invalid Room ID",
            });
          }

          const userId = getUserIdentifier(req.user);

          const room =
            await roomsCollection.findOne({
              _id: new ObjectId(id),
            });

          if (!room) {
            return res.status(404).json({
              message: "Room not found",
            });
          }

          if (
            room.ownerId !== userId &&
            room.userEmail !== req.user?.email
          ) {
            return res.status(403).json({
              message:
                "Forbidden: Not room owner",
            });
          }

          const updateData = {};

          if (req.body.name !== undefined) {
            updateData.name = req.body.name;
          }

          if (
            req.body.description !== undefined
          ) {
            updateData.description =
              req.body.description;
          }

          if (req.body.price !== undefined) {
            updateData.hourlyRate =
              Number(req.body.price);
          }

          if (
            req.body.hourlyRate !== undefined
          ) {
            updateData.hourlyRate =
              Number(req.body.hourlyRate);
          }

          const result =
            await roomsCollection.updateOne(
              {
                _id: new ObjectId(id),
              },
              {
                $set: updateData,
              }
            );

          res.json({
            success: true,
            message: "Room updated successfully",
            result,
          });
        } catch (error) {
          console.error(error);

          res.status(500).json({
            message: "Failed to update room",
          });
        }
      }
    );


    // ===============================
    // DELETE ROOM
    // ===============================

    app.delete(
      "/rooms/:id",
      verifyToken,
      async (req, res) => {
        try {
          const { id } = req.params;

          if (!ObjectId.isValid(id)) {
            return res.status(400).json({
              message: "Invalid Room ID",
            });
          }

          const userId = getUserIdentifier(req.user);

          const room =
            await roomsCollection.findOne({
              _id: new ObjectId(id),
            });

          if (!room) {
            return res.status(404).json({
              message: "Room not found",
            });
          }

          if (
            room.ownerId !== userId &&
            room.userEmail !== req.user?.email
          ) {
            return res.status(403).json({
              message:
                "Forbidden: Not room owner",
            });
          }

          const result =
            await roomsCollection.deleteOne({
              _id: new ObjectId(id),
            });

          res.json({
            success: true,
            message: "Room deleted successfully",
            result,
          });
        } catch (error) {
          console.error(error);

          res.status(500).json({
            message: "Failed to delete room",
          });
        }
      }
    );


    // ===============================
    // MY BOOKINGS
    // ===============================

    app.get(
      "/bookings/my-bookings",
      verifyToken,
      async (req, res) => {
        try {
          const userId = getUserIdentifier(req.user);
          const userEmail = req.user?.email;

          const bookings =
            await bookingCollection
              .find({
                $or: [
                  { userId: userId },
                  { userEmail: userEmail },
                ],
              })
              .sort({ createdAt: -1 })
              .toArray();

          res.json(bookings);
        } catch (error) {
          console.error(error);

          res.status(500).json({
            message: "Error fetching bookings",
            error: error.message,
          });
        }
      }
    );


    // ===============================
    // CREATE BOOKING
    // ===============================

    app.post(
      "/bookings",
      verifyToken,
      async (req, res) => {
        try {
          const {
            roomId,
            roomName,
            date,
            startTime,
            endTime,
            totalCost,
            specialNote,
          } = req.body;

          const userId =
            getUserIdentifier(req.user);

          if (
            !roomId ||
            !date ||
            !startTime ||
            !endTime
          ) {
            return res.status(400).json({
              message:
                "All booking details are required",
            });
          }

          if (startTime >= endTime) {
            return res.status(400).json({
              message:
                "End time must be after start time",
            });
          }


          // Proper overlap check
          const existingConflict =
            await bookingCollection.findOne({
              roomId,
              date,
              status: "confirmed",

              startTime: {
                $lt: endTime,
              },

              endTime: {
                $gt: startTime,
              },
            });

          if (existingConflict) {
            return res.status(400).json({
              message:
                "Slot already booked for this room.",
            });
          }


          const bookingData = {
            roomId,

            roomName:
              roomName || "Study Room",

            userId,

            userEmail:
              req.user?.email || "",

            date,
            startTime,
            endTime,

            timeSlot:
              `${startTime} - ${endTime}`,

            totalCost:
              Number(totalCost) || 0,

            specialNote:
              specialNote || "",

            status: "confirmed",

            createdAt: new Date(),
          };


          const result =
            await bookingCollection.insertOne(
              bookingData
            );


          if (ObjectId.isValid(roomId)) {
            await roomsCollection.updateOne(
              {
                _id: new ObjectId(roomId),
              },
              {
                $inc: {
                  bookingCount: 1,
                },
              }
            );
          }


          res.status(201).json({
            success: true,
            message: "Booking confirmed",
            bookingId: result.insertedId,
          });
        } catch (error) {
          console.error(
            "POST /bookings ERROR:",
            error
          );

          res.status(500).json({
            message: "Failed to book room",
            error: error.message,
          });
        }
      }
    );


    // ===============================
    // UPDATE BOOKING
    // ===============================

    app.patch(
      "/bookings/:id",
      verifyToken,
      async (req, res) => {
        try {
          const { id } = req.params;

          if (!ObjectId.isValid(id)) {
            return res.status(400).json({
              message: "Invalid Booking ID",
            });
          }

          const userId =
            getUserIdentifier(req.user);

          const booking =
            await bookingCollection.findOne({
              _id: new ObjectId(id),
            });

          if (!booking) {
            return res.status(404).json({
              message: "Booking not found",
            });
          }

          if (
            booking.userId !== userId &&
            booking.userEmail !== req.user?.email
          ) {
            return res.status(403).json({
              message: "Forbidden",
            });
          }

          const updateFields = {};

          if (req.body.date) {
            updateFields.date =
              req.body.date;
          }

          if (
            req.body.startTime &&
            req.body.endTime
          ) {
            updateFields.startTime =
              req.body.startTime;

            updateFields.endTime =
              req.body.endTime;

            updateFields.timeSlot =
              `${req.body.startTime} - ${req.body.endTime}`;
          }

          const result =
            await bookingCollection.updateOne(
              {
                _id: new ObjectId(id),
              },
              {
                $set: updateFields,
              }
            );

          res.json({
            success: true,
            result,
          });
        } catch (error) {
          console.error(error);

          res.status(500).json({
            message: "Failed to update booking",
          });
        }
      }
    );


    // ===============================
    // DELETE BOOKING
    // ===============================

    app.delete(
      "/bookings/:id",
      verifyToken,
      async (req, res) => {
        try {
          const { id } = req.params;

          if (!ObjectId.isValid(id)) {
            return res.status(400).json({
              message: "Invalid Booking ID",
            });
          }

          const userId =
            getUserIdentifier(req.user);

          const booking =
            await bookingCollection.findOne({
              _id: new ObjectId(id),
            });

          if (!booking) {
            return res.status(404).json({
              message: "Booking not found",
            });
          }

          if (
            booking.userId !== userId &&
            booking.userEmail !== req.user?.email
          ) {
            return res.status(403).json({
              message: "Forbidden",
            });
          }

          const result =
            await bookingCollection.deleteOne({
              _id: new ObjectId(id),
            });

          res.json({
            success: true,
            message:
              "Booking cancelled successfully",
            result,
          });
        } catch (error) {
          console.error(error);

          res.status(500).json({
            message:
              "Failed to cancel booking",
          });
        }
      }
    );

  } catch (error) {
    console.error(
      "MongoDB Connection Error:",
      error
    );
  }
}

run().catch(console.dir);


// Export Express app for Vercel
module.exports = app;