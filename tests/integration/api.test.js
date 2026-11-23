const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/db');
const { ensureSchema } = require('../../src/bootstrap');

// Estes testes usam a API real (Express) conectada ao PostgreSQL real. Tudo o que criam é removido ao final.
describe('API EstuLanches + PostgreSQL', () => {
  const token = `Teste-${Date.now()}`;
  const produtos = [];
  const pedidos = [];
  const novoProduto = async (extra = {}) => {
    const res = await request(app).post('/api/products')
      .send({ name: `${token}-${produtos.length}`, description: 'Produto de teste', price: 6.25, category: 'Teste', available: true, ...extra }).expect(201);
    produtos.push(res.body.id);
    return res.body;
  };
  const novoPedido = async (productId, quantity = 1) => {
    const res = await request(app).post('/api/orders').send({ customerName: token, items: [{ productId, quantity }] }).expect(201);
    pedidos.push(res.body.id);
    return res.body;
  };

  afterAll(async () => {
    if (pedidos.length) await pool.query('DELETE FROM orders WHERE id = ANY($1::int[])', [pedidos]);
    if (produtos.length) await pool.query('DELETE FROM products WHERE id = ANY($1::int[])', [produtos]);
    await pool.end();
  });

  describe('saúde e infraestrutura', () => {
    test('/health confirma API e banco conectados', async () => {
      const res = await request(app).get('/health').expect(200);
      expect(res.body).toEqual({ status: 'ok', database: 'connected' });
    });
    test('o banco foi inicializado com as 3 tabelas e o cardápio inicial', async () => {
      const tabelas = (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows.map((r) => r.table_name);
      expect(tabelas).toEqual(expect.arrayContaining(['products', 'orders', 'order_items']));
      expect((await request(app).get('/api/products').expect(200)).body.length).toBeGreaterThanOrEqual(1);
    });
    test('o cardápio inicial tem os 6 produtos e rodar a inicialização de novo não duplica nada', async () => {
      await ensureSchema(pool);
      await ensureSchema(pool);
      const nomes = (await request(app).get('/api/products').expect(200)).body.map((p) => p.name);
      ['Pão de queijo', 'Coxinha', 'Suco de laranja', 'Água mineral', 'Brigadeiro', 'Sanduíche natural']
        .forEach((nome) => expect(nomes.filter((n) => n === nome)).toHaveLength(1));
    });
    test('envia cabeçalhos de segurança e rota inexistente retorna 404 em JSON', async () => {
      const res = await request(app).get('/api/nao-existe').expect(404);
      expect(res.body.error).toMatch(/não encontrada/i);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('cardápio (produtos)', () => {
    test('cria, consulta, edita e exclui um produto', async () => {
      const criado = await novoProduto();
      expect(criado.price).toBe('6.25');
      await request(app).get(`/api/products/${criado.id}`).expect(200).expect(({ body }) => expect(body.name).toBe(criado.name));
      const editado = await request(app).put(`/api/products/${criado.id}`)
        .send({ name: criado.name, description: 'Nova', price: 7.5, category: 'Teste', available: false }).expect(200);
      expect(editado.body).toMatchObject({ description: 'Nova', price: '7.50', available: false });
      await request(app).delete(`/api/products/${criado.id}`).expect(204);
      await request(app).get(`/api/products/${criado.id}`).expect(404);
    });
    test('rejeita dados inválidos com 400', async () => {
      await request(app).post('/api/products').send({ name: 'Inválido', price: -2, category: 'Teste' }).expect(400);
      await request(app).post('/api/products').send({ name: '', price: 2, category: 'Teste' }).expect(400);
      await request(app).post('/api/products').send({ name: 'X', price: 2, category: 'T', id: 5 }).expect(400);
    });
    test('identificador inválido retorna 400 e inexistente retorna 404', async () => {
      await request(app).get('/api/products/abc').expect(400);
      await request(app).get('/api/products/0').expect(400);
      await request(app).get('/api/products/99999999').expect(404);
      await request(app).delete('/api/products/99999999').expect(404);
    });
    test('REGRESSÃO: excluir produto já usado em pedido retorna 409 (antes era 500) e preserva o histórico', async () => {
      const produto = await novoProduto();
      const pedido = await novoPedido(produto.id, 2);
      const res = await request(app).delete(`/api/products/${produto.id}`).expect(409);
      expect(res.body.error).toMatch(/indispon/i);
      await request(app).get(`/api/products/${produto.id}`).expect(200);
      await request(app).get(`/api/orders/${pedido.id}`).expect(200);
    });
  });

  describe('pedidos', () => {
    test('fluxo completo: cria, calcula total no servidor, muda status, consulta e cancela', async () => {
      const produto = await novoProduto();
      const pedido = await novoPedido(produto.id, 2);
      expect(Number(pedido.total)).toBe(12.5);
      expect(pedido.status).toBe('RECEBIDO');
      await request(app).patch(`/api/orders/${pedido.id}/status`).send({ status: 'EM_PREPARO' }).expect(200);
      await request(app).get(`/api/orders/${pedido.id}`).expect(200).expect(({ body }) => {
        expect(body.status).toBe('EM_PREPARO');
        expect(body.items).toHaveLength(1);
        expect(body.items[0]).toMatchObject({ product_name: produto.name, quantity: 2 });
      });
      await request(app).patch(`/api/orders/${pedido.id}/status`).send({ status: 'CANCELADO' }).expect(200);
      await request(app).get('/api/orders').expect(200).expect(({ body }) => expect(body.some((p) => p.id === pedido.id)).toBe(true));
    });
    test('o preço gravado no pedido é o do banco, mesmo se o produto mudar depois', async () => {
      const produto = await novoProduto({ price: 10 });
      const pedido = await novoPedido(produto.id, 1);
      await request(app).put(`/api/products/${produto.id}`).send({ name: produto.name, price: 99, category: 'Teste', available: true }).expect(200);
      const salvo = (await request(app).get(`/api/orders/${pedido.id}`).expect(200)).body;
      expect(Number(salvo.total)).toBe(10);
      expect(Number(salvo.items[0].unit_price)).toBe(10);
    });
    test('não aceita total enviado pelo cliente', async () => {
      const produto = await novoProduto();
      await request(app).post('/api/orders').send({ customerName: token, total: 0.01, items: [{ productId: produto.id, quantity: 1 }] }).expect(400);
    });
    test('rejeita pedido sem itens, produto indisponível e produto inexistente', async () => {
      await request(app).post('/api/orders').send({ customerName: token, items: [] }).expect(400);
      const indisponivel = await novoProduto({ available: false });
      const res = await request(app).post('/api/orders').send({ customerName: token, items: [{ productId: indisponivel.id, quantity: 1 }] }).expect(400);
      expect(res.body.error).toMatch(/indispon/i);
      await request(app).post('/api/orders').send({ customerName: token, items: [{ productId: 99999999, quantity: 1 }] }).expect(404);
    });
    test('status inválido retorna 400; pedido inexistente retorna 404', async () => {
      await request(app).patch('/api/orders/1/status').send({ status: 'ATRASADO' }).expect(400);
      await request(app).patch('/api/orders/99999999/status').send({ status: 'PRONTO' }).expect(404);
      await request(app).get('/api/orders/99999999').expect(404);
      await request(app).get('/api/orders/abc').expect(400);
    });
    test('pedido e itens são gravados juntos (nenhum pedido órfão sem itens)', async () => {
      const orfaos = await pool.query('SELECT o.id FROM orders o LEFT JOIN order_items i ON i.order_id=o.id WHERE i.id IS NULL');
      expect(orfaos.rows).toEqual([]);
    });
  });
});
