import { Router, type IRouter } from "express";
import bookingRouter from "./booking";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();
router.use(bookingRouter);
router.use(dashboardRouter);

export default router;
