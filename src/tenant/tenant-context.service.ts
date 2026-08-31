import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  officeId?: string;
  subdomain?: string;
}

@Injectable()
export class TenantContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<TenantContext>();

  run<R>(context: TenantContext, callback: () => R): R {
    return this.asyncLocalStorage.run(context, callback);
  }

  setOfficeId(officeId: string): void {
    const store = this.asyncLocalStorage.getStore();
    if (store) {
      store.officeId = officeId;
    }
  }

  getOfficeId(): string {
    const officeId = this.asyncLocalStorage.getStore()?.officeId;
    if (!officeId) {
      throw new Error('Tenant Office ID não definido no contexto da requisição.');
    }
    return officeId;
  }

  hasOfficeId(): boolean {
    return !!this.asyncLocalStorage.getStore()?.officeId;
  }
}
