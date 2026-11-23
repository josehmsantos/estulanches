const API = '/api';
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
const state = { products: [], orders: [] };
const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (!response.ok) { let body = {}; try { body = await response.json(); } catch {} throw new Error(body.error || `Erro ${response.status}`); }
  return response.status === 204 ? null : response.json();
}
function toast(message) { const box = $('#toast'); box.textContent = message; box.classList.add('show'); setTimeout(() => box.classList.remove('show'), 2800); }
function showView(name) {
  document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.id === `${name}-view`));
  document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.dataset.view === name));
  if (name === 'orders') loadOrders();
  if (name === 'new-order') renderOrderProducts();
}
document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
async function loadHealth() {
  try { await request('/health'); $('#health').textContent = '● Sistema operacional'; }
  catch { $('#health').textContent = '● Sem conexão'; $('#health').classList.add('bad'); }
}
async function loadProducts() {
  state.products = await request(`${API}/products`);
  const host = $('#products');
  host.replaceChildren();
  if (!state.products.length) { host.innerHTML = '<div class="empty">Nenhum produto cadastrado ainda.</div>'; return; }
  state.products.forEach((p) => {
    const card = document.createElement('article'); card.className = 'product-card';
    card.innerHTML = `<div class="product-meta"><span class="category">${escape(p.category)}</span><span class="availability ${p.available ? '' : 'off'}">${p.available ? '● Disponível' : '● Indisponível'}</span></div><h3>${escape(p.name)}</h3><p>${escape(p.description || 'Preparado com carinho na cantina.')}</p><div class="card-bottom"><span class="price">${money(p.price)}</span><span class="card-actions"><button class="small-button edit">Editar</button><button class="small-button delete">Excluir</button></span></div>`;
    card.querySelector('.edit').addEventListener('click', () => openProduct(p));
    card.querySelector('.delete').addEventListener('click', async () => { if (!confirm(`Excluir ${p.name}?`)) return; try { await request(`${API}/products/${p.id}`, { method: 'DELETE' }); toast('Produto excluído.'); await loadProducts(); } catch (e) { toast(e.message); } });
    host.append(card);
  });
}
function openProduct(product = null) {
  const form = $('#product-form'); form.classList.remove('hidden'); form.reset();
  form.elements.id.value = product?.id || '';
  form.elements.name.value = product?.name || '';
  form.elements.category.value = product?.category || '';
  form.elements.price.value = product?.price || '';
  form.elements.description.value = product?.description || '';
  form.elements.available.checked = product?.available ?? true;
  $('#product-form-title').textContent = product ? 'Editar produto' : 'Novo produto';
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
$('#new-product').addEventListener('click', () => openProduct());
['close-product', 'cancel-product'].forEach((id) => $(`#${id}`).addEventListener('click', () => $('#product-form').classList.add('hidden')));
$('#product-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; const id = form.elements.id.value;
  const product = { name: form.elements.name.value, category: form.elements.category.value, price: Number(form.elements.price.value), description: form.elements.description.value, available: form.elements.available.checked };
  try { await request(`${API}/products${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(product) }); $('#product-form').classList.add('hidden'); toast(id ? 'Produto atualizado.' : 'Produto cadastrado.'); await loadProducts(); }
  catch (error) { toast(error.message); }
});
function renderOrderProducts() {
  const host = $('#order-products'); host.replaceChildren();
  const available = state.products.filter((p) => p.available);
  if (!available.length) { host.innerHTML = '<div class="empty">Não há produtos disponíveis.</div>'; updateSummary(); return; }
  available.forEach((p) => {
    const row = document.createElement('label'); row.className = 'pick-product';
    row.innerHTML = `<input type="checkbox" data-id="${p.id}"><span class="pick-name">${escape(p.name)}</span><span class="pick-price">${money(p.price)}</span><input type="number" min="1" value="1" aria-label="Quantidade de ${escape(p.name)}">`;
    row.querySelectorAll('input').forEach((input) => input.addEventListener('change', updateSummary)); host.append(row);
  }); updateSummary();
}
function selectedItems() {
  return [...$('#order-products').querySelectorAll('.pick-product')].filter((row) => row.querySelector('[type=checkbox]').checked).map((row) => ({ productId: Number(row.querySelector('[type=checkbox]').dataset.id), quantity: Math.max(1, Number(row.querySelector('[type=number]').value) || 1) }));
}
function updateSummary() {
  const items = selectedItems(); const lines = $('#order-lines'); lines.replaceChildren();
  if (!items.length) lines.textContent = 'Adicione itens ao pedido.';
  let total = 0;
  items.forEach((item) => { const product = state.products.find((p) => p.id === item.productId); total += Number(product.price) * item.quantity; const line = document.createElement('div'); line.className = 'line-item'; line.innerHTML = `<span>${item.quantity} × ${escape(product.name)}</span><strong>${money(Number(product.price) * item.quantity)}</strong>`; lines.append(line); });
  $('#order-total').textContent = money(total);
}
$('#order-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; const items = selectedItems(); if (!items.length) { toast('Escolha ao menos um item.'); return; }
  try { await request(`${API}/orders`, { method: 'POST', body: JSON.stringify({ customerName: form.elements.customerName.value, items }) }); form.reset(); renderOrderProducts(); toast('Pedido registrado com sucesso.'); showView('orders'); }
  catch (error) { toast(error.message); }
});
const statuses = ['RECEBIDO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO'];
async function loadOrders() {
  try {
    state.orders = await request(`${API}/orders`); $('#order-count').textContent = state.orders.length;
    const host = $('#orders'); host.replaceChildren();
    if (!state.orders.length) { host.innerHTML = '<div class="empty">Ainda não há pedidos. Que tal registrar o primeiro?</div>'; return; }
    state.orders.forEach((order) => {
      const card = document.createElement('article'); card.className = 'order-card';
      const date = new Date(order.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      card.innerHTML = `<div><h3>Pedido #${order.id} · ${escape(order.customer_name)}</h3><p>${date}</p></div><div class="order-detail">${order.items.map((i) => `${i.quantity} × ${escape(i.product_name)}`).join('<br>')}</div><div class="order-state"><strong class="price">${money(order.total)}</strong><select class="status-select" aria-label="Status do pedido ${order.id}">${statuses.map((s) => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}</select></div>`;
      card.querySelector('select').addEventListener('change', async (e) => { try { await request(`${API}/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) }); toast('Status atualizado.'); await loadOrders(); } catch (error) { toast(error.message); } }); host.append(card);
    });
  } catch (error) { toast(error.message); }
}
$('#refresh-orders').addEventListener('click', loadOrders);
Promise.all([loadHealth(), loadProducts()]).catch((error) => toast(error.message));
