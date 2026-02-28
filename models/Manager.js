const mongoose = require("mongoose");

const ManagerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    department: { type: String, required: true },
    units: { type: [String], default: [] },
    accessToken: { type: String, required: true, unique: true },
    password: { type: String },
    mustChangePassword: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Manager", ManagerSchema);