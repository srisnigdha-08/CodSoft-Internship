import PDFDocument from 'pdfkit';

export interface DemoResumeContent {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: readonly string[];
  experience: {
    company: string;
    jobTitle: string;
    startDate: string;
    endDate: string | null;
  } | null;
  highlights: readonly string[];
  projects: readonly { name: string; detail: string }[];
  education: {
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate: string;
    grade: string;
  };
}

const INK = '#12343B';
const ACCENT = '#1F7A73';
const BODY = '#2B3A3E';
const MUTED = '#5F6F73';
const RULE = '#C9D6D3';
const MARGIN = 54;
const REGULAR = 'Helvetica';
const BOLD = 'Helvetica-Bold';
const DATE_COLUMN = 130;

type Doc = InstanceType<typeof PDFDocument>;

const contentWidth = (doc: Doc) => doc.page.width - MARGIN * 2;

function monthYear(date: string | null): string {
  if (!date) return 'Present';
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function drawHeader(doc: Doc, resume: DemoResumeContent): void {
  doc.font(BOLD).fontSize(25).fillColor(INK).text(resume.name, MARGIN, MARGIN);
  doc.moveDown(0.15).font(REGULAR).fontSize(11.5).fillColor(ACCENT).text(resume.headline, MARGIN);
  doc
    .moveDown(0.35)
    .fontSize(9.5)
    .fillColor(MUTED)
    .text(`${resume.email}   |   ${resume.phone}   |   ${resume.location}`, MARGIN);
}

function drawSection(doc: Doc, title: string): void {
  doc
    .moveDown(1)
    .font(BOLD)
    .fontSize(10)
    .fillColor(ACCENT)
    .text(title.toUpperCase(), MARGIN, doc.y, { characterSpacing: 1.2 });
  const y = doc.y + 3;
  doc
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + contentWidth(doc), y)
    .lineWidth(0.75)
    .strokeColor(RULE)
    .stroke();
  doc.x = MARGIN;
  doc.y = y + 7;
}

function drawEntryTitle(doc: Doc, title: string, dates: string): void {
  const y = doc.y;
  doc
    .font(REGULAR)
    .fontSize(9.5)
    .fillColor(MUTED)
    .text(dates, MARGIN + contentWidth(doc) - DATE_COLUMN, y, {
      width: DATE_COLUMN,
      align: 'right',
    });
  doc
    .font(BOLD)
    .fontSize(11)
    .fillColor(INK)
    .text(title, MARGIN, y, { width: contentWidth(doc) - DATE_COLUMN - 8 });
}

function drawBullet(doc: Doc, text: string): void {
  const y = doc.y;
  doc.font(REGULAR).fontSize(10).fillColor(BODY).text('•', MARGIN + 2, y);
  doc.text(text, MARGIN + 14, y, { width: contentWidth(doc) - 14, lineGap: 1.5 });
  doc.y += 2.5;
}

function drawBody(doc: Doc, text: string): void {
  doc.font(REGULAR).fontSize(10).fillColor(BODY).text(text, MARGIN, doc.y, {
    width: contentWidth(doc),
    lineGap: 2,
  });
}

function drawExperience(doc: Doc, resume: DemoResumeContent): void {
  if (!resume.experience) return;
  const { jobTitle, company, startDate, endDate } = resume.experience;
  drawSection(doc, 'Experience');
  drawEntryTitle(doc, jobTitle, `${monthYear(startDate)} – ${monthYear(endDate)}`);
  doc.font(REGULAR).fontSize(10).fillColor(MUTED).text(company, MARGIN);
  doc.moveDown(0.35);
  resume.highlights.forEach((highlight) => drawBullet(doc, highlight));
}

function drawProjects(doc: Doc, resume: DemoResumeContent): void {
  if (resume.projects.length === 0) return;
  drawSection(doc, 'Projects');
  for (const project of resume.projects) {
    doc.font(BOLD).fontSize(10).fillColor(INK).text(project.name, MARGIN);
    drawBody(doc, project.detail);
    doc.moveDown(0.4);
  }
}

function drawEducation(doc: Doc, resume: DemoResumeContent): void {
  const { degree, fieldOfStudy, institution, startDate, endDate, grade } = resume.education;
  drawSection(doc, 'Education');
  drawEntryTitle(doc, `${degree}, ${fieldOfStudy}`, `${monthYear(startDate)} – ${monthYear(endDate)}`);
  doc.font(REGULAR).fontSize(10).fillColor(MUTED).text(`${institution}   |   ${grade}`, MARGIN);
}

/** Builds a one-page resume from fictional seed data, using PDF standard fonts. */
export function buildDemoResume(resume: DemoResumeContent): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: MARGIN,
    displayTitle: true,
    info: { Title: `${resume.name} - Resume`, Author: resume.name },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  drawHeader(doc, resume);
  drawSection(doc, 'Summary');
  drawBody(doc, resume.summary);
  drawExperience(doc, resume);
  drawProjects(doc, resume);
  drawEducation(doc, resume);
  drawSection(doc, 'Skills');
  drawBody(doc, resume.skills.join('   •   '));

  doc.end();
  return finished;
}
