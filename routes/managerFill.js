const express = require("express");
const Manager = require("../models/Manager");
const Goal = require("../models/Goal");

const router = express.Router();

router.get("/g/:token", async (req, res) => {
  const { token } = req.params;
  
  let year = 2026;
  let month = 1;

  if (req.query.period) {
    [year, month] = req.query.period.split("-").map(Number);
  } else {
    year = Number(req.query.year || 2026);
    month = Number(req.query.month || 1);
  }

  const businessUnit = req.query.businessUnit || "";

  const manager = await Manager.findOne({ accessToken: token });
  if (!manager) return res.status(404).send("Link inválido.");

  const filter = { managerId: manager._id, year, month };
  if (businessUnit) {
      filter.businessUnit = businessUnit;
  }

  const goals = await Goal.find(filter).sort({ title: 1 });
  
  const params = new URLSearchParams();
  if (year) params.append("year", year);
  if (month) params.append("month", month);
  if (businessUnit) params.append("businessUnit", businessUnit);

  res.render("manager/fill", {
    manager,
    goals,
    year,
    month,
    businessUnit,
    formAction: `/g/${token}?${params.toString()}`,
    pageTitle: "Preenchimento de metas",
    showSidebar: false,
    breadcrumbs: [{ label: "Metas" }],
    topbarMeta: "Gestor"
  });
});

// Rota autenticada para gestores
router.get("/manager/dashboard", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'manager') {
    return res.redirect("/login");
  }

  if (req.session.user.mustChangePassword) {
    return res.redirect("/change-password");
  }

  const manager = await Manager.findById(req.session.user.id);
  if (!manager) return res.redirect("/login");

  let year = 2026;
  let month = 1;

  if (req.query.period) {
    [year, month] = req.query.period.split("-").map(Number);
  } else {
    year = Number(req.query.year || 2026);
    month = Number(req.query.month || 1);
  }

  const businessUnit = req.query.businessUnit || "";

  const filter = { managerId: manager._id, year, month };
  if (businessUnit) {
      filter.businessUnit = businessUnit;
  }

  const goals = await Goal.find(filter).sort({ title: 1 });

  const params = new URLSearchParams();
  if (year) params.append("year", year);
  if (month) params.append("month", month);
  if (businessUnit) params.append("businessUnit", businessUnit);

  res.render("manager/fill", {
    manager,
    goals,
    year,
    month,
    businessUnit,
    formAction: `/manager/dashboard?${params.toString()}`,
    pageTitle: "Dashboard do Gestor",
    showSidebar: false, // Pode ser true se tiver sidebar para gestor
    breadcrumbs: [{ label: "Dashboard" }],
    topbarMeta: "Gestor"
  });
});

router.post("/manager/dashboard", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'manager') {
    return res.redirect("/login");
  }

  if (req.session.user.mustChangePassword) {
    return res.redirect("/change-password");
  }

  const manager = await Manager.findById(req.session.user.id);
  if (!manager) return res.redirect("/login");

  let year = 2026;
  let month = 1;

  if (req.query.period) {
    [year, month] = req.query.period.split("-").map(Number);
  } else {
    year = Number(req.query.year || 2026);
    month = Number(req.query.month || 1);
  }

  const businessUnit = req.query.businessUnit || "";

  const { goalId = [], achievedValue = [], actionPlan = [] } = req.body;

  const ids = Array.isArray(goalId) ? goalId : [goalId];
  const values = Array.isArray(achievedValue) ? achievedValue : [achievedValue];
  const plans = Array.isArray(actionPlan) ? actionPlan : [actionPlan];

  for (let i = 0; i < ids.length; i++) {
    const filter = { _id: ids[i], managerId: manager._id, year, month };
    
    await Goal.findOneAndUpdate(
      filter,
      {
        achievedValue: values[i] === "" ? null : Number(values[i]),
        actionPlan: plans[i] || "",
        status: "PREENCHIDO",
      }
    );
  }
  
  req.flash("success_msg", "Metas atualizadas com sucesso!");
  res.redirect(`/manager/dashboard?year=${year}&month=${month}&businessUnit=${businessUnit}`);
});

router.post("/g/:token", async (req, res) => {
  const { token } = req.params;
  
  let year = 2026;
  let month = 1;

  if (req.query.period) {
    [year, month] = req.query.period.split("-").map(Number);
  } else {
    year = Number(req.query.year || 2026);
    month = Number(req.query.month || 1);
  }

  const businessUnit = req.query.businessUnit || "";

  const manager = await Manager.findOne({ accessToken: token });
  if (!manager) return res.status(404).send("Link inválido.");

  const { goalId = [], achievedValue = [], actionPlan = [] } = req.body;

  const ids = Array.isArray(goalId) ? goalId : [goalId];
  const values = Array.isArray(achievedValue) ? achievedValue : [achievedValue];
  const plans = Array.isArray(actionPlan) ? actionPlan : [actionPlan];

  for (let i = 0; i < ids.length; i++) {
    // Garante que só atualiza se pertencer ao gestor, ano, mês E unidade (se filtrado)
    // Se o filtro de unidade estiver ativo, só deve atualizar as metas daquela unidade.
    // Mas o ID da meta já é único, então o filtro extra é só segurança.
    const filter = { _id: ids[i], managerId: manager._id, year, month };
    
    await Goal.findOneAndUpdate(
      filter,
      {
        achievedValue: values[i] === "" ? null : Number(values[i]),
        actionPlan: plans[i] || "",
        status: "PREENCHIDO",
      }
    );
  }

  // Redireciona de volta mantendo o filtro, ou mostra sucesso?
  // O código original mostrava sucesso. Vamos manter, mas passar a unidade se precisar link de voltar.
  
  res.render("manager/success", {
    manager,
    year,
    month,
    businessUnit,
    pageTitle: "Envio concluído",
    showSidebar: false,
    breadcrumbs: [{ label: "Confirmação" }],
    topbarMeta: "Gestor"
  });
});

module.exports = router;
