import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/authenticate.js';
import * as applicationService from '../services/application.service.js';
import * as jobService from '../services/job.service.js';
import { listSkills } from '../services/skill.service.js';
import { sendCreated, sendMessage, sendOk, sendPage } from '../utils/http.js';
import { applicationListSchema } from '../validation/application.validation.js';
import { idParams } from '../validation/common.js';
import {
  createJobSchema,
  jobSearchSchema,
  jobStatusSchema,
  updateJobSchema,
} from '../validation/job.validation.js';

const jobId = (req: Request) => idParams.parse(req.params).id;
const skillQuery = z.object({ q: z.string().trim().max(60).optional() });

export async function search(req: Request, res: Response) {
  sendPage(res, await jobService.searchJobs(jobSearchSchema.parse(req.query)));
}

export async function filterOptions(_req: Request, res: Response) {
  sendOk(res, await jobService.getJobFilterOptions());
}

export async function skills(req: Request, res: Response) {
  sendOk(res, await listSkills(skillQuery.parse(req.query).q));
}

export async function details(req: Request, res: Response) {
  sendOk(res, await jobService.getJobDetails(jobId(req), req.user));
}

export async function create(req: Request, res: Response) {
  sendCreated(res, await jobService.createJob(currentUser(req), createJobSchema.parse(req.body)));
}

export async function update(req: Request, res: Response) {
  const input = updateJobSchema.parse(req.body);
  sendOk(res, await jobService.updateJob(jobId(req), currentUser(req), input));
}

export async function changeStatus(req: Request, res: Response) {
  const { status } = jobStatusSchema.parse(req.body);
  sendOk(res, await jobService.changeJobStatus(jobId(req), currentUser(req), status));
}

export async function remove(req: Request, res: Response) {
  await jobService.deleteJob(jobId(req), currentUser(req));
  sendMessage(res, 'Job deleted');
}

export async function applicants(req: Request, res: Response) {
  const query = applicationListSchema.parse(req.query);
  const { job, items, meta } = await applicationService.listJobApplicants(
    jobId(req),
    currentUser(req),
    query,
  );
  res.json({ success: true, data: items, meta, job });
}
