require("dotenv").config();

const REQUIRED_ENV = ["SESSION_SECRET", "MONGO_URI"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Variável de ambiente obrigatória não definida: ${key}`);
    process.exit(1);
  }
}

const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const mongoose = require("mongoose");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const helmet = require("helmet");

const adminGoals = require("./routes/adminGoals");
const managerFill = require("./routes/managerFill");
const authRoutes = require("./routes/auth");

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layouts/app");
app.use(expressLayouts);
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      sameSite: "lax",   // já bloqueia CSRF cross-origin
    },
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
      ttl: 60 * 60 * 24,
    }),
  })
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg   = req.flash("error_msg");
  res.locals.error       = req.flash("error");
  res.locals.user        = req.session.user || null;
  next();
});

app.use(adminGoals);
app.use(managerFill);
app.use(authRoutes);

app.get("/", (req, res) => res.redirect("/admin/dashboard"));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Mongo conectado");
    app.listen(process.env.PORT || 3000, () => {
      console.log(`✅ Rodando em http://localhost:${process.env.PORT || 3000}`);
    });
  })
  .catch((err) => console.error("❌ Erro ao conectar no Mongo:", err));
