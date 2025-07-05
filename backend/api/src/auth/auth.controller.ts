import {
  Controller,
  Request,
  Response,
  Post,
  UseGuards,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { PasswordService } from './services/password.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import {
  PasswordCheckDto,
  PasswordStrengthResponseDto,
} from './dto/password-check.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private passwordService: PasswordService,
  ) {}

  @UseGuards(LocalAuthGuard, ThrottlerGuard)
  @Throttle({ auth: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 minutes
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Request() req, @Response() res, @Body() loginDto: LoginDto) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const result = await this.authService.login(req.user, ipAddress, userAgent);

    // Set httpOnly cookies
    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({ user: result.user });
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ signup: { limit: 20, ttl: 3600000 } }) // 20 signups per hour
  @Post('signup')
  async signup(@Request() req, @Response() res, @Body() signupDto: SignupDto) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const result = await this.authService.signup(
      signupDto,
      ipAddress,
      userAgent,
    );

    // Set httpOnly cookies
    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({ user: result.user });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req) {
    return req.user;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Request() req, @Response() res) {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const result = await this.authService.refreshAccessToken(
      refreshToken,
      ipAddress,
      userAgent,
    );

    // Set new httpOnly cookies
    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({ message: 'Tokens refreshed successfully' });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req, @Response() res) {
    const refreshToken = req.cookies?.refresh_token;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Clear cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    return res.json({ message: 'Logged out successfully' });
  }

  @Post('check-password-strength')
  @HttpCode(HttpStatus.OK)
  async checkPasswordStrength(
    @Body() passwordCheckDto: PasswordCheckDto,
  ): Promise<PasswordStrengthResponseDto> {
    const result = this.passwordService.checkPasswordStrength(
      passwordCheckDto.password,
    );

    return {
      isValid: result.isValid,
      score: result.score,
      feedback: result.feedback,
      requirements: result.requirements,
    };
  }

  @Get('password-requirements')
  @HttpCode(HttpStatus.OK)
  getPasswordRequirements() {
    return {
      requirements: this.passwordService.getPasswordRequirements(),
      strengthLevels: [
        { score: 0, label: 'Very Weak', color: '#ff4444' },
        { score: 1, label: 'Weak', color: '#ff8800' },
        { score: 2, label: 'Fair', color: '#ffaa00' },
        { score: 3, label: 'Good', color: '#88cc00' },
        { score: 4, label: 'Strong', color: '#00cc44' },
      ],
    };
  }
}
