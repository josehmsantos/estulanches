const { z } = require('zod');

const productSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
  price: z.coerce.number().finite().min(0).max(99999999.99)
    .refine((price) => Math.abs(price * 100 - Math.round(price * 100)) < 1e-8, 'O preço deve ter no máximo duas casas decimais.'),
  category: z.string().trim().min(1).max(60),
  available: z.boolean().default(true)
}).strict();

const orderSchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(10000)
  }).strict()).min(1)
}).strict();

const statusSchema = z.object({
  status: z.enum(['RECEBIDO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO'])
}).strict();

module.exports = { productSchema, orderSchema, statusSchema };
