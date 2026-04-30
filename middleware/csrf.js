const crypto = require("crypto");

const SAFE_ORIGINS = [
  "/admin/dashboard",
  "/admin/managers",
  "/admin/goals",
  "/change-password",
  "/login",
  "/g/",
];

/**
 * Gera um token CSRF determinístico: HMAC-SHA256(sessionID, SESSION_SECRET).
 * Não precisa ser salvo na sessão — é recalculado a cada request a partir
 * do session ID (que já está no cookie do usuário) e do secret do servidor.
 * Isso elimina qualquer problema de timing com o MongoStore.
 */
function generateToken(sessionId) {
  return crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(sessionId)
    .digest("hex");
}

module.exports = function csrfMiddleware(req, res, next) {
  res.locals._csrf = generateToken(req.sessionID);

  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    const submitted =
      req.body?._csrf ||
      req.headers["x-csrf-token"];

    const expected = generateToken(req.sessionID);

    if (!submitted || submitted !== expected) {
      req.flash("error_msg", "Requisição inválida ou expirada. Tente novamente.");
      const referer = req.headers.referer || "";
      const fallback =
        SAFE_ORIGINS.find((p) => referer.includes(p)) || "/admin/dashboard";
      return res.redirect(fallback);
    }
  }

  next();
};
