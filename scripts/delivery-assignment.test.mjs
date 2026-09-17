import assert from "node:assert/strict";
import { canAssignDriver } from "../lib/delivery/assignment.ts";

const orderA={companyId:"company-a",branchId:"branch-a",status:"ready",serviceType:"delivery"};
const driverA={companyId:"company-a",branchId:"branch-a",registrationStatus:"active",availabilityStatus:"available"};
const driverB={companyId:"company-a",branchId:"branch-b",registrationStatus:"active",availabilityStatus:"available"};
const foreignDriver={companyId:"company-b",branchId:"branch-a",registrationStatus:"active",availabilityStatus:"available"};

assert.equal(canAssignDriver(orderA,driverA),true,"o entregador A deve receber o pedido A");
assert.equal(canAssignDriver(orderA,driverB),false,"o entregador B de outra unidade não pode receber o pedido A");
assert.equal(canAssignDriver(orderA,foreignDriver),false,"um entregador de outra empresa não pode receber o pedido A");
assert.equal(canAssignDriver(orderA,{...driverA,availabilityStatus:"offline"}),false,"entregador offline não pode receber atribuição");
console.log("delivery-assignment: 4 cenários de isolamento aprovados");
