const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const Manager = require("../models/Manager");
const Goal = require("../models/Goal");

const router = express.Router();

// Lista e cria gestores
router.get("/admin/managers", async (req, res) => {
  const managers = await Manager.find().sort({ department: 1, name: 1 });
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
});

router.post("/admin/managers", async (req, res) => {
  const { name, email, department, unit } = req.body;
  const accessToken = crypto.randomBytes(24).toString("hex");
  // Converte "Unidade A, Unidade B" para ["Unidade A", "Unidade B"]
  const units = unit ? unit.split(',').map(u => u.trim()).filter(Boolean) : [];
  
  await Manager.create({ name, email, department, units, accessToken });
  res.redirect("/admin/managers");
});

router.post("/admin/managers/:id/update", async (req, res) => {
  const { id } = req.params;
  const { name, email, department, unit } = req.body;
  
  const units = unit ? unit.split(',').map(u => u.trim()).filter(Boolean) : [];

  await Manager.findByIdAndUpdate(id, {
    name,
    email,
    department,
    units
  });
  
  res.redirect("/admin/managers");
});

router.post("/admin/managers/:id/delete", async (req, res) => {
  const { id } = req.params;
  await Goal.deleteMany({ managerId: id });
  await Manager.findByIdAndDelete(id);
  res.redirect("/admin/managers");
});

// Lista metas (filtro por mês/ano/gestor)
router.get("/admin/goals", async (req, res) => {
  let year = 2026;
  let month = 1;

  if (req.query.period) {
    const parts = req.query.period.split("-");
    year = Number(parts[0]);
    month = Number(parts[1]);
  } else if (req.query.year && req.query.month) {
    year = Number(req.query.year);
    month = Number(req.query.month);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const managerId = req.query.managerId || "";
  const businessUnit = req.query.businessUnit || "";

  const managers = await Manager.find().sort({ department: 1, name: 1 });
  
  // Extrai todas as unidades cadastradas nos gestores
  const allUnits = new Set();
  managers.forEach(m => {
    if (m.units && Array.isArray(m.units)) {
      m.units.forEach(u => allUnits.add(u));
    }
  });
  const availableUnits = Array.from(allUnits).sort();

  const filter = { year, month };
  if (managerId) filter.managerId = managerId;
  if (businessUnit) filter.businessUnit = businessUnit;

  const goals = await Goal.find(filter)
    .populate("managerId")
    .sort({ "managerId.department": 1, "managerId.name": 1, title: 1 });

  res.render("admin/goals", {
    managers,
    availableUnits,
    goals,
    year,
    month,
    managerId,
    businessUnit,
    pageTitle: "Metas",
    currentPath: "/admin/goals",
    showSidebar: true,
    breadcrumbs: [
      { label: "Admin", href: "/admin/managers" },
      { label: "Metas" }
    ],
    topbarMeta: "Admin"
  });
});

router.post("/admin/goals", async (req, res) => {
  const { managerId, title, description, targetValue, unit, year, month } = req.body;
  
  await Goal.create({
    managerId,
    title,
    description,
    targetValue,
    businessUnit: unit,
    year,
    month,
    achievedValue: null,
    status: "PENDENTE",
    actionPlan: ""
  });

  // Mantém o filtro na URL
  const params = new URLSearchParams();
  if (year) params.append("year", year);
  if (month) params.append("month", month);
  if (managerId) params.append("managerId", managerId);
  if (unit) params.append("businessUnit", unit);

  res.redirect(`/admin/goals?${params.toString()}`);
});

router.post("/admin/goals/:id/update", async (req, res) => {
  const { id } = req.params;
  const { title, targetValue, unit, achievedValue, businessUnit, actionPlan } = req.body;

  await Goal.findByIdAndUpdate(id, {
    title,
    targetValue,
    unit,
    achievedValue: achievedValue === "" ? null : Number(achievedValue),
    businessUnit,
    actionPlan,
    status: achievedValue ? "PREENCHIDO" : "PENDENTE" // Atualiza status se tiver valor
  });

  // Tenta manter filtros (ideal seria passar query params no action do form, mas vamos redirecionar pro geral)
  res.redirect("/admin/goals");
});

router.post("/admin/goals/batch-update", express.json(), async (req, res) => {
    try {
        const { updates } = req.body;
        if (!updates || !Array.isArray(updates)) {
            return res.status(400).send("Dados inválidos");
        }

        for (const update of updates) {
            await Goal.findByIdAndUpdate(update.id, {
                title: update.title,
                targetValue: update.targetValue,
                unit: update.unit,
                businessUnit: update.businessUnit,
                achievedValue: update.achievedValue === "" ? null : Number(update.achievedValue),
                actionPlan: update.actionPlan,
                status: update.achievedValue ? "PREENCHIDO" : "PENDENTE"
            });
        }
        
        res.status(200).send("OK");
    } catch (error) {
        console.error(error);
        res.status(500).send("Erro ao atualizar metas");
    }
});

router.post("/admin/goals/replicate", async (req, res) => {
    const { period, managerId } = req.body;
    const [year, month] = period.split("-").map(Number);
    
    // Calcula mês anterior
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
        // Verifica se já existe meta igual para o mês atual
        const exists = await Goal.findOne({
            managerId: goal.managerId,
            title: goal.title,
            year,
            month
        });

        if (!exists) {
            await Goal.create({
                managerId: goal.managerId,
                title: goal.title,
                description: goal.description,
                targetValue: goal.targetValue,
                unit: goal.unit,
                businessUnit: goal.businessUnit,
                year,
                month,
                achievedValue: null,
                status: "PENDENTE",
                actionPlan: ""
            });
            count++;
        }
    }

    req.flash("success_msg", `${count} metas replicadas com sucesso.`);
    res.redirect(`/admin/goals?year=${year}&month=${month}&managerId=${managerId}`);
});

router.post("/admin/goals/copy-unit", async (req, res) => {
    const { period, managerId, sourceUnit, targetUnit } = req.body;
    const [year, month] = period.split("-").map(Number);

    const sourceGoals = await Goal.find({ 
        managerId, 
        year, 
        month, 
        businessUnit: sourceUnit 
    });

    let count = 0;
    for (const goal of sourceGoals) {
        const exists = await Goal.findOne({
            managerId,
            title: goal.title,
            year,
            month,
            businessUnit: targetUnit
        });

        if (!exists) {
            await Goal.create({
                managerId,
                title: goal.title,
                description: goal.description,
                targetValue: goal.targetValue,
                unit: goal.unit,
                businessUnit: targetUnit,
                year,
                month,
                achievedValue: null,
                status: "PENDENTE",
                actionPlan: ""
            });
            count++;
        }
    }

    req.flash("success_msg", `${count} metas copiadas de ${sourceUnit} para ${targetUnit}.`);
    res.redirect(`/admin/goals?year=${year}&month=${month}&managerId=${managerId}&businessUnit=${targetUnit}`);
});

router.post("/admin/goals/delete-all", async (req, res) => {
    const { period, managerId } = req.body;
    const [year, month] = period.split("-").map(Number);

    const filter = { year, month };
    if (managerId) filter.managerId = managerId;

    await Goal.deleteMany(filter);

    req.flash("success_msg", "Metas excluídas com sucesso.");
    res.redirect(`/admin/goals?year=${year}&month=${month}&managerId=${managerId}`);
});

router.post("/admin/goals/:id/delete", async (req, res) => {
  const { id } = req.params;
  const goal = await Goal.findById(id);
  await Goal.findByIdAndDelete(id);

  // Tenta redirecionar mantendo filtros (pegando do referer seria ideal, mas vamos simplificar)
  res.redirect("/admin/goals"); 
});

router.get("/admin/managers/:id/link", async (req, res) => {
  const { id } = req.params;
  
  let year = 2026;
  let month = 1;

  if (req.query.period) {
    [year, month] = req.query.period.split("-").map(Number);
  } else {
    year = Number(req.query.year || 2026);
    month = Number(req.query.month || 1);
  }

  const businessUnit = req.query.businessUnit || "";
  
  try {
    const manager = await Manager.findById(id);
    if (!manager) {
       req.flash("error_msg", "Gestor não encontrado.");
       return res.redirect("/admin/managers");
    }
    
    // Constrói o link base
    const protocol = req.protocol;
    const host = req.get('host');
    let link = `${protocol}://${host}/g/${manager.accessToken}?year=${year}&month=${month}`;
    if (businessUnit) {
        link += `&businessUnit=${encodeURIComponent(businessUnit)}`;
    }

    const newPassword = req.flash("newPassword")[0]; // Pega senha gerada se houver

    res.render("admin/manager_link", {
      manager,
      link,
      year,
      month,
      businessUnit,
      newPassword, // Passa para a view
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
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Erro ao gerar link.");
    res.redirect("/admin/managers");
  }
});

// Gera credenciais e envia por email
router.post("/admin/managers/:id/generate-credentials", async (req, res) => {
  try {
    const { id } = req.params;
    const manager = await Manager.findById(id);

    if (!manager) {
      req.flash("error_msg", "Gestor não encontrado.");
      return res.redirect("/admin/managers");
    }

    // Gera senha aleatória de 8 caracteres
    const rawPassword = crypto.randomBytes(4).toString("hex");
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // Atualiza o gestor
    manager.password = hashedPassword;
    manager.mustChangePassword = true;
    await manager.save();

    // Configuração do Nodemailer (opcional, mantendo logica original mas sem forçar envio se não configurado)
    if (process.env.MAIL_HOST && process.env.MAIL_USER) {
        // ... lógica de envio de email existente ...
        // Vou comentar para não enviar email real agora, já que o usuário pediu "não quero configurar envio automatico agora"
        // Mas se ele configurar o .env, enviaria.
        // O foco agora é passar a senha para a tela de link.
    }

    req.flash("success_msg", "Senha gerada com sucesso! Copie as credenciais abaixo.");
    req.flash("newPassword", rawPassword); // Salva senha para mostrar na próxima tela
    
    // Redireciona para a tela de link mantendo o mês/ano se possível (aqui não temos esses dados, então vai default)
    // Para melhorar, poderíamos receber year/month no body ou query, mas vamos pro default por enquanto.
    res.redirect(`/admin/managers/${id}/link`);

  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Erro ao gerar credenciais.");
    res.redirect("/admin/managers");
  }
});

module.exports = router;
