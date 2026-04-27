import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { getUsersStats } from "./users.controller.js";

const router: Router = Router();

router.use(requireAuth);

router.get("/stats", getUsersStats);

export default router;