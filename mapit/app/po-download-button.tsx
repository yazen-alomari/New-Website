"use client";
import { Download } from "lucide-react";
import { mapitPath } from "./paths";
import type { Lab, Order } from "./model";

export function PoDownloadButton({ order, lab, primary = false }: { order: Order; lab: Lab; primary?: boolean }) {
  return <div className="po-download-control"><a className={`button ${primary ? "primary" : "small"}`} href={mapitPath(`api/purchase-order?orderId=${encodeURIComponent(order.id)}`)} download title={`Download ${order.reference} for ${lab.name}`}><Download size={16}/>Download PO</a></div>;
}
