const { AppError } = require('../errors');

function calculateTotal(items) {
  const cents = items.reduce((sum, item) => {
    const [whole, fraction = ''] = Number(item.price).toFixed(2).split('.');
    return sum + (BigInt(whole) * 100n + BigInt(fraction)) * BigInt(item.quantity);
  }, 0n);
  if (cents > 9999999999n) throw new AppError(400, 'O total do pedido excede o limite permitido.');
  return Number(cents) / 100;
}

async function buildOrder(productRepository, orderRepository, input) {
  if (!input.items.length) throw new AppError(400, 'O pedido precisa ter ao menos um item.');
  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new AppError(400, 'A quantidade deve ser maior que zero.');
  }
  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const products = await productRepository.getProductsByIds(productIds);
  const byId = new Map(products.map((product) => [Number(product.id), product]));
  const lines = input.items.map((item) => {
    const product = byId.get(Number(item.productId));
    if (!product) throw new AppError(404, `Produto ${item.productId} não encontrado.`);
    if (!product.available) throw new AppError(400, `Produto indisponível: ${product.name}.`);
    if (Number(product.price) < 0) throw new AppError(400, 'Preço inválido.');
    return { productId: product.id, productName: product.name, quantity: item.quantity, unitPrice: product.price };
  });
  const total = calculateTotal(lines.map((item) => ({ price: item.unitPrice, quantity: item.quantity })));
  return orderRepository.createOrder({ customerName: input.customerName, total, items: lines });
}

module.exports = { calculateTotal, buildOrder };
