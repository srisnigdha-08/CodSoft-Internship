import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/authenticate.js';
import * as seekerService from '../services/jobSeeker.service.js';
import * as resumeService from '../services/resume.service.js';
import { unprocessable } from '../utils/apiError.js';
import { sendCreated, sendMessage, sendOk } from '../utils/http.js';
import { idParams } from '../validation/common.js';
import {
  educationSchema,
  experienceSchema,
  jobSeekerProfileSchema,
  skillsSchema,
} from '../validation/profile.validation.js';
import { sendResumeFile } from './sendResumeFile.js';

const userId = (req: Request) => currentUser(req).id;
const entryId = (req: Request): z.infer<typeof idParams>['id'] => idParams.parse(req.params).id;

export async function getProfile(req: Request, res: Response) {
  sendOk(res, await seekerService.getFullProfile(userId(req)));
}

export async function updateProfile(req: Request, res: Response) {
  const input = jobSeekerProfileSchema.parse(req.body);
  sendOk(res, await seekerService.updateProfile(userId(req), input));
}

export async function replaceSkills(req: Request, res: Response) {
  const { skills } = skillsSchema.parse(req.body);
  sendOk(res, await seekerService.replaceSkills(userId(req), skills));
}

export async function addEducation(req: Request, res: Response) {
  sendCreated(res, await seekerService.addEducation(userId(req), educationSchema.parse(req.body)));
}

export async function updateEducation(req: Request, res: Response) {
  const input = educationSchema.parse(req.body);
  sendOk(res, await seekerService.updateEducation(userId(req), entryId(req), input));
}

export async function deleteEducation(req: Request, res: Response) {
  await seekerService.deleteEducation(userId(req), entryId(req));
  sendMessage(res, 'Education entry removed');
}

export async function addExperience(req: Request, res: Response) {
  sendCreated(
    res,
    await seekerService.addExperience(userId(req), experienceSchema.parse(req.body)),
  );
}

export async function updateExperience(req: Request, res: Response) {
  const input = experienceSchema.parse(req.body);
  sendOk(res, await seekerService.updateExperience(userId(req), entryId(req), input));
}

export async function deleteExperience(req: Request, res: Response) {
  await seekerService.deleteExperience(userId(req), entryId(req));
  sendMessage(res, 'Experience entry removed');
}

export async function getDashboard(req: Request, res: Response) {
  sendOk(res, await seekerService.getDashboard(userId(req)));
}

export async function getResume(req: Request, res: Response) {
  const profileId = await seekerService.getSeekerProfileId(userId(req));
  sendOk(res, await resumeService.getCurrentResume(profileId));
}

export async function uploadResume(req: Request, res: Response) {
  if (!req.file) throw unprocessable('Choose a resume file to upload');
  const profileId = await seekerService.getSeekerProfileId(userId(req));
  sendCreated(res, await resumeService.saveResume(profileId, req.file));
}

export async function downloadResume(req: Request, res: Response) {
  const profileId = await seekerService.getSeekerProfileId(userId(req));
  sendResumeFile(req, res, await resumeService.getCurrentResumeFile(profileId));
}

export async function deleteResume(req: Request, res: Response) {
  const profileId = await seekerService.getSeekerProfileId(userId(req));
  await resumeService.deleteCurrentResume(profileId);
  sendMessage(res, 'Resume removed');
}
