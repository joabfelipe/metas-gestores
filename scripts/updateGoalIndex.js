const mongoose = require("mongoose");
require("dotenv").config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to Mongo");

    const collection = mongoose.connection.collection("goals");
    
    // Drop the old index
    try {
        await collection.dropIndex("managerId_1_year_1_month_1_title_1");
        console.log("Dropped old index");
    } catch (e) {
        console.log("Old index might not exist or already dropped:", e.message);
    }

    // Create new index
    // Note: Mongoose usually handles this on app start, but explicit creation ensures it's done.
    // However, since we updated the model file, Mongoose syncIndexes might run on app restart.
    // But dropping the old one is crucial because it's more restrictive.
    
    console.log("Done. Please restart the application.");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();