import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    const ext = file.originalname.split('.').pop() || 'bin';
    const url = await this.filesService.saveBuffer(file.buffer, ext);
    return { url };
  }
}
