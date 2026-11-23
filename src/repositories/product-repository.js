const { pool } = require('../db');
const { AppError } = require('../errors');

const list = async () => (await pool.query('SELECT * FROM products ORDER BY id')).rows;
const get = async (id) => (await pool.query('SELECT * FROM products WHERE id = $1', [id])).rows[0] || null;
const create = async (p) => (await pool.query(
  'INSERT INTO products(name,description,price,category,available) VALUES($1,$2,$3,$4,$5) RETURNING *',
  [p.name, p.description, p.price, p.category, p.available]
)).rows[0];
const update = async (id, p) => (await pool.query(
  'UPDATE products SET name=$1,description=$2,price=$3,category=$4,available=$5 WHERE id=$6 RETURNING *',
  [p.name, p.description, p.price, p.category, p.available, id]
)).rows[0] || null;
async function remove(id) {
  try {
    return (await pool.query('DELETE FROM products WHERE id=$1 RETURNING id', [id])).rowCount > 0;
  } catch (error) {
    // 23503 = violação de chave estrangeira: o produto já consta em pedidos e deve ser preservado no histórico.
    if (error.code === '23503') throw new AppError(409, 'Este produto já foi usado em pedidos e não pode ser excluído. Marque-o como indisponível.');
    throw error;
  }
}
const getProductsByIds = async (ids) => (await pool.query('SELECT * FROM products WHERE id=ANY($1::int[])', [ids])).rows;

module.exports = { list, get, create, update, remove, getProductsByIds };
