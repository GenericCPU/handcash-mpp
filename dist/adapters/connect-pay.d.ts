import { Connect, type PayData } from "@handcash/sdk";
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
export declare function executeConnectPay(opts: ExecuteConnectPayOptions): Promise<{
    data: Awaited<ReturnType<typeof Connect.pay>>["data"] | null;
    error: {
        message: string;
    } | null;
}>;
export {};
//# sourceMappingURL=connect-pay.d.ts.map