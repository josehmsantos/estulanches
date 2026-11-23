// Express 4 não encaminha automaticamente rejeições de controllers async ao middleware de erro.
module.exports = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
