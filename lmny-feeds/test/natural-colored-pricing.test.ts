import { describe, it, expect } from 'vitest';
import { coloredLabRetailFromCost, LGD_COLOR_DIAMONDS, LOOSE_LAB_GROWN, labRetailMultipleFromCost, LAB_GUARDS } from '../config/pricing.js';
import { priceNatural } from '../src/markup.js';
import { naturalStone } from './fixtures.js';

describe('approved natural and colored tiers',()=>{
  it.each([[500,1375],[500.01,1375],[550,1375],[1000,2500],[1500,3750],[1500.01,3750],[1600,3750],[2000,4500]])('colored cost %s yields retail %s',(cost,retail)=>{
    expect(coloredLabRetailFromCost(cost)).toBe(retail);
    expect(retail*(1-LGD_COLOR_DIAMONDS.welcomeDiscountPct)).toBeGreaterThan(cost);
  });
  it.each([[4000,6400],[4000.01,6400],[4400,6400],[5000,7250]])('natural cost %s yields retail %s',(cost,retail)=>{
    const result=priceNatural(naturalStone({costUsd:cost}));
    expect(result.ok&&result.priced.retailUsd).toBe(retail);
    expect(retail*0.9).toBeGreaterThan(cost);
  });
  it('does not lower retail at either side of tier transitions',()=>{
    for(const boundary of [500,1500]){
      let previous=0;
      for(let cents=-100;cents<=100;cents++){
        const retail=coloredLabRetailFromCost(boundary+cents/100);
        expect(retail).toBeGreaterThanOrEqual(previous);previous=retail;
      }
    }
    let previous=0;
    for(let cents=-100;cents<=100;cents++){
      const result=priceNatural(naturalStone({costUsd:4000+cents/100}));
      expect(result.ok).toBe(true);
      if(result.ok){expect(result.priced.retailUsd).toBeGreaterThanOrEqual(previous);previous=result.priced.retailUsd;}
    }
  });
  it.each([0,-1,NaN,Infinity])('rejects invalid colored cost %s',cost=>expect(()=>coloredLabRetailFromCost(cost)).toThrow());
  it('preserves #285 white tiers, discount and retail floor',()=>{
    expect(LOOSE_LAB_GROWN.tiers.map(t=>t.multiplier)).toEqual([2.5,2.25,2,1.75]);
    expect(LOOSE_LAB_GROWN.welcomeDiscountPct).toBe(0.1);
    expect(LGD_COLOR_DIAMONDS.welcomeDiscountPct).toBe(0.1);
    expect(LAB_GUARDS.minRetailUsd).toBe(180);
    expect(Math.round(590*labRetailMultipleFromCost(590))).toBe(1180);
  });
});
