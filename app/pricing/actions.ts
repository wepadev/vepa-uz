"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { asRpcClient } from "@/lib/supabase/rpc";

type PaymentOrderRow = {
  order_id: string;
};

function textValue(
  value: FormDataEntryValue | null,
) {
  return String(value ?? "").trim();
}

export async function createPaymentOrderAction(
  formData: FormData,
) {
  const planCode = textValue(
    formData.get("planCode"),
  ).toLowerCase();

  const promoCode = textValue(
    formData.get("promoCode"),
  ).toUpperCase();

  if (
    ![
      "monthly",
      "quarterly",
      "semiannual",
      "full",
    ].includes(planCode)
  ) {
    redirect(
      "/pricing?error=Tarif+noto%CA%BBg%CA%BBri",
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const rpcClient = asRpcClient(supabase);

  const { data, error } = await rpcClient.rpc(
    "create_manual_payment_order",
    {
      p_plan_code: planCode,
      p_promo_code: promoCode || null,
    },
  );

  if (error) {
    const message = encodeURIComponent(
      error.message ||
        "Buyurtma yaratilmadi.",
    );

    redirect(
      `/pricing?error=${message}&plan=${planCode}`,
    );
  }

  const row = (
    Array.isArray(data)
      ? data[0]
      : data
  ) as PaymentOrderRow | null;

  if (!row?.order_id) {
    redirect(
      `/pricing?error=${encodeURIComponent(
        "Buyurtma raqami olinmadi.",
      )}&plan=${planCode}`,
    );
  }

  redirect(
    `/payment/pending?orderId=${row.order_id}`,
  );
}
