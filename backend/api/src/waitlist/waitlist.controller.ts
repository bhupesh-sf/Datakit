import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() createWaitlistDto: CreateWaitlistDto, @Request() req) {
    if (req.user && !createWaitlistDto.userId) {
      createWaitlistDto.userId = req.user.userId;
      createWaitlistDto.email = createWaitlistDto.email || req.user.email;
    }

    return this.waitlistService.create(createWaitlistDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query('feature') feature?: string) {
    if (feature) {
      return this.waitlistService.findByFeature(feature);
    }
    return this.waitlistService.findAll();
  }

  @Get('my-entries')
  @UseGuards(JwtAuthGuard)
  async findMyEntries(@Request() req) {
    return this.waitlistService.findByUser(req.user.userId);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    return this.waitlistService.getStats();
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.waitlistService.remove(id);
  }
}
