import { ERROR_CODES } from '../../common/error-codes';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md',
  'jpg', 'jpeg', 'png', 'gif', 'webp',
] as const;

const DANGEROUS_MIME_TYPES = [
  'text/html',
  'application/javascript', 'text/javascript', 'application/x-javascript',
  'text/css',
  'image/svg+xml',
  'application/x-msdownload', 'application/exe', 'application/x-exe',
  'application/x-bat', 'application/x-sh',
  'application/x-php', 'application/x-asp',
  'application/xml', 'text/xml',
];

const EXTENSION_TO_MIME_MAP: Record<string, string[]> = {
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  txt: ['text/plain'],
  md: ['text/markdown', 'text/plain'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  gif: ['image/gif'],
  webp: ['image/webp'],
};

export interface ValidateAttachmentParams {
  fileName: string;
  fileSize?: number;
  mimeType?: string;
}

export interface ValidateAttachmentResult {
  valid: boolean;
  sanitizedFileName?: string;
  errorCode?: number;
  message?: string;
}

export function sanitizeFileName(fileName: string): string {
  let name = fileName.trim();

  if (!name) {
    return 'unnamed';
  }

  name = name.replace(/\.\.[\\/]/g, '_');
  name = name.replace(/[\\/]+/g, '_');
  name = name.replace(/[<>"|?*:]/g, '_');
  name = name.replace(/\0/g, '');

  const isExtOnly = /^\.[^.]+$/.test(name);

  name = name.replace(/^\.+|\.+$/g, '');
  name = name.trim();

  if (!name) {
    return 'unnamed';
  }

  let baseName: string;
  let ext: string;

  if (isExtOnly) {
    baseName = '';
    ext = '.' + name;
  } else {
    const lastDotIndex = name.lastIndexOf('.');
    if (lastDotIndex > 0 && lastDotIndex < name.length - 1) {
      baseName = name.slice(0, lastDotIndex);
      ext = name.slice(lastDotIndex);
    } else {
      baseName = name;
      ext = '';
    }
  }

  if (!baseName) {
    baseName = 'unnamed';
  }

  name = baseName + ext;

  const maxLength = 200;
  if (name.length > maxLength) {
    const baseMax = maxLength - ext.length;
    name = baseName.slice(0, Math.max(0, baseMax)) + ext;
  }

  return name;
}

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === fileName.length - 1) {
    return '';
  }
  return fileName.slice(dotIndex + 1).toLowerCase();
}

function isDangerousMimeType(mimeType: string): boolean {
  const lowerMime = mimeType.toLowerCase();
  return DANGEROUS_MIME_TYPES.some(d => lowerMime.includes(d));
}

export function validateAttachment(params: ValidateAttachmentParams): ValidateAttachmentResult {
  const { fileName, fileSize, mimeType } = params;

  const sanitizedFileName = sanitizeFileName(fileName);

  if (sanitizedFileName === 'unnamed' && !fileName.match(/\.\w+$/)) {
    return {
      valid: false,
      errorCode: ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID,
      message: '文件名不能为空',
    };
  }

  const ext = getFileExtension(sanitizedFileName);

  if (!ext) {
    return {
      valid: false,
      errorCode: ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID,
      message: '不支持的文件类型：缺少扩展名',
    };
  }

  if (!ALLOWED_EXTENSIONS.includes(ext as any)) {
    return {
      valid: false,
      errorCode: ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID,
      message: `不支持的文件类型：.${ext}`,
    };
  }

  if (fileSize !== undefined && fileSize > MAX_FILE_SIZE) {
    const sizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      errorCode: ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID,
      message: `文件大小超过限制，最大允许 ${sizeMB}MB`,
    };
  }

  if (mimeType) {
    if (isDangerousMimeType(mimeType)) {
      return {
        valid: false,
        errorCode: ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID,
        message: '不支持的文件类型：MIME 类型不被允许',
      };
    }

    const allowedMimes = EXTENSION_TO_MIME_MAP[ext];
    if (allowedMimes && allowedMimes.length > 0) {
      const lowerMime = mimeType.toLowerCase();
      const mimeMatches = allowedMimes.some(am => lowerMime.includes(am));
      if (!mimeMatches) {
        if (isDangerousMimeType(mimeType)) {
          return {
            valid: false,
            errorCode: ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID,
            message: '不支持的文件类型：文件内容与扩展名不匹配',
          };
        }
      }
    }
  }

  return {
    valid: true,
    sanitizedFileName,
  };
}
