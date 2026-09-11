import { Request, Response, NextFunction } from "express";
import * as sitesService from "../services/sites.service";

/**
 * Thin HTTP adapters: parse/validate the request, call the service layer,
 * shape the response. No business logic or Supabase calls should live here.
 */

export async function getSites(_req: Request, res: Response, next: NextFunction) {
  try {
    const sites = await sitesService.listSites();
    res.json(sites);
  } catch (err) {
    next(err);
  }
}

export async function getSite(req: Request, res: Response, next: NextFunction) {
  try {
    const site = await sitesService.getSiteById(req.params.id);
    res.json(site);
  } catch (err) {
    next(err);
  }
}
