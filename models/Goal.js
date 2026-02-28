const mongoose = require("mongoose");

const GoalSchema = new mongoose.Schema(
  {
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "Manager", required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true }, // 1-12

    title: { type: String, required: true },
    businessUnit: { type: String, default: "" }, // Unidade Física (ex: Matriz, Filial X)
    targetValue: { type: Number, required: true },
    unit: { type: String, default: "%" },

    achievedValue: { type: Number, default: null },
    actionPlan: { type: String, default: "" },

    status: { type: String, enum: ["PENDENTE", "PREENCHIDO"], default: "PENDENTE" },
  },
  { timestamps: true }
);

GoalSchema.index({ managerId: 1, year: 1, month: 1, title: 1, businessUnit: 1 }, { unique: true });

module.exports = mongoose.model("Goal", GoalSchema);