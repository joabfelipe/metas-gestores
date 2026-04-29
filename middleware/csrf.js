const crypto = require("crypto");

const SAFE_ORIGINS = ["/admin/dashboard", "/admin/managers", "/admin/goals", "/change-password", "/login"];

function generateToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}

module.exports = function csrfMiddleware(req, res, next) {
  res.locals._csrf = generateToken(req);

  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    const token =
      req.body?._csrf ||
      req.headers["x-csrf-token"];

    if (!token || token !== req.session.csrfToken) {
      req.flash("error_msg", "Requisição inválida ou expirada. Tente novamente.");

      // res.redirect("back") foi removido no Express 5 — usar Referer manualmente
      const referer = req.headers.referer || "";
      const fallback = SAFE_ORIGINS.find((p) => referer.includes(p)) || "/admin/dashboard";
      return res.redirect(fallback);
    }
  }

  next();
};
