#!/usr/bin/env bash
# Smoke-test CRUD + RBAC against a running API.
# Usage: API_BASE=http://localhost:8080/api/v1 ./scripts/test-crud.sh
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8080/api/v1}"
ADMIN_EMAIL="${ADMIN_EMAIL:-charles@prince-esquire.co.ke}"
ADMIN_PASS="${ADMIN_PASS:-C.Mutunga}"

pass=0
fail=0

log() { echo "[test] $*"; }
ok() { log "OK: $*"; pass=$((pass + 1)); }
bad() { log "FAIL: $*"; fail=$((fail + 1)); }

expect_status() {
  local method=$1 path=$2 token=$3 want=$4 body=${5:-}
  local args=(-s -o /tmp/pos-test-body.json -w "%{http_code}" -X "$method")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(-H "Content-Type: application/json" -d "$body")
  code=$(curl "${args[@]}" "${API_BASE}${path}")
  if [[ "$code" == "$want" ]]; then
    ok "$method $path -> $code"
  else
    bad "$method $path -> $code (expected $want) $(cat /tmp/pos-test-body.json 2>/dev/null)"
  fi
}

login() {
  curl -s "${API_BASE}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" > /tmp/pos-login.json
  python3 -c 'import json,sys; print(json.load(open("/tmp/pos-login.json")).get("token",""))'
}

log "API: $API_BASE"

ADMIN_TOKEN=$(login "$ADMIN_EMAIL" "$ADMIN_PASS")
if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "Could not login as admin — is the API running?"
  exit 1
fi
ok "admin login"

# Categories
expect_status GET /categories "$ADMIN_TOKEN" 200
expect_status POST /categories "$ADMIN_TOKEN" 201 '{"name":"Test Cat","parent_id":null,"variant_types":["size","color"]}'
TEST_CAT=$(python3 -c 'import json; print(json.load(open("/tmp/pos-test-body.json")).get("id",""))')
if [[ -n "$TEST_CAT" ]]; then
  expect_status PATCH "/categories/${TEST_CAT}" "$ADMIN_TOKEN" 200 '{"name":"Test Cat Renamed"}'
  expect_status DELETE "/categories/${TEST_CAT}" "$ADMIN_TOKEN" 200
fi

# Products — pick a leaf category without a product yet
expect_status GET /products "$ADMIN_TOKEN" 200
LEAF_CAT=$(python3 -c '
import json
d=json.load(open("/tmp/pos-test-body.json"))
for p in d.get("products", []):
    if not p.get("provisioned"):
        print(p["category_id"])
        break
')
if [[ -n "$LEAF_CAT" ]]; then
  expect_status POST /products "$ADMIN_TOKEN" 201 "{\"category_id\":\"$LEAF_CAT\",\"name\":\"\",\"base_price\":1000,\"cost_price\":500,\"colors\":[\"Black\"],\"initial_stock_per_store\":0}" || \
  expect_status POST /products "$ADMIN_TOKEN" 201 "{\"category_id\":\"$LEAF_CAT\",\"base_price\":1000,\"cost_price\":500,\"colors\":[\"Black\"],\"initial_stock_per_store\":0}"
else
  log "skip product create (all leaf categories provisioned)"
fi

# Stores
expect_status GET /shops "$ADMIN_TOKEN" 200
SHOP_ID=$(python3 -c 'import json; d=json.load(open("/tmp/pos-test-body.json")); print((d.get("shops") or [{}])[0].get("id",""))')
expect_status POST /shops "$ADMIN_TOKEN" 201 '{"name":"Test Store","location":"Nairobi","phone":"0700000000"}'
NEW_SHOP=$(python3 -c 'import json; print(json.load(open("/tmp/pos-test-body.json")).get("id",""))')
if [[ -n "$NEW_SHOP" ]]; then
  expect_status PATCH "/shops/${NEW_SHOP}" "$ADMIN_TOKEN" 200 '{"name":"Test Store Updated"}'
fi

# Expenses (use existing shop)
EXP_SHOP="${SHOP_ID:-$NEW_SHOP}"
expect_status GET /expenses "$ADMIN_TOKEN" 200
if [[ -n "$EXP_SHOP" ]]; then
  expect_status POST /expenses "$ADMIN_TOKEN" 201 "{\"shop_id\":\"$EXP_SHOP\",\"category\":\"transport\",\"amount\":500,\"note\":\"test\"}"
  EXP_ID=$(python3 -c 'import json; print(json.load(open("/tmp/pos-test-body.json")).get("id",""))')
  [[ -n "$EXP_ID" ]] && expect_status DELETE "/expenses/${EXP_ID}" "$ADMIN_TOKEN" 200
fi

if [[ -n "$NEW_SHOP" ]]; then
  expect_status DELETE "/shops/${NEW_SHOP}" "$ADMIN_TOKEN" 200
fi

# Users (director with users.create)
expect_status GET /users "$ADMIN_TOKEN" 200
TEST_USER_EMAIL="test.crud.$(date +%s)@prince-esquire.co.ke"
expect_status POST /users "$ADMIN_TOKEN" 201 "{\"name\":\"CRUD Test\",\"email\":\"$TEST_USER_EMAIL\",\"password\":\"Test1234\",\"role\":\"cashier\",\"permissions\":[\"dashboard.view\",\"inventory.view\",\"pos.access\"]}"
USER_ID=$(python3 -c 'import json; print(json.load(open("/tmp/pos-test-body.json")).get("id",""))')
if [[ -n "$USER_ID" ]]; then
  expect_status PATCH "/users/${USER_ID}" "$ADMIN_TOKEN" 200 '{"name":"CRUD Test Updated"}'
  expect_status DELETE "/users/${USER_ID}" "$ADMIN_TOKEN" 200
fi

# RBAC: cashier should not create categories
CASHIER_TOKEN=$(login "james@prince-esquire.co.ke" "Cashier123" || true)
if [[ -n "${CASHIER_TOKEN:-}" ]]; then
  expect_status POST /categories "$CASHIER_TOKEN" 403 '{"name":"Blocked","parent_id":null,"variant_types":["size"]}'
  expect_status GET /inventory "$CASHIER_TOKEN" 200
  ok "cashier RBAC spot-check"
else
  log "skip cashier RBAC (demo user not seeded)"
fi

echo ""
echo "Passed: $pass  Failed: $fail"
[[ "$fail" -eq 0 ]]
