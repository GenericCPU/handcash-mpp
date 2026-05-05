import { Connect, type PayData } from "@handcash/sdk";
import { buildConnectPayBodyFromCharge } from "../domain/instruments.js";
import type { ChargeSpec } from "../domain/types.js";

type UserClient = NonNullable<Parameters<typeof Connect.pay>[0]["client"]>;

export type ExecuteConnectPayOptions = {
  /** From `getInstance(...).getAccountClient(authToken)` */
  client: UserClient;
  charge: ChargeSpec;
  note?: string;
  attachment?: PayData["body"]["attachment"];
  exchangeRateVersion?: string;
};

/**
 * **Connect.pay** — instant payment from an authorized user wallet.
 * Uses {@link buildConnectPayBodyFromCharge} so **BSV** always carries **USD** denomination and **MNEE** follows Cloud rules.
 */
export async function executeConnectPay(opts: ExecuteConnectPayOptions): Promise<{
  data: Awaited<ReturnType<typeof Connect.pay>>["data"] | null;
  error: { message: string } | null;
}> {
  const body = buildConnectPayBodyFromCharge(opts.charge, {
    note: opts.note,
    attachment: opts.attachment,
    exchangeRateVersion: opts.exchangeRateVersion,
  });

  const { data, error } = await Connect.pay({
    client: opts.client,
    body,
  });

  if (error) {
    const msg =
      typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "Connect.pay failed";
    return { data: null, error: { message: msg } };
  }

  return { data: data ?? null, error: null };
}
