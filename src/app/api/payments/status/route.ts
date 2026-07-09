import { db } from "@/db";
import { clients, payments } from "@/db/schema";
import { NextResponse } from "next/server";
import { computePaidUntil, getPaymentStatus } from "@/lib/payments";

export async function GET() {
  const allClients = await db.select().from(clients).orderBy(clients.id);
  const allPayments = await db.select().from(payments);

  const result = allClients.map(client => {
    const clientPayments = allPayments.filter(p => p.clientId === client.id);
    const paidUntil = computePaidUntil(clientPayments);
    const status = getPaymentStatus(paidUntil);
    const lastPayment = clientPayments.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))[0] ?? null;

    return {
      id: client.id,
      name: client.name,
      username: client.username,
      monthlyFee: client.monthlyFee,
      periodicityDays: client.periodicityDays,
      startDate: client.startDate,
      isActive: client.isActive,
      paidUntil,
      status,
      lastPaymentDate: lastPayment?.paymentDate ?? null,
    };
  });

  return NextResponse.json(result);
}
