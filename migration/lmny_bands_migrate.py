#!/usr/bin/env python3
"""
Laura Milman NY - Men's wedding band migration.

For every product in the SEO CSV this will:
  1. add a "Metal color" option (Yellow / White / Rose Gold)
  2. recolor the featured CAD render into rose gold and white gold
  3. upload both renders to Shopify and attach them to the product
  4. point each existing variant at the yellow render
  5. create the White Gold and Rose Gold variants, mirroring existing prices
  6. rewrite title, description, SEO title, meta description and tags

Safe to re-run. Completed handles are recorded in migrate_state.json and skipped.

SETUP
  pip install requests pillow numpy
  export SHOPIFY_TOKEN=shpat_xxxxxxxx
  python lmny_bands_migrate.py --csv lmny-mens-bands-seo-rebuild.csv

  Token comes from a custom app in Shopify admin (Settings > Apps and sales
  channels > Develop apps). Scopes needed: read_products, write_products,
  read_files, write_files.

FLAGS
  --dry-run          print what would happen, change nothing
  --limit N          only process the first N products
  --only HANDLE      process a single product
  --untracked        also switch inventory to untracked on every variant
  --skip-seo         leave titles and descriptions alone, colors only
  --skip-color       SEO rewrite only, no renders or variants
"""

import argparse, csv, io, json, os, sys, time
from pathlib import Path

import numpy as np
import requests
from PIL import Image

SHOP = "laura-milman.myshopify.com"
API = "2025-01"
ENDPOINT = f"https://{SHOP}/admin/api/{API}/graphql.json"
STATE = Path("migrate_state.json")

TOKEN = os.environ.get("SHOPIFY_TOKEN")
if not TOKEN:
    sys.exit("Set SHOPIFY_TOKEN first. See SETUP at the top of this file.")

SESSION = requests.Session()
SESSION.headers.update({
    "X-Shopify-Access-Token": TOKEN,
    "Content-Type": "application/json",
})

# --- colour ramps -----------------------------------------------------------
# Luminance is remapped through these stops. Geometry is never touched.
# Tune these if the metal reads wrong, then re-run with --only on one product.
ROSE = [(0.00, (92, 44, 38)), (0.35, (168, 96, 80)), (0.65, (214, 150, 130)),
        (0.85, (240, 206, 196)), (1.00, (255, 250, 248))]
WHITE = [(0.00, (88, 88, 94)), (0.35, (150, 150, 158)), (0.65, (200, 200, 206)),
         (0.85, (235, 235, 240)), (1.00, (255, 255, 255))]
SAT_FLOOR = 0.09   # below this a pixel is background/shadow and is left alone


def gql(query, variables=None, tries=5):
    """POST a GraphQL op, retrying on throttle and 5xx."""
    for attempt in range(tries):
        r = SESSION.post(ENDPOINT, json={"query": query, "variables": variables or {}}, timeout=60)
        if r.status_code in (429, 500, 502, 503, 504):
            time.sleep(2 ** attempt)
            continue
        r.raise_for_status()
        body = r.json()
        if "errors" in body:
            throttled = any(
                (e.get("extensions") or {}).get("code") == "THROTTLED"
                for e in body["errors"]
            )
            if throttled:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(json.dumps(body["errors"], indent=2))
        # surface userErrors from whichever mutation ran
        for payload in (body.get("data") or {}).values():
            if isinstance(payload, dict):
                errs = payload.get("userErrors") or payload.get("mediaUserErrors")
                if errs:
                    raise RuntimeError(json.dumps(errs, indent=2))
        return body["data"]
    raise RuntimeError("gave up after retries")


def recolor(src_bytes, stops):
    im = Image.open(io.BytesIO(src_bytes)).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    mx, mn = a.max(2), a.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    lum = np.clip((0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]) / 255.0, 0, 1)
    xs = np.array([s[0] for s in stops])
    cols = np.array([s[1] for s in stops], dtype=np.float32)
    out = np.zeros_like(a)
    for c in range(3):
        out[..., c] = np.interp(lum, xs, cols[:, c])
    blended = np.where((sat >= SAT_FLOOR)[..., None], out, a).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(blended).save(buf, "JPEG", quality=94, subsampling=0)
    return buf.getvalue()


Q_PRODUCT = """
query($handle: String!) {
  productByHandle(handle: $handle) {
    id title handle
    options { id name position optionValues { name } }
    media(first: 1) { nodes { ... on MediaImage { id image { url } } } }
    variants(first: 250) {
      nodes { id price selectedOptions { name value } }
    }
  }
}
"""

M_OPTION = """
mutation($productId: ID!, $options: [OptionCreateInput!]!) {
  productOptionsCreate(productId: $productId, options: $options,
                       variantStrategy: LEAVE_AS_IS) {
    product { id } userErrors { field message code }
  }
}
"""

M_STAGE = """
mutation($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets { url resourceUrl parameters { name value } }
    userErrors { field message }
  }
}
"""

M_MEDIA = """
mutation($productId: ID!, $media: [CreateMediaInput!]!) {
  productCreateMedia(productId: $productId, media: $media) {
    media { alt ... on MediaImage { id } }
    mediaUserErrors { field message }
  }
}
"""

M_VARIANTS_CREATE = """
mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkCreate(productId: $productId, variants: $variants) {
    productVariants { id title } userErrors { field message code }
  }
}
"""

M_VARIANTS_UPDATE = """
mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    productVariants { id } userErrors { field message code }
  }
}
"""

M_PRODUCT_UPDATE = """
mutation($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product { id title } userErrors { field message }
  }
}
"""

COLOR_OPTION = "Metal color"
YELLOW, WHITE_G, ROSE_G = "Yellow Gold", "White Gold", "Rose Gold"


def stage_and_upload(filename, blob):
    """Get a staged target, POST the bytes, return the resourceUrl."""
    data = gql(M_STAGE, {"input": [{
        "filename": filename, "mimeType": "image/jpeg",
        "resource": "IMAGE", "httpMethod": "POST",
    }]})
    target = data["stagedUploadsCreate"]["stagedTargets"][0]
    form = [(p["name"], (None, p["value"])) for p in target["parameters"]]
    form.append(("file", (filename, blob, "image/jpeg")))
    r = requests.post(target["url"], files=form, timeout=180)
    if r.status_code not in (200, 201, 204):
        raise RuntimeError(f"upload failed {r.status_code}: {r.text[:400]}")
    return target["resourceUrl"]


def do_colors(prod, dry):
    pid = prod["id"]
    opt_names = [o["name"] for o in prod["options"]]

    if COLOR_OPTION in opt_names:
        print("    metal option already present, skipping colour build")
        return
    if len(prod["options"]) >= 3:
        print("    !! already has 3 options, cannot add colour. skipped.")
        return
    if not prod["media"]["nodes"]:
        print("    !! no featured image, cannot render colours. skipped.")
        return

    src_media = prod["media"]["nodes"][0]
    src_url = src_media["image"]["url"].split("?")[0]
    stem = src_url.rsplit("/", 1)[-1].rsplit(".", 1)[0]

    if dry:
        print(f"    would render + attach {stem}-rose-gold.jpg / -white-gold.jpg")
        print(f"    would add option and create {len(prod['variants']['nodes']) * 2} variants")
        return

    gql(M_OPTION, {"productId": pid, "options": [{
        "name": COLOR_OPTION, "position": 3,
        "values": [{"name": YELLOW}, {"name": WHITE_G}, {"name": ROSE_G}],
    }]})

    src = requests.get(src_url, timeout=120).content
    rose_url = stage_and_upload(f"{stem}-rose-gold.jpg", recolor(src, ROSE))
    white_url = stage_and_upload(f"{stem}-white-gold.jpg", recolor(src, WHITE))

    made = gql(M_MEDIA, {"productId": pid, "media": [
        {"alt": f"{prod['title']} shown in rose gold", "mediaContentType": "IMAGE",
         "originalSource": rose_url},
        {"alt": f"{prod['title']} shown in white gold", "mediaContentType": "IMAGE",
         "originalSource": white_url},
    ]})["productCreateMedia"]["media"]
    rose_id = next(m["id"] for m in made if "rose" in m["alt"])
    white_id = next(m["id"] for m in made if "white" in m["alt"])

    existing = prod["variants"]["nodes"]

    # point the originals at the yellow render
    gql(M_VARIANTS_UPDATE, {"productId": pid, "variants": [
        {"id": v["id"], "mediaId": src_media["id"]} for v in existing
    ]})

    # mirror every existing size/karat combo into the two new colours
    new = []
    for v in existing:
        base = [{"optionName": o["name"], "name": o["value"]}
                for o in v["selectedOptions"] if o["name"] != COLOR_OPTION]
        for colour, media_id in ((WHITE_G, white_id), (ROSE_G, rose_id)):
            new.append({
                "optionValues": base + [{"optionName": COLOR_OPTION, "name": colour}],
                "price": v["price"],
                "mediaId": media_id,
                "inventoryPolicy": "CONTINUE",
            })
    for i in range(0, len(new), 100):
        gql(M_VARIANTS_CREATE, {"productId": pid, "variants": new[i:i + 100]})
    print(f"    +{len(new)} variants, 2 renders attached")


def do_seo(prod, row, dry):
    if dry:
        print(f"    would retitle -> {row['Title']}")
        return
    gql(M_PRODUCT_UPDATE, {"product": {
        "id": prod["id"],
        "title": row["Title"],
        "descriptionHtml": row["Body (HTML)"],
        "tags": [t.strip() for t in row["Tags"].split(",") if t.strip()],
        "seo": {"title": row["SEO Title"], "description": row["SEO Description"]},
    }})
    print(f"    retitled -> {row['Title']}")


def do_untracked(prod, dry):
    if dry:
        return
    fresh = gql(Q_PRODUCT, {"handle": prod["handle"]})["productByHandle"]
    ids = [v["id"] for v in fresh["variants"]["nodes"]]
    for i in range(0, len(ids), 100):
        gql(M_VARIANTS_UPDATE, {"productId": prod["id"], "variants": [
            {"id": vid, "inventoryItem": {"tracked": False}} for vid in ids[i:i + 100]
        ]})
    print(f"    inventory untracked on {len(ids)} variants")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="lmny-mens-bands-seo-rebuild.csv")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--only")
    ap.add_argument("--untracked", action="store_true")
    ap.add_argument("--skip-seo", action="store_true")
    ap.add_argument("--skip-color", action="store_true")
    args = ap.parse_args()

    rows = list(csv.DictReader(open(args.csv, encoding="utf-8")))
    if args.only:
        rows = [r for r in rows if r["Handle"] == args.only]
    done = set(json.loads(STATE.read_text())) if STATE.exists() else set()
    todo = [r for r in rows if r["Handle"] not in done]
    if args.limit:
        todo = todo[:args.limit]

    print(f"{len(rows)} in file, {len(done)} already done, {len(todo)} to process")
    if args.dry_run:
        print("DRY RUN, nothing will change\n")

    failures = []
    for n, row in enumerate(todo, 1):
        handle = row["Handle"]
        print(f"[{n}/{len(todo)}] {handle}")
        try:
            prod = gql(Q_PRODUCT, {"handle": handle})["productByHandle"]
            if not prod:
                raise RuntimeError("handle not found in store")
            if not args.skip_color:
                do_colors(prod, args.dry_run)
            if not args.skip_seo:
                do_seo(prod, row, args.dry_run)
            if args.untracked:
                do_untracked(prod, args.dry_run)
            if not args.dry_run:
                done.add(handle)
                STATE.write_text(json.dumps(sorted(done), indent=1))
        except Exception as exc:
            print(f"    FAILED: {exc}")
            failures.append((handle, str(exc)))
        time.sleep(0.4)   # stay under the REST-equivalent leaky bucket

    print(f"\ndone. {len(todo) - len(failures)} ok, {len(failures)} failed")
    for h, e in failures:
        print(f"  {h}: {e.splitlines()[0][:120]}")
    if failures:
        print("\nRe-run the same command to retry only the failures.")


if __name__ == "__main__":
    main()
