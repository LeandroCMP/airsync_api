import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class FilesService {
  constructor(private readonly configService: ConfigService) {}

  getUploadPath(filename: string) {
    const uploadDir = this.configService.get<string>('files.uploadDir');
    return join(process.cwd(), uploadDir, filename);
  }

  async saveBuffer(buffer: Buffer, extension: string) {
    const filename = `${randomUUID()}.${extension}`;
    const path = this.getUploadPath(filename);
    await fs.promises.writeFile(path, buffer);
    return `/files/${filename}`;
  }

  async saveBase64(dataUrl: string, extension: string) {
    const base64 = dataUrl.split(',').pop() || dataUrl;
    const buffer = Buffer.from(base64, 'base64');
    return this.saveBuffer(buffer, extension);
  }
}
