import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TZ = "Africa/Blantyre"; // UTC+2, no daylight saving

// Builds a Date for "N days from today at HH:mm, Malawi time".
function at(daysFromNow: number, time: string): Date {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const base = new Date(`${today}T12:00:00+02:00`);
  base.setUTCDate(base.getUTCDate() + daysFromNow);
  const day = base.toLocaleDateString("en-CA", { timeZone: TZ });
  return new Date(`${day}T${time}:00+02:00`);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: this script deletes data.");
  }

  // WARNING: this wipes the tables below, then re-creates the sample data.
  // It is for your development database only.
  await prisma.booking.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.departurePoint.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.operator.deleteMany();

  // --- Operators --- (TODO: names, stations and phones are MOCK placeholders)
  const express = await prisma.operator.create({
    data: { name: "Sample Express Coaches", kind: "BUS_COMPANY", verified: true, phone: "+265 999 000 111" },
  });
  const intercity = await prisma.operator.create({
    data: { name: "Sample Intercity Lines", kind: "BUS_COMPANY", verified: false, phone: "+265 888 000 222" },
  });
  const banda = await prisma.operator.create({ data: { name: "J. Banda", kind: "TAXI_OWNER", verified: true } });
  const phiri = await prisma.operator.create({ data: { name: "M. Phiri", kind: "TAXI_OWNER", verified: false } });
  const chirwa = await prisma.operator.create({ data: { name: "T. Chirwa", kind: "TAXI_OWNER", verified: true } });

  // --- Bus stations: each company's official station in each city ---
  const station = (operatorId: string, city: "Blantyre" | "Lilongwe" | "Mzuzu", name: string) =>
    prisma.departurePoint.create({ data: { operatorId, city, name, kind: "STATION" } });

  const expressBT = await station(express.id, "Blantyre", "Sample Express Blantyre Station");
  const expressLL = await station(express.id, "Lilongwe", "Sample Express Lilongwe Station");
  const expressMZ = await station(express.id, "Mzuzu", "Sample Express Mzuzu Station");
  const intercityBT = await station(intercity.id, "Blantyre", "Sample Intercity Blantyre Depot");
  const intercityLL = await station(intercity.id, "Lilongwe", "Sample Intercity Lilongwe Depot");
  void expressMZ; // (Mzuzu depots are used once we add more Mzuzu departures)

  // --- Taxi stages (TODO: Lilongwe and Mzuzu names are MOCK placeholders) ---
  const stage = (city: "Blantyre" | "Lilongwe" | "Mzuzu", name: string) =>
    prisma.departurePoint.create({ data: { city, name, kind: "STAGE" } });

  const kameza = await stage("Blantyre", "Kameza Round About");
  const shoprite = await stage("Blantyre", "Shoprite");
  const kandodo = await stage("Blantyre", "Kandodo Corner Shop");
  await stage("Lilongwe", "Lilongwe Stage A");
  const llB = await stage("Lilongwe", "Lilongwe Stage B");
  await stage("Lilongwe", "Lilongwe Stage C");
  const mzA = await stage("Mzuzu", "Mzuzu Stage A");
  await stage("Mzuzu", "Mzuzu Stage B");

  // --- Vehicles ---
  const vehicle = (operatorId: string, model: string, plate: string, seats: number) =>
    prisma.vehicle.create({ data: { operatorId, model, plate, seats } });

  const scania1 = await vehicle(express.id, "Scania Coach", "BT 1234", 52);
  const scania2 = await vehicle(express.id, "Scania Coach", "BT 5678", 52);
  const yutong1 = await vehicle(intercity.id, "Yutong Coach", "BT 7788", 60);
  const yutong2 = await vehicle(intercity.id, "Yutong Coach", "LL 6601", 60);
  const hiaceBanda = await vehicle(banda.id, "Toyota Hiace", "MZ 4521", 7);
  const noahPhiri = await vehicle(phiri.id, "Toyota Noah", "MC 9012", 8);
  const hiaceChirwa = await vehicle(chirwa.id, "Toyota Hiace", "BT 3310", 7);
  const noahChirwa = await vehicle(chirwa.id, "Toyota Noah", "LL 2045", 8);

  // --- Trips ---
  type TripSeed = {
    operatorId: string; vehicleId: string; departurePointId: string;
    type: "BUS" | "TAXI"; origin: "Blantyre" | "Lilongwe" | "Mzuzu";
    destination: "Blantyre" | "Lilongwe" | "Mzuzu";
    departureAt: Date; fareMWK: number; seatsTotal: number; seatsAvailable: number;
    pickupAvailable?: boolean; pickupFeeMWK?: number;
  };
  const trips: TripSeed[] = [
    { operatorId: express.id, vehicleId: scania1.id, departurePointId: expressBT.id, type: "BUS",
      origin: "Blantyre", destination: "Lilongwe", departureAt: at(0, "17:30"), fareMWK: 18000, seatsTotal: 52, seatsAvailable: 14 },
    { operatorId: express.id, vehicleId: scania2.id, departurePointId: expressLL.id, type: "BUS",
      origin: "Lilongwe", destination: "Mzuzu", departureAt: at(1, "06:30"), fareMWK: 20000, seatsTotal: 52, seatsAvailable: 3 },
    { operatorId: banda.id, vehicleId: hiaceBanda.id, departurePointId: kameza.id, type: "TAXI",
      origin: "Blantyre", destination: "Lilongwe", departureAt: at(0, "18:30"), fareMWK: 22000, seatsTotal: 7, seatsAvailable: 2,
      pickupAvailable: true, pickupFeeMWK: 3000 },
    { operatorId: phiri.id, vehicleId: noahPhiri.id, departurePointId: mzA.id, type: "TAXI",
      origin: "Mzuzu", destination: "Lilongwe", departureAt: at(1, "08:15"), fareMWK: 21000, seatsTotal: 8, seatsAvailable: 0,
      pickupAvailable: true, pickupFeeMWK: 2500 },
    { operatorId: intercity.id, vehicleId: yutong1.id, departurePointId: intercityBT.id, type: "BUS",
      origin: "Blantyre", destination: "Mzuzu", departureAt: at(2, "04:45"), fareMWK: 35000, seatsTotal: 60, seatsAvailable: 26 },
    { operatorId: chirwa.id, vehicleId: hiaceChirwa.id, departurePointId: shoprite.id, type: "TAXI",
      origin: "Blantyre", destination: "Lilongwe", departureAt: at(1, "06:00"), fareMWK: 22000, seatsTotal: 7, seatsAvailable: 5 },
    { operatorId: banda.id, vehicleId: hiaceBanda.id, departurePointId: kandodo.id, type: "TAXI",
      origin: "Blantyre", destination: "Mzuzu", departureAt: at(2, "05:00"), fareMWK: 38000, seatsTotal: 7, seatsAvailable: 4,
      pickupAvailable: true, pickupFeeMWK: 4000 },
    { operatorId: chirwa.id, vehicleId: noahChirwa.id, departurePointId: llB.id, type: "TAXI",
      origin: "Lilongwe", destination: "Blantyre", departureAt: at(0, "20:00"), fareMWK: 22000, seatsTotal: 8, seatsAvailable: 6,
      pickupAvailable: true, pickupFeeMWK: 3000 },
    { operatorId: intercity.id, vehicleId: yutong2.id, departurePointId: intercityLL.id, type: "BUS",
      origin: "Lilongwe", destination: "Blantyre", departureAt: at(1, "07:30"), fareMWK: 18500, seatsTotal: 60, seatsAvailable: 31 },
    { operatorId: express.id, vehicleId: scania2.id, departurePointId: expressMZ.id, type: "BUS",
      origin: "Mzuzu", destination: "Blantyre", departureAt: at(2, "05:00"), fareMWK: 35000, seatsTotal: 52, seatsAvailable: 9 },
  ];

  await prisma.trip.createMany({ data: trips });
  console.log(`Seeded ${trips.length} trips.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
