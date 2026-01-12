export const ImageFileExt = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'svg', 'heic', 'heif'];
export type ImageFileType = typeof ImageFileExt[number];

export const VideoFileExt = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'mpg', 'mpeg', '3gp'];
export type VideoFileType = typeof VideoFileExt[number];

export const AudioFileExt = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'wma', 'aiff', 'alac'];
export type AudioFileType = typeof AudioFileExt[number];

export const MediaFileExt = [...ImageFileExt, ...VideoFileExt, ...AudioFileExt];
export type MediaFileType = ImageFileType | VideoFileType | AudioFileType;

export const ModelFileExt = ['obj', 'fbx', 'stl', 'dae', 'ply', '3ds', 'gltf', 'glb'];
export type ModelFileType = typeof ModelFileExt[number];

export const ArchiveFileExt = ['zip', 'tar', 'gz', '7z', 'rar', 'tgz'];
export type ArchiveFileType = typeof ArchiveFileExt[number];

export const SystemFileExt = ['exe', 'dll', 'bin', 'iso', 'dmg', 'msi', 'deb', 'rpm', 'apk', 'appimage', 'rom', 'efi'];
export type SystemFileType = typeof SystemFileExt[number];

export const DatabaseFileExt = ['sqlite', 'sql', 'mdb', 'accdb'];
export type DatabaseFileType = typeof DatabaseFileExt[number];

export const BinaryFileExt = [...MediaFileExt, ...ModelFileExt, ...ArchiveFileExt, ...SystemFileExt, ...DatabaseFileExt];

export const DocumentFileExt = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'tex'];
export type DocumentFileType = typeof DocumentFileExt[number];

export const TextDocumentFileExt = ['txt', 'csv', 'log', 'md', 'rst'];
export type TextDocumentFileType = typeof TextDocumentFileExt[number];

export const CodeFileExt = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'php', 'go', 'rb', 'rs', 'swift', 'kt', 'dart', 'sh', 'bash', 'ps1', 'bat', 'cmd', 'html', 'css', 'scss', 'sass', 'less', 'xml', 'json', 'yaml', 'yml', 'ini', 'conf', 'cfg', 'env'];
export type CodeFileType = typeof CodeFileExt[number];

export const PlainTextFileExt = [...TextDocumentFileExt, ...CodeFileExt];
export type PlainTextFileType = TextDocumentFileType | CodeFileType;

export const FileExt = [...BinaryFileExt, ...DocumentFileExt, ...PlainTextFileExt];
export type FileType = typeof FileExt[number] | 'folder';

export const ContentTypeMap: Record<string, FileType> = {
    "text/html": "html",
    "text/plain": "txt",
    "text/css": "css",
    "text/javascript": "js",
    "application/json": "json",
    "application/xml": "xml",
    "application/javascript": "js",
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "application/zip": "zip",
    "application/octet-stream": "bin",
    "audio/mpeg": "mp3",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "text/csv": "csv",
};