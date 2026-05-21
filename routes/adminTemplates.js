const express = require("express");
const Manager = require("../models/Manager");
const GoalTemplate = require("../models/GoalTemplate");
const Goal = require("../models/Goal");
const isAdmin = require("../middleware/isAdmin");
const expandPeriod = require("../utils/expandPeriod");

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(err);
    req.flash("error_msg", "Ocorreu um erro inesperado. Tente novamente.");
    res.redirect("/admin/dashboard");
  });

/**
 * Sincroniza os Goals vinculados a um template.
 * Cria os pendentes faltantes, remove os pendentes que saíram da vigência,
 * e atualiza os campos visuais dos demais (preservando achievedValue/actionPlan).
 */
async function syncTemplateGoals(template) {
  const months = expandPeriod(template.validFrom, template.validUntil);
  const assignments = template.assignments || [];

  // Pares (year, month, managerId, businessUnit) que devem existir
  const targetSet = new Set();
  const targetPairs = [];
  for (const m of months) {
    for (const a of assignments) {
      const key = `${m.year}-${m.month}-${a.managerId}-${a.businessUnit || ""}`;
      targetSet.add(key);
      targetPairs.push({
        year: m.year,
        month: m.month,
        managerId: a.managerId,
        businessUnit: a.businessUnit || "",
      });
    }
  }

  // Goals atuais do template
  const existing = await Goal.find({ templateId: template._id });

  const existingMap = new Map();
  for (const g of existing) {
    const key = `${g.year}-${g.month}-${g.managerId}-${g.businessUnit || ""}`;
    existingMap.set(key, g);
  }

  // 1) Atualiza visuais e/ou remove os que saíram da vigência
  for (const g of existing) {
    const key = `${g.year}-${g.month}-${g.managerId}-${g.businessUnit || ""}`;
    if (targetSet.has(key)) {
      // Continua existindo: atualiza campos visuais
      g.title = template.title;
      g.targetValue = template.targetValue;
      g.unit = template.unit;
      g.department = template.department;
      await g.save();
    } else {
      // Saiu da vigência: só remove se ainda não foi preenchido
      if (g.achievedValue === null || g.achievedValue === undefined) {
        await Goal.deleteOne({ _id: g._id });
      }
    }
  }

  // 2) Cria os que faltam
  const toCreate = [];
  for (const pair of targetPairs) {
    const key = `${pair.year}-${pair.month}-${pair.managerId}-${pair.businessUnit}`;
    if (!existingMap.has(key)) {
      toCreate.push({
        templateId: template._id,
        managerId: pair.managerId,
        year: pair.year,
        month: pair.month,
        title: template.title,
        department: template.department,
        businessUnit: pair.businessUnit,
        targetValue: template.targetValue,
        unit: template.unit,
        achievedValue: null,
        actionPlan: "",
        status: "PENDENTE",
      });
    }
  }

  if (toCreate.length > 0) {
    // ordered:false ignora duplicatas se houver índice único colidindo
    await Goal.insertMany(toCreate, { ordered: false }).catch((err) => {
      if (err.code !== 11000) throw err;
    });
  }
}

// Lista templates
router.get(
  "/admin/templates",
  isAdmin,
  asyncHandler(async (req, res) => {
    const templates = await GoalTemplate.find()
      .populate("assignments.managerId")
      .sort({ active: -1, validFrom: -1, title: 1 });

    res.render("admin/templates/list", {
      templates,
      pageTitle: "Modelos de meta",
      currentPath: "/admin/templates",
      showSidebar: true,
      breadcrumbs: [
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Modelos" },
      ],
      topbarMeta: "Admin",
    });
  })
);

// Tela de criação
router.get(
  "/admin/templates/new",
  isAdmin,
  asyncHandler(async (req, res) => {
    const managers = await Manager.find({ isAdmin: { $ne: true } }).sort({ name: 1 });

    // Lista plana de pares (gestor × unidade) para o multi-select
    const slots = [];
    managers.forEach((m) => {
      const units = m.units && m.units.length ? m.units : [""];
      units.forEach((u) => {
        slots.push({
          managerId: m._id.toString(),
          managerName: m.name,
          businessUnit: u,
          departments: m.departments || [],
        });
      });
    });

    const allDepartments = Array.from(
      new Set(managers.flatMap((m) => m.departments || []))
    ).sort();

    res.render("admin/templates/form", {
      template: null,
      slots,
      allDepartments,
      pageTitle: "Novo modelo de meta",
      currentPath: "/admin/templates",
      showSidebar: true,
      breadcrumbs: [
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Modelos", href: "/admin/templates" },
        { label: "Novo" },
      ],
      topbarMeta: "Admin",
    });
  })
);

// Cria template + gera Goals
router.post(
  "/admin/templates",
  isAdmin,
  asyncHandler(async (req, res) => {
    const { title, department, targetValue, unit, validFrom, validUntil } = req.body;

    // assignments chega como array de strings "managerId|businessUnit"
    let raw = req.body.assignments || [];
    if (!Array.isArray(raw)) raw = [raw];
    const assignments = raw
      .filter(Boolean)
      .map((s) => {
        const [managerId, businessUnit] = String(s).split("|");
        return { managerId, businessUnit: businessUnit || "" };
      });

    if (assignments.length === 0) {
      req.flash("error_msg", "Selecione ao menos um gestor para aplicar o modelo.");
      return res.redirect("/admin/templates/new");
    }

    const template = await GoalTemplate.create({
      title,
      department: department || "",
      targetValue: Number(targetValue),
      unit: unit || "%",
      validFrom,
      validUntil: validUntil || "",
      assignments,
      active: true,
    });

    await syncTemplateGoals(template);

    req.flash("success_msg", "Modelo criado e metas geradas com sucesso.");
    res.redirect("/admin/dashboard");
  })
);

// Tela de edição
router.get(
  "/admin/templates/:id/edit",
  isAdmin,
  asyncHandler(async (req, res) => {
    const template = await GoalTemplate.findById(req.params.id);
    if (!template) {
      req.flash("error_msg", "Modelo não encontrado.");
      return res.redirect("/admin/dashboard");
    }

    const managers = await Manager.find({ isAdmin: { $ne: true } }).sort({ name: 1 });

    const slots = [];
    managers.forEach((m) => {
      const units = m.units && m.units.length ? m.units : [""];
      units.forEach((u) => {
        slots.push({
          managerId: m._id.toString(),
          managerName: m.name,
          businessUnit: u,
          departments: m.departments || [],
        });
      });
    });

    const allDepartments = Array.from(
      new Set(managers.flatMap((m) => m.departments || []))
    ).sort();

    // Set de assignments selecionados para a view marcar os checkboxes
    const selectedSet = new Set(
      (template.assignments || []).map(
        (a) => `${a.managerId.toString()}|${a.businessUnit || ""}`
      )
    );

    res.render("admin/templates/form", {
      template,
      slots,
      allDepartments,
      selectedSet,
      pageTitle: "Editar modelo",
      currentPath: "/admin/templates",
      showSidebar: true,
      breadcrumbs: [
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Modelos", href: "/admin/templates" },
        { label: "Editar" },
      ],
      topbarMeta: "Admin",
    });
  })
);

// Atualiza template + sincroniza Goals
router.post(
  "/admin/templates/:id/update",
  isAdmin,
  asyncHandler(async (req, res) => {
    const template = await GoalTemplate.findById(req.params.id);
    if (!template) {
      req.flash("error_msg", "Modelo não encontrado.");
      return res.redirect("/admin/dashboard");
    }

    const { title, department, targetValue, unit, validFrom, validUntil } = req.body;

    let raw = req.body.assignments || [];
    if (!Array.isArray(raw)) raw = [raw];
    const assignments = raw
      .filter(Boolean)
      .map((s) => {
        const [managerId, businessUnit] = String(s).split("|");
        return { managerId, businessUnit: businessUnit || "" };
      });

    if (assignments.length === 0) {
      req.flash("error_msg", "Selecione ao menos um gestor para aplicar o modelo.");
      return res.redirect(`/admin/templates/${template._id}/edit`);
    }

    template.title = title;
    template.department = department || "";
    template.targetValue = Number(targetValue);
    template.unit = unit || "%";
    template.validFrom = validFrom;
    template.validUntil = validUntil || "";
    template.assignments = assignments;
    await template.save();

    await syncTemplateGoals(template);

    req.flash("success_msg", "Modelo atualizado e metas sincronizadas.");
    res.redirect("/admin/dashboard");
  })
);

// Inativa o template (e remove os Goals pendentes vinculados)
router.post(
  "/admin/templates/:id/delete",
  isAdmin,
  asyncHandler(async (req, res) => {
    const template = await GoalTemplate.findById(req.params.id);
    if (!template) {
      req.flash("error_msg", "Modelo não encontrado.");
      return res.redirect("/admin/dashboard");
    }

    // Remove apenas os Goals ainda não preenchidos (preserva histórico)
    await Goal.deleteMany({
      templateId: template._id,
      $or: [{ achievedValue: null }, { achievedValue: { $exists: false } }],
    });

    await GoalTemplate.deleteOne({ _id: template._id });

    req.flash(
      "success_msg",
      "Modelo removido. Metas já preenchidas foram preservadas como histórico."
    );
    res.redirect("/admin/dashboard");
  })
);

module.exports = router;
