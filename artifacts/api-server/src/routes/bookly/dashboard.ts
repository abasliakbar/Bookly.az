import { randomUUID } from "node:crypto";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  lt,
  max,
  ne,
  sql,
} from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import {
  appointmentsTable,
  businessesTable,
  customersTable,
  defaultWorkingHours,
  holidaysTable,
  servicesTable,
  staffTable,
} from "@workspace/db";
import { db } from "@workspace/db";
import {
  CreateDashboardBusinessBody,
  CreateDashboardBusinessResponse,
  CreateDashboardHolidayBody,
  CreateDashboardHolidayResponse,
  CreateServiceBody,
  CreateServiceResponse,
  CreateStaffBody,
  CreateStaffResponse,
  DeleteServiceParams,
  DeleteStaffParams,
  DeleteDashboardHolidayParams,
  GetDashboardHolidaysResponse,
  GetDashboardAppointmentsQueryParams,
  GetDashboardAppointmentsResponse,
  GetDashboardBusinessResponse,
  GetDashboardCustomersResponse,
  GetDashboardOverviewResponse,
  GetDashboardServicesResponse,
  GetDashboardStaffResponse,
  UpdateAppointmentStatusBody,
  UpdateAppointmentStatusParams,
  UpdateAppointmentStatusResponse,
  UpdateDashboardBusinessBody,
  UpdateDashboardBusinessResponse,
  UpdateServiceBody,
  UpdateServiceParams,
  UpdateServiceResponse,
  UpdateStaffBody,
  UpdateStaffParams,
  UpdateStaffResponse,
} from "@workspace/api-zod";
import requireAuth from "../../middlewares/requireAuth";
import { getOwnerBusiness } from "../../lib/bookly-owner";
import {
  addLocalCalendarDays,
  localDateString,
  localDateTimeToUtc,
  weekdayKey,
} from "../../lib/bookly-time";

const router: IRouter = Router();
router.use(requireAuth);

function userIdFromResponse(res: Response): string {
  return res.locals.userId as string;
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "bookly-business";
}

function dayBounds(date: string, timezone: string) {
  return {
    start: localDateTimeToUtc(date, "00:00", timezone),
    end: localDateTimeToUtc(addLocalCalendarDays(date, 1), "00:00", timezone),
  };
}

async function getAppointments(businessId: number, date: string, timezone: string) {
  const bounds = dayBounds(date, timezone);
  const rows = await db
    .select({
      appointment: appointmentsTable,
      serviceName: servicesTable.name,
      staffName: staffTable.name,
    })
    .from(appointmentsTable)
    .innerJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
    .innerJoin(staffTable, eq(appointmentsTable.staffId, staffTable.id))
    .where(
      and(
        eq(appointmentsTable.businessId, businessId),
        gte(appointmentsTable.startTime, bounds.start),
        lt(appointmentsTable.startTime, bounds.end),
      ),
    )
    .orderBy(appointmentsTable.startTime);
  return rows.map((row) => ({
    ...row.appointment,
    serviceName: row.serviceName,
    staffName: row.staffName,
  }));
}

router.get("/dashboard/business", async (_req, res): Promise<void> => {
  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Set up your business to continue" });
    return;
  }
  res.json(GetDashboardBusinessResponse.parse(business));
});

router.post("/dashboard/business", async (req, res): Promise<void> => {
  const parsed = CreateDashboardBusinessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const ownerId = userIdFromResponse(res);
  const existing = await getOwnerBusiness(ownerId);
  if (existing) {
    res.status(409).json({ error: "Your account already has a business" });
    return;
  }

  const baseSlug = slugify(parsed.data.name);
  const slug = `${baseSlug}-${randomUUID().slice(0, 6)}`;
  const [business] = await db
    .insert(businessesTable)
    .values({
      ownerId,
      name: parsed.data.name.trim(),
      slug,
      category: parsed.data.category.trim(),
      phone: parsed.data.phone.trim(),
      address: parsed.data.address.trim(),
      timezone: "Asia/Baku",
      currency: "AZN",
      workingHours: defaultWorkingHours,
    })
    .returning();
  res
    .status(201)
    .json(CreateDashboardBusinessResponse.parse(business));
});

router.patch("/dashboard/business", async (req, res): Promise<void> => {
  const parsed = UpdateDashboardBusinessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  const [updated] = await db
    .update(businessesTable)
    .set({
      ...parsed.data,
      name: parsed.data.name?.trim(),
      category: parsed.data.category?.trim(),
      phone: parsed.data.phone?.trim(),
      address: parsed.data.address?.trim(),
    })
    .where(eq(businessesTable.id, business.id))
    .returning();
  res.json(UpdateDashboardBusinessResponse.parse(updated));
});

router.get("/dashboard/overview", async (_req, res): Promise<void> => {
  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Set up your business to continue" });
    return;
  }

  const today = localDateString(new Date(), business.timezone);
  const appointments = await getAppointments(business.id, today, business.timezone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const currentMonth = new Date(`${today.slice(0, 7)}-01T12:00:00.000Z`);
  const nextMonth = new Date(
    Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 1),
  )
    .toISOString()
    .slice(0, 10);
  const revenueStart = localDateTimeToUtc(monthStart, "00:00", business.timezone);
  const revenueEnd = localDateTimeToUtc(nextMonth, "00:00", business.timezone);

  const [revenueRows, popularRows, customerRows, staffRows] = await Promise.all([
    db
      .select({
        revenue: sql<number>`coalesce(sum(${servicesTable.price}), 0)`,
      })
      .from(appointmentsTable)
      .innerJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
      .where(
        and(
          eq(appointmentsTable.businessId, business.id),
          eq(appointmentsTable.status, "completed"),
          gte(appointmentsTable.startTime, revenueStart),
          lt(appointmentsTable.startTime, revenueEnd),
        ),
      ),
    db
      .select({
        name: servicesTable.name,
        total: count(appointmentsTable.id),
      })
      .from(appointmentsTable)
      .innerJoin(servicesTable, eq(appointmentsTable.serviceId, servicesTable.id))
      .where(
        and(
          eq(appointmentsTable.businessId, business.id),
          ne(appointmentsTable.status, "cancelled"),
          gte(appointmentsTable.startTime, revenueStart),
          lt(appointmentsTable.startTime, revenueEnd),
        ),
      )
      .groupBy(servicesTable.name)
      .orderBy(desc(count(appointmentsTable.id)))
      .limit(1),
    db
      .select({ total: count(customersTable.id) })
      .from(customersTable)
      .where(eq(customersTable.businessId, business.id)),
    db
      .select()
      .from(staffTable)
      .where(and(eq(staffTable.businessId, business.id), eq(staffTable.active, true))),
  ]);

  const workingDay = business.workingHours?.[weekdayKey(today)];
  const [openHour, openMinute] = (workingDay?.open ?? "09:00").split(":").map(Number);
  const [closeHour, closeMinute] = (workingDay?.close ?? "18:00").split(":").map(Number);
  const openMinutes = workingDay?.closed
    ? 0
    : Math.max(0, closeHour * 60 + closeMinute - openHour * 60 - openMinute);
  const bookedMinutes = appointments
    .filter((appointment) => appointment.status !== "cancelled")
    .reduce(
      (total, appointment) =>
        total +
        Math.max(
          0,
          (appointment.endTime.getTime() - appointment.startTime.getTime()) / 60_000,
        ),
      0,
    );
  const capacityMinutes = openMinutes * staffRows.length;

  res.json(
    GetDashboardOverviewResponse.parse({
      business,
      todayAppointments: appointments,
      monthlyRevenue: Number(revenueRows[0]?.revenue ?? 0),
      popularService: popularRows[0]?.name ?? null,
      occupancyPercent:
        capacityMinutes > 0
          ? Math.min(100, Math.round((bookedMinutes / capacityMinutes) * 100))
          : 0,
      totalCustomers: Number(customerRows[0]?.total ?? 0),
    }),
  );
});

router.get("/dashboard/appointments", async (req, res): Promise<void> => {
  const query = GetDashboardAppointmentsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  const date = query.data.date
    ? query.data.date.toISOString().slice(0, 10)
    : localDateString(new Date(), business.timezone);
  const appointments = await getAppointments(business.id, date, business.timezone);
  res.json(GetDashboardAppointmentsResponse.parse(appointments));
});

router.patch("/dashboard/appointments/:id", async (req, res): Promise<void> => {
  const params = UpdateAppointmentStatusParams.safeParse(req.params);
  const body = UpdateAppointmentStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    const error = !params.success
      ? params.error.message
      : !body.success
        ? body.error.message
        : "Invalid appointment update";
    res.status(400).json({
      error,
    });
    return;
  }
  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  const [appointment] = await db
    .update(appointmentsTable)
    .set({ status: body.data.status })
    .where(
      and(
        eq(appointmentsTable.id, params.data.id),
        eq(appointmentsTable.businessId, business.id),
      ),
    )
    .returning();
  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  const [service, staff] = await Promise.all([
    db
      .select({ name: servicesTable.name })
      .from(servicesTable)
      .where(eq(servicesTable.id, appointment.serviceId))
      .limit(1),
    db
      .select({ name: staffTable.name })
      .from(staffTable)
      .where(eq(staffTable.id, appointment.staffId))
      .limit(1),
  ]);
  res.json(
    UpdateAppointmentStatusResponse.parse({
      ...appointment,
      serviceName: service[0]?.name ?? "",
      staffName: staff[0]?.name ?? "",
    }),
  );
});

router.get("/dashboard/services", async (_req, res): Promise<void> => {
  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  const services = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.businessId, business.id))
    .orderBy(servicesTable.name);
  res.json(GetDashboardServicesResponse.parse(services));
});

router.post("/dashboard/services", async (req, res): Promise<void> => {
  const body = CreateServiceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  const [service] = await db
    .insert(servicesTable)
    .values({ ...body.data, businessId: business.id })
    .returning();
  res.status(201).json(CreateServiceResponse.parse(service));
});

router.patch("/dashboard/services/:id", async (req, res): Promise<void> => {
  const params = UpdateServiceParams.safeParse(req.params);
  const body = UpdateServiceBody.safeParse(req.body);
  if (!params.success || !body.success) {
    const error = !params.success
      ? params.error.message
      : !body.success
        ? body.error.message
        : "Invalid service update";
    res.status(400).json({
      error,
    });
    return;
  }
  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  const [service] = await db
    .update(servicesTable)
    .set(body.data)
    .where(
      and(
        eq(servicesTable.id, params.data.id),
        eq(servicesTable.businessId, business.id),
      ),
    )
    .returning();
  if (!service) {
    res.status(404).json({ error: "Service not found" });
    return;
  }
  res.json(UpdateServiceResponse.parse(service));
});

router.delete("/dashboard/services/:id", async (req, res): Promise<void> => {
  const params = DeleteServiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  const [service] = await db
    .update(servicesTable)
    .set({ active: false })
    .where(
      and(
        eq(servicesTable.id, params.data.id),
        eq(servicesTable.businessId, business.id),
      ),
    )
    .returning({ id: servicesTable.id });
  if (!service) {
    res.status(404).json({ error: "Service not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/dashboard/staff", async (_req, res): Promise<void> => {
  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  const staff = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.businessId, business.id))
    .orderBy(staffTable.name);
  res.json(GetDashboardStaffResponse.parse(staff));
});

router.post("/dashboard/staff", async (req, res): Promise<void> => {
  const body = CreateStaffBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  if (body.data.serviceIds.length > 0) {
    const linkedServices = await db
      .select({ id: servicesTable.id })
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.businessId, business.id),
          inArray(servicesTable.id, body.data.serviceIds),
        ),
      );
    if (linkedServices.length !== body.data.serviceIds.length) {
      res.status(400).json({ error: "Choose services belonging to your business" });
      return;
    }
  }
  const [staff] = await db
    .insert(staffTable)
    .values({ ...body.data, businessId: business.id })
    .returning();
  res.status(201).json(CreateStaffResponse.parse(staff));
});

router.patch("/dashboard/staff/:id", async (req, res): Promise<void> => {
  const params = UpdateStaffParams.safeParse(req.params);
  const body = UpdateStaffBody.safeParse(req.body);
  if (!params.success || !body.success) {
    const error = !params.success
      ? params.error.message
      : !body.success
        ? body.error.message
        : "Invalid staff update";
    res.status(400).json({
      error,
    });
    return;
  }
  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  if (body.data.serviceIds && body.data.serviceIds.length > 0) {
    const linkedServices = await db
      .select({ id: servicesTable.id })
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.businessId, business.id),
          inArray(servicesTable.id, body.data.serviceIds),
        ),
      );
    if (linkedServices.length !== body.data.serviceIds.length) {
      res.status(400).json({ error: "Choose services belonging to your business" });
      return;
    }
  }
  const [staff] = await db
    .update(staffTable)
    .set(body.data)
    .where(
      and(eq(staffTable.id, params.data.id), eq(staffTable.businessId, business.id)),
    )
    .returning();
  if (!staff) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  res.json(UpdateStaffResponse.parse(staff));
});

router.delete("/dashboard/staff/:id", async (req, res): Promise<void> => {
  const params = DeleteStaffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  const [staff] = await db
    .update(staffTable)
    .set({ active: false })
    .where(
      and(eq(staffTable.id, params.data.id), eq(staffTable.businessId, business.id)),
    )
    .returning({ id: staffTable.id });
  if (!staff) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/dashboard/customers", async (_req, res): Promise<void> => {
  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  const customers = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      phone: customersTable.phone,
      email: customersTable.email,
      totalVisits: count(appointmentsTable.id),
      lastVisit: max(appointmentsTable.startTime),
    })
    .from(customersTable)
    .leftJoin(appointmentsTable, eq(customersTable.id, appointmentsTable.customerId))
    .where(eq(customersTable.businessId, business.id))
    .groupBy(
      customersTable.id,
      customersTable.name,
      customersTable.phone,
      customersTable.email,
    )
    .orderBy(desc(max(appointmentsTable.startTime)));
  res.json(
    GetDashboardCustomersResponse.parse(
      customers.map((customer) => ({
        ...customer,
        lastVisit: customer.lastVisit ?? null,
      })),
    ),
  );
});

router.get("/dashboard/holidays", async (_req, res): Promise<void> => {
  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  const holidays = await db
    .select()
    .from(holidaysTable)
    .where(eq(holidaysTable.businessId, business.id))
    .orderBy(holidaysTable.holidayDate);
  res.json(
    GetDashboardHolidaysResponse.parse(
      holidays.map((holiday) => ({
        id: holiday.id,
        date: holiday.holidayDate,
        label: holiday.label,
      })),
    ),
  );
});

router.post("/dashboard/holidays", async (req, res): Promise<void> => {
  const body = CreateDashboardHolidayBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  const [holiday] = await db
    .insert(holidaysTable)
    .values({
      businessId: business.id,
      holidayDate: body.data.date,
      label: body.data.label?.trim() ?? "",
    })
    .onConflictDoNothing()
    .returning();
  if (!holiday) {
    res.status(409).json({ error: "That holiday date is already on your list" });
    return;
  }
  res
    .status(201)
    .json(
      CreateDashboardHolidayResponse.parse({
        id: holiday.id,
        date: holiday.holidayDate,
        label: holiday.label,
      }),
    );
});

router.delete("/dashboard/holidays/:id", async (req, res): Promise<void> => {
  const params = DeleteDashboardHolidayParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const business = await getOwnerBusiness(userIdFromResponse(res));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }
  const [holiday] = await db
    .delete(holidaysTable)
    .where(
      and(
        eq(holidaysTable.id, params.data.id),
        eq(holidaysTable.businessId, business.id),
      ),
    )
    .returning({ id: holidaysTable.id });
  if (!holiday) {
    res.status(404).json({ error: "Holiday not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
