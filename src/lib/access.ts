type Viewer = { role: string; isBusMember?: boolean } | null | undefined;

export function canBrowseListings(user: Viewer) {
  return !user || user.role === "ADMIN" || (user.role === "CUSTOMER" && !user.isBusMember);
}

export function canApplyForOperator(user: Viewer) {
  return user?.role === "CUSTOMER" && !user.isBusMember;
}

export function roleHome(user: Viewer) {
  if (!user) return "/";
  if (user.role === "ADMIN") return "/admin";
  if (user.role === "CAR_HIRER") return "/car-hire/dashboard";
  if (user.role === "OWNER" || user.isBusMember) return "/operator";
  return "/account";
}
