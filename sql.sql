CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL CHECK (length(trim(name)) > 0),
  description VARCHAR(500) NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  category VARCHAR(60) NOT NULL,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(120) NOT NULL CHECK (length(trim(customer_name)) > 0),
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'RECEBIDO'
    CHECK (status IN ('RECEBIDO','EM_PREPARO','PRONTO','ENTREGUE','CANCELADO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name VARCHAR(120) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0)
);

-- Cardápio inicial: só é cadastrado quando a tabela está vazia (pode rodar quantas vezes precisar sem duplicar).
INSERT INTO products (name, description, price, category)
SELECT * FROM (VALUES
  ('Pão de queijo', 'Unidade assada na hora', 4.50, 'Salgados'),
  ('Coxinha', 'Frango com massa crocante', 7.00, 'Salgados'),
  ('Suco de laranja', 'Caixinha 200 ml', 5.00, 'Bebidas'),
  ('Água mineral', 'Garrafa 500 ml', 3.00, 'Bebidas'),
  ('Brigadeiro', 'Doce de chocolate', 3.50, 'Doces'),
  ('Sanduíche natural', 'Frango, cenoura e alface', 9.50, 'Lanches')
) AS cardapio(name, description, price, category)
WHERE NOT EXISTS (SELECT 1 FROM products);
