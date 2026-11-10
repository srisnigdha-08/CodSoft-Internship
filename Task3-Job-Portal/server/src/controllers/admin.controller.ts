import type { Request, Response } from 'express';
import { currentUser } from '../middleware/authenticate.js';
import * as adminService from '../services/admin.service.js';
import { listAllApplications } from '../services/application.service.js';
import * as jobService from '../services/job.service.js';
import { sendOk, sendPage } from '../utils/http.js';
import {
  adminApplicationListSchema,
  adminEmployerListSchema,
  adminUserListSchema,
  userStatusSchema,
} from '../validation/application.validation.js';
import { idParams } from '../validation/common.js';
import { managedJobsQuerySchema, moderationSchema } from '../validation/job.validation.js';

export async function stats(_req: Request, res: Response) {
  sendOk(res, await adminService.getPlatformStats());
}

export async function users(req: Request, res: Response) {
  sendPage(res, await adminService.listUsers(adminUserListSchema.parse(req.query)));
}

export async function setUserStatus(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const { isActive } = userStatusSchema.parse(req.body);
  sendOk(res, await adminService.setUserActive(id, currentUser(req), isActive));
}

export async function employers(req: Request, res: Response) {
  sendPage(res, await adminService.listEmployers(adminEmployerListSchema.parse(req.query)));
}

export async function jobs(req: Request, res: Response) {
  sendPage(res, await jobService.listAllJobs(managedJobsQuerySchema.parse(req.query)));
}

export async function moderateJob(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  sendOk(res, await jobService.moderateJob(id, moderationSchema.parse(req.body)));
}

export async function applications(req: Request, res: Response) {
  sendPage(res, await listAllApplications(adminApplicationListSchema.parse(req.query)));
}
