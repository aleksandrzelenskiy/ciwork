export {};

declare global {
  namespace NodeJS {
    interface Global {
      mongoose?: {
        conn: import('mongoose').Connection | null;
        promise: Promise<import('mongoose').Connection> | null;
      };
    }
  }
}

declare module '@clerk/localizations' {
  const value: {
    ruRU?: Record<string, unknown>;
  };
  export const ruRU: Record<string, unknown>;
  export default value;
}
