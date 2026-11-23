const { calculateTotal, buildOrder } = require('../../src/services/order-service');

const produto = (extra = {}) => ({ id: 1, name: 'Suco', price: '4.50', available: true, ...extra });
const repoDeProdutos = (lista) => ({ getProductsByIds: jest.fn().mockResolvedValue(lista) });

describe('calculateTotal (cálculo do total no servidor)', () => {
  test('soma preço x quantidade com centavos', () => {
    expect(calculateTotal([{ price: '4.50', quantity: 2 }, { price: '3.25', quantity: 1 }])).toBe(12.25);
  });
  test('não sofre erro de ponto flutuante (0,10 x 3 = 0,30)', () => {
    expect(calculateTotal([{ price: '0.10', quantity: 3 }])).toBe(0.3);
    expect(calculateTotal([{ price: '0.20', quantity: 1 }, { price: '0.10', quantity: 1 }])).toBe(0.3);
  });
  test('lista vazia resulta em zero', () => {
    expect(calculateTotal([])).toBe(0);
  });
  test('recusa total acima do limite permitido', () => {
    expect(() => calculateTotal([{ price: '99999999.99', quantity: 10000 }])).toThrow(/limite/i);
  });
});

describe('buildOrder (regras de negócio do pedido)', () => {
  test('recusa pedido sem itens', async () => {
    await expect(buildOrder({}, {}, { customerName: 'Ana', items: [] })).rejects.toMatchObject({ status: 400 });
  });
  test('recusa quantidade menor que um ou fracionada', async () => {
    const repo = repoDeProdutos([]);
    await expect(buildOrder(repo, {}, { customerName: 'Ana', items: [{ productId: 1, quantity: 0 }] })).rejects.toMatchObject({ status: 400 });
    await expect(buildOrder(repo, {}, { customerName: 'Ana', items: [{ productId: 1, quantity: 1.5 }] })).rejects.toMatchObject({ status: 400 });
    expect(repo.getProductsByIds).not.toHaveBeenCalled();
  });
  test('recusa produto inexistente com 404', async () => {
    await expect(buildOrder(repoDeProdutos([]), {}, { customerName: 'Ana', items: [{ productId: 99, quantity: 1 }] }))
      .rejects.toMatchObject({ status: 404 });
  });
  test('recusa produto indisponível', async () => {
    const repo = repoDeProdutos([produto({ available: false })]);
    await expect(buildOrder(repo, {}, { customerName: 'Ana', items: [{ productId: 1, quantity: 1 }] }))
      .rejects.toMatchObject({ status: 400, message: expect.stringMatching(/indispon/i) });
  });
  test('calcula e persiste o total usando o preço do banco', async () => {
    const orderRepo = { createOrder: jest.fn(async (order) => order) };
    const result = await buildOrder(repoDeProdutos([produto()]), orderRepo, { customerName: 'Ana', items: [{ productId: 1, quantity: 2 }] });
    expect(result.total).toBe(9);
    expect(orderRepo.createOrder).toHaveBeenCalledWith(expect.objectContaining({ customerName: 'Ana', total: 9 }));
  });
  test('consulta cada produto uma única vez mesmo se repetido nos itens', async () => {
    const repo = repoDeProdutos([produto()]);
    const orderRepo = { createOrder: jest.fn(async (order) => order) };
    const result = await buildOrder(repo, orderRepo, { customerName: 'Ana', items: [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 2 }] });
    expect(repo.getProductsByIds).toHaveBeenCalledWith([1]);
    expect(result.total).toBe(13.5);
  });
});
