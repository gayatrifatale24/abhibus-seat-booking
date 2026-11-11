#!/usr/bin/env bash
# End-to-end API smoke test with curl. Usage: BASE=http://localhost:4000 ./scripts/smoke.sh
set -euo pipefail
BASE=${BASE:-http://localhost:4000}
J='content-type: application/json'
DATE=$(TZ=Asia/Kolkata date -d tomorrow +%F 2>/dev/null || date -v+1d +%F)
pj() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(eval(process.argv[1]))})' "$1"; }

echo "== GET /api/health";            curl -s "$BASE/api/health"; echo
echo "== GET /api/cities";            curl -s "$BASE/api/cities" | pj 'j.cities.join(", ")'
echo "== GET /api/trips/search";      TRIP=$(curl -s "$BASE/api/trips/search?from=Hyderabad&to=Bengaluru&date=$DATE" | tee /tmp/search.json | pj 'j.trips[0].id')
pj '`${j.trips.length} trips; first: #${j.trips[0].id} ${j.trips[0].operator} ${j.trips[0].departure} from ₹${j.trips[0].minFare}, ${j.trips[0].availableSeats} seats left`' < /tmp/search.json
echo "== POST /api/auth/login";       TOKEN=$(curl -s -XPOST "$BASE/api/auth/login" -H "$J" -d '{"email":"demo@abhibus.test","password":"demo1234"}' | pj 'j.token')
echo "token: ${TOKEN:0:24}…"
A="authorization: Bearer $TOKEN"
SEATS=$(curl -s "$BASE/api/trips/$TRIP" | pj 'JSON.stringify(j.seats.filter(s=>s.status=="AVAILABLE"&&!s.ladiesOnly).slice(0,2).map(s=>s.seatNo))')
echo "== POST /api/trips/$TRIP/holds $SEATS"; HOLD=$(curl -s -XPOST "$BASE/api/trips/$TRIP/holds" -H "$A" -H "$J" -d "{\"seats\":$SEATS}" | tee /tmp/hold.json | pj 'j.holdId'); cat /tmp/hold.json; echo
echo "== same seats by another user -> 409"
T2=$(curl -s -XPOST "$BASE/api/auth/register" -H "$J" -d "{\"name\":\"Second User\",\"email\":\"second$RANDOM@test.dev\",\"password\":\"secret123\"}" | pj 'j.token')
curl -s -w '  [HTTP %{http_code}]\n' -XPOST "$BASE/api/trips/$TRIP/holds" -H "authorization: Bearer $T2" -H "$J" -d "{\"seats\":$SEATS}"
PAX=$(echo "$SEATS" | pj 'JSON.stringify(j.map((s,i)=>({seatNo:s,name:["Gayatri","Ravi"][i]||"Guest",age:29+i,gender:i?"M":"F"})))')
echo "== POST /api/bookings";         curl -s -XPOST "$BASE/api/bookings" -H "$A" -H "$J" -d "{\"holdId\":\"$HOLD\",\"contactPhone\":\"9876543210\",\"passengers\":$PAX}" | tee /tmp/booking.json | pj '`booking ${j.id} ${j.status} seats=${j.seats} total=₹${j.totalFare}`'
BID=$(pj 'j.id' < /tmp/booking.json)
echo "== GET /api/bookings";          curl -s "$BASE/api/bookings" -H "$A" | pj 'j.bookings.map(b=>b.id+":"+b.status).join(", ")'
echo "== POST /api/bookings/$BID/cancel"; curl -s -XPOST "$BASE/api/bookings/$BID/cancel" -H "$A" | pj '`${j.status}, refund ₹${j.refundAmount} (${j.refundPercent}%)`'
echo "== no token -> 401";            curl -s -w '  [HTTP %{http_code}]\n' "$BASE/api/bookings"
echo "== bad input -> 400";           curl -s -w '  [HTTP %{http_code}]\n' "$BASE/api/trips/search?from=Hyderabad&to=Bengaluru&date=tomorrow"
