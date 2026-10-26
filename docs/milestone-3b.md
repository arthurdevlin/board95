# Milestone 3B: search to trip review

## Why this step

Milestone 3A already defines User and Booking in `prisma/schema.prisma`.
The actual routes are `/`, `/transport`, and the car-hire placeholder.
Trip cards have a disabled request button. There is no authentication,
customer session, booking endpoint, or booking UI.

The smallest independent next step is selecting a trip and reviewing the
seat fare. Creating a Booking now would require deciding how to identify
the customer. The required `Booking.userId` must not come from a public form,
and matching someone by a supplied email or phone is not authentication.

## Implemented

1. Available trip cards link to `/transport/[tripId]` with “Review trip”.
2. The page reads the trip from PostgreSQL for each request, using the same
   public listing mapper as search. Taxi owner phone numbers stay private.
3. Customers can choose a whole number of seats and update the fare with a
   plain GET form. Only the seat count is accepted; fare and availability
   come from the database. The server rejects repeated, invalid, excessive,
   and unsafe numbers, and calculates the seat subtotal in whole MWK.
4. Unknown or inactive trips render the unavailable page. Departed and full
   trips display an explanation without a seat form.
5. The page explicitly says no booking or reservation has been made.

No schema changes or migrations are needed. Activity, SelfDriveRequest,
Payment, seat holds, and operator acceptance are outside this milestone.
Pickup is shown as existing trip information, but is excluded from the seat
review: the schema does not say whether its fee is per seat or per request.

## Run locally

Use Node 22.18+ or Node 24 (the tests use built-in TypeScript stripping).

```sh
npm ci
cp env.example .env
# Set DATABASE_URL to your development PostgreSQL database.
npx prisma generate
# For a NEW, disposable development database only:
npx prisma db push
# Optional: seed.ts deletes existing booking/trip/operator data.
npx prisma db seed
npm run dev
```

`prisma/schema.prisma` is the schema selected by `prisma.config.ts`.
The root `schema.prisma` is a pre-existing duplicate seed script, not the
configured schema.

## Validation

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

With a development database, check the following manually:

- Search, open a bus or taxi, choose two available seats, and update the fare.
- Edit `?seats=` to `0`, `1.5`, an excessive count, and repeated parameters;
  expect an error and no subtotal.
- Open an unknown/inactive trip; expect “Trip unavailable”.
- Open a full/departed trip directly; expect no seat form.
- Change availability or fare in the development database, then update the
  fare; expect the latest values. Confirm no Booking rows were created.
- Check on a narrow screen and navigate the form using the keyboard.

## Next booking milestone

Establish the customer identity/authentication approach first. Then persist
a PENDING booking using the authenticated user's ID, server-side pricing,
and an atomic availability check. Before changing inventory, define whether
PENDING requests reserve seats or only ACCEPTED requests consume them.
Define pickup fee units before including pickup in a booking total.
