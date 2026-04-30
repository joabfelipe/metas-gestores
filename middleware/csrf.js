const crypto = require("crypto");

const SAFE_ORIGINS = [
  "/admin/dashboard",
  "/admin/managers",
  "/admin/goals",
  "/change-password",
  "/login",
  "/g/",
];

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

    // Debug temporário — remover após confirmar que parou de falhar
    console.log("[CSRF DEBUG]", {
      url:       req.originalUrl,
      sessionID: req.sessionID?.slice(0, 12) + "...",
      submitted: submitted?.slice(0, 12) + "...",
      expected:  expected?.slice(0, 12) + "...",
      match:     submitted === expected,
      bodyKeys:  Object.keys(req.body || {}),
    });

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
