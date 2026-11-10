import { Router, type RequestHandler } from 'express';
import * as admin from '../controllers/admin.controller.js';
import * as application from '../controllers/application.controller.js';
import * as auth from '../controllers/auth.controller.js';
import * as employer from '../controllers/employer.controller.js';
import { getHealth } from '../controllers/health.controller.js';
import * as job from '../controllers/job.controller.js';
import * as seeker from '../controllers/jobSeeker.controller.js';
import { optionalAuth, requireAuth, requireRole } from '../middleware/authenticate.js';
import { resumeUpload } from '../middleware/resumeUpload.js';

const seekerOnly = [requireAuth, requireRole('JOB_SEEKER')];
const employerOnly = [requireAuth, requireRole('EMPLOYER')];
const employerOrAdmin = [requireAuth, requireRole('EMPLOYER', 'ADMIN')];

function authRoutes(authLimiter: RequestHandler): Router {
  const router = Router();
  router.post('/register', authLimiter, auth.register);
  router.post('/login', authLimiter, auth.login);
  router.post('/logout', auth.logout);
  router.get('/me', requireAuth, auth.me);
  return router;
}

function userRoutes(authLimiter: RequestHandler): Router {
  const router = Router();
  router.patch('/me', requireAuth, auth.updateAccount);
  router.post('/me/password', requireAuth, authLimiter, auth.changePassword);
  return router;
}

function jobSeekerRoutes(): Router {
  const router = Router();
  router.use(seekerOnly);
  router.get('/me', seeker.getProfile);
  router.put('/me', seeker.updateProfile);
  router.get('/me/dashboard', seeker.getDashboard);
  router.put('/me/skills', seeker.replaceSkills);
  router.post('/me/education', seeker.addEducation);
  router.put('/me/education/:id', seeker.updateEducation);
  router.delete('/me/education/:id', seeker.deleteEducation);
  router.post('/me/experience', seeker.addExperience);
  router.put('/me/experience/:id', seeker.updateExperience);
  router.delete('/me/experience/:id', seeker.deleteExperience);
  router.get('/me/resume', seeker.getResume);
  router.post('/me/resume', resumeUpload, seeker.uploadResume);
  router.get('/me/resume/file', seeker.downloadResume);
  router.delete('/me/resume', seeker.deleteResume);
  return router;
}

function employerRoutes(): Router {
  const router = Router();
  router.use(employerOnly);
  router.get('/me', employer.getProfile);
  router.put('/me', employer.updateProfile);
  router.get('/me/dashboard', employer.getDashboard);
  router.get('/me/jobs', employer.listOwnJobs);
  return router;
}

function companyRoutes(): Router {
  const router = Router();
  router.get('/me', employerOnly, employer.getOwnCompany);
  router.put('/me', employerOnly, employer.saveOwnCompany);
  router.get('/:id', employer.getPublicCompany);
  return router;
}

function jobRoutes(): Router {
  const router = Router();
  router.get('/', job.search);
  router.get('/filters', job.filterOptions);
  router.get('/skills', job.skills);
  router.post('/', employerOnly, job.create);
  router.get('/:id', optionalAuth, job.details);
  router.put('/:id', employerOrAdmin, job.update);
  router.patch('/:id/status', employerOrAdmin, job.changeStatus);
  router.delete('/:id', employerOrAdmin, job.remove);
  router.get('/:id/applications', employerOrAdmin, job.applicants);
  return router;
}

function applicationRoutes(): Router {
  const router = Router();
  router.post('/', seekerOnly, application.apply);
  router.get('/', seekerOnly, application.listMine);
  router.get('/:id', requireAuth, application.details);
  router.post('/:id/withdraw', seekerOnly, application.withdraw);
  router.patch('/:id/status', employerOrAdmin, application.updateStatus);
  router.get('/:id/resume', requireAuth, application.resume);
  return router;
}

function adminRoutes(): Router {
  const router = Router();
  router.use(requireAuth, requireRole('ADMIN'));
  router.get('/stats', admin.stats);
  router.get('/users', admin.users);
  router.patch('/users/:id/status', admin.setUserStatus);
  router.get('/employers', admin.employers);
  router.get('/jobs', admin.jobs);
  router.patch('/jobs/:id/moderation', admin.moderateJob);
  router.get('/applications', admin.applications);
  return router;
}

export function buildApiRouter(authLimiter: RequestHandler): Router {
  const api = Router();
  api.get('/health', getHealth);
  api.use('/auth', authRoutes(authLimiter));
  api.use('/users', userRoutes(authLimiter));
  api.use('/job-seekers', jobSeekerRoutes());
  api.use('/employers', employerRoutes());
  api.use('/companies', companyRoutes());
  api.use('/jobs', jobRoutes());
  api.use('/applications', applicationRoutes());
  api.use('/admin', adminRoutes());
  return api;
}
