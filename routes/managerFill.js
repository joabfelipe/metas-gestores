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

  // Tenta pegar do query param OU da sessão
  let businessUnit = req.query.businessUnit || req.session.selectedUnit || "";

  // Se o usuário clicou em "Trocar unidade", limpamos a sessão
  if (req.query.changeUnit) {
      businessUnit = "";
      req.session.selectedUnit = null;
  }

  // Se não tem unidade selecionada, verifica se o gestor tem múltiplas unidades com metas
  if (!businessUnit) {
    const allGoals = await Goal.find({ managerId: manager._id, year, month });
    
    // Agrupa metas por unidade
    const unitsMap = new Map();
    
    allGoals.forEach(goal => {
      const unit = goal.businessUnit || "Padrão";
      if (!unitsMap.has(unit)) {
        unitsMap.set(unit, {
          name: unit,
          total: 0,
          filled: 0,
          pending: 0
        });
      }
      
      const stats = unitsMap.get(unit);
      stats.total++;
      if (goal.status === "PREENCHIDO") {
        stats.filled++;
      } else {
        stats.pending++;
      }
    });

    const unitsStatus = Array.from(unitsMap.values());

    // Se tiver mais de uma unidade OU (uma unidade e a gente quer mostrar o card bonito mesmo assim),
    // mas a lógica pedida é redirecionar se não precisar escolher.
    // Vamos mostrar a seleção sempre que houver > 1 unidade.
    // Se houver apenas 1, redireciona direto.
    
    if (unitsStatus.length === 1) {
      // Salva na sessão antes de redirecionar
      req.session.selectedUnit = unitsStatus[0].name;
      return res.redirect(`/manager/dashboard`);
    }

    if (unitsStatus.length > 1) {
      return res.render("manager/select_unit", {
        manager,
        unitsStatus,
        year,
        month,
        pageTitle: "Selecione a Unidade",
        showSidebar: false,
        breadcrumbs: [{ label: "Seleção de Unidade" }],
        topbarMeta: "Gestor"
      });
    }
    
    // Se não tiver nenhuma meta, mostra a tela vazia padrão (vai cair no fluxo abaixo com goals vazio)
  }
  
  // Se chegamos aqui, temos uma businessUnit definida (seja por query ou sessão)
  // Vamos garantir que ela esteja na sessão para futuras requisições limpas
  if (businessUnit && !req.session.selectedUnit) {
      req.session.selectedUnit = businessUnit;
  }

  const filter = { managerId: manager._id, year, month };
  if (businessUnit) {
      filter.businessUnit = businessUnit;
  }

  const goals = await Goal.find(filter).sort({ title: 1 });

  // Não precisamos mais passar params na URL do formAction se estivermos usando sessão
  // Mas manteremos o formAction apontando para o dashboard limpo
  
  res.render("manager/fill", {
    manager,
    goals,
    year,
    month,
    businessUnit,
    formAction: `/manager/dashboard`, // URL limpa
    pageTitle: "Dashboard do Gestor",
    showSidebar: false, 
    breadcrumbs: [{ label: "Dashboard" }],
    topbarMeta: "Gestor"
  });
});

// Nova rota POST para selecionar unidade e limpar URL
router.post("/manager/select-unit", (req, res) => {
    const { businessUnit, year, month } = req.body;
    req.session.selectedUnit = businessUnit;
    
    // Opcional: Salvar ano/mês na sessão também se quiser persistir filtros de data
    
    res.redirect("/manager/dashboard");
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
  
  // Verifica se existem outras unidades com metas pendentes
  const pendingGoals = await Goal.countDocuments({
    managerId: manager._id,
    year,
    month,
    status: { $ne: "PREENCHIDO" },
    businessUnit: { $ne: businessUnit } // Diferente da unidade atual
  });

  if (pendingGoals > 0) {
    req.flash("success_msg", `Metas de ${businessUnit} salvas! Existem pendências em outras unidades.`);
    // Remove a unidade atual da sessão para forçar a tela de seleção novamente
    req.session.selectedUnit = null;
    return res.redirect(`/manager/dashboard`); 
  }
  
  req.flash("success_msg", "Todas as metas foram atualizadas com sucesso!");
  res.redirect(`/manager/dashboard`);
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
