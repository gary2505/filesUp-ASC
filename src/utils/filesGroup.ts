/**
 * This is src/lib/utils/filesGroup.ts
 * Used by: src/lib/utils/filemeta.ts, src/lib/P2/folderTree/parts/container-group-detect.ts, src/lib/folderTree/parts/container-group-detect.ts
 * Purpose: Defines file extension groups for classification
 * Trigger: Imported to access extension lists
 * Event Flow: Static data, no flow
 * List of functions: none (constant)
 */

import type { FileGroup } from './types';

export const GROUP_EXTENSIONS: Record<FileGroup, string[]> = {
  text: ['txt','md','log','csv','tsv','rtf','nfo','ini','cfg','json','yaml','yml','toml'],
  docs: ['doc','docx','odt','rtf','rtfd','pages'],
  pictures: ['png','jpg','jpeg','gif','webp','bmp','tiff','tif','ico','svg','heic','avif'],
  video: ['mp4','m4v','mov','avi','mkv','webm','wmv','flv','mpeg','mpg'],
  songs: ['mp3','aac','m4a','wav','flac','ogg','oga','opus','wma'],
  web: ['html','htm','css','scss','less','xml','xhtml'],
  code: ['c','h','cpp','hpp','rs','go','py','rb','php','java','kt','ts','tsx','js','jsx','svelte','vue','cs','sql','sh','ps1','bat','cmd','swift'],
  pdfs: ['pdf'],
  archives: ['zip','7z','rar','tar','gz','bz2','xz','lz','lzma','iso'],
  spreadsheets: ['xls','xlsx','ods','csv'],
  presentations: ['ppt','pptx','odp','key'],
  ebooks: ['epub','mobi','azw','azw3','fb2','djvu'],
  fonts: ['ttf','otf','woff','woff2'],
  executables: ['exe','msi','app','dmg','deb','rpm','bin','sh','cmd','bat'],
  other: []
};
