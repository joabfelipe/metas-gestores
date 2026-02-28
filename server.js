require("dotenv").config();
const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const mongoose = require("mongoose");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const Manager = require("./models/Manager");

const adminGoals = require("./routes/adminGoals");
const managerFill = require("./routes/managerFill");
const authRoutes = require("./routes/auth");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layouts/app");
app.use(expressLayouts);
app.use(express.static(path.join(__dirname, "public")));

// Configuração de Sessão e Flash Messages
app.use(
  session({
    secret: process.env.SESSION_SECRET || "segredo_padrao_metas",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 dia
  })
);
app.use(flash());

// Middleware para disponibilizar variáveis globais nas views
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  res.locals.user = req.session.user || null;
  next();
});

app.use(adminGoals);
app.use(managerFill);
app.use(authRoutes);

app.get("/", (req, res) => res.redirect("/admin/managers"));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Mongo conectado");
    app.listen(process.env.PORT || 3000, () => {
      console.log(`✅ Rodando em http://localhost:${process.env.PORT || 3000}`);
    });
  })
  .catch((err) => console.error("❌ Erro ao conectar no Mongo:", err));
