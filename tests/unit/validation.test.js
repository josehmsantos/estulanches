const { productSchema, orderSchema, statusSchema } = require('../../src/services/validation');

const produtoValido = { name: 'Água', description: '', price: 0, category: 'Bebidas', available: true };

describe('productSchema', () => {
  test('aceita produto válido, inclusive com preço zero', () => {
    expect(productSchema.safeParse(produtoValido).success).toBe(true);
  });
  test('usa valores padrão para descrição e disponibilidade', () => {
    const r = productSchema.parse({ name: 'Bala', price: 1, category: 'Doces' });
    expect(r.description).toBe('');
    expect(r.available).toBe(true);
  });
  test('remove espaços nas pontas dos textos', () => {
    expect(productSchema.parse({ ...produtoValido, name: '  Coxinha  ' }).name).toBe('Coxinha');
  });
  test('recusa preço negativo, com 3 casas decimais ou não numérico', () => {
    expect(productSchema.safeParse({ ...produtoValido, price: -1 }).success).toBe(false);
    expect(productSchema.safeParse({ ...produtoValido, price: 1.234 }).success).toBe(false);
    expect(productSchema.safeParse({ ...produtoValido, price: 'abc' }).success).toBe(false);
  });
  test('recusa nome vazio, só espaços ou maior que 120 caracteres', () => {
    expect(productSchema.safeParse({ ...produtoValido, name: '' }).success).toBe(false);
    expect(productSchema.safeParse({ ...produtoValido, name: '   ' }).success).toBe(false);
    expect(productSchema.safeParse({ ...produtoValido, name: 'a'.repeat(121) }).success).toBe(false);
  });
  test('recusa campos desconhecidos (proteção contra injeção de campos)', () => {
    expect(productSchema.safeParse({ ...produtoValido, id: 7 }).success).toBe(false);
  });
});

describe('orderSchema', () => {
  test('aceita pedido válido', () => {
    expect(orderSchema.safeParse({ customerName: 'Bia', items: [{ productId: 1, quantity: 2 }] }).success).toBe(true);
  });
  test('recusa pedido sem itens, quantidade fracionada, zero ou acima do máximo', () => {
    expect(orderSchema.safeParse({ customerName: 'Bia', items: [] }).success).toBe(false);
    expect(orderSchema.safeParse({ customerName: 'Bia', items: [{ productId: 1, quantity: 1.5 }] }).success).toBe(false);
    expect(orderSchema.safeParse({ customerName: 'Bia', items: [{ productId: 1, quantity: 0 }] }).success).toBe(false);
    expect(orderSchema.safeParse({ customerName: 'Bia', items: [{ productId: 1, quantity: 10001 }] }).success).toBe(false);
  });
  test('recusa nome do cliente vazio', () => {
    expect(orderSchema.safeParse({ customerName: '  ', items: [{ productId: 1, quantity: 1 }] }).success).toBe(false);
  });
  test('recusa total enviado pelo cliente (o servidor é quem calcula)', () => {
    expect(orderSchema.safeParse({ customerName: 'Bia', total: 0.01, items: [{ productId: 1, quantity: 1 }] }).success).toBe(false);
  });
});

describe('statusSchema', () => {
  test.each(['RECEBIDO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO'])('aceita %s', (status) => {
    expect(statusSchema.safeParse({ status }).success).toBe(true);
  });
  test('recusa status inexistente ou em minúsculas', () => {
    expect(statusSchema.safeParse({ status: 'ATRASADO' }).success).toBe(false);
    expect(statusSchema.safeParse({ status: 'pronto' }).success).toBe(false);
  });
});
