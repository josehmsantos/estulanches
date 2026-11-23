jest.mock('../../src/db', () => ({ pool: { query: jest.fn() } }));
const { pool } = require('../../src/db');
const repo = require('../../src/repositories/product-repository');

describe('product-repository.remove', () => {
  test('retorna true quando exclui e false quando o produto não existe', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rowCount: 0 });
    await expect(repo.remove(1)).resolves.toBe(true);
    await expect(repo.remove(2)).resolves.toBe(false);
  });
  test('converte violação de chave estrangeira (produto já pedido) em erro 409', async () => {
    pool.query.mockRejectedValueOnce(Object.assign(new Error('fk'), { code: '23503' }));
    await expect(repo.remove(1)).rejects.toMatchObject({ status: 409 });
  });
  test('repassa qualquer outro erro do banco sem alterar', async () => {
    const falha = Object.assign(new Error('banco fora do ar'), { code: '57P01' });
    pool.query.mockRejectedValueOnce(falha);
    await expect(repo.remove(1)).rejects.toBe(falha);
  });
});
