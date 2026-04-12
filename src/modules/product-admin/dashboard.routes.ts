import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { getDashboard } from "./dashboard.controller.js";

const router: Router = Router();

router.use(requireAuth);

router.get("/", getDashboard);

export default router;
