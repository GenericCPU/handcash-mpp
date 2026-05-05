import { PaymentRequests, type CreatePaymentRequestData } from "@handcash/sdk";
import { buildCreatePaymentRequestBodyFromCharge } from "../domain/instruments.js";
import type { ChargeSpec } from "../domain/types.js";
import type { HostedPayArtifact } from "../domain/types.js";

type SdkClient = NonNullable<Parameters<typeof PaymentRequests.createPaymentRequest>[0]["client"]>;

export type CreateHostedPayOptions = {
  /** App-level client from `getInstance({ appId, appSecret }).client` */
  client: SdkClient;
  charge: ChargeSpec;
  /** Tie Cloud webhooks back to your `challengeId`. */
  webhookUrl?: string;
  redirectUrl?: string;
  requestedUserData?: CreatePaymentRequestData["body"]["requestedUserData"];
  paymentMethods?: CreatePaymentRequestData["body"]["paymentMethods"];
};

/**
 * HandCash Pay: creates a **payment request** and returns URLs for the 402 `handcash` extension.
 * This acts as the hosted payment redirect URL inside a machine-pay flow.
 */
export async function createHostedPayArtifact(
  opts: CreateHostedPayOptions,
): Promise<{ data: HostedPayArtifact | null; error: { message: string } | null }> {
  const body: CreatePaymentRequestData["body"] = {
    ...buildCreatePaymentRequestBodyFromCharge(opts.charge),
    ...(opts.requestedUserData ? { requestedUserData: opts.requestedUserData } : {}),
    ...(opts.paymentMethods ? { paymentMethods: opts.paymentMethods } : {}),
    ...(opts.redirectUrl ? { redirectUrl: opts.redirectUrl } : {}),
    ...(opts.webhookUrl
      ? {
          notifications: {
            webhook: { webhookUrl: opts.webhookUrl },
          },
        }
      : {}),
  };

  const { data, error } = await PaymentRequests.createPaymentRequest({
    client: opts.client,
    body,
  });

  if (error) {
    const msg =
      typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "PaymentRequests.createPaymentRequest failed";
    return { data: null, error: { message: msg } };
  }

  if (!data?.id || !data.paymentRequestUrl) {
    return { data: null, error: { message: "Missing paymentRequest id or paymentRequestUrl in response" } };
  }

  return {
    data: {
      fulfillment: "hosted_pay",
      paymentRequestId: data.id,
      paymentRequestUrl: data.paymentRequestUrl,
      ...(data.paymentRequestQrCodeUrl
        ? { paymentRequestQrCodeUrl: data.paymentRequestQrCodeUrl }
        : {}),
    },
    error: null,
  };
}
