"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PhoneInput from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Minus,
  Plus,
  Building2,
  Loader2,
  Check,
  Copy,
  Flag,
  Rocket,
  Trophy,
  Crown,
  Zap,
  Star,
  SlidersHorizontal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useOrg } from "@/components/OrgBrandProvider";
import {
  normalizeCheckoutFields,
  type CheckoutFields,
} from "@/types/org";
import type { TicketBundle } from "@/types/raffle";
import { maxTicketsPerPurchase, priceForQuantity } from "@/lib/ticket-bundles";
import { cn } from "@/lib/utils";

interface BankAccount {
  id: string;
  name: string;
  bank: string;
  accountNumber: string;
  accountType: string;
  currency: string;
  holderName?: string;
  cedula?: string;
}

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  raffleId: string;
  ticketPrice: number;
  availableTickets: number;
  totalTickets: number;
  minTickets?: number;
  bundles?: TicketBundle[];
  raffleTitle?: string;
  /** Override tenant `/api/accounts` (e.g. platform verified checkout). */
  accountsUrl?: string;
  /** Override tenant `/api/purchases/voucher`. */
  purchaseUrl?: string;
  /** When set, used instead of the org brand provider checkout fields. */
  checkoutFieldsOverride?: CheckoutFields;
  /**
   * Where to send the buyer after a successful purchase when phone was collected.
   * Pass `null` to stay on the current page. Defaults to `/verify-tickets`.
   */
  afterPurchaseHref?: string | null;
}

const BUNDLE_ICONS = [Flag, Rocket, Trophy, Crown, Zap];
const VOUCHER_MAX_BYTES = 10 * 1024 * 1024;
const VOUCHER_TYPES = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "application/pdf",
];

const purchaseBaseSchema = z.object({
  name: z.string().optional().default(""),
  email: z.string().optional().default(""),
  whatsappNumber: z.string().optional().default(""),
  ticketQuantity: z.number().min(1, "Debes seleccionar al menos 1 boleto"),
  accountId: z
    .string({ required_error: "Selecciona una cuenta bancaria" })
    .uuid("Selecciona una cuenta bancaria"),
  voucher: z
    .instanceof(File, { message: "Sube el comprobante de transferencia" })
    .refine(
      (file) => file.size <= VOUCHER_MAX_BYTES,
      "El archivo no debe exceder 10MB",
    )
    .refine(
      (file) => VOUCHER_TYPES.includes(file.type),
      "Formato inválido. Solo JPG, PNG, WEBP o PDF",
    ),
});

function purchaseFormSchema(fields: CheckoutFields) {
  return purchaseBaseSchema.superRefine((data, ctx) => {
    if (fields.name && (!data.name || data.name.trim().length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "El nombre debe tener al menos 2 caracteres",
      });
    }
    if (fields.email) {
      const email = data.email?.trim() || "";
      if (!email || !z.string().email().safeParse(email).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: "Correo electrónico inválido",
        });
      }
    }
    if (fields.phone) {
      const phone = data.whatsappNumber?.trim() || "";
      if (phone.length < 10 || !/^[\d\s\-\+\(\)]+$/.test(phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["whatsappNumber"],
          message: "Número de WhatsApp inválido",
        });
      }
    }
  });
}

type PurchaseFormData = z.infer<typeof purchaseBaseSchema>;

export default function PurchaseDialog({
  open,
  onOpenChange,
  raffleId,
  ticketPrice,
  availableTickets,
  totalTickets,
  minTickets = 1,
  bundles = [],
  raffleTitle,
  accountsUrl = "/api/accounts",
  purchaseUrl = "/api/purchases/voucher",
  checkoutFieldsOverride,
  afterPurchaseHref,
}: PurchaseDialogProps) {
  const effectiveMin = Math.max(
    1,
    Math.min(minTickets, availableTickets || minTickets),
  );
  const effectiveMax = Math.min(
    Math.max(availableTickets, 0),
    maxTicketsPerPurchase(totalTickets),
  );
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [customQuantity, setCustomQuantity] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { org } = useOrg();
  const checkoutFields = useMemo(
    () =>
      checkoutFieldsOverride
        ? normalizeCheckoutFields(checkoutFieldsOverride)
        : normalizeCheckoutFields(org?.checkout_fields),
    [checkoutFieldsOverride, org?.checkout_fields],
  );
  const schema = useMemo(
    () => purchaseFormSchema(checkoutFields),
    [checkoutFields],
  );

  const copyToClipboard = async (
    text: string,
    fieldId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({
        title: "Error",
        description: "No se pudo copiar al portapapeles",
        variant: "destructive",
      });
    }
  };

  const form = useForm<PurchaseFormData>({
    resolver: (values, context, options) =>
      zodResolver(schema)(values, context, options),
    defaultValues: {
      name: "",
      email: "",
      whatsappNumber: "",
      ticketQuantity: effectiveMin,
      accountId: undefined,
      voucher: undefined,
    },
  });

  const { watch, setValue, reset } = form;
  const ticketQuantity = watch("ticketQuantity");
  const selectedAccountId = watch("accountId");
  const voucherFile = watch("voucher");
  const quantityCeiling = effectiveMax;
  const quantityFloor =
    effectiveMax > 0 ? Math.min(effectiveMin, effectiveMax) : effectiveMin;
  const [quantityText, setQuantityText] = useState(String(quantityFloor));
  const quantityFocused = useRef(false);
  const visibleBundles = bundles.filter(
    (bundle) =>
      bundle.quantity >= quantityFloor && bundle.quantity <= quantityCeiling,
  );
  const activeBundle =
    visibleBundles.find((bundle) => bundle.quantity === ticketQuantity) ?? null;
  const totalPrice = priceForQuantity(ticketQuantity, ticketPrice, visibleBundles);

  useEffect(() => {
    if (quantityFocused.current) return;
    setQuantityText(String(ticketQuantity));
  }, [ticketQuantity]);

  useEffect(() => {
    if (!open) return;
    const first = bundles.find(
      (bundle) =>
        bundle.quantity >= quantityFloor && bundle.quantity <= quantityCeiling,
    );
    setCustomQuantity(!first);
    setValue(
      "ticketQuantity",
      first ? first.quantity : quantityFloor,
    );
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh accounts when dialog opens for this raffle
  }, [open, quantityFloor, quantityCeiling, raffleId, accountsUrl]);

  const fetchAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      const response = await fetch(accountsUrl);
      const result = await response.json();
      if (result.success && result.data.length > 0) {
        setAccounts(result.data);
        setValue("accountId", result.data[0].id);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las cuentas bancarias",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const clampQuantity = (value: number) => {
    if (quantityCeiling <= 0) return quantityFloor;
    return Math.min(quantityCeiling, Math.max(quantityFloor, value));
  };

  const commitQuantity = (raw: string) => {
    const parsed = parseInt(raw, 10);
    const next = clampQuantity(Number.isFinite(parsed) ? parsed : ticketQuantity);
    setValue("ticketQuantity", next);
    setQuantityText(String(next));
  };

  const handleQuantityChange = (delta: number) => {
    const next = clampQuantity(ticketQuantity + delta);
    setValue("ticketQuantity", next);
    setQuantityText(String(next));
  };

  const handleQuantityInput = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits === "") {
      setQuantityText("");
      return;
    }
    const parsed = parseInt(digits, 10);
    if (quantityCeiling > 0 && parsed > quantityCeiling) {
      setValue("ticketQuantity", quantityCeiling);
      setQuantityText(String(quantityCeiling));
      return;
    }
    setQuantityText(digits);
    if (parsed >= 1 && parsed <= quantityCeiling) {
      setValue("ticketQuantity", parsed);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setValue("voucher", file, { shouldValidate: true });
    }
  };

  const onSubmit = async (data: PurchaseFormData) => {
    if (data.ticketQuantity < quantityFloor || data.ticketQuantity > quantityCeiling) {
      toast({
        title: "Cantidad inválida",
        description:
          data.ticketQuantity > quantityCeiling
            ? `El máximo por compra es ${quantityCeiling} boletos`
            : `El mínimo de boletos es ${quantityFloor}`,
        variant: "destructive",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("voucher", data.voucher);
      formData.append("raffleId", raffleId.toString());
      formData.append("ticketQuantity", data.ticketQuantity.toString());
      formData.append("totalAmount", totalPrice.toString());
      if (checkoutFields.name && data.name?.trim()) {
        formData.append("name", data.name.trim());
      }
      if (checkoutFields.phone && data.whatsappNumber?.trim()) {
        formData.append("whatsappNumber", data.whatsappNumber.trim());
      }
      formData.append("accountId", data.accountId.toString());
      if (checkoutFields.email && data.email?.trim()) {
        formData.append("email", data.email.trim());
      }

      const response = await fetch(purchaseUrl, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        const whatsapp = data.whatsappNumber?.trim();
        toast({
          title: "¡Comprobante enviado!",
          description:
            "Tu comprobante ha sido recibido. Te notificaremos cuando sea verificado.",
        });
        reset({
          name: "",
          email: "",
          whatsappNumber: "",
          ticketQuantity: effectiveMin,
          accountId: undefined,
          voucher: undefined,
        });
        onOpenChange(false);
        if (checkoutFields.phone && whatsapp) {
          const href =
            afterPurchaseHref === undefined
              ? `/verify-tickets?phone=${encodeURIComponent(whatsapp)}`
              : afterPurchaseHref === null
                ? null
                : `${afterPurchaseHref}${afterPurchaseHref.includes("?") ? "&" : "?"}phone=${encodeURIComponent(whatsapp)}`;
          if (href) {
            if (href.startsWith("http://") || href.startsWith("https://")) {
              window.location.assign(href);
            } else {
              router.push(href);
            }
          }
        }
      } else {
        toast({
          title: "Error",
          description:
            result.code === "TICKET_QUOTA_EXCEEDED"
              ? "Esta rifa no está aceptando compras en este momento. Intenta más tarde."
              : result.error || "Error al enviar el comprobante",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          "Error al enviar el comprobante. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] max-h-[92vh] overflow-y-auto border-white/10 bg-[#101010] p-5 text-white sm:rounded-3xl [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-lg [&>button]:text-white/80 [&>button]:hover:bg-white/10 [&>button]:hover:text-white [&_input]:border-white/15 [&_input]:bg-[#1c1c1c] [&_input]:text-white [&_input]:placeholder:text-white/40">
        <DialogHeader className="space-y-1 pr-8 text-left">
          {visibleBundles.length > 0 && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">
              Elige tu paquete
            </p>
          )}
          <DialogTitle className="text-left text-2xl font-bold uppercase leading-tight text-white">
            {raffleTitle || "Comprar boletos"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Selecciona un paquete o una cantidad y envía el comprobante de
            transferencia
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {(checkoutFields.name ||
              checkoutFields.email ||
              checkoutFields.phone) && (
              <div className="space-y-4 border-card-border">
                {checkoutFields.name && (
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Nombre completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Tu nombre" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {checkoutFields.email && (
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Correo electrónico</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="Ej: juan@ejemplo.com"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Te enviaremos confirmación cuando tu pago sea
                          verificado
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {checkoutFields.phone && (
                  <FormField
                    control={form.control}
                    name="whatsappNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Teléfono</FormLabel>
                        <FormControl>
                          <PhoneInput
                            defaultCountry="do"
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder="Número de teléfono"
                            inputClassName="!border-white/15 !bg-[#1c1c1c] !text-white placeholder:!text-white/40"
                            countrySelectorStyleProps={{
                              buttonStyle: {
                                backgroundColor: "#1c1c1c",
                                color: "#fff",
                                border: "1px solid rgba(255,255,255,0.15)",
                                borderRight: "none",
                              },
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}


            <div className="space-y-3">
              {visibleBundles.length > 0 && (
                <div className="space-y-2.5">
                  {visibleBundles.map((bundle, index) => {
                    const Icon = BUNDLE_ICONS[index % BUNDLE_ICONS.length];
                    const selected =
                      !customQuantity && ticketQuantity === bundle.quantity;
                    const badge =
                      bundle.badge === "best"
                        ? "Mejor opción"
                        : bundle.badge === "vip"
                          ? "VIP"
                          : null;
                    return (
                      <button
                        key={bundle.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setCustomQuantity(false);
                          setValue("ticketQuantity", bundle.quantity);
                        }}
                        className={cn(
                          "relative flex w-full items-center gap-3 rounded-2xl border bg-[#161616] px-3 py-3 text-left transition-shadow",
                          badge && "mt-3",
                          selected
                            ? "border-secondary shadow-[0_0_22px_hsl(var(--secondary)/0.55)]"
                            : "border-secondary/35 hover:border-secondary/70",
                        )}
                      >
                        {badge && (
                          <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground">
                            <Star className="h-3 w-3 fill-current" />
                            {badge}
                          </span>
                        )}
                        <span
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                            selected
                              ? "border-secondary text-secondary"
                              : "border-white/15 text-white/80",
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold uppercase tracking-wide">
                          {bundle.label?.trim() || "Paquete"}
                        </span>
                        <span className="text-center">
                          <span className="block text-base font-semibold leading-none">
                            {bundle.quantity}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">
                            Boletos
                          </span>
                        </span>
                        <span className="min-w-[4.75rem] text-right text-base font-bold text-secondary">
                          RD${bundle.price.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    aria-pressed={customQuantity}
                    onClick={() => setCustomQuantity(true)}
                    className={cn(
                      "flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-base font-bold",
                      customQuantity
                        ? "bg-secondary text-secondary-foreground"
                        : "border border-secondary/40 bg-secondary text-secondary-foreground",
                    )}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Personalizado
                  </button>
                </div>
              )}

              {(visibleBundles.length === 0 || customQuantity) && (
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#161616] px-4 py-3">
                  <div>
                    <Label className="text-sm font-medium text-white">
                      Cantidad de boletos
                    </Label>
                    <p className="mt-1 text-xs text-white/50">
                      {quantityFloor > 1 ? `Mínimo ${quantityFloor} · ` : ""}
                      Máximo {quantityCeiling}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleQuantityChange(-1)}
                      disabled={ticketQuantity <= quantityFloor}
                      className="h-9 w-9 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <input
                      inputMode="numeric"
                      aria-label="Cantidad de boletos"
                      size={Math.max(2, quantityText.length)}
                      value={quantityText}
                      onFocus={(e) => {
                        quantityFocused.current = true;
                        const input = e.currentTarget;
                        requestAnimationFrame(() => input.select());
                      }}
                      onClick={(e) => e.currentTarget.select()}
                      onChange={(e) => handleQuantityInput(e.target.value)}
                      onBlur={() => {
                        quantityFocused.current = false;
                        commitQuantity(quantityText);
                      }}
                      className="w-auto bg-transparent text-center text-xl font-bold tabular-nums text-white outline-none"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleQuantityChange(1)}
                      disabled={ticketQuantity >= quantityCeiling}
                      className="h-9 w-9 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-sm text-white/60">
                  {activeBundle
                    ? `${ticketQuantity} boletos · precio especial`
                    : `${ticketQuantity} boletos × RD$${ticketPrice.toLocaleString()}`}
                </span>
                <span className="text-xl font-bold text-white">
                  RD${totalPrice.toLocaleString()}
                </span>
              </div>
            </div>


            <div className="space-y-4">
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => {
                  const selectedAccount = accounts.find(
                    (account) => account.id === field.value,
                  );
                  return (
                    <FormItem>
                      <FormLabel className="text-white">Método de pago</FormLabel>
                      {isLoadingAccounts ? (
                        <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-4">
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          <span className="text-sm text-muted-foreground">
                            Cargando cuentas...
                          </span>
                        </div>
                      ) : accounts.length > 0 ? (
                        <div className="space-y-3">
                          <Select
                            value={field.value}
                            onValueChange={(value) => field.onChange(value)}
                          >
                            <FormControl>
                              <SelectTrigger className="border-white/15 bg-[#1c1c1c] text-white">
                                <SelectValue placeholder="Selecciona un método de pago" />
                              </SelectTrigger>
                            </FormControl>
                              <SelectContent className="bg-card text-card-foreground">
                              {accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.bank || account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {selectedAccount && (
                            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-secondary" />
                                <span className="font-semibold">
                                  {selectedAccount.bank || selectedAccount.name}
                                </span>
                              </div>
                              {selectedAccount.accountNumber && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                                  <span>{selectedAccount.accountType}:</span>
                                  <span className="font-mono">
                                    {selectedAccount.accountNumber}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      copyToClipboard(
                                        selectedAccount.accountNumber,
                                        `account-${selectedAccount.id}`,
                                        e,
                                      )
                                    }
                                    className="inline-flex items-center gap-1 text-xs text-secondary hover:text-secondary/80 transition-colors ml-1"
                                    title="Copiar número de cuenta"
                                  >
                                    {copiedField ===
                                    `account-${selectedAccount.id}` ? (
                                      <Check className="h-3 w-3" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                </p>
                              )}
                              {selectedAccount.holderName && (
                                <p className="text-sm text-muted-foreground">
                                  A nombre de: {selectedAccount.holderName}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-white/50">
                          <p>No hay cuentas bancarias disponibles</p>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="voucher"
                render={() => (
                  <FormItem>
                    <FormControl>
                      <label
                        className={cn(
                          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-center transition-colors",
                          voucherFile
                            ? "border-secondary bg-secondary/10"
                            : "border-secondary/70 bg-[#1a140c] hover:bg-secondary/10",
                        )}
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                          <Upload className="h-5 w-5" />
                        </span>
                        <span className="space-y-1">
                          <span className="block text-base font-semibold text-white">
                            {voucherFile ? voucherFile.name : "Subir comprobante"}
                          </span>
                          <span className="block text-sm text-white/50">
                            PNG, JPG, WEBP o PDF. Máximo 10 MB.
                          </span>
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,application/pdf"
                          onChange={handleFileChange}
                          className="sr-only"
                        />
                      </label>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold py-6 text-base"
                size="lg"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar comprobante"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
