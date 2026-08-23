import {
  validateAttachment,
  sanitizeFileName,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
} from './attachment-security.util';
import { ERROR_CODES } from '../../common/error-codes';

describe('attachment-security.util', () => {
  describe('ALLOWED_EXTENSIONS', () => {
    it('包含文档类扩展名', () => {
      expect(ALLOWED_EXTENSIONS).toEqual(expect.arrayContaining(
        ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md']
      ));
    });

    it('包含图片类扩展名', () => {
      expect(ALLOWED_EXTENSIONS).toEqual(expect.arrayContaining(
        ['jpg', 'jpeg', 'png', 'gif', 'webp']
      ));
    });

    it('不包含危险扩展名', () => {
      const dangerous = ['exe', 'js', 'html', 'htm', 'css', 'svg', 'bat', 'sh', 'php', 'asp'];
      for (const ext of dangerous) {
        expect(ALLOWED_EXTENSIONS).not.toContain(ext);
      }
    });
  });

  describe('MAX_FILE_SIZE', () => {
    it('等于 10MB', () => {
      expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });
  });

  describe('sanitizeFileName', () => {
    it('保留合法文件名不变', () => {
      expect(sanitizeFileName('report.pdf')).toBe('report.pdf');
      expect(sanitizeFileName('my document.docx')).toBe('my document.docx');
      expect(sanitizeFileName('file_v2.1.txt')).toBe('file_v2.1.txt');
    });

    it('去除路径遍历字符', () => {
      expect(sanitizeFileName('../etc/passwd')).toBe('_etc_passwd');
      expect(sanitizeFileName('..\\..\\secret.txt')).toBe('__secret.txt');
      expect(sanitizeFileName('/etc/passwd')).toBe('_etc_passwd');
      expect(sanitizeFileName('..\\windows\\system32\\cmd.exe')).toBe('_windows_system32_cmd.exe');
    });

    it('替换特殊字符为下划线', () => {
      expect(sanitizeFileName('file<name>.pdf')).toBe('file_name_.pdf');
      expect(sanitizeFileName('file"name".pdf')).toBe('file_name_.pdf');
      expect(sanitizeFileName('file|name.pdf')).toBe('file_name.pdf');
      expect(sanitizeFileName('file?name.pdf')).toBe('file_name.pdf');
      expect(sanitizeFileName('file*name.pdf')).toBe('file_name.pdf');
      expect(sanitizeFileName('file:name.pdf')).toBe('file_name.pdf');
    });

    it('处理空文件名', () => {
      expect(sanitizeFileName('')).toBe('unnamed');
      expect(sanitizeFileName('   ')).toBe('unnamed');
    });

    it('处理只有扩展名的情况', () => {
      expect(sanitizeFileName('.pdf')).toBe('unnamed.pdf');
    });

    it('去除首尾空白和点', () => {
      expect(sanitizeFileName('  report.pdf  ')).toBe('report.pdf');
      expect(sanitizeFileName('..report.pdf..')).toBe('report.pdf');
    });

    it('限制文件名长度', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const result = sanitizeFileName(longName);
      expect(result.length).toBeLessThanOrEqual(200);
      expect(result.endsWith('.pdf')).toBe(true);
    });
  });

  describe('validateAttachment', () => {
    describe('文件大小校验', () => {
      it('文件大小在限制内通过', () => {
        const result = validateAttachment({
          fileName: 'test.pdf',
          fileSize: 1024 * 1024,
          mimeType: 'application/pdf',
        });
        expect(result.valid).toBe(true);
      });

      it('文件大小恰好等于限制通过', () => {
        const result = validateAttachment({
          fileName: 'test.pdf',
          fileSize: MAX_FILE_SIZE,
          mimeType: 'application/pdf',
        });
        expect(result.valid).toBe(true);
      });

      it('超过大小限制返回错误', () => {
        const result = validateAttachment({
          fileName: 'test.pdf',
          fileSize: MAX_FILE_SIZE + 1,
          mimeType: 'application/pdf',
        });
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
        expect(result.message).toContain('10MB');
      });

      it('fileSize 未提供时跳过大小校验', () => {
        const result = validateAttachment({
          fileName: 'test.pdf',
          mimeType: 'application/pdf',
        });
        expect(result.valid).toBe(true);
      });
    });

    describe('文件类型白名单校验', () => {
      const validDocs = [
        ['report.pdf', 'application/pdf'],
        ['document.doc', 'application/msword'],
        ['document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        ['sheet.xls', 'application/vnd.ms-excel'],
        ['sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        ['slide.ppt', 'application/vnd.ms-powerpoint'],
        ['slide.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        ['notes.txt', 'text/plain'],
        ['readme.md', 'text/markdown'],
      ];

      const validImages = [
        ['photo.jpg', 'image/jpeg'],
        ['photo.jpeg', 'image/jpeg'],
        ['image.png', 'image/png'],
        ['anim.gif', 'image/gif'],
        ['pic.webp', 'image/webp'],
      ];

      it.each(validDocs)('文档类型 %s 通过校验', (fileName, mimeType) => {
        const result = validateAttachment({ fileName, fileSize: 1000, mimeType });
        expect(result.valid).toBe(true);
      });

      it.each(validImages)('图片类型 %s 通过校验', (fileName, mimeType) => {
        const result = validateAttachment({ fileName, fileSize: 1000, mimeType });
        expect(result.valid).toBe(true);
      });

      it('扩展名大小写不敏感', () => {
        expect(validateAttachment({ fileName: 'TEST.PDF', fileSize: 1000, mimeType: 'application/pdf' }).valid).toBe(true);
        expect(validateAttachment({ fileName: 'Test.DocX', fileSize: 1000, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }).valid).toBe(true);
        expect(validateAttachment({ fileName: 'image.PNG', fileSize: 1000, mimeType: 'image/png' }).valid).toBe(true);
      });

      const dangerousFiles = [
        ['script.exe', 'application/x-msdownload'],
        ['code.js', 'application/javascript'],
        ['page.html', 'text/html'],
        ['page.htm', 'text/html'],
        ['style.css', 'text/css'],
        ['image.svg', 'image/svg+xml'],
        ['script.bat', 'application/x-bat'],
        ['script.sh', 'application/x-sh'],
        ['page.php', 'application/x-php'],
        ['page.asp', 'application/x-asp'],
      ];

      it.each(dangerousFiles)('危险文件 %s 被拒绝', (fileName, mimeType) => {
        const result = validateAttachment({ fileName, fileSize: 1000, mimeType });
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
        expect(result.message).toContain('不支持的文件类型');
      });

      it('无扩展名的文件被拒绝', () => {
        const result = validateAttachment({ fileName: 'noextension', fileSize: 1000, mimeType: 'application/octet-stream' });
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
      });

      it('未知扩展名的文件被拒绝', () => {
        const result = validateAttachment({ fileName: 'file.xyz123', fileSize: 1000, mimeType: 'application/octet-stream' });
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
      });
    });

    describe('文件名安全处理', () => {
      it('路径遍历的文件名被清理后仍校验扩展名', () => {
        const result = validateAttachment({
          fileName: '../etc/passwd.pdf',
          fileSize: 1000,
          mimeType: 'application/pdf',
        });
        expect(result.valid).toBe(true);
        expect(result.sanitizedFileName).toBe('_etc_passwd.pdf');
      });

      it('空文件名返回错误', () => {
        const result = validateAttachment({
          fileName: '',
          fileSize: 1000,
          mimeType: 'application/pdf',
        });
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
      });
    });

    describe('MIME type 补充校验', () => {
      it('扩展名与 MIME 类型严重不匹配时拒绝（exe 扩展名 + pdf MIME）', () => {
        const result = validateAttachment({
          fileName: 'malicious.exe',
          fileSize: 1000,
          mimeType: 'application/pdf',
        });
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
      });

      it('扩展名在白名单但 MIME 是 html 时拒绝', () => {
        const result = validateAttachment({
          fileName: 'fake.pdf',
          fileSize: 1000,
          mimeType: 'text/html',
        });
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
      });

      it('扩展名在白名单但 MIME 是 javascript 时拒绝', () => {
        const result = validateAttachment({
          fileName: 'readme.txt',
          fileSize: 1000,
          mimeType: 'application/javascript',
        });
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
      });
    });
  });
});
