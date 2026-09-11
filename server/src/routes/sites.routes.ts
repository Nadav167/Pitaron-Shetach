import { Router } from "express";
import { getSite, getSites } from "../controllers/sites.controller";

const router = Router();

router.get("/", getSites);
router.get("/:id", getSite);

export default router;
