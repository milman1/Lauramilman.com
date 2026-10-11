# Homepage and navigation fixes (merchant review, 2026-10-11)

Working list for PR #240 (branch `claude/sweet-fermi-83xm6l`). Tackle one
at a time; tick each item only after it is pushed and previewed.

Priority order for the store, per the merchant: (1) loose lab-grown stones —
the go-to, most trusted source on price, quality and service; (2) rings and
ring settings; (3) push presents and pieces women in the workforce buy for
themselves (under $1,000).

- [ ] 1. (Pushed; awaiting preview.) Banner and copy: lead with loose lab-grown stones, then rings and
      settings, then push presents / self-purchase.
- [ ] 2. (Pushed; awaiting preview. Feature tile + 2x2; photos come from real
      products picked per tile: Rolex Day-Date 228238, Cartier Love ring,
      lg-886886, nd-352890, lab-grown eternity band.) "Shop the house" tiles: new layout. Lab-grown diamonds and rings
      first. Rename "Pre-Owned Watches & Jewelry" to "Watches" (drop
      "Pre-Owned" up front); use a real photo of an in-stock, branded watch,
      not an AI image. Consider a "Pre-Owned Maison Jewelry" tile. Replace
      the lab-grown and natural tiles, which look AI-generated.
- [ ] 3. (Pushed: "Rings, your way" — Just because -> stackable rings. An
      "Everyday Rings" collection needs approval: it is a live store change.) Rings: present "engagement" rings that work as everyday rings as
      rings worn every day too.
- [ ] 4. (Pushed: setting pages' "lab-grown / natural diamonds" links now
      pre-filter the stone search by shape; the search also accepts the old
      link format. Walk-through on the preview theme still pending.) Ring builder: fix the flow end to end (preview and walk through).
- [ ] 5. (Pushed: promise band "14K Gold" -> "Authenticity Guaranteed";
      per-product spec lines keep their real metal.) Product rows after the tiles say "14K gold": drop it or broaden it
      (we also carry 18K, platinum and silver).
- [ ] 6. (Pushed: "The Rolex edit" row after Gold; shows the first five
      in-stock pieces from rolex-watches automatically.) Rolex spotlight section on the homepage.
- [ ] 7. (Proposal sent; needs approval — live collection rules. Earrings:
      299 active, 201 Back Vault estate, 39 lab-grown. Rings: 472, 150 estate,
      49 lab-grown.) Category pages (e.g. Earrings) mix high jewelry, lab-grown and
      estate/David Webb with everyday fine jewelry. Proposal needed: keep
      the everyday fine jewelry in the main category and separate the rest.
- [ ] 8. Lower-cost lab-grown (under $1,000) in rings, tennis bracelets and
      necklaces: needs a supplier and the jewelry activation gate (drafts).
- [x] 9. (Section now hidden.) Loose-diamonds homepage section points its natural example at
      `nd-k15512b`, which no longer exists; pick a current stone.
- [x] 10. (Section now hidden.) Engagement section reuses the hero's loose-diamond photo; swap it.

## Homepage mockup (2026-10-11, merchant-approved direction)

Top of the homepage now follows the merchant's mockup, in the brand palette:
cream banner "Your diamond. Your story." (mockup photo, cropped to drop the
loose-diamond tray), "Meet Laura Milman" (her real portrait), "Find a diamond
that feels like you." (compact stone search that opens the lab-grown or
natural search with the choices applied), "Rings, your way." (For your
forever -> ring builder; Just because -> stackable rings).
Hidden (disabled, not deleted): loose-diamonds comparison, engagement band,
brand story — they repeated the new sections. Re-enable in the theme editor.

- [ ] 11. Replace the mockup crops (banner and two ring photos, upscaled from
      a 1024px mockup) with the full-size originals or real photography.
- [ ] 12. Catalog data: setting `round-four-prong-pave-engagement-ring-setting-in-18k-white-gold`
      has the title "Round Four-Prong Pavé ... 18K White Gold" but its SEO
      title, description and photo describe a Hidden Halo in 14K white gold.
      Two oval settings have "round" handles. Check all 9 ring settings.
