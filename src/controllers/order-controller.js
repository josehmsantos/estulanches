const repo = require('../repositories/order-repository');
const productRepo = require('../repositories/product-repository');
const { orderSchema, statusSchema } = require('../services/validation');
const { buildOrder } = require('../services/order-service');
const { AppError } = require('../errors');
const parseId = (id) => {
  const value = Number(id);
  if (!Number.isInteger(value) || value < 1) throw new AppError(400, 'Identificador inválido.');
  return value;
};
const list = async (_req, res) => res.json(await repo.list());
const get = async (req, res) => {
  const order = await repo.get(parseId(req.params.id));
  if (!order) throw new AppError(404, 'Pedido não encontrado.');
  res.json(order);
};
const create = async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Dados do pedido inválidos. Verifique cliente, itens e quantidades.');
  res.status(201).json(await buildOrder(productRepo, repo, parsed.data));
};
const updateStatus = async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Status inválido.');
  const order = await repo.updateStatus(parseId(req.params.id), parsed.data.status);
  if (!order) throw new AppError(404, 'Pedido não encontrado.');
  res.json(order);
};
module.exports = { list, get, create, updateStatus };
