import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const serviceKey = request.headers['x-datakit-service-key'];
    const expectedKey = this.configService.get('DATAKIT_SERVICE_API_KEY');

    if (!serviceKey || !expectedKey) {
      throw new UnauthorizedException('Service API key is required');
    }

    if (serviceKey !== expectedKey) {
      throw new UnauthorizedException('Invalid service API key');
    }

    return true;
  }
}