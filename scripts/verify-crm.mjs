import assert from "node:assert/strict";

// Exercise the real local Worker, D1 database, and dispatch-compatible mock auth.
const base = process.env.CRM_TEST_URL || "http://127.0.0.1:5186";
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Verification is restricted to local preview.');
assert.equal((await fetch(base + '/api/crm')).status, 401, 'Anonymous data access must be rejected');
const login = await fetch(base + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
assert.equal(login.status, 302);
const cookie = login.headers.get('set-cookie')?.split(';')[0];
assert.ok(cookie, 'Local mock sign-in must set its cookie');
const get = async () => {
  const r = await fetch(base + '/api/crm', { headers: { cookie } });
  assert.equal(r.status, 200); return r.json();
};
const post = async (action, payload, expected = 200) => {
  const r = await fetch(base + '/api/crm', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ action, payload }) });
  const body = await r.json(); assert.equal(r.status, expected, `${action}: ${JSON.stringify(body)}`); return body;
};
const label = `流程验证-${Date.now()}`;
let customerId, taskId;
try {
  const crossOrigin = await fetch(base + '/api/crm', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json', Origin: 'https://example.invalid' }, body: JSON.stringify({ action: 'seedDemo' }) });
  assert.equal(crossOrigin.status, 403, 'Cross-origin mutations must be rejected');
  await post('saveCustomer', { name: label, contact: '验证联系人', industry: '跨境电商', phone: '', status: '初访', market: '美国', route: '深圳 → 洛杉矶' });
  let data = await get();
  const customer = data.customers.find(c => c.name === label); assert.ok(customer); customerId = customer.id;
  await post('saveCustomer', { name: label }, 409);
  await post('saveCustomer', { id: 'not-owned-record', name: '不可访问的客户' }, 404);
  await post('addFollowup', { customerId, content: '已沟通运输需求，进入报价阶段。', method: '电话', status: '报价' });
  await post('saveTask', { customerId, title: label + '-发送报价', dueDate: new Date().toISOString().slice(0,10), priority: 'high' });
  data = await get();
  assert.equal(data.customers.find(c => c.id === customerId).status, '报价');
  assert.equal(data.followups.filter(f => f.customerId === customerId).length, 1);
  const task = data.tasks.find(t => t.title === label + '-发送报价'); assert.ok(task); taskId = task.id;
  await post('toggleTask', { id: task.id, completed: true });
  const inquiry = { customerId, origin: '深圳', destination: '洛杉矶', mode: '海运', cargo: '消费电子', weight: '1200', volume: '8.6', amount: 2860000, currency: 'CNY', status: '已报价', validity: '2026-12-31' };
  await post('saveInquiry', inquiry);
  await post('saveInquiry', { ...inquiry, weight: '-1' }, 400);
  const order = { customerId, number: label, origin: '深圳仓', destination: '洛杉矶仓', mode: '海运', cargo: '消费电子', eta: '2026-12-01' };
  await post('saveOrder', order); await post('saveOrder', order, 409);
  data = await get();
  const storedOrder = data.orders.find(o => o.number === label); assert.ok(storedOrder);
  assert.equal(JSON.parse(storedOrder.documents).length, 3);
  await post('updateOrder', { id: storedOrder.id, status: '运输中', location: '太平洋', description: '测试延误节点', exception: '天气延误' });
  await post('saveDocuments', { id: storedOrder.id, documents: [{ name: '商业发票', ready: true, url: 'https://example.com/invoice' }] });
  data = await get();
  assert.equal(data.tasks.find(t => t.id === task.id).completed, true);
  assert.equal(data.inquiries.find(q => q.customerId === customerId).amount, 2860000);
  assert.equal(data.orders.find(o => o.id === storedOrder.id).exception, '天气延误');
  assert.equal(data.events.filter(e => e.orderId === storedOrder.id).length, 2);
  assert.equal(JSON.parse(data.orders.find(o => o.id === storedOrder.id).documents)[0].ready, true);
  await post('updateOrder', { id: storedOrder.id, status: '派送中', location: '洛杉矶', description: '异常已解除，恢复派送', exception: '' });
  data = await get(); assert.equal(data.orders.find(o => o.id === storedOrder.id).exception, '');
  console.log('PASS: authentication, ownership checks, CSRF, duplicate detection, customer → follow-up → task → quotation → order → exception → documents → resolution, persisted D1 reads.');
} finally {
  if (customerId) {
    await post('deleteCustomer', { id: customerId });
    const data = await get();
    assert.equal(data.customers.some(c => c.id === customerId), false);
    assert.equal(data.followups.some(f => f.customerId === customerId), false);
    assert.equal(data.inquiries.some(q => q.customerId === customerId), false);
    assert.equal(data.orders.some(o => o.customerId === customerId), false);
    if (taskId) assert.equal(data.tasks.find(t => t.id === taskId)?.customerId, null);
    console.log('PASS: customer cascade cleanup and retained task unlinking.');
  }
}
