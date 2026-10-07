/**
 * Market comps for natural diamonds. The pricing model asks a provider for
 * the lowest live retail on the same certificate and for the p25 of
 * same-spec comps; every answer is optional. Amounts are integer cents.
 */

export interface CertComp {
  /** Lowest live retail for the same cert number, cents. */
  lowestCents: number;
  sourceCount: number;
  /** ISO timestamp the comp was observed. */
  asOf: string;
}

export interface SpecComp {
  /** 25th percentile of same-spec live retail, cents. */
  p25Cents: number;
  count: number;
  asOf: string;
}

export interface DiamondSpec {
  shape: string;
  carat: number;
  color: string;
  clarity: string;
  cut?: string;
  lab: string;
}

export interface DiamondCompProvider {
  getCertComp(certNumber: string, lab: string): Promise<CertComp | null>;
  getSpecComps(spec: DiamondSpec): Promise<SpecComp | null>;
}

/** Ships until a real source exists: always null, so every stone falls through to Rap. */
export class NullCompProvider implements DiamondCompProvider {
  async getCertComp(): Promise<null> {
    return null;
  }
  async getSpecComps(): Promise<null> {
    return null;
  }
}
