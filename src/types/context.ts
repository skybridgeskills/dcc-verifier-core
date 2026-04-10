/** Shared resources available to all verification checks. */
export interface VerificationContext {
  documentLoader: (url: string) => Promise<any>;
  cryptoSuites: object[];
  registries?: object;
  challenge?: string | null;
  unsignedPresentation?: boolean;
}
