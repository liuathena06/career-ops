import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFounderResumeText } from '../lib/founder-resume-text.mjs';

test('PDF text is returned locally when a text layer exists', async () => {
  const result = await extractFounderResumeText({ fileName: 'resume.pdf', bytes: Buffer.from('%PDF-synthetic'), pdfExtractor: async () => 'English product experience' });
  assert.deepEqual(result, { status: 'success', text: 'English product experience', language: 'English', characterCount: 26 });
});

test('a PDF without extractable text is explicitly marked as unsupported scan', async () => {
  const result = await extractFounderResumeText({ fileName: 'resume.pdf', bytes: Buffer.from('%PDF-synthetic'), pdfExtractor: async () => '' });
  assert.equal(result.status, 'scanned_pdf_unsupported');
});

test('DOCX is sent only to the local office extractor', async () => {
  let called = false;
  const result = await extractFounderResumeText({ fileName: 'resume.docx', bytes: Buffer.from('docx'), officeExtractor: async () => { called = true; return '产品经验'; } });
  assert.equal(called, true); assert.equal(result.status, 'success'); assert.equal(result.text, '产品经验');
});
