import { Router, type IRouter } from "express";
import healthRouter from "./health";
import booklyRouter from "./bookly";

const router: IRouter = Router();

router.use(healthRouter);
router.use(booklyRouter);

export default router;
