import assert from "node:assert/strict";
import { beforeEach, it } from "node:test";
import { registerHooks } from "node:module";
import { hashGuestToken } from "../src/lib/guest-access.ts";
const token = "a".repeat(43);
let state;
globalThis.socialDB = {};
registerHooks({ resolve(specifier, context, next) {
  const mocks = {
    "@/lib/prisma": "export const prisma = globalThis.socialDB;",
    "@/lib/session": "export async function getSession() { return globalThis.socialSession; }",
    "@/lib/rate-limit": "export async function allowRequest() { return true; }",
    "next/cache": "export function revalidatePath() {}",
    "next/navigation": "export function redirect(url) { throw Object.assign(new Error('redirect'), {url}); }",
  };
  if (mocks[specifier]) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
  if (specifier.startsWith("@/")) return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
const db = globalThis.socialDB;
beforeEach(() => {
  globalThis.socialSession = null;
  state = { id: "rental-abc12345", passengerId: null, status: "COMPLETED", listing: { id: "car", ownerId: "owner" }, listingHistory: null, endsAt: new Date("2020-01-01"), guestAccessTokenHash: hashGuestToken(token), guestAccessTokenExpiresAt: new Date("2090-01-01") };
  db.carHireRequest = { async findUnique() { return state; }, async findMany(query) { state.lookup = query; return [state]; }, async update(query) { state.updated = query; } };
  db.serviceReview = { async create(query) { if (state.review) throw { code: "P2002" }; state.review = query.data; } };
  db.rentalMessage = { async create(query) { state.message = query.data; } };
});
const { rentalAccess } = await import("../src/lib/rental-access.ts");
const { lookupGuestRentalAction, sendRentalMessageAction } = await import("../src/lib/rental-actions.ts");
const { submitServiceReview } = await import("../src/lib/review-actions.ts");
function form(values) { const result = new FormData(); for (const [key,value] of Object.entries(values)) result.set(key,value); return result; }
it("requires the correct unexpired guest token or the actual rental participant", async () => {
  assert.equal(await rentalAccess(state.id, "bad"), null);
  assert.ok((await rentalAccess(state.id, token)).passenger);
  state.guestAccessTokenExpiresAt = new Date("2000-01-01"); assert.equal(await rentalAccess(state.id, token), null);
  globalThis.socialSession = { user: { id: "other", role: "CUSTOMER" } }; assert.equal(await rentalAccess(state.id, ""), null);
  globalThis.socialSession = { user: { id: "owner", role: "CAR_HIRER" } }; assert.ok((await rentalAccess(state.id, "")).owner);
});
it("normalizes rental reference and phone and stores only a hash of the rotated access token", async () => {
  await assert.rejects(lookupGuestRentalAction({error:null}, form({reference:"AbC12345",phone:"993661661"})), e => /\/rentals\/.+\?token=/.test(e.url));
  assert.equal(state.lookup.where.guestPhone,"+265993661661"); assert.equal(state.lookup.where.id.endsWith,"abc12345");
  assert.match(state.updated.data.guestAccessTokenHash,/^[a-f0-9]{64}$/);
});
it("blocks unauthorized messages and permits a token-authenticated guest conversation", async () => {
  assert.ok((await sendRentalMessageAction({error:null},form({requestId:state.id,token:"bad",body:"Hello"}))).error);
  assert.equal(state.message,undefined);
  assert.equal((await sendRentalMessageAction({error:null},form({requestId:state.id,token,body:"Hello owner"}))).error,null);
  assert.equal(state.message.senderId,null);
});
it("allows one completed rental review and attaches it to the car and owner", async () => {
  const data=form({id:state.id,kind:"rental",token,score:"5",note:"Great car"});
  assert.match((await submitServiceReview({message:""},data)).message,/Thank you/);
  assert.equal(state.review.carListingId,"car"); assert.equal(state.review.providerUserId,"owner");
  assert.match((await submitServiceReview({message:""},data)).message,/already reviewed/);
});
it("rejects pending, future and owner-authored rental ratings", async () => {
  const data=form({id:state.id,kind:"rental",token,score:"4"});
  state.status="PENDING"; assert.match((await submitServiceReview({message:""},data)).message,/completed rental/);
  state.status="COMPLETED"; state.endsAt=new Date("2090-01-01"); assert.match((await submitServiceReview({message:""},data)).message,/completed rental/);
  state.endsAt=new Date("2020-01-01");globalThis.socialSession={user:{id:"owner",role:"CAR_HIRER"}};assert.match((await submitServiceReview({message:""},data)).message,/completed rental/);
  assert.equal(state.review,undefined);
});

it("attaches completed trip reviews to both operator and vehicle", async () => {
 db.booking={async findUnique(){return {...state,userId:null,status:"COMPLETED",trip:{operatorId:"operator",vehicleId:"vehicle",departureAt:new Date("2020-01-01")},tripHistory:null};}};
 assert.match((await submitServiceReview({message:""},form({id:"booking",kind:"trip",token,score:"4",note:"On time"}))).message,/Thank you/);
 assert.equal(state.review.operatorId,"operator");assert.equal(state.review.vehicleId,"vehicle");
});
it("delivers SMS first and falls back to an approved WhatsApp template only after SMS failure", async () => {
 const {processMobileNotifications}=await import("../src/lib/mobile-notifications.ts");
 const saved=Object.fromEntries(["TWILIO_ACCOUNT_SID","TWILIO_AUTH_TOKEN","TWILIO_SMS_FROM","TWILIO_WHATSAPP_FROM","TWILIO_WHATSAPP_CONTENT_SID"].map(k=>[k,process.env[k]]));
 Object.assign(process.env,{TWILIO_ACCOUNT_SID:"ACtest",TWILIO_AUTH_TOKEN:"test",TWILIO_SMS_FROM:"+123",TWILIO_WHATSAPP_FROM:"whatsapp:+123",TWILIO_WHATSAPP_CONTENT_SID:"HXtest"});
 const notification={id:"notification",status:"QUEUED",providerSid:null,phone:"+265993661661",body:"Booking accepted",whatsappUpdates:true};
 db.mobileNotification={async findMany(q){return q.where.status.in.includes(notification.status)?[{...notification}]:[];},async updateMany(q){if(!q.where.id||q.where.status!==notification.status)return {count:0};Object.assign(notification,q.data);return {count:1};},async update(q){Object.assign(notification,q.data);return notification;}};
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,init)=>{calls.push({url,init});return {ok:true,async json(){return init.method==="POST"?{sid:notification.status==="SENDING"&&calls.length===1?"SMtest":"WMtest"}:{status:notification.providerSid==="SMtest"?"undelivered":"delivered"};}};};
 try{
  await processMobileNotifications();assert.equal(notification.status,"SMS_PENDING");assert.equal(calls[0].init.body.get("To"),notification.phone);
  await processMobileNotifications();assert.equal(notification.status,"WA_QUEUED");
  await processMobileNotifications();assert.equal(notification.status,"WA_PENDING");assert.equal(calls[2].init.body.get("ContentSid"),"HXtest");assert.equal(calls[2].init.body.get("To"),"whatsapp:"+notification.phone);
  await processMobileNotifications();assert.equal(notification.status,"DELIVERED");
  notification.status="SMS_PENDING";notification.providerSid="SMtest";notification.whatsappUpdates=false;await processMobileNotifications();assert.equal(notification.status,"FAILED");
 }finally{globalThis.fetch=original;for(const[k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});

it("queues deduplicated accepted-service reminders with departure-time expiry", async () => {
 const {queueDepartureReminders}=await import("../src/lib/mobile-notifications.ts");const now=new Date("2030-01-01T08:00:00Z");const departure=new Date("2030-01-01T08:30:00Z");const events=new Map();
 db.booking={async findMany(query){assert.equal(query.where.status,"ACCEPTED");assert.equal(query.where.trip.cancelled,false);assert.equal(query.where.trip.departureAt.lte.toISOString(),"2030-01-01T09:00:00.000Z");return [{id:"booking",guestPhone:"0993661661",whatsappUpdates:false,trip:{departureAt:departure}}];}};
 db.carHireRequest={async findMany(){return [];}};
 db.mobileNotification={async upsert(query){assert.deepEqual(query.update,{});events.set(query.where.eventKey,query.create);}};
 await queueDepartureReminders(now);await queueDepartureReminders(now);assert.equal(events.size,1);assert.equal(events.get("trip:booking:reminder").expiresAt,departure);assert.equal(events.get("trip:booking:reminder").phone,"+265993661661");
});
it("rejects invalid scores before storing a review",async()=>{for(const score of ["0","6","1.5","bad"]){assert.match((await submitServiceReview({message:""},form({id:state.id,kind:"rental",token,score}))).message,/1–5/);}assert.equal(state.review,undefined);});
