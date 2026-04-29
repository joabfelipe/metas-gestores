const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const Manager = require("../models/Manager");
const isAdmin = require("../middleware/isAdmin");
const Goal = require("../models/Goal");
const parsePeriod = require("../utils/parsePeriod");

const router = express.Router();

// Rotas internas permitidas como fallback de redirecionamento
const SAFE_FALLBACKS = ["/admin/managers", "/admin/goals"];

// Wrapper para capturar erros em rotas async sem repetir try/catch
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(err);
    req.flash("error_msg", "Ocorreu um erro inesperado. Tente novamente.");
    const referer = req.headers.referer || "";
    const fallback = SAFE_FALLBACKS.find((p) => referer.includes(p)) || "/admin/managers";
    res.redirect(fallback);
  });

// Lista gestores
router.get("/admin/managers", isAdmin, asyncHandler(async (req, res) => {
  const managers = await Manager.find().sort({ "departments.0": 1, name: 1 });
  res.render("admin/managers", {
    managers,
    pageTitle: "Gestores",
    currentPath: "/admin/managers",
    showSidebar: true,
    breadcrumbs: [
      { label: "Admin", href: "/admin/managers" },
      { label: "Gestores" }
    ],
    topbarMeta: "Admin"
  });
}));

// Cria gestor
router.post("/admin/managers", isAdmin, asyncHandler(async (req, res) => {
  const { name, email, department, unit } = req.body;
  const accessToken = crypto.randomBytes(24).toString("hex");
  const units = unit ? unit.split(",").map((u) => u.trim()).filter(Boolean) : [];
  const departments = department ? department.split(",").map((d) => d.trim()).filter(Boolean) : [];

  await Manager.create({ name, email, departments, units, accessToken });
  res.redirect("/admin/managers");
}));

// Atualiza gestor
router.post("/admin/managers/:id/update", isAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, department, unit } = req.body;

  const units = unit ? unit.split(",").map((u) => u.trim()).filter(Boolean) : [];
  const departments = department ? department.split(",").map((d) => d.trim()).filter(Boolean) : [];

  await Manager.findByIdAndUpdate(id, { name, email, departments, units });
  res.redirect("/admin/managers");
}));

// Exclui gestor e suas metas
router.post("/admin/managers/:id/delete", isAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await Goal.deleteMany({ managerId: id });
  await Manager.findByIdAndDelete(id);
  res.redirect("/admin/managers");
}));

// Lista metas com filtros
router.get("/admin/goals", isAdmin, asyncHandler(async (req, res) => {
  const { year, month } = parsePeriod(req.query);

  const managerId = req.query.managerId || "";
  const businessUnit = req.query.businessUnit || "";
  const department = req.query.department || "";

  const managers = await Manager.find().sort({ "departments.0": 1, name: 1 });

  const allUnits = new Set();
  const allDepartments = new Set();
  managers.forEach((m) => {
    (m.units || []).forEach((u) => allUnits.add(u));
    (m.departments || []).forEach((d) => allDepartments.add(d));
    if (m.department) allDepartments.add(m.department);
  });

  const filter = { year, month };
  if (managerId) filter.managerId = managerId;
  if (businessUnit) filter.businessUnit = businessUnit;
  if (department) filter.department = department;

  const goals = await Goal.find(filter)
    .populate("managerId")
    .sort({ "managerId.departments.0": 1, "managerId.name": 1, title: 1 });

  res.render("admin/goals", {
    managers,
    availableUnits: Array.from(allUnits).sort(),
    availableDepartments: Array.from(allDepartments).sort(),
    goals,
    year,
    month,
    managerId,
    businessUnit,
    department,
    pageTitle: "Metas",
    currentPath: "/admin/goals",
    showSidebar: true,
    breadcrumbs: [
      { label: "Admin", href: "/admin/managers" },
      { label: "Metas" }
    ],
    topbarMeta: "Admin"
  });
}));

// Exporta metas para CSV
router.get("/admin/goals/export", isAdmin, asyncHandler(async (req, res) => {
  const { year, month } = parsePeriod(req.query);

  const managerId = req.query.managerId || "";
  const businessUnit = req.query.businessUnit || "";
  const department = req.query.department || "";

  const filter = { year, month };
  if (managerId) filter.managerId = managerId;
  if (businessUnit) filter.businessUnit = businessUnit;
  if (department) filter.department = department;

  const goals = await Goal.find(filter)
    .populate("managerId")
    .sort({ "managerId.departments.0": 1, "managerId.name": 1, title: 1 });

  const headers = [
    "Gestor", "Email", "Departamentos", "Unidades",
    "Ano", "Mes", "Titulo", "Departamento (Meta)", "Unidade (Meta)",
    "Meta", "Medida", "Realizado", "Status", "Plano de Acao"
  ];

  const csvRows = [headers.join(",")];
  goals.forEach((goal) => {
    const manager = goal.managerId;
    const row = [
      `"${manager ? manager.name : "N/A"}"`,
      `"${manager ? manager.email : "N/A"}"`,
      `"${manager ? (manager.departments || []).join("; ") : ""}"`,
      `"${manager ? (manager.units || []).join("; ") : ""}"`,
      goal.year,
      goal.month,
      `"${goal.title.replace(/"/g, '""')}"`,
      `"${goal.department || ""}"`,
      `"${goal.businessUnit || ""}"`,
      goal.targetValue,
      `"${goal.unit}"`,
      goal.achievedValue !== null ? goal.achievedValue : "",
      `"${goal.status}"`,
      `"${(goal.actionPlan || "").replace(/"/g, '""')}"`,
    ];
    csvRows.push(row.join(","));
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="metas_backup_${year}_${month}.csv"`);
  res.write("\uFEFF");
  res.end(csvRows.join("\n"));
}));

// Cria meta
router.post("/admin/goals", isAdmin, asyncHandler(async (req, res) => {
  const { managerId, title, targetValue, unit, period, department } = req.body;
  const [year, month] = period.split("-").map(Number);

  await Goal.create({
    managerId,
    title,
    targetValue,
    businessUnit: req.body.businessUnit || "",
    department: department || "",
    year,
    month,
    achievedValue: null,
    status: "PENDENTE",
    actionPlan: "",
  });

  const params = new URLSearchParams();
  if (year) params.append("year", year);
  if (month) params.append("month", month);
  if (managerId) params.append("managerId", managerId);
  if (req.body.businessUnit) params.append("businessUnit", req.body.businessUnit);
  if (department) params.append("department", department);

  res.redirect(`/admin/goals?${params.toString()}`);
}));

// Atualiza meta individual
router.post("/admin/goals/:id/update", isAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, targetValue, unit, achievedValue, businessUnit, actionPlan, department } = req.body;

  await Goal.findByIdAndUpdate(id, {
    title,
    targetValue,
    unit,
    achievedValue: achievedValue === "" ? null : Number(achievedValue),
    businessUnit,
    department,
    actionPlan,
    status: achievedValue ? "PREENCHIDO" : "PENDENTE",
  });

  res.redirect("/admin/goals");
}));

// Atualizacao em lote (AJAX) — token CSRF lido do header x-csrf-token
router.post("/admin/goals/batch-update", isAdmin, express.json(), asyncHandler(async (req, res) => {
  const { updates } = req.body;
  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({ error: "Dados invalidos" });
  }

  for (const update of updates) {
    await Goal.findByIdAndUpdate(update.id, {
      title: update.title,
      targetValue: update.targetValue,
      unit: update.unit,
      businessUnit: update.businessUnit,
      department: update.department,
      achievedValue: update.achievedValue === "" ? null : Number(update.achievedValue),
      actionPlan: update.actionPlan,
      status: update.achievedValue ? "PREENCHIDO" : "PENDENTE",
    });
  }

  res.status(200).json({ success: true });
}));

// Replica metas do mes anterior
router.post("/admin/goals/replicate", isAdmin, asyncHandler(async (req, res) => {
  const { period, managerId } = req.body;
  const [year, month] = period.split("-").map(Number);

  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear--;
  }

  const filter = { year: prevYear, month: prevMonth };
  if (managerId) filter.managerId = managerId;

  const oldGoals = await Goal.find(filter);

  let count = 0;
  for (const goal of oldGoals) {
    const exists = await Goal.findOne({ managerId: goal.managerId, title: goal.title, year, month });
    if (!exists) {
      await Goal.create({
        managerId: goal.managerId,
        title: goal.title,
        targetValue: goal.targetValue,
        unit: goal.unit,
        businessUnit: goal.businessUnit,
        department: goal.department,
        year,
        month,
        achievedValue: null,
        status: "PENDENTE",
        actionPlan: "",
      });
      count++;
    }
  }

  req.flash("success_msg", `${count} metas replicadas com sucesso.`);
  res.redirect(`/admin/goals?year=${year}&month=${month}&managerId=${managerId}`);
}));

// Replica metas com origem/destino avancado
router.post("/admin/goals/replicate-advanced", isAdmin, asyncHandler(async (req, res) => {
  const { sourcePeriod, sourceManagerId, sourceUnit, sourceDepartment, targetPeriod, targetManagerId, targetUnit } = req.body;

  const [sourceYear, sourceMonth] = sourcePeriod.split("-").map(Number);
  const [targetYear, targetMonth] = targetPeriod.split("-").map(Number);

  const filter = { year: sourceYear, month: sourceMonth };
  if (sourceManagerId) filter.managerId = sourceManagerId;
  if (sourceUnit) filter.businessUnit = sourceUnit;
  if (sourceDepartment) filter.department = sourceDepartment;

  const sourceGoals = await Goal.find(filter);

  let count = 0;
  for (const goal of sourceGoals) {
    const newManagerId = targetManagerId || goal.managerId;
    const newUnit = targetUnit || goal.businessUnit;

    const exists = await Goal.findOne({
      managerId: newManagerId,
      title: goal.title,
      year: targetYear,
      month: targetMonth,
      businessUnit: newUnit,
      department: goal.department,
    });

    if (!exists) {
      await Goal.create({
        managerId: newManagerId,
        title: goal.title,
        targetValue: goal.targetValue,
        unit: goal.unit,
        businessUnit: newUnit,
        department: goal.department,
        year: targetYear,
        month: targetMonth,
        achievedValue: null,
        status: "PENDENTE",
        actionPlan: "",
      });
      count++;
    }
  }

  if (count > 0) {
    req.flash("success_msg", `${count} metas replicadas com sucesso.`);
  } else {
    req.flash("error_msg", "Nenhuma meta nova foi criada (verifique se ja existem ou se a origem tem metas).");
  }

  res.redirect(`/admin/goals?year=${targetYear}&month=${targetMonth}&managerId=${targetManagerId || sourceManagerId}`);
}));

// Exclui todas as metas do periodo
router.post("/admin/goals/delete-all", isAdmin, asyncHandler(async (req, res) => {
  const { period, managerId } = req.body;
  const [year, month] = period.split("-").map(Number);

  const filter = { year, month };
  if (managerId) filter.managerId = managerId;

  await Goal.deleteMany(filter);

  req.flash("success_msg", "Metas excluidas com sucesso.");
  res.redirect(`/admin/goals?year=${year}&month=${month}&managerId=${managerId}`);
}));

// Exclui meta individual
router.post("/admin/goals/:id/delete", isAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await Goal.findByIdAndDelete(id);
  res.redirect("/admin/goals");
}));

// Exibe link de acesso do gestor
router.get("/admin/managers/:id/link", isAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { year, month } = parsePeriod(req.query);

  const businessUnit = req.query.businessUnit || "";

  const manager = await Manager.findById(id);
  if (!manager) {
    req.flash("error_msg", "Gestor nao encontrado.");
    return res.redirect("/admin/managers");
  }

  let link = `${req.protocol}://${req.get("host")}/g/${manager.accessToken}?year=${year}&month=${month}`;
  if (businessUnit) link += `&businessUnit=${encodeURIComponent(businessUnit)}`;

  const newPassword = req.flash("newPassword")[0];

  res.render("admin/manager_link", {
    manager,
    link,
    year,
    month,
    businessUnit,
    newPassword,
    pageTitle: "Link do Gestor",
    currentPath: "/admin/managers",
    showSidebar: true,
    breadcrumbs: [
      { label: "Admin", href: "/admin/managers" },
      { label: "Gestores", href: "/admin/managers" },
      { label: "Link" }
    ],
    topbarMeta: "Admin"
  });
}));

// Gera credenciais de acesso para o gestor
router.post("/admin/managers/:id/generate-credentials", isAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const manager = await Manager.findById(id);

  if (!manager) {
    req.flash("error_msg", "Gestor nao encontrado.");
    return res.redirect("/admin/managers");
  }

  const rawPassword = crypto.randomBytes(4).toString("hex");
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  manager.password = hashedPassword;
  manager.mustChangePassword = true;
  await manager.save();

  req.flash("success_msg", "Senha gerada com sucesso! Copie as credenciais abaixo.");
  req.flash("newPassword", rawPassword);
  res.redirect(`/admin/managers/${id}/link`);
}));

module.exports = router;
