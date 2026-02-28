const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Manager = require("../models/Manager");

// Render Login Page
router.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/manager/dashboard");
  }
  res.render("auth/login", { layout: "layouts/auth" });
});

// Handle Login
router.post("/login", async (req, res) => {
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

    // Login successful
    req.session.user = {
      id: manager._id,
      name: manager.name,
      email: manager.email,
      role: "manager", // or check if admin
      mustChangePassword: manager.mustChangePassword
    };

    if (manager.mustChangePassword) {
      req.flash("success_msg", "Por favor, altere sua senha no primeiro acesso.");
      return res.redirect("/change-password");
    }

    req.flash("success_msg", "Login realizado com sucesso!");
    res.redirect("/manager/dashboard"); // New dashboard route
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

  if (password !== confirmPassword) {
    req.flash("error_msg", "As senhas não coincidem.");
    return res.redirect("/change-password");
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await Manager.findByIdAndUpdate(req.session.user.id, {
      password: hashedPassword,
      mustChangePassword: false
    });

    req.session.user.mustChangePassword = false;
    req.flash("success_msg", "Senha alterada com sucesso!");
    res.redirect("/manager/dashboard");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Erro ao alterar senha.");
    res.redirect("/change-password");
  }
});

module.exports = router;
