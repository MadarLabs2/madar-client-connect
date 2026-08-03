import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/external-db/auth-middleware";
import { supabaseAdmin } from "@/integrations/external-db/client.server";
import { getProjectClient } from "@/lib/project-db.server";
import { isCashOrder } from "@/lib/bakery/orderPayment";

async function isPlatformAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

type ProjectClient = Awaited<ReturnType<typeof getProjectClient>>;

function productDisplayName(row: Record<string, unknown>): string {
  const he = String(row.name_he ?? "").trim();
  const name = String(row.name ?? "").trim();
  const en = String(row.name_en ?? "").trim();
  const ar = String(row.name_ar ?? "").trim();
  return he || name || en || ar || "—";
}

async function loadCashOrder(client: ProjectClient, orderId: string) {
  const { data, error } = await client
    .from("orders")
    .select(
      "id, payment_method, order_status, subtotal, discount_amount, delivery_fee, total_amount",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("ORDER_NOT_FOUND");
  if (!isCashOrder(data)) throw new Error("NOT_CASH_ORDER");
  if (String(data.order_status ?? "").toLowerCase() === "cancelled") {
    throw new Error("ORDER_CANCELLED");
  }
  return data as {
    id: string;
    payment_method: string | null;
    order_status: string | null;
    subtotal: number | string | null;
    discount_amount: number | string | null;
    delivery_fee: number | string | null;
    total_amount: number | string | null;
  };
}

async function recalcOrderTotals(client: ProjectClient, orderId: string) {
  const { data: items, error } = await client
    .from("order_items")
    .select("total_price")
    .eq("order_id", orderId);
  if (error) throw new Error(error.message);

  const subtotal = (items ?? []).reduce(
    (s, row) => s + Number((row as { total_price?: number | string | null }).total_price ?? 0),
    0,
  );

  const { data: order, error: orderErr } = await client
    .from("orders")
    .select("discount_amount, delivery_fee")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr) throw new Error(orderErr.message);

  const discount = Number(order?.discount_amount ?? 0);
  const delivery = Number(order?.delivery_fee ?? 0);
  const total = Math.max(0, subtotal - discount + delivery);

  const { error: updErr } = await client
    .from("orders")
    .update({
      subtotal,
      total_amount: total,
    })
    .eq("id", orderId);
  if (updErr) throw new Error(updErr.message);

  return { subtotal, total_amount: total };
}

async function adjustStock(
  client: ProjectClient,
  productId: string,
  delta: number,
): Promise<void> {
  if (!productId || delta === 0) return;
  const { data: product, error } = await client
    .from("products")
    .select("id, stock_quantity")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!product) return;
  if (product.stock_quantity == null) return; // unlimited

  const next = Number(product.stock_quantity) + delta;
  if (next < 0) throw new Error("INSUFFICIENT_STOCK");

  const { error: updErr } = await client
    .from("products")
    .update({ stock_quantity: next })
    .eq("id", productId);
  if (updErr) throw new Error(updErr.message);
}

/** Add a product line (or increase qty) on a cash bakery order; adjusts stock + totals. */
export const bakeryAddCashOrderItemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        orderId: z.string().uuid(),
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(999),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await isPlatformAdmin(context.userId);
    const client = await getProjectClient(data.projectId, context.userId, admin);
    await loadCashOrder(client, data.orderId);

    const { data: product, error: pErr } = await client
      .from("products")
      .select("id, name, name_he, name_en, name_ar, price, stock_quantity, is_available")
      .eq("id", data.productId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    if (product.is_available === false) throw new Error("PRODUCT_UNAVAILABLE");

    const unitPrice = Number(product.price ?? 0);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("INVALID_PRICE");

    if (product.stock_quantity != null && Number(product.stock_quantity) < data.quantity) {
      throw new Error("INSUFFICIENT_STOCK");
    }

    const { data: existing, error: exErr } = await client
      .from("order_items")
      .select("id, quantity, product_price")
      .eq("order_id", data.orderId)
      .eq("product_id", data.productId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);

    if (existing?.id) {
      const nextQty = Number(existing.quantity ?? 0) + data.quantity;
      const price = Number(existing.product_price ?? unitPrice);
      const { error: updItemErr } = await client
        .from("order_items")
        .update({
          quantity: nextQty,
          total_price: price * nextQty,
        })
        .eq("id", existing.id);
      if (updItemErr) throw new Error(updItemErr.message);
    } else {
      const { error: insErr } = await client.from("order_items").insert({
        order_id: data.orderId,
        product_id: data.productId,
        product_name: productDisplayName(product as Record<string, unknown>),
        product_price: unitPrice,
        quantity: data.quantity,
        total_price: unitPrice * data.quantity,
      });
      if (insErr) throw new Error(insErr.message);
    }

    await adjustStock(client, data.productId, -data.quantity);
    const totals = await recalcOrderTotals(client, data.orderId);
    return { ok: true as const, ...totals };
  });

/** Set absolute quantity on a cash order line; adjusts stock + totals. */
export const bakeryUpdateCashOrderItemQtyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        orderId: z.string().uuid(),
        orderItemId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(999),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await isPlatformAdmin(context.userId);
    const client = await getProjectClient(data.projectId, context.userId, admin);
    await loadCashOrder(client, data.orderId);

    const { data: item, error: itemErr } = await client
      .from("order_items")
      .select("id, order_id, product_id, quantity, product_price")
      .eq("id", data.orderItemId)
      .eq("order_id", data.orderId)
      .maybeSingle();
    if (itemErr) throw new Error(itemErr.message);
    if (!item) throw new Error("ITEM_NOT_FOUND");

    const prevQty = Number(item.quantity ?? 0);
    const nextQty = data.quantity;
    const delta = nextQty - prevQty;
    if (delta === 0) {
      const totals = await recalcOrderTotals(client, data.orderId);
      return { ok: true as const, ...totals };
    }

    if (delta > 0 && item.product_id) {
      const { data: product, error: pErr } = await client
        .from("products")
        .select("id, stock_quantity")
        .eq("id", item.product_id)
        .maybeSingle();
      if (pErr) throw new Error(pErr.message);
      if (product?.stock_quantity != null && Number(product.stock_quantity) < delta) {
        throw new Error("INSUFFICIENT_STOCK");
      }
    }

    const unitPrice = Number(item.product_price ?? 0);
    const { error: updErr } = await client
      .from("order_items")
      .update({
        quantity: nextQty,
        total_price: unitPrice * nextQty,
      })
      .eq("id", item.id);
    if (updErr) throw new Error(updErr.message);

    if (item.product_id) {
      await adjustStock(client, String(item.product_id), -delta);
    }

    const totals = await recalcOrderTotals(client, data.orderId);
    return { ok: true as const, ...totals };
  });

/** Remove a line item from a cash bakery order; restores stock + recalculates totals. */
export const bakeryDeleteCashOrderItemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        orderId: z.string().uuid(),
        orderItemId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await isPlatformAdmin(context.userId);
    const client = await getProjectClient(data.projectId, context.userId, admin);
    await loadCashOrder(client, data.orderId);

    const { data: item, error: itemErr } = await client
      .from("order_items")
      .select("id, order_id, product_id, quantity")
      .eq("id", data.orderItemId)
      .eq("order_id", data.orderId)
      .maybeSingle();
    if (itemErr) throw new Error(itemErr.message);
    if (!item) throw new Error("ITEM_NOT_FOUND");

    const { count, error: countErr } = await client
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", data.orderId);
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) <= 1) throw new Error("LAST_ITEM");

    const { error: delErr } = await client.from("order_items").delete().eq("id", item.id);
    if (delErr) throw new Error(delErr.message);

    if (item.product_id) {
      await adjustStock(client, String(item.product_id), Number(item.quantity ?? 0));
    }

    const totals = await recalcOrderTotals(client, data.orderId);
    return { ok: true as const, ...totals };
  });

async function restoreOrderItemsStock(client: ProjectClient, orderId: string) {
  const { data: items, error } = await client
    .from("order_items")
    .select("product_id, quantity")
    .eq("order_id", orderId);
  if (error) throw new Error(error.message);
  for (const item of items ?? []) {
    if (!item.product_id) continue;
    await adjustStock(client, String(item.product_id), Number(item.quantity ?? 0));
  }
}

async function deductOrderItemsStock(client: ProjectClient, orderId: string) {
  const { data: items, error } = await client
    .from("order_items")
    .select("product_id, quantity")
    .eq("order_id", orderId);
  if (error) throw new Error(error.message);
  for (const item of items ?? []) {
    if (!item.product_id) continue;
    await adjustStock(client, String(item.product_id), -Number(item.quantity ?? 0));
  }
}

/**
 * Update bakery order status. When moving to cancelled, restores product stock
 * (if tracked). When leaving cancelled, re-deducts stock so a later cancel stays correct.
 */
export const bakeryUpdateOrderStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        orderId: z.string().uuid(),
        status: z.string().min(1).max(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await isPlatformAdmin(context.userId);
    const client = await getProjectClient(data.projectId, context.userId, admin);

    const { data: order, error: orderErr } = await client
      .from("orders")
      .select("id, order_status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderErr) throw new Error(orderErr.message);
    if (!order) throw new Error("ORDER_NOT_FOUND");

    const prev = String(order.order_status ?? "").toLowerCase();
    const next = String(data.status ?? "").toLowerCase();

    if (prev !== "cancelled" && next === "cancelled") {
      await restoreOrderItemsStock(client, data.orderId);
    } else if (prev === "cancelled" && next !== "cancelled") {
      await deductOrderItemsStock(client, data.orderId);
    }

    const { error: updErr } = await client
      .from("orders")
      .update({ order_status: data.status })
      .eq("id", data.orderId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true as const, status: data.status };
  });
