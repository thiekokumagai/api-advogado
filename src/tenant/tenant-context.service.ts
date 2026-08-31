import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private officeId: string | null = null;

  setOfficeId(officeId: string) {
    this.officeId = officeId;
  }

  getOfficeId(): string {
    if (!this.officeId) {
      throw new Error('Tenant Office ID não definido no contexto da requisição.');
    }
    return this.officeId;
  }

  hasOfficeId(): boolean {
    return !!this.officeId;
  }
}
