const crypto = require("crypto");

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
      return res.redirect("back");
    }
  }

  next();
};
