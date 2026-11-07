import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(),
  name: text("name").notNull(), contact: text("contact").notNull().default(""),
  phone: text("phone").notNull().default(""), industry: text("industry").notNull().default("其他"),
  level: text("level").notNull().default("B"), status: text("status").notNull().default("待联系"),
  pool: text("pool").notNull().default("mine"), address: text("address").notNull().default(""),
  notes: text("notes").notNull().default(""), source: text("source").notNull().default("手动录入"),
  category: text("category").notNull().default(""), market: text("market").notNull().default(""),
  route: text("route").notNull().default(""), balanceDue: integer("balance_due").notNull().default(0),
  creditLimit: integer("credit_limit").notNull().default(0),
  demo: integer("demo", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (t) => [uniqueIndex("customers_user_name").on(t.userId, t.name)]);
export const followups = sqliteTable("followups", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  content: text("content").notNull(), method: text("method").notNull(), createdAt: text("created_at").notNull(),
  demo: integer("demo", { mode: "boolean" }).notNull().default(false),
});
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  title: text("title").notNull(), dueDate: text("due_date").notNull(), priority: text("priority").notNull().default("normal"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  demo: integer("demo", { mode: "boolean" }).notNull().default(false), createdAt: text("created_at").notNull(),
});
export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(), name: text("name").notNull(),
  company: text("company").notNull().default("我的销售团队"), motto: text("motto").notNull().default("认真对待每一次连接"),
});

export const inquiries = sqliteTable("inquiries", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), number: text("number").notNull(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  origin: text("origin").notNull(), destination: text("destination").notNull(), mode: text("mode").notNull(),
  cargo: text("cargo").notNull(), weight: text("weight").notNull().default("0"), volume: text("volume").notNull().default("0"),
  amount: integer("amount").notNull().default(0), currency: text("currency").notNull().default("CNY"),
  status: text("status").notNull().default("待核价"), validity: text("validity").notNull().default(""),
  notes: text("notes").notNull().default(""), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), number: text("number").notNull(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  origin: text("origin").notNull(), destination: text("destination").notNull(), mode: text("mode").notNull(),
  cargo: text("cargo").notNull(), status: text("status").notNull().default("待入仓"), eta: text("eta").notNull().default(""),
  exception: text("exception").notNull().default(""), documents: text("documents").notNull().default("[]"),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});
export const events = sqliteTable("events", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  location: text("location").notNull(), description: text("description").notNull(), status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});
