const { AppError } = require("./errors");

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const NICKNAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

function validateParam(name, pattern) {
  return (req, _res, next) => {
    const value = req.params[name];
    if (!pattern.test(value)) return next(new AppError(400, `Invalid ${name}`, "INVALID_PARAMETER"));
    next();
  };
}

module.exports = {
  validateMatchId: validateParam("matchId", ID_PATTERN),
  validatePlayerId: validateParam("playerId", ID_PATTERN),
  validateNickname: validateParam("nickname", NICKNAME_PATTERN)
};
