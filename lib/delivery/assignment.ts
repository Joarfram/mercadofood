export type AssignmentOrder = { companyId: string; branchId: string; status: string; serviceType: string };
export type AssignmentDriver = { companyId: string; branchId: string | null; registrationStatus: string; availabilityStatus: string };

export function canAssignDriver(order: AssignmentOrder, driver: AssignmentDriver) {
  return order.status === "ready"
    && order.serviceType === "delivery"
    && driver.companyId === order.companyId
    && (!driver.branchId || driver.branchId === order.branchId)
    && driver.registrationStatus === "active"
    && driver.availabilityStatus === "available";
}
