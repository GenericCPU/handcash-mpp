import { Connect } from "@handcash/sdk";
import { buildConnectPayBodyFromCharge } from "../domain/instruments.js";
/**
 * **Connect.pay** — instant payment from an authorized user wallet.
 * Uses {@link buildConnectPayBodyFromCharge} so **BSV** always carries **USD** denomination and **MNEE** follows Cloud rules.
 */
export async function executeConnectPay(opts) {
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
        const msg = typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
            ? error.message
            : "Connect.pay failed";
        return { data: null, error: { message: msg } };
    }
    return { data: data ?? null, error: null };
}
//# sourceMappingURL=connect-pay.js.map