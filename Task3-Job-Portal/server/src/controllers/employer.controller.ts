import type { Request, Response } from 'express';
import { currentUser } from '../middleware/authenticate.js';
import * as employerService from '../services/employer.service.js';
import * as jobService from '../services/job.service.js';
import { sendOk, sendPage } from '../utils/http.js';
import { idParams } from '../validation/common.js';
import { managedJobsQuerySchema } from '../validation/job.validation.js';
import { companySchema, employerProfileSchema } from '../validation/profile.validation.js';

const userId = (req: Request) => currentUser(req).id;

export async function getProfile(req: Request, res: Response) {
  sendOk(res, await employerService.getEmployerProfile(userId(req)));
}

export async function updateProfile(req: Request, res: Response) {
  const input = employerProfileSchema.parse(req.body);
  sendOk(res, await employerService.updateEmployerProfile(userId(req), input));
}

export async function getDashboard(req: Request, res: Response) {
  sendOk(res, await employerService.getEmployerDashboard(userId(req)));
}

export async function listOwnJobs(req: Request, res: Response) {
  const query = managedJobsQuerySchema.parse(req.query);
  sendPage(res, await jobService.listEmployerJobs(userId(req), query));
}

export async function getOwnCompany(req: Request, res: Response) {
  sendOk(res, await employerService.getOwnCompany(userId(req)));
}

export async function saveOwnCompany(req: Request, res: Response) {
  const input = companySchema.parse(req.body);
  sendOk(res, await employerService.saveOwnCompany(userId(req), input));
}

export async function getPublicCompany(req: Request, res: Response) {
  sendOk(res, await employerService.getPublicCompany(idParams.parse(req.params).id));
}
