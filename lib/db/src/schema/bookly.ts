import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type WorkingDay = {
  open: string;
  close: string;
  closed: boolean;
};

export type WorkingHours = Record<string, WorkingDay>;

export const defaultWorkingHours: WorkingHours = {
  monday: { open: "09:00", close: "18:00", closed: false },
  tuesday: { open: "09:00", close: "18:00", closed: false },
  wednesday: { open: "09:00", close: "18:00", closed: false },
  thursday: { open: "09:00", close: "18:00", closed: false },
  friday: { open: "09:00", close: "18:00", closed: false },
  saturday: { open: "10:00", close: "16:00", closed: false },
  sunday: { open: "10:00", close: "16:00", closed: true },
};

export const businessesTable = pgTable(
  "businesses",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    category: text("category").notNull(),
    phone: text("phone").notNull(),
    address: text("address").notNull().default(""),
    timezone: text("timezone").notNull().default("Asia/Baku"),
    currency: text("currency").notNull().default("AZN"),
    workingHours: jsonb("working_hours")
      .$type<WorkingHours>()
      .notNull()
      .default(defaultWorkingHours),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("businesses_owner_id_unique").on(table.ownerId),
    uniqueIndex("businesses_slug_unique").on(table.slug),
  ],
);

export const servicesTable = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    price: integer("price").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (table) => [index("services_business_id_idx").on(table.businessId)],
);

export const staffTable = pgTable(
  "staff",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    serviceIds: jsonb("service_ids").$type<number[]>().notNull().default([]),
    workingHours: jsonb("working_hours")
      .$type<WorkingHours>()
      .notNull()
      .default(defaultWorkingHours),
    active: boolean("active").notNull().default(true),
  },
  (table) => [index("staff_business_id_idx").on(table.businessId)],
);

export const customersTable = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("customers_business_phone_unique").on(
      table.businessId,
      table.phone,
    ),
    index("customers_business_id_idx").on(table.businessId),
  ],
);

export const appointmentsTable = pgTable(
  "appointments",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id, { onDelete: "cascade" }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => servicesTable.id, { onDelete: "restrict" }),
    staffId: integer("staff_id")
      .notNull()
      .references(() => staffTable.id, { onDelete: "restrict" }),
    customerId: integer("customer_id").references(() => customersTable.id, {
      onDelete: "set null",
    }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("confirmed"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("appointments_business_start_idx").on(
      table.businessId,
      table.startTime,
    ),
    index("appointments_staff_start_idx").on(table.staffId, table.startTime),
    index("appointments_customer_idx").on(table.customerId),
  ],
);

export const holidaysTable = pgTable(
  "business_holidays",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id, { onDelete: "cascade" }),
    holidayDate: date("holiday_date", { mode: "string" }).notNull(),
    label: text("label").notNull().default(""),
  },
  (table) => [
    uniqueIndex("business_holidays_business_date_unique").on(
      table.businessId,
      table.holidayDate,
    ),
  ],
);
