import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../services/jwt.service';

@Controller('auth')
export class AuthController {
  constructor(private jwtService: JwtService) {}

  @Get('verify')
  async verifyToken(@Headers('authorization') authHeader: string) {
    try {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Invalid authorization header');
      }

      const token = authHeader.split(' ')[1];
      const decoded = this.jwtService.verifyToken(token);

      return {
        success: true,
        data: decoded
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
} 