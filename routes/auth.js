const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const Manager = require("../models/Manager");

// Rate limiting: máximo 10 tentativas de login por IP a cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: (req, res) => {
    req.flash("error_msg", "Muitas tentativas de login. Aguarde 15 minutos e tente novamente.");
    res.redirect("/login");
  },
  skipSuccessfulRequests: true,
});

// Render Login Page
router.get("/login", (req, res) => {
  if (req.session.user) {
    const dest = req.session.user.role === "admin" ? "/admin/dashboard" : "/manager/dashboard";
    return res.redirect(dest);
  }
  res.render("auth/login", { layout: "layouts/auth" });
});

// Handle Login
router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  try {
    const manager = await Manager.findOne({ email });
    if (!manager) {
      req.flash("error_msg", "Usuário não encontrado.");
      return res.redirect("/login");
    }

    if (!manager.password) {
      req.flash("error_msg", "Sua conta ainda não possui senha. Contate o administrador.");
      return res.redirect("/login");
    }

    const isMatch = await bcrypt.compare(password, manager.password);
    if (!isMatch) {
      req.flash("error_msg", "Senha incorreta.");
      return res.redirect("/login");
    }

    const userData = {
      id: manager._id,
      name: manager.name,
      email: manager.email,
      role: manager.isAdmin ? "admin" : "manager",
      mustChangePassword: manager.mustChangePassword,
    };

    // Correção: regenerar session ID após login para prevenir session fixation
    req.session.regenerate((err) => {
      if (err) {
        console.error("Erro ao regenerar sessão:", err);
        req.flash("error_msg", "Erro ao realizar login. Tente novamente.");
        return res.redirect("/login");
      }

      req.session.user = userData;

      if (manager.mustChangePassword) {
        req.flash("success_msg", "Por favor, altere sua senha no primeiro acesso.");
        return res.redirect("/change-password");
      }

      req.flash("success_msg", "Login realizado com sucesso!");
      const destination = manager.isAdmin ? "/admin/dashboard" : "/manager/dashboard";
      res.redirect(destination);
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Erro ao realizar login.");
    res.redirect("/login");
  }
});

// Logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// Change Password Page
router.get("/change-password", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("auth/change-password", { layout: "layouts/auth" });
});

// Handle Change Password
router.post("/change-password", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const { password, confirmPassword } = req.body;

  // Validação de tamanho mínimo de senha
  if (!password || password.length < 8) {
    req.flash("error_msg", "A senha deve ter no mínimo 8 caracteres.");
    return res.redirect("/change-password");
  }

  if (password !== confirmPassword) {
    req.flash("error_msg", "As senhas não coincidem.");
    return res.redirect("/change-password");
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await Manager.findByIdAndUpdate(req.session.user.id, {
      password: hashedPassword,
      mustChangePassword: false,
    });

    req.session.user.mustChangePassword = false;
    req.flash("success_msg", "Senha alterada com sucesso!");
    const dest = req.session.user.role === "admin" ? "/admin/dashboard" : "/manager/dashboard";
    res.redirect(dest);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Erro ao alterar senha.");
    res.redirect("/change-password");
  }
});

module.exports = router;
