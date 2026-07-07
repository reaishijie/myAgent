import { expect, test } from 'bun:test'
import JSZip from 'jszip'
import { BusinessException } from '../core/exceptions'
import { DocumentParserService } from './documentParser.service'

test('document parser extracts txt and markdown text', async () => {
  const parsed = await DocumentParserService.parse({
    fileName: 'demo.md',
    mimeType: 'text/markdown',
    buffer: new TextEncoder().encode('# 标题\n\n内容'),
  })

  expect(parsed.text).toBe('# 标题\n\n内容')
  expect(parsed.metadata).toMatchObject({ parser: 'text-decoder', format: 'markdown' })
})

test('document parser extracts pdf text', async () => {
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT /F1 24 Tf 100 700 Td (Hello PDF RAG) Tj ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000311 00000 n 
trailer
<< /Root 1 0 R /Size 6 >>
startxref
405
%%EOF`
  const parsed = await DocumentParserService.parse({
    fileName: 'demo.pdf',
    mimeType: 'application/pdf',
    buffer: new TextEncoder().encode(pdf),
  })

  expect(parsed.text).toContain('Hello PDF RAG')
  expect(parsed.metadata).toMatchObject({ parser: 'pdf-parse', format: 'pdf', pages: 1 })
})

test('document parser extracts docx text', async () => {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.folder('_rels')?.file('.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.folder('word')?.file('document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello DOCX RAG</w:t></w:r></w:p></w:body></w:document>')
  const buffer = await zip.generateAsync({ type: 'uint8array' })
  const parsed = await DocumentParserService.parse({
    fileName: 'demo.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer,
  })

  expect(parsed.text).toBe('Hello DOCX RAG')
  expect(parsed.metadata).toMatchObject({ parser: 'mammoth', format: 'docx' })
})

test('document parser rejects unsupported files with business error', async () => {
  expect.assertions(2)

  try {
    await DocumentParserService.parse({
      fileName: 'image.png',
      mimeType: 'image/png',
      buffer: new Uint8Array([1, 2, 3]),
    })
  } catch (error) {
    expect(error).toBeInstanceOf(BusinessException)
    expect((error as BusinessException).errorCode).toBe('DOCUMENT_UNSUPPORTED_TYPE')
  }
})
