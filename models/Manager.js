const mongoose = require("mongoose");

const ManagerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Formato de e-mail inválido"],
    },
    departments: { type: [String], default: [] },
    units: { type: [String], default: [] },
    accessToken: { type: String, required: true, unique: true },
    password: { type: String },
    mustChangePassword: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Manager", ManagerSchema);
