# eBay keeper refresh — 2026-09-14

Astra performed the screen work. No agents, theme edits, inventory changes, or PR #130 merge.

- Active Sea Dweller search returned only RW3065 (366649775509) and RW3073 (366649775730). Both protected; zero ended and zero keepers disabled.
- Compared 99 enabled keeper offer rows (91 unique SKUs) with the protected CSV. All already used % increase 7. Reapplied in batches of 50 and 49: unchanged, so bulk Save did not appear.
- RW3065 individual offer: base retail 15000, % increase 7, existing nearest-$10 rounding, displayed result 16060. Re-entered equivalent 7.0 and clicked Save. Unsaved/Save controls cleared. A later fresh Connect listing view showed Active at 16060, but the detail header subsequently showed Not Listed while Enabled remained selected. Public eBay still showed the old values.
- Current template Publish changes to eBay clicked once. No dialog, success toast, navigation, or confirmation. Button had empty data-href. Brown LMNY design visible in preview; publication unverified.
- Condition mapping already custom → ebay_condition (Condition ID control conditionid). Reselection made no changes and no Save appeared. RW3065 mapped condition displays Pre-owned – Good.
- Live RW3065 after save still 15750 and New with box and papers; description calls it Pre-Owned. Synchronization unresolved.
- RW3085, RW3035 and 3370 were present in the enabled keeper scan. T3431 was Disabled. Enabled and Save were clicked; Save cleared, and T3431 was subsequently observed under the Enabled is NOT 0 filter at % increase 7, base retail 27000.
- Deliverables: keeper CSV 155 unique SKUs; safe unlist CSV 640 unique SKUs. Historical unlist had 644 unique entries and four protected overlaps J10355, J10493, RR5823, RR9291, excluded here.

RW3035 passes the live spot-check: Pre-owned – Good; price 21620 versus Shopify base 20200 (7% with existing rounding); LMNY espresso background rgb(30,17,9) and cream rgb(250,246,240). Existing mojibake remains; no template edits authorized or made.

Bulk reapplication of equivalent 7.0 also produced no Save. No price-rule change was needed; a force-refresh of every keeper is not confirmed. Template publication and RW3065 synchronization remain unresolved.

RW3085 error detail: "Package weight is not valid or is missing." A verified packaged shipping weight and explicit authorization were requested before any out-of-scope weight edit. No weight changed.

RW3065 specific error detail (product 32327) also confirmed: "Package weight is not valid or is missing." The error persists after its 7% Save. Both RW3065 and RW3085 need a verified packaged weight and authorization for that additional change.
