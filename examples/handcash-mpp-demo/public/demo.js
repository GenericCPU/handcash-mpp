(function () {
  const $ = (id) => document.getElementById(id);
  let paymentRequestId = null;
  let challengeId = null;
  let payUrl = null;
  let receiptJwt = null;
  let authToken = null;
  let payPopup = null;
  let popupWatch = null;
  let qrImageUrl = null;
  let qrOpen = false;

  function stopPopupWatch() {
    if (popupWatch) {
      clearInterval(popupWatch);
      popupWatch = null;
    }
  }

  function syncConnect() {
    $("btnConnectPay").disabled = !(challengeId && authToken);
    $("btnConnectAuth").disabled = !challengeId;
    $("btnConnectAuth").title = challengeId ? "" : "GET /api/premium first (402).";
  }

  function setAuth(msg, err) {
    $("authLine").textContent = msg;
    $("authLine").className = "meta" + (err ? " warn" : "");
  }

  async function pollOnce() {
    if (!paymentRequestId) return false;
    $("outReceipt").textContent = "…";
    const r = await fetch("/api/receipt?paymentRequestId=" + encodeURIComponent(paymentRequestId));
    const j = await r.json();
    $("outReceipt").textContent = JSON.stringify(j, null, 2);
    if (j.ready && j.receiptJwt) {
      receiptJwt = j.receiptJwt;
      $("btnRetry").disabled = false;
      $("payHint").textContent = "Receipt ready — retry below.";
      $("payHint").className = "meta ok";
      return true;
    }
    return false;
  }

  function openPopup(url, name) {
    const w = 520,
      h = 720;
    const x = Math.max(0, Math.floor((window.screen.width - w) / 2));
    const y = Math.max(0, Math.floor((window.screen.height - h) / 5));
    return window.open(url, name, "popup=yes,width=" + w + ",height=" + h + ",left=" + x + ",top=" + y + ",scrollbars=yes,resizable=yes");
  }

  function openPayPopup(url) {
    payPopup = openPopup(url, "HandCashPay");
    if (!payPopup) {
      $("payHint").textContent = qrImageUrl
        ? "Popup blocked — open QR below."
        : "Popup blocked — allow popups for this site.";
      $("payHint").className = "meta warn";
      return;
    }
    $("payHint").textContent = "Complete payment in the popup.";
    $("payHint").className = "meta";
    stopPopupWatch();
    let ticks = 0;
    popupWatch = setInterval(async function () {
      ticks++;
      if (payPopup.closed) {
        stopPopupWatch();
        await pollOnce();
        return;
      }
      if (ticks % 4 === 0) await pollOnce();
    }, 500);
  }

  window.addEventListener("message", async function (ev) {
    if (ev.origin !== window.location.origin) return;
    const d = ev.data;
    if (!d || typeof d !== "object") return;
    if (d.type === "handcash-connect-auth" && typeof d.authToken === "string" && d.authToken) {
      authToken = d.authToken;
      setAuth("Wallet connected (Connect).", false);
      syncConnect();
      return;
    }
    if (d.type !== "handcash-mpp-return") return;
    stopPopupWatch();
    if (d.paymentRequestId) paymentRequestId = d.paymentRequestId;
    $("btnPoll").disabled = false;
    await pollOnce();
  });

  $("btnRequest").onclick = async function () {
    $("outRequest").textContent = "…";
    qrOpen = false;
    $("qrWrap").classList.remove("on");
    $("payQrImg").removeAttribute("src");
    $("btnQr").disabled = true;
    challengeId = null;
    $("challengeOut").textContent = "—";
    $("amt").textContent = "—";
    syncConnect();
    if (!authToken) setAuth("Wallet: not connected.", false);
    const r = await fetch("/api/premium", { headers: { Accept: "application/json" } });
    const text = await r.text();
    var j;
    try {
      j = JSON.parse(text);
    } catch (e) {
      $("outRequest").textContent = text;
      return;
    }
    $("outRequest").textContent = JSON.stringify(j, null, 2);
    if (r.status === 402 && j.handcash && j.handcash.paymentRequestId) {
      paymentRequestId = j.handcash.paymentRequestId;
      challengeId = typeof j.challengeId === "string" ? j.challengeId : null;
      $("challengeOut").textContent = challengeId || "—";
      payUrl = j.handcash.paymentRequestUrl || null;
      var qr = j.handcash.paymentRequestQrCodeUrl;
      qrImageUrl = typeof qr === "string" && qr ? qr : null;
      if (qrImageUrl) {
        $("payQrImg").src = qrImageUrl;
        $("btnQr").disabled = false;
      }
      $("btnPoll").disabled = false;
      $("btnPay").disabled = !payUrl;
      $("payHint").textContent = "Hosted pay, QR, or wallet (Connect) — one path per challenge.";
      $("payHint").className = "meta";
      var n = typeof j.payAmountUsd === "number" ? j.payAmountUsd : null;
      var cur = typeof j.payAmountCurrency === "string" ? j.payAmountCurrency : "USD";
      $("amt").textContent =
        n == null || Number.isNaN(n)
          ? "—"
          : (function () {
              try {
                return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(n);
              } catch (e) {
                return String(n) + " " + cur;
              }
            })();
      syncConnect();
    }
  };

  $("btnQr").onclick = function () {
    if (!qrImageUrl) return;
    qrOpen = !qrOpen;
    $("qrWrap").classList.toggle("on", qrOpen);
  };

  $("btnPay").onclick = function () {
    if (payUrl) openPayPopup(payUrl);
  };

  $("btnConnectAuth").onclick = async function () {
    if (!challengeId) return;
    setAuth("…", false);
    const r = await fetch("/api/connect-auth-url");
    const j = await r.json();
    if (!r.ok || !j.url) {
      setAuth(String(j.error || r.status), true);
      return;
    }
    var w = openPopup(j.url, "HandCashConnect");
    if (!w) {
      setAuth("Popup blocked.", true);
      return;
    }
    setAuth("Finish authorization in the popup…", false);
  };

  $("btnConnectPay").onclick = async function () {
    if (!challengeId || !authToken) return;
    $("outReceipt").textContent = "…";
    const r = await fetch("/api/connect-pay", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ authToken: authToken, challengeId: challengeId }),
    });
    const j = await r.json();
    $("outReceipt").textContent = JSON.stringify(j, null, 2);
    if (r.ok && j.receiptJwt) {
      receiptJwt = j.receiptJwt;
      $("btnRetry").disabled = false;
      $("btnPoll").disabled = true;
      $("payHint").textContent = "Receipt from Connect — retry below.";
      $("payHint").className = "meta ok";
    } else {
      $("payHint").textContent = String(j.error || "Connect.pay failed");
      $("payHint").className = "meta warn";
    }
  };

  $("btnPoll").onclick = function () {
    pollOnce();
  };

  $("btnRetry").onclick = async function () {
    if (!receiptJwt) return;
    $("outRetry").textContent = "…";
    const r = await fetch("/api/premium", {
      headers: { Accept: "application/json", "x-handcash-receipt": receiptJwt },
    });
    $("outRetry").textContent = JSON.stringify(await r.json(), null, 2);
  };

  syncConnect();
})();
