import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { RefreshTokenService } from './refresh-token.service';
import { PasswordService } from './services/password.service';
import * as bcrypt from 'bcryptjs';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private subscriptionsService: SubscriptionsService,
    private workspacesService: WorkspacesService,
    private refreshTokenService: RefreshTokenService,
    private passwordService: PasswordService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any, ipAddress?: string, userAgent?: string) {
    const payload = {
      email: user.email,
      sub: user.id,
      type: 'access',
    };

    // Generate short-lived access token (15 minutes)
    const accessToken = this.jwtService.sign(payload, {
      secret:
        this.configService.get('JWT_ACCESS_SECRET') ||
        this.configService.get('JWT_SECRET'),
      expiresIn: '15m',
    });

    // Generate long-lived refresh token (7 days)
    const refreshToken = await this.refreshTokenService.generateRefreshToken(
      user.id,
      ipAddress,
      userAgent,
    );

    return {
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async signup(signupDto: SignupDto, ipAddress?: string, userAgent?: string) {
    const { email, password, name } = signupDto;

    // Additional password validation with personal information
    const passwordValidation = this.passwordService.checkPasswordStrengthWithPersonalInfo(
      password,
      { email, name }
    );

    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'Password does not meet security requirements',
        details: passwordValidation.feedback,
        requirements: passwordValidation.requirements,
      });
    }

    // Create user
    const user = await this.usersService.create(email, password, name);

    // Create free subscription for new user
    await this.subscriptionsService.createFreeSubscription(user.id);

    // Create personal workspace for new user
    await this.workspacesService.createPersonalWorkspace(user);

    // Get user with subscription and workspace
    const userWithSubscription = await this.usersService.findOne(user.id);

    // Use the same login logic for consistent token generation
    return this.login(userWithSubscription, ipAddress, userAgent);
  }

  async refreshAccessToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Validate and rotate refresh token
    const newRefreshToken = await this.refreshTokenService.rotateRefreshToken(
      refreshToken,
      ipAddress,
      userAgent,
    );

    if (!newRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Get the token entity to find the user
    const tokenEntity =
      await this.refreshTokenService.validateRefreshToken(newRefreshToken);
    if (!tokenEntity) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = tokenEntity.user;
    const payload = {
      email: user.email,
      sub: user.id,
      type: 'access',
    };

    // Generate new short-lived access token
    const accessToken = this.jwtService.sign(payload, {
      secret:
        this.configService.get('JWT_ACCESS_SECRET') ||
        this.configService.get('JWT_SECRET'),
      expiresIn: '15m',
    });

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    await this.refreshTokenService.revokeToken(refreshToken);
  }

  async logoutAllDevices(userId: string) {
    await this.refreshTokenService.revokeAllUserTokens(userId);
  }
}
