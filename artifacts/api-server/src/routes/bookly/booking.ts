import { and, eq, gt, lt, ne } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  appointmentsTable,
  businessesTable,
  customersTable,
  defaultWorkingHours,
  holidaysTable,
  servicesTable,
  staffTable,
  type WorkingHours,
} from "@workspace/db";
import { db } from "@workspace/db";
import {
  CreatePublicAppointmentBody,
  CreatePublicAppointmentResponse,
  GetAvailableSlotsParams,
  GetAvailableSlotsResponse,
  GetPublicBookingPageParams,
  GetPublicBookingPageResponse,
} from "@workspace/api-zod";
import {
  addLocalCalendarDays,
  localDateString,
  localDateTimeToUtc,
  localTimeString,
  weekdayKey,
} from "../../lib/bookly-time";

const router: IRouter = Router();

type ReservedAppointment = {
  startTime: Date;
  endTime: Date;
  status: string;
};

function dayBounds(date: string, timeZone: string) {
  return {
    start: localDateTimeToUtc(date, "00:00", timeZone),
    end: localDateTimeToUtc(addLocalCalendarDays(date, 1), "00:00", timeZone),
  };
}

function calculateSlots(
  businessHours: WorkingHours,
  staffHours: WorkingHours,
  timezone: string,
  date: string,
  durationMinutes: number,
  appointments: ReservedAppointment[],
) {
  const dayKey = weekdayKey(date);
  const businessDay = businessHours[dayKey];
  const staffDay = staffHours[dayKey];
  if (
    !businessDay ||
    !staffDay ||
    businessDay.closed ||
    staffDay.closed
  ) {
    return [];
  }

  const toMinutes = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
  };
  const openAt = Math.max(
    toMinutes(businessDay.open),
    toMinutes(staffDay.open),
  );
  const closeAt = Math.min(
    toMinutes(businessDay.close),
    toMinutes(staffDay.close),
  );
  const slots: Array<{ time: string }> = [];
  const now = Date.now();

  for (let minute = openAt; minute + durationMinutes <= closeAt; minute += 15) {
    const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const startTime = localDateTimeToUtc(date, time, timezone);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
    const isTaken = appointments.some(
      (appointment) =>
        appointment.status !== "cancelled" &&
        appointment.startTime < endTime &&
        appointment.endTime > startTime,
    );

    if (startTime.getTime() > now && !isTaken) slots.push({ time });
  }

  return slots;
}

router.get("/booking/:slug", async (req, res): Promise<void> => {
  const params = GetPublicBookingPageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.slug, params.data.slug))
    .limit(1);
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  const [services, staff] = await Promise.all([
    db
      .select()
      .from(servicesTable)
      .where(
        and(eq(servicesTable.businessId, business.id), eq(servicesTable.active, true)),
      ),
    db
      .select()
      .from(staffTable)
      .where(and(eq(staffTable.businessId, business.id), eq(staffTable.active, true))),
  ]);

  res.json(
    GetPublicBookingPageResponse.parse({
      business: {
        ...business,
        workingHours: business.workingHours ?? defaultWorkingHours,
      },
      services,
      staff,
    }),
  );
});

router.get(
  "/booking/:slug/availability/:serviceId/:staffId/:date",
  async (req, res): Promise<void> => {
    const params = GetAvailableSlotsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const date = Array.isArray(req.params.date)
      ? req.params.date[0]
      : req.params.date;
    const [business] = await db
      .select()
      .from(businessesTable)
      .where(eq(businessesTable.slug, params.data.slug))
      .limit(1);
    if (!business) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    const [service] = await db
      .select()
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.id, params.data.serviceId),
          eq(servicesTable.businessId, business.id),
          eq(servicesTable.active, true),
        ),
      )
      .limit(1);
    const [staff] = await db
      .select()
      .from(staffTable)
      .where(
        and(
          eq(staffTable.id, params.data.staffId),
          eq(staffTable.businessId, business.id),
          eq(staffTable.active, true),
        ),
      )
      .limit(1);
    if (!service || !staff || !staff.serviceIds.includes(service.id)) {
      res.json([]);
      return;
    }

    const holiday = await db
      .select({ id: holidaysTable.id })
      .from(holidaysTable)
      .where(
        and(
          eq(holidaysTable.businessId, business.id),
          eq(holidaysTable.holidayDate, date),
        ),
      )
      .limit(1);
    if (holiday.length > 0) {
      res.json([]);
      return;
    }

    const bounds = dayBounds(date, business.timezone);
    const reserved = await db
      .select({
        startTime: appointmentsTable.startTime,
        endTime: appointmentsTable.endTime,
        status: appointmentsTable.status,
      })
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.staffId, staff.id),
          lt(appointmentsTable.startTime, bounds.end),
          gt(appointmentsTable.endTime, bounds.start),
          ne(appointmentsTable.status, "cancelled"),
        ),
      );
    const slots = calculateSlots(
      business.workingHours ?? defaultWorkingHours,
      staff.workingHours ?? defaultWorkingHours,
      business.timezone,
      date,
      service.durationMinutes,
      reserved,
    );
    res.json(GetAvailableSlotsResponse.parse(slots));
  },
);

router.post(
  "/booking/:slug/appointments",
  async (req, res): Promise<void> => {
    const params = GetPublicBookingPageParams.safeParse(req.params);
    const body = CreatePublicAppointmentBody.safeParse(req.body);
    if (!params.success || !body.success) {
      const error = !params.success
        ? params.error.message
        : !body.success
          ? body.error.message
          : "Invalid booking";
      res.status(400).json({
        error,
      });
      return;
    }

    const [business] = await db
      .select()
      .from(businessesTable)
      .where(eq(businessesTable.slug, params.data.slug))
      .limit(1);
    if (!business) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    const { serviceId, staffId, startTime, customerName, customerPhone } =
      body.data;
    const customerEmail = body.data.customerEmail ?? null;
    const notes = body.data.notes ?? null;
    const date = localDateString(startTime, business.timezone);
    const time = localTimeString(startTime, business.timezone);

    const result = await db.transaction(async (tx) => {
      const [staff] = await tx
        .select()
        .from(staffTable)
        .where(
          and(
            eq(staffTable.id, staffId),
            eq(staffTable.businessId, business.id),
            eq(staffTable.active, true),
          ),
        )
        .for("update")
        .limit(1);
      const [service] = await tx
        .select()
        .from(servicesTable)
        .where(
          and(
            eq(servicesTable.id, serviceId),
            eq(servicesTable.businessId, business.id),
            eq(servicesTable.active, true),
          ),
        )
        .limit(1);
      if (!staff || !service || !staff.serviceIds.includes(service.id)) {
        return { kind: "invalid" as const };
      }

      const holiday = await tx
        .select({ id: holidaysTable.id })
        .from(holidaysTable)
        .where(
          and(
            eq(holidaysTable.businessId, business.id),
            eq(holidaysTable.holidayDate, date),
          ),
        )
        .limit(1);
      if (holiday.length > 0) return { kind: "unavailable" as const };

      const bounds = dayBounds(date, business.timezone);
      const reserved = await tx
        .select({
          startTime: appointmentsTable.startTime,
          endTime: appointmentsTable.endTime,
          status: appointmentsTable.status,
        })
        .from(appointmentsTable)
        .where(
          and(
            eq(appointmentsTable.staffId, staff.id),
            lt(appointmentsTable.startTime, bounds.end),
            gt(appointmentsTable.endTime, bounds.start),
            ne(appointmentsTable.status, "cancelled"),
          ),
        );
      const slotIsAvailable = calculateSlots(
        business.workingHours ?? defaultWorkingHours,
        staff.workingHours ?? defaultWorkingHours,
        business.timezone,
        date,
        service.durationMinutes,
        reserved,
      ).some((slot) => slot.time === time);
      if (!slotIsAvailable) return { kind: "unavailable" as const };

      const endTime = new Date(
        startTime.getTime() + service.durationMinutes * 60_000,
      );
      const [customer] = await tx
        .insert(customersTable)
        .values({
          businessId: business.id,
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
        })
        .onConflictDoUpdate({
          target: [customersTable.businessId, customersTable.phone],
          set: { name: customerName, email: customerEmail },
        })
        .returning();
      const [appointment] = await tx
        .insert(appointmentsTable)
        .values({
          businessId: business.id,
          serviceId: service.id,
          staffId: staff.id,
          customerId: customer.id,
          customerName,
          customerPhone,
          customerEmail,
          startTime,
          endTime,
          status: "confirmed",
          notes,
        })
        .returning();

      return {
        kind: "created" as const,
        appointment: {
          ...appointment,
          serviceName: service.name,
          staffName: staff.name,
        },
      };
    });

    if (result.kind === "invalid") {
      res.status(400).json({ error: "Please choose an active service and staff member" });
      return;
    }
    if (result.kind === "unavailable") {
      res.status(409).json({ error: "This time is no longer available" });
      return;
    }

    res
      .status(201)
      .json(CreatePublicAppointmentResponse.parse(result.appointment));
  },
);

export default router;
