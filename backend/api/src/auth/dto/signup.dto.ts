import { IsEmail, IsString, IsOptional, MaxLength } from 'class-validator';
import { IsStrongPassword } from '../validators/password.validator';

export class SignupDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(254, { message: 'Email address must not exceed 254 characters' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  @IsStrongPassword({ 
    message: 'Password does not meet security requirements' 
  })
  password: string;

  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name?: string;
}