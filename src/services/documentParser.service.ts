import { extname } from 'node:path'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import { BadRequestException } from '../core/exceptions'

export interface ParseDocumentInput {
  fileName: string
  mimeType?: string
  buffer: ArrayBuffer | Uint8Array
}

export interface ParsedDocument {
  text: string
  metadata: Record<string, unknown>
}

const textMimeTypes = new Set([
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/markdown',
])

const pdfMimeTypes = new Set([
  'application/pdf',
  'application/x-pdf',
])

const docxMimeTypes = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
])

const normalizeBuffer = (buffer: ArrayBuffer | Uint8Array) => buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)

const normalizeText = (text: string) => text
  .replace(/\u0000/g, '')
  .replace(/\r\n?/g, '\n')
  .replace(/[\t ]+\n/g, '\n')
  .trim()

const getExtension = (fileName: string) => extname(fileName).toLowerCase()

const isTextDocument = (mimeType: string | undefined, extension: string) => {
  return textMimeTypes.has(mimeType ?? '') || extension === '.txt' || extension === '.md' || extension === '.markdown'
}

const isPdfDocument = (mimeType: string | undefined, extension: string) => {
  return pdfMimeTypes.has(mimeType ?? '') || extension === '.pdf'
}

const isDocxDocument = (mimeType: string | undefined, extension: string) => {
  return docxMimeTypes.has(mimeType ?? '') || extension === '.docx'
}

export const DocumentParserService = {
  async parse(input: ParseDocumentInput): Promise<ParsedDocument> {
    const bytes = normalizeBuffer(input.buffer)
    const mimeType = input.mimeType?.split(';')[0]?.trim().toLowerCase()
    const extension = getExtension(input.fileName)

    if (bytes.byteLength === 0) {
      throw new BadRequestException('上传文件不能为空', 'DOCUMENT_FILE_EMPTY')
    }

    if (isTextDocument(mimeType, extension)) {
      const text = normalizeText(new TextDecoder('utf-8').decode(bytes))
      if (!text) {
        throw new BadRequestException('文件解析后没有文本内容', 'DOCUMENT_TEXT_EMPTY')
      }

      return {
        text,
        metadata: {
          parser: 'text-decoder',
          format: extension === '.md' || extension === '.markdown' ? 'markdown' : 'text',
        },
      }
    }

    if (isPdfDocument(mimeType, extension)) {
      const parser = new PDFParse({ data: bytes })
      try {
        const result = await parser.getText()
        const text = normalizeText(result.text)
        if (!text) {
          throw new BadRequestException('PDF 解析后没有文本内容', 'DOCUMENT_TEXT_EMPTY')
        }

        return {
          text,
          metadata: {
            parser: 'pdf-parse',
            format: 'pdf',
            pages: result.pages.length,
          },
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error
        }
        throw new BadRequestException('PDF 文件解析失败，请确认文件未损坏且不是扫描件', 'DOCUMENT_PARSE_FAILED')
      } finally {
        await parser.destroy().catch(() => undefined)
      }
    }

    if (isDocxDocument(mimeType, extension)) {
      try {
        const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
        const text = normalizeText(result.value)
        if (!text) {
          throw new BadRequestException('Word 文档解析后没有文本内容', 'DOCUMENT_TEXT_EMPTY')
        }

        return {
          text,
          metadata: {
            parser: 'mammoth',
            format: 'docx',
            messages: result.messages.map((message) => ({ type: message.type, message: message.message })),
          },
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error
        }
        throw new BadRequestException('Word 文档解析失败，请确认文件为有效的 docx', 'DOCUMENT_PARSE_FAILED')
      }
    }

    throw new BadRequestException('不支持的文件格式，仅支持 txt、md、pdf、docx', 'DOCUMENT_UNSUPPORTED_TYPE')
  },
}
