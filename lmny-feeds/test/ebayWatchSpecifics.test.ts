import { describe, expect, it } from 'vitest';
import {
  EBAY_WATCH_HANDEDNESS,
  EBAY_WATCH_TYPE,
  ebayMetafieldInputs,
  extractEbayWatchSpecifics,
  findDuplicateWatchGroups,
  mergeEbayWatchSpecifics,
} from '../src/ebayWatchSpecifics.js';

const MICHELE_HTML = `
<ul>
<li><strong>Case Size:</strong> 33mm x 35mm</li>
<li><strong>Band Material:</strong> Leather</li>
<li><strong>Model:</strong> MWW06P000014</li>
<li><strong>Style:</strong> Signature Deco</li>
<li><strong>Department:</strong> Women's</li>
</ul>
`;

const CHOPARD_DECO_HTML = `<p>Embrace the elegance of a bygone era with this exquisite Art Deco Chopard Lady's Dress Watch, meticulously crafted from 18K white gold. This timeless piece is adorned with sparkling diamonds and vibrant emeralds on both the case and lugs, showcasing the opulent style characteristic of the Art Deco period.


The watch features a sleek satin black band, measuring 6.25 inches in length, and a sturdy steel buckle, ensuring a comfortable and secure fit. The case, including lugs, measures 14mm x 75mm, offering a graceful yet striking presence on the wrist.


Powered by a manual wind movement, this Chopard watch is not only a beautiful accessory but also a functional timepiece, remaining in excellent working order. Weighing 26.1 grams, this watch is a perfect blend of sophistication and durability, making it a treasured addition to any fine jewelry collection.</p><p>Crafted in Platinum, weighing 26.1 gr.. Authenticated and hand-inspected by Laura Milman New York, this pre-owned Chopard watch is offered in good condition and signed by Chopard. A timeless investment piece for collectors of fine estate jewelry.</p><h3>Product Details</h3><ul>
<li>
<strong>Center Diamond Weight:</strong> 0.00</li>
<li>
<strong>Metal Type:</strong> Platinum</li>
<li>
<strong>Metal Weight:</strong> 26.1 gr.</li>
<li>
<strong>Signed:</strong> Chopard</li>
<li>
<strong>Condition:</strong> Good.</li>
<li>
<strong>Stock:</strong> RR9688</li>
</ul>`;

const CLASSIQUE_HTML = `<p>18K white gold 27mm x 27mm Chopard Classique Femme watch featuring a quartz movement, diamond bezel, white mother of pearl dial and black alligator strap with tang buckle. Production Year: Circa 2000s
Movement: Quartz
CASE
Case Shape: Square
Case Material: 18K White Gold
Case</p>`;

const TUBOGAS_HTML = `<p>Swiss Made Bvlgari 18k Yellow Gold Quartz Ladies SQ 22 2T Diamond Watch.
A lady's gold wristwatch by Bvlgari from the Tubogas collection, quartz movement, square black dial with Arabic and baton numerals, diamnd bezel, signed case, dial and movement, 18ct gold case and flexible two-tone 18ct gold bracelet bands, 22 mm square.
Water resistant: 30 Metres / 3 ATM.</p><p>Wrist Size 6.5 inches.</p>`;

const TANK_HTML = `<p>Cartier Tank wristwatch, reference 2786, crafted in 18K white gold and lavishly set with diamonds throughout the case and buckle. This striking 45mm design features an elongated rectangular silhouette, silver dial with Roman numerals, blued steel hands, and a black satin strap. Powered by a quartz movement, it is an elegant statement of Cartier glamour and timeless sophistication.</p>`;

const VCA_HTML = `<p>Van Cleef &amp; Arpels 18K Yellow Gold Diamond Charm and Blue Alligator Watch.</p><h3>Product Details</h3><ul>
<li><strong>Size:</strong> 32mm</li>
<li><strong>Stock:</strong> RR9229</li>
</ul>`;

const ROLEX_HTML = `<p>This Pre-Owned Rolex Datejust 126334 is offered by Laura Milman New York on its own, without box or papers.</p>`;

describe('extractEbayWatchSpecifics', () => {
  it('reads structured Label: Value copy (Michele) without using the Shopify SKU', () => {
    const { values, flags } = extractEbayWatchSpecifics({
      title: 'MICHELE SIGNATURE DECO DIAMOND, DIAMOND DIAL WATCH (Online Only)',
      descriptionHtml: MICHELE_HTML,
      sku: '',
    });
    expect(values).toMatchObject({
      band_material: 'Leather',
      case_size: '33mm x 35mm',
      department: "Women's",
      handedness: EBAY_WATCH_HANDEDNESS,
      model: 'MWW06P000014',
      style: 'Signature Deco',
      type: EBAY_WATCH_TYPE,
    });
    expect(flags.filter((f) => f.field === 'band_material')).toHaveLength(0);
  });

  it('parses prose estate copy: case including lugs, satin band, ignores steel buckle', () => {
    const { values, flags } = extractEbayWatchSpecifics({
      title: 'Pre-Owned Chopard Platinum Deco Diamond And Green Emerald Women Watch',
      descriptionHtml: CHOPARD_DECO_HTML,
      sku: 'RR9688',
    });
    expect(values.department).toBe("Women's");
    expect(values.type).toBe('Wristwatch');
    expect(values.handedness).toBe('Right');
    expect(values.case_size).toBe('14mm x 75mm');
    expect(values.band_material).toBe('Satin');
    expect(values.style).toBe('Art Deco');
    expect(values.model).not.toBe('RR9688');
    expect(flags.some((f) => f.reason.includes('satin'))).toBe(true);
    expect(values.band_material).not.toBe('Stainless Steel');
  });

  it('reads alligator strap and 27mm x 27mm case; ignores tang buckle', () => {
    const { values } = extractEbayWatchSpecifics({
      title: 'Pre-Owned Chopard 18K White Gold Classique Femme Secret Compartment Diamond Women Watch',
      descriptionHtml: CLASSIQUE_HTML,
      sku: 'RR4616',
    });
    expect(values.band_material).toBe('Alligator');
    expect(values.case_size).toBe('27mm x 27mm');
    expect(values.style).toBe('Classique Femme');
    expect(values.department).toBe("Women's");
  });

  it('reads 22mm square and two-tone gold bracelet; ignores water resistance and wrist size', () => {
    const { values } = extractEbayWatchSpecifics({
      title: 'Pre-Owned Bvlgari 18K Yellow Gold SQ 22 2T Quadrato Tubogas Diamond Bezel Women Watch',
      descriptionHtml: TUBOGAS_HTML,
      sku: 'RR7039',
    });
    expect(values.case_size).toBe('22mm');
    expect(values.band_material).toBe('Two-Tone');
    expect(values.style).toBe('Quadrato');
    expect(values.department).toBe("Women's");
    expect(values.model).toMatch(/SQ\s*22/i);
  });

  it('reads Ref, 45mm design, satin strap; does not treat buckle diamonds as band metal', () => {
    const { values, flags } = extractEbayWatchSpecifics({
      title: 'Pre-Owned Cartier Tank Asymmetric 18K White Gold Diamond Ladies Ref 2786 Watch',
      descriptionHtml: TANK_HTML,
      sku: 'J10493',
    });
    expect(values.model).toBe('2786');
    expect(values.case_size).toBe('45mm');
    expect(values.style).toBe('Tank Asymmetric');
    expect(values.department).toBe("Women's");
    expect(values.band_material).toBe('Satin');
    expect(flags.some((f) => f.reason.includes('satin'))).toBe(true);
  });

  it('uses labeled Size when it is millimetres and Alligator from the title', () => {
    const { values } = extractEbayWatchSpecifics({
      title: 'Pre-Owned Van Cleef & Arpels 18K Yellow Gold 32mm Charm Diamond Bezel Alligator Blue Strap Women Watch',
      descriptionHtml: VCA_HTML,
      sku: 'RR9229',
    });
    expect(values.case_size).toBe('32mm');
    expect(values.band_material).toBe('Alligator');
    expect(values.department).toBe("Women's");
  });

  it('does not guess department or band material on a feed Rolex, and does not use stock as model', () => {
    const { values } = extractEbayWatchSpecifics({
      title: 'Pre-Owned Rolex Datejust 126334',
      descriptionHtml: ROLEX_HTML,
      sku: '3481',
    });
    expect(values.department).toBeUndefined();
    expect(values.band_material).toBeUndefined();
    expect(values.type).toBe('Wristwatch');
    expect(values.handedness).toBe('Right');
    expect(values.style).toBe('Datejust');
    expect(values.model).toBe('126334');
  });

  it('does not treat leather accents as the strap', () => {
    const { values, flags } = extractEbayWatchSpecifics({
      title: 'Pre-Owned Cartier Pasha 18K Yellow Gold 38mm Ref.1989 Leather Accents Watch',
      descriptionHtml: '<p>This Pre-Owned Cartier Pasha is offered by Laura Milman New York.</p>',
      sku: 'J10492',
    });
    expect(values.band_material).toBeUndefined();
    expect(values.model).toBe('1989');
    expect(values.case_size).toBe('38mm');
    expect(flags.some((f) => f.reason.includes('leather accents'))).toBe(true);
  });

  it('maps Unisex from the title and leaves pocket watches untyped', () => {
    const uni = extractEbayWatchSpecifics({
      title: 'Pre-Owned Cartier 18K White Gold Santos 100 Unisex White Gold Diamond Unisex Watch',
      descriptionHtml: '<p>Santos 100.</p>',
    });
    expect(uni.values.department).toBe('Unisex');
    const pocket = extractEbayWatchSpecifics({
      title: 'Antique Gold Pocket Watch',
      descriptionHtml: '<p>A pocket watch from the 1890s.</p>',
    });
    expect(pocket.values.type).toBeUndefined();
  });
});

describe('mergeEbayWatchSpecifics', () => {
  it('keeps an existing feed model/case_size rather than overwriting with a parsed reference', () => {
    const extracted = extractEbayWatchSpecifics({
      title: 'Pre-Owned Rolex Datejust 126334',
      descriptionHtml: ROLEX_HTML,
      sku: '3481',
    }).values;
    const { values, keptExisting } = mergeEbayWatchSpecifics(extracted, {
      model: 'Datejust',
      case_size: '41mm',
    });
    expect(values.model).toBe('Datejust');
    expect(values.case_size).toBe('41mm');
    expect(values.type).toBe('Wristwatch');
    expect(keptExisting).toContain('model');
  });
});

describe('ebayMetafieldInputs', () => {
  it('skips keys that already match and does not emit blanks', () => {
    const inputs = ebayMetafieldInputs(
      'gid://shopify/Product/1',
      { type: 'Wristwatch', handedness: 'Right', model: 'Datejust', band_material: undefined },
      { type: 'Wristwatch', model: 'Datejust' },
    );
    expect(inputs).toEqual([
      {
        ownerId: 'gid://shopify/Product/1',
        namespace: 'custom',
        key: 'handedness',
        type: 'single_line_text_field',
        value: 'Right',
      },
    ]);
  });
});

describe('findDuplicateWatchGroups', () => {
  it('flags the Chopardissimo original + backvault-feed copy that share a SKU', () => {
    const groups = findDuplicateWatchGroups([
      {
        id: 'gid://shopify/Product/1',
        handle: 'chopard-18k-white-gold-chopardissimo-mirror-dial-40mm-dial-watch-rr9295',
        title: 'Pre-Owned Chopard 18K White Gold Chopardissimo Mirror Dial 40mm Dial Women Watch',
        sku: 'RR9295',
        tags: ['Watch'],
      },
      {
        id: 'gid://shopify/Product/2',
        handle: 'bv-chopard-18k-white-gold-chopardissimo-mirror-dial-40mm-dial-watch-rr9295',
        title: 'Pre-Owned Chopard 18K White Gold Chopardissimo Mirror Dial 40mm Dial Women Watch',
        sku: 'RR9295',
        tags: ['backvault-feed'],
      },
      {
        id: 'gid://shopify/Product/3',
        handle: 'w-3481',
        title: 'Pre-Owned Rolex Datejust 126334',
        sku: '3481',
      },
      {
        id: 'gid://shopify/Product/4',
        handle: 'w-3706',
        title: 'Pre-Owned Rolex Datejust 126334',
        sku: '3706',
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.products).toHaveLength(2);
    expect(groups[0]?.reason).toMatch(/SKU/i);
    expect(groups[0]?.products.map((p) => p.handle).sort()).toEqual([
      'bv-chopard-18k-white-gold-chopardissimo-mirror-dial-40mm-dial-watch-rr9295',
      'chopard-18k-white-gold-chopardissimo-mirror-dial-40mm-dial-watch-rr9295',
    ]);
  });
});
