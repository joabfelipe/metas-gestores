const mongoose = require("mongoose");

const GoalSchema = new mongoose.Schema(
  {
    // Vínculo com o template que originou esta meta (opcional para compatibilidade
    // com metas criadas antes da introdução de templates).
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "GoalTemplate", default: null },

    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "Manager", required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true }, // 1-12

    title: { type: String, required: true },
    department: { type: String, default: "" },
    businessUnit: { type: String, default: "" },
    targetValue: { type: Number, required: true },
    unit: { type: String, default: "%" },

    achievedValue: { type: Number, default: null },
    actionPlan: { type: String, default: "" },

    status: { type: String, enum: ["PENDENTE", "PREENCHIDO"], default: "PENDENTE" },
  },
  { timestamps: true }
);

GoalSchema.index(
  { managerId: 1, year: 1, month: 1, title: 1, businessUnit: 1 },
  { unique: true }
);

module.exports = mongoose.model("Goal", GoalSchema);
