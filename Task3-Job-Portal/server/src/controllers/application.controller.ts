import type { Request, Response } from 'express';
import { currentUser } from '../middleware/authenticate.js';
import * as applicationService from '../services/application.service.js';
import { sendCreated, sendOk, sendPage } from '../utils/http.js';
import {
  applicationListSchema,
  createApplicationSchema,
  updateApplicationStatusSchema,
} from '../validation/application.validation.js';
import { idParams } from '../validation/common.js';
import { sendResumeFile } from './sendResumeFile.js';

const applicationId = (req: Request) => idParams.parse(req.params).id;

export async function apply(req: Request, res: Response) {
  const input = createApplicationSchema.parse(req.body);
  sendCreated(res, await applicationService.applyToJob(currentUser(req), input));
}

export async function listMine(req: Request, res: Response) {
  const query = applicationListSchema.parse(req.query);
  sendPage(res, await applicationService.listOwnApplications(currentUser(req).id, query));
}

export async function details(req: Request, res: Response) {
  sendOk(res, await applicationService.getApplicationDetails(applicationId(req), currentUser(req)));
}

export async function updateStatus(req: Request, res: Response) {
  const { status } = updateApplicationStatusSchema.parse(req.body);
  sendOk(
    res,
    await applicationService.updateApplicationStatus(applicationId(req), currentUser(req), status),
  );
}

export async function withdraw(req: Request, res: Response) {
  sendOk(res, await applicationService.withdrawApplication(applicationId(req), currentUser(req)));
}

export async function resume(req: Request, res: Response) {
  const file = await applicationService.getApplicationResumeFile(
    applicationId(req),
    currentUser(req),
  );
  sendResumeFile(req, res, file);
}
