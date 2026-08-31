import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { TenantContextService } from '../../tenant/tenant-context.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  officeId: string;
  name: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly tenantContextService: TenantContextService) {
    const secret = process.env.JWT_SECRET || 'portal-ia-advogados-super-secret-key-2026';
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.sub || !payload.officeId) {
      throw new UnauthorizedException('Token inválido');
    }

    if (payload.officeId) {
      this.tenantContextService.setOfficeId(payload.officeId);
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      officeId: payload.officeId,
      name: payload.name,
    };
  }
}
