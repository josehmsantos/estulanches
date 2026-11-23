const repo = require('../repositories/product-repository');
const { productSchema } = require('../services/validation');
const { AppError } = require('../errors');

const parseId = (id) => {
  const value = Number(id);
  if (!Number.isInteger(value) || value < 1) throw new AppError(400, 'Identificador inválido.');
  return value;
};
const list = async (_req, res) => res.json(await repo.list());
const get = async (req, res) => {
  const product = await repo.get(parseId(req.params.id));
  if (!product) throw new AppError(404, 'Produto não encontrado.');
  res.json(product);
};
const create = async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Dados do produto inválidos.');
  res.status(201).json(await repo.create(parsed.data));
};
const update = async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Dados do produto inválidos.');
  const product = await repo.update(parseId(req.params.id), parsed.data);
  if (!product) throw new AppError(404, 'Produto não encontrado.');
  res.json(product);
};
const remove = async (req, res) => {
  if (!await repo.remove(parseId(req.params.id))) throw new AppError(404, 'Produto não encontrado.');
  res.status(204).end();
};
module.exports = { list, get, create, update, remove };
