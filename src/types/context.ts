/** Document loader function type. */
export type DocumentLoader = (url: string) => Promise<unknown>;

/** Shared resources available to all verification checks. */
export interface VerificationContext {
  documentLoader: DocumentLoader;
  cryptoSuites: object[];
  registries?: object;
  challenge?: string | null;
  unsignedPresentation?: boolean;
}
