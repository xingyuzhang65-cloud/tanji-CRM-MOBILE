import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { customers, followups, tasks, profiles, inquiries, orders, events } from "../../../db/schema";

export const dynamic = "force-dynamic";
const customerInput = z.object({
  id: z.string().max(80).optional(), name: z.string().trim().min(2, "请输入至少两个字的客户名称").max(100),
  contact: z.string().trim().max(50).default(""), phone: z.string().trim().max(30).regex(/^[+\d\s()-]*$/, "电话号码格式不正确").default(""),
  industry: z.enum(["物流运输", "跨境电商", "制造业", "贸易", "科技服务", "其他"]).default("其他"),
  level: z.enum(["A", "B", "C", "D"]).default("B"), status: z.enum(["初访", "已联系", "有意向", "报价", "成交", "暂时搁置"]).default("初访"),
  pool: z.enum(["mine", "public"]).default("mine"), address: z.string().trim().max(200).default(""),
  notes: z.string().trim().max(2000).default(""), source: z.string().trim().max(60).default("手动录入"),
  category: z.string().trim().max(80).default(""), market: z.string().trim().max(80).default(""), route: z.string().trim().max(150).default(""),
  balanceDue: z.number().int().min(0).max(100000000000).default(0), creditLimit: z.number().int().min(0).max(100000000000).default(0),
});
const idInput = z.object({ id: z.string().min(1).max(80) });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择日期").refine(v => !isNaN(Date.parse(v)), "日期无效");
const mode = z.enum(["海运", "空运", "中欧班列", "国际快递", "卡航"]);
const orderStatus = z.enum(["待入仓", "已入仓", "已出运", "运输中", "清关中", "派送中", "已签收"]);
const json = (v: unknown, status = 200) => Response.json(v, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "请先登录后使用", signIn: "/signin-with-chatgpt?return_to=/" }, 401);
  try {
    const db = getDb(), u = user.userId;
    const [cs, fs, ts, ps, qs, os, es] = await Promise.all([
      db.select().from(customers).where(eq(customers.userId, u)).orderBy(desc(customers.updatedAt)).all(),
      db.select().from(followups).where(eq(followups.userId, u)).orderBy(desc(followups.createdAt)).all(),
      db.select().from(tasks).where(eq(tasks.userId, u)).orderBy(tasks.dueDate).all(),
      db.select().from(profiles).where(eq(profiles.userId, u)).get(),
      db.select().from(inquiries).where(eq(inquiries.userId, u)).orderBy(desc(inquiries.updatedAt)).all(),
      db.select().from(orders).where(eq(orders.userId, u)).orderBy(desc(orders.updatedAt)).all(),
      db.select().from(events).where(eq(events.userId, u)).orderBy(desc(events.createdAt)).all(),
    ]);
    return json({ customers: cs, followups: fs, tasks: ts, inquiries: qs, orders: os, events: es, profile: ps ?? { name: user.fullName || "天朗", company: "天途跨境物流", motto: "认真对待每一次连接" }, email: user.email, role: "admin" });
  } catch (err) { console.error("crm_read", err); return json({ error: "数据读取失败，请稍后重试" }, 503); }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "登录已失效，请重新登录" }, 401);
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: "请求来源无效" }, 403);
  if (Number(request.headers.get("content-length") || 0) > 30000) return json({ error: "请求内容过大" }, 413);
  try {
    const { action, payload } = z.object({ action: z.string(), payload: z.unknown().optional() }).parse(await request.json());
    const db = getDb(), userId = user.userId, now = new Date().toISOString();
    const ownCustomer = async (id: string) => {
      const c = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.userId, userId))).get();
      if (!c) throw new Error("NOT_FOUND"); return c;
    };
    if (action === "saveCustomer") {
      const c = customerInput.parse(payload); if (c.id) await ownCustomer(c.id);
      const values = { ...c, updatedAt: now };
      if (c.id) await db.update(customers).set(values).where(and(eq(customers.id, c.id), eq(customers.userId, userId))).run();
      else await db.insert(customers).values({ ...values, id: crypto.randomUUID(), userId, createdAt: now }).run();
    } else if (action === "deleteCustomer") {
      const { id } = idInput.parse(payload); await ownCustomer(id);
      await db.delete(customers).where(and(eq(customers.id, id), eq(customers.userId, userId))).run();
    } else if (action === "addFollowup") {
      const f = z.object({ customerId: z.string(), content: z.string().trim().min(2, "请填写跟进内容").max(2000), method: z.enum(["电话", "微信", "拜访", "邮件", "其他"]), status: customerInput.shape.status }).parse(payload);
      await ownCustomer(f.customerId);
      await db.batch([
        db.insert(followups).values({ id: crypto.randomUUID(), userId, customerId: f.customerId, content: f.content, method: f.method, createdAt: now }),
        db.update(customers).set({ status: f.status, updatedAt: now }).where(and(eq(customers.id, f.customerId), eq(customers.userId, userId))),
      ]);
    } else if (action === "saveTask") {
      const t = z.object({ title: z.string().trim().min(2, "请输入待办内容").max(150), customerId: z.string().nullable().default(null), dueDate: date, priority: z.enum(["normal", "high"]).default("normal") }).parse(payload);
      if (t.customerId) await ownCustomer(t.customerId);
      await db.insert(tasks).values({ ...t, id: crypto.randomUUID(), userId, createdAt: now }).run();
    } else if (action === "toggleTask") {
      const { id, completed } = z.object({ id: z.string(), completed: z.boolean() }).parse(payload);
      const t = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).get();
      if (!t) throw new Error("NOT_FOUND");
      await db.update(tasks).set({ completed }).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).run();
    } else if (action === "saveProfile") {
      const p = z.object({ name: z.string().trim().min(1).max(30), company: z.string().trim().min(1).max(100), motto: z.string().trim().max(120) }).parse(payload);
      await db.insert(profiles).values({ userId, ...p }).onConflictDoUpdate({ target: profiles.userId, set: p }).run();
    } else if (action === "saveInquiry") {
      const q = z.object({ id: z.string().optional(), customerId: z.string(), origin: z.string().trim().min(1).max(80), destination: z.string().trim().min(1).max(80), mode,
        cargo: z.string().trim().min(1).max(150), weight: z.coerce.number().min(0).max(10000000).transform(String), volume: z.coerce.number().min(0).max(1000000).transform(String),
        amount: z.number().int().min(0).max(100000000000).default(0), currency: z.enum(["CNY", "USD", "EUR"]).default("CNY"), status: z.enum(["待核价", "核价中", "已报价", "已接受", "已失效"]).default("待核价"), validity: date.or(z.literal("")).default(""), notes: z.string().max(2000).default("") }).parse(payload);
      await ownCustomer(q.customerId);
      if (q.id) {
        const found = await db.select().from(inquiries).where(and(eq(inquiries.id, q.id), eq(inquiries.userId, userId))).get(); if (!found) throw new Error("NOT_FOUND");
        await db.update(inquiries).set({ ...q, updatedAt: now }).where(and(eq(inquiries.id, q.id), eq(inquiries.userId, userId))).run();
      } else await db.insert(inquiries).values({ ...q, id: crypto.randomUUID(), userId, number: "XJ" + now.slice(0,10).replaceAll("-", "") + crypto.randomUUID().slice(0,6).toUpperCase(), createdAt: now, updatedAt: now }).run();
    } else if (action === "saveOrder") {
      const o = z.object({ customerId: z.string(), number: z.string().trim().min(3).max(80), origin: z.string().trim().min(1).max(80), destination: z.string().trim().min(1).max(80), mode, cargo: z.string().trim().min(1).max(150), eta: date.or(z.literal("")).default("") }).parse(payload);
      await ownCustomer(o.customerId);
      const existing = await db.select().from(orders).where(and(eq(orders.userId, userId), eq(orders.number, o.number))).get();
      if (existing) return json({ error: "运单号已存在" }, 409);
      const id = crypto.randomUUID();
      await db.batch([
        db.insert(orders).values({ ...o, id, userId, createdAt: now, updatedAt: now, documents: JSON.stringify([{ name: "商业发票", ready: false, url: "" }, { name: "装箱单", ready: false, url: "" }, { name: "提单 / 运单", ready: false, url: "" }]) }),
        db.insert(events).values({ id: crypto.randomUUID(), userId, orderId: id, status: "待入仓", location: o.origin, description: "运单已创建，等待货物入仓", createdAt: now }),
      ]);
    } else if (action === "updateOrder") {
      const o = z.object({ id: z.string(), status: orderStatus, location: z.string().trim().min(1).max(100), description: z.string().trim().min(2).max(1000), exception: z.string().trim().max(200).default("") }).parse(payload);
      const found = await db.select().from(orders).where(and(eq(orders.id, o.id), eq(orders.userId, userId))).get(); if (!found) throw new Error("NOT_FOUND");
      await db.batch([
        db.update(orders).set({ status: o.status, exception: o.exception, updatedAt: now }).where(and(eq(orders.id, o.id), eq(orders.userId, userId))),
        db.insert(events).values({ id: crypto.randomUUID(), userId, orderId: o.id, status: o.status, location: o.location, description: o.description, createdAt: now }),
      ]);
    } else if (action === "saveDocuments") {
      const o = z.object({ id: z.string(), documents: z.array(z.object({ name: z.string().min(1).max(80), ready: z.boolean(), url: z.string().url().refine(v => /^https:\/\//.test(v)).or(z.literal("")) })).max(20) }).parse(payload);
      const found = await db.select().from(orders).where(and(eq(orders.id, o.id), eq(orders.userId, userId))).get(); if (!found) throw new Error("NOT_FOUND");
      await db.update(orders).set({ documents: JSON.stringify(o.documents), updatedAt: now }).where(and(eq(orders.id, o.id), eq(orders.userId, userId))).run();
    } else if (action === "seedDemo") {
      const examples = [
        { name: "远航跨境电商（演示）", contact: "林经理", industry: "跨境电商", level: "A", status: "报价", pool: "mine", market: "美国", route: "深圳 → 洛杉矶", category: "消费电子", notes: "关注美森快船时效，准备海运及空运报价。" },
        { name: "星禾智能科技（演示）", contact: "陈女士", industry: "科技服务", level: "A", status: "有意向", pool: "mine", market: "欧洲", route: "义乌 → 杜伊斯堡", category: "智能家居", notes: "计划下周沟通合作方案。" },
        { name: "蓝海国际贸易（演示）", contact: "周先生", industry: "贸易", level: "B", status: "已联系", pool: "mine", market: "东南亚", route: "广州 → 新加坡", category: "家居百货", notes: "每月有稳定出货需求，持续跟进。" },
        { name: "启程精密制造（演示）", contact: "王经理", industry: "制造业", level: "B", status: "初访", pool: "public", market: "欧洲", route: "宁波 → 汉堡", category: "机械配件", notes: "待认领的公海客户。" },
        { name: "安途物流服务（演示）", contact: "李女士", industry: "物流运输", level: "A", status: "成交", pool: "mine", market: "美国", route: "深圳 → 纽约", category: "跨境小包", notes: "已达成首次合作。" },
      ];
      const statements = examples.map(c => db.insert(customers).values({ ...c, id: crypto.randomUUID(), userId, demo: true, createdAt: now, updatedAt: now }).onConflictDoNothing());
      await db.batch([statements[0]!, ...statements.slice(1)]);
    } else if (action === "clearDemo") {
      await db.delete(customers).where(and(eq(customers.userId, userId), eq(customers.demo, true))).run();
    } else return json({ error: "不支持的操作" }, 400);
    return json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return json({ error: err.issues[0]?.message || "请检查输入内容" }, 400);
    if (err instanceof Error && err.message === "NOT_FOUND") return json({ error: "记录不存在或没有访问权限" }, 404);
    let cause: unknown = err;
    for (let depth = 0; depth < 5 && cause; depth++) {
      if (String(cause).includes("UNIQUE constraint")) return json({ error: "客户名称或业务单号已存在，请先搜索记录" }, 409);
      cause = cause instanceof Error ? cause.cause : undefined;
    }
    if (err instanceof SyntaxError) return json({ error: "请求格式不正确" }, 400);
    console.error("crm_write_failed"); return json({ error: "保存失败，请稍后重试" }, 500);
  }
}
