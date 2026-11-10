/**
 * Fictional demo data. Safe to run repeatedly: every record is matched on a stable key and
 * existing rows are left as they are, apart from refreshing deadlines on the demo jobs.
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ApplicationStatus,
  ExperienceLevel,
  JobStatus,
  JobType,
  PrismaClient,
  WorkMode,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { buildDemoResume } from './demoResume.js';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo@12345';
const DAY_MS = 86_400_000;
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads/resumes');

const seekers = [
  {
    key: 1,
    email: 'aarav.seeker@jobportal.example',
    name: 'Aarav Demo',
    phone: '+91 90000 00001',
    location: 'Bengaluru',
    headline: 'Full-stack developer focused on React and Node.js',
    summary:
      'Fictional demo candidate. Four years of building web products, from database design to polished interfaces.',
    skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'CSS'],
    highlights: [
      'Built customer dashboards in React and TypeScript used by more than 40 client teams.',
      'Designed REST APIs in Node.js and cut the slowest report query from 9 seconds to under 1.',
      'Introduced component tests and code review checklists, reducing escaped defects by a third.',
      'Mentored two junior engineers through their first production releases.',
    ],
    projects: [
      {
        name: 'Release Notes Hub',
        detail: 'Internal tool that turns merged pull requests into readable customer release notes.',
      },
    ],
    education: {
      institution: 'Demo Institute of Technology',
      degree: 'B.Tech',
      fieldOfStudy: 'Computer Science',
      startDate: '2015-07-01',
      endDate: '2019-05-31',
      grade: '8.4 CGPA',
    },
    experience: {
      company: 'Sample Softworks',
      jobTitle: 'Software Engineer',
      description: 'Built customer dashboards and REST APIs.',
      startDate: '2020-01-06',
      endDate: null,
      currentlyWorking: true,
    },
  },
  {
    key: 2,
    email: 'meera.seeker@jobportal.example',
    name: 'Meera Demo',
    phone: '+91 90000 00002',
    location: 'Pune',
    headline: 'Data analyst who turns messy data into decisions',
    summary: 'Fictional demo candidate. Comfortable with SQL, Python and reporting for business teams.',
    skills: ['SQL', 'Python', 'Power BI', 'Statistics'],
    highlights: [
      'Owned weekly sales and inventory reporting for 120 stores across four regions.',
      'Automated reconciliation in Python, saving the finance team about 15 hours each month.',
      'Built Power BI dashboards that replaced a set of manually maintained spreadsheets.',
      'Ran pricing experiments and presented the results to category managers.',
    ],
    projects: [
      {
        name: 'Stock-out Forecast',
        detail: 'Regression model that flags products likely to run out in the following two weeks.',
      },
    ],
    education: {
      institution: 'Example University',
      degree: 'M.Sc',
      fieldOfStudy: 'Statistics',
      startDate: '2018-07-01',
      endDate: '2020-05-31',
      grade: '8.9 CGPA',
    },
    experience: {
      company: 'Placeholder Retail',
      jobTitle: 'Data Analyst',
      description: 'Owned weekly sales and inventory reporting.',
      startDate: '2020-08-03',
      endDate: '2024-03-29',
      currentlyWorking: false,
    },
  },
  {
    key: 3,
    email: 'kabir.seeker@jobportal.example',
    name: 'Kabir Demo',
    phone: '+91 90000 00003',
    location: 'Hyderabad',
    headline: 'Recent graduate looking for a first engineering role',
    summary: 'Fictional demo candidate. Enjoys Java, testing and learning from code review.',
    skills: ['Java', 'Git', 'Testing'],
    highlights: [],
    projects: [
      {
        name: 'Campus Library Tracker',
        detail: 'Java and SQL application for issuing and returning books, built as a final-year project.',
      },
      {
        name: 'Unit Test Starter Kit',
        detail: 'JUnit templates and examples that helped classmates add tests to their coursework.',
      },
      {
        name: 'Team Task Board',
        detail: 'Small web app built with three teammates, using Git branches and peer code review.',
      },
    ],
    education: {
      institution: 'Demo College of Engineering',
      degree: 'B.E',
      fieldOfStudy: 'Information Technology',
      startDate: '2021-07-01',
      endDate: '2025-05-31',
      grade: '7.8 CGPA',
    },
    experience: null,
  },
] as const;

const employers = [
  {
    key: 1,
    email: 'hiring@northbeam.example',
    name: 'Riya Recruiter',
    position: 'Talent Lead',
    company: {
      name: 'Northbeam Analytics',
      website: 'https://northbeam.example',
      industry: 'Data & Analytics',
      size: '51-200',
      location: 'Bengaluru',
      description: 'A fictional analytics company helping retailers understand their customers.',
    },
  },
  {
    key: 2,
    email: 'hiring@cedarstudio.example',
    name: 'Dev Hiring',
    position: 'Engineering Manager',
    company: {
      name: 'Cedar Studio',
      website: 'https://cedarstudio.example',
      industry: 'Product Design & Software',
      size: '11-50',
      location: 'Pune',
      description: 'A fictional product studio shipping web and mobile apps for early-stage teams.',
    },
  },
  {
    key: 3,
    email: 'hiring@harborline.example',
    name: 'Tara Talent',
    position: 'HR Partner',
    company: {
      name: 'Harborline Systems',
      website: 'https://harborline.example',
      industry: 'Logistics Technology',
      size: '201-500',
      location: 'Hyderabad',
      description: 'A fictional logistics technology provider for port and warehouse operators.',
    },
  },
] as const;

interface DemoJob {
  n: number;
  employer: 1 | 2 | 3;
  title: string;
  location: string;
  jobType: JobType;
  workMode: WorkMode;
  experienceLevel: ExperienceLevel;
  salary: [number, number] | null;
  skills: string[];
  status: JobStatus;
  /** Days from now until the deadline. Negative values are in the past. */
  deadlineDays: number | null;
  ageDays: number;
}

const jobs: DemoJob[] = [
  { n: 1, employer: 1, title: 'Senior React Developer', location: 'Bengaluru', jobType: 'FULL_TIME', workMode: 'HYBRID', experienceLevel: 'SENIOR', salary: [1800000, 2800000], skills: ['React', 'TypeScript', 'CSS'], status: 'ACTIVE', deadlineDays: 45, ageDays: 1 },
  { n: 2, employer: 1, title: 'Data Analyst', location: 'Bengaluru', jobType: 'FULL_TIME', workMode: 'ONSITE', experienceLevel: 'MID', salary: [900000, 1400000], skills: ['SQL', 'Python', 'Power BI'], status: 'ACTIVE', deadlineDays: 30, ageDays: 2 },
  { n: 3, employer: 1, title: 'Machine Learning Intern', location: 'Remote', jobType: 'INTERNSHIP', workMode: 'REMOTE', experienceLevel: 'ENTRY', salary: [300000, 420000], skills: ['Python', 'Statistics'], status: 'ACTIVE', deadlineDays: 20, ageDays: 3 },
  { n: 4, employer: 1, title: 'Analytics Engineer', location: 'Mumbai', jobType: 'CONTRACT', workMode: 'HYBRID', experienceLevel: 'MID', salary: [1200000, 1700000], skills: ['SQL', 'Python', 'dbt'], status: 'ACTIVE', deadlineDays: 40, ageDays: 5 },
  { n: 5, employer: 2, title: 'Node.js Backend Engineer', location: 'Pune', jobType: 'FULL_TIME', workMode: 'REMOTE', experienceLevel: 'MID', salary: [1400000, 2200000], skills: ['Node.js', 'PostgreSQL', 'TypeScript'], status: 'ACTIVE', deadlineDays: 60, ageDays: 1 },
  { n: 6, employer: 2, title: 'UI/UX Designer', location: 'Pune', jobType: 'FULL_TIME', workMode: 'ONSITE', experienceLevel: 'MID', salary: [1000000, 1500000], skills: ['Figma', 'User Research'], status: 'ACTIVE', deadlineDays: 25, ageDays: 4 },
  { n: 7, employer: 2, title: 'Freelance Technical Writer', location: 'Remote', jobType: 'FREELANCE', workMode: 'REMOTE', experienceLevel: 'ENTRY', salary: null, skills: ['Technical Writing', 'Git'], status: 'ACTIVE', deadlineDays: null, ageDays: 6 },
  { n: 8, employer: 2, title: 'Part-time QA Engineer', location: 'Pune', jobType: 'PART_TIME', workMode: 'HYBRID', experienceLevel: 'ENTRY', salary: [400000, 600000], skills: ['Testing', 'Java'], status: 'ACTIVE', deadlineDays: 35, ageDays: 8 },
  { n: 9, employer: 3, title: 'Java Software Engineer', location: 'Hyderabad', jobType: 'FULL_TIME', workMode: 'ONSITE', experienceLevel: 'ENTRY', salary: [700000, 1000000], skills: ['Java', 'Git', 'Testing'], status: 'ACTIVE', deadlineDays: 50, ageDays: 2 },
  { n: 10, employer: 3, title: 'Engineering Lead, Platform', location: 'Hyderabad', jobType: 'FULL_TIME', workMode: 'HYBRID', experienceLevel: 'LEAD', salary: [3500000, 5000000], skills: ['Kubernetes', 'PostgreSQL', 'Node.js'], status: 'ACTIVE', deadlineDays: 55, ageDays: 3 },
  { n: 11, employer: 3, title: 'DevOps Engineer', location: 'Chennai', jobType: 'CONTRACT', workMode: 'REMOTE', experienceLevel: 'SENIOR', salary: [2000000, 3000000], skills: ['Kubernetes', 'Terraform'], status: 'ACTIVE', deadlineDays: 28, ageDays: 9 },
  { n: 12, employer: 3, title: 'Warehouse Systems Analyst (Draft)', location: 'Hyderabad', jobType: 'FULL_TIME', workMode: 'ONSITE', experienceLevel: 'MID', salary: [800000, 1200000], skills: ['SQL'], status: 'DRAFT', deadlineDays: 70, ageDays: 1 },
  { n: 13, employer: 1, title: 'Product Analyst', location: 'Bengaluru', jobType: 'FULL_TIME', workMode: 'HYBRID', experienceLevel: 'MID', salary: [1100000, 1600000], skills: ['SQL', 'Statistics'], status: 'CLOSED', deadlineDays: null, ageDays: 40 },
  { n: 14, employer: 2, title: 'Frontend Developer (Expired)', location: 'Pune', jobType: 'FULL_TIME', workMode: 'REMOTE', experienceLevel: 'ENTRY', salary: [600000, 900000], skills: ['React', 'CSS'], status: 'EXPIRED', deadlineDays: -5, ageDays: 50 },
];

const jobIdFor = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const REVIEW_PATH: ApplicationStatus[] = [
  'APPLIED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW',
  'HIRED',
];

function statusPath(target: ApplicationStatus): ApplicationStatus[] {
  if (target === 'REJECTED') return ['APPLIED', 'UNDER_REVIEW', 'REJECTED'];
  if (target === 'WITHDRAWN') return ['APPLIED', 'WITHDRAWN'];
  return REVIEW_PATH.slice(0, REVIEW_PATH.indexOf(target) + 1);
}

const demoApplications: { seeker: 1 | 2 | 3; job: number; status: ApplicationStatus }[] = [
  { seeker: 1, job: 1, status: 'SHORTLISTED' },
  { seeker: 1, job: 5, status: 'APPLIED' },
  { seeker: 1, job: 13, status: 'REJECTED' },
  { seeker: 2, job: 2, status: 'INTERVIEW' },
  { seeker: 2, job: 4, status: 'UNDER_REVIEW' },
  { seeker: 2, job: 3, status: 'WITHDRAWN' },
  { seeker: 3, job: 9, status: 'APPLIED' },
  { seeker: 3, job: 8, status: 'HIRED' },
];

const asDate = (value: string | null) => (value ? new Date(`${value}T00:00:00.000Z`) : null);

async function ensureSkills(names: readonly string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const normalizedName = name.toLowerCase();
    const skill = await prisma.skill.upsert({
      where: { normalizedName },
      create: { name, normalizedName },
      update: {},
      select: { id: true },
    });
    ids.push(skill.id);
  }
  return ids;
}

async function seedAdmin(passwordHash: string): Promise<string> {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jobportal.example' },
    create: { email: 'admin@jobportal.example', name: 'Portal Admin', role: 'ADMIN', passwordHash },
    update: {},
    select: { id: true },
  });
  return admin.id;
}

async function seedSeeker(seeker: (typeof seekers)[number], passwordHash: string) {
  const user = await prisma.user.upsert({
    where: { email: seeker.email },
    create: {
      email: seeker.email,
      name: seeker.name,
      role: 'JOB_SEEKER',
      passwordHash,
      jobSeekerProfile: {
        create: {
          phone: seeker.phone,
          location: seeker.location,
          headline: seeker.headline,
          summary: seeker.summary,
        },
      },
    },
    update: {},
    select: { id: true, jobSeekerProfile: { select: { id: true, currentResumeId: true } } },
  });
  const profile = user.jobSeekerProfile!;

  for (const skillId of await ensureSkills(seeker.skills)) {
    await prisma.jobSeekerSkill.upsert({
      where: { profileId_skillId: { profileId: profile.id, skillId } },
      create: { profileId: profile.id, skillId },
      update: {},
    });
  }

  if ((await prisma.education.count({ where: { profileId: profile.id } })) === 0) {
    const { startDate, endDate, ...rest } = seeker.education;
    await prisma.education.create({
      data: { ...rest, profileId: profile.id, startDate: asDate(startDate)!, endDate: asDate(endDate) },
    });
  }

  if (seeker.experience && (await prisma.experience.count({ where: { profileId: profile.id } })) === 0) {
    const { startDate, endDate, ...rest } = seeker.experience;
    await prisma.experience.create({
      data: { ...rest, profileId: profile.id, startDate: asDate(startDate)!, endDate: asDate(endDate) },
    });
  }

  const storedName = `demo-resume-${seeker.key}.pdf`;
  const pdf = await buildDemoResume({
    name: seeker.name,
    headline: seeker.headline,
    email: seeker.email,
    phone: seeker.phone,
    location: seeker.location,
    summary: seeker.summary.replace('Fictional demo candidate. ', ''),
    skills: seeker.skills,
    experience: seeker.experience,
    highlights: seeker.highlights,
    projects: seeker.projects,
    education: seeker.education,
  });
  await writeFile(path.join(uploadDir, storedName), pdf);
  const resume = await prisma.resume.upsert({
    where: { storedName },
    create: {
      profileId: profile.id,
      storedName,
      originalName: `${seeker.name.replace(/\s+/g, '_')}_Resume.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: pdf.length,
    },
    update: { sizeBytes: pdf.length },
    select: { id: true },
  });
  if (!profile.currentResumeId) {
    await prisma.jobSeekerProfile.update({
      where: { id: profile.id },
      data: { currentResumeId: resume.id },
    });
  }
  return { userId: user.id, profileId: profile.id, resumeId: resume.id };
}

async function seedEmployer(employer: (typeof employers)[number], passwordHash: string) {
  const user = await prisma.user.upsert({
    where: { email: employer.email },
    create: {
      email: employer.email,
      name: employer.name,
      role: 'EMPLOYER',
      passwordHash,
      employerProfile: { create: { position: employer.position } },
    },
    update: {},
    select: { id: true, employerProfile: { select: { id: true } } },
  });
  const employerProfileId = user.employerProfile!.id;
  const company = await prisma.company.upsert({
    where: { employerProfileId },
    create: { ...employer.company, employerProfileId },
    update: {},
    select: { id: true },
  });
  return { userId: user.id, companyId: company.id };
}

function jobText(job: DemoJob, companyName: string) {
  const skills = job.skills.join(', ');
  return {
    description: `${companyName} (a fictional company) is hiring a ${job.title}. You will join a small, collaborative team and take ownership of meaningful work from the first month.`,
    requirements: `Working knowledge of ${skills}.\nClear written communication.\nComfort giving and receiving feedback.`,
    responsibilities: `Deliver work using ${skills}.\nCollaborate with teammates across functions.\nShare what you learn and improve how the team works.`,
  };
}

async function seedJob(job: DemoJob, companyId: string, companyName: string, now: number) {
  const id = jobIdFor(job.n);
  const expiresAt = job.deadlineDays === null ? null : new Date(now + job.deadlineDays * DAY_MS);
  const publishedAt = job.status === 'DRAFT' ? null : new Date(now - job.ageDays * DAY_MS);
  await prisma.job.upsert({
    where: { id },
    create: {
      id,
      companyId,
      title: job.title,
      ...jobText(job, companyName),
      location: job.location,
      jobType: job.jobType,
      workMode: job.workMode,
      experienceLevel: job.experienceLevel,
      salaryMin: job.salary?.[0] ?? null,
      salaryMax: job.salary?.[1] ?? null,
      status: job.status,
      publishedAt,
      expiresAt,
    },
    update: { expiresAt },
  });
  for (const skillId of await ensureSkills(job.skills)) {
    await prisma.jobSkill.upsert({
      where: { jobId_skillId: { jobId: id, skillId } },
      create: { jobId: id, skillId },
      update: {},
    });
  }
}

async function seedApplication(
  entry: (typeof demoApplications)[number],
  seeker: { userId: string; profileId: string; resumeId: string },
  employerUserId: string,
) {
  const jobId = jobIdFor(entry.job);
  const existing = await prisma.application.findUnique({
    where: { jobId_candidateId: { jobId, candidateId: seeker.profileId } },
    select: { id: true },
  });
  if (existing) return;

  const steps = statusPath(entry.status);
  const start = Date.now() - steps.length * DAY_MS;
  await prisma.application.create({
    data: {
      jobId,
      candidateId: seeker.profileId,
      resumeId: seeker.resumeId,
      status: entry.status,
      coverLetter: 'I would welcome the chance to contribute to your team. (Fictional demo text.)',
      createdAt: new Date(start),
      history: {
        create: steps.map((newStatus, index) => ({
          previousStatus: index === 0 ? null : steps[index - 1],
          newStatus,
          changedById: newStatus === 'APPLIED' || newStatus === 'WITHDRAWN' ? seeker.userId : employerUserId,
          timestamp: new Date(start + index * DAY_MS),
        })),
      },
    },
  });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Refusing to load demo accounts in production. Set ALLOW_DEMO_SEED=true to override.');
  }
  await mkdir(uploadDir, { recursive: true });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const now = Date.now();

  await seedAdmin(passwordHash);

  const seededSeekers = new Map<number, Awaited<ReturnType<typeof seedSeeker>>>();
  for (const seeker of seekers) seededSeekers.set(seeker.key, await seedSeeker(seeker, passwordHash));

  const seededEmployers = new Map<number, Awaited<ReturnType<typeof seedEmployer>>>();
  for (const employer of employers) {
    seededEmployers.set(employer.key, await seedEmployer(employer, passwordHash));
  }

  for (const job of jobs) {
    const owner = employers.find((employer) => employer.key === job.employer)!;
    await seedJob(job, seededEmployers.get(job.employer)!.companyId, owner.company.name, now);
  }

  for (const entry of demoApplications) {
    const job = jobs.find((candidate) => candidate.n === entry.job)!;
    await seedApplication(
      entry,
      seededSeekers.get(entry.seeker)!,
      seededEmployers.get(job.employer)!.userId,
    );
  }

  const [users, jobCount, applications] = await Promise.all([
    prisma.user.count(),
    prisma.job.count(),
    prisma.application.count(),
  ]);
  console.log(`Seed complete: ${users} users, ${jobCount} jobs, ${applications} applications.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Seed failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
