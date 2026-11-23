const { pool } = require('../db');

async function createOrder(order) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const saved = (await client.query(
      'INSERT INTO orders(customer_name,total) VALUES($1,$2) RETURNING *',
      [order.customerName, order.total]
    )).rows[0];
    for (const item of order.items) {
      await client.query(
        'INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price) VALUES($1,$2,$3,$4,$5)',
        [saved.id, item.productId, item.productName, item.quantity, item.unitPrice]
      );
    }
    await client.query('COMMIT');
    return { ...saved, items: order.items };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function list() {
  const orders = (await pool.query('SELECT * FROM orders ORDER BY created_at DESC')).rows;
  if (!orders.length) return [];
  const items = (await pool.query('SELECT * FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id', [orders.map((o) => o.id)])).rows;
  return orders.map((order) => ({ ...order, items: items.filter((item) => item.order_id === order.id) }));
}
async function get(id) {
  const order = (await pool.query('SELECT * FROM orders WHERE id=$1', [id])).rows[0];
  if (!order) return null;
  const items = (await pool.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY id', [id])).rows;
  return { ...order, items };
}
async function updateStatus(id, status) {
  return (await pool.query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING *', [status, id])).rows[0] || null;
}
module.exports = { createOrder, list, get, updateStatus };
