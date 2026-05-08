const mongoose = require("mongoose");

const AssignmentSchema = new mongoose.Schema(
  {
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "Manager", required: true },
    businessUnit: { type: String, default: "" },
  },
  { _id: false }
);

const GoalTemplateSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    department: { type: String, default: "" },
    targetValue: { type: Number, required: true },
    unit: { type: String, required: true, default: "%" },

    assignments: { type: [AssignmentSchema], default: [] },

    // Vigência no formato "YYYY-MM"
    validFrom: { type: String, required: true },
    validUntil: { type: String, default: "" }, // vazio = sem fim

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Verifica se o template está ativo num período (year, month)
GoalTemplateSchema.methods.isActiveInPeriod = function (year, month) {
  if (!this.active) return false;
  const period = `${year}-${String(month).padStart(2, "0")}`;
  if (this.validFrom && period < this.validFrom) return false;
  if (this.validUntil && period > this.validUntil) return false;
  return true;
};

module.exports = mongoose.model("GoalTemplate", GoalTemplateSchema);
