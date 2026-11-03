export const CAR_HIRE_DISTRICTS = [
  ["BALAKA", "Balaka"],
  ["BLANTYRE", "Blantyre"],
  ["CHIKWAWA", "Chikwawa"],
  ["CHIRADZULU", "Chiradzulu"],
  ["CHITIPA", "Chitipa"],
  ["DEDZA", "Dedza"],
  ["DOWA", "Dowa"],
  ["KARONGA", "Karonga"],
  ["KASUNGU", "Kasungu"],
  ["LIKOMA", "Likoma"],
  ["LILONGWE", "Lilongwe"],
  ["MACHINGA", "Machinga"],
  ["MANGOCHI", "Mangochi"],
  ["MCHINJI", "Mchinji"],
  ["MULANJE", "Mulanje"],
  ["MWANZA", "Mwanza"],
  ["MZIMBA", "Mzimba"],
  ["NENO", "Neno"],
  ["NKHATABAY", "Nkhata Bay"],
  ["NKHOTAKOTA", "Nkhotakota"],
  ["NSANJE", "Nsanje"],
  ["NTCHEU", "Ntcheu"],
  ["NTCHISI", "Ntchisi"],
  ["PHALOMBE", "Phalombe"],
  ["RUMPHI", "Rumphi"],
  ["SALIMA", "Salima"],
  ["THYOLO", "Thyolo"],
  ["ZOMBA", "Zomba"],
] as const;

export type CarHireDistrictCode = (typeof CAR_HIRE_DISTRICTS)[number][0];

export function carHireDistrictName(code: string) {
  return CAR_HIRE_DISTRICTS.find(([district]) => district === code)?.[1] ?? code;
}
