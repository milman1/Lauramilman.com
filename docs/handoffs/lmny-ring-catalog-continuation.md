# LMNY ring catalog continuation prompt

Use this prompt when starting a Codex Cloud task for the LMNY ring catalog. Attach the current private checkpoint separately; do not commit it or its supplier-cost evidence to this public repository.

> Continue the LMNY ring catalog work for lauramilman.com from the attached private checkpoint.
>
> The Shopify credentials are configured in the Codex Cloud environment as `SHOPIFY_STORE_DOMAIN` and either `SHOPIFY_ADMIN_TOKEN` or `SHOPIFY_CLIENT_ID` plus `SHOPIFY_CLIENT_SECRET`. Confirm only whether the variables are set. Never display their values.
>
> Read `AGENTS.md`, `ORCHESTRATION.md`, `docs/seo/finished-jewelry-activation-checklist.md`, `docs/seo/jewelry-activation-gate.md`, and `docs/seo/listing-seo-geo.md` before making changes.
>
> Resume from the saved state. Independently verify current Shopify state and do not replay changes that the checkpoint records as complete.
>
> Exclude all Maison, vintage, estate, pre-owned, and outside-designer jewelry, including David Webb, Cartier, and similar categories.
>
> Complete the remaining contemporary ring work:
>
> 1. Audit current Shopify rings and their photos and specifications. Correct inaccurate titles, shapes, styles, descriptions, tags, metafields, collections, filters, and SEO.
> 2. Use occasion-neutral titles for versatile complete rings while retaining engagement-ring search visibility. Mention engagement, everyday wear, right-hand wear, and self-gifting naturally where appropriate.
> 3. Place suitable complete rings in both Diamond Rings and Engagement Rings. Keep fashion, cocktail, statement, stacking, and everyday rings discoverable through accurate shape, style, metal, and carat data.
> 4. Keep setting-only products explicitly labeled and state that the center diamond is excluded. Remove setting-only “choose your own diamond” language from complete-ring pages.
> 5. Search ACTIVE, DRAFT, and ARCHIVED products for matching designs and source SKUs before creating anything.
> 6. Verify the six previously expanded rings and their existing size/metal combinations. Do not recreate them.
> 7. Add new Skylab rings only when current supplier price, availability, exact SKU, specifications, photos, and matching video are verified. If supplier evidence cannot be accessed, record the blocker and do not infer facts.
> 8. Group only genuinely identical designs across carat sizes and assign the correct variant media. Keep different designs separate.
> 9. Price finished lab-grown jewelry at exactly 2× verified supplier cost. Keep settings at their established separate pricing. Missing cost blocks activation.
> 10. Offer sizes 4–8.5 in quarter-size increments, with supported 14K and 18K options and the existing +$250 retail upgrade for 18K. Mark verified custom versions as made to order.
> 11. Preserve existing media, URLs, variants, accurate costs, useful tags, and the exact lowercase `uploadify` tag.
> 12. Require at least three accurate images with descriptive alt text and the matching Skylab video before activating a new ring. Store video as native Shopify media, first in the gallery, rather than embedding it in the body.
> 13. Create new products as DRAFT only through `npm run jewelry:gate -- draft`.
> 14. Activate one product at a time through `jewelry:gate plan`, completed evidence review, `jewelry:gate check`, and `jewelry:gate activate`.
> 15. Do not bypass the activation gate with a direct ACTIVE mutation, Admin activation, CSV status change, or independent connector.
> 16. Publish externally only through Uploadify. Use New condition for jewelry and exclude loose diamonds. Do not report marketplace publication without independent verification in Uploadify.
>
> Keep credentials, supplier costs, raw source evidence, and review snapshots out of Git and public artifacts. Work until all safely executable steps are complete.
>
> Finish with a concise report covering listings reviewed, products changed, new Skylab drafts and activations, duplicates resolved, variant and media verification, Uploadify status, exact blockers, and the location of the new private checkpoint.
