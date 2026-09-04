import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus() {
    return {
      name: 'Parallel API',
      status: 'running',
    };
  }
}
