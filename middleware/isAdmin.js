module.exports = (req, res, next) => {
  if (req.session.user && req.session.user.role === "admin") {
    return next();
  }
  req.flash("error_msg", "Acesso restrito. Faça login como administrador.");
  return res.redirect("/login");
};
