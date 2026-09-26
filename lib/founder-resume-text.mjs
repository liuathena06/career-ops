/** Local-only resume text extraction for the Founder test UI. */
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFParse } from 'pdf-parse';

const MAX_RESUME_BYTES = 8 * 1024 * 1024;
const text = (value) => typeof value === 'string' ? value.replace(/\u0000/g, '').trim() : '';

function extension(fileName) { return typeof fileName === 'string' ? fileName.toLowerCase().split('.').pop() : ''; }
function typeFor({ fileName, mimeType, bytes }) {
  if (Buffer.isBuffer(bytes) && bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf';
  const ext = extension(fileName); const mime = text(mimeType).toLowerCase();
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (ext === 'docx' || mime.includes('wordprocessingml')) return 'docx';
  if (ext === 'doc' || mime === 'application/msword') return 'doc';
  if (ext === 'txt' || ext === 'md' || mime.startsWith('text/')) return 'text';
  return 'unsupported';
}

function language(value) {
  const sample = text(value); if (!sample) return 'unknown';
  return /[A-Za-z]/.test(sample) ? 'English' : 'non-English/unknown';
}

async function pdfText(bytes) {
  const parser = new PDFParse({ data: bytes });
  try { return text((await parser.getText()).text); } finally { await parser.destroy(); }
}

async function textUtilText(bytes, suffix) {
  const dir = await mkdtemp(join(tmpdir(), 'career-agent-resume-'));
  const file = join(dir, 'resume.' + suffix);
  try {
    await writeFile(file, bytes, { mode: 0o600 });
    return await new Promise((resolve, reject) => execFile('/usr/bin/textutil', ['-convert', 'txt', '-stdout', '--', file], { maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => error ? reject(error) : resolve(text(stdout))));
  } finally { await rm(dir, { recursive: true, force: true }); }
}

/** Returns text only to the current local browser session; it never persists or logs source content. */
export async function extractFounderResumeText({ fileName, mimeType = '', bytes, pdfExtractor = pdfText, officeExtractor = textUtilText }) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return { status: 'failed', text: '', language: 'unknown', characterCount: 0 };
  if (bytes.length > MAX_RESUME_BYTES) return { status: 'too_large', text: '', language: 'unknown', characterCount: 0 };
  const kind = typeFor({ fileName, mimeType, bytes });
  try {
    const extracted = kind === 'pdf' ? await pdfExtractor(bytes)
      : kind === 'docx' || kind === 'doc' ? await officeExtractor(bytes, kind)
        : kind === 'text' ? bytes.toString('utf8') : '';
    const result = text(extracted);
    if (!result && kind === 'pdf') return { status: 'scanned_pdf_unsupported', text: '', language: 'unknown', characterCount: 0 };
    if (!result) return { status: kind === 'unsupported' ? 'unsupported' : 'failed', text: '', language: 'unknown', characterCount: 0 };
    return { status: 'success', text: result, language: language(result), characterCount: result.length };
  } catch { return { status: kind === 'pdf' ? 'scanned_pdf_unsupported' : 'failed', text: '', language: 'unknown', characterCount: 0 }; }
}
